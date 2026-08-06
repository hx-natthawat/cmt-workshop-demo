# CMT Workshop Demos

ชุดโค้ดตัวอย่างที่รันได้จริงสำหรับสอนเรื่อง **AI ในงานการตลาด · Model Context Protocol · Agent Economy**
เป็น monorepo ของโปรเจกต์เล็กๆ ที่แยกกันสมบูรณ์ — หยิบไปใช้ทีละตัวได้ ไม่ต้องรันทั้งหมด

| | |
|---|---|
| Runtime | Node.js 20+ (Cloudflare Workers ใช้ 20+ เท่านั้น) |
| โมเดล | `claude-sonnet-5` ผ่าน `@anthropic-ai/sdk` |
| เทสต์ | 62 เคสใน CI (ไม่ต้องมี API key) + `smoke-test.sh` 8 ด่าน |
| CI | GitHub Actions — 4 jobs ไม่ใช้ secret ใดๆ fork ไปรันได้ทันที |

---

## เริ่มต้น

```bash
git clone git@github.com:hx-natthawat/cmt-workshop-demo.git
cd cmt-workshop-demo
```

แต่ละโปรเจกต์มี `package.json` ของตัวเอง ติดตั้งเฉพาะตัวที่จะใช้:

```bash
npm install --prefix s2-mcp/local          # MCP server ตัวเล็กสุด เริ่มที่นี่ได้
npm install --prefix s1-martech/line-bot-rich
```

หรือติดตั้งทุกตัวรวดเดียว:

```bash
for d in s1-martech/line-bot s1-martech/line-bot-mcp s1-martech/line-bot-rich \
         s2-mcp/local s2-mcp/showcase s2-mcp/security s2-mcp/multi s2-mcp/remote; do
  npm ci --prefix "$d"
done
```

### ตัวแปรสภาพแวดล้อม

คัดลอกจาก `.env.example` ของแต่ละโปรเจกต์แล้วเติมค่า — ไฟล์จริงถูก gitignore ไว้

| ตัวแปร | ใช้ที่ | จำเป็นเมื่อ |
|---|---|---|
| `ANTHROPIC_API_KEY` | LINE bots ทุกตัว · `s2-mcp/multi` | เรียกโมเดล |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE bots · Marketing Console | ส่งข้อความ/ดูโควตา |
| `LINE_CHANNEL_SECRET` | LINE bots | ตรวจลายเซ็น webhook |
| `PORT` | LINE bots · Marketing Console | ต้องการเปลี่ยนพอร์ต (ค่าปกติ 3000 / 3100) |
| `DEMO_API_KEY` | `s2-mcp/remote` | กันการเรียก MCP remote |

> MCP server ฝั่ง stdio (`local` · `showcase` · `security` · `multi/analytics`) **ไม่ต้องใช้ตัวแปรใดๆ** — รันได้ทันทีหลัง `npm install`

---

## ภาพรวมสถาปัตยกรรม

```
                    ┌───────────────────── ช่องทางเข้า ─────────────────────┐
   LINE Messaging ──┤  line-bot        context อยู่ใน system prompt         │
                    │  line-bot-mcp    เรียก MCP tools                      │
                    │  line-bot-rich   MCP + Flex/Quick Reply/Postback      │
   เบราว์เซอร์ ──────┤  webchat.mjs     UI เดียวกับ LINE คนละ presentation   │
                    │  console.mjs     หน้า operator (localhost เท่านั้น)   │
                    └───────────────────────┬──────────────────────────────┘
                                            │  agent.js — agentic loop ร่วม
                                            ▼
                    ┌──────────────── MCP servers (stdio) ─────────────────┐
                    │  showcase    7 tools + resource + prompt             │
                    │  local       3 tools (ตัวอย่างพื้นฐานสุด)             │
                    │  analytics   อ่าน customer_data.csv จริง             │
                    │  guarded     สาธิต kill switch / readonly / audit    │
                    └──────────────────────────────────────────────────────┘

                    remote/  ตัวเดียวกันแต่เป็น Streamable HTTP บน Workers
```

**หลักการที่ยึดทั้งเรโป**

- **แยก logic ออกจาก presentation** — `agent.js` ตัดสินใจว่าจะเรียก tool ไหน, `render.js` ตัดสินใจว่าจะแสดงผลยังไง, `flex.js` สร้าง JSON · เปลี่ยนช่องทางไม่ต้องแตะ logic
- **โมเดลไม่เขียน Flex JSON เอง** — ใช้เทมเพลตตายตัว เพราะ schema ซับซ้อนและพังเงียบ
- **action ที่กระทบภายนอกต้องผ่านมนุษย์** — `create_draft_order` คืน "รออนุมัติ" · `confirm_order` ทำงานหลังผู้ใช้กดยืนยัน · broadcast ต้อง `confirm=SEND`
- **ทุก tool call มี audit log** — `[AUDIT] เวลา actor tool verdict args`

