import XiangqiGame from '../../../src/core/XiangqiGame.js';
import { parseUCI } from '../../../src/core/XiangqiPV.js';
import { ENGINE_LINE_LIMIT, ENGINE_VARIATION_COUNT, PREVIEW_LINE_LIMIT } from '../domain/lineLimits.js';

export function parseInfo(line) {
    if (typeof line !== 'string' || line.length > 8192 || !line.startsWith('info ')) return null;
    const depth = /\bdepth (\d+)\b/.exec(line), score = /\bscore (cp|mate) (-?\d+)\b/.exec(line);
    const pv = /\bpv ((?:[a-i]\d[a-i]\d)(?: [a-i]\d[a-i]\d)*)\s*$/.exec(line);
    const rank = Number(/\bmultipv (\d+)\b/.exec(line)?.[1] || 1);
    if (!depth || !score || !pv || rank < 1 || rank > ENGINE_VARIATION_COUNT) return null;
    const value = Number(score[2]);
    if (!Number.isSafeInteger(value) || Number(depth[1]) > 256) return null;
    return { rank, depth: Number(depth[1]), kind: score[1], value,
        bound: /\b(lowerbound|upperbound)\b/.exec(line)?.[1] || null, pv: pv[1].split(' ').slice(0, ENGINE_LINE_LIMIT) };
}

// Scratch games validate external suggestions, never mutate the live LocalGame.
export function legalLine(fen, pv, limit = ENGINE_LINE_LIMIT) {
    const scratch = new XiangqiGame();
    if (!Array.isArray(pv) || !scratch.importFen(fen)) return null;
    const moves = [], notation = [];
    for (const uci of pv.slice(0, limit)) {
        const coordinates = parseUCI(uci);
        if (!coordinates) break;
        if (!scratch.move(...coordinates)) break;
        // The core already stores notation at commit time. Reuse that result
        // rather than replaying each prefix in yet another temporary game.
        moves.push(uci); notation.push(scratch.moveHistory.at(-1).moveNotation);
    }
    return moves.length ? { move: moves[0], pv: moves, notation } : null;
}

export function engineRow(fen, info) {
    const line = legalLine(fen, info.pv);
    if (!line) return null;
    // All displayed scores use Red's perspective, regardless of board flipping.
    const sign = fen.split(' ')[1] === 'b' ? -1 : 1;
    const bound = sign < 0 ? ({ lowerbound: 'upperbound', upperbound: 'lowerbound' }[info.bound] || null) : info.bound;
    return { ...info, ...line, value: sign * info.value, bound, source: 'engine' };
}

export function bookRows(fen, candidates) {
    const unique = new Map();
    for (const candidate of Array.isArray(candidates) ? candidates.slice(0, 100) : []) {
        if (!candidate || !parseUCI(candidate.move)) continue;
        const line = legalLine(fen, [candidate.move, ...(Array.isArray(candidate.pv) && candidate.pv[0] === candidate.move ? candidate.pv.slice(1, PREVIEW_LINE_LIMIT) : [])], PREVIEW_LINE_LIMIT);
        if (!line) continue;
        const weight = Number.isFinite(candidate.score) && candidate.score >= 0 && candidate.score <= 1 ? candidate.score : null;
        const row = { ...line, source: 'book', weight, note: typeof candidate.note === 'string' ? candidate.note.slice(0, 300) : '' };
        // Different continuations of the same first move are different suggestions.
        // Counter-normalized duplicate records can still collapse by full legal PV.
        const key = row.pv.join(' ');
        if (!unique.has(key) || (weight ?? -1) > (unique.get(key).weight ?? -1)) unique.set(key, row);
    }
    return [...unique.values()].sort((a, b) => (b.weight ?? -1) - (a.weight ?? -1));
}
