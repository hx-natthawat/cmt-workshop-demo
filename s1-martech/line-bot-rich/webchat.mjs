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
:root{--bg:#f6f7f9;--surface:#fff;--surface-2:#fafbfc;--border:#e7e8ec;--text:#101828;--text-2:#475467;--muted:#98a2b3;
 --brand:#345589;--brand-2:#4a6ea5;--brand-soft:#eef2f8;--track:#eef0f3;--shadow:0 1px 2px rgba(16,24,40,.06);--good:#12805c}
:root[data-theme=dark]{--bg:#0f1115;--surface:#171a1f;--surface-2:#1c2027;--border:#282d35;--text:#f2f4f7;--text-2:#c3c8d0;--muted:#7d8590;
 --brand:#6b9bd8;--brand-2:#5b8dd6;--brand-soft:#1c2636;--track:#22262d;--shadow:none;--good:#3ddc97}
@media(prefers-color-scheme:dark){:root:where(:not([data-theme=light])){--bg:#0f1115;--surface:#171a1f;--surface-2:#1c2027;--border:#282d35;
 --text:#f2f4f7;--text-2:#c3c8d0;--muted:#7d8590;--brand:#6b9bd8;--brand-2:#5b8dd6;--brand-soft:#1c2636;--track:#22262d;--shadow:none;--good:#3ddc97}}
*{box-sizing:border-box;margin:0}
body{font-family:"IBM Plex Sans Thai","Noto Sans Thai",-apple-system,sans-serif;background:var(--bg);color:var(--text);
 display:flex;flex-direction:column;height:100dvh;line-height:1.6;font-size:15px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
header{background:var(--surface);border-bottom:1px solid var(--border);padding:12px clamp(12px,3vw,20px);display:flex;align-items:center;gap:12px;flex-shrink:0}
.ava{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,var(--brand-2),var(--brand));display:grid;place-items:center;flex-shrink:0}
.hd{flex:1;min-width:0}.hd .nm{font-weight:650;font-size:.95rem;line-height:1.3}
.hd .st{font-size:.74rem;color:var(--muted);display:flex;align-items:center;gap:5px}
.dot{width:7px;height:7px;border-radius:50%;background:var(--good);box-shadow:0 0 0 3px color-mix(in srgb,var(--good) 20%,transparent)}
.tbtn{background:var(--surface-2);border:1px solid var(--border);color:var(--text-2);border-radius:9px;padding:7px 9px;cursor:pointer;display:grid;place-items:center}
.tbtn:hover{border-color:var(--brand);color:var(--brand)}
#log{flex:1;overflow-y:auto;padding:clamp(12px,3vw,20px);display:flex;flex-direction:column;gap:14px;scroll-behavior:smooth}
.wrap-msg{display:flex;flex-direction:column;max-width:min(78%,560px);animation:in .25s cubic-bezier(.2,.8,.2,1)}
.wrap-msg.me{align-self:flex-end;align-items:flex-end}.wrap-msg.bot{align-self:flex-start}
@keyframes in{from{opacity:0;transform:translateY(6px)}}
.msg{padding:11px 15px;border-radius:16px;font-size:.92rem;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.me .msg{background:var(--brand);color:#fff;border-bottom-right-radius:5px}
.bot .msg{background:var(--surface);border:1px solid var(--border);border-bottom-left-radius:5px;box-shadow:var(--shadow)}
.meta{font-size:.68rem;color:var(--muted);margin-top:5px;padding:0 5px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.tool-chip{background:var(--brand-soft);color:var(--brand);border-radius:5px;padding:1px 7px;font-size:.66rem;font-weight:500}
.welcome{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;text-align:center;box-shadow:var(--shadow)}
.welcome h2{font-size:1rem;font-weight:650;margin-bottom:4px}.welcome p{font-size:.85rem;color:var(--text-2);margin-bottom:14px}
.sugg{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.chip{background:var(--surface-2);border:1px solid var(--border);color:var(--text-2);border-radius:20px;padding:7px 14px;font-size:.82rem;cursor:pointer;font-family:inherit;transition:.15s}
.chip:hover{border-color:var(--brand);color:var(--brand);background:var(--brand-soft)}
.typing{display:flex;gap:4px;padding:14px 16px;align-items:center}
.typing span{width:7px;height:7px;border-radius:50%;background:var(--muted);animation:bounce 1.2s infinite}
.typing span:nth-child(2){animation-delay:.15s}.typing span:nth-child(3){animation-delay:.3s}
@keyframes bounce{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}
form{display:flex;gap:9px;padding:clamp(10px,2vw,14px);background:var(--surface);border-top:1px solid var(--border);flex-shrink:0}
input{flex:1;padding:12px 16px;border:1px solid var(--border);border-radius:24px;font-size:.93rem;font-family:inherit;background:var(--surface-2);color:var(--text);outline:none;transition:.15s}
input:focus{border-color:var(--brand);background:var(--surface);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 12%,transparent)}
.send{background:var(--brand);color:#fff;border:none;border-radius:50%;width:44px;height:44px;cursor:pointer;display:grid;place-items:center;flex-shrink:0;transition:.15s}
.send:hover:not(:disabled){background:var(--brand-2);transform:scale(1.05)}.send:disabled{opacity:.45;cursor:not-allowed}
</style></head><body>
<header>
 <div class="ava"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg></div>
 <div class="hd"><div class="nm">Glow Beauty</div><div class="st"><span class="dot"></span>ออนไลน์ · ตอบด้วย MCP tools ชุดเดียวกับ LINE</div></div>
 <button class="tbtn" onclick="var r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'light':'dark'" title="สลับธีม"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg></button>
</header>
<div id="log"></div>
<form id="f" autocomplete="off">
 <input id="t" placeholder="พิมพ์ข้อความ…" autocomplete="off">
 <button class="send" id="sb" aria-label="ส่ง"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg></button>
</form>
<script>
var log=document.getElementById('log'),t=document.getElementById('t'),sb=document.getElementById('sb');
var SUGG=['ผิวมันใช้ตัวไหนดี','มีโปรอะไรบ้าง','ORD-1001 ถึงไหนแล้ว','ตัวไหนขายดี'];
function now(){var d=new Date();return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');}
function scroll(){log.scrollTop=log.scrollHeight;}
function add(text,cls,tools){
 var w=document.createElement('div');w.className='wrap-msg '+cls;
 var m=document.createElement('div');m.className='msg';m.textContent=text;w.appendChild(m);
 var meta=document.createElement('div');meta.className='meta';
 var ts=document.createElement('span');ts.textContent=now();meta.appendChild(ts);
 if(tools&&tools.length)tools.forEach(function(tl){var c=document.createElement('span');c.className='tool-chip';c.textContent=tl;meta.appendChild(c);});
 w.appendChild(meta);log.appendChild(w);scroll();return w;
}
function welcome(){
 var w=document.createElement('div');w.className='welcome';
 var h=document.createElement('h2');h.textContent='สวัสดีค่ะ 👋';
 var p=document.createElement('p');p.textContent='ถามเรื่องสินค้า โปรโมชัน สถานะออเดอร์ หรือสั่งซื้อได้เลยค่ะ';
 var s=document.createElement('div');s.className='sugg';
 SUGG.forEach(function(q){var b=document.createElement('button');b.type='button';b.className='chip';b.textContent=q;
  b.onclick=function(){w.remove();send(q);};s.appendChild(b);});
 w.appendChild(h);w.appendChild(p);w.appendChild(s);log.appendChild(w);
}
function typing(){
 var w=document.createElement('div');w.className='wrap-msg bot';
 var m=document.createElement('div');m.className='msg typing';
 m.innerHTML='<span></span><span></span><span></span>';
 w.appendChild(m);log.appendChild(w);scroll();return w;
}
async function send(q){
 add(q,'me');t.value='';sb.disabled=true;
 var wait=typing();
 try{
  var r=await fetch('/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:q})});
  var d=await r.json();wait.remove();add(d.text,'bot',d.tools);
 }catch(err){wait.remove();add('เชื่อมต่อไม่ได้: '+err.message+' — เช็คว่า server ยังรันอยู่',' bot');}
 finally{sb.disabled=false;t.focus();}
}
document.getElementById('f').onsubmit=function(e){e.preventDefault();var q=t.value.trim();if(q)send(q);};
welcome();t.focus();
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
