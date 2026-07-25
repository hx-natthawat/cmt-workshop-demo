/**
 * broadcast-segment.mjs — ยิงโปรเฉพาะ RFM segment (targeting) แทน broadcast หาทุกคน
 * อ่าน ../customer_data.csv → คำนวณ RFM → เลือก segment → สร้างข้อความเฉพาะกลุ่ม
 *
 *   ดู segments:  node broadcast-segment.mjs
 *   พรีวิว:       node broadcast-segment.mjs "แชมป์ตัวจริง"
 *
 * โลกจริง: การส่งจริงต้อง map segment → LINE userId (ผ่าน CDP/consent) แล้วใช้ multicast
 * ที่นี่แสดงฝั่ง "วางแผน+targeting" (audience + ข้อความ) — ปลอดภัย ไม่ส่งจริง
 */
import fs from 'node:fs';

const rows = fs.readFileSync(new URL('../customer_data.csv', import.meta.url), 'utf-8')
  .split(/\r?\n/).filter(Boolean); // รองรับ CRLF (กัน \r ติดค่าคอลัมน์สุดท้าย)
const header = rows[0].replace(/^﻿/, '').split(',');
const idx = (k) => header.indexOf(k);
const data = rows.slice(1).map((line) => {
  const c = line.split(',');
  return { recency: +c[idx('recency_days')], orders: +c[idx('total_orders')], spend: +c[idx('total_spend_thb')],
    channel: c[idx('main_channel')], line: c[idx('line_oa_member')] };
});

function seg(r) {
  if (r.recency <= 60 && r.orders >= 10) return 'แชมป์ตัวจริง';
  if (r.recency <= 90 && r.orders >= 5) return 'ขาประจำ';
  if (r.recency <= 60 && r.orders <= 2) return 'หน้าใหม่';
  if (r.recency > 180) return 'หลับไหล';
  return 'เสี่ยงหลุด';
}
// ข้อความเฉพาะกลุ่ม (targeting = เนื้อหาตรงใจแต่ละ segment)
const MSG = {
  'แชมป์ตัวจริง': '💎 สิทธิพิเศษสำหรับลูกค้า VIP! รับส่วนลด 20% + ของแถมพิเศษ เฉพาะคุณเท่านั้นค่ะ',
  'ขาประจำ': '💚 ขอบคุณที่อุดหนุนเสมอค่ะ! รับส่วนลด 15% สำหรับออเดอร์ถัดไป',
  'หน้าใหม่': '👋 ยินดีต้อนรับค่ะ! ใช้โค้ด NEW50 ลด 50 บาท ซื้อครั้งแรก',
  'เสี่ยงหลุด': '🌟 คิดถึงคุณค่ะ! กลับมาช้อปวันนี้รับส่วนลด 15% + ส่งฟรี',
  'หลับไหล': '💌 ไม่ได้เจอกันนาน! รับส่วนลดพิเศษ 25% ดึงคุณกลับมาค่ะ',
};

const groups = {};
for (const r of data) { const s = seg(r); (groups[s] = groups[s] || []).push(r); }

const target = process.argv[2];
if (!target) {
  console.log('RFM Segments (จากลูกค้า', data.length, 'ราย · ข้อมูลตัวอย่างใน CSV):\n');
  for (const [s, list] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    const lineFlag = list.filter((r) => r.line === 'Yes').length;
    console.log(`  ${s}: ${list.length} ราย (flag LINE=Yes ${lineFlag}) — ยอดเฉลี่ย ${Math.round(list.reduce((s, r) => s + r.spend, 0) / list.length).toLocaleString()} บาท`);
  }
  console.log('\n👉 ยิงเฉพาะกลุ่ม: node broadcast-segment.mjs "แชมป์ตัวจริง"');
  process.exit(0);
}

const list = groups[target];
if (!list) { console.error('ไม่พบ segment:', target, '· มี:', Object.keys(groups).join(', ')); process.exit(1); }
const lineMembers = list.filter((r) => r.line === 'Yes').length;
console.log(`\n🎯 Targeting: ${target}`);
console.log(`   audience: ${list.length} ราย · flag line_oa_member="Yes" ในไฟล์: ${lineMembers} ราย`);
console.log(`   ข้อความเฉพาะกลุ่ม: "${MSG[target]}"`);
console.log('\n⚠️ ตัวเลขนี้มาจากคอลัมน์ตัวอย่างใน customer_data.csv — ไม่ได้เช็คกับ LINE จริง');
console.log('   ส่งจริงยังไม่ได้: CSV ไม่มี LINE userId (มีแค่ customer_id)');
console.log('   โลกจริงต้อง: เก็บ userId ตอน follow/ผูกบัญชี → map customer_id↔userId ใน CDP → multicast');
