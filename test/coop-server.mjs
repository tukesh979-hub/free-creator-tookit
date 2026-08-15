// Minimal static file server that sets the Cross-Origin-Opener-Policy /
// Cross-Origin-Embedder-Policy headers required for SharedArrayBuffer
// (and therefore the app's FFmpeg-based tools) to be available at all.
//
// Usage: node test/coop-server.mjs [port]   (default port 8935)
//
// NOTE: even with these headers, FFmpeg.wasm loaded from the jsdelivr CDN
// currently fails in every browser with a Worker cross-origin
// SecurityError — a pre-existing limitation of how Nexus Creator.html
// loads @ffmpeg/ffmpeg, documented in test/README.md. This server exists
// so the *rest* of the app (which does need SharedArrayBuffer available
// to correctly report its own status) behaves the same way it will once
// deployed behind a host that sets these headers.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.argv[2]) || 8935;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.m4a': 'audio/mp4',
  '.wav': 'audio/wav', '.webm': 'video/webm',
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/Nexus Creator.html';
  const filePath = path.join(ROOT, reqPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + reqPath); return; }
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`COOP/COEP test server on http://localhost:${PORT}`));
