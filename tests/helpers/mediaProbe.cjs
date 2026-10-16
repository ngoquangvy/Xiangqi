// Runs before application scripts; real browser decoding/playback, muted only
// to keep automated test runs quiet. Production code has no test globals.
function mediaProbeSource(muted = true) {
    return `
        window.__media = [];
        const NativeAudio = window.Audio;
        window.Audio = function(src) {
            const audio = new NativeAudio(src);
            audio.muted = ${muted};
            const record = { src, calls: 0, playing: 0, errors: 0 };
            window.__media.push(record);
            const play = audio.play.bind(audio);
            audio.play = () => { record.calls++; return play(); };
            audio.addEventListener('playing', () => record.playing++);
            audio.addEventListener('error', () => record.errors++);
            return audio;
        };
    `;
}
async function instrumentMedia(win) {
    // Establish a renderer target before sending CDP commands. On a new,
    // unnavigated WebContents, Page.enable can otherwise wait indefinitely.
    await win.loadURL('about:blank');
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Page.enable');
    await win.webContents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: mediaProbeSource() });
}
module.exports = { instrumentMedia, mediaProbeSource };
