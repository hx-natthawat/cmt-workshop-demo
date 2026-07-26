/**
 * report.mjs — สร้างรายงานสแกนแบบ "เห็นภาพ" (HTML) เทียบ server ที่ถูกวางยา vs server ที่ป้องกันแล้ว
 * จุดขาย: ไฮไลต์ "คำสั่งฝัง" ในคำอธิบาย tool ให้เห็นกับตา — สิ่งที่ผู้ใช้ไม่เคยเห็นแต่โมเดลอ่าน
 *
 * รัน:  node report.mjs                      # เทียบ poisoned vs guarded (ค่าเริ่มต้น)
 *       node report.mjs ../showcase/server.mjs ./guarded-server.mjs
 * ผลลัพธ์: scan-report.html → เปิดในเบราว์เซอร์
 */
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { RULES, scanDescription, summarize } from './rules.mjs';

const targets = process.argv.slice(2);
const SERVERS = targets.length ? targets : ['./poisoned-server.mjs', './guarded-server.mjs'];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ไฮไลต์ช่วงที่ผิดกฎในคำอธิบาย (รวมช่วงที่ทับกันก่อน)
function highlight(desc, spans) {
  if (!spans.length) return esc(desc);
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) { last.end = Math.max(last.end, s.end); last.sev = last.sev === 'high' ? 'high' : s.sev; }
    else merged.push({ ...s });
  }
  let out = '', cur = 0;
  for (const s of merged) {
    out += esc(desc.slice(cur, s.start));
    out += `<mark class="hl ${s.sev}">${esc(desc.slice(s.start, s.end))}</mark>`;
    cur = s.end;
  }
  return out + esc(desc.slice(cur));
}

async function scanServer(p) {
  const transport = new StdioClientTransport({ command: 'node', args: [p] });
  const mcp = new Client({ name: 'report', version: '1.0.0' });
  await mcp.connect(transport);
  const { tools } = await mcp.listTools();
  const results = tools.map((t) => {
    const desc = t.description || '';
    const { hits, spans } = scanDescription(desc);
    return { name: t.name, desc, hits, spans };
  });
  await mcp.close();
  return { path: p, name: path.basename(p), results, summary: summarize(results) };
}

const reports = [];
for (const s of SERVERS) { console.log(`🔍 สแกน ${s} …`); reports.push(await scanServer(s)); }

const ICON = {
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  alert: '<path d="M12 9v4"/><path d="M10.36 3.23 2.51 17a2 2 0 0 0 1.71 3h15.56a2 2 0 0 0 1.71-3L13.64 3.23a2 2 0 0 0-3.28 0z"/><path d="M12 17h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
};
const svg = (n, sz = 18) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-.18em">${ICON[n]}</svg>`;

const card = (r) => {
  const s = r.summary;
  const badge = s.verdict === 'danger'
    ? `<span class="verdict bad">${svg('alert', 15)} อันตราย — อย่าเชื่อมต่อ</span>`
    : `<span class="verdict good">${svg('check', 15)} ผ่านการสแกนเบื้องต้น</span>`;
  return `
  <section class="server ${s.verdict}">
    <div class="shead">
      <div><h2>${esc(r.name)}</h2><div class="spath">${esc(r.path)}</div></div>
      ${badge}
    </div>
    <div class="counts">
      <span class="cnt high">สูง ${s.high}</span><span class="cnt med">กลาง ${s.medium}</span><span class="cnt low">ต่ำ ${s.low}</span>
      <span class="cnt tools">${r.results.length} tools</span>
    </div>
    ${r.results.map((t) => `
      <div class="tool ${t.hits.length ? (t.hits.some((h) => h.sev === 'high') ? 'risk-high' : 'risk-med') : 'risk-none'}">
        <div class="tname">${t.hits.length ? (t.hits.some((h) => h.sev === 'high') ? '🚨' : '⚠️') : '✅'} <code>${esc(t.name)}</code></div>
        <div class="desc">${highlight(t.desc, t.spans)}</div>
        ${t.hits.length ? `<ul class="hits">${t.hits.map((h) => `<li><span class="sev ${h.sev}">${h.sev}</span> <b>${esc(h.label)}</b> — ${esc(h.why)}</li>`).join('')}</ul>` : ''}
      </div>`).join('')}
  </section>`;
};

