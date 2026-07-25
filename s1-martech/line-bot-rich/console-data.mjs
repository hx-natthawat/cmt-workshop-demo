/**
 * console-data.mjs — ชั้นข้อมูลรวมสำหรับ Marketing Console
 * รวม logic: VoC (store), RFM segments (CSV), restock interest, products/promotions
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const store = createRequire(import.meta.url)('./store.js');

const products = JSON.parse(fs.readFileSync(new URL('../../s2-mcp/showcase/products.json', import.meta.url), 'utf-8'));

// ── VoC ──
export function vocSummary() {
  const logs = store.readVoc();
  const byChannel = {}; const toolCount = {}; const users = new Set();
  for (const r of logs) {
    users.add(r.user); byChannel[r.channel] = (byChannel[r.channel] || 0) + 1;
    for (const t of r.tools || []) toolCount[t] = (toolCount[t] || 0) + 1;
  }
  const interest = (toolCount.recommend_for_skin || 0) + (toolCount.get_bestsellers || 0);
  const draft = toolCount.create_draft_order || 0;
  const confirm = toolCount.confirm_order || 0;
  return {
    total: logs.length, users: users.size, byChannel,
    topTools: Object.entries(toolCount).sort((a, b) => b[1] - a[1]),
    funnel: [
      { label: 'สนใจสินค้า', hint: 'recommend / bestsellers', n: interest },
      { label: 'ร่างออเดอร์', hint: 'create_draft_order', n: draft },
      { label: 'ยืนยันซื้อ', hint: 'confirm_order', n: confirm },
    ],
    convRate: interest ? Math.round((confirm / interest) * 100) : 0,
    recent: logs.slice(-25).reverse(),
  };
}

// ── RFM Segments (จาก customer_data.csv) ──
const SEG_MSG = {
  'แชมป์ตัวจริง': '💎 สิทธิพิเศษ VIP — ลด 20% + ของแถมพิเศษ',
  'ขาประจำ': '💚 ขอบคุณที่อุดหนุน — ลด 15% ออเดอร์ถัดไป',
  'หน้าใหม่': '👋 ยินดีต้อนรับ — โค้ด NEW50 ลด 50 บาท',
  'เสี่ยงหลุด': '🌟 คิดถึงคุณ — ลด 15% + ส่งฟรี',
  'หลับไหล': '💌 ไม่ได้เจอกันนาน — ลดพิเศษ 25%',
};
export function segments() {
  const rows = fs.readFileSync(new URL('../customer_data.csv', import.meta.url), 'utf-8').split(/\r?\n/).filter(Boolean);
  const h = rows[0].replace(/^﻿/, '').split(','); const i = (k) => h.indexOf(k);
  const data = rows.slice(1).map((l) => { const c = l.split(','); return {
    recency: +c[i('recency_days')], orders: +c[i('total_orders')], spend: +c[i('total_spend_thb')], line: c[i('line_oa_member')] }; });
  const seg = (r) => (r.recency <= 60 && r.orders >= 10) ? 'แชมป์ตัวจริง'
    : (r.recency <= 90 && r.orders >= 5) ? 'ขาประจำ'
    : (r.recency <= 60 && r.orders <= 2) ? 'หน้าใหม่'
    : (r.recency > 180) ? 'หลับไหล' : 'เสี่ยงหลุด';
  const g = {};
  for (const r of data) (g[seg(r)] = g[seg(r)] || []).push(r);
  return { total: data.length, list: Object.entries(g).sort((a, b) => b[1].length - a[1].length).map(([name, list]) => ({
    name, count: list.length, lineFlag: list.filter((r) => r.line === 'Yes').length,
    avgSpend: Math.round(list.reduce((s, r) => s + r.spend, 0) / list.length), msg: SEG_MSG[name] })) };
}

// ── Restock interest ──
export function restock() {
  const interest = store.readRestock();
  return products.products.filter((p) => p.stock === 0 || interest[p.sku]).map((p) => ({
    sku: p.sku, name: p.name, price: p.price_thb, stock: p.stock, interested: (interest[p.sku] || []).length }));
}

export function promotions() { return { intro: '🌧️ Glow Beauty มีโปรพิเศษมาฝากค่ะ! 👇', promos: products.promotions, shipping: products.shipping }; }
export { store };
