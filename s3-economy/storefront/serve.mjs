/**
 * serve.mjs — เสิร์ฟ storefront ตัวอย่างเป็นเว็บจริง (เพื่อให้ /llms.txt และ /.well-known/ ใช้ได้)
 * รัน:  node serve.mjs   →  http://localhost:8090
 * แล้วลอง:  node audit-gates.mjs http://localhost:8090
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' };

http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel === '/') rel = '/index.html';
  // กัน path traversal: resolve แล้วต้องยังอยู่ใต้ ROOT
  const file = path.resolve(ROOT, '.' + rel);
  if (!file.startsWith(path.resolve(ROOT))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('ไม่พบไฟล์: ' + rel); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(8090, () => console.log('🏪 Agent-Ready Storefront: http://localhost:8090\n   ตรวจ 4 ประตู: node audit-gates.mjs http://localhost:8090'));
