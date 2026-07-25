# Lab 3-Rich (Bonus) · LINE Bot × MCP × Rich UI

ต่อยอด Lab 3: จาก bot ตอบ **ข้อความ** → bot ตอบด้วย **Flex Message, Quick Reply, ปุ่มยืนยัน (Postback), Rich Menu**
โชว์ pattern สำคัญของโลกจริง: **แยก logic ออกจาก presentation**

**เวลา:** ~30 นาที · **ทีมละ 2-3 ท่าน** · **โค้ดพร้อมใช้:** `s1-martech/line-bot-rich/`

---

## แนวคิดหลัก: 2 ชั้นแยกกัน

```
┌── logic/data ──────────┐   ┌── presentation ────────┐
│  MCP tools (showcase)  │   │  flex.js               │
│  recommend / draft /   │──▶│  → Flex Carousel       │
│  confirm / promotions  │   │  → ปุ่มยืนยัน (postback) │
│  (ตอบเป็นข้อมูล)         │   │  → Quick Reply         │
└────────────────────────┘   └────────────────────────┘
```

จุดสอน: **tool เดิมไม่ต้องแก้เลย** — อยากได้ UI สวยขึ้นแค่เพิ่มชั้น render
tool ตัวเดียวกันนี้ใช้กับเว็บ/แอป/Slack ได้ด้วย เปลี่ยนแค่ presentation

---

## 4 LINE features ที่เพิ่ม (ลองใน LINE จริง)

### 1 · Flex Carousel — การ์ดสินค้า/โปร
พิมพ์ `ผิวมันใช้ตัวไหนดี` → Claude เรียก `recommend_for_skin` → **การ์ดสินค้าเลื่อนได้** (ราคา/จุดเด่น/ปุ่มสั่งเลย)
**โลกจริง:** ลูกค้าเห็นสินค้าเป็นภาพ ไม่ใช่ข้อความยาว → conversion สูงกว่ามาก

### 2 · Quick Reply — เลือกไม่ต้องพิมพ์
พิมพ์ `สวัสดี` → bot ตอบ + **ปุ่มเลือกสภาพผิว** (ผิวมัน/แห้ง/ผสม/แพ้ง่าย)
**โลกจริง:** ลด friction — ลูกค้ากดแทนพิมพ์ ได้คำตอบตรงเร็วขึ้น

### 3 · Postback + ยืนยันออเดอร์ ⭐ (จุดสำคัญที่สุด)
พิมพ์ `ขอสั่งกันแดด GB-002 2 ชิ้น` → **การ์ดสรุปออเดอร์ + ปุ่มยืนยัน/ยกเลิก**
กด ✅ ยืนยัน → `confirm_order` execute จริง → เลขออเดอร์
**โลกจริง = governance ที่จับต้องได้:** action ที่กลับไม่ได้ (ตัดเงิน) ต้องให้ลูกค้า "เห็นด้วยตา + กดด้วยมือ" ก่อน — ตรงกับ AP2 Mandate ใน Session 3

### 4 · Rich Menu — เมนูถาวร
เมนูล่างจอ 4 ช่อง (แนะนำ/โปร/เช็คออเดอร์/เจ้าหน้าที่) — ลูกค้าเข้าถึงฟังก์ชันหลักได้ทันทีทุกเมื่อ

---

## Warm-up (10 นาที)

```bash
cd s1-martech/line-bot-rich && npm install && cp ../line-bot/.env .env && npm start
npx cloudflared tunnel --url http://localhost:3000
```
ตั้ง webhook แล้วลองพิมพ์ 4 อย่างในตาราง README เทียบผลที่ได้

---

## กลไก (อ่านโค้ด 10 นาที)

- `app.js` → `runClaude()` วน loop เก็บ **toolCalls** ไว้ · `render()` ดูว่า tool ไหนถูกเรียกล่าสุด → เลือก Flex ให้ตรง
- `flex.js` → ตัวสร้าง Flex JSON (การ์ดสินค้า/โปร/ยืนยัน) แยกจาก logic ชัดเจน
- **postback** → กดปุ่มบนการ์ด ส่ง data กลับ → `handlePostback()` → เรียก `confirm_order`

> ทำไมไม่ให้ Claude เขียน Flex JSON เอง? — schema Flex ซับซ้อน โมเดลอาจสร้าง JSON พังตอน demo สด · ใช้เทมเพลต deterministic ปลอดภัยกว่า (โลกจริงก็ทำแบบนี้)

---

## Challenge (10 นาที) — เลือก 1

- **เพิ่มปุ่ม "ดูโปร" ในการ์ดสินค้า** → postback → เรียก `get_promotions` → การ์ดโปร
- **track_order เป็น Flex timeline** (รอชำระ → แพ็ก → จัดส่ง) + ปุ่ม URI ไปเว็บขนส่ง
- **ใส่ image_url ใน products.json** แล้วให้การ์ดสินค้ามีรูป hero (โลกจริงต้องมีรูป)
- **Quick Reply หลังแนะนำสินค้า** ("สั่งเลย" / "ดูตัวอื่น" / "มีโปรไหม")

**เกณฑ์ผ่าน:** ทำงานใน LINE จริง · แยก logic (tool) กับ render (flex) ชัด · governance ยังอยู่ (ยืนยันก่อน execute)

---

## เชื่อมภาพใหญ่

| feature | โยงไป |
|---|---|
| Flex/Quick Reply/Rich Menu | UX ที่ลด friction = conversion (สถิติ chat +23% ในสไลด์หลัก) |
| ยืนยันก่อน execute (postback) | AP2 Mandate + human-in-the-loop (Session 3) |
| logic/presentation แยกชั้น | tool เดียวเปิดให้ทุก agent/ช่องทางใช้ = Integration Layer |
