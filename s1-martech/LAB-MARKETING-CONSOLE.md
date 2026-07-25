# Lab (Bonus) · Marketing Console — Enterprise Operator UI

หน้าจอเดียวสำหรับทีมการตลาด รวมทุกงาน operator: **Overview · Broadcast · Segments · Restock · Analytics**
ต่อยอดจากทั้งซีรีส์ — โชว์ว่า MCP/LINE/ข้อมูล ที่สร้างมา ประกอบเป็น **แอปจริงระดับ SaaS** ได้อย่างไร

**เวลา:** ~30 นาที · **โค้ดพร้อมใช้:** `s1-martech/line-bot-rich/console.mjs` + `console.html`

---

## รัน

```bash
cd s1-martech/line-bot-rich
npm install
cp ../line-bot/.env .env       # ใช้ token ชุดเดียวกับ Lab 3
npm run console                 # เปิด http://localhost:3100
```

> ⚠️ bind `127.0.0.1` เท่านั้น — ไม่เปิดผ่าน tunnel (หน้า operator ที่ยิง broadcast ได้ ต้องไม่หลุดเน็ต)

---

## สถาปัตย์: real backend integration

```
console.html (SPA) ──fetch──▶ console.mjs (API) ──▶ console-data.mjs
   sidebar + 5 views              │                    ├─ store.js (VoC log, restock)
   modal + toast + dark           │                    ├─ customer_data.csv (RFM)
                                  │                    └─ showcase/products.json
                                  └─▶ LINE Messaging API (quota / broadcast / multicast)
```

**ของจริงทั้งหมด** ไม่ใช่ mock:
- โควตา/broadcast/restock → เรียก **LINE API จริง**
- VoC → อ่าน log จริงจาก bot · RFM → คำนวณจาก **customer_data.csv จริง** 300 ราย

---

## 5 Views (เดินดูทีละอัน)

| View | ทำอะไร | จุดสอน |
|---|---|---|
| 📊 **Overview** | KPI: บทสนทนา, ลูกค้า, อัตราแปลง, โควตา + tool bars + funnel | รวมทุกเมตริกหน้าเดียว |
| 📣 **Broadcast** | ส่งโปรหาทุกคน + พรีวิว + **governance modal** | action กระทบสูง → ต้องยืนยัน 2 ชั้น |
| 🎯 **Segments** | ตาราง RFM 5 กลุ่ม + ข้อความเฉพาะกลุ่ม | targeting > blast · **ซื่อสัตย์**: flag LINE จาก CSV ไม่ได้เช็คจริง |
| 🔔 **Restock** | สินค้าหมด + คนสนใจ + ปุ่มแจ้ง | proactive · แจ้งได้เมื่อของกลับมา (governance) |
| 📈 **Analytics** | VoC เต็ม (tool/funnel/คำถามล่าสุด) | data loop → วัด ROI |

---

## Enterprise touches (สังเกตใน UI)

- **App shell**: sidebar nav + topbar + active state (ไม่ใช่หน้าเดียวยาว)
- **Design system**: tokens · dark mode (ปุ่มสลับ) · responsive (มือถือ sidebar ยุบ)
- **Governance modal**: ทุก action ส่งจริงต้องติ๊ก + พิมพ์ `SEND` (ปุ่ม disabled จนครบ)
- **Feedback**: toast (สำเร็จ/ผิดพลาด) · loading spinner · empty/error states
- **ความปลอดภัย**: localhost-only · endpoint ส่งจริง guard `confirm=SEND`

---

## Challenge (15 นาที) — เลือก 1

- **เพิ่ม view "Orders"** — ตารางออเดอร์จาก orders.json + ปุ่มอัปเดตสถานะ
- **Segment → ส่งจริง**: เพิ่มการ map customer_id ↔ LINE userId (เก็บตอน follow) แล้ว multicast จริง
- **กราฟ time-series**: บทสนทนาต่อวัน (จาก VoC log timestamp)
- **Role/auth**: ใส่ login หน้า console (ตอนนี้ localhost-only)

**เกณฑ์ผ่าน:** view ใหม่ดึงข้อมูลจริงผ่าน API · action ที่กระทบภายนอกมี governance · responsive + dark ยังทำงาน

---

## เชื่อมภาพใหญ่

| สิ่งที่เห็น | โยงไป |
|---|---|
| หน้าจอเดียวคุมทุกช่องทาง | Integration Layer — ข้อมูล/tool ชุดเดียว หลาย surface |
| governance ทุก action | human-in-the-loop · AP2 Mandate (S3) · EU AI Act/PDPA |
| VoC → funnel → ROI | measurement (41% พิสูจน์ ROI ในเด็ค) |
| Segment targeting | CDP + first-party data (S1 Integration) |

> นี่คือปลายทางของทั้งซีรีส์: MCP (logic) + LINE (channel) + data (loop) → **แอปการตลาดจริงที่ทีมใช้งานได้**
