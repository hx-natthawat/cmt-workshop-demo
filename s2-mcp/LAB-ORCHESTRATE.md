# Lab Orchestrate (Bonus) · Multi-server — Claude เรียก MCP หลายตัวต่อกันเอง

ต่อยอดจากสไลด์ **Orchestrate**: *"คำสั่งเดียว: 'สรุปยอดเมื่อวาน หาสาเหตุ แจ้งทีม' — Claude เรียกหลาย servers ต่อกันเองครบวงจร = บันได Enterprise ขั้นที่ 4"*

**เวลา:** ~25 นาที · **ทีมละ 2-3 ท่าน** · **โค้ดพร้อมใช้:** `s2-mcp/multi/`

---

## ทำไมต้องหลาย server

Lab MCP-1/2/3 ต่อ **server เดียว** — แต่องค์กรจริงมี MCP หลายตัว คนละทีม คนละระบบ:

```
📊 analytics-server        🧴 showcase server        (โลกจริงมีอีก: CRM · โลจิสติกส์ · การเงิน)
   ยอดขาย/ช่องทาง            สินค้า/สต็อก/ออเดอร์
   customer_data.csv         products.json
        └──────────┬──────────┘
                   ▼
            orchestrate.mjs  (รวม tools ทั้งหมดส่งให้ Claude)
                   ▼
        Claude เลือกเองว่าเรียก tool ไหน จาก server ไหน ตามลำดับใด
```

**จุดสำคัญ:** ไม่ได้เขียนลำดับไว้ล่วงหน้า — โมเดลวางแผนเองจากคำอธิบาย tool

---

## ขั้นที่ 1 (5 นาที) · รันของจริง

```bash
cd s2-mcp/multi && npm install
npm start            # ใช้โจทย์ตัวอย่างจากสไลด์
npm start "หมวดไหนขายดีสุด แล้วสินค้าในหมวดนั้นเหลือเท่าไร"   # โจทย์เอง
```

### 📊 ดูแผนภาพแบบเห็นภาพ (แนะนำสำหรับหน้าห้อง)

```bash
npm run trace        # → trace.html แล้วเปิดในเบราว์เซอร์
```
เห็น **lane ของแต่ละ server · hop เป็นลำดับ · call ที่ขนานกันวางข้างกัน** พร้อมเวลาต่อ call
และผลลัพธ์ที่กางดูได้ — เข้าใจ orchestration ได้ใน 3 วินาที

### ผลจริงที่เราได้

```
🔌 ต่อ 📊 analytics — 3 tools
🔌 ต่อ 🧴 shop — 7 tools
รวม 10 tools จาก 2 servers

  [hop 1] 📊 analytics → sales_by_channel({})
  [hop 1] 📊 analytics → find_at_risk_channel({})
  [hop 1] 🧴 shop → get_bestsellers({})

✅ Claude เรียก tool จาก 2 servers ต่อกันเองในคำสั่งเดียว
```

**สังเกต:** Claude เรียก **3 tools ขนานกันใน hop เดียว** (ไม่ได้ทำทีละอัน) — เพราะไม่มี dependency ต่อกัน ⇒ เร็วกว่าและถูกกว่า

คำตอบที่ได้: ช่องทางดีสุด (Shopee 1.26M) · ช่องทางน่ากังวล (**Lazada หลับไหล 42.6% เสี่ยงเสีย 101,642 บาท**) · สินค้าใกล้หมด (GB-002 เหลือ 8) · **ร่างข้อความแจ้งทีม** ครบในคำตอบเดียว

---

## ขั้นที่ 2 (10 นาที) · อ่านกลไก

`orchestrate.mjs` ทำ 3 อย่าง:

| ขั้น | โค้ด | ทำไมสำคัญ |
|---|---|---|
| 1. ต่อทุก server | วน `SERVERS` → `client.connect()` → `listTools()` | แต่ละ server เป็น process แยก (คนละทีมดูแลได้) |
| 2. สร้าง registry | `registry: toolName → { client, serverLabel }` | ตอน Claude เรียก tool ต้องรู้ว่าส่งไป client ไหน |
| 3. routing ตอน tool_use | หา entry จาก registry แล้ว `callTool` | จุดนี้คือ "orchestration" จริง |

