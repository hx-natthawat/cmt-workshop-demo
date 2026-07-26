/**
 * validate-line.js — ตรวจ message ว่าตรงข้อจำกัดของ LINE Messaging API ก่อนส่งจริง
 *
 * ทำไมต้องมี: Flex Message ผิดโครงสร้างแค่นิดเดียว LINE ตอบ 400 แล้วบอทเงียบ
 * ซึ่งบนเวทีคือ "บอทพัง" — ตรวจในเครื่องก่อนดีกว่าไปเจอหน้างาน
 *
 * อ้างอิงข้อจำกัด (Messaging API):
 *   - reply ได้สูงสุด 5 message ต่อครั้ง
 *   - text: ≤ 5,000 ตัวอักษร · altText ของ flex: ≤ 400
 *   - carousel: ≤ 12 bubble · quick reply: ≤ 13 ปุ่ม
 *   - postback data: ≤ 300 ตัวอักษร · label ปุ่ม: ≤ 20
 *   - รูปต้องเป็น https
 */
const LIMITS = {
  messages: 5, text: 5000, altText: 400, carousel: 12, quickReply: 13, postbackData: 300, label: 20,
};

// เดินทั้งต้นไม้ Flex เพื่อหา action/รูปที่ซ่อนอยู่ลึกๆ
function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  fn(node);
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) v.forEach((c) => walk(c, fn));
    else if (v && typeof v === 'object') walk(v, fn);
  }
}

function checkAction(a, where, errs) {
  if (!a?.type) return;
  if (a.label && [...a.label].length > LIMITS.label) errs.push(`${where}: label ยาว ${[...a.label].length} > ${LIMITS.label}`);
  if (a.type === 'postback') {
    if (!a.data) errs.push(`${where}: postback ไม่มี data`);
    else if (a.data.length > LIMITS.postbackData) errs.push(`${where}: postback data ยาว ${a.data.length} > ${LIMITS.postbackData}`);
    // เราเข้ารหัส data เป็น JSON — ถ้า parse ไม่ได้ handlePostback จะ return เงียบ
    else { try { JSON.parse(a.data); } catch { errs.push(`${where}: postback data ไม่ใช่ JSON ที่ parse ได้`); } }
  }
  if (a.type === 'uri' && a.uri && !/^https:\/\//.test(a.uri)) errs.push(`${where}: uri ต้องเป็น https`);
}

function validateMessage(m, i) {
  const errs = [];
  const at = `msg[${i}]`;
  if (!m?.type) return [`${at}: ไม่มี type`];

  if (m.type === 'text') {
    if (typeof m.text !== 'string' || !m.text.trim()) errs.push(`${at}: text ว่าง — LINE จะตอบ 400`);
    else if ([...m.text].length > LIMITS.text) errs.push(`${at}: text ยาว ${[...m.text].length} > ${LIMITS.text}`);
  } else if (m.type === 'flex') {
    if (!m.altText) errs.push(`${at}: flex ไม่มี altText (จำเป็น — ใช้แสดงบน notification)`);
    else if ([...m.altText].length > LIMITS.altText) errs.push(`${at}: altText ยาวเกิน ${LIMITS.altText}`);
    const c = m.contents;
    if (!c?.type) errs.push(`${at}: flex ไม่มี contents`);
    else if (c.type === 'carousel') {
      if (!Array.isArray(c.contents) || !c.contents.length) errs.push(`${at}: carousel ว่าง`);
      else {
        if (c.contents.length > LIMITS.carousel) errs.push(`${at}: carousel ${c.contents.length} ใบ > ${LIMITS.carousel}`);
        c.contents.forEach((b, bi) => { if (b.type !== 'bubble') errs.push(`${at}.bubble[${bi}]: ต้องเป็น bubble`); });
      }
    } else if (c.type !== 'bubble') errs.push(`${at}: contents ต้องเป็น bubble หรือ carousel`);
    walk(c, (n) => {
      if (n.type === 'image' && n.url && !/^https:\/\//.test(n.url)) errs.push(`${at}: image url ต้องเป็น https (${n.url})`);
      if (n.type === 'text' && n.text !== undefined && n.text === '') errs.push(`${at}: มี text component ว่าง`);
      checkAction(n.action, at, errs);
    });
  }

  const qr = m.quickReply;
  if (qr) {
    if (!Array.isArray(qr.items) || !qr.items.length) errs.push(`${at}: quickReply ว่าง`);
    else {
      if (qr.items.length > LIMITS.quickReply) errs.push(`${at}: quickReply ${qr.items.length} ปุ่ม > ${LIMITS.quickReply}`);
      qr.items.forEach((it, qi) => {
        if (it.type !== 'action') errs.push(`${at}.qr[${qi}]: type ต้องเป็น "action"`);
        checkAction(it.action, `${at}.qr[${qi}]`, errs);
      });
    }
  }
  return errs;
}

// ตรวจทั้งชุดที่จะส่งใน reply เดียว
function validateReply(messages) {
  const errs = [];
  if (!Array.isArray(messages) || !messages.length) return ['ไม่มี message จะส่ง'];
  if (messages.length > LIMITS.messages) errs.push(`ส่ง ${messages.length} message > ${LIMITS.messages} ต่อ reply`);
  messages.forEach((m, i) => errs.push(...validateMessage(m, i)));
  return errs;
}

module.exports = { validateReply, validateMessage, LIMITS };
