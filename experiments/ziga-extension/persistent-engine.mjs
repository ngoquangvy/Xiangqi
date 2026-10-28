import {settings} from './settings.mjs';
import {spawn} from 'node:child_process';
import {dirname} from 'node:path';
import XiangqiGame from './vendor/XiangqiGame.js';
import {legalMoves} from './src/engine.js';
import {parseMove} from './book.mjs';
import {SearchProgress} from './search-progress.mjs';
import {CpuGuard} from './cpu-guard.mjs';
export const fenKey=fen=>fen.split(/\s+/).slice(0,2).join(' ');
function gameFor(fen){const g=new XiangqiGame();if(!g.importFen(fen))throw Error('Invalid FEN');return g;}
function apply(fen,uci){const g=gameFor(fen),m=parseMove(uci);if(!m||!legalMoves(g,g.currentTurn).some(n=>n.x===m.x&&n.y===m.y&&n.tx===m.tx&&n.ty===m.ty)||!g.move(m.x,m.y,m.tx,m.ty))throw Error('Invalid engine move');return {move:m,fen:g.exportFen()};}
export class PersistentEngine{
  constructor(enginePath,{guard=new CpuGuard(),ponderBurstMs=settings.engine.ponderBurstMs,ponderRestMs=settings.engine.ponderRestMs,stopTimeoutMs=settings.engine.stopTimeoutMs}={}){
    Object.assign(this,{enginePath,guard,ponderBurstMs,ponderRestMs,stopTimeoutMs});this.proc=null;this.task=null;this.waiters=new Map();this.queue=Promise.resolve();this.owner=null;this.gameId=null;this.prediction=null;this.cache=null;this.plan=null;this.nextPonderAt=0;this.closed=false;this.name='Pikafish';
    this.guard.sample();this.cpuTimer=setInterval(()=>{this.guard.sample();if(this.task&&this.guard.status().ponderPaused)this.interrupt(false);},settings.cpu.sampleMs);this.cpuTimer.unref();
  }
  serial(fn){const p=this.queue.then(fn);this.queue=p.catch(()=>{});return p;}
  send(line){if(!this.proc?.stdin.writable)throw Error('Engine is not running');this.proc.stdin.write(line+'\n');}
  wait(line,ms=settings.engine.handshakeMs){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.waiters.delete(line);reject(Error('Engine handshake timed out'));},ms);this.waiters.set(line,{resolve:()=>{clearTimeout(timer);this.waiters.delete(line);resolve();},reject:e=>{clearTimeout(timer);this.waiters.delete(line);reject(e);}});});}
  fail(error){for(const w of [...this.waiters.values()])w.reject(error);if(this.task)clearTimeout(this.task.timer);this.task?.reject(error);this.task=null;this.cache=null;this.plan=null;const proc=this.proc;this.proc=null;proc?.kill();}
  async boot(){
    if(this.closed)throw Error('Bridge closed');if(this.proc)return;
    const p=this.proc=spawn(this.enginePath,[],{cwd:dirname(this.enginePath),windowsHide:true});let buffer='';
    const failed=e=>{if(this.proc===p)this.fail(e);};p.on('error',failed);p.on('exit',code=>failed(Error('Engine exited ('+code+')')));p.stdin.on('error',failed);p.stderr.on('data',()=>{});
    p.stdout.on('data',chunk=>{if(this.proc!==p)return;buffer+=chunk.toString();let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);try{this.onLine(line);}catch(e){failed(e);}}});
    const uci=this.wait('uciok');this.send('uci');await uci;
    this.send('setoption name Hash value 64');this.send('setoption name Ponder value true');await this.ready();
  }
  async ready(){const p=this.wait('readyok');this.send('isready');await p;}
  onLine(line){
    if(line.startsWith('id name '))this.name=line.slice(8);
    this.waiters.get(line)?.resolve();const t=this.task;if(!t)return;
    if(line.startsWith('info ')){t.progress.update(line);if(!t.ponder&&!t.stopping&&t.progress.canStop(t.movetime))this.interrupt(false);return;}
    if(!line.startsWith('bestmove '))return;
    clearTimeout(t.timer);this.task=null;
    try{
      const [,uci,,reply]=line.split(/\s+/);const g=gameFor(t.fen);
      let move=null,after=null;
      if(uci==='(none)'||uci==='0000'){if(legalMoves(g,g.currentTurn).length)throw Error('Engine returned no move');}
      else({move,fen:after}=apply(t.fen,uci));
      const r={move,uci,engine:this.name,source:'engine',depth:t.progress.depth,nodes:t.progress.nodes,score:t.progress.score,searchMs:t.progress.searchMs,scoreGap:t.progress.scoreGap,stableDepths:t.progress.stableDepths,threads:t.threads,depthLimit:t.depth,ms:Date.now()-t.started,pid:this.proc?.pid,cancelled:t.discard};
      if(reply&&after){try{apply(after,reply);r.prediction={afterKey:fenKey(after),reply};}catch{}}
      if(t.ponder&&!t.discard&&!t.promoted){this.cache={key:fenKey(t.fen),result:r,gameId:this.gameId,owner:this.owner};this.nextPonderAt=Date.now()+this.ponderRestMs;}
      t.resolve(r);
    }catch(e){t.reject(e);}
  }
  interrupt(discard=true){const t=this.task;if(!t)return;if(discard)t.discard=true;if(!t.stopping){t.stopping=true;clearTimeout(t.timer);try{this.send('stop');}catch(e){this.fail(e);return;}t.timer=setTimeout(()=>this.fail(Error('Engine did not acknowledge stop')),this.stopTimeoutMs);}}
  async stopTask(discard=true){const t=this.task;if(!t)return;this.interrupt(discard);await t.done.catch(()=>{});}
  async prepare(clientId,gameId){
    if(this.task&&this.owner!==clientId)throw Error('Engine đang bận ở tab khác');
    await this.boot();
    if(this.owner!==clientId||this.gameId!==gameId){await this.stopTask(true);this.owner=clientId;this.gameId=gameId;this.prediction=null;this.plan=null;this.cache=null;this.nextPonderAt=0;this.send('ucinewgame');await this.ready();}
  }
  async launch(fen,{threads,movetime,depth,multiPV},ponder=false){
    await this.stopTask(true);this.send('setoption name Threads value '+threads);this.send('setoption name MultiPV value '+multiPV);await this.ready();
    let resolve,reject;const done=new Promise((r,j)=>{resolve=r;reject=j;});done.catch(()=>{});
    const t=this.task={fen,threads,movetime,depth,ponder,progress:new SearchProgress(),started:Date.now(),done,resolve,reject,discard:false,stopping:false};
    this.send('position fen '+fen);this.send(`go ${ponder?'ponder ':''}movetime ${movetime}${depth?' depth '+depth:''}`);
    t.timer=setTimeout(()=>{if(this.task===t){if(ponder)this.interrupt(false);else this.fail(Error('Engine timed out'));}},ponder?this.ponderBurstMs:movetime+settings.engine.searchGraceMs);
    return t;
  }
  analyze(fen,{clientId='legacy',gameId='legacy',threads=2,movetime=1200,depth=0,signal,usePonder=true}={}){
    return this.serial(async()=>{
      if(signal?.aborted)throw Error('Search cancelled');await this.prepare(clientId,gameId);if(signal?.aborted)throw Error('Search cancelled');
      const limits=this.guard.limits(threads,movetime,depth);const key=fenKey(fen);let r,hit=false;
      const t=this.task;
      if(usePonder&&t?.ponder&&!t.stopping&&fenKey(t.fen)===key&&t.progress.depth>=12&&t.threads===limits.threads){
        t.promoted=true;clearTimeout(t.timer);this.send('ponderhit');this.interrupt(false);r=await t.done;hit=true;
      }else{
        await this.stopTask(!this.task?.ponder||fenKey(this.task.fen)!==key);
        const cached=this.cache;
        if(usePonder&&cached?.key===key&&cached.owner===clientId&&cached.gameId===gameId&&cached.result.depth>=12&&cached.result.threads===limits.threads){r=cached.result;hit=true;}
        else{
          const task=await this.launch(fen,limits);const abort=()=>this.interrupt(true);signal?.addEventListener('abort',abort,{once:true});
          try{if(signal?.aborted)abort();r=await task.done;}finally{signal?.removeEventListener('abort',abort);}
        }
      }
      if(signal?.aborted||r.cancelled)throw Error('Search cancelled');
      this.prediction=r.prediction||null;this.cache=null;this.plan=null;
      // UCI results are validated again, including a cached ponder hit.
      if(r.move)apply(fen,r.uci);
      return {...r,ponderHit:hit,ms:hit?0:r.ms,...this.guard.status()};
    });
  }
  ponder(fen,{clientId='legacy',gameId='legacy',threads=2,movetime=10000,depth=0,signal}={}){
    return this.serial(async()=>{
      if(signal?.aborted)throw Error('Search cancelled');await this.prepare(clientId,gameId);if(signal?.aborted)throw Error('Search cancelled');
      const limits=this.guard.limits(threads,movetime,depth);
      if(!limits.ponderAllowed){await this.stopTask(false);return {pondering:false,...this.guard.status()};}
      if(this.task?.ponder&&this.plan?.opponentKey===fenKey(fen))return {pondering:true,predictedMove:this.plan.reply,...this.guard.status()};
      if(Date.now()<this.nextPonderAt&&this.plan?.opponentKey===fenKey(fen))return {pondering:false,cached:!!this.cache,...this.guard.status()};
      await this.stopTask(true);let reply;
      if(this.prediction?.afterKey===fenKey(fen))reply=this.prediction.reply;
      else if(this.plan?.opponentKey===fenKey(fen))reply=this.plan.reply;
      else{
        const seed=await this.launch(fen,{...limits,movetime:Math.min(settings.engine.ponderSeedMs,limits.movetime),depth:0,multiPV:1});const abort=()=>this.interrupt(true);signal?.addEventListener('abort',abort,{once:true});
        try{if(signal?.aborted)abort();const result=await seed.done;if(result.cancelled)throw Error('Search cancelled');reply=result.uci;}finally{signal?.removeEventListener('abort',abort);}
      }
      if(signal?.aborted)throw Error('Search cancelled');
      const after=apply(fen,reply).fen;
      this.plan={opponentKey:fenKey(fen),reply,expectedKey:fenKey(after)};
      await this.launch(after,{...limits,depth:depth?Math.min(depth,20):20,multiPV:1},true);
      return {pondering:true,predictedMove:reply,...this.guard.status()};
    });
  }
  stop(clientId='legacy',gameId='legacy'){
    if(this.owner!==clientId||this.gameId!==gameId)return {stopped:false};
    this.cache=null;this.prediction=null;this.plan=null;this.interrupt(true);return {stopped:true};
  }
  close(){this.closed=true;clearInterval(this.cpuTimer);this.fail(Error('Bridge closed'));}
  status(){return {pid:this.proc?.pid||null,pondering:!!this.task?.ponder,...this.guard.status()};}
}
