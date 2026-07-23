# s2-mcp/remote — ยังไม่ได้สร้าง (งาน D-10)

สร้างด้วย Claude Code ตาม playbook หัวข้อ D2.2:

```bash
npm create cloudflare@latest s2-mcp-remote -- --template=cloudflare/ai/demos/remote-mcp-authless
```

แล้วสั่ง Claude Code:

> "port ทั้ง 3 tools กับ products.json จาก s2-mcp/local มาให้ครบ พฤติกรรมเหมือนเดิมทุก tool รวม audit log จากนั้นเพิ่มการตรวจ API key จาก env DEMO_API_KEY แล้วบอกขั้นตอน deploy"
