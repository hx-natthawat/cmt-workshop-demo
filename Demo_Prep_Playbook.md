# Live Demo Playbook — เตรียม "โค้ดจริง โชว์จริง" ทั้ง 3 Workshops

แผนเตรียมทุกจุดที่ต้องรันของจริงต่อหน้าห้อง: สิ่งที่ต้อง build, คำสั่ง, เช็คลิสต์ทดสอบ, จุดพังที่พบบ่อย และ fallback
หลักการเดียว: **ทุก demo ต้องผ่านการรันจริงครบ 2 รอบก่อนวันงาน + มีวิดีโอสำรองทุกตัว**

---

## 0. โครง Repo แนะนำ (เตรียมครั้งเดียว ใช้ทั้งซีรีส์)

```
workshop-demos/
├── s1-martech/
│   ├── customer_data.csv          # จากชุดเอกสาร
│   ├── prompts.md                 # 3 prompts จาก Appendix B (copy-paste ได้ทันที)
│   ├── vibe/                      # ผลลัพธ์ mini-lab ที่ทำไว้เป็นตัวอย่าง (utm_builder.html ฯลฯ)
│   └── line-bot/                  # line_bot_starter + .env (ห้าม commit .env)
├── s2-mcp/
│   ├── local/                     # mcp_server_starter (stdio)
│   └── remote/                    # Cloudflare Workers template ที่ port tools แล้ว
├── s3-economy/
│   └── audit-prompts.md           # prompt audit + รายชื่อแบรนด์ที่ทดสอบแล้ว
└── recordings/                    # วิดีโอสำรองทุก demo (mp4)
```

บัญชี/ของที่ต้องมี (สมัครก่อน D-7): Claude Pro ขึ้นไป (วิทยากร) · Anthropic API key กลางสำหรับห้องเรียน · LINE Developers + OA ทดสอบ 1 บัญชี · Cloudflare ฟรี 1 บัญชี · Node.js 18+ · cloudflared หรือ ngrok · โปรแกรมอัดจอ (OBS/QuickTime)

---

## Session 1 · AI for MarTech — 4 จุดต้องเตรียม

### D1.1 — Live Demo หลัก (สไลด์ 25): Claude + customer_data.csv

**สิ่งที่โชว์:** อัปโหลด CSV → prompt C-R-T-F → insight 5 ข้อ → RFM segments → dashboard artifact (ทั้งหมด ~5 นาที)

เตรียม:
1. เปิด Claude (โปรเจกต์แยกสำหรับ demo — ห้อง chat สะอาด ไม่มีประวัติหลุด)
2. รัน 3 prompts จาก Appendix B ตามลำดับจริง จับเวลา — ถ้าเกิน 5 นาที ตัด prompt 3 เหลือแค่ dashboard
3. จดผลลัพธ์ที่ได้ (เลข segment, ชื่อที่ AI ตั้ง) ไว้เทียบวันจริง — ผลจะไม่เหมือนเดิม 100% ต้องชินกับความต่าง
4. **อัดวิดีโอรอบที่รันสวยที่สุด** เก็บใน recordings/

เช็คลิสต์ผ่าน: ☐ insight อ้างเลขจริงจากไฟล์ ☐ RFM แบ่ง 4-5 กลุ่มมีชื่อไทย ☐ dashboard เปิด render ได้
จุดพัง/fallback: เน็ตล่ม → เปิดวิดีโอ · Claude ช้า/คิวยาว → มี artifact ที่ generate ไว้แล้วเปิดโชว์แทน

### D1.2 — Vibe Coding สาธิตสด 1 นาที (สไลด์ 26 โน้ต)

**สิ่งที่โชว์:** ขอให้ Claude แก้ไฟล์จริงต่อหน้าห้อง เช่น "เปลี่ยนสีปุ่มใน utm_builder.html เป็นสีเขียว แล้วเพิ่มปุ่ม reset"

เตรียม: สร้าง utm_builder.html ด้วยตัวเองก่อน (ใช้ prompt starter ในสไลด์ 27) เก็บไว้ใน s1-martech/vibe/ · ซ้อมคำสั่งแก้ 2-3 แบบ เลือกอันที่เห็นผลชัดใน 1 rounds
fallback: ข้ามได้โดยไม่เสียเนื้อหา (เป็น optional ในโน้ตอยู่แล้ว)

### D1.3 — Mini-Lab เฉลย (สไลด์ 27)

ทำโจทย์ A/B/C **ทั้งสามข้อ** ด้วยตนเองก่อน เก็บผลใน vibe/ — เพื่อ (ก) รู้จุดที่ผู้เรียนจะติด (ข) มีตัวอย่างโชว์ปิดท้าย (ค) ใช้เป็น fallback ให้ทีมที่ทำไม่ทัน

