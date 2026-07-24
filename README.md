# CMT Workshop Demos — HarmonyX AI × MarTech Series

โค้ดและวัสดุสำหรับ live demo ของ workshop 3 sessions: **AI for MarTech** · **Advanced MCP** · **Agent Economy**
ทุก demo ผ่านการรันจริง + `smoke-test.sh` 6/6 · line-bot ทดสอบกับ LINE จริงแล้ว

> วางแผนเต็มดูใน [Demo_Prep_Playbook.md](Demo_Prep_Playbook.md) · run-of-show วันงานใน [REHEARSAL.md](REHEARSAL.md) · กติกาสำหรับ Claude Code ใน [CLAUDE.md](CLAUDE.md)

---

## โครงสร้าง

```
cmt-workshop-demo/
├── s1-martech/              # Session 1 · AI for MarTech
│   ├── line-bot/            #   LINE bot (Express + @line/bot-sdk + Claude API)
│   ├── vibe/                #   เฉลย Mini-Lab: utm_builder / roi_calculator / mini_dashboard
│   ├── customer_data.csv    #   ชุดข้อมูลลูกค้า 300 ราย (ใช้ใน Lab 1 + dashboard)
│   └── prompts.md           #   3 prompts (Explore / Analyze / Recommend)
├── s2-mcp/                  # Session 2 · Advanced MCP
│   ├── local/               #   MCP server stdio (@modelcontextprotocol/sdk + zod)
│   └── remote/              #   MCP server บน Cloudflare Workers (Streamable HTTP + API key)
├── s3-economy/              # Session 3 · Agent Economy (วัสดุ ไม่มีโค้ด)
│   ├── audit-prompts.md     #   Lab 1: Agent-Readiness Audit + worksheet 4 ประตู
│   └── lab2-journey-canvas.md #  Lab 2: Agent Commerce Journey canvas
├── dev-all.sh              # สตาร์ตทุก demo แยกพอร์ตในคำสั่งเดียว
├── smoke-test.sh          # ตรวจทุก demo ก่อนวันงานในคำสั่งเดียว
└── recordings/            # วิดีโอสำรองทุก demo (ไม่ commit)
```

---

## ความต้องการเบื้องต้น

