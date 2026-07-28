/**
 * test-governance.mjs — ตรวจว่า "ประตูกำกับดูแล" ฝั่ง MCP ยังทำงานจริง
 *
 * ต่างจาก test-console ของ line-bot-rich ตรงที่นั่นเป็นประตูฝั่ง **operator**
 * ส่วนนี่คือประตูฝั่ง **AI เรียกเอง** — ซึ่งอันตรายกว่า เพราะไม่มีมนุษย์กดปุ่มคั่น
 *
 * ตรวจ 2 server:
 *   1. showcase   — draft ต้องไม่ execute · validation ต้องปฏิเสธ input พิลึก · ไม่แก้ไฟล์ข้อมูล
 *   2. guarded    — kill switch · readonly · audit log ระบุ actor + verdict
 *
 * ไม่ใช้ ANTHROPIC_API_KEY (คุยกับ server ตรงๆ ผ่าน stdio) → รันใน CI ได้
 * รัน:  cd s2-mcp/security && npm run test:governance
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs';
import path from 'node:path';

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`); }
};

// เรียก tool แล้วคืนข้อความ — ถ้า server ปฏิเสธ (zod/protocol error) คืน {error}
async function call(mcp, name, args) {
  try {
    const r = await mcp.callTool({ name, arguments: args });
    return { text: (r.content || []).map((c) => c.text || '').join('\n'), isError: r.isError === true };
  } catch (e) {
    return { error: e.message || String(e) };
  }
}

async function connect(script, env = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath, args: [script],
    env: { ...process.env, ...env },
    stderr: 'pipe',
  });
  const mcp = new Client({ name: 'governance-test', version: '1.0.0' });
  let stderr = '';
  await mcp.connect(transport);
  transport.stderr?.on('data', (c) => { stderr += c.toString(); });
  return { mcp, logs: () => stderr };
}

// ── 1) showcase — ประตู draft → confirm ──────────────────────────
console.log('\n▌1. showcase · draft ต้องไม่ execute เอง');
const PRODUCTS = path.join(import.meta.dirname, '../showcase/products.json');
const before = fs.readFileSync(PRODUCTS, 'utf-8');
const shop = await connect(path.join(import.meta.dirname, '../showcase/server.mjs'));

let r = await call(shop.mcp, 'create_draft_order', { items: [{ sku: 'GB-001', qty: 2 }] });
t('draft คืนสถานะ "รออนุมัติ"', /รออนุมัติ/.test(r.text || ''), (r.text || r.error || '').slice(0, 120));
t('draft บอกชัดว่ายังไม่ตัดสต็อก/ไม่เก็บเงิน', /ไม่ตัดสต็อก|ไม่เรียกเก็บเงิน/.test(r.text || ''));
t('draft ขอให้เจ้าหน้าที่ยืนยันก่อน', /ยืนยัน/.test(r.text || ''));

r = await call(shop.mcp, 'create_draft_order', { items: [{ sku: 'GB-999', qty: 1 }] });
t('sku ไม่มีจริง → ปฏิเสธ', /ไม่พบสินค้า/.test(r.text || ''), (r.text || '').slice(0, 80));

r = await call(shop.mcp, 'create_draft_order', { items: [{ sku: 'GB-001', qty: 99999 }] });
t('สั่งเกินสต็อก → ปฏิเสธ', /สต็อกไม่พอ/.test(r.text || ''), (r.text || '').slice(0, 80));

r = await call(shop.mcp, 'create_draft_order', { items: [{ sku: 'GB-004', qty: 1 }] });
t('สินค้าที่หมด (GB-004 stock 0) → ปฏิเสธ', /สต็อกไม่พอ/.test(r.text || ''), (r.text || '').slice(0, 80));

console.log('\n▌2. showcase · validation ต้องกัน input พิลึก (zod)');
for (const [label, args] of [
  ['จำนวนเป็น 0', { items: [{ sku: 'GB-001', qty: 0 }] }],
  ['จำนวนติดลบ', { items: [{ sku: 'GB-001', qty: -5 }] }],
  ['จำนวนเป็นทศนิยม', { items: [{ sku: 'GB-001', qty: 1.5 }] }],
  ['รายการว่าง', { items: [] }],
  ['ไม่ส่ง items มาเลย', {}],
]) {
  const res = await call(shop.mcp, 'create_draft_order', args);
  // ต้องถูกปฏิเสธ "อย่างชัดเจน" (validation error) ไม่ใช่แค่บังเอิญไม่มีคำว่าร่างคำสั่งซื้อ
  // — เช็คแบบหลวมกว่านี้จะกลายเป็นเทสต์ที่ผ่านเองแม้ validation หลุด
  const rejected = Boolean(res.error) || /validation error|-32602/i.test(res.text || '');
  t(label + ' → ถูกปฏิเสธด้วย validation', rejected && !/ร่างคำสั่งซื้อ/.test(res.text || ''), (res.text || res.error || '').slice(0, 100));
}

console.log('\n▌3. showcase · ไฟล์ข้อมูลต้องไม่ถูกแก้');
r = await call(shop.mcp, 'confirm_order', { items: [{ sku: 'GB-001', qty: 1 }] });
t('confirm_order คืนเลขออเดอร์', /ORD-/.test(r.text || ''), (r.text || '').slice(0, 80));
t('products.json ไม่ถูกแก้หลัง draft+confirm (demo ไม่ตัดสต็อกจริง)', fs.readFileSync(PRODUCTS, 'utf-8') === before);
await shop.mcp.close();

// ── 4) guarded-server — kill switch / readonly / audit ───────────
const GUARDED = path.join(import.meta.dirname, 'guarded-server.mjs');

console.log('\n▌4. guarded · โหมดปกติ');
let g = await connect(GUARDED, { MCP_ACTOR: 'governance-test' });
r = await call(g.mcp, 'place_order', { sku: 'GB-001', qty: 1 });
t('place_order คืน "รออนุมัติ" ไม่ execute เอง', /รออนุมัติ|ยืนยัน/.test(r.text || ''), (r.text || '').slice(0, 100));
await new Promise((res) => setTimeout(res, 150));
t('audit log ระบุ actor + verdict=allowed', /actor=governance-test/.test(g.logs()) && /verdict=allowed/.test(g.logs()), g.logs().slice(-160));
await g.mcp.close();

console.log('\n▌5. guarded · READONLY=1 — ปิดเฉพาะ tool ที่เขียน');
g = await connect(GUARDED, { READONLY: '1', MCP_ACTOR: 'governance-test' });
r = await call(g.mcp, 'place_order', { sku: 'GB-001', qty: 1 });
t('place_order ถูกปฏิเสธ', /อ่านอย่างเดียว/.test(r.text || ''), (r.text || '').slice(0, 100));
r = await call(g.mcp, 'search_products', { query: 'ครีม' });
t('search_products (อ่านอย่างเดียว) ยังใช้ได้', !/⛔/.test(r.text || '') && Boolean(r.text), (r.text || '').slice(0, 80));
await new Promise((res) => setTimeout(res, 150));
t('audit log บันทึก verdict=blocked:readonly', /verdict=blocked:readonly/.test(g.logs()), g.logs().slice(-160));
await g.mcp.close();

console.log('\n▌6. guarded · kill switch รายตัว');
g = await connect(GUARDED, { DISABLED_TOOLS: 'place_order', MCP_ACTOR: 'governance-test' });
r = await call(g.mcp, 'place_order', { sku: 'GB-001', qty: 1 });
t('place_order ถูกปิด', /ถูกปิดใช้งาน/.test(r.text || ''), (r.text || '').slice(0, 100));
r = await call(g.mcp, 'search_products', { query: 'ครีม' });
t('tool อื่นไม่ได้รับผลกระทบ', !/⛔/.test(r.text || ''), (r.text || '').slice(0, 80));
await new Promise((res) => setTimeout(res, 150));
t('audit log บันทึก verdict=blocked:kill-switch', /verdict=blocked:kill-switch/.test(g.logs()), g.logs().slice(-160));
await g.mcp.close();

console.log(`\n═══ สรุป: ✅ ${pass} ผ่าน · ❌ ${fail} พัง ═══\n`);
process.exit(fail ? 1 : 0);
