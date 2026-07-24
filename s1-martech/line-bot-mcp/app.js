/**
 * LINE Bot × MCP — เวอร์ชันต่อยอด: ลูกค้าแชทใน LINE → Claude เรียก MCP tools ตอบด้วยข้อมูลจริง
 * (ต่อยอดจาก s1-martech/line-bot + s2-mcp/showcase)
 *
 * ต่างจาก Lab 3 เดิม: เดิมยัด products.json เข้า system prompt · เวอร์ชันนี้เชื่อม MCP server จริง
 * แล้วให้ Claude เลือกเรียก tool (แนะนำสินค้า / เช็คออเดอร์ / ร่างออเดอร์ / bestsellers) เอง
 *
 * รัน:  npm install && npm start   (ต้องมี .env — ใช้ชุดเดียวกับ s1-martech/line-bot ได้)
 */
require('dotenv').config();
const express = require('express');
const { middleware, messagingApi } = require('@line/bot-sdk');
const Anthropic = require('@anthropic-ai/sdk');

// ---------- 1) ตั้งค่า ----------
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const line = new messagingApi.MessagingApiClient({ channelAccessToken: lineConfig.channelAccessToken });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `คุณคือพนักงานขายของร้าน Glow Beauty Thailand
ตอบลูกค้าอย่างสุภาพ กระชับ เป็นภาษาไทย (ไม่เกิน 4-5 ประโยค)
กติกา:
- ใช้ tools ที่มีเพื่อดึงข้อมูลจริงเสมอ (แนะนำสินค้า, เช็คสต็อก/ออเดอร์, ร่างคำสั่งซื้อ) ห้ามเดาราคา/สต็อก/สถานะเอง
- การสั่งซื้อให้ใช้ tool สร้าง "ร่างออเดอร์" เท่านั้น แล้วแจ้งลูกค้าว่ารอเจ้าหน้าที่ยืนยัน — ห้ามยืนยันการตัดเงิน/ตัดสต็อกเอง
- หากไม่มีข้อมูลหรือเกินขอบเขต ให้แจ้งว่าจะให้เจ้าหน้าที่ติดต่อกลับ`;

// ---------- 2) เชื่อม MCP showcase server (stdio) ครั้งเดียวตอนบูต ----------
let mcp = null;
let anthTools = [];
async function connectMcp() {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const serverPath = new URL('../../s2-mcp/showcase/server.mjs', `file://${__filename}`).pathname;
  const transport = new StdioClientTransport({ command: 'node', args: [serverPath] });
  mcp = new Client({ name: 'line-bot-mcp', version: '1.0.0' });
  await mcp.connect(transport);
  const { tools } = await mcp.listTools();
  anthTools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  console.log(`🔌 เชื่อม MCP showcase ได้ · ${anthTools.length} tools: ${anthTools.map((t) => t.name).join(', ')}`);
}

// ---------- 3) agentic loop: Claude + MCP tools ----------
async function askClaudeWithTools(userText) {
  const messages = [{ role: 'user', content: userText }];
  for (let hop = 0; hop < 6; hop++) {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      thinking: { type: 'disabled' }, // ดู [[sonnet5-thinking-content-gotcha]]
      system: SYSTEM_PROMPT,
      tools: anthTools,
      messages,
    });
    messages.push({ role: 'assistant', content: res.content });
    if (res.stop_reason !== 'tool_use') {
      return res.content.find((b) => b.type === 'text')?.text ?? 'ขออภัยค่ะ เดี๋ยวให้เจ้าหน้าที่ติดต่อกลับนะคะ';
    }
    // เรียก MCP tool ที่ Claude เลือก แล้วส่งผลกลับ
    const results = [];
    for (const tu of res.content.filter((b) => b.type === 'tool_use')) {
      const r = await mcp.callTool({ name: tu.name, arguments: tu.input });
      results.push({ type: 'tool_result', tool_use_id: tu.id,
        content: r.content.map((c) => ({ type: 'text', text: c.text })) });
    }
    messages.push({ role: 'user', content: results });
  }
  return 'ขออภัยค่ะ ระบบใช้เวลานานเกินไป เดี๋ยวให้เจ้าหน้าที่ติดต่อกลับนะคะ';
}

// ---------- 4) Webhook ----------
const app = express();

app.post('/webhook', middleware(lineConfig), async (req, res) => {
  res.sendStatus(200);
  for (const event of req.body.events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;
    try {
      const answer = await askClaudeWithTools(event.message.text);
      await line.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: answer }] });
    } catch (err) {
      console.error('reply error:', err.message);
    }
  }
});

app.get('/', (_, res) => res.send('LINE Bot × MCP is running'));

const port = process.env.PORT || 3000;
connectMcp()
  .then(() => app.listen(port, () => {
    console.log(`✅ Bot × MCP running on port ${port}`);
    console.log('เปิด tunnel: npx cloudflared tunnel --url http://localhost:' + port);
  }))
  .catch((err) => { console.error('❌ เชื่อม MCP ไม่ได้:', err.message); process.exit(1); });
