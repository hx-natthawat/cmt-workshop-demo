# CMT Workshop Demos — HarmonyX AI × MarTech Series

Repo เตรียม live demo สำหรับ 3 workshops ดูแผนเต็มใน Demo_Prep_Playbook.md

## โครงสร้าง

- `s1-martech/line-bot` — LINE bot (Express + @line/bot-sdk + Anthropic SDK) · รัน: `npm start` · tunnel: `npx cloudflared tunnel --url http://localhost:3000`
- `s1-martech/vibe` — ผลลัพธ์ Mini-Lab ตัวอย่าง (utm_builder.html ฯลฯ)
- `s2-mcp/local` — MCP server stdio (@modelcontextprotocol/sdk) · รัน: `npm start` · ทดสอบ: `npm run inspect`
- `s2-mcp/remote` — Cloudflare Workers (Streamable HTTP ที่ `/mcp`) · dev: `npm start` · deploy: `npm run deploy` — ต้องตั้ง secret `DEMO_API_KEY` ก่อน (ดู README)
- `s3-economy` — วัสดุ Session 3 (ไม่มีโค้ด): `audit-prompts.md` (Lab 1 + worksheet 4 ประตู), `lab2-journey-canvas.md` (Lab 2 canvas)
- `deck` — สไลด์เด็คงาน (index.html) บน Cloudflare Pages · deploy: `cd deck && ./deploy.sh` · live: https://cmt2026.harmonyx.co (ดู README)
- `recordings` — วิดีโอสำรองทุก demo (ไม่ commit)
- `smoke-test.sh` — ตรวจทุก demo ก่อนวันงานในคำสั่งเดียว (line-bot / MCP local / MCP remote)

## กติกา

- ห้ามแตะไฟล์ `.env` และห้าม commit — ต้องการตัวแปรใหม่ ให้เพิ่มใน `.env.example` เท่านั้น
- ห้าม hardcode API key/token ในโค้ดทุกกรณี
- tool ใหม่ทุกตัวของ MCP ต้องมี: คำอธิบายภาษาไทยที่ AI เดาการใช้ได้, zod validation, เรียก `audit()`
- อย่าอัปเกรด dependency ข้าม major โดยไม่อธิบายเหตุผล — SDK ของ MCP เพิ่งเปลี่ยนตาม spec 2026-07-28
- ตอบและคอมเมนต์โค้ดเป็นภาษาไทย
