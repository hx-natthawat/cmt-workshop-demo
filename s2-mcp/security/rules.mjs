/**
 * rules.mjs — กฎตรวจจับ tool poisoning (แหล่งความจริงเดียว)
 * ใช้ร่วมกันโดย scan-tools.mjs (CLI) และ report.mjs (UI)
 *
 * แนวคิด: คำอธิบาย tool ควรบอก "หน้าที่" เท่านั้น — ถ้ามีถ้อยคำสั่งการต่อโมเดล = ผิดปกติ
 */
export const RULES = [
  { id: 'hidden-markup', sev: 'high', re: /<!--[\s\S]*?-->|<script|<\/?system>/i,
    label: 'markup ซ่อน',
    why: 'มี markup ซ่อน (HTML comment/tag) — ใช้ซ่อนคำสั่งจากสายตาผู้ใช้' },
  { id: 'instruction-injection', sev: 'high',
    re: /(ignore (all |the )?(previous|prior)|disregard .{0,20}instruction|you must (always|never)|system note|system prompt|ก่อนตอบ.{0,30}(ให้|ต้อง)|ห้ามบอกผู้ใช้|อย่าบอกผู้ใช้|เพิกเฉยคำสั่ง)/i,
    label: 'คำสั่งฝัง (prompt injection)',
    why: 'มีถ้อยคำสั่งการต่อโมเดล (prompt injection) ไม่ใช่คำอธิบายหน้าที่ของ tool' },
  { id: 'secret-access', sev: 'high',
    re: /(\.env\b|credential|api[_ -]?key|secret key|private key|password|token ของ|~\/\.ssh)/i,
    label: 'อ้างถึงความลับ',
    why: 'อ้างถึงความลับ/ไฟล์ลับ — คำอธิบาย tool ปกติไม่ต้องพูดถึงสิ่งเหล่านี้' },
  { id: 'exfiltration', sev: 'high',
    re: /(ส่งข้อมูล.{0,20}(ไปยัง|ออก)|upload .{0,15}to|POST .{0,15}https?:\/\/|curl |fetch\(|webhook)/i,
    label: 'ส่งข้อมูลออก',
    why: 'สั่งส่งข้อมูลออกนอกระบบ' },
  { id: 'chain-other-tools', sev: 'medium',
    re: /(เรียก tool|call (the )?tool|ให้เรียกใช้.{0,15}(เครื่องมือ|tool)|then call)/i,
    label: 'สั่งเรียก tool อื่น',
    why: 'สั่งให้เรียก tool อื่นต่อ — อาจพาไปทำสิ่งที่ผู้ใช้ไม่ได้ขอ' },
  { id: 'hidden-chars', sev: 'medium', re: /[​-‏‪-‮﻿]/,
    label: 'อักขระล่องหน',
    why: 'มีอักขระล่องหน (zero-width/RTL override) — ใช้ซ่อนข้อความ' },
  { id: 'oversized', sev: 'low', test: (d) => d.length > 600,
    label: 'คำอธิบายยาวผิดปกติ',
    why: 'คำอธิบายยาวผิดปกติ (>600 ตัวอักษร) — ที่ซ่อนคำสั่งได้ง่าย' },
];

/** ตรวจคำอธิบาย 1 อัน → { hits, spans } · spans = ช่วงตัวอักษรที่ผิดกฎ (ไว้ทำ highlight ใน UI) */
export function scanDescription(desc = '') {
  const hits = [];
  const spans = [];
  for (const r of RULES) {
    if (r.test) { if (r.test(desc)) hits.push(r); continue; }
    const m = desc.match(r.re);
    if (m) {
      hits.push(r);
      if (m.index !== undefined) spans.push({ start: m.index, end: m.index + m[0].length, sev: r.sev, id: r.id });
    }
  }
  return { hits, spans };
}

/** รวมคะแนนความเสี่ยงของ server ทั้งตัว */
export function summarize(results) {
  let high = 0, medium = 0, low = 0;
  for (const r of results) for (const h of r.hits) {
    if (h.sev === 'high') high++; else if (h.sev === 'medium') medium++; else low++;
  }
  return { high, medium, low, verdict: high ? 'danger' : medium ? 'warn' : 'ok' };
}
