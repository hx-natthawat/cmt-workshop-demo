/**
 * test-offline.js — เทสต์ตรรกะล้วน ไม่เรียก Claude/LINE (ไม่ต้องมี API key)
 *
 * ต่างจาก rehearse.js: ตัวนั้นซ้อมของจริง (ช้า+เสียโทเคน) ตัวนี้เร็วพอจะรันใน CI ทุก PR
 * ครอบคลุม 2 จุดที่เคยพังเงียบ:
 *   1. ตัวจับสินค้าที่หมด (restock) — ภาษาไทยไม่เว้นวรรค ตัดคำผิดแล้วฟีเจอร์ตายโดยไม่มี error
 *   2. ตัวตรวจข้อจำกัด LINE — ต้องจับ Flex ที่ผิดจริงๆ ได้ ไม่ใช่ผ่านหมดทุกอย่าง
 *
 * รัน:  npm test
 */
const { matchSoldOut } = require('./render');
const { planFromResponse, stripToolXml, MAX_RETRIES } = require('./agent');
const { validateReply } = require('./validate-line');
const flex = require('./flex');

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`); }
};

console.log('\n▌1. ตัวจับสินค้าที่หมด (restock)');
t('ลูกค้าพิมพ์ชื่อไม่ครบ "โฟมล้างหน้า" ต้องจับได้', matchSoldOut('โฟมล้างหน้ายังมีไหมคะ') === 'GB-004', matchSoldOut('โฟมล้างหน้ายังมีไหมคะ'));
t('ชื่อเต็มพร้อมขนาด ต้องจับได้', matchSoldOut('อยากได้โฟมล้างหน้าใยไหม 100g') === 'GB-004');
t('พิมพ์รหัสสินค้ามาตรงๆ ต้องจับได้', matchSoldOut('gb-004 มีของไหม') === 'GB-004');
t('คำถามทั่วไปต้องไม่จับผิด', matchSoldOut('ผิวแห้งมาก แนะนำอะไรดีคะ') === null);
t('ข้อความว่างต้องไม่พัง', matchSoldOut('') === null);
t('undefined ต้องไม่พัง', matchSoldOut(undefined) === null);

console.log('\n▌1b. agentic loop ต้องทนคำตอบเพี้ยนจากโมเดล');
// เคสจริงที่เคยทำให้บอทเงียบ: stop_reason=tool_use แต่ไม่มี tool_use block
const noToolUse = { stop_reason: 'tool_use', content: [{ type: 'text', text: '<invoke name="check_stock"><parameter name="query">โฟม</parameter></invoke>' }] };
let p = planFromResponse(noToolUse, 0);
t('ไม่มี tool_use block → ต้อง retry (ไม่ส่ง message ว่างไป API)', p.kind === 'retry', p.kind);
t('retry แล้วต้องไม่มี XML ดิบติดไปกับข้อความ', !/<invoke|<parameter/.test(p.text), p.text.slice(0, 60));

p = planFromResponse(noToolUse, MAX_RETRIES);
t('retry ครบโควตาแล้ว → giveup (ไม่วนไม่รู้จบ)', p.kind === 'giveup', p.kind);

p = planFromResponse({ stop_reason: 'tool_use', content: [
  { type: 'text', text: 'กำลังเช็คให้นะคะ' },
  { type: 'tool_use', id: 'tu1', name: 'check_stock', input: { query: 'GB-001' } },
] }, 0);
t('มี tool_use จริง → เรียก tool ต่อ', p.kind === 'tools' && p.toolUses.length === 1, p.kind);

p = planFromResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'ส่ง 1-2 วันค่ะ' }] }, 0);
t('end_turn → จบ ใช้ข้อความตอบ', p.kind === 'final' && p.text === 'ส่ง 1-2 วันค่ะ', `${p.kind}/${p.text}`);

p = planFromResponse({ stop_reason: 'end_turn', content: [] }, 0);
t('คำตอบว่างเปล่า → ต้องมีข้อความสำรอง ไม่ส่งค่าว่างให้ลูกค้า', p.kind === 'final' && p.text.length > 0, p.text);

t('stripToolXml ตัด <invoke> ทั้งก้อนทิ้ง', stripToolXml('สวัสดีค่ะ<invoke name="x"><parameter name="y">z</parameter></invoke>') === 'สวัสดีค่ะ');
t('stripToolXml ไม่แตะข้อความปกติ', stripToolXml('ครีมกันแดด 590 บาท') === 'ครีมกันแดด 590 บาท');

console.log('\n▌2. Flex ที่เราสร้างเองต้องผ่านข้อจำกัด LINE');
const carousel = flex.productCarousel(['GB-001', 'GB-002', 'GB-003']);
t('product carousel ผ่าน', validateReply([{ type: 'text', text: 'ทดสอบ' }, carousel]).length === 0, validateReply([carousel]).join(' / '));
t('promotion carousel ผ่าน', validateReply([flex.promotionCarousel()]).length === 0);
const items = [{ sku: 'GB-001', qty: 2 }];
t('การ์ดยืนยันออเดอร์ผ่าน', validateReply([flex.orderConfirmBubble(items, flex.orderSummary(items))]).length === 0);
t('quick reply ผ่าน', validateReply([{ type: 'text', text: 'ok', quickReply: flex.skinQuickReply }]).length === 0);

console.log('\n▌3. ตัวตรวจต้องจับของเสียได้จริง (negative test)');
const catches = (name, msgs, keyword) => {
  const errs = validateReply(msgs);
  t(name, errs.some((e) => e.includes(keyword)), `ได้: ${errs.join(' / ') || 'ไม่พบ error'}`);
};
catches('text ว่าง', [{ type: 'text', text: '' }], 'ว่าง');
catches('flex ไม่มี altText', [{ type: 'flex', contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } } }], 'altText');
catches('carousel ว่าง', [{ type: 'flex', altText: 'x', contents: { type: 'carousel', contents: [] } }], 'ว่าง');
catches('ส่งเกิน 5 message', Array.from({ length: 6 }, () => ({ type: 'text', text: 'x' })), '> 5');
catches('postback data ยาวเกิน', [{ type: 'text', text: 'x', quickReply: { items: [{ type: 'action', action: { type: 'postback', label: 'a', data: 'x'.repeat(301) } }] } }], 'ยาว');
catches('postback data ไม่ใช่ JSON', [{ type: 'text', text: 'x', quickReply: { items: [{ type: 'action', action: { type: 'postback', label: 'a', data: 'ไม่ใช่ json' } }] } }], 'JSON');
catches('รูปไม่ใช่ https', [{ type: 'flex', altText: 'x', contents: { type: 'bubble', hero: { type: 'image', url: 'http://a.com/x.png' } } }], 'https');

console.log(`\n═══ สรุป: ✅ ${pass} ผ่าน · ❌ ${fail} พัง ═══\n`);
process.exit(fail ? 1 : 0);
