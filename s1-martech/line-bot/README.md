# LINE Bot Starter — AI for MarTech Workshop (HarmonyX)

สร้าง LINE Bot ที่ตอบแชทลูกค้าด้วย Claude โดยอ้างอิงข้อมูลสินค้าและโปรโมชันจริง
(Lab 3 · 60 นาที)

## สิ่งที่ต้องเตรียม

1. บัญชี [LINE Developers](https://developers.line.biz/) (ฟรี)
2. Node.js 18 ขึ้นไป
3. Anthropic API key (หรือใช้ key กลางที่วิทยากรแจก)

## ขั้นตอน

### Step 1 — สร้าง Messaging API channel (10 นาที)

1. เข้า LINE Developers Console → สร้าง Provider (ถ้ายังไม่มี)
2. สร้าง channel ประเภท **Messaging API**
3. แท็บ *Basic settings*: คัดลอก **Channel secret**
4. แท็บ *Messaging API*: กด issue **Channel access token** แล้วคัดลอก
5. ปิด "Auto-reply messages" ใน LINE Official Account Manager
   (Settings → Response settings → ปิด auto-response เพื่อให้ bot ของเราตอบเอง)

### Step 2 — ติดตั้งและตั้งค่า (10 นาที)

```bash
npm install
cp .env.example .env
# แก้ไข .env ใส่ token ทั้ง 3 ค่า
npm start
```

### Step 3 — เปิด public URL และตั้งค่า webhook (10 นาที)

```bash
npx cloudflared tunnel --url http://localhost:3000
# หรือ: ngrok http 3000
```

นำ URL ที่ได้ + `/webhook` (เช่น `https://xxxx.trycloudflare.com/webhook`)
ไปใส่ใน LINE Developers Console → *Messaging API* → **Webhook URL**
→ กด Verify → เปิด **Use webhook**

### Step 4 — ทดสอบ (10 นาที)

สแกน QR ของ OA (แท็บ Messaging API) เพิ่มเป็นเพื่อน แล้วลองถาม:

- "ครีมกันแดดตัวไหนเหมาะกับผิวมัน"
- "มีโปรอะไรบ้าง"
- "โฟมล้างหน้ามีของไหม" (ทดสอบกรณีสินค้าหมด)
- "ขายรองเท้าไหม" (ทดสอบว่า bot ไม่เดา — ต้องส่งต่อเจ้าหน้าที่)

### Step 5 — Challenge (15 นาที)

- แก้ `products.json` เป็นสินค้าของทีมคุณเอง
- ปรับ `SYSTEM_PROMPT` ใน `app.js` ให้เป็นบุคลิกแบรนด์ (ลองเปลี่ยนสรรพนาม/น้ำเสียง)
- (ขั้นสูง) บันทึกบทสนทนาลงไฟล์เพื่อวิเคราะห์ VoC — ดู TODO ใน `app.js`

### Step 6 — แลกเปลี่ยน (5 นาที)

สแกน QR ทดลองคุยกับ bot ของทีมอื่น และให้ feedback

## เชื่อมโยงกับ MCP

- โค้ดนี้คือรูปแบบ "ลูกค้าเป็นฝ่ายเริ่ม" (webhook)
- รูปแบบ "AI เป็นฝ่ายเริ่ม" (ส่งแคมเปญ/broadcast) ใช้ MCP server อย่างเป็นทางการของ LINE ได้โดยไม่ต้องเขียนโค้ด:
  [`@line/line-bot-mcp-server`](https://github.com/line/line-bot-mcp-server) (preview)
- แนวคิดสำคัญเดียวกัน: **คุณภาพคำตอบของ AI ขึ้นอยู่กับข้อมูลที่ส่งให้** (context)

## ข้อควรระวังก่อนใช้งานจริง

- **PDPA** — การเก็บ log บทสนทนาต้องแจ้งในนโยบายความเป็นส่วนตัวของ OA
- **Reply token** ใช้ได้ครั้งเดียวและมีอายุจำกัด
- **โควตาข้อความ** push/broadcast ขึ้นอยู่กับแพ็กเกจ LINE OA
- ออกแบบ **ทางออกสู่พนักงานจริง (human handoff)** เสมอ
- ทดสอบคำถามที่ไม่มีในข้อมูล — bot ต้องไม่คาดเดา
