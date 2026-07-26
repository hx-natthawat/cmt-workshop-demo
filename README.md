# CMT Workshop Demos — HarmonyX AI × MarTech Series

โค้ดและวัสดุ live demo สำหรับ workshop 3 sessions: **AI for MarTech** · **Advanced MCP** · **Agent Economy**
ทุก demo ผ่านการรันจริง + `smoke-test.sh` · LINE bot ทดสอบกับ LINE จริงแล้ว

> แผนเต็ม: [Demo_Prep_Playbook.md](Demo_Prep_Playbook.md) · run-of-show วันงาน: [REHEARSAL.md](REHEARSAL.md) · กติกา Claude Code: [CLAUDE.md](CLAUDE.md)

---

## เริ่มเร็ว

```bash
./dev-all.sh        # สตาร์ตทุก demo แยกพอร์ต (vibe :8080 · line-bot :3000 · remote MCP :8787)
./smoke-test.sh     # ตรวจทุก demo ก่อนวันงานในคำสั่งเดียว
```

| พอร์ต | บริการ | เปิด |
|---|---|---|
| `8080` | Mini-Lab tools (static) | [utm_builder](http://localhost:8080/utm_builder.html) · [roi_calculator](http://localhost:8080/roi_calculator.html) · [mini_dashboard](http://localhost:8080/mini_dashboard.html) |
| `3000` | LINE bot (เลือกได้ 3 ระดับ — ดูตารางล่าง) | http://localhost:3000 |
| `3100` | Marketing Console (operator UI) | http://localhost:3100 |
| `3200` | Web Chat widget | http://localhost:3200 |
| `8090` | Agent-Ready storefront | http://localhost:8090 |
| `8787` | Remote MCP (`/mcp`) | wrangler dev |

---

## โครงสร้าง

```
cmt-workshop-demo/
├── s1-martech/                 # Session 1 · AI for MarTech
│   ├── line-bot/               #   Lab 3 — bot พื้นฐาน (context ใน system prompt)
│   ├── line-bot-mcp/           #   bot ที่เรียก MCP tools จริง
│   ├── line-bot-rich/          #   ⭐ flagship — Flex/Postback/RichMenu + engagement layer + Console
│   ├── vibe/                   #   เฉลย Mini-Lab A/B/C (utm · roi · dashboard)
│   ├── customer_data.csv       #   ลูกค้า 300 ราย (Lab 1 + RFM segments)
│   └── prompts.md              #   3 prompts (Explore / Analyze / Recommend)
├── s2-mcp/                     # Session 2 · Advanced MCP
│   ├── local/                  #   Lab MCP-1 — stdio server (3 tools)
│   ├── remote/                 #   Lab MCP-2 — Cloudflare Workers + API key
│   └── showcase/               #   ⭐ MCP โลกจริง (6 tools + resource + prompt)
├── s3-economy/                 # Session 3 · Agent Economy
│   └── storefront/             #   Agent-Ready storefront + เครื่องตรวจ 4 ประตู
├── dev-all.sh · smoke-test.sh  # เครื่องมือซ้อม
└── recordings/                 # วิดีโอสำรอง (ไม่ commit)
```

---

## Session 1 · AI for MarTech

### Mini-Lab (Vibe Coding) — `s1-martech/vibe/`
เปิดในเบราว์เซอร์ได้เลย ไม่ต้องรัน server: `utm_builder.html` · `roi_calculator.html` · `mini_dashboard.html`
> `utm_builder` ตั้งใจให้ปุ่มยัง**ไม่เป็นสีเขียว** และ**ไม่มีปุ่ม reset** — เพื่อให้ live demo D1.2 ("เปลี่ยนสีปุ่ม + เพิ่ม reset") เห็นผลชัด

### Lab 1 — Customer Data Analysis
อัปโหลด `customer_data.csv` เข้า Claude แล้วรัน 3 prompts ใน [prompts.md](s1-martech/prompts.md)

### Lab 3 — LINE Bot (มี 3 ระดับ — เล่าเป็น progression ได้)

| โฟลเดอร์ | ข้อมูล | ความสามารถ | ใช้ตอน |
|---|---|---|---|
| [`line-bot`](s1-martech/line-bot) | context ใน system prompt | ตอบสินค้า/โปร | **Lab 3 พื้นฐาน** |
| [`line-bot-mcp`](s1-martech/line-bot-mcp) | เรียก MCP tools จริง | + แนะนำตามผิว · เช็คออเดอร์ · ร่างออเดอร์ | เชื่อม S1↔S2 |
| [`line-bot-rich`](s1-martech/line-bot-rich) ⭐ | MCP + presentation layer | + **Flex · Quick Reply · ปุ่มยืนยัน · Rich Menu** | flagship |

```bash
cd s1-martech/line-bot && npm install && cp .env.example .env   # ใส่ LINE token + ANTHROPIC_API_KEY (sk-ant-)
npm start && npx cloudflared tunnel --url http://localhost:3000
```
นำ `<tunnel>/webhook` ไปตั้งใน LINE Console → Verify → เปิด Use webhook → **ปิด auto-reply ใน OA Manager**

ทดสอบ 4 คำถามบังคับ: `ครีมกันแดดผิวมัน` · `มีโปรอะไร` · `โฟมล้างหน้ามีของไหม` (ต้องตอบว่าหมด) · `ขายรองเท้าไหม` (ต้องไม่เดา)

### Engagement layer (`line-bot-rich`) — แพลตฟอร์มการตลาด

| คำสั่ง | ได้อะไร |
|---|---|
| `npm run console` | 🏢 **Marketing Console** (:3100) — Overview · Broadcast · Segments · Restock · Analytics |
| `npm run webchat` | 🌐 **Web Chat** (:3200) — MCP tools ชุดเดียวกับ LINE (omnichannel) |
| `npm run voc-report` | 📊 **VoC Dashboard** — funnel + tool usage (data loop → วัด ROI) |
| `npm run broadcast` | 📣 broadcast โปร (dry-run default) |
| `npm run restock-notify GB-004` | 🔔 แจ้งลูกค้าเมื่อของกลับมา |
| `npm run broadcast-segment "แชมป์ตัวจริง"` | 🎯 targeting ตาม RFM |

> ⚠️ action ที่ส่งจริงมี **governance** ทุกจุด (dry-run default / ยืนยัน 2 ชั้นใน UI) · หน้า operator รัน localhost เท่านั้น

---

## Session 2 · Advanced MCP

### Lab MCP-1 — Build (stdio) — [`s2-mcp/local`](s2-mcp/local)
```bash
cd s2-mcp/local && npm install && npm start   # 3 tools: search_products · check_stock · get_promotions
npm run inspect                                # MCP Inspector
```

### Lab MCP-2 — Deploy (Cloudflare Workers) — [`s2-mcp/remote`](s2-mcp/remote)
```bash
cd s2-mcp/remote && npm install && npm start   # ทดสอบ local
npx wrangler login && npx wrangler secret put DEMO_API_KEY && npm run deploy
```
Streamable HTTP ที่ `/mcp` + ตรวจ API key (key ผิด → `401`)

### Lab Security (bonus) — ภัยเฉพาะ MCP + การป้องกัน — [`s2-mcp/security`](s2-mcp/security)
```bash
cd s2-mcp/security && npm install
npm run scan:poisoned    # 🚨 สแกนเนอร์จับ tool poisoning (exit 1)
npm run scan:guarded     # ✅ ผ่าน
npm run report           # 📊 รายงาน UI — ไฮไลต์คำสั่งฝัง เทียบ poisoned vs guarded
npm run test:governance  # 🔒 ประตูกำกับดูแล 21 เคส (showcase + guarded) ไม่ใช้ API key
DISABLED_TOOLS=place_order node guarded-server.mjs   # kill switch
```
tool poisoning demo (payload ไม่มีพิษ) · สแกนเนอร์ 7 กฎ · guarded server 5 การป้องกัน · [คู่มือ lab](s2-mcp/LAB-SECURITY.md)

### Lab Orchestrate (bonus) — Claude เรียกหลาย MCP ต่อกันเอง — [`s2-mcp/multi`](s2-mcp/multi)
```bash
cd s2-mcp/multi && npm install
npm start          # Claude ต่อ analytics + shop พร้อมกัน แล้วเลือกเรียกเองในคำสั่งเดียว
npm run trace      # 📊 แผนภาพ UI — lane ต่อ server · hop · call ที่ขนานกัน
```
"บันได Enterprise ขั้นที่ 4" — analytics server (ตัวที่ 2, จาก CSV จริง) + showcase · แสดง trace ว่าเรียกข้าม server ไหน · [คู่มือ lab](s2-mcp/LAB-ORCHESTRATE.md)

### Lab MCP-3 (bonus) — MCP โลกจริง — [`s2-mcp/showcase`](s2-mcp/showcase)
ครบทั้ง 3 primitives · [คู่มือ lab](s2-mcp/EXTENDED-LAB.md)

| Tool | Pattern โลกจริง |
|---|---|
| `recommend_for_skin` | Personalization |
| `track_order` | เชื่อมระบบหลังบ้าน |
| `create_draft_order` → `confirm_order` | **Governed action** (รออนุมัติ → execute หลังลูกค้ายืนยัน) |
| `get_bestsellers` · `get_promotions` | Analytics · ข้อมูลโปร |

\+ **Resource** `store://policy` · **Prompt** `after_sales_reply`

---

## Session 3 · Agent Economy

วัสดุ facilitation:
- [audit-prompts.md](s3-economy/audit-prompts.md) — Lab 1: Agent-Readiness Audit + worksheet 4 ประตู
- [lab2-journey-canvas.md](s3-economy/lab2-journey-canvas.md) — Lab 2: Journey canvas + AP2 Mandates + Readiness Ladder

### Lab Storefront (bonus) — แบรนด์ที่ agent มองเห็น — [`s3-economy/storefront`](s3-economy/storefront)
```bash
cd s3-economy/storefront && node serve.mjs    # → http://localhost:8090
node audit-gates.mjs http://localhost:8090    # ตรวจ 4 ประตูอัตโนมัติ (17/20)
node audit-gates.mjs https://brandของทีม      # ⭐ ตรวจแบรนด์จริง
```
Schema.org JSON-LD · `llms.txt` · `/.well-known/agent-card.json` (มี `x-negotiable`) · เครื่องตรวจ 4 ประตูให้คะแนน 0-5 · [คู่มือ lab](s3-economy/LAB-STOREFRONT.md)

---

## Labs เสริม (bonus)

| Lab | ไฟล์ |
|---|---|
| MCP-3 · MCP in the Real World | [s2-mcp/EXTENDED-LAB.md](s2-mcp/EXTENDED-LAB.md) |
| Security · ภัยเฉพาะ MCP + ป้องกัน | [s2-mcp/LAB-SECURITY.md](s2-mcp/LAB-SECURITY.md) |
| Orchestrate · multi-server | [s2-mcp/LAB-ORCHESTRATE.md](s2-mcp/LAB-ORCHESTRATE.md) |
| 3-Rich · LINE Rich UI + governance | [s1-martech/LAB3-RICH.md](s1-martech/LAB3-RICH.md) |
| Marketing Console · operator UI | [s1-martech/LAB-MARKETING-CONSOLE.md](s1-martech/LAB-MARKETING-CONSOLE.md) |
| Storefront · Agent-Ready 4 ประตู | [s3-economy/LAB-STOREFRONT.md](s3-economy/LAB-STOREFRONT.md) |

---

## ทดสอบก่อนวันงาน

```bash
./smoke-test.sh                                     # local ทั้งหมด
REMOTE_MCP_URL=https://.../mcp ./smoke-test.sh      # รวม remote หลัง deploy
```
8 ด่าน: line-bot · MCP local · MCP showcase · MCP security · MCP multi · storefront (4 ประตู) · MCP remote · exit ≠ 0 ถ้ามีด่านพัง

---

## ความต้องการเบื้องต้น

- **Node.js 18+** (แนะนำ 20+ สำหรับ Cloudflare Workers)
- **Anthropic API key** — `sk-ant-...` จาก [console.anthropic.com](https://console.anthropic.com)
- **LINE Developers** + Messaging API channel (เฉพาะ Lab 3)
- **Cloudflare account** (ฟรี) — เฉพาะ deploy MCP remote

> ⚠️ `.env` / `.dev.vars` ถูก gitignore — ห้าม commit · เพิ่มตัวแปรใหม่ที่ `.env.example` เท่านั้น

---

## Tech stack

| ส่วน | หลัก |
|---|---|
| LINE bots | Express 5 · @line/bot-sdk 11 · @anthropic-ai/sdk (`claude-sonnet-5`) |
| MCP local/showcase | @modelcontextprotocol/sdk · zod 4 · stdio |
| MCP remote | Cloudflare Workers · agents 0.19 · TypeScript 7 |
| UI | IBM Plex Sans Thai · design tokens + dark mode · inline SVG icons |

---

## กติกาการพัฒนา

- ห้ามแตะ/commit `.env` · ห้าม hardcode API key/token
- tool MCP ใหม่: คำอธิบายภาษาไทยที่ AI เดาการใช้ได้ + zod validation + เรียก `audit()`
- action ที่กระทบภายนอก (broadcast/ตัดสต็อก) ต้องมี **human-in-the-loop**
- ไม่อัปเกรด dependency ข้าม major โดยไม่อธิบายเหตุผล
- ตอบและคอมเมนต์โค้ดเป็นภาษาไทย

> ⚠️ **กับดัก Sonnet 5:** เปิด adaptive thinking อัตโนมัติ → `response.content[0]` เป็น block `thinking` ไม่ใช่คำตอบ · ต้องหยิบ text block ตรงๆ (`content.find(b => b.type === 'text')`) ไม่ใช่ `content[0].text`
