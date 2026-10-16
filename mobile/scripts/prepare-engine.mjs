import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, mkdir, copyFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(await readFile(path.join(root, 'engine/pikafish.json'), 'utf8'));
const source = path.join(root, 'artifacts/pikafish-source');
const run = (program, args, cwd = root) => execFileSync(program, args, { cwd, stdio: 'inherit' });
await mkdir(path.join(root, 'artifacts'), { recursive: true });
if (!existsSync(source)) run('git', ['clone', '--depth', '1', '--branch', `Pikafish-${spec.version}`, spec.repository, source]);
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source }).toString().trim();
if (commit !== spec.commit || execFileSync('git', ['status', '--porcelain'], { cwd: source }).toString().trim()) throw Error('Engine source must be the clean pinned upstream commit.');
const nnue = path.resolve(root, 'engine', spec.nnue);
if (createHash('sha256').update(await readFile(nnue)).digest('hex') !== spec.nnueSha256) throw Error('NNUE checksum does not match the pinned engine.');
const ndk = process.env.ANDROID_NDK_HOME || process.env.NDK_HOME || path.join(root, 'artifacts/android-ndk-r30');
const host = { win32: 'windows-x86_64', linux: 'linux-x86_64', darwin: 'darwin-x86_64' }[process.platform];
const bin = path.join(ndk, 'toolchains/llvm/prebuilt', host, 'bin');
const clang = path.join(bin, process.platform === 'win32' ? 'clang++.exe' : 'clang++');
if (!existsSync(clang)) throw Error('Set ANDROID_NDK_HOME to an installed NDK r28+ (this script does not install/accept SDK licenses).');
const revision = /Pkg.Revision\s*=\s*(\d+)/.exec(await readFile(path.join(ndk, 'source.properties'), 'utf8'));
if (!revision || Number(revision[1]) < 28) throw Error('NDK r28+ is required for the native engine build.');
const sources = (await readdir(path.join(source, 'src'), { recursive: true })).filter(name => /\.(cpp|S)$/.test(name)).sort();
const native = path.join(root, 'android/app/src/main/jniLibs');
const binaries = {};
for (const [abi, target, flags] of [
    ['arm64-v8a', 'aarch64-linux-android24', ['-march=armv8-a', '-DUSE_NEON=8', '-DUSE_POPCNT']],
    ['x86_64', 'x86_64-linux-android24', ['-msse2', '-DUSE_SSE2']],
]) {
    const destination = path.join(native, abi); await mkdir(destination, { recursive: true });
    console.log(`Compiling Pikafish ${spec.version}: ${abi}`);
    run(clang, [`--target=${target}`, '-std=c++17', '-O3', '-DNDEBUG', '-DIS_64BIT', '-DUSE_PTHREADS',
        '-fno-exceptions', '-pthread', '-fPIE', '-pie', '-static-libstdc++', '-Wl,-z,max-page-size=16384',
        '-Wl,-z,common-page-size=16384', '-DGIT_DATE=20260102', `-DGIT_SHA=${spec.commit.slice(0, 8)}`,
        ...flags, ...sources, '-o', path.join(destination, 'libpikafish.so')], path.join(source, 'src'));
    run(path.join(bin, process.platform === 'win32' ? 'llvm-strip.exe' : 'llvm-strip'), [path.join(destination, 'libpikafish.so')]);
    binaries[abi] = createHash('sha256').update(await readFile(path.join(destination, 'libpikafish.so'))).digest('hex');
}
const assets = path.join(root, 'android/app/src/main/assets/analysis');
await mkdir(assets, { recursive: true });
await copyFile(nnue, path.join(assets, 'pikafish.nnue'));
await copyFile(path.join(source, 'Copying.txt'), path.join(assets, 'Pikafish-GPL.txt'));
await copyFile(path.join(root, 'engine/NNUE-License.md'), path.join(assets, 'NNUE-License.md'));
// Corresponding unmodified source is included, not merely a mutable download URL.
run('git', ['archive', '--format=tar', `--output=${path.join(assets, 'pikafish-source.tar')}`, spec.commit], source);
await copyFile(fileURLToPath(import.meta.url), path.join(assets, 'prepare-engine.mjs'));
await copyFile(path.join(root, 'engine/profiles.json'), path.join(assets, 'profiles.json'));
await writeFile(path.join(assets, 'engine.json'), JSON.stringify({ ...spec, binaries, compiler: execFileSync(clang, ['--version']).toString().split('\n')[0] }, null, 2));
console.log('Native engines, exact source, licenses and NNUE prepared. Run android:build next.');
