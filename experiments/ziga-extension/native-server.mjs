import http from 'node:http';
import {spawn} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import XiangqiGame from './vendor/XiangqiGame.js';
import {legalMoves} from './src/engine.js';
import {OpeningBook} from './book.mjs';
import {SearchProgress} from './search-progress.mjs';
import {PersistentEngine} from './persistent-engine.mjs';
const root=dirname(fileURLToPath(import.meta.url));
export const defaultEngine=resolve(root,'../../assets/engines/pikafish2026/pikafish-avx2-2026-01-02.exe');
export function validate(fen,movetime){
  if(typeof fen!=='string'||fen.length>200||/[\r\n]/.test(fen))throw Error('Invalid FEN');
  const game=new XiangqiGame();
  if(!game.importFen(fen)||!game.findKing('red')||!game.findKing('black'))throw Error('Invalid FEN');
  if(!Number.isInteger(movetime)||movetime<100||movetime>10000)throw Error('Invalid movetime (100–10000 ms)');
  return game;
}
export function validateSettings(threads=2,depth=0){
  if(!Number.isInteger(threads)||threads<1||threads>16)throw Error('Threads phải từ 1 đến 16');
  if(!Number.isInteger(depth)||depth<0||depth>64)throw Error('Depth phải từ 0 đến 64');
}
export function analyze(fen,movetime,{enginePath=defaultEngine,signal,timeoutMs=15000,threads=2,depth:depthLimit=0}={}){
  const game=validate(fen,movetime);
  validateSettings(threads,depthLimit);
  return new Promise((resolveResult,reject)=>{
    const proc=spawn(enginePath,[],{cwd:dirname(enginePath),windowsHide:true});
    let buffer='',phase='uci',settled=false,engine='Pikafish',depth=0,nodes=0,score=null;
    const progress=new SearchProgress();let earlyStopped=false;
    const start=Date.now();
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);proc.kill();error?reject(error):resolveResult(result);};
    const abort=()=>finish(Error('Search cancelled'));
    const timer=setTimeout(()=>finish(Error('Engine timed out')),timeoutMs);
    const send=s=>{if(!settled&&proc.stdin.writable)proc.stdin.write(s+'\n');};
    proc.on('error',e=>finish(e));
    proc.on('exit',(code)=>finish(Error(`Engine exited (${code})`)));
    proc.stdin.on('error',e=>finish(e));
    proc.stderr.on('data',()=>{});
    proc.stdout.on('data',chunk=>{
      buffer+=chunk.toString();
      let index;
      while((index=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,index).trim();buffer=buffer.slice(index+1);
        if(line.startsWith('id name '))engine=line.slice(8);
        if(line==='uciok'&&phase==='uci'){
          phase='ready';send('setoption name Threads value '+threads);send('setoption name Hash value 64');send('setoption name MultiPV value 2');send('isready');
        }else if(line==='readyok'&&phase==='ready'){
          phase='search';send('ucinewgame');send('position fen '+fen);send('go movetime '+movetime+(depthLimit?' depth '+depthLimit:''));
        }else if(phase==='search'&&line.startsWith('info ')){
          progress.update(line);({depth,nodes,score}=progress);
          if(!earlyStopped&&progress.canStop(movetime)){earlyStopped=true;send('stop');}
        }else if(phase==='search'&&line.startsWith('bestmove ')){
          const uci=line.split(/\s+/)[1];
          if(uci==='(none)'||uci==='0000'){
            if(legalMoves(game,game.currentTurn).length)finish(Error('Engine returned no move for a playable position'));
            else finish(null,{move:null,engine,depth,nodes,score,ms:Date.now()-start});
            continue;
          }
          if(!/^[a-i][0-9][a-i][0-9]$/.test(uci)){finish(Error('Invalid engine move'));continue;}
          const move={x:uci.charCodeAt(0)-97,y:9-Number(uci[1]),tx:uci.charCodeAt(2)-97,ty:9-Number(uci[3])};
          if(!legalMoves(game,game.currentTurn).some(m=>m.x===move.x&&m.y===move.y&&m.tx===move.tx&&m.ty===move.ty)){finish(Error('Engine move failed legal validation'));continue;}
          finish(null,{move,uci,engine,depth,nodes,score,threads,depthLimit,searchMs:progress.searchMs,scoreGap:progress.scoreGap,stableDepths:progress.stableDepths,earlyStopped,ms:Date.now()-start});
        }
      }
    });
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();else send('uci');
  });
}
export function createServer(options={}){
  let busy=false;
  let activeCount=0,activeClient=null;
  const book=options.book||new OpeningBook(resolve(root,'../../assets/books/opening-book.json'));
  const engine=new PersistentEngine(options.enginePath||defaultEngine,options);
  const server=http.createServer(async(req,res)=>{
    const origin=req.headers.origin;
    if(origin&&!/^chrome-extension:\/\/[a-p]{32}$/.test(origin)){res.writeHead(403);res.end();return;}
    if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Ziga-Client');
    res.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Private-Network','true');
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const respond=(status,data)=>{if(!res.destroyed){res.writeHead(status);res.end(JSON.stringify(data));}};
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    if(req.method==='GET'&&req.url==='/health'){respond(200,{ok:true,version:'0.6.0',engine:'Pikafish',busy,bookPositions:book.index.size,bookError:book.error,...engine.status()});return;}
    if(req.method!=='POST'||!['/analyze','/ponder','/stop'].includes(req.url)){respond(404,{error:'Not found'});return;}
    if(!req.headers['content-type']?.startsWith('application/json')){respond(415,{error:'JSON required'});return;}
    const requestClient=req.headers['x-ziga-client'];
    if(busy&&req.url!=='/stop'&&(!requestClient||requestClient!==activeClient)){respond(409,{error:'Engine đang bận ở một tab khác'});return;}
    const ownsBusy=req.url!=='/stop';if(ownsBusy){activeCount++;busy=true;activeClient??=requestClient||null;}const controller=new AbortController();
    res.on('close',()=>{if(!res.writableEnded)controller.abort();});
    try{
      let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)throw Error('Request too large');}
      const {fen,movetime,reverse=false,bookMoves=5,ply=null,threads=2,depth=0,clientId='legacy',gameId='legacy',usePonder=true}=JSON.parse(body);
      if(!/^[\w:-]{1,100}$/.test(clientId)||!/^[\w:-]{1,150}$/.test(gameId))throw Error('Invalid session ID');
      if(req.url==='/stop'){respond(200,engine.stop(clientId,gameId));return;}
      validate(fen,movetime);validateSettings(threads,depth);
      if(req.url==='/ponder'){respond(200,await engine.ponder(fen,{clientId,gameId,threads,movetime,depth,signal:controller.signal}));return;}
      if(typeof reverse!=='boolean'||![0,3,4,5].includes(bookMoves)||(ply!==null&&(!Number.isInteger(ply)||ply<0||ply>10000)))throw Error('Invalid book options');
      const opening=book.lookup(fen,{reverse,bookMoves,ply});
      if(opening.move){respond(200,{...opening,engine:'Opening book',source:'book',depth:0,nodes:0,ms:0});}
      else{
        const result=await engine.analyze(fen,{clientId,gameId,threads,depth,movetime,signal:controller.signal,usePonder});respond(200,{...result,source:'engine',openingPly:opening.openingPly,bookWarning:book.error});
      }
    }catch(e){respond(400,{error:e.message});}finally{if(ownsBusy){activeCount--;busy=activeCount>0;if(!busy)activeClient=null;}}
  });
  server.on('close',()=>engine.close());return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=createServer({enginePath:process.env.ZIGA_ENGINE_PATH||defaultEngine});
  server.requestTimeout=20000;
  server.on('error',e=>{console.error('Không mở được bridge:',e.message);process.exitCode=1;});
  server.listen(17864,'127.0.0.1',()=>console.log('Pikafish bridge 0.6.0: http://127.0.0.1:17864 — Ctrl+C để dừng'));
}