---

## โปรเจกต์ในเรโป

### LINE bots — `s1-martech/`

สามตัวนี้ใช้ `.env` หน้าตาเดียวกันและฟังพอร์ตเดียวกัน ต่างกันที่ความลึก

| โปรเจกต์ | ข้อมูลมาจาก | ความสามารถ |
|---|---|---|
| [`line-bot`](s1-martech/line-bot) | context ใน system prompt | ตอบคำถามสินค้า/โปรโมชัน |
| [`line-bot-mcp`](s1-martech/line-bot-mcp) | MCP tools | + เช็คสต็อก · ติดตามออเดอร์ · ร่างออเดอร์ |
| [`line-bot-rich`](s1-martech/line-bot-rich) | MCP + presentation layer | + Flex · Quick Reply · Postback · Rich Menu · VoC log |

```bash
cd s1-martech/line-bot-rich
cp .env.example .env && npm install
npm start                                    # :3000
cloudflared tunnel --url http://localhost:3000   # เอา <url>/webhook ไปตั้งใน LINE Console
```

สลับระหว่างสามตัวบนพอร์ตเดียวกัน (ไม่ต้องแก้ webhook):

```bash
cd s1-martech && ./switch-bot.sh 1|2|3|status|stop
```

**เครื่องมือรอบ `line-bot-rich`**

| คำสั่ง | ได้อะไร |
|---|---|
| `npm run console` | Marketing Console (:3100) — Overview · Broadcast · Segments · Restock · Analytics |
| `npm run webchat` | Web Chat (:3200) — tools ชุดเดียวกับ LINE |
| `npm run voc-report` | VoC dashboard — funnel + สถิติการใช้ tool |
| `npm run broadcast` | broadcast โปรโมชัน (dry-run เป็นค่าปกติ · ต้องใส่ `--send` เอง) |
| `npm run restock-notify GB-004` | แจ้งลูกค้าที่รอของเข้า (dry-run เป็นค่าปกติ) |
| `npm run broadcast-segment "แชมป์ตัวจริง"` | ยิงตามกลุ่ม RFM |
| `npm run setup-richmenu` | ติดตั้ง Rich Menu (ต้องมี `richmenu.png` 2500×843) |

> หน้า operator ทั้งหมด bind `127.0.0.1` เท่านั้น — อย่าเปิดผ่าน tunnel

### MCP servers — `s2-mcp/`

| โปรเจกต์ | Transport | เนื้อหา |
|---|---|---|
| [`local`](s2-mcp/local) | stdio | 3 tools — ตัวอย่างพื้นฐานสุด เหมาะกับการอ่านโค้ดครั้งแรก |
| [`showcase`](s2-mcp/showcase) | stdio | 7 tools + resource `store://policy` + prompt `after_sales_reply` |
| [`remote`](s2-mcp/remote) | Streamable HTTP | ตัวเดียวกันบน Cloudflare Workers + ตรวจ API key |
| [`security`](s2-mcp/security) | stdio | สาธิต tool poisoning + สแกนเนอร์ + guarded server |
| [`multi`](s2-mcp/multi) | stdio | analytics server ตัวที่สอง + ตัว orchestrate |

```bash
npm start --prefix s2-mcp/local        # รัน server
npm run inspect --prefix s2-mcp/local  # เปิด MCP Inspector
```

**tools ใน `showcase`**

| Tool | รูปแบบที่สาธิต |
|---|---|
| `recommend_for_skin` | personalization จากข้อมูลสินค้า |
| `check_stock` | ค้นจากรหัสหรือชื่อบางส่วน (ภาษาไทยไม่เว้นวรรค → ไล่ prefix) |
| `track_order` | อ่านทั้งออเดอร์ตายตัวและออเดอร์ที่สร้างสด |
| `create_draft_order` → `confirm_order` | governed action — ร่างก่อน ยืนยันทีหลัง |
| `get_bestsellers` · `get_promotions` | analytics · ข้อมูลโปรโมชัน |

ออเดอร์ที่ `confirm_order` สร้างถูกเก็บใน `data/orders-live.json` (gitignore) เพื่อให้ `track_order` ตามต่อได้
ล้างด้วย `npm run reset-orders`

**`security`** — สแกนคำอธิบาย tool หา red flag ก่อนเชื่อมต่อ server ที่ไม่ได้เขียนเอง

