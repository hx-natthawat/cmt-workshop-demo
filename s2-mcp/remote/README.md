# s2-mcp/remote — Remote MCP Server บน Cloudflare Workers (D2.2)

Port มาจาก `s2-mcp/local` ครบทั้ง 3 tools + `products.json` พฤติกรรมเหมือนเดิมทุกตัว รวม audit log
เพิ่มการตรวจ API key จาก env `DEMO_API_KEY` (transport: Streamable HTTP ที่ path `/mcp`)

สร้างจาก template `cloudflare/ai/demos/remote-mcp-authless`

## Tools

| Tool | หน้าที่ |
|---|---|
| `search_products` | ค้นหาสินค้าจากคำค้น (ชื่อ, ประเภทผิว, จุดเด่น) |
| `check_stock` | ตรวจสต็อกคงเหลือจาก SKU เช่น GB-001 |
| `get_promotions` | โปรโมชันปัจจุบัน + เงื่อนไข + การจัดส่ง |

ทุก tool เรียก `audit()` — ดู log ได้จาก terminal ที่รัน `wrangler dev` หรือ `npx wrangler tail` บน production

## การตรวจ API key

ทุกคำขอไปที่ `/mcp` ต้องส่ง key ที่ตรงกับ secret `DEMO_API_KEY` ไม่งั้นโดน `401`:

- `Authorization: Bearer <key>` (แนะนำ) หรือ
- `X-API-Key: <key>`

ถ้ายังไม่ได้ตั้ง `DEMO_API_KEY` server จะปฏิเสธทุกคำขอ

## รันทดสอบในเครื่อง

```bash
npm install
```

ตั้ง key สำหรับ dev — เลือกอย่างใดอย่างหนึ่ง:

1. คัดลอก `.dev.vars.example` เป็น `.dev.vars` แล้วใส่ค่าจริง (ห้าม commit) จากนั้น `npm start`
2. หรือส่งผ่าน CLI ไม่ต้องสร้างไฟล์:

```bash
./node_modules/.bin/wrangler dev --port 8787 --var DEMO_API_KEY:<key-ของท่าน>
```

ทดสอบด้วย curl (ต้องได้ `401`):

```bash
curl -i -X POST http://localhost:8787/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'
```

แล้วลองใหม่พร้อม header `-H 'authorization: Bearer <key>'` — ต้องได้ `serverInfo.name = glow-beauty-products`

หรือทดสอบผ่าน MCP Inspector:

```bash
npx @modelcontextprotocol/inspector
```

เลือก transport เป็น Streamable HTTP, URL `http://localhost:8787/mcp` แล้วเพิ่ม header `Authorization: Bearer <key>`

### ✅ ตรวจให้ครบด้วยคำสั่งเดียวก่อน deploy

`smoke-test.sh` ใช้กับ worker ในเครื่องได้เลย ไม่ต้อง deploy ก่อน:

```bash
REMOTE_MCP_URL=http://127.0.0.1:8787/mcp DEMO_API_KEY=<key-ที่ใช้ตอน dev> ./smoke-test.sh
```
ด่าน 8 ต้องขึ้น ✅ ทั้งคู่ (key ผิด → 401 · key ถูก → `serverInfo`)
**ผ่านตรงนี้แล้ว deploy เหลือแค่เรื่องบัญชี Cloudflare — โค้ดพิสูจน์แล้ว**

> ตรวจจริงเมื่อ 2026-07-27 หลังอัป dependency ข้าม major (agents 0.19 · wrangler ใหม่ · TypeScript 7):
> `tsc --noEmit` ผ่าน · auth ผ่านทั้ง `Authorization: Bearer` และ `x-api-key` · ไม่ส่ง key → 401
> · `tools/list` ครบ 3 tools · เรียก `search_products` / `check_stock` / `get_promotions` ได้ข้อมูลจริง

## ขั้นตอน Deploy

```bash
npx wrangler login
```

```bash
npx wrangler secret put DEMO_API_KEY
```

(พิมพ์ key กลางของห้องเรียนตอนถูกถาม — ไม่ปรากฏบนจอ ใช้ key ที่ revoke ได้หลังจบงานตามกฎเหล็กข้อ 4)

```bash
npm run deploy
```

ได้ URL รูปแบบ `https://glow-beauty-mcp.<subdomain>.workers.dev` → endpoint คือ `https://.../mcp`

**Deploy จริงของงาน CMT 2026** (custom domain ตั้งไว้ใน `wrangler.jsonc` แล้ว):

| | |
|---|---|
| endpoint | `https://cmt2026-ex-mcp.harmonyx.co/mcp` |
| บัญชี Cloudflare | Harmonyx (`60b088834829272a6ee94498be2ea356`) |

มีหลายบัญชีในเครื่องเดียวกัน ต้องระบุบัญชีทุกครั้ง:
```bash
CLOUDFLARE_ACCOUNT_ID=60b088834829272a6ee94498be2ea356 npm run deploy
CLOUDFLARE_ACCOUNT_ID=60b088834829272a6ee94498be2ea356 npx wrangler secret put DEMO_API_KEY
```

ทดสอบจากเครื่องที่สอง (งาน D-3): ใช้ curl ชุดเดียวกับด้านบน เปลี่ยน URL เป็นของจริง
ต้องผ่านทั้ง 2 กรณี: key ถูก → ตอบปกติ, key ผิด/ไม่ส่ง → `401`

## เชื่อมกับ Claude

เพิ่มใน Claude Desktop / Claude Code เป็น remote MCP server:

```bash
claude mcp add --transport http glow-beauty https://glow-beauty-mcp.<subdomain>.workers.dev/mcp --header "Authorization: Bearer <key>"
```
