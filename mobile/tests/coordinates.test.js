import test from 'node:test';
import assert from 'node:assert/strict';
import { boardSquare, displaySquare } from '../src/ui/coordinates.js';

test('Every square round-trips after flipping; no square disappears or duplicates', () => {
    for (const flipped of [false, true]) {
        const points = new Set();
        for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
            const visible = displaySquare(x, y, flipped);
            points.add(`${visible.x},${visible.y}`);
            assert.deepEqual(boardSquare(visible.x, visible.y, flipped), { x, y });
        }
        assert.equal(points.size, 90);
    }
});
