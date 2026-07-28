# Lab MCP-3 (Bonus) · MCP in the Real World

ต่อยอดจาก Lab MCP-1 (สร้าง server) + MCP-2 (deploy) — คราวนี้เห็นภาพว่า **MCP ใช้จริงในธุรกิจอย่างไร**
เชื่อมกับ demo LINE bot: ข้อมูลชุดเดียวกัน (`products.json`) แต่เปิดให้ AI เข้าถึงแบบมีสิทธิ์ควบคุมผ่าน MCP

**เวลา:** ~30 นาที · **ทีมละ 2-3 ท่าน** · **โค้ดพร้อมใช้:** `s2-mcp/showcase/`

---

## ทำไมต้องมี Lab นี้

Lab MCP-1 สอน 3 tools แบบ read-only (search / stock / promo) — แต่ธุรกิจจริงต้องการมากกว่านั้น:
แนะนำสินค้าเฉพาะบุคคล · เช็คสถานะออเดอร์จากระบบหลังบ้าน · รับออเดอร์ (แต่ต้องมีคนอนุมัติ) · ดู analytics

Lab นี้โชว์ **4 pattern โลกจริง + MCP ครบทั้ง 3 primitives** ที่ Lab MCP-1 ยังไม่ได้แตะ (resources, prompts)

---

## Warm-up (5 นาที) — รันแล้วส่องด้วย Inspector

```bash
cd s2-mcp/showcase && npm install && npm run inspect
```

ใน MCP Inspector สังเกต 3 แท็บ:
- **Tools** (4) — ฟังก์ชันที่ AI *เรียก*
- **Resources** (1) — ข้อมูลที่ AI *อ่าน* (`store://policy`)
- **Prompts** (1) — เทมเพลตที่ *ผู้ใช้เลือกใช้* (`after_sales_reply`)

> 💡 จุดสอน: MCP ไม่ใช่แค่ "tools" — Resources (ข้อมูลให้อ่าน) กับ Prompts (เทมเพลตมาตรฐาน) คือส่วนที่คนมองข้าม

---

## 4 Pattern โลกจริง (เรียกทีละตัวใน Inspector)

### 1 · Personalization — `recommend_for_skin`
ลองเรียกด้วย `skin_type: "ผิวมัน"` → AI แนะนำสินค้าที่ตรงพร้อมเหตุผล
**โลกจริง:** recommendation engine ที่ปกติต้องเขียนโค้ดเชื่อมเอง — MCP ทำให้ AI ของใครก็เรียกได้

### 2 · System integration — `track_order`
เรียกด้วย `order_id: "ORD-1001"` → เห็นสถานะ + เลขพัสดุ
**โลกจริง:** `orders.json` คือ placeholder — production เปลี่ยนเป็น query ฐานข้อมูล/เรียก API logistics จริง โดย tool interface เหมือนเดิม (AI ไม่ต้องรู้ว่าหลังบ้านเปลี่ยน)

### 3 · Governed action — `create_draft_order` ⭐ (จุดสำคัญที่สุด)
เรียกด้วย `items: [{"sku":"GB-002","qty":2}]` → ได้ **"ร่างออเดอร์ สถานะรออนุมัติ"** ไม่ตัดสต็อก/ไม่เก็บเงิน
**โลกจริง:** action ที่กลับไม่ได้ (ตัดเงิน/ตัดสต็อก) **ต้องมี human-in-the-loop** — tool คืนสถานะ "รออนุมัติ" ให้มนุษย์ยืนยันก่อน (ตรงสไลด์ Governance)
> ลองใส่ `qty` เกินสต็อก (เช่น GB-002 qty 99) → tool ปฏิเสธอย่างปลอดภัย

### 4 · Analytics — `get_bestsellers`
เรียกไม่ต้องใส่ argument → 3 อันดับสต็อกน้อยสุด
**โลกจริง:** ให้ AI ดึง insight มาช่วยตัดสินใจเติมสต็อก (คือโจทย์ challenge ของ Lab MCP-1)

---

## Resource & Prompt (5 นาที)

- อ่าน Resource `store://policy` → AI ได้เงื่อนไขคืนสินค้า/รับประกันมาอ้างอิง โดยไม่ต้อง hardcode ในทุก prompt
- เรียก Prompt `after_sales_reply` (`order_id` + `issue`) → ได้เทมเพลตที่บังคับให้ AI เช็ค `track_order` ก่อนตอบ = มาตรฐานเดียวทั้งทีม

---

## Challenge (15 นาที) — เพิ่มของจริงของทีม

เลือก 1 ข้อ (หรือคิดเอง) แล้วเพิ่มใน `server.mjs` ตามแพทเทิร์นเดิม (คำอธิบายไทย + zod + `audit()`):

- **tool `estimate_delivery`** — รับจังหวัด → ประเมินวันจัดส่ง (กทม. 1-2 วัน / ตจว. 2-4 วัน จาก policy)
- **tool `apply_coupon`** — รับโค้ด → ตรวจว่าใช้ได้ไหม + ส่วนลด (governed: แค่ตรวจ ไม่ผูกกับออเดอร์จริง)
- **resource `faq://returns`** — เพิ่มเอกสาร FAQ ให้ AI ดึงอ่าน
- **แทน `orders.json`/`products.json` ด้วยข้อมูลธุรกิจจริงของทีม** (read-only ก่อน)

**เกณฑ์ผ่าน:** เรียกจาก Inspector ได้ · AI เลือก tool เองจากคำอธิบายโดยไม่ต้องบอกชื่อ · `[AUDIT]` ขึ้นทุกครั้งที่ถูกเรียก

---

## เชื่อมกลับภาพใหญ่

| สิ่งที่เรียนวันนี้ | ต่อยอดสู่ |
|---|---|
| tools/resources/prompts | หน้าร้าน "สาขา agent" ของแบรนด์ (Session 3 · ประตูที่ 3 ของ Agent-Readiness) |
| governed action (รออนุมัติ) | AP2 Mandate + human-in-the-loop ใน Agent Economy |
| ข้อมูลชุดเดียวหลาย demo | Integration Layer — เปิดข้อมูลให้ AI เข้าถึงอย่างมีสิทธิ์ควบคุม |

> deploy showcase นี้ขึ้น Cloudflare Workers ได้แบบเดียวกับ Lab MCP-2 (`s2-mcp/remote`) — port tools มาแล้วเพิ่ม auth
