/**
 * broadcast.mjs — ส่งโปรโมชันเชิงรุกถึงผู้ติดตามทั้งหมด (รูปแบบ A: AI/แบรนด์เป็นฝ่ายเริ่ม)
 * ต่างจาก bot ปกติ (reactive) — อันนี้ push ออกเอง ใช้ Flex การ์ดโปรชุดเดียวกับที่ bot ตอบ
 *
 *   พรีวิว (ไม่ส่งจริง):  node broadcast.mjs
 *   ส่งจริงถึงทุกคน:       node broadcast.mjs --send
 *
 * ⚠️ GOVERNANCE: broadcast = ส่งถึงผู้ติดตาม "ทุกคน" กลับไม่ได้ + กินโควตา OA
 *    จึง default เป็น dry-run · ต้องใส่ --send เองอย่างตั้งใจเท่านั้น (human-in-the-loop)
 */
import 'dotenv/config';
import { createRequire } from 'node:module';
import { messagingApi } from '@line/bot-sdk';

const flex = createRequire(import.meta.url)('./flex.js');
const SEND = process.argv.includes('--send');
const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) { console.error('❌ ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env'); process.exit(1); }

// ข้อความแคมเปญ: ข้อความนำ + การ์ดโปร (Flex) — ปรับได้ตามแคมเปญจริง
const messages = [
  { type: 'text', text: '🌧️ Glow Beauty มีโปรพิเศษมาฝากค่ะ! เลื่อนดูข้อเสนอด้านล่างได้เลย 👇' },
  flex.promotionCarousel(),
];

const api = new messagingApi.MessagingApiClient({ channelAccessToken: token });

// ดูโควตาก่อน (กันส่งเกินแพ็กเกจ OA)
try {
  const quota = await api.getMessageQuota();
  const consumption = await api.getMessageQuotaConsumption();
  console.log(`โควตาข้อความเดือนนี้: ใช้ไป ${consumption.totalUsage}${quota.value ? ` / ${quota.value}` : ' (ไม่จำกัด)'}`);
} catch (e) { console.log('(อ่านโควตาไม่ได้:', e.message, ')'); }

if (!SEND) {
  console.log('\n── DRY-RUN (ไม่ส่งจริง) ──');
  console.log('จะส่ง', messages.length, 'ข้อความถึงผู้ติดตามทั้งหมด:');
  console.log('  1) text:', messages[0].text);
  console.log('  2) flex:', messages[1].altText, `(${messages[1].contents.contents.length} การ์ด)`);
  console.log('\n👉 ส่งจริง: node broadcast.mjs --send');
  process.exit(0);
}

console.log('\n📣 กำลัง broadcast ถึงผู้ติดตามทั้งหมด...');
await api.broadcast({ messages });
console.log('✅ ส่งแล้ว — ผู้ติดตามทุกคนจะได้รับโปรโมชันนี้');
