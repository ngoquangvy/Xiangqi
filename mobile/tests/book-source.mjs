import { readFileSync } from 'node:fs';
import { bookKey } from '../src/analysis/settings.js';

// Integration tests follow the same pinned book selection as Android builds.
export function readBookSource() {
    const specURL = new URL('../engine/pikafish.json', import.meta.url);
    const spec = JSON.parse(readFileSync(specURL, 'utf8'));
    return JSON.parse(readFileSync(new URL(spec.book, specURL), 'utf8'));
}

export function sourceRowsFor(book, fen) {
    const key = bookKey(fen);
    return Object.entries(book.positions).filter(([source]) => bookKey(source) === key).flatMap(([, rows]) => rows);
}
