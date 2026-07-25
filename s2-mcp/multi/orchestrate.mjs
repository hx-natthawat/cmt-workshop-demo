/**
 * orchestrate.mjs — Multi-server orchestration: Claude เรียก MCP หลายตัวต่อกันเองในคำสั่งเดียว
 * (บันได Enterprise ขั้นที่ 4 ในสไลด์ Orchestrate)
 *
 *   analytics-server  → ยอดขาย/ช่องทาง/จุดเสี่ยง   (จาก customer_data.csv)
 *   showcase server   → สินค้า/สต็อก/โปร/ออเดอร์   (จาก products.json)
 *        ↓ รวม tools ทั้งสองเข้าด้วยกันแล้วส่งให้ Claude
 *   Claude เลือกเองว่าจะเรียก tool จาก server ไหน ตามลำดับใด
 *
 * รัน:  node orchestrate.mjs                     # ใช้โจทย์ตัวอย่างจากสไลด์
 *       node orchestrate.mjs "คำสั่งของคุณ"       # โจทย์เอง
 *
 * ต้องมี ANTHROPIC_API_KEY (อ่านจาก s1-martech/line-bot/.env ถ้าไม่ได้ตั้ง env)
 */
import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// ── API key: env ก่อน ถ้าไม่มีอ่านจาก .env ของ line-bot ──
let KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  try {
    const env = fs.readFileSync(new URL('../../s1-martech/line-bot/.env', import.meta.url), 'utf-8');
    KEY = env.split(/\r?\n/).find((l) => l.startsWith('ANTHROPIC_API_KEY='))
      ?.slice('ANTHROPIC_API_KEY='.length).trim().replace(/^"|"$/g, '');
  } catch {}
}
if (!KEY) { console.error('❌ ไม่พบ ANTHROPIC_API_KEY (ตั้ง env หรือใส่ใน s1-martech/line-bot/.env)'); process.exit(1); }
const anthropic = new Anthropic({ apiKey: KEY });

// ── รายชื่อ MCP servers ที่จะต่อพร้อมกัน (โลกจริง: คนละทีม คนละระบบ) ──
const SERVERS = [
  { name: 'analytics', label: '📊 analytics', path: new URL('./analytics-server.mjs', import.meta.url).pathname },
  { name: 'shop', label: '🧴 shop', path: new URL('../showcase/server.mjs', import.meta.url).pathname },
];

const registry = new Map(); // toolName → { client, serverLabel }
const allTools = [];

for (const s of SERVERS) {
  const transport = new StdioClientTransport({ command: 'node', args: [s.path] });
  const client = new Client({ name: 'orchestrator', version: '1.0.0' });
  await client.connect(transport);
  const { tools } = await client.listTools();
  for (const t of tools) {
    if (registry.has(t.name)) { console.error(`⚠️  ชื่อ tool ซ้ำ: ${t.name} — ข้ามตัวจาก ${s.name}`); continue; }
    registry.set(t.name, { client, serverLabel: s.label });
    allTools.push({ name: t.name, description: t.description, input_schema: t.inputSchema });
  }
  console.log(`🔌 ต่อ ${s.label} — ${tools.length} tools`);
}
console.log(`\nรวม ${allTools.length} tools จาก ${SERVERS.length} servers · Claude จะเลือกเองว่าใช้ตัวไหน\n`);

const SYSTEM = `คุณคือผู้ช่วยวิเคราะห์ธุรกิจของร้าน Glow Beauty Thailand
- ใช้ tools ที่มีเพื่อดึงข้อมูลจริงเสมอ ห้ามเดาตัวเลข
- คุณมีเครื่องมือจากหลายระบบ (ฝั่งวิเคราะห์ยอดขาย และฝั่งสินค้า/สต็อก) เรียกต่อกันได้ตามต้องการ
- ตอบเป็นภาษาไทย กระชับ มีตัวเลขอ้างอิง และปิดท้ายด้วยข้อเสนอที่ทำได้จริง`;

const TASK = process.argv[2] ||
  'สรุปว่าช่องทางไหนทำยอดได้ดีที่สุด · หาว่าช่องทางไหนน่ากังวลที่สุดและเพราะอะไร · ' +
  'แล้วเช็คว่าสินค้าที่ใกล้หมดสต็อกมีตัวไหนบ้าง สุดท้ายร่างข้อความสั้นๆ แจ้งทีมการตลาด';

console.log(`👤 โจทย์: ${TASK}\n${'─'.repeat(70)}`);

const messages = [{ role: 'user', content: TASK }];
const trace = [];

for (let hop = 1; hop <= 8; hop++) {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-5', max_tokens: 2000, thinking: { type: 'disabled' },
    system: SYSTEM, tools: allTools, messages,
  });
  messages.push({ role: 'assistant', content: res.content });

  if (res.stop_reason !== 'tool_use') {
    const text = res.content.find((b) => b.type === 'text')?.text ?? '(ไม่มีคำตอบ)';
    console.log(`\n${'─'.repeat(70)}\n💬 คำตอบสุดท้าย:\n\n${text}\n`);
    console.log(`${'═'.repeat(70)}\n🔗 ลำดับการเรียกข้าม server (${trace.length} ครั้ง):`);
    trace.forEach((t, i) => console.log(`   ${i + 1}. ${t.server}  →  ${t.tool}`));
    const servers = new Set(trace.map((t) => t.server));
    console.log(`\n✅ Claude เรียก tool จาก ${servers.size} servers ต่อกันเองในคำสั่งเดียว`);
    break;
  }

  const results = [];
  for (const tu of res.content.filter((b) => b.type === 'tool_use')) {
    const entry = registry.get(tu.name);
    if (!entry) { results.push({ type: 'tool_result', tool_use_id: tu.id, content: [{ type: 'text', text: 'ไม่พบ tool นี้' }], is_error: true }); continue; }
    console.log(`  [hop ${hop}] ${entry.serverLabel} → ${tu.name}(${JSON.stringify(tu.input)})`);
    trace.push({ server: entry.serverLabel, tool: tu.name });
    const r = await entry.client.callTool({ name: tu.name, arguments: tu.input });
    results.push({ type: 'tool_result', tool_use_id: tu.id, content: r.content.map((c) => ({ type: 'text', text: c.text })) });
  }
  messages.push({ role: 'user', content: results });
}

for (const { client } of new Set([...registry.values()].map((v) => ({ client: v.client })))) {
  try { await client.close(); } catch {}
}
process.exit(0);
