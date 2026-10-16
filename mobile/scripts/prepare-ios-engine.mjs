import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, copyFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_VARIATION_COUNT } from '../src/domain/lineLimits.js';

if (process.platform !== 'darwin') throw Error('iOS native compilation requires macOS/Xcode (use the GitHub workflow).');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(await readFile(path.join(root, 'engine/pikafish.json'), 'utf8'));
const source = path.join(root, 'artifacts/pikafish-source');
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: 'inherit' });
await mkdir(path.join(root, 'artifacts'), { recursive: true });
if (!existsSync(source)) run('git', ['clone', '--depth', '1', '--branch', `Pikafish-${spec.version}`, spec.repository, source]);
const git = args => execFileSync('git', args, { cwd: source }).toString().trim();
if (git(['rev-parse', 'HEAD']) !== spec.commit || git(['status', '--porcelain'])) throw Error('Expected the clean pinned engine source.');
const network = path.resolve(root, 'engine', spec.nnue);
if (createHash('sha256').update(await readFile(network)).digest('hex') !== spec.nnueSha256) throw Error('NNUE checksum mismatch.');
const assets = path.join(root, 'ios/App/App/analysis');
await mkdir(assets, { recursive: true });
await copyFile(network, path.join(assets, 'pikafish.nnue'));
await copyFile(path.join(source, 'Copying.txt'), path.join(assets, 'Pikafish-GPL.txt'));
await copyFile(path.join(root, 'engine/NNUE-License.md'), path.join(assets, 'NNUE-License.md'));
run('git', ['archive', '--format=tar', `--output=${path.join(assets, 'pikafish-source.tar')}`, spec.commit], source);
await copyFile(fileURLToPath(import.meta.url), path.join(assets, 'prepare-ios-engine.mjs'));
await copyFile(path.join(root, 'tests/ios-smoke-body.js'), path.join(assets, 'ios-smoke.js'));
const cpp = (await readdir(path.join(source, 'src'), { recursive: true })).filter(name => name.endsWith('.cpp') && name !== 'main.cpp').sort();
const files = [...cpp.map(name => path.join(source, 'src', name)), path.join(root, 'native/PikafishSession.cpp')];
const sdkList = process.argv.slice(2);
for (const sdk of sdkList.length ? sdkList : ['iphonesimulator', 'iphoneos']) {
    if (!['iphoneos', 'iphonesimulator'].includes(sdk)) throw Error('Unexpected SDK');
    const output = path.join(root, 'ios/App/NativeBuild', sdk);
    await mkdir(output, { recursive: true });
    const sdkPath = execFileSync('xcrun', ['--sdk', sdk, '--show-sdk-path']).toString().trim();
    const arch = sdk === 'iphoneos' ? 'arm64' : process.arch === 'arm64' ? 'arm64' : 'x86_64';
    const target = `${arch}-apple-ios15.0${sdk === 'iphonesimulator' ? '-simulator' : ''}`;
    const flags = ['-target', target, '-isysroot', sdkPath, '-std=c++17', '-O3', '-DNDEBUG', '-DIS_64BIT',
        '-DUSE_PTHREADS', `-DXQ_VARIATION_COUNT=${ENGINE_VARIATION_COUNT}`, '-DGIT_DATE=20260102', `-DGIT_SHA=${spec.commit.slice(0, 8)}`,
        '-I', path.join(source, 'src'), '-I', path.join(root, 'native'),
        ...(arch === 'arm64' ? ['-DUSE_NEON=8', '-DUSE_POPCNT'] : ['-DUSE_SSE2', '-msse2'])];
    const objects = files.map((_, index) => path.join(output, `${index}.o`));
    // Two compiler jobs cap peak memory on standard GitHub macOS runners.
    let next = 0;
    const worker = async () => {
        for (let index; (index = next++) < files.length;) await new Promise((resolve, reject) => {
            const child = spawn('xcrun', ['--sdk', sdk, 'clang++', ...flags, '-c', files[index], '-o', objects[index]], { cwd: source, stdio: 'inherit' });
            child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(Error(`C++ compilation failed: ${files[index]}`)));
        });
    };
    console.log(`Building pinned Pikafish library: ${sdk} ${arch}, ${ENGINE_VARIATION_COUNT} variations`);
    await Promise.all([worker(), worker()]);
    run('xcrun', ['libtool', '-static', '-o', path.join(output, 'libPikafish.a'), ...objects]);
    await writeFile(path.join(output, 'engine.json'), JSON.stringify({ ...spec, sdk, arch, target, variations: ENGINE_VARIATION_COUNT }, null, 2));
}
