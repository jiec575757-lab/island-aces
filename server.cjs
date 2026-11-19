'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = __dirname, port = Number(process.env.PORT || 4192);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.vox': 'application/octet-stream', '.zip': 'application/zip' };
http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  let filename;
  try { filename = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end('Bad request'); }
  const target = path.resolve(root, '.' + (filename === '/' ? '/index.html' : filename));
  const rel = path.relative(root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel) || rel.split(path.sep).some(p => p.startsWith('.')) || !mime[path.extname(target)]) {
    res.writeHead(404); return res.end('Not found');
  }
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}).on('error', err => { console.error(err.message); process.exitCode = 1; })
  .listen(port, '127.0.0.1', () => console.log(`海岛飞行队：http://127.0.0.1:${port}/`));
