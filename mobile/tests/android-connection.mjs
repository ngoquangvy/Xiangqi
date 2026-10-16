import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const packageId = 'com.ngoquangvy.xiangqi.mobile';
const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA, 'Android/Sdk');
const adbPath = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const serial = process.env.ANDROID_TEST_SERIAL || 'emulator-5554';
if (!serial.startsWith('emulator-')) throw Error('Media tests run only on an emulator.');
export const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], { timeout: 30000 });
export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function connect() {
    const pid = adb('shell', 'pidof', '-s', packageId).toString().trim();
    if (!pid) throw Error('Open the app before connecting to its debug WebView.');
    const port = adb('forward', 'tcp:0', `localabstract:webview_devtools_remote_${pid}`).toString().trim();
    let socket, sequence = 0;
    const pending = new Map();
    const close = () => { socket?.close(); adb('forward', '--remove', `tcp:${port}`); };
    try {
        let target;
        const deadline = Date.now() + 10000;
        for (let i = 0; i < 100 && Date.now() < deadline; i++) {
            const targets = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2000) }).then(r => r.json()).catch(() => []);
            target = targets.find(page => page.url.startsWith('https://localhost'));
            if (target) break;
            await pause(100);
        }
        if (!target) throw Error('No debug WebView');
        socket = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(Error('Debug WebView connection timed out')), 5000);
            socket.onopen = () => { clearTimeout(timer); resolve(); };
            socket.onerror = error => { clearTimeout(timer); reject(error); };
        });
        socket.onmessage = event => {
            const msg = JSON.parse(event.data), item = pending.get(msg.id);
            if (!item) return;
            pending.delete(msg.id); clearTimeout(item.timer);
            if (msg.error) item.reject(Error(msg.error.message)); else item.resolve(msg.result);
        };
        const call = (method, params = {}) => new Promise((resolve, reject) => {
            const id = ++sequence;
            const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 15000);
            pending.set(id, { resolve, reject, timer });
            socket.send(JSON.stringify({ id, method, params }));
        });
        const evaluate = async expression => {
            const data = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            if (data.exceptionDetails) throw Error(JSON.stringify(data.exceptionDetails));
            return data.result.value;
        };
        const wait = async expression => {
            for (let i = 0; i < 100; i++) {
                if (await evaluate(expression).catch(() => false)) return;
                await pause(100);
            }
            throw Error('Android condition timed out: ' + expression);
        };
        const touch = async selector => {
            const point = await evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)throw Error('Missing touch target');node.scrollIntoView({block:'nearest'});const b=node.getBoundingClientRect();if(!b.width||!b.height||b.top<0||b.bottom>innerHeight+1)throw Error('Touch target is outside the viewport');return [Math.round((b.x+b.width/2)*devicePixelRatio),Math.round((b.y+b.height/2)*devicePixelRatio)];})()`);
            adb('shell', 'input', 'tap', ...point.map(String));
            await pause(80);
        };
        return { call, evaluate, wait, touch, close };
    } catch (error) { close(); throw error; }
}
