/**
 * MCP Server Starter — Advanced MCP Workshop (HarmonyX)
 * Lab 1: server เปิดข้อมูลสินค้าให้ AI เรียกผ่าน 3 tools (transport: stdio)
 *
 * รัน:      npm install && npm start
 * ทดสอบ:   npm run inspect   (เปิด MCP Inspector)
 * เชื่อม Claude Desktop: ดู README.md
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'node:fs';

const products = JSON.parse(fs.readFileSync(new URL('./products.json', import.meta.url), 'utf-8'));

// ── Governance ในโค้ด: audit log ทุก tool call (สไลด์ 13) ──
function audit(tool, args) {
  console.error(`[AUDIT] ${new Date().toISOString()} tool=${tool} args=${JSON.stringify(args)}`);
}

const server = new McpServer({ name: 'glow-beauty-products', version: '1.0.0' });

// Tool 1 — ค้นหาสินค้า
server.registerTool('search_products', {
  description:
    'ค้นหาสินค้าของร้าน Glow Beauty จากคำค้น (ชื่อ, ประเภทผิว, จุดเด่น) ' +
    'ใช้เมื่อลูกค้าหรือทีมงานถามหาสินค้า เช่น "ครีมกันแดดสำหรับผิวมัน"',
  inputSchema: { query: z.string().describe('คำค้นภาษาไทยหรืออังกฤษ') },
}, async ({ query }) => {
  audit('search_products', { query });
  const q = query.toLowerCase();
  const hits = products.products.filter(p =>
    [p.name, p.suitable_for, p.highlight].join(' ').toLowerCase().includes(q));
  return { content: [{ type: 'text', text: hits.length
    ? hits.map(p => `${p.sku} · ${p.name} · ${p.price_thb} บาท · เหมาะกับ: ${p.suitable_for}`).join('\n')
    : 'ไม่พบสินค้าที่ตรงกับคำค้นนี้' }] };
});

// Tool 2 — ตรวจสอบสต็อก
server.registerTool('check_stock', {
  description:
    'ตรวจสอบจำนวนสต็อกคงเหลือของสินค้าจากรหัส SKU (เช่น GB-001) ' +
    'ใช้เมื่อต้องการทราบว่าสินค้ามีของหรือไม่ เหลือกี่ชิ้น',
  inputSchema: { sku: z.string().describe('รหัสสินค้า เช่น GB-001') },
}, async ({ sku }) => {
  audit('check_stock', { sku });
  const p = products.products.find(x => x.sku === sku.toUpperCase());
  return { content: [{ type: 'text', text: p
    ? `${p.name}: คงเหลือ ${p.stock} ชิ้น${p.stock === 0 ? ' (สินค้าหมด)' : ''}`
    : `ไม่พบสินค้า SKU ${sku}` }] };
});

// Tool 3 — โปรโมชันปัจจุบัน
server.registerTool('get_promotions', {
  description: 'ดูรายการโปรโมชันที่ใช้ได้ในขณะนี้ พร้อมเงื่อนไข ใช้เมื่อถูกถามเรื่องส่วนลดหรือข้อเสนอ',
  inputSchema: {},
}, async () => {
  audit('get_promotions', {});
  return { content: [{ type: 'text',
    text: products.promotions.map(p => `${p.name}: ${p.detail}`).join('\n') + `\nการจัดส่ง: ${products.shipping}` }] };
});

// ── Challenge (Lab 1 Step 4): เพิ่ม tool ของท่านเองที่นี่ เช่น get_bestsellers ──

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('✅ MCP server "glow-beauty-products" พร้อมใช้งาน (stdio)');
