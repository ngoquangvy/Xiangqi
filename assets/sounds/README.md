# Game feedback clips

User-supplied source files: `capture.mp3`, `check.mp3`, `sidestick.wav`.
No sound is fetched from the internet at runtime. These are shared by Electron,
the web build and the mobile build; do not keep separate edited mobile copies.
Confirm redistribution rights for the supplied recordings before public release.

`capture.mp3` and `check.mp3` are unmodified copies. The move clip is now
`sidestick.wav`, created by the user in FL Studio. The 48 kHz stereo float32
source was converted to standard PCM16 stereo, preserving sample rate.
The sound decays below -60 dBFS around 0.199 seconds; a 0.30-second cut retains
the attack/decay plus a quiet margin, without the remaining 1.55 seconds of silence.
Loudness follow-up: +16 dB gain before a linked stereo limiter (-1.5 dBFS
ceiling, 0.5 ms lookahead, 5 ms release), processing at 192 kHz before returning
to 48 kHz. This raises the short clip's measured mean from -26.8 to -16.2 dBFS
(about +10.6 dB effective), with sample peak -1.49 dBFS. Reference means are
-13.7 dBFS (capture) and -17.1 dBFS (check). These are RMS comparisons, not a
guarantee of identical perceived loudness between different sound timbres.
Limiter latency compensation retains the initial hit and the 0.30-second length.
The original Downloads file is untouched. The old boosted putpiece is no longer
used or packaged; its gain adjustment does not apply to this new recording.

Recreate from the original:

```powershell
ffmpeg -nostdin -y -i "SOURCE/sidestick.wav" -t 0.30 -af "aresample=192000,volume=16dB,alimiter=limit=0.841395:attack=0.5:release=5:level=false:latency=true,aresample=48000" -c:a pcm_s16le -map_metadata -1 assets/sounds/sidestick.wav
```

Playback ownership: `src/presentation/GameSound.js`; priority is check > capture
> ordinary move. Only a committed move requests sound. Navigation, restore,
preview, failed/illegal moves and preferences do not. Muting immediately stops
the active clip, and a new move interrupts the previous clip. Playback failures
do not affect game state and are not queued for delayed replay.
