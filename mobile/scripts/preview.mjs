import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'],
    '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/app.css': ['app.css', 'text/css; charset=utf-8'] };
for (const name of ['capture', 'check']) files[`/sounds/${name}.mp3`] = [`sounds/${name}.mp3`, 'audio/mpeg'];
files['/sounds/sidestick.wav'] = ['sounds/sidestick.wav', 'audio/wav'];
files['/fonts/xiangqi-kai.ttf'] = ['fonts/xiangqi-kai.ttf', 'font/ttf'];
files['/fonts/WenKai-OFL.txt'] = ['fonts/WenKai-OFL.txt', 'text/plain; charset=utf-8'];
http.createServer(async (req, res) => {
    const file = files[new URL(req.url, 'http://localhost').pathname];
    if (!file) { res.writeHead(404); res.end(); return; }
    try { res.setHeader('Content-Type', file[1]); res.end(await readFile(path.join(root, file[0]))); }
    catch { res.writeHead(503); res.end('Run npm run build first'); }
}).listen(4173, '127.0.0.1', () => console.log('Preview only: http://127.0.0.1:4173 (no backend)'));
