/**
 * trace-ui.mjs — รัน orchestration แล้วสร้าง "แผนภาพการเรียกข้าม server" เป็น HTML
 * จุดขาย: เห็นด้วยตาว่า Claude เรียก tool จาก server ไหน · hop ไหน · ตัวไหนขนานกัน
 *
 * รัน:  node trace-ui.mjs                    # โจทย์ตัวอย่าง
 *       node trace-ui.mjs "โจทย์ของคุณ"
 * ผลลัพธ์: trace.html → เปิดในเบราว์เซอร์
 */
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

let KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  try {
    const env = fs.readFileSync(new URL('../../s1-martech/line-bot/.env', import.meta.url), 'utf-8');
    KEY = env.split(/\r?\n/).find((l) => l.startsWith('ANTHROPIC_API_KEY='))
      ?.slice('ANTHROPIC_API_KEY='.length).trim().replace(/^"|"$/g, '');
  } catch {}
}
if (!KEY) { console.error('❌ ไม่พบ ANTHROPIC_API_KEY'); process.exit(1); }
const anthropic = new Anthropic({ apiKey: KEY });

const SERVERS = [
  { key: 'analytics', label: 'analytics', color: 'a', desc: 'ยอดขาย · ช่องทาง · จุดเสี่ยง', path: new URL('./analytics-server.mjs', import.meta.url).pathname },
  { key: 'shop', label: 'shop', color: 'b', desc: 'สินค้า · สต็อก · โปร · ออเดอร์', path: new URL('../showcase/server.mjs', import.meta.url).pathname },
];

const registry = new Map();
const allTools = [];
const serverMeta = [];
for (const s of SERVERS) {
  const transport = new StdioClientTransport({ command: 'node', args: [s.path] });
  const client = new Client({ name: 'trace-ui', version: '1.0.0' });
  await client.connect(transport);
  const { tools } = await client.listTools();
  for (const t of tools) {
    if (registry.has(t.name)) continue;
    registry.set(t.name, { client, s });
    allTools.push({ name: t.name, description: t.description, input_schema: t.inputSchema });
  }
  serverMeta.push({ ...s, count: tools.length, names: tools.map((t) => t.name) });
  console.log(`🔌 ${s.label} — ${tools.length} tools`);
}

const SYSTEM = `คุณคือผู้ช่วยวิเคราะห์ธุรกิจของร้าน Glow Beauty Thailand
- ใช้ tools ดึงข้อมูลจริงเสมอ ห้ามเดาตัวเลข
- มีเครื่องมือจากหลายระบบ เรียกต่อกันได้ตามต้องการ
- ตอบภาษาไทย กระชับ มีตัวเลขอ้างอิง ปิดท้ายด้วยข้อเสนอที่ทำได้จริง`;

const TASK = process.argv[2] ||
  'สรุปว่าช่องทางไหนทำยอดได้ดีที่สุด · หาว่าช่องทางไหนน่ากังวลที่สุดและเพราะอะไร · ' +
  'แล้วเช็คว่าสินค้าที่ใกล้หมดสต็อกมีตัวไหนบ้าง สุดท้ายร่างข้อความสั้นๆ แจ้งทีมการตลาด';

console.log(`\n👤 ${TASK}\n`);
const messages = [{ role: 'user', content: TASK }];
const hops = [];
let answer = '';
const t0 = Date.now();

for (let hop = 1; hop <= 8; hop++) {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-5', max_tokens: 2000, thinking: { type: 'disabled' },
    system: SYSTEM, tools: allTools, messages,
  });
  const toolUses = res.content.filter((b) => b.type === 'tool_use');
  // กัน stop_reason=tool_use แต่ไม่มี tool_use block จริง (ดู agent.js — เคยทำให้ API ตอบ 400)
  if (res.stop_reason === 'tool_use' && !toolUses.length) {
    console.error('⚠️  โมเดลไม่ได้ส่ง tool_use block ที่ถูกต้อง — ลองใหม่');
    continue;
  }
  messages.push({ role: 'assistant', content: res.content });

  if (res.stop_reason !== 'tool_use') {
    answer = res.content.find((b) => b.type === 'text')?.text ?? '';
    break;
  }
  const calls = [];
  const results = [];
  for (const tu of toolUses) {
    const entry = registry.get(tu.name);
    const started = Date.now();
    const r = await entry.client.callTool({ name: tu.name, arguments: tu.input });
    const text = r.content.map((c) => c.text).join('\n');
    calls.push({ server: entry.s.key, label: entry.s.label, color: entry.s.color, tool: tu.name,
      input: tu.input, result: text, ms: Date.now() - started });
    console.log(`  [hop ${hop}] ${entry.s.label} → ${tu.name}`);
    results.push({ type: 'tool_result', tool_use_id: tu.id, content: r.content.map((c) => ({ type: 'text', text: c.text })) });
  }
  hops.push({ n: hop, calls });
  messages.push({ role: 'user', content: results });
}
const totalMs = Date.now() - t0;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const totalCalls = hops.reduce((a, h) => a + h.calls.length, 0);
const usedServers = new Set(hops.flatMap((h) => h.calls.map((c) => c.server)));
const parallelHops = hops.filter((h) => h.calls.length > 1).length;