- **Node.js 18+** (แนะนำ 20+ สำหรับ Cloudflare Workers)
- **Anthropic API key** — `sk-ant-...` จาก [console.anthropic.com](https://console.anthropic.com)
- **LINE Developers account** + Messaging API channel (เฉพาะ Lab 3)
- **Cloudflare account** (ฟรี) — เฉพาะ deploy MCP remote

> ⚠️ `.env` และ `.dev.vars` ถูก gitignore — ห้าม commit · เพิ่มตัวแปรใหม่ที่ `.env.example`/`.dev.vars.example` เท่านั้น

---

## เริ่มเร็ว — รันทุก demo พร้อมกัน

```bash
./dev-all.sh
```

สตาร์ตพร้อมกัน (ใช้ `.env`/`.dev.vars` จริงถ้ามี · Ctrl-C ปิดทุกตัว):

| พอร์ต | Demo | เปิดดู |
|---|---|---|
| `8080` | Mini-Lab tools (static) | http://localhost:8080/utm_builder.html |
| `3000` | LINE bot | http://localhost:3000/ |
| `8787` | Remote MCP | http://localhost:8787/mcp |
| stdio | Local MCP | `cd s2-mcp/local && npm run inspect` |

---

## Session 1 · AI for MarTech

### Mini-Lab (Vibe Coding) — `s1-martech/vibe/`
ไฟล์ HTML เดี่ยว เปิดในเบราว์เซอร์ได้เลย ไม่ต้องรัน server:
- **`utm_builder.html`** — สร้างลิงก์ UTM (โทน `#345589` ตรง prompt starter ในสไลด์)
- **`roi_calculator.html`** — ROAS / ROI (จากกำไรขั้นต้น) / CPO / break-even คำนวณสด
- **`mini_dashboard.html`** — แดชบอร์ดจาก `customer_data.csv` 300 ราย (RFM 5 กลุ่ม + กราฟช่องทาง)

### Lab 1 — Customer Data Analysis
อัปโหลด `customer_data.csv` เข้า Claude แล้วรัน 3 prompts ตามลำดับใน [prompts.md](s1-martech/prompts.md) (Explore → Analyze RFM → Recommend + dashboard)

### Lab 3 — LINE Bot
```bash
cd s1-martech/line-bot
npm install
cp .env.example .env        # ใส่ LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET, ANTHROPIC_API_KEY (sk-ant-)
npm start                    # http://localhost:3000
```

เปิด public URL แล้วตั้ง webhook:
```bash
npx cloudflared tunnel --url http://localhost:3000
```
นำ `<tunnel-url>/webhook` ไปตั้งใน LINE Developers Console → **Verify** → เปิด **Use webhook** → **ปิด auto-reply ใน OA Manager** (จุดที่ลืมบ่อยสุด)

ทดสอบ 4 คำถามบังคับ: `ครีมกันแดดผิวมัน` · `มีโปรอะไร` · `โฟมล้างหน้ามีของไหม` (ต้องตอบว่าหมด) · `ขายรองเท้าไหม` (ต้องไม่เดา)

> รายละเอียดการทดสอบกับ LINE จริงดูใน [s1-martech/line-bot/README.md](s1-martech/line-bot/README.md)

---

## Session 2 · Advanced MCP

### Lab MCP-1 — Build (stdio) — `s2-mcp/local/`
```bash
cd s2-mcp/local
npm install
npm start           # MCP server stdio พร้อม 3 tools
npm run inspect     # ทดสอบด้วย MCP Inspector
```
3 tools: `search_products` · `check_stock` · `get_promotions` (แต่ละตัวมีคำอธิบายภาษาไทย + zod validation + `audit()`)

### Lab MCP-2 — Deploy remote (Cloudflare Workers) — `s2-mcp/remote/`
```bash
cd s2-mcp/remote
npm install
npm start                              # ทดสอบ local (wrangler dev)
npx wrangler login
npx wrangler secret put DEMO_API_KEY   # ตั้ง key (ไม่ขึ้นจอ)
npm run deploy
```
port 3 tools เดิมมาเป็น Streamable HTTP ที่ `/mcp` + ตรวจ API key (`Authorization: Bearer` หรือ `X-API-Key`) — key ผิด → `401`

> รายละเอียด deploy + ทดสอบจากเครื่องที่สองใน [s2-mcp/remote/README.md](s2-mcp/remote/README.md)

---

## Session 3 · Agent Economy

วัสดุ facilitation (ไม่มีโค้ด):
- **[audit-prompts.md](s3-economy/audit-prompts.md)** — Lab 1: prompt starter + worksheet ให้คะแนน 4 ประตู (Structured Data / AEO / MCP / Agent Card)
- **[lab2-journey-canvas.md](s3-economy/lab2-journey-canvas.md)** — Lab 2: canvas 4 ช่อง + journey 5 ขั้น + AP2 3 Mandates + Readiness Ladder

---

## ทดสอบก่อนวันงาน

```bash
./smoke-test.sh                                        # ตรวจ local ทั้งหมด
REMOTE_MCP_URL=https://.../mcp ./smoke-test.sh         # รวม remote หลัง deploy
```

ตรวจ 3 ด่าน: line-bot (webhook + signature) · MCP local (`tools/list` ครบ 3) · MCP remote (key ผิด → 401, key ถูก → serverInfo) · exit ≠ 0 ถ้ามีด่านพัง

---

## Tech stack

| โปรเจกต์ | หลัก |
|---|---|
| line-bot | Express 5 · @line/bot-sdk 11 · @anthropic-ai/sdk (โมเดล `claude-sonnet-5`) |
| mcp local | @modelcontextprotocol/sdk · zod 4 · stdio transport |
| mcp remote | Cloudflare Workers · agents 0.19 · TypeScript 7 · wrangler |

---

## กติกาการพัฒนา

- ห้ามแตะ/commit `.env` · ห้าม hardcode API key/token
- tool MCP ใหม่ทุกตัว: คำอธิบายภาษาไทยที่ AI เดาการใช้ได้ + zod validation + เรียก `audit()`
- ไม่อัปเกรด dependency ข้าม major โดยไม่อธิบายเหตุผล
- ตอบและคอมเมนต์โค้ดเป็นภาษาไทย

> ⚠️ **กับดักที่เจอ:** `claude-sonnet-5` เปิด adaptive thinking อัตโนมัติ → `response.content[0]` เป็น block `thinking` ไม่ใช่คำตอบ · ต้องหยิบ text block ตรงๆ (`content.find(b => b.type === 'text')`) ไม่ใช่ `content[0].text`
