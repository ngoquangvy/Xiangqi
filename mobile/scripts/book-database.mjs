import { bookKey } from '../src/analysis/settings.js';

// Preserve source rows, including collisions after removing FEN counters.
// Legality/ordering belongs to the core-backed runtime result adapter.
export function indexBook(db, book) {
    if (!book?.positions || typeof book.positions !== 'object') throw Error('Web book has no positions map.');
    db.exec('CREATE TABLE positions (fen TEXT PRIMARY KEY, candidates TEXT NOT NULL); BEGIN');
    try {
        const select = db.prepare('SELECT candidates FROM positions WHERE fen = ?');
        const insert = db.prepare('INSERT OR REPLACE INTO positions VALUES (?, ?)');
        let rows = 0;
        for (const [fen, value] of Object.entries(book.positions)) {
            const key = bookKey(fen);
            if (!key || !value || typeof value !== 'object') throw Error('Book contains a malformed entry.');
            const candidates = Array.isArray(value) ? value : Object.entries(value).map(([move, data]) => ({ ...data, move }));
            const previous = select.get(key);
            const json = JSON.stringify([...(previous ? JSON.parse(previous.candidates) : []), ...candidates]);
            // Android CursorWindow must fit one lookup. The APK compressor can
            // deduplicate repeated PV text across positions better than gzip per row.
            if (Buffer.byteLength(json) > 1024 * 1024) throw Error('Book position exceeds the 1 MiB lookup budget.');
            insert.run(key, json);
            rows += candidates.length;
        }
        db.exec('COMMIT; VACUUM');
        return { positions: db.prepare('SELECT COUNT(*) AS n FROM positions').get().n, rows };
    } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}
