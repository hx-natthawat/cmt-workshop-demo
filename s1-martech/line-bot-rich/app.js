/**
 * LINE Bot × MCP × Rich UI — เวอร์ชัน flagship (โลกจริง)
 * ต่อยอด line-bot-mcp: เพิ่ม Flex Message, Quick Reply, Postback (ยืนยันออเดอร์), Rich Menu
 *
 * สถาปัตย์ 2 ชั้น:
 *   MCP tools (s2-mcp/showcase) = logic/data  ·  flex.js = presentation (render Flex/QuickReply)
 *   → tool ตัวเดียวใช้ได้ทั้งเว็บ/แอป/LINE เปลี่ยนแค่ชั้น render
 *
 * รัน:  npm install && npm start   (ต้องมี .env — ใช้ชุดเดียวกับ line-bot ได้)
 */
require('dotenv').config();
const express = require('express');
const { middleware, messagingApi } = require('@line/bot-sdk');
const Anthropic = require('@anthropic-ai/sdk');
const flex = require('./flex');

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const line = new messagingApi.MessagingApiClient({ channelAccessToken: lineConfig.channelAccessToken });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `คุณคือพนักงานขายของร้าน Glow Beauty Thailand ตอบภาษาไทยสุภาพ กระชับ (1-3 ประโยค)
- ใช้ tools ดึงข้อมูลจริงเสมอ (แนะนำสินค้า, โปรโมชัน, เช็คสต็อก/ออเดอร์, ร่างออเดอร์) ห้ามเดา
- การสั่งซื้อ: ใช้ create_draft_order เท่านั้น (ระบบจะแสดงปุ่มให้ลูกค้ายืนยันเอง) ห้ามยืนยันแทนลูกค้า
- ตอบสั้นๆ เพราะระบบจะแสดงการ์ดสินค้า/ออเดอร์ให้อัตโนมัติอยู่แล้ว`;

// ── เชื่อม MCP showcase (stdio) ครั้งเดียว ──
let mcp = null;
let anthTools = [];
async function connectMcp() {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const serverPath = new URL('../../s2-mcp/showcase/server.mjs', `file://${__filename}`).pathname;
  const transport = new StdioClientTransport({ command: 'node', args: [serverPath] });
  mcp = new Client({ name: 'line-bot-rich', version: '1.0.0' });
  await mcp.connect(transport);
  const { tools } = await mcp.listTools();
  anthTools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  console.log(`🔌 เชื่อม MCP showcase ได้ · ${anthTools.length} tools`);
}

const callTool = async (name, args) => {
  const r = await mcp.callTool({ name, arguments: args });
  return r.content.map((c) => c.text).join('\n');
};

// ── agentic loop: Claude + MCP tools · เก็บ toolCalls ไว้ตัดสินใจ render ──
async function runClaude(userText) {
  const messages = [{ role: 'user', content: userText }];
  const toolCalls = [];
  for (let hop = 0; hop < 6; hop++) {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-5', max_tokens: 1024, thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT, tools: anthTools, messages,
    });
    messages.push({ role: 'assistant', content: res.content });
    if (res.stop_reason !== 'tool_use') {
      return { text: res.content.find((b) => b.type === 'text')?.text ?? 'ขออภัยค่ะ เดี๋ยวให้เจ้าหน้าที่ติดต่อกลับนะคะ', toolCalls };
    }
    const results = [];
    for (const tu of res.content.filter((b) => b.type === 'tool_use')) {
      const resultText = await callTool(tu.name, tu.input);
      toolCalls.push({ name: tu.name, input: tu.input, resultText });
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: [{ type: 'text', text: resultText }] });
    }
    messages.push({ role: 'user', content: results });
  }
  return { text: 'ขออภัยค่ะ ระบบใช้เวลานานเกินไป เดี๋ยวให้เจ้าหน้าที่ติดต่อกลับนะคะ', toolCalls };
}

// ── Renderer: แปลง (ข้อความ + tool ที่ถูกเรียก) → LINE messages ──
function render({ text, toolCalls }) {
  const last = (n) => [...toolCalls].reverse().find((c) => c.name === n);
  const textMsg = { type: 'text', text };

  // ร่างออเดอร์ → การ์ดยืนยัน (governance)
  const draft = last('create_draft_order');
  if (draft && draft.input.items) {
    const summary = flex.orderSummary(draft.input.items);
    if (summary) return [textMsg, flex.orderConfirmBubble(draft.input.items, summary)];
  }
  // แนะนำสินค้า / bestsellers → การ์ดสินค้า
  const rec = last('recommend_for_skin') || last('get_bestsellers');
  if (rec) {
    const carousel = flex.productCarousel(flex.skusFromText(rec.resultText));
    if (carousel) return [textMsg, carousel];
  }
  // โปรโมชัน → การ์ดโปร
  if (last('get_promotions')) return [textMsg, flex.promotionCarousel()];

  // ข้อความทั่วไป → แนบ Quick Reply เลือกสภาพผิว
  return [{ ...textMsg, quickReply: flex.skinQuickReply }];
}

// ── Webhook ──
const app = express();

app.post('/webhook', middleware(lineConfig), async (req, res) => {
  res.sendStatus(200);
  for (const event of req.body.events) {
    try {
      if (event.type === 'message' && event.message.type === 'text') {
        const messages = render(await runClaude(event.message.text));
        await line.replyMessage({ replyToken: event.replyToken, messages: messages.slice(0, 5) });
      } else if (event.type === 'postback') {
        await handlePostback(event);
      }
    } catch (err) {
      console.error('handler error:', err.message);
    }
  }
});

// ── Postback: ปุ่มจากการ์ด (สั่งเลย / ยืนยัน / ยกเลิก) ──
async function handlePostback(event) {
  let d;
  try { d = JSON.parse(event.postback.data); } catch { return; }
  if (d.a === 'buy') {
    // กด "สั่งเลย" → ให้ AI ร่างออเดอร์ 1 ชิ้น (จะได้การ์ดยืนยันต่อ)
    const messages = render(await runClaude(`ขอสั่ง ${d.sku} จำนวน 1 ชิ้น`));
    await line.replyMessage({ replyToken: event.replyToken, messages: messages.slice(0, 5) });
  } else if (d.a === 'confirm') {
    // ลูกค้ากดยืนยัน → execute จริงผ่าน confirm_order (human-in-the-loop ครบ)
    const text = await callTool('confirm_order', { items: d.items });
    await line.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text }] });
  } else if (d.a === 'cancel') {
    await line.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: 'ยกเลิกคำสั่งซื้อแล้วค่ะ 🙏 มีอะไรให้ช่วยเพิ่มเติมไหมคะ', quickReply: flex.skinQuickReply }] });
  }
}

app.get('/', (_, res) => res.send('LINE Bot × MCP × Rich UI is running'));

const port = process.env.PORT || 3000;
connectMcp()
  .then(() => app.listen(port, () => console.log(`✅ Bot × MCP × Rich running on port ${port}`)))
  .catch((err) => { console.error('❌ เชื่อม MCP ไม่ได้:', err.message); process.exit(1); });
