/**
 * flex.js — Presentation layer: แปลงข้อมูล/ผลลัพธ์ tool → LINE message (Flex / Quick Reply)
 * แยกจาก logic (MCP tools) อย่างชัดเจน — tool ให้ข้อมูล, ไฟล์นี้ตัดสินใจว่า render สวยยังไง
 */
const fs = require('node:fs');
const products = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../../s2-mcp/showcase/products.json'), 'utf-8'));

const BRAND = '#345589'; // โทนแบรนด์ (ตรง utm_builder + สไลด์)

const byline = (p) => `${p.price_thb.toLocaleString('th-TH')} บาท`;

// ── การ์ดสินค้า 1 ใบ (bubble) — ปุ่ม "สั่งเลย" ส่ง postback ให้ AI ทำต่อ ──
function productBubble(p, reason) {
  const soldOut = p.stock === 0;
  return {
    type: 'bubble', size: 'kilo',
    header: {
      type: 'box', layout: 'vertical', paddingAll: '12px',
      backgroundColor: soldOut ? '#9ca3af' : BRAND,
      contents: [{ type: 'text', text: p.sku, color: '#ffffff', size: 'xs' },
        { type: 'text', text: byline(p), color: '#ffffff', size: 'xl', weight: 'bold' }],
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'sm',
      contents: [
        { type: 'text', text: p.name, weight: 'bold', size: 'sm', wrap: true },
        { type: 'text', text: reason || p.highlight, size: 'xs', color: '#6b7280', wrap: true },
        { type: 'text', text: soldOut ? '⛔ สินค้าหมดชั่วคราว' : `คงเหลือ ${p.stock} ชิ้น`,
          size: 'xs', color: soldOut ? '#dc2626' : '#16a34a', margin: 'sm' },
      ],
    },
    footer: soldOut ? undefined : {
      type: 'box', layout: 'vertical',
      contents: [{
        type: 'button', style: 'primary', color: BRAND, height: 'sm',
        action: { type: 'postback', label: 'สั่งเลย',
          data: JSON.stringify({ a: 'buy', sku: p.sku }),
          displayText: `สั่ง ${p.name}` },
      }],
    },
  };
}

// ── carousel สินค้า จากรายการ SKU ──
function productCarousel(skus, reasonMap = {}) {
  const bubbles = skus
    .map((sku) => products.products.find((p) => p.sku === sku.toUpperCase()))
    .filter(Boolean)
    .map((p) => productBubble(p, reasonMap[p.sku]));
  if (!bubbles.length) return null;
  return { type: 'flex', altText: 'รายการสินค้าแนะนำ', contents: { type: 'carousel', contents: bubbles.slice(0, 10) } };
}

// ── carousel โปรโมชัน ──
function promotionCarousel() {
  const bubbles = products.promotions.map((promo) => ({
    type: 'bubble', size: 'kilo',
    header: { type: 'box', layout: 'vertical', backgroundColor: BRAND, paddingAll: '12px',
      contents: [{ type: 'text', text: '🎁 ' + promo.name, color: '#ffffff', weight: 'bold', wrap: true }] },
    body: { type: 'box', layout: 'vertical',
      contents: [{ type: 'text', text: promo.detail, size: 'sm', wrap: true, color: '#374151' }] },
  }));
  return { type: 'flex', altText: 'โปรโมชันปัจจุบัน', contents: { type: 'carousel', contents: bubbles } };
}

// ── การ์ดยืนยันออเดอร์ (governance) — ปุ่มยืนยัน/ยกเลิก ส่ง postback ──
// items: [{sku, qty}] · summary: object {subtotal, shipping, promo, lines:[...]}
function orderConfirmBubble(items, summary) {
  return {
    type: 'flex', altText: 'ยืนยันคำสั่งซื้อ',
    contents: {
      type: 'bubble',
      header: { type: 'box', layout: 'vertical', backgroundColor: BRAND, paddingAll: '14px',
        contents: [{ type: 'text', text: '📝 ยืนยันคำสั่งซื้อ', color: '#ffffff', weight: 'bold', size: 'md' },
          { type: 'text', text: 'สถานะ: รออนุมัติ (ยังไม่ตัดเงิน/สต็อก)', color: '#e5edf7', size: 'xxs' }] },
      body: { type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          ...summary.lines.map((l) => ({ type: 'box', layout: 'horizontal',
            contents: [{ type: 'text', text: l.name, size: 'xs', wrap: true, flex: 4, color: '#374151' },
              { type: 'text', text: `${l.amount.toLocaleString('th-TH')}฿`, size: 'xs', align: 'end', flex: 2 }] })),
          { type: 'separator', margin: 'md' },
          { type: 'box', layout: 'horizontal', margin: 'md',
            contents: [{ type: 'text', text: 'ยอดรวม', weight: 'bold', size: 'sm' },
              { type: 'text', text: `${summary.subtotal.toLocaleString('th-TH')} บาท`, weight: 'bold', size: 'sm', align: 'end' }] },
          { type: 'text', text: summary.shipping, size: 'xxs', color: '#6b7280' },
          ...(summary.promo ? [{ type: 'text', text: '✓ ' + summary.promo, size: 'xxs', color: '#16a34a', wrap: true }] : []),
        ] },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'button', style: 'primary', color: BRAND, height: 'sm',
            action: { type: 'postback', label: '✅ ยืนยันสั่งซื้อ',
              data: JSON.stringify({ a: 'confirm', items }), displayText: 'ยืนยันสั่งซื้อ' } },
          { type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'postback', label: 'ยกเลิก', data: JSON.stringify({ a: 'cancel' }), displayText: 'ยกเลิก' } },
        ] },
    },
  };
}

// ── Quick Reply เลือกสภาพผิว ──
const skinQuickReply = {
  items: ['ผิวมัน', 'ผิวแห้ง', 'ผิวผสม', 'ผิวแพ้ง่าย', 'ผิวหมองคล้ำ'].map((s) => ({
    type: 'action', action: { type: 'message', label: s, text: `${s}ใช้ตัวไหนดี` },
  })),
};

// ── คำนวณสรุปออเดอร์จาก items (mirror logic ของ tool create_draft_order) ──
function orderSummary(items) {
  const lines = [];
  let subtotal = 0;
  let sunscreenQty = 0;
  for (const it of items) {
    const p = products.products.find((x) => x.sku === it.sku.toUpperCase());
    if (!p) return null;
    const amount = p.price_thb * it.qty;
    subtotal += amount;
    if (p.name.includes('กันแดด')) sunscreenQty += it.qty;
    lines.push({ name: `${p.name} × ${it.qty}`, amount });
  }
  return {
    lines, subtotal,
    shipping: subtotal >= 600 ? 'ส่งฟรี (ครบ 600 บาท)' : 'มีค่าจัดส่ง (ยังไม่ครบ 600 บาท)',
    promo: sunscreenQty >= 2 ? 'เข้าโปรหน้าฝน: ครีมกันแดด 2 ชิ้น ลด 15%' : null,
  };
}

// ดึงรหัส SKU จากข้อความผลลัพธ์ tool (เช่น "GB-002 · ...") เพื่อ render การ์ด
const skusFromText = (text) => [...new Set((text.match(/GB-\d+/g) || []))];

module.exports = { productCarousel, promotionCarousel, orderConfirmBubble, orderSummary, skinQuickReply, skusFromText, BRAND };
