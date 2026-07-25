/**
 * audit-gates.mjs — ตรวจ "4 ประตู" ของ Agent-Readiness อัตโนมัติ (Lab 1 · Session 3)
 *
 *   ประตู 1 · Structured Data  — Schema.org JSON-LD (Product/Offer/FAQ) + ราคา/สต็อกเป็นข้อความ
 *   ประตู 2 · AEO              — llms.txt + คำถาม-คำตอบที่ answer engine หยิบไปตอบได้
 *   ประตู 3 · MCP Server       — ประกาศช่องทางให้ AI เรียกข้อมูลสด
 *   ประตู 4 · Agent Card (A2A) — /.well-known/agent-card.json ประกาศความสามารถ + ขอบเขตเจรจา
 *
 * ใช้:  node audit-gates.mjs                       # ตรวจ storefront ตัวอย่างในโฟลเดอร์นี้
 *       node audit-gates.mjs https://brand.com     # ตรวจเว็บจริงของแบรนด์
 *
 * ให้คะแนนประตูละ 0-5 (รวม 20) — ใช้กรอกลง worksheet ใน audit-prompts.md ได้เลย
 */
import fs from 'node:fs';

const target = process.argv[2] || 'local';
const isUrl = /^https?:\/\//i.test(target);

// ── ดึงเนื้อหา 3 อย่าง: หน้าแรก · llms.txt · agent-card.json ──
async function fetchAll() {
  if (!isUrl) {
    const read = (p) => { try { return fs.readFileSync(new URL(p, import.meta.url), 'utf-8'); } catch { return null; } };
    return { html: read('./index.html'), llms: read('./llms.txt'), card: read('./.well-known/agent-card.json'), label: 'storefront ตัวอย่าง (local)' };
  }
  const base = target.replace(/\/$/, '');
  const get = async (path) => {
    try {
      const r = await fetch(base + path, { redirect: 'follow', signal: AbortSignal.timeout(12000) });
      return r.ok ? await r.text() : null;
    } catch { return null; }
  };
  return { html: await get('/'), llms: await get('/llms.txt'), card: await get('/.well-known/agent-card.json'), label: base };
}

const { html, llms, card, label } = await fetchAll();
if (!html) { console.error(`❌ ดึงหน้าเว็บไม่ได้: ${label}`); process.exit(2); }

// ── ประตู 1 · Structured Data ──
function gate1() {
  const notes = []; let score = 0;
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  if (!blocks.length) { notes.push('ไม่พบ JSON-LD (application/ld+json)'); return { score, notes }; }
  score += 2; notes.push(`พบ JSON-LD ${blocks.length} บล็อก`);
  let json = null;
  try { json = JSON.parse(blocks[0]); } catch { notes.push('⚠️ JSON-LD parse ไม่ผ่าน (รูปแบบผิด)'); return { score, notes }; }
  const nodes = json['@graph'] || (Array.isArray(json) ? json : [json]);
  const types = nodes.map((n) => n['@type']).flat();
  const products = nodes.filter((n) => n['@type'] === 'Product');
  if (products.length) { score += 1; notes.push(`มี Product ${products.length} รายการ`); }
  const withOffer = products.filter((p) => p.offers?.price);
  if (withOffer.length) { score += 1; notes.push(`มีราคาใน Offer ${withOffer.length} รายการ`); }
  const withStock = products.filter((p) => p.offers?.availability || p.offers?.inventoryLevel);
  if (withStock.length) { score += 1; notes.push(`มีสถานะสต็อก ${withStock.length} รายการ`); }
  else notes.push('ไม่มี availability/inventoryLevel — agent ไม่รู้ว่ามีของไหม');
  if (!types.includes('FAQPage')) notes.push('ยังไม่มี FAQPage (มีจะช่วยประตู 2 ด้วย)');
  return { score: Math.min(score, 5), notes };
}