### D1.4 — LINE Bot end-to-end (โมดูล LINE, สไลด์ 39-44)

**นี่คือ demo ที่พังง่ายที่สุด — ซ้อมเต็ม flow อย่างน้อย 2 รอบ**

```bash
cd s1-martech/line-bot
npm install
cp .env.example .env        # ใส่ LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET, ANTHROPIC_API_KEY
npm start
# terminal ใหม่:
npx cloudflared tunnel --url http://localhost:3000
```

จากนั้น: นำ URL + `/webhook` ใส่ใน LINE Developers Console → Verify → เปิด Use webhook → **ปิด auto-reply ใน OA Manager** (จุดที่ลืมบ่อยสุด)

ทดสอบ 4 คำถามบังคับ: ☐ "ครีมกันแดดผิวมัน" ☐ "มีโปรอะไร" ☐ "โฟมล้างหน้ามีของไหม" (ต้องตอบว่าหมด) ☐ "ขายรองเท้าไหม" (ต้องไม่เดา)
จุดพัง: URL cloudflared เปลี่ยนทุกครั้งที่รันใหม่ → ต้องอัปเดต console ทุกครั้ง | token หมดอายุ/ผิดตัว → เตรียม token สำรองจดไว้
fallback: วิดีโอ + สแกน QR ของ OA ที่วิทยากรรันไว้แล้วให้ผู้เรียนลองคุยแทนการ build เอง

---

## Session 2 · Advanced MCP — 3 จุดต้องเตรียม

> ⚠️ **สำคัญที่สุดของ session นี้:** spec MCP 2026-07-28 เพิ่ง final — ก่อนซ้อมให้รัน `npm outdated` ใน starter และอ่าน changelog ของ `@modelcontextprotocol/sdk` เวอร์ชันล่าสุด ถ้า API เปลี่ยน ให้แก้ starter ก่อนแจกผู้เรียน

### D2.1 — MCP server local (Lab 1, สไลด์ 9)

```bash
cd s2-mcp/local          # = mcp_server_starter
npm install
npm start                 # ต้องเห็น: ✅ MCP server พร้อมใช้งาน
npm run inspect           # เปิด MCP Inspector — เรียกทั้ง 3 tools ดู [AUDIT] log
```

เชื่อม Claude Desktop: แก้ `claude_desktop_config.json` (path เต็ม!) → restart Claude → ถาม "ครีมกันแดดตัวไหนมีของ"
เช็คลิสต์: ☐ Claude เรียก tool เองโดยไม่บอกชื่อ ☐ ถามนอกข้อมูลไม่มโน ☐ AUDIT log ขึ้นทุก call
ซ้อมเพิ่ม: **เพิ่ม tool ใหม่สด 1 ตัวต่อหน้าห้อง** (get_bestsellers) — เขียนเองหรือ vibe-code ด้วย Claude Code แล้วอธิบายทุกบรรทัด — นี่คือโมเมนต์ "ครู build สด" ที่ทรงพลังที่สุดของ session
จุดพัง: path ใน config ผิด / ลืม restart Claude — ทั้งคู่แก้ใน 1 นาทีถ้ารู้ล่วงหน้า

### D2.2 — Remote deploy (Lab 2, สไลด์ 16) — **ต้อง build เพิ่มก่อนวันงาน**

starter ปัจจุบันเป็น stdio — Lab 2 ต้องมีเวอร์ชัน Streamable HTTP บน Cloudflare template:

```bash
npm create cloudflare@latest s2-mcp-remote -- --template=cloudflare/ai/demos/remote-mcp-authless
cd s2-mcp-remote
# ย้าย 3 tools + products.json จาก local/server.mjs เข้า src/ ตามโครง template
npx wrangler login
npx wrangler deploy       # ได้ URL: https://<name>.<account>.workers.dev
npx wrangler secret put DEMO_API_KEY   # แล้วเพิ่มการตรวจ key ในโค้ด
```

ทดสอบ: ☐ Inspector ต่อ URL remote ได้ ☐ เรียกโดยไม่มี key ถูกปฏิเสธ ☐ **ทดสอบจากเครื่องที่สอง** (มือถือ hotspot จำลองเครื่องผู้เรียน)
เมื่อเสร็จ: zip โฟลเดอร์นี้เป็น starter เวอร์ชัน remote แจกผู้เรียนใน Lab 2 (อัปเดต mcp_server_starter ให้มีทั้ง local/ และ remote/)
จุดพัง: ชื่อ worker ซ้ำ (ให้ผู้เรียนเติมเลขท้าย) · wrangler login ครั้งแรกเปิด browser — บอกผู้เรียนล่วงหน้า
fallback: วิทยากรมี URL remote ที่ deploy ไว้แล้ว — ทีมที่ deploy ไม่ทันให้เชื่อม URL กลางเพื่อไม่พลาดประสบการณ์ cross-connect

