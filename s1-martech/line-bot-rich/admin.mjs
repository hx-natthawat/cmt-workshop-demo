/**
 * admin.mjs — Operator Console (หน้าเว็บ) สำหรับ broadcast โปรโมชัน
 * แยกจาก bot สาธารณะ — รันบน localhost:3100 เท่านั้น (ไม่เปิดผ่าน tunnel)
 *
 * รัน:  node admin.mjs   แล้วเปิด http://localhost:3100
 *
 * ⚠️ GOVERNANCE: หน้านี้มีขั้นยืนยัน (ติ๊ก "เข้าใจว่าจะส่งถึงทุกคน" + พิมพ์ SEND) ก่อนปุ่มทำงาน
 *    ส่ง broadcast = กลับไม่ได้ + กินโควตา — human-in-the-loop เห็นเป็น UI
 */
import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { messagingApi } from '@line/bot-sdk';

const flex = createRequire(import.meta.url)('./flex.js');
const products = JSON.parse(fs.readFileSync(new URL('../../s2-mcp/showcase/products.json', import.meta.url), 'utf-8'));
const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) { console.error('❌ ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env'); process.exit(1); }
const api = new messagingApi.MessagingApiClient({ channelAccessToken: token });

const INTRO = '🌧️ Glow Beauty มีโปรพิเศษมาฝากค่ะ! เลื่อนดูข้อเสนอด้านล่างได้เลย 👇';
const buildMessages = () => [{ type: 'text', text: INTRO }, flex.promotionCarousel()];

