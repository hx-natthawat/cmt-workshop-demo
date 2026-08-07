# MCP Multi-server — Claude เรียกหลาย server ต่อกันเองในคำสั่งเดียว

องค์กรจริงไม่ได้มี MCP server ตัวเดียว — ยอดขายอยู่ระบบหนึ่ง สินค้าอยู่อีกระบบ คนละทีมดูแล
โฟลเดอร์นี้สาธิตว่าเมื่อรวม tools จากหลาย server ให้โมเดล **โมเดลวางลำดับการเรียกเอง** โดยเราไม่ได้เขียนไว้ล่วงหน้า

คู่มือสอนฉบับเต็ม: [LAB-ORCHESTRATE.md](../LAB-ORCHESTRATE.md)

## ไฟล์ในโฟลเดอร์

| ไฟล์ | หน้าที่ |
|---|---|
| `analytics-server.mjs` | MCP server ตัวที่สอง — 3 tools อ่านจาก `customer_data.csv` จริง (300 ราย) |
| `orchestrate.mjs` | ต่อทั้ง analytics และ showcase แล้วให้โมเดลเลือกเรียก · พิมพ์ trace |
| `trace-ui.mjs` | รันแบบเดียวกันแล้วเขียน `trace.html` — เห็น lane ต่อ server และ hop |

## คำสั่ง

```bash
npm install                       # ต้องมี ANTHROPIC_API_KEY ใน environment

npm start                         # ใช้โจทย์ตัวอย่าง
npm start "หมวดไหนขายดีสุด แล้วสินค้าในหมวดนั้นเหลือเท่าไร"    # โจทย์เอง

npm run trace                     # → trace.html
npm run inspect:analytics         # เปิด MCP Inspector ดู analytics server
```

## กลไกใน `orchestrate.mjs`

| ขั้น | สิ่งที่ทำ | ทำไมสำคัญ |
|---|---|---|
| 1 | วน `SERVERS` แล้ว `connect()` ทีละตัว | แต่ละ server เป็น process แยก คนละทีมดูแลได้ |
| 2 | สร้าง registry `toolName → { client, serverLabel }` | ตอนโมเดลเรียก tool ต้องรู้ว่าส่งไป client ไหน |
| 3 | routing ตอน `tool_use` | จุดนี้คือ orchestration จริง |

```js
const entry = registry.get(tu.name);            // tool นี้อยู่ server ไหน
const r = await entry.client.callTool({ ... });  // ส่งไปให้ถูกตัว
```

> ⚠️ **ชื่อ tool ซ้ำข้าม server เป็นปัญหาจริง** — โค้ดนี้ข้ามตัวที่ซ้ำแล้วเตือน
> ระบบจริงควร prefix ชื่อ (`shop.get_promotions`) หรือใช้ namespace

## ตัวอย่างผลลัพธ์

```
🔌 ต่อ 📊 analytics — 3 tools
🔌 ต่อ 🧴 shop — 7 tools

  [hop 1] 📊 analytics → sales_by_channel
  [hop 1] 📊 analytics → find_at_risk_channel
  [hop 1] 🧴 shop → get_bestsellers

✅ Claude เรียก tool จาก 2 servers ต่อกันเองในคำสั่งเดียว
```

สังเกตว่าทั้งสามอยู่ใน **hop เดียวกัน** — โมเดลเรียกขนานกันเพราะไม่มี dependency ต่อกัน เร็วกว่าและถูกกว่า

## ข้อควรระวังเมื่อทำจริง

| เรื่อง | เหตุผล |
|---|---|
| ชื่อ tool ชนกัน | หลาย server อาจมี `search` เหมือนกัน → ต้อง namespace |
| สิทธิ์ไม่เท่ากัน | analytics อ่านอย่างเดียวพอ · shop เขียนได้ → แยก scope ต่อ server |
| server ล่มหนึ่งตัว | ไม่ควรทำให้ทั้งงานพัง — จับ error ต่อ server แล้วบอกโมเดลว่า tool นั้นใช้ไม่ได้ |
| audit ข้าม server | log ต้องบอกได้ว่า call ไหนไป server ไหน (ตัวอย่างนี้ prefix `[AUDIT:analytics]`) |
| cost และ latency | ยิ่งหลาย server ยิ่ง tools เยอะ = context ใหญ่ขึ้น |
