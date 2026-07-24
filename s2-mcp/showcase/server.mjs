/**
 * MCP Showcase Server — "MCP in the Real World" (HarmonyX · Advanced MCP)
 * ต่อยอดจาก Lab MCP-1: โชว์ MCP แบบใช้จริงในธุรกิจ e-commerce ครบทั้ง 3 primitives
 *
 *   TOOLS      — 4 pattern โลกจริง: personalization / เชื่อมระบบ / action มี governance / analytics
 *   RESOURCE   — เอกสารนโยบายร้าน (AI ดึงอ่านเองได้)
 *   PROMPT     — เทมเพลตตอบ after-sales (มาตรฐานเดียวทั้งทีม)
 *
 * รัน:      npm install && npm start
 * ทดสอบ:   npm run inspect   (เปิด MCP Inspector — ดูครบทั้ง tools/resources/prompts)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'node:fs';

const products = JSON.parse(fs.readFileSync(new URL('./products.json', import.meta.url), 'utf-8'));
const orders = JSON.parse(fs.readFileSync(new URL('./orders.json', import.meta.url), 'utf-8'));

// ── Governance ในโค้ด: audit log ทุก tool call (สไลด์ 13) ──
function audit(tool, args) {
  console.error(`[AUDIT] ${new Date().toISOString()} tool=${tool} args=${JSON.stringify(args)}`);
}

const server = new McpServer({ name: 'glow-beauty-showcase', version: '1.0.0' });

// ══════════════════════════════════════════════════════════════════
//  TOOLS — 4 pattern ที่เจอจริงในระบบ production
// ══════════════════════════════════════════════════════════════════

// Pattern 1 · Personalization — แนะนำสินค้าตามสภาพผิว (เครื่องมือแนะนำสินค้า)
server.registerTool('recommend_for_skin', {
  description:
    'แนะนำสินค้าที่เหมาะกับสภาพผิวของลูกค้า ใช้เมื่อลูกค้าบอกปัญหาผิวหรือถามว่า ' +
    '"ผิวแบบนี้ใช้ตัวไหนดี" เช่น ผิวมัน ผิวแห้ง ผิวแพ้ง่าย ผิวหมองคล้ำ',
  inputSchema: {
    skin_type: z.enum(['ผิวมัน', 'ผิวแห้ง', 'ผิวผสม', 'ผิวแพ้ง่าย', 'ผิวหมองคล้ำ'])
      .describe('สภาพผิวของลูกค้า'),
  },
}, async ({ skin_type }) => {
  audit('recommend_for_skin', { skin_type });
  const q = skin_type.replace('ผิว', '');
  const hits = products.products
    .filter((p) => p.stock > 0 && (p.suitable_for.includes(q) || p.suitable_for.includes('ทุกสภาพผิว')));
  return { content: [{ type: 'text', text: hits.length
    ? `แนะนำสำหรับ${skin_type}:\n` + hits.map((p) =>
        `• ${p.sku} · ${p.name} · ${p.price_thb} บาท\n  เหตุผล: ${p.highlight} (เหมาะกับ ${p.suitable_for})`).join('\n')
    : `ยังไม่มีสินค้าพร้อมส่งที่ตรงกับ${skin_type} — เดี๋ยวให้เจ้าหน้าที่แนะนำเพิ่มเติมนะคะ` }] };
});

// Pattern 2 · System integration — เช็คสถานะออเดอร์จากระบบหลังบ้าน (อ่านจาก orders.json แทน DB/API จริง)
server.registerTool('track_order', {
  description:
    'ตรวจสอบสถานะและเลขพัสดุของคำสั่งซื้อจากเลขออเดอร์ (เช่น ORD-1001) ' +
    'ใช้เมื่อลูกค้าถามว่า "ของถึงไหนแล้ว" หรือขอเลขติดตามพัสดุ',
  inputSchema: { order_id: z.string().describe('เลขออเดอร์ เช่น ORD-1001') },
}, async ({ order_id }) => {
  audit('track_order', { order_id });
  const o = orders.orders.find((x) => x.order_id === order_id.toUpperCase());
  if (!o) return { content: [{ type: 'text', text: `ไม่พบออเดอร์ ${order_id} — กรุณาตรวจเลขออเดอร์อีกครั้ง หรือพิมพ์ "ติดต่อเจ้าหน้าที่"` }] };
  const track = o.tracking_no ? `\nเลขพัสดุ: ${o.tracking_no} (${o.carrier})` : '';
  return { content: [{ type: 'text',
    text: `ออเดอร์ ${o.order_id} (${o.customer})\nสถานะ: ${o.status}${track}\nกำหนด: ${o.eta}` }] };
});

// Pattern 3 · Governed action — สร้าง "ร่างออเดอร์" ไม่ execute จริง (human-in-the-loop สไลด์ governance)
// action tool ต้องคืนสถานะ "รออนุมัติ" ให้มนุษย์ยืนยันก่อน ไม่ตัดสต็อก/ตัดเงินเอง
server.registerTool('create_draft_order', {
  description:
    'สร้างร่างคำสั่งซื้อ (draft) จากรายการสินค้าที่ลูกค้าต้องการ คำนวณยอดรวม ค่าส่ง และส่วนลดที่ใช้ได้ ' +
    'ใช้เมื่อลูกค้าตกลงจะซื้อ — ระบบจะยังไม่ตัดสต็อกหรือเรียกเก็บเงิน แต่คืนร่างให้เจ้าหน้าที่ยืนยันก่อน',
  inputSchema: {
    items: z.array(z.object({
      sku: z.string().describe('รหัสสินค้า เช่น GB-001'),
      qty: z.number().int().positive().describe('จำนวน'),
    })).min(1).describe('รายการสินค้าที่จะสั่ง'),
  },
}, async ({ items }) => {
  audit('create_draft_order', { items });
  const lines = [];
  let subtotal = 0;
  let sunscreenQty = 0;
  for (const it of items) {
    const p = products.products.find((x) => x.sku === it.sku.toUpperCase());
    if (!p) return { content: [{ type: 'text', text: `❌ ไม่พบสินค้า ${it.sku} — ยกเลิกร่างออเดอร์` }] };
    if (p.stock < it.qty) return { content: [{ type: 'text', text: `❌ ${p.name} มีสต็อกไม่พอ (เหลือ ${p.stock}, ขอ ${it.qty}) — เดี๋ยวให้เจ้าหน้าที่ช่วยดู` }] };
    const amount = p.price_thb * it.qty;
    subtotal += amount;
    if (p.name.includes('กันแดด')) sunscreenQty += it.qty;
    lines.push(`  • ${p.name} × ${it.qty} = ${amount} บาท`);
  }
  // เงื่อนไขโปร/ค่าส่ง คำนวณจากข้อมูลจริง — ไม่ hardcode
  const promoNote = sunscreenQty >= 2 ? '  ✓ เข้าเงื่อนไขโปรหน้าฝน (ครีมกันแดด 2 ชิ้น ลด 15%)' : '';
  const shipping = subtotal >= 600 ? 'ส่งฟรี (ครบ 600 บาท)' : 'ค่าส่งตามจริง (ยังไม่ครบ 600 บาท)';
  return { content: [{ type: 'text', text:
    `📝 ร่างคำสั่งซื้อ (สถานะ: รออนุมัติ — ยังไม่ตัดสต็อก/ไม่เรียกเก็บเงิน)\n` +
    lines.join('\n') +
    `\n  ยอดรวม: ${subtotal} บาท\n  จัดส่ง: ${shipping}` +
    (promoNote ? `\n${promoNote}` : '') +
    `\n\n⚠️ กรุณาให้เจ้าหน้าที่ยืนยันก่อนดำเนินการจริง` }] };
});

// Pattern 4 · Analytics — สินค้าใกล้หมด/มาแรง 3 อันดับ (โจทย์ challenge Lab MCP-1)
server.registerTool('get_bestsellers', {
  description:
    'ดูสินค้าที่ "มาแรง/ใกล้หมด" 3 อันดับแรก (สต็อกเหลือน้อยสุด) พร้อมราคา ' +
    'ใช้เมื่อทีมงานอยากรู้ว่าควรเติมสต็อกตัวไหนก่อน หรือลูกค้าถามว่าตัวไหนขายดี',
  inputSchema: {},
}, async () => {
  audit('get_bestsellers', {});
  const ranked = products.products
    .filter((p) => p.stock > 0)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 3);
  return { content: [{ type: 'text',
    text: 'สินค้ามาแรง/ใกล้หมด 3 อันดับ (สต็อกน้อยสุด):\n' +
      ranked.map((p, i) => `${i + 1}. ${p.sku} · ${p.name} · ${p.price_thb} บาท · เหลือ ${p.stock} ชิ้น`).join('\n') }] };
});

// ══════════════════════════════════════════════════════════════════
//  RESOURCE — เอกสารนโยบายร้าน (AI ดึงอ่านเองเมื่อต้องอ้างอิงเงื่อนไข)
// ══════════════════════════════════════════════════════════════════
server.registerResource(
  'store-policy',
  'store://policy',
  { title: 'นโยบายร้าน Glow Beauty', description: 'เงื่อนไขจัดส่ง คืนสินค้า และการรับประกัน', mimeType: 'text/plain' },
  async (uri) => {
    audit('resource:store-policy', { uri: uri.href });
    return { contents: [{ uri: uri.href, mimeType: 'text/plain', text:
      `นโยบายร้าน ${products.shop_name}\n` +
      `การจัดส่ง: ${products.shipping}\n` +
      `การคืนสินค้า: คืนได้ภายใน 7 วันหากสินค้าไม่ถูกเปิดใช้ (เฉพาะกรณีสินค้าชำรุด/ส่งผิด)\n` +
      `การรับประกัน: สินค้าหมดอายุ/ชำรุดจากการผลิต เปลี่ยนใหม่ฟรี\n` +
      `ติดต่อ: ${products.human_contact}` }] };
  },
);

// ══════════════════════════════════════════════════════════════════
//  PROMPT — เทมเพลตตอบ after-sales ให้ทั้งทีมตอบมาตรฐานเดียว
// ══════════════════════════════════════════════════════════════════
server.registerPrompt(
  'after_sales_reply',
  {
    title: 'ร่างข้อความตอบหลังการขาย',
    description: 'สร้างข้อความตอบลูกค้าเรื่องหลังการขาย (ของยังไม่ถึง/ขอคืนสินค้า/สอบถามการใช้งาน)',
    argsSchema: {
      order_id: z.string().describe('เลขออเดอร์ เช่น ORD-1001'),
      issue: z.string().describe('ปัญหาที่ลูกค้าแจ้ง เช่น "ของยังไม่ถึง"'),
    },
  },
  ({ order_id, issue }) => {
    audit('prompt:after_sales_reply', { order_id, issue });
    return { messages: [{ role: 'user', content: { type: 'text', text:
      `ช่วยร่างข้อความตอบลูกค้าอย่างสุภาพ กระชับ เป็นภาษาไทย สำหรับกรณีหลังการขาย\n` +
      `- ออเดอร์: ${order_id}\n- ปัญหา: ${issue}\n\n` +
      `ให้ตรวจสถานะออเดอร์ด้วย tool track_order ก่อน แล้วอ้างอิงข้อมูลจริง ` +
      `ถ้าเกินขอบเขตที่ตอบได้ ให้แจ้งช่องทางติดต่อเจ้าหน้าที่` } }] };
  },
);

// ══════════════════════════════════════════════════════════════════
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('✅ MCP showcase "glow-beauty-showcase" พร้อมใช้งาน (4 tools + 1 resource + 1 prompt · stdio)');
