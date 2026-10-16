import { execFileSync } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = args => execFileSync('xcrun', ['simctl', ...args], { cwd: root, timeout: 120000 }).toString().trim();
const types = JSON.parse(run(['list', 'devicetypes', '--json'])).devicetypes;
const type = types.find(device => device.name === 'iPhone 13') || types.find(device => device.name.startsWith('iPhone'));
const runtimes = JSON.parse(run(['list', 'runtimes', '--json'])).runtimes.filter(runtime => runtime.isAvailable && runtime.name.startsWith('iOS'));
const runtime = runtimes.find(item => item.version.startsWith('26.')) || runtimes[0];
if (!type || !runtime) throw Error('No available iPhone Simulator type/runtime.');
// Create our own disposable device; never uninstall an app from someone's
// existing local simulator. iPhone 13 matches the user's physical test phone.
const id = run(['create', 'Xiangqi-CI', type.identifier, runtime.identifier]);
if (!/^[0-9A-F-]{36}$/i.test(id)) throw Error('Unexpected simulator identifier');
const bundle = 'com.ngoquangvy.xiangqi.mobile';
const app = path.join(root, 'artifacts/ios-simulator/Build/Products/Debug-iphonesimulator/App.app');
try {
    run(['boot', id]);
    run(['bootstatus', id, '-b']);
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
    try { run(['delete', id]); } catch {}
}
