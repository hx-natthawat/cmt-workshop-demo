/**
 * agent.js — โครงกลาง: เชื่อม MCP + agentic loop (Claude เลือกเรียก tools)
 * ใช้ร่วมกันทุกช่องทาง (LINE ใน app.js · Web ใน webchat.mjs) = logic เดียว หลายช่องทาง
 */
const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `คุณคือพนักงานขายของร้าน Glow Beauty Thailand ตอบภาษาไทยสุภาพ กระชับ (1-3 ประโยค)
- ใช้ tools ดึงข้อมูลจริงเสมอ (แนะนำสินค้า, โปรโมชัน, เช็คสต็อก/ออเดอร์, ร่างออเดอร์) ห้ามเดา
- การสั่งซื้อ: ใช้ create_draft_order เท่านั้น ห้ามยืนยันแทนลูกค้า
- ตอบสั้นๆ (ระบบอาจแสดงการ์ดให้อยู่แล้ว)`;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
let mcp = null;
let anthTools = [];

async function connectMcp() {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const serverPath = new URL('../../s2-mcp/showcase/server.mjs', `file://${__filename}`).pathname;
  const transport = new StdioClientTransport({ command: 'node', args: [serverPath] });
  mcp = new Client({ name: 'glow-agent', version: '1.0.0' });
  await mcp.connect(transport);
  const { tools } = await mcp.listTools();
  anthTools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  return anthTools.map((t) => t.name);
}

const callTool = async (name, args) => {
  const r = await mcp.callTool({ name, arguments: args });
  return r.content.map((c) => c.text).join('\n');
};

const FALLBACK = 'ขออภัยค่ะ เดี๋ยวให้เจ้าหน้าที่ติดต่อกลับนะคะ';

// บางครั้งโมเดลพ่นคำสั่งเรียก tool ออกมาเป็น "ข้อความ" (`<invoke name="...">`) แทน tool_use block
// ถ้าปล่อยผ่าน ลูกค้าจะเห็น XML ดิบในแชท — ตัดทิ้งก่อนเสมอ
const stripToolXml = (t) => (t || '')
  .replace(/<invoke[\s\S]*?<\/invoke>/g, '')
  .replace(/<\/?(invoke|parameter|function_calls|antml:[a-z_]+)[^>]*>/g, '')
  .trim();

const MAX_RETRIES = 2;

/**
 * ตัดสินใจว่าจะทำอะไรต่อกับคำตอบหนึ่งก้อนจากโมเดล — ฟังก์ชันบริสุทธิ์ ทดสอบได้โดยไม่ต้องยิง API
 *
 * คืน { kind }:
 *   'final'  → จบ ใช้ text ตอบลูกค้า
 *   'tools'  → มี tool_use จริง เรียกต่อได้
 *   'retry'  → โมเดลบอกว่าจะเรียก tool แต่ไม่มี tool_use block (เคยเจอจริง — ดู LAB3-RICH)
 *   'giveup' → retry ครบแล้วยังไม่ได้ ตอบเท่าที่มี
 *
 * ⚠️ จุดสำคัญ: **ห้ามเชื่อ stop_reason อย่างเดียว** ต้องเช็คว่ามี block ที่จะใช้จริงหรือไม่
 * ถ้าส่ง tool_result ว่างกลับไป API จะตอบ 400 "must have non-empty content" แล้วบอทเงียบ
 */
function planFromResponse(res, retriesSoFar = 0) {
  const content = res?.content || [];
  const toolUses = content.filter((b) => b.type === 'tool_use');
  const text = stripToolXml(content.find((b) => b.type === 'text')?.text) || FALLBACK;
  if (res?.stop_reason !== 'tool_use') return { kind: 'final', text, toolUses: [] };
  if (!toolUses.length) return retriesSoFar < MAX_RETRIES ? { kind: 'retry', text, toolUses: [] } : { kind: 'giveup', text, toolUses: [] };
  return { kind: 'tools', text, toolUses };
}

// รัน loop → คืน { text, toolCalls:[{name,input,resultText}] }
async function runAgent(userText) {
  const messages = [{ role: 'user', content: userText }];
  const toolCalls = [];
  let retries = 0;
  for (let hop = 0; hop < 6; hop++) {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-5', max_tokens: 1024, thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT, tools: anthTools, messages,
    });
    const plan = planFromResponse(res, retries);

    if (plan.kind === 'retry') { retries++; continue; }      // ยิงคำถามเดิมใหม่ ไม่แตะ messages
    if (plan.kind === 'giveup') return { text: plan.text, toolCalls };
    if (plan.kind === 'final') {
      messages.push({ role: 'assistant', content: res.content });
      return { text: plan.text, toolCalls };
    }

    messages.push({ role: 'assistant', content: res.content });
    const results = [];
    for (const tu of plan.toolUses) {
      const resultText = await callTool(tu.name, tu.input);
      toolCalls.push({ name: tu.name, input: tu.input, resultText });
      // tool_result ที่ text ว่าง ก็โดน 400 เหมือนกัน — ใส่ข้อความแทนไว้เสมอ
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: [{ type: 'text', text: resultText || '(ไม่มีข้อมูล)' }] });
    }
    messages.push({ role: 'user', content: results });
  }
  return { text: 'ขออภัยค่ะ ระบบใช้เวลานานเกินไป เดี๋ยวให้เจ้าหน้าที่ติดต่อกลับนะคะ', toolCalls };
}

module.exports = { connectMcp, runAgent, callTool, planFromResponse, stripToolXml, MAX_RETRIES };
