import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { indexBook } from '../scripts/book-database.mjs';
import { bookKey } from '../src/analysis/settings.js';

test('The entire bundled web book preserves all rows and UTF-8 notes after indexing', async () => {
    const specURL = new URL('../engine/pikafish.json', import.meta.url);
    const spec = JSON.parse(await readFile(specURL, 'utf8'));
    const book = JSON.parse(await readFile(new URL(spec.book, specURL), 'utf8'));
    const expected = new Map();
    for (const [fen, value] of Object.entries(book.positions)) {
        const key = bookKey(fen), rows = Array.isArray(value) ? value : Object.entries(value).map(([move, data]) => ({ ...data, move }));
        expected.set(key, [...(expected.get(key) || []), ...rows]);
    }
    const db = new DatabaseSync(':memory:');
    try {
        const result = indexBook(db, book);
        assert.equal(result.positions, expected.size);
        assert.equal(result.rows, [...expected.values()].reduce((sum, rows) => sum + rows.length, 0));
        for (const { fen, candidates } of db.prepare('SELECT * FROM positions').all()) assert.deepEqual(JSON.parse(candidates), expected.get(fen));
    } finally { db.close(); }
});

test('Counter collisions merge instead of discarding a source line; object-shaped books work too', () => {
    const db = new DatabaseSync(':memory:');
    try {
        assert.deepEqual(indexBook(db, { positions: { 'board w - - 0 1': [{ move: 'h2e2', note: '\u0110\u1ecf' }],
            'board w - - 1 20': { b2e2: { score: .8 } }, 'board b - - 0 1': [{ move: 'h9g7' }] } }), { positions: 2, rows: 3 });
        assert.deepEqual(JSON.parse(db.prepare('SELECT candidates FROM positions WHERE fen=?').get('board w').candidates),
            [{ move: 'h2e2', note: '\u0110\u1ecf' }, { score: .8, move: 'b2e2' }]);
    } finally { db.close(); }
});