### D2.3 — Multi-server ปิดท้าย (สไลด์ 19) — optional แต่ว้าวมาก

ถ้ามีเวลา: ตั้ง Claude Desktop เชื่อม 2 servers พร้อมกัน (product server + LINE MCP server ทางการ `@line/line-bot-mcp-server`) แล้วสั่งประโยคเดียว: "เช็คสต็อกครีมกันแดด ถ้าเหลือน้อยกว่า 10 ส่งข้อความเตือนทีมทาง LINE" — เห็น agent เรียก 2 servers ต่อกันจริง
fallback: ใช้ diagram ในสไลด์เล่าแทน (ไม่บังคับ)

---

## Session 3 · The Agent Economy — 2 จุดต้องเตรียม

### D3.1 — Agent-Readiness Audit สาธิตนำ (Lab 1, สไลด์ 7)

**เตรียมสำคัญ: เลือกแบรนด์ตัวอย่างล่วงหน้า** — ทดสอบ prompt audit กับแบรนด์ไทยจริง 3-4 ราย แล้วเลือกมา 2:
- 1 แบรนด์ที่ "อ่านออกดี" (มี structured data ราคา/นโยบายชัด) — โชว์ว่าดีเป็นอย่างไร
- 1 แบรนด์ที่ "agent ตาบอด" (ราคาใน DM, โปรฯ ในรูป) — โมเมนต์ตาสว่างของห้อง

รัน prompt จากสไลด์ 7 กับทั้งสองแบรนด์ อัดวิดีโอไว้ · จดประเด็นที่ Claude เจอ เพื่อชี้นำ discussion
ข้อระวัง: อย่าเลือกแบรนด์ของผู้เรียนในห้องเป็นตัวอย่าง "แย่" — ให้ความเสี่ยงนี้เกิดใน lab ของทีมเขาเอง ไม่ใช่บนจอวิทยากร

### D3.2 — A2A/AP2 ของจริงประกอบ (สไลด์ 9-10) — optional

เปิดหน้า docs จริงให้เห็นว่าไม่ใช่ทฤษฎีลอย: Agent Card ตัวอย่างจาก a2a-protocol docs และ mandate structure จาก ap2-protocol.org — bookmark ไว้ 2 แท็บ พร้อม screenshot สำรองกรณีเน็ตช้า

---

## เตรียมทั้งหมดด้วย Claude Code

ทุกงาน build/ทดสอบในแผนนี้ทำผ่าน Claude Code ได้ (และควรทำ — ท่านจะได้เรื่องเล่า "ผมเตรียม workshop นี้ด้วยเครื่องมือที่กำลังสอน" เพิ่มอีกชั้น)

### ติดตั้งและเริ่ม

```bash
npm install -g @anthropic-ai/claude-code
cd workshop-demos
claude        # เริ่ม session ในราก repo
```

### วาง CLAUDE.md ไว้ที่รากของ repo (คัดลอกได้เลย)

```markdown
# Workshop Demos — HarmonyX AI × MarTech Series

Repo เตรียม live demo สำหรับ 3 workshops ดูแผนเต็มใน Demo_Prep_Playbook.md

## โครงสร้าง
- s1-martech/line-bot — LINE bot (Express + @line/bot-sdk + Anthropic SDK), รัน: npm start, tunnel: npx cloudflared tunnel --url http://localhost:3000
- s2-mcp/local — MCP server stdio (@modelcontextprotocol/sdk), รัน: npm start, ทดสอบ: npm run inspect
- s2-mcp/remote — Cloudflare Workers (Streamable HTTP), deploy: npx wrangler deploy
- s3-economy — prompt สำหรับ audit ไม่มีโค้ด

## กติกา
- ห้ามแตะไฟล์ .env และห้าม commit — ถ้าต้องการตัวแปรใหม่ ให้เพิ่มใน .env.example เท่านั้น
- ห้าม hardcode API key/token ในโค้ดทุกกรณี
- โค้ดใหม่ทุก tool ของ MCP ต้องมี: คำอธิบายภาษาไทยที่ AI เดาการใช้ได้, zod validation, เรียก audit()
- อย่าอัปเกรด dependency ข้าม major โดยไม่บอกเหตุผล — SDK ของ MCP เพิ่งเปลี่ยนตาม spec 2026-07-28
- ตอบ/คอมเมนต์เป็นภาษาไทย
```

### ตัวอย่าง prompt ต่อ Claude Code รายงานเตรียม

