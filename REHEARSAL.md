# Rehearsal Run-of-Show — วันซ้อม & วันงาน

Checklist หน้าเดียวสำหรับซ้อมจริง (D-7/D-3) และเปิดตามลำดับในวันงาน
รวมจาก `Demo_Prep_Playbook.md` + เด็ค `AI_for_MarTech_Workshop_HTML_Deck.html`
ทุก demo ต้องผ่านครบ **2 รอบ** ก่อนวันงาน + มีวิดีโอสำรองใน `recordings/`

> กฎเหล็ก: ห้อง chat สะอาดเสมอ · ทุก demo มีวิดีโอแฝด (พัง→สลับใน 10 วิ) · อย่า demo โค้ดที่เพิ่งแก้โดยยังไม่ซ้อม 2 รอบ · token/key ไม่ขึ้นจอ · ซ้อมผ่านเน็ตมือถือ 1 รอบ

---

## ก่อนเริ่มทุกครั้ง (setup 1 ครั้ง/วัน)

- [ ] `git pull` + อยู่ commit ล่าสุดของ `main`
- [ ] `.env` ครบทุกโปรเจกต์ (line-bot) · `.dev.vars` (remote) — token ยังไม่หมดอายุ
- [ ] เปิด Do Not Disturb · ปิด notification · ซ่อน bookmark bar/ไฟล์ส่วนตัว
- [ ] Claude เปิดโปรเจกต์แยกสำหรับ demo (ห้อง chat สะอาด)

---

## Session 1 · AI for MarTech

### ▌D1.1 — Live Demo หลัก: Claude + customer_data.csv  (~5 นาที)
ลำดับ: อัปโหลด `s1-martech/customer_data.csv` → รัน 3 prompts จาก `s1-martech/prompts.md` ตามลำดับ

- [ ] Prompt 1 (Explore) → insight 5 ข้อ **อ้างเลขจริงจากไฟล์**
- [ ] Prompt 2 (Analyze) → RFM แบ่ง 4-5 กลุ่ม **มีชื่อไทย**
- [ ] Prompt 3 (Recommend) → dashboard artifact **เปิด render ได้**
- ⏱️ เกิน 5 นาที → ตัด Prompt 3 เหลือแค่ dashboard
- 🔻 fallback: เน็ตล่ม → เปิดวิดีโอ · Claude คิวยาว → เปิด artifact ที่ generate ไว้ล่วงหน้า

### ▌D1.2 — Vibe Coding สาธิตสด  (~1 นาที · optional)
เปิด `s1-martech/vibe/utm_builder.html` ต่อหน้าห้อง แล้วสั่ง Claude แก้สด

- [ ] คำสั่งซ้อม: **"เปลี่ยนสีปุ่มใน utm_builder.html เป็นสีเขียว แล้วเพิ่มปุ่ม reset ที่ล้างทุกช่อง"**
- [ ] เห็นผลชัดใน 1 รอบ (ไฟล์นี้ตั้งใจให้ปุ่มยังไม่เป็นเขียว + ยังไม่มี reset)
- 🔻 fallback: ข้ามได้ ไม่เสียเนื้อหา

### ▌D1.3 — Mini-Lab เฉลย (โชว์ปิดท้าย/fallback ให้ทีมทำไม่ทัน)
ไฟล์เฉลยพร้อมใน `s1-martech/vibe/` — เปิด render ได้ทั้ง 3:

- [ ] `utm_builder.html` (A) — โทน `#345589` ตรง prompt starter
- [ ] `roi_calculator.html` (B) — ROAS/ROI/CPO/break-even คำนวณสด
- [ ] `mini_dashboard.html` (C) — ข้อมูลจริง 300 ราย + RFM + กราฟช่องทาง

### ▌D1.4 — LINE Bot end-to-end  ⚠️ พังง่ายสุด — ซ้อมเต็ม flow ≥2 รอบ

**ก่อนต่อ tunnel ทุกครั้ง** (ถ้าจะเดโมตัว rich — เร็วกว่ามานั่งหาสาเหตุตอนบอทเงียบ):
```
cd s1-martech/line-bot-rich && npm test && npm run rehearse
```
ทั้งคู่ต้องเขียว — `rehearse` ตรวจ Flex ตามข้อจำกัดจริงของ LINE (บอทเงียบส่วนใหญ่คือโดน 400 จาก Flex ผิด)

