/**
 * restock-notify.mjs — แจ้งเตือนลูกค้าที่สนใจสินค้าที่ "เคยหมด" เมื่อของกลับมา (proactive)
 * อ่าน data/restock-interest.json (ลูกค้าที่ bot เก็บไว้ตอนถามถึงของหมด) → push แจ้ง
 *
 *   พรีวิว:  node restock-notify.mjs GB-004
 *   ส่งจริง:  node restock-notify.mjs GB-004 --send
 *
 * ⚠️ ส่ง push จริง = กินโควตา + ต้องมี consent → default dry-run
 */
import 'dotenv/config';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { messagingApi } from '@line/bot-sdk';
const store = createRequire(import.meta.url)('./store.js');

const sku = (process.argv[2] || '').toUpperCase();
const SEND = process.argv.includes('--send');
if (!sku) { console.error('ใช้: node restock-notify.mjs <SKU> [--send]  เช่น GB-004'); process.exit(1); }

const products = JSON.parse(fs.readFileSync(new URL('../../s2-mcp/showcase/products.json', import.meta.url), 'utf-8'));
const p = products.products.find((x) => x.sku === sku);
if (!p) { console.error('ไม่พบสินค้า', sku); process.exit(1); }

const interested = (store.readRestock()[sku]) || [];
console.log(`สินค้า: ${p.name} · สต็อกตอนนี้: ${p.stock}`);
console.log(`ลูกค้าที่สนใจ (เก็บไว้ตอนถามถึงของหมด): ${interested.length} คน`);

if (interested.length === 0) { console.log('ยังไม่มีคนสนใจ — ลองให้ลูกค้าถามถึงสินค้าที่หมดใน LINE ก่อน'); process.exit(0); }

const message = { type: 'text', text: `🎉 ข่าวดีค่ะ! "${p.name}" กลับมาแล้ว (${p.price_thb} บาท) — สนใจสั่งเลยไหมคะ? พิมพ์ "ขอสั่ง ${p.sku}" ได้เลยค่ะ` };

if (!SEND) {
  console.log('\n── DRY-RUN (ไม่ส่งจริง) ──');
  console.log('จะ push ถึง', interested.length, 'คน · ข้อความ:', message.text);
  console.log('\n👉 ส่งจริง: node restock-notify.mjs', sku, '--send');
  process.exit(0);
}

if (p.stock === 0) { console.error('❌ สินค้ายังหมดอยู่ (stock 0) — ยังไม่ควรแจ้งว่าเข้าแล้ว'); process.exit(1); }
const api = new messagingApi.MessagingApiClient({ channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN });
await api.multicast({ to: interested, messages: [message] });
console.log(`✅ แจ้งเตือนแล้ว ${interested.length} คน`);
