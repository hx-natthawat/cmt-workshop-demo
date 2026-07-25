/**
 * store.js — data layer เบาๆ (JSON/JSONL บนไฟล์) สำหรับ VoC log + restock interest
 * โลกจริงเปลี่ยนเป็น DB/CDP — interface เหมือนเดิม (แนวคิด data loop ในเด็ค)
 *
 * PDPA: hash userId ก่อนเก็บ (ไม่เก็บ raw) · การเก็บ log ต้องแจ้งในนโยบายความเป็นส่วนตัว OA
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DIR = path.join(__dirname, 'data');
const VOC = path.join(DIR, 'voc-log.jsonl');
const RESTOCK = path.join(DIR, 'restock-interest.json');
fs.mkdirSync(DIR, { recursive: true });

const hashUser = (id) => 'u_' + crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 10);

// ── VoC: บันทึกทุกบทสนทนา (append-only) ──
function logVoc({ userId, channel, text, tools }) {
  const rec = { ts: new Date().toISOString(), user: hashUser(userId || 'anon'), channel, text, tools };
  fs.appendFileSync(VOC, JSON.stringify(rec) + '\n');
}
function readVoc() {
  if (!fs.existsSync(VOC)) return [];
  return fs.readFileSync(VOC, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// ── Restock interest: เก็บคนที่ถามสินค้าที่หมด ──
// หมายเหตุ: เก็บ userId จริง (จำเป็นต้องใช้ push แจ้งเตือน) — ต้องได้ consent + แจ้งในนโยบาย
function addRestockInterest(sku, userId) {
  if (!userId) return;
  const data = fs.existsSync(RESTOCK) ? JSON.parse(fs.readFileSync(RESTOCK, 'utf-8')) : {};
  const key = sku.toUpperCase();
  data[key] = data[key] || [];
  if (!data[key].includes(userId)) data[key].push(userId);
  fs.writeFileSync(RESTOCK, JSON.stringify(data, null, 2));
}
function readRestock() {
  return fs.existsSync(RESTOCK) ? JSON.parse(fs.readFileSync(RESTOCK, 'utf-8')) : {};
}

module.exports = { logVoc, readVoc, addRestockInterest, readRestock, hashUser };
