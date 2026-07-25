/**
 * voc-report.mjs — สร้าง dashboard สรุปบทสนทนา (Voice of Customer / data loop)
 * อ่าน data/voc-log.jsonl → สรุป: จำนวนแชท, tool ที่ใช้บ่อย, funnel การซื้อ, คำถามล่าสุด
 *
 * รัน:  node voc-report.mjs   → เขียน voc-dashboard.html แล้วเปิดในเบราว์เซอร์
 * UI: professional + responsive + dark mode · palette ตาม dataviz skill
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const store = createRequire(import.meta.url)('./store.js');

const logs = store.readVoc();
const byChannel = {};
const toolCount = {};
const users = new Set();
for (const r of logs) {
  users.add(r.user);
  byChannel[r.channel] = (byChannel[r.channel] || 0) + 1;
  for (const t of r.tools || []) toolCount[t] = (toolCount[t] || 0) + 1;
}
const interest = (toolCount.recommend_for_skin || 0) + (toolCount.get_bestsellers || 0);
const draft = toolCount.create_draft_order || 0;
const confirm = toolCount.confirm_order || 0;
const funnel = [
  { label: 'สนใจสินค้า', hint: 'recommend / bestsellers', n: interest },
  { label: 'ร่างออเดอร์', hint: 'create_draft_order', n: draft },
  { label: 'ยืนยันซื้อ', hint: 'confirm_order', n: confirm },
];
const convRate = interest ? Math.round((confirm / interest) * 100) : 0;
const topTools = Object.entries(toolCount).sort((a, b) => b[1] - a[1]);
const recent = logs.slice(-20).reverse();
const maxTool = Math.max(1, ...Object.values(toolCount));
const maxFunnel = Math.max(1, ...funnel.map((f) => f.n));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const genAt = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

const toolBars = topTools.length ? topTools.map(([t, n]) => `
  <div class="bar-row">
    <div class="bar-label" title="${esc(t)}">${esc(t)}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${(n / maxTool) * 100}%" title="${t}: ${n} ครั้ง"></div></div>
    <div class="bar-val">${n}</div>
  </div>`).join('') : `<p class="empty">ยังไม่มีข้อมูล — เริ่มแชทกับ bot แล้วรัน voc-report ใหม่</p>`;

const funnelBars = funnel.map((f, i) => {
  const prev = i > 0 ? funnel[i - 1].n : null;
  const step = prev ? Math.round((f.n / (prev || 1)) * 100) : null;
  return `
  <div class="funnel-row">
    <div class="funnel-head"><span class="funnel-label">${f.label}</span><span class="funnel-hint">${f.hint}</span></div>
    <div class="funnel-bar-wrap">
      <div class="bar-track"><div class="bar-fill good" style="width:${(f.n / maxFunnel) * 100}%" title="${f.label}: ${f.n}"></div></div>
      <div class="bar-val">${f.n}</div>
    </div>
    ${step !== null ? `<div class="funnel-step">↳ แปลงจากขั้นก่อน ${step}%</div>` : ''}
  </div>`;
}).join('');

const recentRows = recent.length ? recent.map((r) => `
  <tr>
    <td class="c-msg">${esc(r.text)}</td>
    <td><span class="badge badge-${r.channel}">${esc(r.channel)}</span></td>
    <td>${(r.tools || []).length ? (r.tools).map((t) => `<span class="chip">${esc(t)}</span>`).join('') : '<span class="muted">—</span>'}</td>
  </tr>`).join('') : `<tr><td colspan="3" class="empty">ยังไม่มีข้อมูล</td></tr>`;

const channelStr = Object.entries(byChannel).map(([k, v]) => `${k} ${v}`).join(' · ') || '—';

const html = `<!DOCTYPE html><html lang="th"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>VoC Dashboard — Glow Beauty</title>
<style>
:root{
  --bg:#f4f5f7; --surface:#ffffff; --border:#e7e8ec; --shadow:0 1px 3px rgba(16,24,40,.06),0 1px 2px rgba(16,24,40,.04);
  --text:#101828; --text-2:#475467; --muted:#98a2b3;
  --brand:#345589; --brand-soft:#eef2f8; --good:#12805c; --good-soft:#e6f4ee; --track:#f0f1f4;
}
@media (prefers-color-scheme:dark){:root:where(:not([data-theme=light])){
  --bg:#14161a; --surface:#1c1f24; --border:#2b2f36; --shadow:none;
  --text:#f2f4f7; --text-2:#c3c8d0; --muted:#7d8590;
  --brand:#6b9bd8; --brand-soft:#20293a; --good:#3ddc97; --good-soft:#16261f; --track:#262a31;
}}
:root[data-theme=dark]{
  --bg:#14161a; --surface:#1c1f24; --border:#2b2f36; --shadow:none;
  --text:#f2f4f7; --text-2:#c3c8d0; --muted:#7d8590;
  --brand:#6b9bd8; --brand-soft:#20293a; --good:#3ddc97; --good-soft:#16261f; --track:#262a31;
}
*{box-sizing:border-box;margin:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans Thai",sans-serif;background:var(--bg);color:var(--text);
  line-height:1.5;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.wrap{max-width:920px;margin:0 auto;padding:clamp(16px,4vw,32px)}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:20px}
.title h1{font-size:clamp(1.15rem,3vw,1.4rem);font-weight:700;letter-spacing:-.01em}
.title p{color:var(--text-2);font-size:.85rem;margin-top:2px}
.toggle{background:var(--surface);border:1px solid var(--border);color:var(--text-2);border-radius:8px;
  padding:7px 12px;font-size:.82rem;cursor:pointer;display:flex;gap:6px;align-items:center}
.toggle:hover{border-color:var(--brand);color:var(--brand)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 18px;box-shadow:var(--shadow)}
.kpi .v{font-size:clamp(1.5rem,5vw,1.9rem);font-weight:700;letter-spacing:-.02em}
.kpi .n{font-size:.78rem;color:var(--text-2);margin-top:2px}
.kpi .accent{color:var(--brand)}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:clamp(14px,3vw,20px);
  margin-bottom:14px;box-shadow:var(--shadow)}
.card h2{font-size:.95rem;font-weight:650;margin-bottom:2px}
.card .csub{font-size:.78rem;color:var(--muted);margin-bottom:14px}
.bar-row{display:grid;grid-template-columns:minmax(120px,1.4fr) 3fr 34px;align-items:center;gap:10px;margin:9px 0}
.bar-label{font-size:.82rem;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}
.bar-track{background:var(--track);border-radius:6px;height:14px;overflow:hidden}
.bar-fill{height:100%;background:var(--brand);border-radius:6px;min-width:3px;transition:width .5s cubic-bezier(.2,.8,.2,1)}
.bar-fill.good{background:var(--good)}
.bar-val{font-size:.82rem;font-weight:600;text-align:right}
.funnel-row{padding:8px 0;border-bottom:1px solid var(--border)}
.funnel-row:last-child{border-bottom:none}
.funnel-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
.funnel-label{font-weight:600;font-size:.9rem} .funnel-hint{font-size:.72rem;color:var(--muted)}
.funnel-bar-wrap{display:grid;grid-template-columns:1fr 34px;gap:10px;align-items:center}
.funnel-step{font-size:.74rem;color:var(--muted);margin-top:5px}
.table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:.83rem;min-width:420px}
th{text-align:left;color:var(--muted);font-weight:600;font-size:.74rem;text-transform:uppercase;letter-spacing:.03em;padding:0 10px 8px}
td{padding:9px 10px;border-top:1px solid var(--border);vertical-align:top;color:var(--text-2)}
.c-msg{color:var(--text);max-width:340px}
.badge{font-size:.7rem;font-weight:600;padding:2px 8px;border-radius:20px;background:var(--brand-soft);color:var(--brand);white-space:nowrap}
.badge-web{background:var(--good-soft);color:var(--good)}
.chip{display:inline-block;font-size:.68rem;background:var(--track);color:var(--text-2);padding:2px 7px;border-radius:6px;margin:1px 3px 1px 0}
.muted{color:var(--muted)} .empty{color:var(--muted);font-size:.85rem;padding:8px 0}
footer{color:var(--muted);font-size:.76rem;margin-top:18px;padding-top:14px;border-top:1px solid var(--border)}
</style></head>
<body class="viz-root"><div class="wrap">
<header>
  <div class="title"><h1>📊 VoC Dashboard</h1><p>Glow Beauty · first-party data (data loop) · อัปเดต ${genAt}</p></div>
  <button class="toggle" onclick="var r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'light':'dark'">🌗 สลับธีม</button>
</header>
<div class="kpis">
  <div class="kpi"><div class="v">${logs.length.toLocaleString('th-TH')}</div><div class="n">บทสนทนาทั้งหมด</div></div>
  <div class="kpi"><div class="v">${users.size.toLocaleString('th-TH')}</div><div class="n">ผู้ใช้ (unique)</div></div>
  <div class="kpi"><div class="v accent">${convRate}%</div><div class="n">อัตราแปลงสนใจ→ซื้อ</div></div>
  <div class="kpi"><div class="v" style="font-size:1.1rem;padding-top:6px">${esc(channelStr)}</div><div class="n">ตามช่องทาง</div></div>
</div>
<div class="card">
  <h2>🔧 Tool ที่ AI เรียกบ่อย</h2><div class="csub">จำนวนครั้งที่แต่ละ tool ถูกเรียก (มากไปน้อย)</div>
  ${toolBars}
</div>
<div class="card">
  <h2>🛒 Funnel การซื้อ</h2><div class="csub">เส้นทางจากสนใจ → ร่างออเดอร์ → ยืนยัน · อัตราแปลงรวม ${convRate}%</div>
  ${funnelBars}
</div>
<div class="card">
  <h2>💬 คำถามล่าสุด</h2><div class="csub">${recent.length} รายการล่าสุด</div>
  <div class="table-scroll"><table>
    <thead><tr><th>ข้อความ</th><th>ช่องทาง</th><th>tools</th></tr></thead>
    <tbody>${recentRows}</tbody>
  </table></div>
</div>
<footer>⚠️ PDPA: userId ถูก hash ก่อนเก็บ · การเก็บ log บทสนทนาต้องแจ้งในนโยบายความเป็นส่วนตัวของ OA · ข้อมูลตัวอย่างเพื่อสาธิต</footer>
</div></body></html>`;

fs.writeFileSync(new URL('./voc-dashboard.html', import.meta.url), html);
console.log(`✅ สร้าง voc-dashboard.html จาก ${logs.length} บทสนทนา · ${topTools.length} tools · อัตราแปลง ${convRate}%`);
