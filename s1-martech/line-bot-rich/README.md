# s1-martech/line-bot-rich — LINE Bot × MCP × Rich UI

เวอร์ชัน flagship (โลกจริง) ต่อยอดจาก `line-bot-mcp`: เพิ่ม **Flex Message · Quick Reply · Postback (ยืนยันออเดอร์) · Rich Menu**
โชว์ pattern สำคัญ: **แยก logic (MCP tools) ออกจาก presentation (Flex)** — tool ตัวเดียวใช้ได้ทั้งเว็บ/แอป/LINE

## สถาปัตย์ 2 ชั้น

```
ลูกค้า → LINE → [app.js] → Claude เลือก MCP tool → ข้อมูลจริง (s2-mcp/showcase)
                    │
                    └→ [flex.js] แปลงผล tool → Flex/Quick Reply → ส่งกลับ LINE
```

| tool ที่ Claude เรียก | render เป็น |
|---|---|
| `recommend_for_skin` / `get_bestsellers` | **Flex Carousel** การ์ดสินค้า (ปุ่ม "สั่งเลย") |
| `get_promotions` | **Flex Carousel** การ์ดโปร |
| `create_draft_order` | **Flex Bubble** สรุปออเดอร์ + ปุ่ม **ยืนยัน/ยกเลิก** (postback) |
| ข้อความทั่วไป | **Quick Reply** เลือกสภาพผิว |

## ⭐ Governance เห็นด้วยตา + กดด้วยมือ

```
"ขอสั่ง GB-002 2 ชิ้น" → create_draft_order (รออนุมัติ) → การ์ด + ปุ่มยืนยัน
   → ลูกค้ากด ✅ ยืนยัน → postback → confirm_order (execute จริง) → เลขออเดอร์
```
= human-in-the-loop ที่จับต้องได้ · เชื่อมตรง Session 3 (AP2 Mandate: อนุมัติครั้งเดียวก่อน execute)

## รัน

```bash
cd s1-martech/line-bot-rich
npm install
cp ../line-bot/.env .env      # ใช้ token ชุดเดียวกับ Lab 3
npm start                      # เชื่อม MCP showcase อัตโนมัติ
npx cloudflared tunnel --url http://localhost:3000
```
ตั้ง `<url>/webhook` ใน LINE Console → Verify → เปิด Use webhook → ปิด auto-reply

## ทดสอบแชท

| พิมพ์ | ได้ |
|---|---|
| `ผิวมันใช้ตัวไหนดี` | การ์ดสินค้าเลื่อนได้ + ปุ่มสั่งเลย |
| `มีโปรอะไรบ้าง` | การ์ดโปร |
| `ขอสั่งกันแดด GB-002 2 ชิ้น` | การ์ดสรุป + ปุ่มยืนยัน → กดยืนยัน → เลขออเดอร์ |
| `สวัสดี` | ข้อความ + ปุ่มเลือกสภาพผิว |

## Rich Menu (optional)

```bash
# 1. เปิด richmenu-template.html ในเบราว์เซอร์ → แคปกล่องเมนู (2500×843) → บันทึกเป็น richmenu.png
# 2. รัน (⚠️ แก้ LINE OA จริง)
npm run setup-richmenu
```
เมนู 4 ช่อง: แนะนำสินค้า / โปรโมชัน / เช็คออเดอร์ / เจ้าหน้าที่
> ลบเมนู: `curl -X DELETE https://api.line.me/v2/bot/user/all/richmenu -H "Authorization: Bearer $TOKEN"` แล้วลบ rich menu id

## Broadcast โปรโมชัน (รูปแบบ A: เชิงรุก)

ต่างจาก bot ปกติ (reactive/รอทัก) — broadcast คือ**แบรนด์ push โปรหาผู้ติดตามทั้งหมดเอง** ใช้ Flex การ์ดโปรชุดเดียวกับที่ bot ตอบ

```bash
node broadcast.mjs           # พรีวิว (dry-run · ไม่ส่งจริง) + ดูโควตา
node broadcast.mjs --send    # ส่งจริงถึงผู้ติดตามทุกคน
```
> ⚠️ **Governance:** broadcast กลับไม่ได้ + กินโควตา OA → default เป็น dry-run · ต้องใส่ `--send` เองอย่างตั้งใจ (human-in-the-loop) · เชื่อมแนวคิด "agent เป็นฝ่ายเริ่ม" ใน Agent Economy (Session 3)

## ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `app.js` | webhook + Claude/MCP loop + postback + renderer routing |
| `flex.js` | presentation layer — Flex builders + Quick Reply + orderSummary |
| `broadcast.mjs` | ส่งโปรเชิงรุกถึงผู้ติดตามทั้งหมด (dry-run default) |
| `setup-richmenu.mjs` | สร้าง rich menu ผ่าน LINE API |
| `richmenu-template.html` | เทมเพลตรูปพื้นหลัง 2500×843 |

> ⚠️ ใช้ `thinking:{type:'disabled'}` + หยิบ text block (กับดัก Sonnet 5) · Flex สร้างจากเทมเพลตใน flex.js (deterministic — ไม่ให้ Claude เขียน Flex JSON เอง กันพังตอน demo สด) · lab สอนดูใน [../LAB3-RICH.md](../LAB3-RICH.md)
