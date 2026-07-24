# s2-mcp/showcase — MCP in the Real World

Showcase server ต่อยอดจาก Lab MCP-1 (`s2-mcp/local`) — โชว์ MCP แบบใช้จริงในธุรกิจ e-commerce
ใช้ context Glow Beauty เดิม แต่**ครบทั้ง 3 primitives ของ MCP** (tools / resources / prompts)

## รัน / ทดสอบ

```bash
cd s2-mcp/showcase
npm install
npm start           # stdio server
npm run inspect     # เปิด MCP Inspector — เห็นครบ tools/resources/prompts
```

## สิ่งที่โชว์

### 4 Tools — pattern ที่เจอจริงใน production

| Tool | Pattern โลกจริง | หน้าที่ |
|---|---|---|
| `recommend_for_skin` | **Personalization** | แนะนำสินค้าตามสภาพผิว (recommendation engine) |
| `track_order` | **System integration** | เช็คสถานะ+เลขพัสดุจากระบบหลังบ้าน (`orders.json` แทน DB/API จริง) |
| `create_draft_order` | **Governed action** | สร้าง "ร่างออเดอร์" คืนสถานะ **รออนุมัติ** ไม่ตัดสต็อก/ไม่เก็บเงินเอง (human-in-the-loop) |
| `get_bestsellers` | **Analytics** | สินค้ามาแรง/ใกล้หมด 3 อันดับ (สต็อกน้อยสุด) |

> ทุก tool มี: คำอธิบายภาษาไทยที่ AI เดาการใช้ได้ · zod validation · เรียก `audit()` (ตามกติกา repo)

### 1 Resource — `store://policy`
เอกสารนโยบายร้าน (จัดส่ง/คืนสินค้า/รับประกัน) ที่ AI **ดึงอ่านเอง**เมื่อต้องอ้างอิงเงื่อนไข — ต่างจาก tool ตรงที่เป็น "ข้อมูลให้อ่าน" ไม่ใช่ "ฟังก์ชันให้เรียก"

### 1 Prompt — `after_sales_reply`
เทมเพลตร่างข้อความตอบหลังการขาย (รับ `order_id` + `issue`) — ให้ทั้งทีมตอบมาตรฐานเดียว และสั่งให้ AI เช็ค `track_order` ก่อนตอบ

## จุดสอนสำคัญ (governance)

`create_draft_order` คือหัวใจ — **action tool ต้องไม่ execute ตรง** แต่คืนสถานะ "รออนุมัติ" ให้มนุษย์ยืนยันก่อน (ตรงกับสไลด์ Governance: "tools ฝั่ง action คืนสถานะรออนุมัติ ไม่ execute ตรง") · ตัดสต็อก/ตัดเงินจริงเป็นขั้นตอนที่ต้องมี human-in-the-loop

## เชื่อมกับ demo อื่น

- ใช้ **products.json ชุดเดียว**กับ line-bot และ Lab MCP-1/2 → เปลี่ยนข้อมูลที่เดียว กระทบทุก demo
- ต่อ server นี้เข้า Claude Desktop / Claude Code แล้วลองสั่ง เช่น "ผิวมันใช้ตัวไหนดี แล้วเช็คว่าออเดอร์ ORD-1001 ถึงไหนแล้ว"

> Lab ประกอบดูใน [../EXTENDED-LAB.md](../EXTENDED-LAB.md)
