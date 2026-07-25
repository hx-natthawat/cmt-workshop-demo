/**
 * analytics-server.mjs — MCP server ตัวที่ 2 (ฝั่งวิเคราะห์ยอดขาย)
 * แยกจาก showcase (ฝั่งสินค้า/ออเดอร์) โดยตั้งใจ — เพื่อสาธิต multi-server orchestration
 *
 * โลกจริง: องค์กรมี MCP หลายตัวคนละระบบ (สินค้า · การขาย · CRM · โลจิสติกส์)
 * AI ต้องเรียก "ข้าม server" ต่อกันเองในคำสั่งเดียว = บันได Enterprise ขั้นที่ 4 ในสไลด์
 *
 * ข้อมูลจริงจาก s1-martech/customer_data.csv (300 ราย)
 * รัน:  node analytics-server.mjs   ·  ทดสอบ: npm run inspect:analytics
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'node:fs';

// ── โหลด + แปลง CSV (รองรับ CRLF) ──
const rows = fs.readFileSync(new URL('../../s1-martech/customer_data.csv', import.meta.url), 'utf-8')
  .split(/\r?\n/).filter(Boolean);
const head = rows[0].replace(/^﻿/, '').split(',');
const col = (k) => head.indexOf(k);
const DATA = rows.slice(1).map((line) => {
  const c = line.split(',');
  return {
    channel: c[col('main_channel')], category: c[col('favorite_category')],
    recency: +c[col('recency_days')], orders: +c[col('total_orders')],
    spend: +c[col('total_spend_thb')], line_oa: c[col('line_oa_member')],
  };
});

function audit(tool, args) {
  console.error(`[AUDIT:analytics] ${new Date().toISOString()} tool=${tool} args=${JSON.stringify(args)}`);
}
const baht = (n) => Math.round(n).toLocaleString('th-TH');

// จัดกลุ่มตาม key แล้วสรุปยอด
function groupBy(key) {
  const g = {};
  for (const r of DATA) {
    const k = r[key];
    (g[k] = g[k] || { n: 0, spend: 0 });
    g[k].n++; g[k].spend += r.spend;
  }
  return Object.entries(g).map(([name, v]) => ({ name, ...v, avg: v.spend / v.n }))
    .sort((a, b) => b.spend - a.spend);
}

const server = new McpServer({ name: 'glow-analytics', version: '1.0.0' });

// ── Tool 1: ยอดขายตามช่องทาง ──
server.registerTool('sales_by_channel', {
  description:
    'สรุปยอดขายรวมแยกตามช่องทางการขาย (Shopee, Lazada, TikTok Shop, Website, LINE OA) ' +
    'พร้อมจำนวนลูกค้าและยอดเฉลี่ยต่อราย ใช้เมื่อถามว่าช่องทางไหนทำยอดได้เท่าไร',
  inputSchema: {},
}, async () => {
  audit('sales_by_channel', {});
  const list = groupBy('channel');
  return { content: [{ type: 'text', text:
    'ยอดขายตามช่องทาง (ลูกค้า 300 ราย):\n' +
    list.map((c, i) => `${i + 1}. ${c.name}: ${baht(c.spend)} บาท · ${c.n} ราย · เฉลี่ย ${baht(c.avg)}/ราย`).join('\n') }] };
});

// ── Tool 2: ยอดขายตามหมวดสินค้า ──
server.registerTool('sales_by_category', {
  description:
    'สรุปยอดขายรวมแยกตามหมวดสินค้า (Skincare, Makeup, Haircare, Supplements, Fragrance) ' +
    'ใช้เมื่อถามว่าหมวดไหนขายดี หรือควรเน้นสต็อกหมวดใด',
  inputSchema: {},
}, async () => {
  audit('sales_by_category', {});
  const list = groupBy('category');
  return { content: [{ type: 'text', text:
    'ยอดขายตามหมวดสินค้า:\n' +
    list.map((c, i) => `${i + 1}. ${c.name}: ${baht(c.spend)} บาท · ${c.n} ราย · เฉลี่ย ${baht(c.avg)}/ราย`).join('\n') }] };
});

// ── Tool 3: หาจุดที่น่ากังวล (ช่องทางที่ลูกค้าห่างหายมากสุด) ──
server.registerTool('find_at_risk_channel', {
  description:
    'วิเคราะห์หาช่องทางที่น่ากังวลที่สุด โดยดูสัดส่วนลูกค้าที่ไม่ได้ซื้อนานเกิน 180 วัน (หลับไหล) ' +
    'ใช้เมื่อถามว่า "ยอดตกเพราะอะไร" หรือ "ช่องทางไหนมีปัญหา"',
  inputSchema: {},
}, async () => {
  audit('find_at_risk_channel', {});
  const g = {};
  for (const r of DATA) {
    (g[r.channel] = g[r.channel] || { n: 0, dormant: 0, lost: 0 });
    g[r.channel].n++;
    if (r.recency > 180) { g[r.channel].dormant++; g[r.channel].lost += r.spend; }
  }
  const list = Object.entries(g)
    .map(([name, v]) => ({ name, ...v, pct: (v.dormant / v.n) * 100 }))
    .sort((a, b) => b.pct - a.pct);
  const worst = list[0];
  return { content: [{ type: 'text', text:
    'ช่องทางเรียงตามสัดส่วนลูกค้าหลับไหล (ไม่ซื้อเกิน 180 วัน):\n' +
    list.map((c) => `• ${c.name}: ${c.pct.toFixed(1)}% (${c.dormant}/${c.n} ราย · มูลค่าที่เสี่ยงเสีย ${baht(c.lost)} บาท)`).join('\n') +
    `\n\n⚠️ น่ากังวลสุด: ${worst.name} — ลูกค้า ${worst.pct.toFixed(1)}% หายไปนานแล้ว` }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('📊 analytics-server พร้อม (3 tools · ข้อมูลจริงจาก customer_data.csv 300 ราย)');
