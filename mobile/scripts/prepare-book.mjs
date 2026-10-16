import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFILES } from '../src/analysis/settings.js';
import { indexBook } from './book-database.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(await readFile(path.join(root, 'engine/pikafish.json'), 'utf8'));
const raw = await readFile(path.resolve(root, 'engine', spec.book));
const book = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw).replace(/^\uFEFF/, ''));
if (!book.positions || typeof book.positions !== 'object') throw Error('Web book has no positions map.');
const platform = process.argv[2] || 'android';
if (!['android', 'ios'].includes(platform)) throw Error('Expected android or ios.');
const assets = path.join(root, platform === 'ios' ? 'ios/App/App/analysis' : 'android/app/src/main/assets/analysis');
await mkdir(assets, { recursive: true });
const filename = path.join(assets, 'book.sqlite');
// Only replace the generated database at this fixed build-output path.
await rm(filename, { force: true });
const db = new DatabaseSync(filename);
try {
    const counts = indexBook(db, book);
    console.log(`Bundled web book: ${Object.keys(book.positions).length} source positions; ${counts.positions} indexed positions; ${counts.rows} source rows preserved`);
} finally { db.close(); }
const database = await readFile(filename);
if (database.length > 64 * 1024 * 1024) throw Error('Bundled book exceeds its separate 64 MiB installed-data budget.');
console.log(`Indexed book: ${(database.length / 1024 / 1024).toFixed(1)} MiB / 64 MiB installed-data budget`);
await writeFile(path.join(assets, 'bundle.json'), JSON.stringify({ profiles: PROFILES, nnueSha256: spec.nnueSha256,
    bookSha256: createHash('sha256').update(database).digest('hex'),
    bookSourceSha256: createHash('sha256').update(raw).digest('hex'), bookFormat: 'sqlite-json-v1', bookMeta: book.meta }, null, 2));
