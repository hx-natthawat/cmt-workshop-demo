# s1-martech/line-bot-mcp — LINE Bot × MCP

เวอร์ชันต่อยอดของ Lab 3: ลูกค้าแชทใน LINE → Claude **เรียก MCP tools จริง** ตอบด้วยข้อมูลสด
เชื่อม LINE (Session 1) + MCP showcase (Session 2) เข้าด้วยกัน = pattern production จริง

## ต่างจาก Lab 3 เดิม (`../line-bot`)

| | `line-bot` (Lab 3) | `line-bot-mcp` (ตัวนี้) |
|---|---|---|
| ข้อมูล | ยัด `products.json` เข้า system prompt | **เชื่อม MCP server** (`../../s2-mcp/showcase`) |
| ตอบได้ | สินค้า / โปร | + แนะนำตามผิว · เช็คออเดอร์ · ร่างออเดอร์ (governance) · bestsellers |
| สถาปัตย์ | Claude + context | Claude + **MCP tool-use loop** |

## รัน

```bash
cd s1-martech/line-bot-mcp
npm install
cp ../line-bot/.env .env      # ใช้ token ชุดเดียวกับ Lab 3 ได้เลย
npm start                      # บูตแล้วเชื่อม MCP showcase อัตโนมัติ (stdio)
```

เห็น log:
```
🔌 เชื่อม MCP showcase ได้ · 4 tools: recommend_for_skin, track_order, create_draft_order, get_bestsellers
✅ Bot × MCP running on port 3000
```

เปิด tunnel + ตั้ง webhook เหมือน Lab 3:
```bash
npx cloudflared tunnel --url http://localhost:3000
```
นำ `<url>/webhook` ไปใส่ LINE Developers Console → Verify → เปิด Use webhook → ปิด auto-reply

## ทดสอบแชท

| พิมพ์ใน LINE | AI เรียก MCP tool | ได้ |
|---|---|---|
| `ผิวแห้งแพ้ง่ายใช้ตัวไหนดี` | `recommend_for_skin` | แนะนำ GB-003 พร้อมเหตุผล |
| `ORD-1001 ส่งถึงไหนแล้ว` | `track_order` | สถานะ + เลขพัสดุ |
| `ขอสั่งกันแดด GB-002 2 ชิ้น` | `create_draft_order` | **ร่างออเดอร์ รออนุมัติ** (ไม่ตัดสต็อก/เงิน) |
| `ตัวไหนขายดี` | `get_bestsellers` | 3 อันดับสต็อกน้อย |

ดู `[AUDIT]` ใน terminal bot = พิสูจน์ว่า AI ดึงข้อมูลจริงผ่าน MCP ไม่ได้เดา

## กลไก (app.js)

1. **บูต** → เชื่อม MCP showcase ผ่าน stdio ครั้งเดียว, ดึง `tools/list` แปลงเป็น Anthropic tool format
2. **webhook** รับข้อความ → **agentic loop**: Claude เลือก tool → เรียกผ่าน MCP → ส่งผลกลับ → วนจน Claude ตอบ text
3. **reply** กลับ LINE ด้วย Reply API

> ⚠️ ใช้ `thinking: {type:'disabled'}` + หยิบ text block (กับดัก Sonnet 5 — ดู README หลัก) · การสั่งซื้อผ่าน `create_draft_order` เท่านั้น คืนสถานะรออนุมัติ ไม่ execute เอง (human-in-the-loop)