```js
const entry = registry.get(tu.name);          // tool นี้อยู่ server ไหน?
const r = await entry.client.callTool({ ... }); // ส่งไปที่ถูกตัว
```

> ⚠️ **ชื่อ tool ซ้ำข้าม server = ปัญหาจริง** — โค้ดนี้ข้ามตัวที่ซ้ำและเตือน · โลกจริงควร prefix ชื่อ (`shop.get_promotions`) หรือใช้ namespace

---

## ขั้นที่ 3 (5 นาที) · ทดลองเปลี่ยนโจทย์

ลองสั่งให้ต้องเรียก **ต่อกันเป็นทอด** (ไม่ใช่ขนาน):

```bash
npm start "ช่องทางไหนน่ากังวลสุด แล้วแนะนำสินค้าที่เหมาะกับลูกค้ากลุ่มนั้นพร้อมเช็คสต็อก"
```
สังเกตว่า hop เพิ่มขึ้น — เพราะผลจาก server แรกเป็น input ให้ตัดสินใจเรียก server ที่สอง

---

## Challenge (5 นาที) — เลือก 1

- **เพิ่ม server ตัวที่ 3** เช่น `logistics-server` (เวลาจัดส่งต่อจังหวัด) แล้วสั่งงานที่ต้องใช้ทั้ง 3
- **แก้ปัญหาชื่อซ้ำ** — ใส่ prefix ชื่อ server ให้ tool อัตโนมัติ
- **จำกัดสิทธิ์ต่อ server** — ให้ analytics เป็น read-only, shop ต้องผ่าน approval (ใช้แนวจาก [LAB-SECURITY.md](LAB-SECURITY.md))
- **วัด cost** — นับ token ต่อ hop แล้วเทียบว่าถามแยกทีละคำถามแพงกว่าไหม

**เกณฑ์ผ่าน:** เรียกข้าม server ได้จริง · trace แสดงลำดับถูก · อธิบายได้ว่าทำไม Claude เลือกลำดับนั้น

---

## ข้อควรระวังในโลกจริง

| เรื่อง | ทำไมสำคัญ |
|---|---|
| **ชื่อ tool ชนกัน** | หลาย server อาจมี `search` เหมือนกัน → ต้อง namespace |
| **สิทธิ์ไม่เท่ากัน** | analytics อ่านอย่างเดียวพอ · shop เขียนได้ → แยก scope ต่อ server |
| **server ล่ม 1 ตัว** | ไม่ควรทำให้ทั้งงานพัง — จับ error ต่อ server แล้วบอกโมเดลว่า tool นั้นใช้ไม่ได้ |
| **audit ข้าม server** | log ต้องบอกได้ว่า call ไหนไป server ไหน (ตัวอย่างนี้ prefix `[AUDIT:analytics]`) |
| **cost/latency** | ยิ่งหลาย server ยิ่ง tools เยอะ = context ใหญ่ → พิจารณา tool search เมื่อ tools เกิน ~20 |

---

## เชื่อมภาพใหญ่

| จากแล็บนี้ | โยงไป |
|---|---|
| หลาย MCP ต่อกันเอง | **บันได Enterprise ขั้นที่ 4** (สไลด์ Orchestrate) |
| tool เดียวหลายระบบ | Integration Layer — ข้อมูลกระจายแต่ AI เข้าถึงได้ผ่านท่อที่คุมสิทธิ์ |
| Claude วางลำดับเอง | agent runtime · multi-agent (ระวัง: Cognition เตือน, Anthropic ใช้ได้ผลแต่กิน token 15 เท่า) |
| ต่อ server ภายนอก | curated registry + สแกนก่อนเชื่อม ([LAB-SECURITY.md](LAB-SECURITY.md)) |