```bash
npm run scan:poisoned --prefix s2-mcp/security   # exit 1 — ใช้ใน CI ได้
npm run scan:guarded  --prefix s2-mcp/security   # exit 0
npm run report        --prefix s2-mcp/security   # รายงาน HTML ไฮไลต์จุดที่ฝังคำสั่ง
READONLY=1 node guarded-server.mjs               # ปิด tool ที่เขียนข้อมูล
DISABLED_TOOLS=place_order node guarded-server.mjs
```

**`multi`** — ให้โมเดลเลือกเรียก tool ข้าม server เองในคำสั่งเดียว

```bash
npm start     --prefix s2-mcp/multi     # พิมพ์ trace ว่าเรียกอะไรตามลำดับใด
npm run trace --prefix s2-mcp/multi     # เขียน trace.html — lane ต่อ server + hop
```

### Agent-Ready storefront — `s3-economy/storefront`

หน้าเว็บตัวอย่างที่ agent อ่านได้ + เครื่องให้คะแนน 4 ด้าน (Schema.org · `llms.txt` · MCP · agent card)

```bash
node s3-economy/storefront/serve.mjs              # :8090
node s3-economy/storefront/audit-gates.mjs        # ตรวจไฟล์ในเครื่อง
node s3-economy/storefront/audit-gates.mjs https://example.com   # ตรวจเว็บจริง
```

### พอร์ตที่ใช้

| พอร์ต | บริการ |
|---|---|
| `3000` | LINE bot (ตัวใดตัวหนึ่งใน 3 ตัว) |
| `3100` | Marketing Console |
| `3150` | Broadcast Console |
| `3200` | Web Chat |
| `8080` | เครื่องมือ static ใน `s1-martech/vibe/` |
| `8090` | storefront |
| `8787` | MCP remote (`wrangler dev`) |

---

## เทสต์

```bash
./smoke-test.sh        # 8 ด่าน ครอบคลุมทุกโปรเจกต์ · exit ≠ 0 ถ้ามีด่านพัง
```

รวมด่าน remote เข้าไปด้วยได้ทั้งกับ `wrangler dev` ในเครื่องและ endpoint ที่ deploy แล้ว:

```bash
REMOTE_MCP_URL=http://127.0.0.1:8787/mcp DEMO_API_KEY=<key> ./smoke-test.sh
```

เทสต์ย่อยที่ CI รันทุก PR — **ไม่ต้องมี API key และไม่มีเคสไหนส่งข้อความจริง**

| คำสั่ง | เคส | ครอบคลุม |
|---|---|---|
| `npm test --prefix s1-martech/line-bot-rich` | 25 | Flex ตรงข้อจำกัด LINE · ตัวจับสินค้าหมดภาษาไทย · agentic loop ทนคำตอบผิดรูป |
| `npm run test:console --prefix s1-martech/line-bot-rich` | 10 | ประตูยืนยันก่อนส่ง · ยืนยันว่า bind localhost |
| `npm run test:governance --prefix s2-mcp/security` | 27 | draft ไม่ execute · zod · kill switch · readonly · audit · วงจรสั่ง→ติดตาม |

เทสต์ที่ต้องใช้ API key (ไม่อยู่ใน CI):

```bash
npm run rehearse --prefix s1-martech/line-bot-rich          # 9 สถานการณ์ end-to-end
npm run rehearse --prefix s1-martech/line-bot-rich -- x3    # รันซ้ำ วัดว่าโมเดลเลือก tool คงที่ไหม
```

`rehearse` วิ่ง pipeline จริงแล้ว**ตรวจทุก message ตามข้อจำกัดของ LINE ก่อนส่ง** (≤5 message · `altText` · carousel ≤12 · postback data ≤300 · รูปต้อง https) เพราะ Flex ที่ผิดโครงสร้างทำให้ LINE ตอบ 400 แล้วบอทเงียบโดยไม่มี error ฝั่งเรา

---

## Deploy MCP remote

```bash
cd s2-mcp/remote
npm start                                   # ทดสอบในเครื่องก่อน (wrangler dev :8787)

export CLOUDFLARE_ACCOUNT_ID=<account-id>   # จำเป็นเมื่อบัญชีที่ล็อกอินมีหลายบัญชี
npx wrangler secret put DEMO_API_KEY        # ค่าที่พิมพ์ไม่ขึ้นจอ
npm run deploy
```

ปัจจุบัน deploy อยู่ที่ `https://cmt2026-ex-mcp.harmonyx.co/mcp` (custom domain ตั้งไว้ใน `wrangler.jsonc`)

ตรวจสิทธิ์ทำงานทั้ง `Authorization: Bearer <key>` และ `x-api-key: <key>` — ไม่ส่งหรือส่งผิดได้ `401`

ปิดการเข้าถึงเมื่อเลิกใช้:

