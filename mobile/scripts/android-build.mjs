import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile, mkdir, copyFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const java = process.env.JAVA_HOME || (process.platform === 'win32' ? 'C:/Program Files/Android/Android Studio/jbr' : '');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
    || (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA, 'Android/Sdk') : '');
if (!existsSync(path.join(java, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')) || !existsSync(sdk)) {
    throw Error('Set JAVA_HOME (JDK 21+) and ANDROID_HOME before building Android.');
}
const javaTemp = path.join(root, 'artifacts/java-tmp');
await mkdir(javaTemp, { recursive: true });
const environment = { ...process.env, JAVA_HOME: java, ANDROID_HOME: sdk };
delete environment.ELECTRON_RUN_AS_NODE;
// A project-local socket directory avoids virtualized TEMP paths on Windows.
if (process.platform === 'win32') environment.JAVA_TOOL_OPTIONS = [process.env.JAVA_TOOL_OPTIONS,
    `-Djdk.net.unixdomain.tmpdir="${javaTemp.replaceAll('\\', '/')}"`].filter(Boolean).join(' ');
const run = (program, args, cwd = root) => execFileSync(program, args, { cwd, stdio: 'inherit', env: environment });
// Fail early: do not package a state layer whose unit tests fail.
const tests = (await readdir(path.join(root, 'tests'))).filter(name => name.endsWith('.test.js'));
run(process.execPath, ['--test', ...tests.map(name => path.join(root, 'tests', name))]);
run(process.execPath, ['scripts/build.mjs']);
for (const abi of ['arm64-v8a', 'x86_64']) {
    if (!existsSync(path.join(root, `android/app/src/main/jniLibs/${abi}/libpikafish.so`))) throw Error('Run npm run engine:prepare with NDK r28+ before Android build.');
}
run(process.execPath, ['scripts/prepare-book.mjs']);
run(process.execPath, ['scripts/verify-engine.mjs']);
run(process.execPath, ['../node_modules/electron/cli.js', 'tests/browser.cjs']);
run(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android']);
// Machine-local generated configuration is ignored by Git.
await writeFile(path.join(root, 'android/local.properties'), `sdk.dir=${sdk.replaceAll('\\', '/').replaceAll(':', '\\:')}\n`);
if (process.platform === 'win32') run('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat --no-daemon assembleDebug'], path.join(root, 'android'));
else run('./gradlew', ['--no-daemon', 'assembleDebug'], path.join(root, 'android'));
await mkdir(path.join(root, 'artifacts'), { recursive: true });
await copyFile(path.join(root, 'android/app/build/outputs/apk/debug/app-debug.apk'), path.join(root, 'artifacts/xiangqi-mobile-debug.apk'));
const bytes = (await stat(path.join(root, 'artifacts/xiangqi-mobile-debug.apk'))).size;
if (bytes > 75 * 1024 * 1024) throw Error('APK exceeds the separate 75 MiB native-engine/book budget.');
console.log(`APK: ${(bytes / 1024 / 1024).toFixed(1)} MiB / 75 MiB budget`);
console.log('Debug APK: mobile/artifacts/xiangqi-mobile-debug.apk');
