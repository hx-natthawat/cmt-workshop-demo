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
 body{font-family:"IBM Plex Sans Thai","Noto Sans Thai",-apple-system,sans-serif;background:#f4f5f7;color:#1f2430;max-width:640px;margin:0 auto;padding:24px;line-height:1.6;-webkit-font-smoothing:antialiased}
 h1{font-size:1.3rem} .sub{color:#6b7280;font-size:.9rem;margin-bottom:20px}
 .card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px}
 .quota{font-size:.9rem} .promo{border-left:4px solid #345589;padding-left:12px;margin:10px 0}
 .promo b{color:#345589} .intro{background:#eef2f7;border-radius:8px;padding:10px;font-size:.9rem}
 label{display:flex;gap:8px;align-items:center;font-size:.9rem;margin:10px 0}
 input[type=text]{padding:8px;border:1px solid #d1d5db;border-radius:6px;width:140px}
 button{background:#345589;color:#fff;border:none;border-radius:8px;padding:12px 20px;font-size:1rem;font-weight:600;cursor:pointer}
 button:disabled{background:#9ca3af;cursor:not-allowed}
 .warn{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:8px;padding:10px;font-size:.85rem;margin:12px 0}
 #result{margin-top:14px;font-weight:600}
</style></head><body>
<h1>📣 Broadcast Console</h1>
<p class="sub">ส่งโปรโมชันถึงผู้ติดตาม LINE ทุกคน · Glow Beauty Thailand</p>
<div class="card"><div class="quota" id="quota">กำลังโหลดโควตา…</div></div>
<div class="card"><b>ตัวอย่างข้อความที่จะส่ง</b>
 <div class="intro" id="intro"></div>
 <div id="promos"></div></div>
<div class="warn">⚠️ การส่งนี้ <b>กลับไม่ได้</b> และ <b>กินโควตา</b> — ผู้ติดตามทุกคนจะได้รับ</div>
<div class="card">
 <label><input type="checkbox" id="ack"> ฉันเข้าใจว่าจะส่งถึงผู้ติดตามทุกคน</label>
 <label>พิมพ์ <b>SEND</b> เพื่อยืนยัน: <input type="text" id="confirm" placeholder="SEND"></label>
 <button id="send" disabled>ส่ง Broadcast</button>
 <div id="result"></div>
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