const PAGE = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Broadcast Console — Glow Beauty</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
 :root{--bg:#f6f7f9;--surface:#fff;--surface-2:#fafbfc;--border:#e7e8ec;--text:#101828;--text-2:#475467;--muted:#98a2b3;
  --brand:#345589;--brand-2:#4a6ea5;--brand-soft:#eef2f8;--warn:#b42318;--warn-soft:#fef3f2;--good:#12805c;--shadow:0 1px 3px rgba(16,24,40,.06)}
 @media(prefers-color-scheme:dark){:root{--bg:#0f1115;--surface:#171a1f;--surface-2:#1c2027;--border:#282d35;--text:#f2f4f7;--text-2:#c3c8d0;
  --muted:#7d8590;--brand:#6b9bd8;--brand-2:#5b8dd6;--brand-soft:#1c2636;--warn:#f97066;--warn-soft:#2a1614;--good:#3ddc97;--shadow:none}}
 *{box-sizing:border-box;margin:0}
 body{font-family:"IBM Plex Sans Thai","Noto Sans Thai",-apple-system,sans-serif;background:var(--bg);color:var(--text);max-width:640px;margin:0 auto;padding:clamp(16px,4vw,28px);line-height:1.6;font-size:15px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
 h1{font-size:1.25rem;font-weight:700;display:flex;align-items:center;gap:9px;letter-spacing:-.01em}h1 svg{color:var(--brand)}
 .sub{color:var(--text-2);font-size:.85rem;margin:2px 0 20px}
 .card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:12px;box-shadow:var(--shadow)}
 .quota{font-size:.88rem;color:var(--text-2)}.quota b{color:var(--text)}
 .promo{border-left:3px solid var(--brand);padding:2px 0 2px 12px;margin:10px 0;font-size:.88rem}
 .promo b{color:var(--brand)} .intro{background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:11px;font-size:.88rem}
 label{display:flex;gap:9px;align-items:center;font-size:.88rem;margin:11px 0;cursor:pointer}
 input[type=text]{padding:9px 11px;border:1px solid var(--border);border-radius:8px;width:150px;font-family:inherit;font-size:.9rem;background:var(--surface);color:var(--text)}
 input[type=text]:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 12%,transparent)}
 button{background:var(--warn);color:#fff;border:none;border-radius:9px;padding:11px 20px;font-size:.92rem;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:8px}
 button:hover:not(:disabled){filter:brightness(1.08)}
 button:disabled{background:var(--muted);cursor:not-allowed;opacity:.6}
 .warn{background:var(--warn-soft);border:1px solid color-mix(in srgb,var(--warn) 30%,transparent);color:var(--warn);border-radius:10px;padding:11px 13px;font-size:.83rem;margin:12px 0}
 #result{margin-top:14px;font-weight:600;font-size:.88rem}
 .hint{font-size:.76rem;color:var(--muted);margin-top:14px;padding-top:12px;border-top:1px solid var(--border)}
</style></head><body>
<h1><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg> Broadcast Console</h1>
<p class="sub">ส่งโปรโมชันถึงผู้ติดตาม LINE ทุกคน · Glow Beauty Thailand</p>
<div class="card"><div class="quota" id="quota">กำลังโหลดโควตา…</div></div>
<div class="card"><b>ตัวอย่างข้อความที่จะส่ง</b>
 <div class="intro" id="intro"></div>
 <div id="promos"></div></div>
<div class="warn">⚠️ การส่งนี้ <b>กลับไม่ได้</b> และ <b>กินโควตา</b> — ผู้ติดตามทุกคนจะได้รับ</div>
<div class="card">
 <label><input type="checkbox" id="ack"> ฉันเข้าใจว่าจะส่งถึงผู้ติดตามทุกคน</label>
 <label>พิมพ์ <b>SEND</b> เพื่อยืนยัน: <input type="text" id="confirm" placeholder="SEND"></label>
 <button id="send" disabled><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg> ส่ง Broadcast</button>
 <div id="result"></div>
 <div class="hint">💡 ต้องการเครื่องมือครบกว่านี้ (Segments · Restock · Analytics)? เปิด Marketing Console: <b>npm run console</b> → localhost:3100</div>
</div>
<script>
 const $=id=>document.getElementById(id);
 fetch('/api/info').then(r=>r.json()).then(d=>{
  $('quota').innerHTML='โควตาเดือนนี้: ใช้ไป <b>'+d.used+'</b>'+(d.limit?' / '+d.limit:' (ไม่จำกัด)');
  $('intro').textContent=d.intro;
  $('promos').innerHTML=d.promos.map(p=>'<div class="promo"><b>'+p.name+'</b><br>'+p.detail+'</div>').join('');
 });
 function check(){ $('send').disabled=!($('ack').checked && $('confirm').value.trim()==='SEND'); }
 $('ack').onchange=check; $('confirm').oninput=check;
 $('send').onclick=async()=>{
  $('send').disabled=true; $('result').style.color='#6b7280'; $('result').textContent='กำลังส่ง…';
  try{
   const r=await fetch('/broadcast',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirm:'SEND'})});
   const d=await r.json();
   $('result').style.color=d.ok?'#16a34a':'#dc2626';
   $('result').textContent=d.ok?'✅ ส่งแล้ว — ผู้ติดตามทุกคนจะได้รับโปรนี้':'❌ '+d.error;
  }catch(e){
   $('result').style.color='#dc2626';
   $('result').textContent='❌ เชื่อมต่อ server ไม่ได้ ('+e.message+') — เช็คว่า npm run admin ยังรันอยู่ แล้วรีเฟรชหน้า';
  }finally{
   check(); // เปิดปุ่มกลับถ้ายังยืนยันครบ (ให้ลองใหม่ได้)
  }
 };
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  if (req.url === '/' ) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
  if (req.url === '/api/info') {
    let used = '?', limit = null;
    try { const q = await api.getMessageQuota(); const c = await api.getMessageQuotaConsumption(); used = c.totalUsage; limit = q.value || null; } catch {}
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ used, limit, intro: INTRO, promos: products.promotions }));
  }
  if (req.url === '/broadcast' && req.method === 'POST') {
    let body = ''; for await (const c of req) body += c;
    let confirm; try { confirm = JSON.parse(body).confirm; } catch {}
    res.writeHead(200, { 'content-type': 'application/json' });
    if (confirm !== 'SEND') return res.end(JSON.stringify({ ok: false, error: 'ต้องยืนยันด้วย confirm=SEND' }));
    try { await api.broadcast({ messages: buildMessages() }); return res.end(JSON.stringify({ ok: true })); }
    catch (e) { return res.end(JSON.stringify({ ok: false, error: e.message })); }
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(3100, '127.0.0.1', () => console.log('📣 Broadcast Console: http://localhost:3100 (localhost เท่านั้น)'));
