/**
 * voc-report.mjs — สร้าง dashboard สรุปบทสนทนา (Voice of Customer / data loop)
 * อ่าน data/voc-log.jsonl → สรุป: จำนวนแชท, tool ที่ใช้บ่อย, funnel การซื้อ, คำถามล่าสุด
 *
 * รัน:  node voc-report.mjs   → เขียน voc-dashboard.html แล้วเปิดในเบราว์เซอร์
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
// funnel การซื้อ
const funnel = {
  'สนใจสินค้า (recommend/bestsellers)': (toolCount.recommend_for_skin || 0) + (toolCount.get_bestsellers || 0),
  'ร่างออเดอร์ (draft)': toolCount.create_draft_order || 0,
  'ยืนยันซื้อ (confirm)': toolCount.confirm_order || 0,
};
const topTools = Object.entries(toolCount).sort((a, b) => b[1] - a[1]);
const recent = logs.slice(-15).reverse();
const max = Math.max(1, ...Object.values(toolCount));
const bar = (n, m, color) => `<div style="background:${color};height:18px;width:${Math.round((n / m) * 100)}%;min-width:2px;border-radius:0 4px 4px 0"></div>`;

const html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><title>VoC Dashboard — Glow Beauty</title>
<style>body{font-family:-apple-system,"Noto Sans Thai",sans-serif;background:#f4f5f7;color:#1f2430;max-width:760px;margin:0 auto;padding:24px}
h1{font-size:1.3rem}.sub{color:#6b7280;font-size:.9rem;margin-bottom:20px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px}
.tile{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px}.tile .v{font-size:1.5rem;font-weight:700}.tile .n{font-size:.8rem;color:#6b7280}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px}.card h2{font-size:1rem;margin-bottom:10px}
.row{display:grid;grid-template-columns:180px 1fr 40px;align-items:center;gap:8px;margin:6px 0;font-size:.85rem}.row .lbl{text-align:right;color:#374151}
.q{font-size:.82rem;color:#374151;padding:4px 0;border-bottom:1px solid #f0f0f0}.q .c{color:#9ca3af;font-size:.72rem}</style></head><body>
<h1>📊 VoC Dashboard — Glow Beauty</h1><p class="sub">สรุปจากบทสนทนาลูกค้า ${logs.length} ข้อความ · ข้อมูลนี้คือ first-party data (data loop)</p>
<div class="tiles">
 <div class="tile"><div class="v">${logs.length}</div><div class="n">บทสนทนา</div></div>
 <div class="tile"><div class="v">${users.size}</div><div class="n">ผู้ใช้ (unique)</div></div>
 <div class="tile"><div class="v">${Object.entries(byChannel).map(([k, v]) => `${k}:${v}`).join(' · ') || '-'}</div><div class="n">ช่องทาง</div></div>
</div>
<div class="card"><h2>🔧 Tool ที่ AI เรียกบ่อย</h2>
 ${topTools.map(([t, n]) => `<div class="row"><span class="lbl">${t}</span>${bar(n, max, '#345589')}<span>${n}</span></div>`).join('') || '<p style="color:#9ca3af">ยังไม่มีข้อมูล</p>'}</div>
<div class="card"><h2>🛒 Funnel การซื้อ</h2>
 ${Object.entries(funnel).map(([k, n]) => `<div class="row"><span class="lbl">${k}</span>${bar(n, Math.max(1, ...Object.values(funnel)), '#16a34a')}<span>${n}</span></div>`).join('')}</div>
<div class="card"><h2>💬 คำถามล่าสุด</h2>
 ${recent.map((r) => `<div class="q">${r.text} <span class="c">· ${r.channel} · ${(r.tools || []).join(',') || 'ไม่เรียก tool'}</span></div>`).join('') || '<p style="color:#9ca3af">ยังไม่มีข้อมูล</p>'}</div>
<p class="sub">⚠️ PDPA: userId ถูก hash · การเก็บ log ต้องแจ้งในนโยบายความเป็นส่วนตัวของ OA</p></body></html>`;

fs.writeFileSync(new URL('./voc-dashboard.html', import.meta.url), html);
console.log(`✅ สร้าง voc-dashboard.html จาก ${logs.length} บทสนทนา · tools: ${topTools.length} ชนิด · เปิดไฟล์ในเบราว์เซอร์ได้เลย`);
