/**
 * setup-richmenu.mjs — สร้าง Rich Menu (เมนูถาวรล่างจอ LINE) 4 ช่อง แล้วตั้งเป็น default
 *
 *   [ แนะนำสินค้า ] [ โปรโมชัน ] [ เช็คออเดอร์ ] [ เจ้าหน้าที่ ]
 *
 * ต้องมีรูปพื้นหลัง richmenu.png ขนาด 2500×843 (เปิด richmenu-template.html แล้วแคป/บันทึกเป็น png)
 * รัน:  npm run setup-richmenu   (ต้องมี LINE_CHANNEL_ACCESS_TOKEN ใน .env)
 *
 * ⚠️ นี่คือการแก้ไข LINE OA จริง — รันเมื่อพร้อมเท่านั้น · ลบเมนู: ดู README
 */
import 'dotenv/config';
import fs from 'node:fs';
import { messagingApi } from '@line/bot-sdk';

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) { console.error('❌ ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env'); process.exit(1); }
if (!fs.existsSync('./richmenu.png')) {
  console.error('❌ ไม่พบ richmenu.png (2500×843) — เปิด richmenu-template.html แล้วบันทึกเป็น richmenu.png ก่อน');
  process.exit(1);
}

const api = new messagingApi.MessagingApiClient({ channelAccessToken: token });
const blob = new messagingApi.MessagingApiBlobClient({ channelAccessToken: token });

// 4 ช่องแนวนอน แต่ละช่องกว้าง 625px (2500/4) สูงเต็ม 843
const cell = (i) => ({ x: i * 625, y: 0, width: 625, height: 843 });
const richMenu = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: 'Glow Beauty Menu',
  chatBarText: 'เมนู',
  areas: [
    { bounds: cell(0), action: { type: 'message', text: 'แนะนำสินค้าตามสภาพผิว' } },
    { bounds: cell(1), action: { type: 'message', text: 'มีโปรโมชันอะไรบ้าง' } },
    { bounds: cell(2), action: { type: 'message', text: 'ขอเช็คสถานะออเดอร์' } },
    { bounds: cell(3), action: { type: 'message', text: 'ติดต่อเจ้าหน้าที่' } },
  ],
};

const { richMenuId } = await api.createRichMenu(richMenu);
console.log('✅ สร้าง rich menu:', richMenuId);

const image = fs.readFileSync('./richmenu.png');
await blob.setRichMenuImage(richMenuId, new Blob([image], { type: 'image/png' }));
console.log('✅ อัปโหลดรูปพื้นหลังแล้ว');

await api.setDefaultRichMenu(richMenuId);
console.log('✅ ตั้งเป็นเมนูเริ่มต้นแล้ว — เปิดแชทใน LINE จะเห็นเมนูล่างจอ');
