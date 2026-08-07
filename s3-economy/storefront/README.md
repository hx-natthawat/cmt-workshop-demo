# Agent-Ready Storefront — แบรนด์ที่ agent มองเห็น

หน้าร้านตัวอย่างที่ **agent อ่านและตัดสินใจแทนผู้ใช้ได้** พร้อมเครื่องให้คะแนนความพร้อม 4 ด้าน

เมื่อผู้ใช้ถาม AI ว่า "หาครีมกันแดดสำหรับผิวมันให้หน่อย" แบรนด์ที่ agent อ่านไม่ออกจะไม่ถูกพิจารณาเลย
โฟลเดอร์นี้แสดงว่าต้องมีอะไรบ้างถึงจะถูกมองเห็น

คู่มือสอนฉบับเต็ม: [LAB-STOREFRONT.md](../LAB-STOREFRONT.md)

## 4 ด้านที่ตรวจ

| ด้าน | ไฟล์ | ทำไมสำคัญ |
|---|---|---|
| 1 · Structured Data | `index.html` (JSON-LD) | agent อ่านราคา/สต็อกจาก markup ไม่ใช่จากการเดาข้อความ |
| 2 · AEO | `llms.txt` | สรุปที่แบรนด์เขียนเอง — answer engine หยิบไปตอบได้ตรง |
| 3 · MCP | ประกาศช่องทางข้อมูลสด | agent ดึงสต็อก/ราคาปัจจุบันได้ ไม่ใช่ข้อมูลค้าง |
| 4 · Agent Card | `.well-known/agent-card.json` | ประกาศความสามารถ + ขอบเขตเจรจา (`x-negotiable`) |

## ไฟล์ในโฟลเดอร์

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้าร้าน + Schema.org `@graph` (Store · Product ×4 · FAQPage) |
| `llms.txt` | สรุปแบรนด์สำหรับ AI |
| `.well-known/agent-card.json` | A2A agent card — 4 skills · security schemes · `x-negotiable` |
| `audit-gates.mjs` | ให้คะแนน 4 ด้าน ด้านละ 0-5 |
| `serve.mjs` | static server พร้อมกัน path traversal |

## คำสั่ง

ไม่ต้อง `npm install` — ใช้ Node เปล่า

```bash
node serve.mjs                       # → http://localhost:8090
node audit-gates.mjs                 # ตรวจไฟล์ในเครื่อง (ได้ 17/20)
node audit-gates.mjs http://localhost:8090
node audit-gates.mjs https://brand-ของทีม.com     # ⭐ ตรวจเว็บจริง
```

## เกณฑ์คะแนน

| รวม | ความหมาย |
|---|---|
| 16-20 | 🟢 พร้อมสูง — agent เห็นและใช้งานได้ |
| 9-15 | 🟡 พอใช้ — มีจุดที่ต้องแก้ |
| 0-8 | 🔴 agent แทบมองไม่เห็น |

ตัวอย่างนี้ได้ **17/20** — จงใจไม่ให้เต็ม เพื่อให้มีช่องว่างสำหรับอภิปรายในห้องว่าอีก 3 คะแนนอยู่ตรงไหน
