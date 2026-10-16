import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { mkdir, readFile, copyFile, readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Guardrails apply only to handwritten mobile code, not generated Android sources.
async function checkSource(directory, extensions = null) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) await checkSource(filename, extensions);
        else if (!extensions || extensions.has(path.extname(filename))) {
            const source = await readFile(filename, 'utf8');
            if (source.split('\n').length > 260 || Buffer.byteLength(source) > 18 * 1024) throw Error(`Split oversized module: ${filename}`);
            if (/\uFFFD|Ã[\u0080-\u00bf]|â€|ï¿½/.test(source)) throw Error(`Possible encoding corruption: ${filename}`);
        }
    }
}
await checkSource(path.join(root, 'src'));
await checkSource(path.join(root, '../src/presentation'));
const nativeSource = path.join(root, 'android/app/src/main/java');
if (existsSync(nativeSource)) await checkSource(nativeSource);
await checkSource(path.join(root, 'native'));
await checkSource(path.join(root, 'ios/App/App'), new Set(['.swift', '.h', '.mm']));
await mkdir(path.join(root, 'dist'), { recursive: true });
// Remove only known obsolete generated assets, never source/user files.
for (const name of ['fonts/xiangqi-symbols.otf', 'fonts/OFL.txt', 'sounds/README.md', 'sounds/putpiece.mp3']) {
    await rm(path.join(root, 'dist', name), { force: true });
}
const result = await build({ entryPoints: [path.join(root, 'src/main.js')], bundle: true,
    outfile: path.join(root, 'dist/app.js'), format: 'esm', platform: 'browser', target: 'es2020',
    minify: true, metafile: true, legalComments: 'none', loader: { '.ttf': 'file' }, assetNames: 'fonts/[name]' });
if (Object.keys(result.metafile.inputs).some(name => /src[\\/]main[\\/]|server[\\/]|src[\\/]services[\\/]/.test(name))) {
    throw Error('Mobile bundle imported a desktop/server transport');
}
await copyFile(path.join(root, 'index.html'), path.join(root, 'dist/index.html'));
await mkdir(path.join(root, 'dist/sounds'), { recursive: true });
for (const name of ['sidestick.wav', 'capture.mp3', 'check.mp3']) {
    await copyFile(path.join(root, '../assets/sounds', name), path.join(root, 'dist/sounds', name));
}
await copyFile(path.join(root, '../assets/fonts/WenKai-OFL.txt'), path.join(root, 'dist/fonts/WenKai-OFL.txt'));
// Media has its own budget; source/app-code limits must not hide asset growth.
let mediaBytes = 0;
for (const folder of ['sounds', 'fonts']) for (const filename of await readdir(path.join(root, 'dist', folder))) {
    mediaBytes += (await stat(path.join(root, 'dist', folder, filename))).size;
}
if (mediaBytes > 256 * 1024) throw Error(`Media exceeds the 256 KiB budget: ${mediaBytes}`);
let bytes = 0;
for (const filename of ['app.js', 'app.css', 'index.html']) bytes += (await stat(path.join(root, 'dist', filename))).size;
if (bytes > 160 * 1024) throw Error(`Web assets exceed the 160 KiB prototype budget: ${bytes}`);
console.log(`Mobile assets: ${(bytes / 1024).toFixed(1)} KiB / 160 KiB budget`);
console.log(`Media assets: ${(mediaBytes / 1024).toFixed(1)} KiB / 256 KiB budget`);
