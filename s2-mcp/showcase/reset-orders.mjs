/**
 * reset-orders.mjs — ล้างออเดอร์ที่เกิดระหว่างซ้อม
 *
 * confirm_order เขียนออเดอร์สดลง data/orders-live.json เพื่อให้ track_order ตามต่อได้
 * แต่ของจากการซ้อมจะค้างสะสม → วันงานจะมี ORD จากรอบก่อนปนอยู่ ดูมั่ว
 * รันตัวนี้ก่อนเริ่มทุกครั้ง (ไฟล์ตายตัว orders.json ไม่ถูกแตะ)
 *
 * รัน:  npm run reset-orders
 */
import fs from 'node:fs';

const file = new URL('./data/orders-live.json', import.meta.url);
let n = 0;
try {
  n = JSON.parse(fs.readFileSync(file, 'utf-8')).orders.length;
} catch {
  // ยังไม่เคยมีออเดอร์สด — ถือว่าสะอาดอยู่แล้ว
}
fs.rmSync(file, { force: true });
console.log(n
  ? `🧹 ล้างออเดอร์จากการซ้อม ${n} รายการแล้ว — เหลือแต่ ORD-1001..1003 ในไฟล์ตายตัว`
  : '✅ สะอาดอยู่แล้ว — ไม่มีออเดอร์ค้างจากการซ้อม');
