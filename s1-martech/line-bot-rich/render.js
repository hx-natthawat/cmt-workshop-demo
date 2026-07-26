/**
 * render.js — Presentation layer: (ข้อความ + tool ที่ถูกเรียก) → LINE messages
 *
 * แยกออกจาก app.js เพื่อให้ "ซ้อมได้โดยไม่ต้องมี LINE"
 * → rehearse.js เรียกฟังก์ชันนี้ตรงๆ แล้วตรวจ Flex ก่อนวันงาน
 *
 * กติกา: เราคุม Flex เองทั้งหมด (ไม่ให้โมเดลเขียน JSON) — โมเดลเลือกได้แค่ "เรียก tool ไหน"
 */
const fs = require('node:fs');
const path = require('node:path');
const flex = require('./flex');
const store = require('./store');

// สินค้าที่หมด (stock 0) — ใช้เก็บ restock interest
const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../../s2-mcp/showcase/products.json'), 'utf-8'));
const soldOut = products.products.filter((p) => p.stock === 0).map((p) => ({
  sku: p.sku,
  name: p.name,
  base: p.name.replace(/\s*\d+\s*\w*\s*$/, '').trim(), // ตัดขนาดท้ายชื่อ: "โฟมล้างหน้าใยไหม 100g" → "โฟมล้างหน้าใยไหม"
}));

const MIN_KW = 4; // สั้นกว่านี้เสี่ยง false positive

/**
 * หาว่าข้อความลูกค้าพูดถึงสินค้าที่หมดตัวไหน
 *
 * ⚠️ ภาษาไทยไม่เว้นวรรคระหว่างคำ → ตัดคำด้วย split(' ') ไม่ได้
 * ลูกค้าพิมพ์ "โฟมล้างหน้า" แต่ชื่อเต็มคือ "โฟมล้างหน้าใยไหม" — ต้องไล่ prefix จากยาวไปสั้น
 * (เทียบเท่าการตัดคำแบบหยาบ โดยไม่ต้องพึ่ง dictionary ภาษาไทย)
 */
function matchSoldOut(text) {
  const t = (text || '').toLowerCase();
  for (const s of soldOut) {
    if (t.includes(s.sku.toLowerCase())) return s.sku; // ลูกค้าพิมพ์รหัสสินค้ามาตรงๆ
    const chars = [...s.base];
    for (let n = chars.length; n >= MIN_KW; n--) {
      if (t.includes(chars.slice(0, n).join(''))) return s.sku;
    }
  }
  return null;
}

// ── Renderer: tool ที่ถูกเรียกล่าสุด เป็นตัวตัดสินว่าจะแสดงอะไร ──
function render({ text, toolCalls }) {
  const last = (n) => [...toolCalls].reverse().find((c) => c.name === n);
  const textMsg = { type: 'text', text };
  const draft = last('create_draft_order');
  if (draft && draft.input.items) {
    const summary = flex.orderSummary(draft.input.items);
    if (summary) return [textMsg, flex.orderConfirmBubble(draft.input.items, summary)];
  }
  const rec = last('recommend_for_skin') || last('get_bestsellers');
  if (rec) {
    const carousel = flex.productCarousel(flex.skusFromText(rec.resultText));
    if (carousel) return [textMsg, carousel];
  }
  if (last('get_promotions')) return [textMsg, flex.promotionCarousel()];
  return [{ ...textMsg, quickReply: flex.skinQuickReply }];
}

// เก็บ restock interest ถ้าลูกค้าถามถึงสินค้าที่หมด
function captureRestock(text, userId) {
  const sku = matchSoldOut(text);
  if (sku) store.addRestockInterest(sku, userId);
  return sku;
}

module.exports = { render, captureRestock, matchSoldOut, soldOut };
