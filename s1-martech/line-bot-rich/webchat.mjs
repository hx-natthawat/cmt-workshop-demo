/**
 * webchat.mjs — Web Chat Widget: แชทบนหน้าเว็บ ใช้ agent.js "ชุดเดียวกับ LINE"
 * พิสูจน์ omnichannel: MCP tools + Claude loop เดิม เปลี่ยนแค่ช่องทาง (LINE → Web)
 *
 * รัน:  node webchat.mjs   แล้วเปิด http://localhost:3200
 */
import 'dotenv/config';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const agent = require('./agent.js');
const store = require('./store.js');

const PAGE = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Glow Beauty — Web Chat</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet"><style>
body{font-family:"IBM Plex Sans Thai","Noto Sans Thai",-apple-system,sans-serif;background:#f4f5f7;margin:0;display:flex;flex-direction:column;height:100vh;line-height:1.6;-webkit-font-smoothing:antialiased}
header{background:#345589;color:#fff;padding:14px 18px;font-weight:700}
#log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.msg{max-width:80%;padding:10px 14px;border-radius:14px;font-size:.92rem;line-height:1.5;white-space:pre-wrap}
.me{align-self:flex-end;background:#345589;color:#fff;border-bottom-right-radius:4px}
.bot{align-self:flex-start;background:#fff;border:1px solid #e5e7eb;border-bottom-left-radius:4px}
.tool{font-size:.68rem;color:#9ca3af;margin-top:4px}
form{display:flex;gap:8px;padding:12px;background:#fff;border-top:1px solid #e5e7eb}
input{flex:1;padding:11px;border:1px solid #d1d5db;border-radius:22px;font-size:.95rem}
button{background:#345589;color:#fff;border:none;border-radius:22px;padding:0 20px;font-weight:600;cursor:pointer}</style></head><body>
<header style="display:flex;align-items:center;gap:9px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg> Glow Beauty — Web Chat <span style="font-weight:400;font-size:.8rem;opacity:.8">(MCP tools ชุดเดียวกับ LINE)</span></header>
<div id="log"></div>
<form id="f"><input id="t" placeholder="พิมพ์ข้อความ เช่น ผิวมันใช้ตัวไหนดี" autocomplete="off"><button>ส่ง</button></form>
<script>
const log=document.getElementById('log'),t=document.getElementById('t');
function add(text,cls,tools){const d=document.createElement('div');d.className='msg '+cls;d.textContent=text;
 if(tools&&tools.length){const s=document.createElement('div');s.className='tool';s.textContent='🔧 '+tools.join(', ');d.appendChild(s);}
 log.appendChild(d);log.scrollTop=log.scrollHeight;}
add('สวัสดีค่ะ 😊 มีอะไรให้ช่วยไหมคะ? ลองถามเรื่องสินค้า โปรโมชัน หรือสั่งซื้อได้เลยค่ะ','bot');
document.getElementById('f').onsubmit=async e=>{e.preventDefault();const q=t.value.trim();if(!q)return;
 add(q,'me');t.value='';const wait=document.createElement('div');wait.className='msg bot';wait.textContent='…';log.appendChild(wait);
 try{const r=await fetch('/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:q})});
  const d=await r.json();wait.remove();add(d.text,'bot',d.tools);}
 catch(err){wait.remove();add('❌ เชื่อมต่อไม่ได้: '+err.message,'bot');}};
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
  if (req.url === '/chat' && req.method === 'POST') {
    let body = ''; for await (const c of req) body += c;
    let text; try { text = JSON.parse(body).text; } catch {}
    res.writeHead(200, { 'content-type': 'application/json' });
    if (!text) return res.end(JSON.stringify({ text: 'พิมพ์ข้อความก่อนนะคะ', tools: [] }));
    try {
      const out = await agent.runAgent(text);
      store.logVoc({ userId: 'web-' + (req.headers['x-forwarded-for'] || 'anon'), channel: 'web', text, tools: out.toolCalls.map((c) => c.name) });
      return res.end(JSON.stringify({ text: out.text, tools: [...new Set(out.toolCalls.map((c) => c.name))] }));
    } catch (e) { return res.end(JSON.stringify({ text: 'ขออภัยค่ะ ระบบขัดข้อง: ' + e.message, tools: [] })); }
  }
  res.writeHead(404); res.end('Not found');
});

await agent.connectMcp();
server.listen(3200, () => console.log('🌐 Web Chat: http://localhost:3200 (MCP tools ชุดเดียวกับ LINE)'));
