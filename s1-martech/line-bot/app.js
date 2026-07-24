/**
 * LINE Bot Starter — AI for MarTech Workshop (HarmonyX)
 * LINE Messaging API (webhook) + Claude API + ข้อมูลสินค้าจริง
 *
 * รัน:  npm install && npm start
 * ต้องมีไฟล์ .env (ดู .env.example)
 */
require('dotenv').config();
const express = require('express');
const { middleware, messagingApi } = require('@line/bot-sdk');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

// ---------- 1) ตั้งค่า ----------
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
// @line/bot-sdk v10+ เปลี่ยนมาใช้ MessagingApiClient แทน Client เดิม
const line = new messagingApi.MessagingApiClient({
  channelAccessToken: lineConfig.channelAccessToken,
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------- 2) Context builder: โหลดข้อมูลสินค้า/โปรโมชัน ----------
// แนวคิดเดียวกับ MCP Data Tools: AI ตอบได้ดีเท่ากับข้อมูลที่เราส่งให้
const products = JSON.parse(fs.readFileSync('./products.json', 'utf-8'));

const SYSTEM_PROMPT = `คุณคือพนักงานขายของร้าน "${products.shop_name}"
ตอบลูกค้าอย่างสุภาพ กระชับ เป็นภาษาไทย (ไม่เกิน 4-5 ประโยค)

กติกาสำคัญ:
- อ้างอิงเฉพาะข้อมูลสินค้าและโปรโมชันใน <ข้อมูลร้าน> เท่านั้น
- ห้ามคาดเดาราคา สต็อก หรือเงื่อนไขโปรโมชันที่ไม่มีในข้อมูล
- หากไม่มีข้อมูลที่ถาม ให้ตอบว่า "ขออภัยค่ะ เดี๋ยวให้เจ้าหน้าที่ติดต่อกลับนะคะ"
- หากลูกค้าต้องการคุยกับคนจริง ให้แจ้งช่องทาง: ${products.human_contact}

<ข้อมูลร้าน>
${JSON.stringify(products, null, 2)}
</ข้อมูลร้าน>`;

// ---------- 3) เรียก Claude ----------
async function askClaude(userText) {
  const res = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userText }],
  });
  return res.content[0].text;
}

// ---------- 4) Webhook ----------
const app = express();

app.post('/webhook', middleware(lineConfig), async (req, res) => {
  res.sendStatus(200); // ตอบ LINE ทันที แล้วค่อยประมวลผล
  for (const event of req.body.events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;
    try {
      const answer = await askClaude(event.message.text);
      // v10+: replyMessage รับ object เดียว { replyToken, messages: [...] }
      await line.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: answer }],
      });
      // TODO (Challenge): บันทึกบทสนทนาลงไฟล์/ฐานข้อมูล เพื่อวิเคราะห์ VoC ต่อ
      // หมายเหตุ PDPA: การเก็บ log ต้องแจ้งในนโยบายความเป็นส่วนตัวของ OA
    } catch (err) {
      console.error('reply error:', err.message);
    }
  }
});

app.get('/', (_, res) => res.send('LINE Bot Starter is running'));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Bot running on port ${port}`);
  console.log('เปิด public URL ด้วย: npx cloudflared tunnel --url http://localhost:' + port);
  console.log('แล้วนำ URL + /webhook ไปตั้งใน LINE Developers Console');
});
