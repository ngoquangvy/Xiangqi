import test from 'node:test';
import assert from 'node:assert/strict';
import { readNativeSession } from '../src/storage/readNativeSession.js';

test('Lost native read reply retries once, without turning failure into an empty game', async () => {
    let calls = 0, first;
    const value = await readNativeSession(() => ++calls === 1 ? new Promise(resolve => { first = resolve; }) : { value: 'saved game' }, 5);
    assert.equal(calls, 2); assert.equal(value, 'saved game');
    first({ value: 'late reply' }); // A late first read cannot replace the successful second read.
    await assert.rejects(readNativeSession(() => new Promise(() => {}), 5), /timed out/);
});
test('Empty native storage is legitimate, but malformed replies and rejected reads are not', async () => {
    assert.equal(await readNativeSession(async () => ({ value: null })), null);
    await assert.rejects(readNativeSession(async () => ({}), 5), /Invalid native/);
    let calls = 0;
    await assert.rejects(readNativeSession(async () => { calls++; throw Error('read failed'); }, 5), /read failed/);
    assert.equal(calls, 2);
});