| งาน | สั่ง Claude Code ว่า |
|---|---|
| เช็ค SDK หลัง spec ใหม่ (D-14) | "รัน npm outdated ทั้ง s1 กับ s2 แล้วอ่าน breaking changes ของ @modelcontextprotocol/sdk เวอร์ชันล่าสุด สรุปว่า starter เราต้องแก้อะไรบ้าง — ยังไม่ต้องแก้ ให้รายงานก่อน" |
| Build งานใหญ่ D2.2 (D-10) | "สร้างโปรเจกต์จาก template cloudflare/ai/demos/remote-mcp-authless ใน s2-mcp/remote แล้ว port ทั้ง 3 tools กับ products.json จาก s2-mcp/local มาให้ครบ พฤติกรรมต้องเหมือนเดิมทุก tool รวม audit log จากนั้นเพิ่มการตรวจ API key จาก env DEMO_API_KEY แล้วบอกขั้นตอน deploy" |
| Mini-Lab เฉลย (D-10) | "สร้าง utm_builder.html, roi_calculator.html และ mini dashboard จาก customer_data.csv ตามโจทย์ A/B/C ในสไลด์ Mini-Lab เก็บใน s1-martech/vibe/ ทีละไฟล์ ให้ผมรีวิวก่อนทำไฟล์ถัดไป" |
| ซ้อม + สร้างชุดทดสอบ (D-7) | "เขียนสคริปต์ smoke-test.sh ที่ตรวจว่า: line-bot ตอบ webhook จำลองได้, MCP server local ตอบ tools/list ได้, remote URL ตอบและปฏิเสธ key ผิด — ให้รันก่อนวันงานได้ในคำสั่งเดียว" |
| แก้บั๊กระหว่างซ้อม | วางข้อความ error แล้วสั่ง "อธิบายสาเหตุก่อน แล้วเสนอวิธีแก้ที่เล็กที่สุด อย่าเพิ่งแก้จนกว่าผมยืนยัน" |
| เพิ่ม tool สดต่อหน้าห้อง (D2.1) | ซ้อมประโยคนี้ให้คล่อง: "เพิ่ม tool ชื่อ get_bestsellers ใน server.mjs คืนสินค้า 3 อันดับที่ stock ต่ำสุดเทียบราคา ตามแพทเทิร์นเดียวกับ tool อื่น พร้อม audit" — แล้วอ่านโค้ดที่ได้ให้ห้องฟังทีละส่วน |

ข้อเดียวที่ต้องถือ: **ทุกอย่างที่ Claude Code เขียน ท่านต้องอ่านจนอธิบายได้** — เพราะนั่นคือกติกาเดียวกับที่เราสอนผู้เรียนใน Capstone

---

## Master Timeline

| เมื่อไร | ทำอะไร |
|---|---|
| **D-14** | สมัคร/ตรวจบัญชีทั้งหมด (ข้อ 0) · ตั้งโครง repo + วาง CLAUDE.md · ให้ Claude Code เช็ค SDK หลัง spec final |
| **D-10** | Build D2.2 (remote template) — งานเดียวที่ต้องเขียนโค้ดเพิ่ม · ทำโจทย์ Mini-Lab A/B/C |
| **D-7** | ซ้อมรอบที่ 1 ทุก demo ตามลำดับจริง จับเวลา · จดจุดติด |
| **D-3** | ซ้อมรอบที่ 2 + **อัดวิดีโอสำรองทุกตัว** · ทดสอบ D2.2 จากเครื่องที่สอง · เลือกแบรนด์ D3.1 |
| **D-1** | รัน smoke test สั้น: ทุก `npm start` ขึ้น ทุก token ยังไม่หมดอายุ · ชาร์จอุปกรณ์ เตรียม hotspot · เปิดวิดีโอสำรองเช็คว่าเล่นได้ |
| **เช้าวันงาน** | ต่อจอจริง เปิดทุกแท็บ/terminal ที่ต้องใช้เรียงไว้ · ปิด notifications · เข้าโหมด Do Not Disturb |

## กฎเหล็ก 5 ข้อของ Demo สด

1. **ห้อง chat สะอาดเสมอ** — สร้างใหม่ทุกครั้ง ไม่มีประวัติ/ข้อมูลจริงหลุดบนจอ
2. **ทุก demo มีวิดีโอแฝด** — พังเมื่อไหร่ สลับใน 10 วินาที แล้วเดินหน้าต่อ ไม่ debug ต่อหน้าห้อง
3. **อย่า demo สิ่งที่เพิ่งแก้เมื่อคืน** — โค้ดที่ยังไม่ผ่านการซ้อม 2 รอบ = วิดีโอเท่านั้น
4. **token/key ไม่ปรากฏบนจอ** — .env เปิดใน editor ที่ mask หรือไม่เปิดเลย · ใช้ key กลางที่ revoke ได้หลังจบ
5. **ซ้อมด้วยเน็ตมือถือ 1 รอบ** — ถ้าผ่าน hotspot ได้ วันจริงผ่านทุกอย่างได้