```bash
yes | npx wrangler secret delete DEMO_API_KEY
```

---

## แนวทางการพัฒนา

- **ห้าม commit `.env` / `.dev.vars`** — เพิ่มตัวแปรใหม่ที่ `.env.example` เท่านั้น
- **ห้าม hardcode API key หรือ token** ในโค้ดทุกกรณี
- **tool MCP ใหม่ต้องมีครบ 3 อย่าง**: คำอธิบายภาษาไทยที่โมเดลเดาการใช้ได้ · zod validation · เรียก `audit()`
- **เขียนคำอธิบาย tool เป็นคำบรรยาย ไม่ใช่คำสั่ง** — ประโยคแบบ "ต้องเรียก tool นี้เสมอ" จะโดน `scan-tools.mjs` จับว่าเข้าข่าย prompt injection
- **action ที่กระทบภายนอกต้องมี human-in-the-loop** และ default เป็น dry-run
- ไม่อัปเกรด dependency ข้าม major โดยไม่อธิบายเหตุผล
- คอมเมนต์โค้ดเป็นภาษาไทย

---

## ข้อควรระวังที่เจอมาแล้ว

**`content[0]` ไม่ใช่คำตอบเสมอไป** — Sonnet 5 เปิด adaptive thinking อัตโนมัติ block แรกอาจเป็น `thinking`
ต้องหยิบด้วย `content.find(b => b.type === 'text')` ไม่ใช่ `content[0].text`

**`stop_reason` เชื่ออย่างเดียวไม่ได้** — เคยเจอ `stop_reason === 'tool_use'` แต่ไม่มี tool_use block เลย
(โมเดลพ่น `<invoke ...>` ออกมาเป็นข้อความ) ถ้าเดินต่อจะส่ง user message ว่าง → API ตอบ 400 → บอทเงียบ
ดูวิธีรับมือใน `planFromResponse()` ที่ [`agent.js`](s1-martech/line-bot-rich/agent.js)

**ตัดคำภาษาไทยด้วย `split(' ')` ใช้ไม่ได้** — ภาษาไทยไม่เว้นวรรค ฟีเจอร์ที่พึ่งการตัดคำจะตายเงียบโดยไม่มี error
ดูวิธีไล่ prefix ใน `matchSoldOut()` ที่ [`render.js`](s1-martech/line-bot-rich/render.js)

**quick tunnel ของ cloudflared ตายเงียบได้** — process ยังรัน log ยังบอก "Registered tunnel connection"
แต่โดเมนหายจาก DNS แล้ว (ปลายทางจะได้ `COULD_NOT_CONNECT`) ตรวจด้วยการยิงจากภายนอกเสมอ ไม่ใช่ดูจาก log

**secret ของ Cloudflare ใช้เวลากระจาย ~30 วินาที** — ใส่แล้วยิงทันทีจะได้ `401` ทั้งที่ key ถูก

**บอทไม่ตอบใน LINE** — ดู log ในเทอร์มินัลว่ามี `📩 webhook:` ขึ้นไหม
ถ้าไม่ขึ้นแปลว่า event ไม่ถึงเรา (webhook URL ตาย / ปิด Use webhook / โหมด OA เป็น chat)
ถ้าขึ้นแต่ไม่มีข้อความตอบกลับ ปัญหาอยู่ที่ pipeline ของเรา

---

## วัสดุประกอบการสอน

| ไฟล์ | เนื้อหา |
|---|---|
| [decks/](decks) | สไลด์ 3 sessions + Slido setup |
| [REHEARSAL.md](REHEARSAL.md) | run-of-show วันงาน + เช็คลิสต์ก่อนขึ้นเวที |
| [Demo_Prep_Playbook.md](Demo_Prep_Playbook.md) | แผนเตรียมงานเต็ม |
| [s2-mcp/EXTENDED-LAB.md](s2-mcp/EXTENDED-LAB.md) · [LAB-SECURITY](s2-mcp/LAB-SECURITY.md) · [LAB-ORCHESTRATE](s2-mcp/LAB-ORCHESTRATE.md) | แล็บ MCP |
| [s1-martech/LAB3-RICH.md](s1-martech/LAB3-RICH.md) · [LAB-MARKETING-CONSOLE](s1-martech/LAB-MARKETING-CONSOLE.md) | แล็บ LINE |
| [s3-economy/LAB-STOREFRONT.md](s3-economy/LAB-STOREFRONT.md) · [audit-prompts](s3-economy/audit-prompts.md) · [lab2-journey-canvas](s3-economy/lab2-journey-canvas.md) | แล็บ Agent Economy |
| [CLAUDE.md](CLAUDE.md) | กติกาสำหรับ Claude Code ในเรโปนี้ |
