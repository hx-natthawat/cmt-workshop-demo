# MCP Server Starter — Advanced MCP Workshop (HarmonyX)

เขียน MCP Server ของตัวเอง เปิดข้อมูลสินค้าให้ Claude เรียกผ่าน 3 tools
(Lab 1: Build · Lab 2: Deploy)

## Lab 1 — รันบนเครื่อง (stdio)

### Step 1 — ติดตั้งและรัน (5 นาที)

```bash
npm install
npm start        # ควรเห็น: ✅ MCP server พร้อมใช้งาน
```

### Step 2 — ทดสอบด้วย MCP Inspector (10 นาที)

```bash
npm run inspect
```

เปิด URL ที่แสดง → แท็บ **Tools** → ลองเรียก `search_products` ด้วย query "กันแดด"
ดู request/response จริง และสังเกต `[AUDIT]` log ใน terminal

### Step 3 — เชื่อม Claude Desktop (10 นาที)

แก้ไฟล์ config ของ Claude Desktop:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "glow-beauty": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/mcp_server_starter/server.mjs"]
    }
  }
}
```

**สำคัญ:** ใช้ path เต็ม แล้ว **restart Claude Desktop**
ทดสอบถาม: "ครีมกันแดดตัวไหนเหมาะกับผิวมัน แล้วมีของไหม" — Claude ควรเรียก tools เองอัตโนมัติ

### Step 4 — Challenge (15 นาที)

เลือกอย่างน้อย 1 ข้อ:

- เพิ่ม tool ใหม่ เช่น `get_bestsellers` (ดูตำแหน่ง comment ใน `server.mjs`)
- เปลี่ยน `products.json` เป็นข้อมูลสินค้า/บริการจริงของธุรกิจท่าน
- (สาย vibe coding) ใช้ Claude Code เปิดโฟลเดอร์นี้แล้วสั่งเพิ่ม tool — แต่ต้องอ่านโค้ดที่ได้ให้เข้าใจทุกบรรทัด

## Lab 2 — Deploy ขึ้น Cloudflare Workers (remote)

> หมายเหตุ: การ deploy remote ต้องแปลง transport จาก stdio เป็น Streamable HTTP —
> ดูตัวอย่างและ template ล่าสุดที่ [developers.cloudflare.com/agents/model-context-protocol](https://developers.cloudflare.com/agents/model-context-protocol/)
> (Cloudflare มี template `npm create cloudflare@latest -- --template=cloudflare/ai/demos/remote-mcp-authless` ที่วิทยากรเตรียม fork ไว้ให้ในวันงาน)

ขั้นตอนหลัก: `npx wrangler login` → ย้าย tools จาก server.mjs เข้า template → `npm run deploy` → ได้ URL สาธารณะ → ใส่ API key ผ่าน `wrangler secret put` → แลก URL กับทีมข้างเคียงแล้วเชื่อมจาก Claude

## Governance ในโค้ดนี้ (เชื่อมกับสไลด์ 13)

- **Audit log** — ฟังก์ชัน `audit()` ถูกเรียกในทุก tool handler
- **Least privilege** — เปิดเฉพาะ 3 tools อ่านอย่างเดียว ไม่มี write
- **Input validation** — schema ด้วย `zod` ทุก tool
- **ตอบตามจริง** — ไม่พบข้อมูล = บอกว่าไม่พบ ไม่คาดเดา

## ข้อกำหนด

Node.js 18+ · Claude Desktop (Lab 1) · บัญชี Cloudflare ฟรี (Lab 2)
SDK: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — ตรวจสอบเวอร์ชันล่าสุดก่อนวันงาน (spec 2026-07-28 เพิ่ง final)
