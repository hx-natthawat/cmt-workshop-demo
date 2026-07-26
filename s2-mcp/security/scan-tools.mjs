/**
 * scan-tools.mjs — สแกน "คำอธิบาย tool" ของ MCP server หา red flag ก่อนเชื่อมต่อจริง
 * (เครื่องมือป้องกัน tool poisoning — ใช้ได้จริงในงาน production)
 *
 * แนวคิด: คำอธิบาย tool คือสิ่งที่โมเดลอ่านและเชื่อ — ถ้ามีคำสั่งฝังอยู่ AI จะทำตาม
 * ก่อนไว้ใจ server ใด ให้ดึง tools/list มาสแกนก่อนเสมอ (และสแกนซ้ำทุกครั้งที่อัปเวอร์ชัน = กัน rug pull)
 *
 * ใช้:  node scan-tools.mjs <path/to/server.mjs>
 *       node scan-tools.mjs ./poisoned-server.mjs
 *       node scan-tools.mjs ../showcase/server.mjs
 *
 * exit 0 = ปลอดภัย · exit 1 = พบความเสี่ยงระดับสูง (ใช้ใน CI ได้)
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const target = process.argv[2];
if (!target) { console.error('ใช้: node scan-tools.mjs <path/to/server.mjs>'); process.exit(2); }

// กฎตรวจจับอยู่ใน rules.mjs (ใช้ร่วมกับ report.mjs ที่ทำ UI)
import { RULES } from './rules.mjs';

const transport = new StdioClientTransport({ command: 'node', args: [target] });
const mcp = new Client({ name: 'tool-scanner', version: '1.0.0' });
await mcp.connect(transport);
const { tools } = await mcp.listTools();

console.log(`\n🔍 สแกน ${tools.length} tools จาก: ${target}\n`);
let high = 0, medium = 0, low = 0;

for (const t of tools) {
  const desc = t.description || '';
  const hits = RULES.filter((r) => (r.test ? r.test(desc) : r.re.test(desc)));
  if (!hits.length) { console.log(`  ✅ ${t.name} — ไม่พบสิ่งผิดปกติ`); continue; }
  const worst = hits.some((h) => h.sev === 'high') ? '🚨' : hits.some((h) => h.sev === 'medium') ? '⚠️ ' : 'ℹ️ ';
  console.log(`  ${worst} ${t.name} — พบ ${hits.length} จุด`);
  for (const h of hits) {
    if (h.sev === 'high') high++; else if (h.sev === 'medium') medium++; else low++;
    console.log(`      [${h.sev}] ${h.id}: ${h.why}`);
  }
  // แสดงส่วนที่น่าสงสัย (ตัดให้สั้น) เพื่อให้คนตรวจเห็นของจริง
  const snippet = desc.replace(/\s+/g, ' ').slice(0, 160);
  console.log(`      ตัวอย่างคำอธิบาย: "${snippet}${desc.length > 160 ? '…' : ''}"`);
}

console.log(`\n═══ สรุป: 🚨 สูง ${high} · ⚠️ กลาง ${medium} · ℹ️ ต่ำ ${low} ═══`);
if (high) console.log('👉 อย่าเชื่อมต่อ server นี้จนกว่าจะตรวจสอบแหล่งที่มาและแก้ไข');
else console.log('👉 ผ่านการสแกนเบื้องต้น — ยังควรรีวิวโค้ด + pin เวอร์ชันก่อนใช้จริง');

await mcp.close();
process.exit(high ? 1 : 0);
