# Lab Storefront (Bonus) · Agent-Ready — ทำให้ agent "มองเห็น" แบรนด์เรา

เสริม **Lab 1 (Agent-Readiness Audit)**: เดิม audit แบรนด์คนอื่นแล้วให้คะแนน 4 ประตู —
แล็บนี้ให้เห็น **หน้าตาของแบรนด์ที่ผ่านทั้ง 4 ประตู** และมี **เครื่องตรวจอัตโนมัติ**

**เวลา:** ~25 นาที · **โค้ดพร้อมใช้:** `s3-economy/storefront/`

---

## รัน

```bash
cd s3-economy/storefront
node serve.mjs                             # → http://localhost:8090
node audit-gates.mjs                       # ตรวจตัวอย่างนี้ (local)
node audit-gates.mjs http://localhost:8090 # ตรวจผ่าน URL จริง
node audit-gates.mjs https://brandของทีม   # ⭐ ตรวจแบรนด์จริง
```

---

## 4 ประตู — อยู่ตรงไหนในโค้ด

| ประตู | ไฟล์ | ดูตรงไหน |
|---|---|---|
| **1 · Structured Data** | `index.html` | `<script type="application/ld+json">` — Product/Offer (ราคา+`inventoryLevel`)/FAQPage · ราคาและสต็อกเป็น**ข้อความจริงในหน้า** ไม่ฝังในรูป |
| **2 · AEO** | `llms.txt` + FAQ ในหน้า | สรุปที่แบรนด์เขียนเองให้ AI อ่าน — สินค้า ราคา โปร เงื่อนไข ครบในไฟล์เดียว |
| **3 · MCP Server** | ประกาศใน `llms.txt` + `agent-card.json` | ของจริงอยู่ที่ [`s2-mcp/showcase`](../s2-mcp/showcase) — ข้อมูลสดที่ agent เรียกได้ |
| **4 · Agent Card** | `.well-known/agent-card.json` | ประกาศ `skills` · `securitySchemes` · **`x-negotiable`** (เจรจาอะไรได้ / อะไรต้องให้มนุษย์อนุมัติ) |

### ผลตรวจของตัวอย่างนี้

```
ประตู 1 · Structured Data  █████ 5/5
ประตู 2 · AEO / llms.txt   █████ 5/5
ประตู 3 · MCP Server       ██░░░ 2/5   ← ตรวจอัตโนมัติได้แค่ "มีการประกาศ" ต้องยืนยันด้วยมือว่ามี server จริง
ประตู 4 · Agent Card       █████ 5/5
คะแนนรวม: 17/20  🟢 พร้อมสูง
```

> ประตู 3 ได้ 2/5 **โดยตั้งใจ** — เครื่องตรวจไม่ควรให้คะแนนเต็มกับสิ่งที่ยืนยันไม่ได้จากภายนอก

---

## กิจกรรม (20 นาที)

### 1 · เทียบของจริงกับตัวอย่าง (10 นาที)
```bash
node audit-gates.mjs https://<เว็บแบรนด์ของทีม>
```
เทียบคะแนนกับ storefront ตัวอย่าง → ประตูไหนต่างมากสุด?

> แบรนด์ไทยส่วนใหญ่ตกประตู 1-2 (ราคาอยู่ในรูปภาพ/LINE, ไม่มี llms.txt) และแทบไม่มีใครมีประตู 4

### 2 · ซ่อมประตูที่พังที่สุด (10 นาที)
เลือก 1 ประตู แล้วเขียนของจริงของทีม:
- **ประตู 1** → เขียน JSON-LD ให้สินค้าจริง 1 ตัว (ก๊อป pattern จาก `index.html`)
- **ประตู 2** → เขียน `llms.txt` ของแบรนด์ (สินค้า · ราคา · เงื่อนไข · ติดต่อ)
- **ประตู 4** → ร่าง `agent-card.json` โดยเฉพาะ `x-negotiable` → **เอาไปใช้ต่อใน Lab 2 ช่อง 3-4 ได้เลย**

**เกณฑ์ผ่าน:** รัน `audit-gates.mjs` แล้วคะแนนประตูนั้นเพิ่มขึ้นจริง

---

## จุดที่ควรชี้ให้เห็น

| สังเกต | ทำไมสำคัญ |
|---|---|
| GB-004 แสดง **"สินค้าหมดชั่วคราว"** ทั้งในหน้าและ `availability: OutOfStock` | agent ที่ซื่อสัตย์จะไม่เสนอของที่ไม่มี — ข้อมูลผิด = เสียลูกค้า |
| `x-negotiable.requiresHumanApproval` | เส้นแดงประกาศให้ agent อีกฝั่ง**อ่านได้ตั้งแต่ต้น** ไม่ต้องเดา → โยงตรง **AP2 Mandate** และ Lab 2 |
| ราคาเป็นข้อความ ไม่ใช่รูป | ข้อค้นพบยอดฮิตในสไลด์: *"ราคาซ่อนใน LINE/DM — agent อ่านไม่ได้"* |
| `llms.txt` เขียนเอง | แบรนด์คุม narrative ที่ AI จะเล่าให้ลูกค้าฟัง (สไลด์ Trust ข้อ 4) |

---

## เชื่อมภาพใหญ่

```
ประตู 1-2 (เว็บอ่านออก) ──┐
ประตู 3 (MCP server) ─────┼──▶ agent ค้นเจอ → เชื่อถือ → เจรจา → ซื้อ
ประตู 4 (Agent Card) ─────┘         ↑
                          Readiness Ladder: Readable → Connectable → Negotiable → Transactable
```

| จากแล็บนี้ | ต่อไปที่ |
|---|---|
| ประตู 1-2 ผ่าน | **Readable** — ขั้น 1 ของ Readiness Ladder (เริ่มสัปดาห์นี้ งบ ~0) |
| ประตู 3 ผ่าน | **Connectable** — คือ [`s2-mcp/showcase`](../s2-mcp/showcase) ที่สร้างใน Session 2 |
| ประตู 4 + `x-negotiable` | **Negotiable** — วัตถุดิบของ Lab 2 (Journey canvas ช่อง 3-4) |
| ต่อไป | **Transactable** — รองรับ AP2 mandate ผ่าน payment partner |
