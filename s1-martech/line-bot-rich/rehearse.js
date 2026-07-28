/**
 * rehearse.js — ซ้อมบอทหน้างานแบบ headless (ไม่ต้องมี LINE / ไม่ต้อง tunnel)
 *
 * ทำอะไร: วิ่ง pipeline จริง (Claude → MCP showcase → renderer) ตามสถานการณ์ที่จะเดโม
 * แล้ว **ตรวจทุก message ตามข้อจำกัดของ LINE ก่อนส่งจริง**
 * — จับปัญหาที่มักพังบนเวที: Flex ผิดโครงสร้าง, altText หาย, postback data ยาวเกิน
 *
 * ครอบคลุมทั้ง 2 ทาง: ข้อความปกติ + postback (buy / confirm / cancel)
 *
 * รัน:  npm run rehearse            # ทุกสถานการณ์
 *       npm run rehearse -- 3       # เฉพาะข้อ 3
 *       npm run rehearse -- x3      # วัดความเสถียร: รันซ้ำ 3 รอบ ดูว่าคำถามไหนโมเดลตอบไม่เหมือนเดิม
 *
 * ต้องมี ANTHROPIC_API_KEY ใน .env · ไม่ต้องมี LINE token (ไม่ยิงไป LINE เลย)
 */
require('dotenv').config();
const agent = require('./agent');
const flex = require('./flex');
const { render, matchSoldOut } = require('./render');
const { validateReply } = require('./validate-line');

// สถานการณ์ตามสคริปต์เดโม — ครอบคลุม renderer ทุกสาขา
const SCENARIOS = [
  { id: 1, kind: 'text', label: 'แนะนำสินค้าตามสภาพผิว → ควรได้ carousel', input: 'ผิวแห้งมาก แนะนำอะไรดีคะ', expect: 'flex' },
  { id: 2, kind: 'text', label: 'ถามโปรโมชัน → ควรได้ promotion carousel', input: 'ตอนนี้มีโปรอะไรบ้างคะ', expect: 'flex' },
  { id: 3, kind: 'text', label: 'ขอสั่งซื้อ → ควรได้การ์ดยืนยัน (governance)', input: 'ขอสั่ง GB-001 จำนวน 2 ชิ้นค่ะ', expect: 'flex' },
  { id: 4, kind: 'text', label: 'ถามสินค้าขายดี → ควรได้ carousel', input: 'ขายดีสุดตอนนี้คืออะไรคะ', expect: 'flex' },
  { id: 5, kind: 'text', label: 'ถามทั่วไป → ควรได้ข้อความ + quick reply', input: 'ส่งของกี่วันถึงคะ', expect: 'text' },
  // คำถามบังคับข้อ 3 ใน REHEARSAL.md — บอทต้องตอบว่า "หมด" ไม่ใช่เดาหรือถามกลับ
  { id: 6, kind: 'text', label: 'ถามสินค้าที่หมด → ต้องตอบว่าหมด + เข้าเงื่อนไข restock', input: 'โฟมล้างหน้ายังมีไหมคะ', expect: 'any', wantRestock: true, wantText: /หมด/ },
  // postback — จำลอง event ที่เกิดตอนผู้ใช้กดปุ่มบนการ์ด
  { id: 7, kind: 'postback', label: 'กดปุ่ม "สั่งเลย" บนการ์ดสินค้า', data: { a: 'buy', sku: 'GB-001' } },
  { id: 8, kind: 'postback', label: 'กดปุ่ม "ยืนยันสั่งซื้อ"', data: { a: 'confirm', items: [{ sku: 'GB-001', qty: 1 }] } },
  { id: 9, kind: 'postback', label: 'กดปุ่ม "ยกเลิก"', data: { a: 'cancel' } },
];

// ทำแบบเดียวกับ handlePostback ใน app.js (แต่ไม่ยิง LINE) — ถ้าแก้ที่นั่นต้องแก้ที่นี่ด้วย
async function runPostback(d) {
  if (d.a === 'buy') return render(await agent.runAgent(`ขอสั่ง ${d.sku} จำนวน 1 ชิ้น`));
  if (d.a === 'confirm') return [{ type: 'text', text: await agent.callTool('confirm_order', { items: d.items }) }];
  return [{ type: 'text', text: 'ยกเลิกคำสั่งซื้อแล้วค่ะ 🙏', quickReply: flex.skinQuickReply }];
}

