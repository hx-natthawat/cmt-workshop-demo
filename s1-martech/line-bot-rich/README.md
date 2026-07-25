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

**2 ทางเลือก:**

```bash
npm run broadcast            # CLI: พรีวิว (dry-run) · เพิ่ม -- --send เพื่อส่งจริง
npm run admin                # UI: เปิด http://localhost:3100 (operator console)
```

**Operator Console (`npm run admin`)** — หน้าเว็บ localhost:3100 สำหรับทีมการตลาด:
- เห็นโควตา + พรีวิวการ์ดโปรที่จะส่ง
- **ประตู governance:** ต้องติ๊ก "เข้าใจว่าจะส่งถึงทุกคน" + พิมพ์ `SEND` ก่อนปุ่มจะทำงาน
- รัน localhost เท่านั้น (ไม่เปิดผ่าน tunnel)

> ⚠️ **Governance:** broadcast กลับไม่ได้ + กินโควตา OA → CLI default เป็น dry-run · UI มีขั้นยืนยัน 2 ชั้น (human-in-the-loop) · **ไม่ทำเป็น AI tool** กัน AI สั่งเอง · เชื่อมแนวคิด "agent เป็นฝ่ายเริ่ม" ใน Agent Economy (Session 3)

## Engagement layer (โลกจริง)

โครงกลาง `agent.js` (Claude+MCP loop) ใช้ร่วมทุกช่องทาง · `store.js` เก็บ VoC log + restock interest

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run console` | 🏢 **Marketing Console** (localhost:3100) — enterprise SaaS UI รวมทุกงาน operator (Overview/Broadcast/Segments/Restock/Analytics) · real backend + governance · [Lab](../LAB-MARKETING-CONSOLE.md) |
| `npm run webchat` | 🌐 **Web Chat** (localhost:3200) — ใช้ MCP tools ชุดเดียวกับ LINE (พิสูจน์ omnichannel) |
| `npm run voc-report` | 📊 **VoC Dashboard** — สรุปบทสนทนา/tool/funnel จาก log (data loop, วัด ROI) |
| `npm run restock-notify GB-004` | 🔔 **Restock** — แจ้งลูกค้าที่สนใจตอนของหมด (dry-run · `--send` ส่งจริง) |
| `npm run broadcast-segment "แชมป์ตัวจริง"` | 🎯 **Segment targeting** — RFM จาก customer_data.csv (วางแผน · ตัวเลขจาก CSV ตัวอย่าง) |

> ℹ️ **broadcast-segment ไม่ได้เช็ค LINE จริง** — อ่าน flag จาก CSV ตัวอย่าง · ส่งจริงต้อง map customer_id↔LINE userId ผ่าน CDP (เก็บ userId ตอน follow/ผูกบัญชี) · VoC log hash userId (PDPA) · restock เก็บ userId จริงเพื่อ push (ต้องมี consent) · โฟลเดอร์ `data/` gitignore

## ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `app.js` | webhook LINE + renderer + postback + logging/restock capture |
| `agent.js` | **โครงกลาง** — connectMcp + Claude/MCP loop (ใช้ร่วม LINE/Web) |
| `store.js` | data layer — VoC log (hash) + restock interest |
| `webchat.mjs` | Web Chat widget (localhost:3200) |
| `voc-report.mjs` · `restock-notify.mjs` · `broadcast-segment.mjs` | engagement tools |
| `flex.js` | presentation layer — Flex builders + Quick Reply + orderSummary |
| `broadcast.mjs` | CLI ส่งโปรเชิงรุกถึงผู้ติดตามทั้งหมด (dry-run default) |
| `admin.mjs` | Operator Console (หน้าเว็บ localhost:3100) broadcast + ประตูยืนยัน |
| `setup-richmenu.mjs` | สร้าง rich menu ผ่าน LINE API |
| `richmenu-template.html` | เทมเพลตรูปพื้นหลัง 2500×843 |

> ⚠️ ใช้ `thinking:{type:'disabled'}` + หยิบ text block (กับดัก Sonnet 5) · Flex สร้างจากเทมเพลตใน flex.js (deterministic — ไม่ให้ Claude เขียน Flex JSON เอง กันพังตอน demo สด) · lab สอนดูใน [../LAB3-RICH.md](../LAB3-RICH.md)
