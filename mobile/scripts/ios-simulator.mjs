import { execFileSync } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = args => execFileSync('xcrun', ['simctl', ...args], { cwd: root, timeout: 120000 }).toString().trim();
const devices = JSON.parse(run(['list', 'devices', 'available', '--json'])).devices;
const phone = Object.values(devices).flat().find(device => device.isAvailable && device.name.includes('iPhone'));
if (!phone) throw Error('No available iPhone Simulator runtime on this runner.');
const id = phone.udid, bundle = 'com.ngoquangvy.xiangqi.mobile';
const app = path.join(root, 'artifacts/ios-simulator/Build/Products/Debug-iphonesimulator/App.app');
try {
    if (phone.state !== 'Booted') run(['boot', id]);
    run(['bootstatus', id, '-b']);
    // A dedicated hosted CI simulator is disposable; never run on a real phone.
    try { run(['uninstall', id, bundle]); } catch {}
    run(['install', id, app]);
    const container = run(['get_app_container', id, bundle, 'data']);
    const report = path.join(container, 'Documents/ios-smoke.json');
    for (const [phase, argument] of [['initial', '--xq-self-test'], ['restore', '--xq-restore-test']]) {
        await rm(report, { force: true });
        run(['launch', id, bundle, argument]);
        let result;
        for (let i = 0; i < 180; i++) {
            try { result = JSON.parse(await readFile(report, 'utf8')); break; } catch {}
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        await writeFile(path.join(root, `artifacts/ios-smoke-${phase}.json`), JSON.stringify(result || { pass: false, error: 'Timed out' }, null, 2));
        run(['io', id, 'screenshot', path.join(root, `artifacts/ios-${phase}.png`)]);
        if (!result?.pass) throw Error(`iOS ${phase} smoke failed: ${JSON.stringify(result)}`);
        run(['terminate', id, bundle]);
    }
    console.log('IOS_SIMULATOR_PASS: actual WKWebView, five Pikafish PVs, book, preview, native session, relaunch');
} finally {
    try {
        const log = run(['spawn', id, 'log', 'show', '--last', '5m', '--style', 'compact', '--predicate', 'process == "App"']);
        await writeFile(path.join(root, 'artifacts/ios-simulator.log'), log);
    } catch {}
    try { run(['shutdown', id]); } catch {}
}