const kinds = (msgs) => msgs
  .map((m) => (m.type === 'flex' ? `flex:${m.contents?.type}` : m.type) + (m.quickReply ? `+qr(${m.quickReply.items.length})` : ''))
  .join(' + ');

// ใช้ตัวจับเดียวกับ captureRestock แต่ **ไม่เขียนข้อมูลจริง**
// (ซ้อมไม่ควรทิ้งขยะไว้ใน data/restock-interest.json)
const restockHit = (text) => matchSoldOut(text);

/**
 * โหมดวัดความเสถียร — รันซ้ำหลายรอบแล้วดูว่าโมเดลเลือก tool เหมือนเดิมไหม
 *
 * ทำไมสำคัญ: เดโมสดพึ่ง "โมเดลเรียก tool ที่คาด" ถ้าคำถามไหนผลสุ่ม
 * ผู้ชมจะเห็นหน้าตาต่างจากตอนซ้อม — ควรรู้ก่อนขึ้นเวที ไม่ใช่รู้ตอนอยู่บนเวที
 */
async function stability(list, rounds) {
  // ต้องต่อ MCP ก่อนเสมอ — ไม่งั้น agent ไม่มี tool ให้เลือก แล้วผลจะดู "เสถียร" แบบหลอกๆ
  const names = await agent.connectMcp();
  const texts = list.filter((s) => s.kind === 'text'); // postback เป็น deterministic ไม่ต้องวัด
  console.log(`\n📊 วัดความเสถียร · MCP ${names.length} tools · ${texts.length} คำถาม × ${rounds} รอบ = ${texts.length * rounds} ครั้ง`);
  console.log('   (postback ข้าม — เป็น deterministic อยู่แล้ว)\n');

  const results = new Map(texts.map((s) => [s.id, []]));
  for (let round = 1; round <= rounds; round++) {
    process.stdout.write(`รอบ ${round}/${rounds} `);
    for (const s of texts) {
      try {
        const out = await agent.runAgent(s.input);
        const msgs = render(out);
        results.get(s.id).push({
          tools: out.toolCalls.map((c) => c.name).join('+') || '(ไม่เรียก tool)',
          flex: msgs.some((m) => m.type === 'flex'),
          errs: validateReply(msgs).length,
        });
        process.stdout.write('.');
      } catch (err) {
        // แยก API error ออกจาก "โมเดลเลือก tool ไม่คงที่" — คนละปัญหา คนละวิธีแก้
        results.get(s.id).push({ apiError: err.message.slice(0, 200) });
        process.stdout.write('x');
      }
    }
    process.stdout.write('\n');
  }

  console.log('\n═══ ผลความเสถียร ═══\n');
  let unstable = 0, broken = 0, apiFails = 0;
  for (const s of texts) {
    const runs = results.get(s.id);
    const okRuns = runs.filter((r) => !r.apiError);
    const errRuns = runs.filter((r) => r.apiError);
    apiFails += errRuns.length;
    const variants = [...new Set(okRuns.map((r) => r.tools))];
    const flexN = okRuns.filter((r) => r.flex).length;
    const errN = okRuns.reduce((n, r) => n + r.errs, 0);
    const stable = variants.length <= 1;   // ตัดสินจากรอบที่เรียกสำเร็จเท่านั้น
    if (!stable) unstable++;
    if (errN) broken++;
    console.log(`${stable ? '🟢' : '🟡'} ข้อ ${s.id} · "${s.input}"`);
    console.log(`   tool ที่เรียก: ${variants.map((v) => `${v} (${okRuns.filter((r) => r.tools === v).length}/${okRuns.length})`).join(' · ') || '—'}`);
    console.log(`   ได้ Flex ${flexN}/${okRuns.length} รอบ${errN ? ` · ⚠️ ผิดข้อจำกัด LINE ${errN} จุด` : ''}`);
    if (errRuns.length) {
      // ไม่ใช่ปัญหาของคำถาม — เป็นฝั่ง API (เน็ต/rate limit/overloaded) แก้ด้วยการ retry ไม่ใช่แก้ prompt
      console.log(`   🔌 API error ${errRuns.length}/${rounds} รอบ: ${errRuns[0].apiError}`);
    }
    if (!stable) console.log('   👉 ผลไม่คงที่ — ถ้าจะใช้บนเวที ควรปรับคำถามให้ชี้เฉพาะเจาะจงกว่านี้');
    console.log('');
  }
  console.log(`═══ สรุป: 🟢 เสถียร ${texts.length - unstable} · 🟡 ผลไม่คงที่ ${unstable} · ❌ ผิดข้อจำกัด LINE ${broken}${apiFails ? ` · 🔌 API error ${apiFails} ครั้ง (ชั่วคราว — ลองใหม่)` : ''} ═══\n`);
  // API error ไม่ถือว่าเทสต์พัง (เน็ต/rate limit) — พังเฉพาะเมื่อ message ผิดข้อจำกัดของ LINE
  process.exit(broken ? 1 : 0);
}

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ต้องมี ANTHROPIC_API_KEY ใน .env (ดู .env.example)');
    process.exit(2);
  }
  const arg = process.argv[2] || '';
  // โหมดวัดความเสถียร: "x3" = รันทุกสถานการณ์ 3 รอบ แล้วสรุปว่าอันไหนผลไม่คงที่
  const repeat = /^x(\d+)$/.test(arg) ? Number(arg.slice(1)) : 1;
  const only = repeat === 1 && arg ? Number(arg) : null;
  const list = only ? SCENARIOS.filter((s) => s.id === only) : SCENARIOS;
  if (repeat > 1) return stability(list, repeat);

  const names = await agent.connectMcp();
  console.log(`\n🎬 ซ้อม line-bot-rich แบบ headless · MCP ${names.length} tools · ${list.length} สถานการณ์`);
  console.log('   (ไม่ยิงไป LINE — ตรวจ Flex ตามข้อจำกัดจริงของ LINE แทน)\n');

  let pass = 0, fail = 0;
  for (const s of list) {
    const t0 = Date.now();
    process.stdout.write(`▌${s.id}. ${s.label}\n`);
    let msgs, tools = [];
    try {
      if (s.kind === 'text') {
        const out = await agent.runAgent(s.input);
        tools = out.toolCalls.map((c) => c.name);
        msgs = render(out);
      } else {
        msgs = await runPostback(s.data);
      }
    } catch (err) {
      console.log(`  ❌ พังตอนรัน: ${err.message}\n`); fail++; continue;
    }

    const errs = validateReply(msgs);
    if (s.wantText) {
      const all = msgs.map((m) => m.text || '').join(' ');
      if (!s.wantText.test(all)) errs.push(`คำตอบไม่มี ${s.wantText} — ได้: "${all.slice(0, 90)}"`);
    }
    if (s.wantRestock) {
      const sku = restockHit(s.input);
      if (sku) console.log(`  restock: จับคีย์เวิร์ดได้ → ${sku} (ของจริงจะบันทึกลง data/restock-interest.json)`);
      else errs.push('ไม่เข้าเงื่อนไข restock — คีย์เวิร์ดสินค้าที่หมดไม่ตรง ลูกค้าจะไม่ถูกเก็บไว้แจ้งของเข้า');
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ${s.kind === 'text' ? `input: "${s.input}"` : `postback: ${JSON.stringify(s.data)}`}`);
    if (tools.length) console.log(`  tools: ${tools.join(' → ')}`);
    console.log(`  ตอบกลับ: ${msgs.length} message (${kinds(msgs)}) · ${secs}s`);

    if (errs.length) {
      errs.forEach((e) => console.log(`  ❌ ${e}`));
      fail++;
    } else if (s.expect === 'flex' && !msgs.some((m) => m.type === 'flex')) {
      // ไม่ใช่บั๊ก — แต่เดโมจะไม่ว้าวถ้าไม่ได้การ์ด ต้องรู้ก่อนขึ้นเวที
      console.log('  ⚠️  ผ่านการตรวจ แต่ไม่ได้ Flex (โมเดลไม่เรียก tool ที่คาด) — ลองปรับคำถามในสคริปต์เดโม');
      pass++;
    } else {
      console.log('  ✅ ผ่านทุกข้อจำกัดของ LINE');
      pass++;
    }
    console.log('');
  }

  console.log(`═══ สรุป: ✅ ${pass} ผ่าน · ❌ ${fail} พัง ═══`);
  if (!fail) console.log('👉 ส่งขึ้น LINE ได้โดยไม่โดน 400 · ขั้นต่อไปคือซ้อมกับ LINE จริงผ่าน tunnel\n');
  process.exit(fail ? 1 : 0);
})();
