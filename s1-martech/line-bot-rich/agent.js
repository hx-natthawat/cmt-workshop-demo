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

// รัน loop → คืน { text, toolCalls:[{name,input,resultText}] }
async function runAgent(userText) {
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

module.exports = { connectMcp, runAgent, callTool };