const html = `<!DOCTYPE html><html lang="th"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>MCP Tool Scan Report — Glow Beauty</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#f6f7f9;--surface:#fff;--surface-2:#fafbfc;--border:#e7e8ec;--text:#101828;--text-2:#475467;--muted:#98a2b3;
 --brand:#345589;--brand-soft:#eef2f8;--good:#12805c;--good-soft:#e6f4ee;--warn:#b42318;--warn-soft:#fef3f2;
 --med:#b54708;--med-soft:#fffaeb;--shadow:0 1px 3px rgba(16,24,40,.06)}
@media(prefers-color-scheme:dark){:root{--bg:#0f1115;--surface:#171a1f;--surface-2:#1c2027;--border:#282d35;--text:#f2f4f7;--text-2:#c3c8d0;
 --muted:#7d8590;--brand:#6b9bd8;--brand-soft:#1c2636;--good:#3ddc97;--good-soft:#132318;--warn:#f97066;--warn-soft:#2a1614;
 --med:#fdb022;--med-soft:#2a2113;--shadow:none}}
*{box-sizing:border-box;margin:0}
body{font-family:"IBM Plex Sans Thai","Noto Sans Thai",-apple-system,sans-serif;background:var(--bg);color:var(--text);
 line-height:1.6;font-size:15px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.wrap{max-width:1000px;margin:0 auto;padding:clamp(16px,4vw,32px)}
header{margin-bottom:20px}
h1{font-size:clamp(1.2rem,3.5vw,1.5rem);font-weight:700;display:flex;align-items:center;gap:10px;letter-spacing:-.01em}
h1 svg{color:var(--brand)}
.lead{color:var(--text-2);font-size:.88rem;margin-top:4px}
.legend{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 22px}
.chip{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:5px 12px;font-size:.75rem;color:var(--text-2)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:16px;align-items:start}
.server{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;box-shadow:var(--shadow)}
.server.danger{border-color:color-mix(in srgb,var(--warn) 45%,transparent)}
.server.ok{border-color:color-mix(in srgb,var(--good) 40%,transparent)}
.shead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px}
h2{font-size:1rem;font-weight:650}
.spath{font-size:.72rem;color:var(--muted);font-family:ui-monospace,Menlo,monospace}
.verdict{font-size:.74rem;font-weight:600;padding:4px 11px;border-radius:20px;white-space:nowrap}
.verdict.bad{background:var(--warn-soft);color:var(--warn)}.verdict.good{background:var(--good-soft);color:var(--good)}
.counts{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.cnt{font-size:.7rem;font-weight:600;padding:2px 9px;border-radius:6px;background:var(--surface-2);border:1px solid var(--border);color:var(--text-2)}
.cnt.high{background:var(--warn-soft);color:var(--warn);border-color:transparent}
.cnt.med{background:var(--med-soft);color:var(--med);border-color:transparent}
.tool{border:1px solid var(--border);border-radius:11px;padding:13px;margin-bottom:10px;background:var(--surface-2)}
.tool.risk-high{border-left:3px solid var(--warn)}
.tool.risk-med{border-left:3px solid var(--med)}
.tool.risk-none{border-left:3px solid var(--good)}
.tname{font-weight:600;font-size:.88rem;margin-bottom:7px}
.tname code{font-family:ui-monospace,Menlo,monospace;font-size:.85rem}
.desc{font-size:.8rem;color:var(--text-2);white-space:pre-wrap;word-break:break-word;background:var(--surface);
 border:1px solid var(--border);border-radius:8px;padding:10px;line-height:1.65;max-height:230px;overflow-y:auto}
mark.hl{border-radius:3px;padding:1px 2px;font-weight:500}
mark.hl.high{background:color-mix(in srgb,var(--warn) 26%,transparent);color:var(--text);box-shadow:0 0 0 1px color-mix(in srgb,var(--warn) 45%,transparent)}
mark.hl.medium{background:color-mix(in srgb,var(--med) 26%,transparent);color:var(--text)}
.hits{list-style:none;margin-top:9px;display:flex;flex-direction:column;gap:5px}
.hits li{font-size:.76rem;color:var(--text-2)}
.sev{font-size:.64rem;font-weight:700;text-transform:uppercase;padding:1px 6px;border-radius:4px;letter-spacing:.03em}
.sev.high{background:var(--warn-soft);color:var(--warn)}.sev.medium{background:var(--med-soft);color:var(--med)}
.sev.low{background:var(--surface-2);color:var(--muted)}
.note{background:var(--brand-soft);border-radius:12px;padding:14px 16px;font-size:.83rem;color:var(--text-2);margin-top:20px}
.note b{color:var(--text)}
footer{color:var(--muted);font-size:.75rem;margin-top:18px;padding-top:14px;border-top:1px solid var(--border)}
@media(max-width:860px){.grid{grid-template-columns:1fr}}
</style></head><body><div class="wrap">
<header>
  <h1>${svg('shield', 22)} MCP Tool Scan Report</h1>
  <p class="lead">ตรวจ "คำอธิบาย tool" ก่อนเชื่อมต่อ — ส่วนที่ <b>ผู้ใช้ไม่เห็น แต่โมเดลอ่านและเชื่อ</b></p>
  <div class="legend">
    <span class="chip">🚨 <b>ไฮไลต์แดง</b> = ความเสี่ยงสูง</span>
    <span class="chip">⚠️ ไฮไลต์ส้ม = ปานกลาง</span>
    <span class="chip">${RULES.length} กฎตรวจจับ</span>
    <span class="chip">สร้างเมื่อ ${new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</span>
  </div>
</header>

<div class="grid">${reports.map(card).join('')}</div>

<div class="note">
  <b>อ่านรายงานนี้อย่างไร:</b> ข้อความที่ถูกไฮไลต์คือส่วนที่ตรงกับกฎตรวจจับ — สังเกตว่าใน server ที่ถูกวางยา
  คำสั่งถูกซ่อนใน HTML comment ต่อท้ายคำอธิบายปกติ ผู้ใช้เห็นแค่ชื่อ tool ในแชท แต่โมเดลได้รับข้อความทั้งก้อนนี้<br><br>
  <b>ทำอย่างไรต่อ:</b> สแกนทุกครั้งก่อนเชื่อม server ที่ไม่ได้เขียนเอง · สแกนซ้ำเมื่ออัปเวอร์ชัน (กัน rug pull) ·
  ใส่ <code>scan-tools.mjs</code> ใน CI แล้วบล็อก deploy เมื่อ exit ≠ 0
</div>

<footer>วัสดุสอน · Lab Security (Session 2 Advanced MCP) · payload ในตัวอย่างไม่มีพิษจริง (ไม่อ่านไฟล์ ไม่ส่งข้อมูลออก)</footer>
</div></body></html>`;

const out = new URL('./scan-report.html', import.meta.url);
fs.writeFileSync(out, html);
const totals = reports.map((r) => `${r.name}: 🚨${r.summary.high} ⚠️${r.summary.medium}`).join(' · ');
console.log(`\n✅ สร้าง scan-report.html แล้ว — ${totals}`);
console.log(`   เปิดดู: open ${out.pathname}`);
