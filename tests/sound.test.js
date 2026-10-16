import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSound, moveSound } from '../src/presentation/GameSound.js';
import { readFileSync } from 'node:fs';

test('Packaged sidestick retains PCM compatibility, duration and balanced non-clipping level', () => {
    const wav = readFileSync(new URL('../assets/sounds/sidestick.wav', import.meta.url));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    let format, data;
    // RIFF may contain metadata before data; do not assume a 44-byte header.
    for (let offset = 12; offset + 8 <= wav.length;) {
        const size = wav.readUInt32LE(offset + 4), start = offset + 8;
        assert.ok(start + size <= wav.length);
        const chunk = wav.toString('ascii', offset, offset + 4);
        if (chunk === 'fmt ') format = wav.subarray(start, start + size);
        if (chunk === 'data') data = wav.subarray(start, start + size);
        offset = start + size + (size % 2);
    }
    assert.ok(format && data);
    assert.equal(format.readUInt16LE(0), 1);
    assert.equal(format.readUInt16LE(2), 2);
    assert.equal(format.readUInt32LE(4), 48000);
    assert.equal(format.readUInt16LE(14), 16);
    assert.equal(data.length / (48000 * 2 * 2), 0.30);
    let peak = 0, sum = 0;
    for (let i = 0; i < data.length; i += 2) {
        const sample = data.readInt16LE(i) / 32768;
        peak = Math.max(peak, Math.abs(sample)); sum += sample * sample;
    }
    const meanDb = 10 * Math.log10(sum / (data.length / 2));
    assert.ok(peak > .79 && peak < .86, `Unsafe/quiet peak: ${peak}`);
    assert.ok(meanDb > -18 && meanDb < -14, `Unbalanced move clip: ${meanDb} dBFS`);
});

test('Feedback priority is check > capture > move; no history means no feedback', () => {
    assert.equal(moveSound({}), null);
    assert.equal(moveSound({ currentMoveIndex: -1, moveHistory: [{}] }), null);
    const state = { currentMoveIndex: 0, moveHistory: [{}] };
    assert.equal(moveSound(state), 'move');
    state.moveHistory[0].capturedPiece = { color: 'black' };
    assert.equal(moveSound(state), 'capture');
    state.isCheck = true;
    assert.equal(moveSound(state), 'check');
});

test('Player reuses clips, interrupts earlier clips, and muting stops active audio', async () => {
    const clips = [];
    const player = new GameSound('/sounds/', src => {
        const clip = { src, currentTime: 9, plays: 0, pauses: 0, async play() { this.plays++; },
            pause() { this.pauses++; }, removeAttribute() {}, load() {} };
        clips.push(clip); return clip;
    });
    assert.equal(await player.play('unknown'), false);
    assert.equal(await player.play('constructor'), false);
    assert.equal(await player.play('move'), true);
    assert.equal(clips[0].src, '/sounds/sidestick.wav');
    assert.equal(clips[0].currentTime, 0);
    await player.play('move');
    assert.equal(clips.length, 1);
    assert.equal(clips[0].plays, 2);
    await player.play('check');
    assert.equal(clips[0].pauses, 2);
    player.setEnabled(false);
    assert.equal(clips[1].pauses, 1);
    assert.equal(await player.play('capture'), false);
    assert.equal(clips.length, 2);
    player.setEnabled(true);
    assert.equal(await player.play('capture'), true);
    player.destroy();
});

test('Playback rejection or unavailable audio cannot reject a committed move', async () => {
    const player = new GameSound('/', () => ({ currentTime: 0, pause() {}, play: async () => { throw Error('blocked'); } }));
    assert.equal(await player.play('move'), false);
    assert.equal(await new GameSound('/', () => { throw Error('device'); }).play('move'), false);
});
