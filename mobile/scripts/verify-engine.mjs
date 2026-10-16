import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(await readFile(path.join(root, 'engine/pikafish.json'), 'utf8'));
const assets = path.join(root, 'android/app/src/main/assets/analysis');
const manifest = JSON.parse(await readFile(path.join(assets, 'engine.json'), 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
if (manifest.commit !== spec.commit || hash(await readFile(path.join(assets, 'pikafish.nnue'))) !== spec.nnueSha256) throw Error('Re-prepare the pinned native engine/NNUE.');
for (const [abi, machine] of [['arm64-v8a', 183], ['x86_64', 62]]) {
    const binary = await readFile(path.join(root, `android/app/src/main/jniLibs/${abi}/libpikafish.so`));
    if (hash(binary) !== manifest.binaries?.[abi]) throw Error(`Native binary provenance mismatch: ${abi}. Run engine:prepare.`);
    if (binary.readUInt32BE(0) !== 0x7f454c46 || binary[4] !== 2 || binary[5] !== 1 || binary.readUInt16LE(18) !== machine) throw Error(`Not the expected 64-bit Android ELF: ${abi}`);
    const offset = Number(binary.readBigUInt64LE(32)), size = binary.readUInt16LE(54), count = binary.readUInt16LE(56);
    let loads = 0, executable = false;
    for (let index = 0; index < count; index++) {
        const entry = offset + index * size, type = binary.readUInt32LE(entry);
        if (type === 3) executable = true; // PT_INTERP distinguishes the PIE from a regular JNI library.
        if (type === 1) {
            loads++;
            if (binary.readBigUInt64LE(entry + 48) < 16384n) throw Error(`Engine lacks 16 KiB ELF alignment: ${abi}`);
        }
    }
    if (!loads || !executable) throw Error(`Missing loadable PIE segments: ${abi}`);
}
for (const name of ['Pikafish-GPL.txt', 'NNUE-License.md', 'pikafish-source.tar', 'prepare-engine.mjs']) {
    if (!(await readFile(path.join(assets, name))).length) throw Error(`Missing engine source/license: ${name}`);
}
console.log('Native integrity: pinned checksums, both ABIs, PIE, 16 KiB ELF alignment, source/licenses.');
