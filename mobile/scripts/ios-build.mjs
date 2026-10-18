import { execFileSync } from 'node:child_process';
import { mkdir, cp, stat, writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

if (process.platform !== 'darwin') throw Error('Run the iOS GitHub Actions workflow or use macOS/Xcode.');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit' });
await mkdir(path.join(root, 'artifacts'), { recursive: true });
run('xcrun', ['clang++', '-std=c++17', 'tests/native-options.cpp', '-o', 'artifacts/native-options-test']);
run('artifacts/native-options-test', []);
run('xcrun', ['swiftc', 'ios/App/App/ThermalPolicy.swift', 'tests/ios-thermal-policy.swift', '-o', 'artifacts/thermal-policy-test']);
run('artifacts/thermal-policy-test', []);
const tests = (await readdir(path.join(root, 'tests'))).filter(name => name.endsWith('.test.js'));
run(process.execPath, ['--test', ...tests.map(name => `tests/${name}`)]);
run(process.execPath, ['scripts/build.mjs']);
run(process.execPath, ['scripts/prepare-book.mjs', 'ios']);
run(process.execPath, ['scripts/prepare-ios-engine.mjs']);
run(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'ios']);
const version = process.env.GITHUB_RUN_NUMBER || '1';
if (!/^\d+$/.test(version)) throw Error('Invalid CI build number');
const common = ['-project', 'ios/App/App.xcodeproj', '-scheme', 'App', 'CODE_SIGNING_ALLOWED=NO',
    'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGN_IDENTITY=', `CURRENT_PROJECT_VERSION=${version}`];
run('xcodebuild', [...common, '-configuration', 'Debug', '-sdk', 'iphonesimulator', '-destination', 'generic/platform=iOS Simulator',
    `ARCHS=${process.arch === 'arm64' ? 'arm64' : 'x86_64'}`, 'ONLY_ACTIVE_ARCH=YES', '-derivedDataPath', 'artifacts/ios-simulator', 'build']);
run(process.execPath, ['scripts/ios-simulator.mjs']);
run('xcodebuild', [...common, '-configuration', 'Release', '-sdk', 'iphoneos', '-destination', 'generic/platform=iOS',
    'ARCHS=arm64', 'ONLY_ACTIVE_ARCH=YES', '-derivedDataPath', 'artifacts/ios-device', 'build']);
const application = path.join(root, 'artifacts/ios-device/Build/Products/Release-iphoneos/App.app');
const binary = path.join(application, 'App');
const buildInfo = execFileSync('xcrun', ['vtool', '-show-build', binary]).toString();
if (!/platform IOS\b/.test(buildInfo) || /platform IOSSIMULATOR\b/.test(buildInfo)) throw Error('IPA must contain an iPhone device binary, not a Simulator build.');
if (execFileSync('strings', [binary]).toString().includes('debugThermal')) throw Error('Release must not expose the thermal test hook.');
const staging = path.join(root, 'artifacts/ios-package/Payload');
await mkdir(staging, { recursive: true });
await cp(application, path.join(staging, 'App.app'), { recursive: true });
const ipa = path.join(root, 'artifacts/xiangqi-ios-unsigned.ipa');
run('ditto', ['-c', '-k', '--keepParent', staging, ipa]);
const bytes = (await stat(ipa)).size;
if (bytes > 100 * 1024 * 1024) throw Error('IPA exceeds the 100 MiB native budget.');
await writeFile(path.join(root, 'artifacts/ios-build.json'), JSON.stringify({ version, commit: process.env.GITHUB_SHA || null,
    bytes, sha256: createHash('sha256').update(await readFile(ipa)).digest('hex'), signed: false,
    simulatorSmoke: true, physicalIPhoneTested: false, install: 'Re-sign with Sideloadly; not for direct installation or App Store upload.' }, null, 2));
console.log(`IOS_IPA_READY: ${ipa} (${(bytes / 1024 / 1024).toFixed(1)} MiB), unsigned for Sideloadly`);
