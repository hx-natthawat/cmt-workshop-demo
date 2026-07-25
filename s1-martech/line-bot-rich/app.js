/**
 * LINE Bot × MCP × Rich UI (flagship) — ใช้ agent.js กลาง (logic เดียวกับ webchat)
 * เพิ่ม: VoC logging (data loop) + เก็บ restock interest (สินค้าหมด)
 *
 * รัน:  npm install && npm start   (ต้องมี .env)
 */
require('dotenv').config();
const fs = require('node:fs');
const express = require('express');
const { middleware, messagingApi } = require('@line/bot-sdk');
const flex = require('./flex');
const agent = require('./agent');
const store = require('./store');

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const line = new messagingApi.MessagingApiClient({ channelAccessToken: lineConfig.channelAccessToken });

// สินค้าที่หมด (stock 0) + keyword — ใช้เก็บ restock interest
const products = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../../s2-mcp/showcase/products.json'), 'utf-8'));
const soldOut = products.products.filter((p) => p.stock === 0)
  .map((p) => ({ sku: p.sku, kw: p.name.replace(/\d+\w*/g, '').trim().split(' ')[0] })); // เช่น GB-004 → "โฟม"

// ── Renderer: (ข้อความ + tool ที่ถูกเรียก) → LINE messages ──
function render({ text, toolCalls }) {
  const last = (n) => [...toolCalls].reverse().find((c) => c.name === n);
  const textMsg = { type: 'text', text };
  const draft = last('create_draft_order');
  if (draft && draft.input.items) {
    const summary = flex.orderSummary(draft.input.items);
    if (summary) return [textMsg, flex.orderConfirmBubble(draft.input.items, summary)];
  }
  const rec = last('recommend_for_skin') || last('get_bestsellers');
  if (rec) {
    const carousel = flex.productCarousel(flex.skusFromText(rec.resultText));
    if (carousel) return [textMsg, carousel];
  }
  if (last('get_promotions')) return [textMsg, flex.promotionCarousel()];
  return [{ ...textMsg, quickReply: flex.skinQuickReply }];
}

// เก็บ restock interest ถ้าลูกค้าถามถึงสินค้าที่หมด
function captureRestock(text, userId) {
  for (const s of soldOut) {
    if (s.kw && text.includes(s.kw)) { store.addRestockInterest(s.sku, userId); return s.sku; }
  }
  return null;
}

// ── Webhook ──
const app = express();

app.post('/webhook', middleware(lineConfig), async (req, res) => {
  res.sendStatus(200);
  for (const event of req.body.events) {
    try {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source?.userId;
        const out = await agent.runAgent(event.message.text);
        store.logVoc({ userId, channel: 'line', text: event.message.text, tools: out.toolCalls.map((c) => c.name) });
        captureRestock(event.message.text, userId);
        await line.replyMessage({ replyToken: event.replyToken, messages: render(out).slice(0, 5) });
      } else if (event.type === 'postback') {
        await handlePostback(event);
      }
    } catch (err) {
      console.error('handler error:', err.message);
    }
  }
});

async function handlePostback(event) {
  let d;
  try { d = JSON.parse(event.postback.data); } catch { return; }
  if (d.a === 'buy') {
    const out = await agent.runAgent(`ขอสั่ง ${d.sku} จำนวน 1 ชิ้น`);
    await line.replyMessage({ replyToken: event.replyToken, messages: render(out).slice(0, 5) });
  } else if (d.a === 'confirm') {
    const text = await agent.callTool('confirm_order', { items: d.items });
    store.logVoc({ userId: event.source?.userId, channel: 'line', text: '[postback] confirm', tools: ['confirm_order'] });
    await line.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text }] });
  } else if (d.a === 'cancel') {
    await line.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: 'ยกเลิกคำสั่งซื้อแล้วค่ะ 🙏', quickReply: flex.skinQuickReply }] });
  }
}

app.get('/', (_, res) => res.send('LINE Bot × MCP × Rich UI is running'));

const port = process.env.PORT || 3000;
agent.connectMcp()
  .then((names) => {
    console.log(`🔌 เชื่อม MCP showcase ได้ · ${names.length} tools`);
    app.listen(port, () => console.log(`✅ Bot × MCP × Rich running on port ${port}`));
  })
  .catch((err) => { console.error('❌ เชื่อม MCP ไม่ได้:', err.message); process.exit(1); });
