/**
 * guarded-server.mjs — MCP server ที่ใส่ "5 การป้องกัน" ตามสไลด์ Secure
 * เทียบกับ poisoned-server.mjs (ตัวร้าย) — อันนี้คือแบบที่ควรเขียนใน production
 *
 *   1. Least privilege  — ประกาศเฉพาะ tools ที่จำเป็น + แยกโหมด read/write
 *   2. Audit log        — ทุก tool call บันทึก ใคร/อะไร/เมื่อไหร่/พารามิเตอร์
 *   3. Approval gate    — tool ฝั่ง action คืน "รออนุมัติ" ไม่ execute ตรง
 *   4. Kill switch      — ปิด tool รายตัวได้ทันทีด้วย env ไม่ต้อง deploy ใหม่
 *   5. Clean descriptions — คำอธิบายบอกหน้าที่อย่างเดียว ไม่มีคำสั่งฝัง (ผ่าน scan-tools.mjs)
 *
 * รัน:
 *   node guarded-server.mjs                          # โหมดปกติ
 *   READONLY=1 node guarded-server.mjs               # ปิดทุก tool ที่เขียนข้อมูล
 *   DISABLED_TOOLS=place_order node guarded-server.mjs   # kill switch รายตัว
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'node:fs';

const products = JSON.parse(fs.readFileSync(new URL('../showcase/products.json', import.meta.url), 'utf-8'));

// ── (4) Kill switch + (1) READONLY mode ──
const DISABLED = new Set((process.env.DISABLED_TOOLS || '').split(',').map((s) => s.trim()).filter(Boolean));
const READONLY = process.env.READONLY === '1';

// ── (2) Audit log — มี actor + ผลลัพธ์ ให้ตรวจย้อนหลังได้ ──
const ACTOR = process.env.MCP_ACTOR || 'unknown-client';
function audit(tool, args, verdict) {
  console.error(`[AUDIT] ${new Date().toISOString()} actor=${ACTOR} tool=${tool} verdict=${verdict} args=${JSON.stringify(args)}`);
}

const server = new McpServer({ name: 'glow-guarded', version: '1.0.0' });

// helper: ห่อ handler ด้วยด่านตรวจ (kill switch → readonly → audit)
function guard(name, { write = false } = {}, handler) {
  return async (args) => {
    if (DISABLED.has(name)) {
      audit(name, args, 'blocked:kill-switch');
      return { content: [{ type: 'text', text: `⛔ tool "${name}" ถูกปิดใช้งานชั่วคราวโดยผู้ดูแลระบบ` }] };
    }
    if (write && READONLY) {
      audit(name, args, 'blocked:readonly');
      return { content: [{ type: 'text', text: `⛔ ระบบอยู่ในโหมดอ่านอย่างเดียว — "${name}" ใช้ไม่ได้ตอนนี้` }] };
    }
    audit(name, args, 'allowed');
    return handler(args);
  };
}

// ── READ tool — คำอธิบายสะอาด บอกหน้าที่อย่างเดียว (5) ──
server.registerTool('search_products', {
  description: 'ค้นหาสินค้าของร้าน Glow Beauty จากคำค้น (ชื่อ ประเภทผิว จุดเด่น) ใช้เมื่อลูกค้าถามหาสินค้า',
  inputSchema: { query: z.string().describe('คำค้นภาษาไทยหรืออังกฤษ') },
}, guard('search_products', {}, async ({ query }) => {
  const q = query.toLowerCase();
  const hits = products.products.filter((p) => [p.name, p.suitable_for, p.highlight].join(' ').toLowerCase().includes(q));
  return { content: [{ type: 'text', text: hits.length
    ? hits.map((p) => `${p.sku} · ${p.name} · ${p.price_thb} บาท`).join('\n') : 'ไม่พบสินค้าที่ตรงกับคำค้นนี้' }] };
}));

// ── WRITE tool — (3) approval gate: คืน "รออนุมัติ" ไม่ตัดสต็อก/ไม่เก็บเงิน ──
server.registerTool('place_order', {
  description: 'สร้างคำขอสั่งซื้อสินค้า ใช้เมื่อลูกค้าตกลงซื้อ — ระบบจะคืนสถานะรออนุมัติเพื่อให้เจ้าหน้าที่ยืนยันก่อนเสมอ',
  inputSchema: {
    sku: z.string().describe('รหัสสินค้า เช่น GB-001'),
    qty: z.number().int().positive().max(20).describe('จำนวน (สูงสุด 20)'),
  },
}, guard('place_order', { write: true }, async ({ sku, qty }) => {
  const p = products.products.find((x) => x.sku === sku.toUpperCase());
  if (!p) return { content: [{ type: 'text', text: `ไม่พบสินค้า ${sku}` }] };
  if (p.stock < qty) return { content: [{ type: 'text', text: `${p.name} สต็อกไม่พอ (เหลือ ${p.stock})` }] };
  return { content: [{ type: 'text', text:
    `📝 คำขอสั่งซื้อ (สถานะ: รออนุมัติ — ยังไม่ตัดสต็อก/ไม่เรียกเก็บเงิน)\n` +
    `${p.name} × ${qty} = ${p.price_thb * qty} บาท\n⚠️ ต้องให้เจ้าหน้าที่ยืนยันก่อนดำเนินการจริง` }] };
}));

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`🛡️  guarded-server พร้อม · readonly=${READONLY} · ปิดอยู่=[${[...DISABLED].join(',') || 'ไม่มี'}] · actor=${ACTOR}`);