// ── ประตู 2 · AEO / llms.txt ──
function gate2() {
  const notes = []; let score = 0;
  if (llms) {
    score += 3; notes.push(`พบ /llms.txt (${llms.length} ตัวอักษร)`);
    if (/ราคา|price|บาท|THB/i.test(llms)) { score += 1; notes.push('llms.txt มีราคา'); }
    if (/จัดส่ง|คืนสินค้า|shipping|return/i.test(llms)) { score += 1; notes.push('llms.txt มีเงื่อนไขจัดส่ง/คืนสินค้า'); }
  } else notes.push('ไม่พบ /llms.txt — agent ไม่มีสรุปที่แบรนด์เขียนเอง');
  const faq = /<details|FAQPage|itemtype="[^"]*FAQPage/i.test(html);
  if (faq) { if (score < 5) score = Math.min(score + 1, 5); notes.push('หน้าเว็บมีบล็อกคำถาม-คำตอบ'); }
  else notes.push('ไม่พบบล็อก FAQ ในหน้าเว็บ');
  return { score: Math.min(score, 5), notes };
}

// ── ประตู 3 · MCP Server ──
function gate3() {
  const notes = []; let score = 0;
  const mentionsMcp = /mcp|model context protocol/i.test(html + (llms || '') + (card || ''));
  const cardHasMcp = card && /mcp/i.test(card);
  if (mentionsMcp) { score += 2; notes.push('มีการอ้างถึง MCP ในเอกสาร/หน้าเว็บ'); }
  else notes.push('ไม่พบการประกาศ MCP server — AI ต้องเดาจากหน้าเว็บอย่างเดียว');
  if (cardHasMcp) { score += 1; notes.push('agent-card อ้างถึง MCP'); }
  notes.push('ℹ️ ประตูนี้ต้องยืนยันด้วยมือ: มี MCP server ให้เรียกจริงหรือยัง (ดู s2-mcp/)');
  return { score: Math.min(score, 5), notes };
}

// ── ประตู 4 · Agent Card (A2A) ──
function gate4() {
  const notes = []; let score = 0;
  if (!card) { notes.push('ไม่พบ /.well-known/agent-card.json — agent ฝั่งลูกค้าค้นหาเราไม่เจอเป็นระบบ'); return { score, notes }; }
  let j = null;
  try { j = JSON.parse(card); } catch { notes.push('⚠️ agent-card.json parse ไม่ผ่าน'); return { score: 1, notes }; }
  score += 2; notes.push('พบ agent-card.json และ parse ได้');
  if (Array.isArray(j.skills) && j.skills.length) { score += 1; notes.push(`ประกาศ skills ${j.skills.length} รายการ`); }
  else notes.push('ไม่มี skills — ไม่บอกว่าเอเจนต์ทำอะไรได้');
  if (j.securitySchemes || j.security) { score += 1; notes.push('ระบุวิธียืนยันตัวตน (security)'); }
  else notes.push('ไม่ระบุ security — คู่ค้าไม่รู้จะ auth อย่างไร');
  const neg = j['x-negotiable'];
  if (neg?.requiresHumanApproval?.length) { score += 1; notes.push(`ระบุขอบเขตเจรจา + จุดที่ต้องให้มนุษย์อนุมัติ (${neg.requiresHumanApproval.length} ข้อ)`); }
  else notes.push('ไม่ระบุขอบเขตเจรจา/เส้นแดง — ควรมี (โยง Lab 2)');
  return { score: Math.min(score, 5), notes };
}

const GATES = [
  { n: 1, name: 'Structured Data (Schema.org)', run: gate1 },
  { n: 2, name: 'AEO / llms.txt', run: gate2 },
  { n: 3, name: 'MCP Server', run: gate3 },
  { n: 4, name: 'Agent Card (A2A)', run: gate4 },
];

console.log(`\n🔍 Agent-Readiness Audit — ${label}\n${'═'.repeat(62)}`);
let total = 0;
for (const g of GATES) {
  const { score, notes } = g.run();
  total += score;
  const bar = '█'.repeat(score) + '░'.repeat(5 - score);
  console.log(`\nประตู ${g.n} · ${g.name}\n  ${bar}  ${score}/5`);
  notes.forEach((s) => console.log(`   • ${s}`));
}
console.log(`\n${'═'.repeat(62)}`);
console.log(`คะแนนรวม: ${total}/20  ${total >= 16 ? '🟢 พร้อมสูง' : total >= 9 ? '🟡 พอใช้ — มีจุดต้องแก้' : '🔴 agent มองไม่เห็นเราเท่าที่ควร'}`);
console.log(`\n👉 กรอกคะแนนนี้ลง worksheet ใน s3-economy/audit-prompts.md แล้วสรุป "สิ่งแรกที่ต้องแก้คือ ______"`);
