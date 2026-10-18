import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA, 'Android/Sdk');
const adbPath = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const serial = process.env.ANDROID_TEST_SERIAL || 'emulator-5554';
if (!serial.startsWith('emulator-')) throw Error('This test is restricted to an emulator; use ANDROID_TEST_SERIAL.');
const packageId = 'com.ngoquangvy.xiangqi.mobile';
const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8', timeout: 30000 });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, forwardPort, sequence = 0;
const pending = new Map();
function call(method, params = {}) {
    return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 15000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
    });
}
async function evaluate(expression) {
    const { result, exceptionDetails } = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw Error(exceptionDetails.text + ': ' + expression);
    return result.value;
}
async function waitFor(expression) {
    for (let i = 0; i < 100; i++) {
        try { if (await evaluate(expression)) return; } catch {}
        await pause(100);
    }
    throw Error('Android condition timed out: ' + expression);
}
async function attach() {
    const pid = adb('shell', 'pidof', '-s', packageId).trim();
    forwardPort = adb('forward', 'tcp:0', `localabstract:webview_devtools_remote_${pid}`).trim();
    let target;
    for (let i = 0; i < 100; i++) {
        try {
            const targets = await (await fetch(`http://127.0.0.1:${forwardPort}/json/list`)).json();
            target = targets.find(page => page.url.startsWith('https://localhost'));
            if (target) break;
        } catch {}
        await pause(100);
    }
    if (!target) throw Error('Debug WebView not available');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    socket.onmessage = event => {
        const msg = JSON.parse(event.data), item = pending.get(msg.id);
        if (!item) return;
        pending.delete(msg.id); clearTimeout(item.timer);
        if (msg.error) item.reject(Error(msg.error.message)); else item.resolve(msg.result);
    };
    await waitFor('document.querySelectorAll(".square.red, .square.black").length === 32');
    await evaluate('document.querySelector("#open-analysis").click()');
    return pid;
}
async function detach() {
    socket?.close();
    if (forwardPort) adb('forward', '--remove', `tcp:${forwardPort}`);
    forwardPort = null;
}
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
async function touchSquare(square) {
    const point = await evaluate(`(() => {
        const b=document.querySelector('.square[data-square="${square}"]').getBoundingClientRect();
        return {x:(b.x+b.width/2)*devicePixelRatio,y:(b.y+b.height/2)*devicePixelRatio};
    })()`);
    adb('shell', 'input', 'tap', String(Math.round(point.x)), String(Math.round(point.y)));
}

try {
    for (let i = 0; i < 60; i++) {
        if (adb('shell', 'getprop', 'sys.boot_completed').trim() === '1') break;
        await pause(500);
    }
    if (adb('shell', 'getprop', 'sys.boot_completed').trim() !== '1') throw Error('Emulator is still booting');
    console.log(adb('install', '-r', path.join(root, 'artifacts/xiangqi-mobile-debug.apk')).trim());
    adb('shell', 'pm', 'clear', packageId);
    adb('shell', 'am', 'start', '-W', '-n', `${packageId}/.MainActivity`);
    const pid = await attach();
    assert.equal(await evaluate('document.querySelectorAll(".square.red, .square.black").length'), 32);
    assert.deepEqual(await evaluate("Capacitor.nativePromise('LocalSession','get',{})"), { value: null });
    await click('#language');
    assert.equal(await evaluate('document.documentElement.lang'), 'en');
    assert.match(await evaluate('document.querySelector("#undo").textContent'), /Previous/);
    await click('.square[data-square="h2"]');
    assert.ok(await evaluate('document.querySelectorAll(".square.legal").length > 0'));
    await click('[data-uci="h2e2"]');
    assert.equal(await evaluate('document.querySelector("#cancel-preview").hidden'), false);
    adb('shell', 'input', 'keyevent', '4');
    await waitFor('document.querySelector("#preview-guide").hidden');
    assert.equal(await evaluate('document.querySelector("#cancel-preview").hidden'), false);
    adb('shell', 'input', 'keyevent', '4');
    await waitFor('document.querySelector("#cancel-preview").hidden');
    assert.equal(await evaluate('document.querySelector("#cancel-preview").hidden'), true);
    await touchSquare('h2');
    await waitFor('document.querySelectorAll(".square.legal").length > 0');
    await touchSquare('e2');
    await waitFor('document.querySelector("#position-label").textContent.includes("1/1")');
    assert.match(await evaluate('document.querySelector("#position-label").textContent'), /1\/1/);
    await click('#expand');
    adb('shell', 'input', 'keyevent', '4');
    await waitFor('!document.querySelector("#mobile-app").classList.contains("expanded")');
    assert.equal(await evaluate('document.querySelector("#mobile-app").classList.contains("expanded")'), false);
    const bounds = await evaluate(`(() => {
        const top=document.querySelector('.topbar').getBoundingClientRect().top;
        const bottom=document.querySelector('.footer').getBoundingClientRect().bottom;
        return {top,bottom,height:innerHeight,width:innerWidth,dpr:devicePixelRatio,
            pieces:document.querySelectorAll('.square.red,.square.black').length};
    })()`);
    assert.ok(bounds.bottom <= bounds.height + 1, JSON.stringify(bounds));
    assert.equal(bounds.pieces, 32);
    await waitFor('document.querySelector("#save-status").textContent === "Autosaved on this device"');
    await writeFile(path.join(root, 'artifacts/android-portrait.png'), execFileSync(adbPath, ['-s', serial, 'exec-out', 'screencap', '-p']));
    // Force-stop models process death, rather than an ordinary view refresh.
    await detach();
    adb('shell', 'am', 'force-stop', packageId);
    adb('shell', 'am', 'start', '-W', '-n', `${packageId}/.MainActivity`);
    await attach();
    assert.equal(await evaluate('document.documentElement.lang'), 'en');
    assert.match(await evaluate('document.querySelector("#position-label").textContent'), /1\/1/);
    assert.equal(await evaluate('document.querySelector(".square[data-square=e2] .chip").textContent'), '炮');
    const permissions = adb('shell', 'dumpsys', 'package', packageId);
    assert.ok(!permissions.includes('android.permission.INTERNET'), 'Offline APK unexpectedly requests network access');
    const logs = adb('logcat', '-d', `--pid=${pid}`, '-s', 'Capacitor/Console:E', 'AndroidRuntime:E');
    assert.ok(!/Uncaught|FATAL EXCEPTION/.test(logs), logs);
    console.log('ANDROID_SMOKE_PASS', JSON.stringify({ ...bounds, nativeBack: true, processRestore: true, internetPermission: false }));
} finally { await detach(); }
