import { readFile } from 'node:fs/promises';
import { legalLine } from '../src/analysis/results.js';
import { PREVIEW_LINE_LIMIT } from '../src/domain/lineLimits.js';
import path from 'node:path';

// Read-only audit against the current core. Never repairs or overwrites a book.
const specURL = new URL('../engine/pikafish.json', import.meta.url);
const spec = JSON.parse(await readFile(specURL, 'utf8'));
const input = process.argv[2] ? path.resolve(process.argv[2]) : new URL(spec.book, specURL);
const book = JSON.parse(await readFile(input, 'utf8'));
const report = { version: book.meta?.version, positions: Object.keys(book.positions).length, rows: 0, lines: 0, invalidFirst: 0,
    invalidTails: 0, overSafetyLimit: 0, examples: [] };
for (const [fen, candidates] of Object.entries(book.positions)) {
    for (const row of candidates) {
        report.rows++;
        for (const pv of [row.pv, ...(row.variations || []).map(variation => variation.pv)]) {
            report.lines++;
            if (pv.length > PREVIEW_LINE_LIMIT) report.overSafetyLimit++;
            const line = pv[0] === row.move ? legalLine(fen, pv, PREVIEW_LINE_LIMIT) : null;
            if (!line) report.invalidFirst++;
            else if (line.pv.length < Math.min(pv.length, PREVIEW_LINE_LIMIT)) {
                report.invalidTails++;
                if (report.examples.length < 5) report.examples.push({ fen, move: row.move, note: row.note,
                    sourcePlies: pv.length, legalPlies: line.pv.length, firstRejected: pv[line.pv.length] });
            }
        }
    }
}
console.log(JSON.stringify(report, null, 2));