```
cd s1-martech/line-bot && npm install && npm start
npx cloudflared tunnel --url http://localhost:3000
```
ตั้ง URL + `/webhook` ใน LINE Developers Console → Verify → เปิด Use webhook → **ปิด auto-reply ใน OA Manager** (ลืมบ่อยสุด)

ทดสอบ **4 คำถามบังคับ**:
- [ ] "ครีมกันแดดผิวมัน" → แนะนำ GB-002
- [ ] "มีโปรอะไร" → คืนโปรโมชันจริง
- [ ] "โฟมล้างหน้ามีของไหม" → **ต้องตอบว่าหมด** (GB-004 stock 0)
- [ ] "ขายรองเท้าไหม" → **ต้องไม่เดา** (ตอบให้เจ้าหน้าที่ติดต่อกลับ)
- ⚠️ line-bot เพิ่งอัปเป็น @line/bot-sdk v11 — **ต้องซ้อม flow นี้ให้ผ่าน 2 รอบก่อนจะ tag v0.3.0**
- 🔻 fallback: webhook พัง → เปิดวิดีโอ end-to-end

---

## Session 2 · Advanced MCP

### ▌D2.1 — Lab MCP-1: Build (stdio)  + เพิ่ม tool สด
```
cd s2-mcp/local && npm install && npm start        # 3 tools พร้อม
npm run inspect                                      # MCP Inspector
```
- [ ] Inspector เห็นครบ 3 tools · เรียกทุกตัวเห็น request/response
- [ ] audit log ขึ้นทุก tool call (ดู stderr)
- [ ] ซ้อมประโยคเพิ่ม tool สด: **"เพิ่ม tool ชื่อ get_bestsellers ใน server.mjs คืนสินค้า 3 อันดับที่ stock ต่ำสุดเทียบราคา ตามแพทเทิร์นเดียวกับ tool อื่น พร้อม audit"**
- 🔻 fallback: Inspector ไม่ขึ้น → โชว์ audit log ใน terminal แทน

### ▌D2.2 — Lab MCP-2: Deploy remote (Cloudflare Workers)
```
cd s2-mcp/remote && npm install
npx wrangler login
npx wrangler secret put DEMO_API_KEY                 # key ไม่ขึ้นจอ
npm run deploy
```
- [ ] ได้ URL `https://glow-beauty-mcp.<subdomain>.workers.dev`
- [ ] ทดสอบจากเครื่องที่สอง: `REMOTE_MCP_URL=https://.../mcp DEMO_API_KEY=<key> ./smoke-test.sh`
- [ ] key ผิด → 401 · key ถูก → serverInfo `glow-beauty-products`
- 🔻 fallback: deploy พัง → เปิดวิดีโอ + โชว์ local (D2.1) ว่าโค้ดชุดเดียวกัน

---

## Session 3 · Agent Economy

### ▌Lab 1 — Agent-Readiness Audit (`s3-economy/audit-prompts.md`)
- [ ] เติมตารางแบรนด์ก่อนวันงาน (≥3 แบรนด์) พร้อมคะแนน 4 ประตู /20
- [ ] ⚠️ อย่าใช้แบรนด์ของผู้เรียนเป็นตัวอย่าง "แย่" บนจอ

### ▌Lab 2 — Agent Commerce Journey (`s3-economy/lab2-journey-canvas.md`)
- [ ] canvas 4 ช่อง + journey 5 ขั้น + 3 Mandates + Readiness Ladder พร้อมใช้
- [ ] ซ้อมอธิบาย journey เชื่อม MCP (ขั้น 3) กับ Advanced MCP ที่เรียนมา

---

## Smoke test รวม (D-1 เช้าวันงาน)
```
./smoke-test.sh                                        # local ทั้งหมด
REMOTE_MCP_URL=https://.../mcp ./smoke-test.sh         # รวม remote หลัง deploy
```
- [ ] ทุกด่านขึ้น ✅ · exit 0
- [ ] token/key ทุกตัวยังไม่หมดอายุ · อุปกรณ์ชาร์จเต็ม · hotspot พร้อม
- [ ] เปิดวิดีโอสำรองทุกตัวเช็คว่าเล่นได้

---

## สถานะ release
- `v0.1.0` — D-10: Remote MCP + Mini-Lab · `v0.2.0` — D-7: smoke-test
- `v0.3.0` — **ยังไม่ tag** (รอซ้อม line-bot 2 รอบหลังอัป SDK major ให้ผ่านก่อน)