const html = `<!DOCTYPE html><html lang="th"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Multi-Server Orchestration Trace — Glow Beauty</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#f6f7f9;--surface:#fff;--surface-2:#fafbfc;--border:#e7e8ec;--text:#101828;--text-2:#475467;--muted:#98a2b3;
 --brand:#345589;--brand-soft:#eef2f8;--sa:#2a78d6;--sa-soft:#eaf2fc;--sb:#1baf7a;--sb-soft:#e6f6f0;--shadow:0 1px 3px rgba(16,24,40,.06)}
@media(prefers-color-scheme:dark){:root{--bg:#0f1115;--surface:#171a1f;--surface-2:#1c2027;--border:#282d35;--text:#f2f4f7;--text-2:#c3c8d0;
 --muted:#7d8590;--brand:#6b9bd8;--brand-soft:#1c2636;--sa:#3987e5;--sa-soft:#16233a;--sb:#199e70;--sb-soft:#10251d;--shadow:none}}
*{box-sizing:border-box;margin:0}
body{font-family:"IBM Plex Sans Thai","Noto Sans Thai",-apple-system,sans-serif;background:var(--bg);color:var(--text);
 line-height:1.6;font-size:15px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.wrap{max-width:1000px;margin:0 auto;padding:clamp(16px,4vw,32px)}
h1{font-size:clamp(1.2rem,3.5vw,1.5rem);font-weight:700;display:flex;align-items:center;gap:10px;letter-spacing:-.01em}
h1 svg{color:var(--brand)}
.lead{color:var(--text-2);font-size:.88rem;margin:4px 0 18px}
.task{background:var(--brand-soft);border-radius:12px;padding:13px 16px;font-size:.87rem;margin-bottom:18px}
.task b{display:block;font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:20px}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:13px;padding:14px 16px;box-shadow:var(--shadow)}
.kpi .v{font-size:1.5rem;font-weight:700;letter-spacing:-.02em}.kpi .n{font-size:.74rem;color:var(--text-2)}
.servers{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px}
.sv{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:11px 14px;box-shadow:var(--shadow);flex:1;min-width:220px}
.sv .nm{font-weight:650;font-size:.86rem;display:flex;align-items:center;gap:7px}
.dot{width:9px;height:9px;border-radius:50%}
.dot.a{background:var(--sa)}.dot.b{background:var(--sb)}
.sv .ds{font-size:.75rem;color:var(--muted);margin-top:2px}
.sv .tl{font-size:.68rem;color:var(--text-2);font-family:ui-monospace,Menlo,monospace;margin-top:6px;word-break:break-word}
h2{font-size:1rem;font-weight:650;margin:22px 0 12px}
.hop{position:relative;padding-left:44px;padding-bottom:18px}
.hop::before{content:attr(data-n);position:absolute;left:0;top:0;width:30px;height:30px;border-radius:50%;
 background:var(--brand);color:#fff;display:grid;place-items:center;font-size:.8rem;font-weight:700}
.hop::after{content:"";position:absolute;left:14.5px;top:32px;bottom:0;width:2px;background:var(--border)}
.hop:last-child::after{display:none}
.hop-head{font-size:.76rem;color:var(--muted);margin-bottom:8px}
.par{display:inline-block;background:var(--brand-soft);color:var(--brand);font-size:.68rem;font-weight:600;padding:1px 8px;border-radius:20px;margin-left:6px}
.calls{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:10px}
.call{border:1px solid var(--border);border-radius:12px;padding:12px;background:var(--surface);box-shadow:var(--shadow)}
.call.a{border-left:3px solid var(--sa)}.call.b{border-left:3px solid var(--sb)}
.call .top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}
.badge{font-size:.68rem;font-weight:600;padding:2px 9px;border-radius:20px}
.badge.a{background:var(--sa-soft);color:var(--sa)}.badge.b{background:var(--sb-soft);color:var(--sb)}
.ms{font-size:.68rem;color:var(--muted)}
.call code{font-family:ui-monospace,Menlo,monospace;font-size:.82rem;font-weight:600}
.args{font-size:.7rem;color:var(--muted);font-family:ui-monospace,Menlo,monospace;margin:4px 0 8px;word-break:break-all}
details summary{font-size:.73rem;color:var(--brand);cursor:pointer}
details pre{font-size:.72rem;color:var(--text-2);background:var(--surface-2);border:1px solid var(--border);border-radius:8px;
 padding:9px;margin-top:6px;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow-y:auto}
.answer{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:var(--shadow);
 white-space:pre-wrap;font-size:.87rem;line-height:1.7}
.note{background:var(--brand-soft);border-radius:12px;padding:13px 16px;font-size:.82rem;color:var(--text-2);margin-top:18px}
.note b{color:var(--text)}
footer{color:var(--muted);font-size:.75rem;margin-top:18px;padding-top:14px;border-top:1px solid var(--border)}
</style></head><body><div class="wrap">

<h1><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="8" rx="2"/><rect x="14" y="14" width="8" height="8" rx="2"/><path d="M6 10v4a2 2 0 0 0 2 2h6"/></svg> Multi-Server Orchestration Trace</h1>
<p class="lead">Claude เลือกเรียก tool ข้าม MCP server เองในคำสั่งเดียว — "บันได Enterprise ขั้นที่ 4"</p>

<div class="task"><b>โจทย์</b>${esc(TASK)}</div>

<div class="kpis">
  <div class="kpi"><div class="v">${usedServers.size}</div><div class="n">servers ที่ถูกเรียก</div></div>
  <div class="kpi"><div class="v">${totalCalls}</div><div class="n">tool calls</div></div>
  <div class="kpi"><div class="v">${hops.length}</div><div class="n">hops (รอบคิด)</div></div>
  <div class="kpi"><div class="v">${(totalMs / 1000).toFixed(1)}s</div><div class="n">เวลารวม</div></div>
</div>

<div class="servers">
  ${serverMeta.map((s) => `<div class="sv"><div class="nm"><span class="dot ${s.color}"></span>${esc(s.label)} <span class="ms">${s.count} tools</span></div>
    <div class="ds">${esc(s.desc)}</div><div class="tl">${s.names.map(esc).join(' · ')}</div></div>`).join('')}
</div>

<h2>ลำดับการเรียก</h2>
${hops.map((h) => `
  <div class="hop" data-n="${h.n}">
    <div class="hop-head">hop ${h.n} — ${h.calls.length} call${h.calls.length > 1 ? 's' : ''}
      ${h.calls.length > 1 ? '<span class="par">⚡ เรียกขนานกัน</span>' : ''}</div>
    <div class="calls">
      ${h.calls.map((c) => `
        <div class="call ${c.color}">
          <div class="top"><span class="badge ${c.color}">${esc(c.label)}</span><span class="ms">${c.ms} ms</span></div>
          <code>${esc(c.tool)}</code>
          <div class="args">${esc(JSON.stringify(c.input))}</div>
          <details><summary>ดูผลลัพธ์</summary><pre>${esc(c.result)}</pre></details>
        </div>`).join('')}
    </div>
  </div>`).join('')}

<h2>คำตอบสุดท้าย</h2>
<div class="answer">${esc(answer)}</div>

<div class="note">
  <b>จุดสังเกต:</b> ${parallelHops > 0
    ? `มี ${parallelHops} hop ที่ Claude เรียกหลาย tool <b>ขนานกัน</b> — เพราะ tool เหล่านั้นไม่ต้องรอผลของกันและกัน ⇒ เร็วกว่าและถูกกว่าการถามทีละคำถาม`
    : 'รอบนี้เรียกทีละ tool ตามลำดับ — เพราะผลของ tool ก่อนหน้าเป็น input ของขั้นถัดไป'}<br><br>
  <b>ในโค้ด:</b> orchestrator เก็บ registry <code>toolName → { client, server }</code> แล้ว route คำขอไปยัง client ที่ถูกตัว — นี่คือหัวใจของ multi-server orchestration
</div>

<footer>วัสดุสอน · Lab Orchestrate (Session 2 Advanced MCP) · ข้อมูลจริงจาก customer_data.csv และ products.json</footer>
</div></body></html>`;

fs.writeFileSync(new URL('./trace.html', import.meta.url), html);
console.log(`\n✅ สร้าง trace.html — ${totalCalls} calls · ${usedServers.size} servers · ${hops.length} hops · ${(totalMs / 1000).toFixed(1)}s`);

for (const s of new Set([...registry.values()].map((v) => v.client))) { try { await s.close(); } catch {} }
process.exit(0);
