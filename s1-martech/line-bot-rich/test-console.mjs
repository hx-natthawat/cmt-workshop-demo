/**
 * test-console.mjs — ตรวจ "ประตูกันส่งจริง" ของ Marketing Console
 *
 * ทำไมต้องมี: endpoint สองตัวนี้ส่งข้อความถึงลูกค้าจริง (broadcast = ทุกคน · restock = รายคน)
 * ป้องกันด้วยการเทียบสตริงบรรทัดเดียว `confirm !== 'SEND'` — ถ้าบรรทัดนั้นพัง
 * ความเสียหายไม่ใช่ "เดโมไม่สวย" แต่คือ **ข้อความหลุดถึงลูกค้าจริง + กินโควตา**
 *
 * ⚠️ เทสต์นี้ทดสอบ **เฉพาะทางที่ต้องถูกปฏิเสธ** — ไม่มีเคสไหนส่งจริงสักเคส
 *    ใช้ token ปลอม: ถ้าโค้ดเผลอยิงไป LINE จริง เทสต์จะพัง = สิ่งที่เราต้องการ
 *
 * รัน:  npm run test:console
 */
import { spawn } from 'node:child_process';
import os from 'node:os';
import net from 'node:net';

const PORT = 3105; // ไม่ใช้ 3100 เพื่อไม่ชน console ที่อาจเปิดค้างอยู่
const BASE = `http://127.0.0.1:${PORT}`;

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`); }
};

const post = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

const waitUp = async (ms = 15000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { const r = await fetch(BASE + '/'); if (r.ok) return true; } catch { /* ยังไม่ขึ้น */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
};

// token ปลอม — พอให้ server สตาร์ทได้ แต่ถ้าถูกใช้ยิงจริงจะ auth ไม่ผ่าน
const child = spawn(process.execPath, ['console.mjs'], {
  cwd: import.meta.dirname,
  env: { ...process.env, PORT: String(PORT), LINE_CHANNEL_ACCESS_TOKEN: 'dummy-token-for-guard-test' },
  stdio: 'ignore',
});
const stop = () => { try { child.kill('SIGTERM'); } catch { /* ปิดไปแล้ว */ } };
process.on('exit', stop);

if (!(await waitUp())) { console.error('❌ console ไม่ขึ้นภายในเวลาที่กำหนด'); stop(); process.exit(1); }

console.log('\n▌1. broadcast — ต้องถูกปฏิเสธทุกกรณีที่ยืนยันไม่ครบ');
for (const [label, body] of [
  ['ไม่ส่ง confirm มาเลย', {}],
  ['confirm ว่าง', { confirm: '' }],
  ['confirm ตัวพิมพ์เล็ก "send"', { confirm: 'send' }],
  ['confirm มีช่องว่างต่อท้าย "SEND "', { confirm: 'SEND ' }],
  ['confirm เป็น true (ไม่ใช่สตริง)', { confirm: true }],
]) {
  const r = await post('/api/broadcast', body);
  t(label, r.json.ok === false && String(r.json.error || '').includes('SEND'), JSON.stringify(r.json).slice(0, 120));
}

console.log('\n▌2. restock-notify — ประตูยืนยัน + ตรวจสต็อกก่อนแจ้ง');
let r = await post('/api/restock-notify', { sku: 'GB-004' });
t('ไม่มี confirm → ปฏิเสธ', r.json.ok === false && String(r.json.error || '').includes('SEND'), JSON.stringify(r.json).slice(0, 120));

r = await post('/api/restock-notify', { sku: 'GB-999', confirm: 'SEND' });
t('sku ไม่มีจริง → ปฏิเสธ (ไม่ยิง LINE)', r.json.ok === false && String(r.json.error || '').includes('ไม่พบ'), JSON.stringify(r.json).slice(0, 120));

// GB-004 stock = 0 → ห้ามแจ้ง "ของเข้าแล้ว" เด็ดขาด แม้ยืนยันถูกต้อง
r = await post('/api/restock-notify', { sku: 'GB-004', confirm: 'SEND' });
t('สินค้ายัง stock 0 → ปฏิเสธแม้ confirm ถูก', r.json.ok === false && String(r.json.error || '').includes('ยังหมด'), JSON.stringify(r.json).slice(0, 120));

console.log('\n▌3. ขอบเขตการเข้าถึง');
const r404 = await fetch(BASE + '/api/ไม่มีจริง');
t('path ที่ไม่มี → 404', r404.status === 404, `ได้ ${r404.status}`);

// bind 127.0.0.1 เท่านั้น — ถ้าเผลอ bind 0.0.0.0 คอนโซลจะโผล่ผ่าน tunnel/วง LAN
const lan = Object.values(os.networkInterfaces()).flat()
  .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
if (!lan) {
  console.log('  ⏭️  ข้ามการตรวจ bind — เครื่องนี้ไม่มี IP วง LAN');
} else {
  const reachable = await new Promise((resolve) => {
    const s = net.connect({ host: lan, port: PORT, timeout: 2000 });
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
    s.on('timeout', () => { s.destroy(); resolve(false); });
  });
  t(`ต่อจาก IP วง LAN (${lan}) ไม่ได้ — bind localhost เท่านั้น`, reachable === false, 'ต่อได้ = คอนโซลเปิดออกนอกเครื่อง');
}

console.log(`\n═══ สรุป: ✅ ${pass} ผ่าน · ❌ ${fail} พัง ═══`);
console.log('   (ไม่มีเคสใดส่งข้อความจริง — ทดสอบเฉพาะทางที่ต้องถูกปฏิเสธ)\n');
stop();
process.exit(fail ? 1 : 0);
