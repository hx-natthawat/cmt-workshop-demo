/**
 * Remote MCP Server — Advanced MCP Workshop (HarmonyX)
 * D2.2: port 3 tools จาก s2-mcp/local ขึ้น Cloudflare Workers (transport: Streamable HTTP)
 *
 * รันทดสอบ:  npm install && npm start   (wrangler dev ที่ http://localhost:8787/mcp)
 * deploy:    npm run deploy             (ดูขั้นตอนตั้ง DEMO_API_KEY ใน README.md)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import products from "./products.json";

// DEMO_API_KEY เป็น secret — ตั้งผ่าน `wrangler secret put` หรือ .dev.vars (ห้าม hardcode)
declare global {
	interface Env {
		DEMO_API_KEY?: string;
	}
}

// ── Governance ในโค้ด: audit log ทุก tool call (พฤติกรรมเดียวกับ local, ดูผ่าน wrangler tail) ──
function audit(tool: string, args: unknown) {
	console.error(`[AUDIT] ${new Date().toISOString()} tool=${tool} args=${JSON.stringify(args)}`);
}

export class GlowBeautyMCP extends McpAgent {
	server = new McpServer({ name: "glow-beauty-products", version: "1.0.0" });

	async init() {
		// Tool 1 — ค้นหาสินค้า
		this.server.registerTool(
			"search_products",
			{
				description:
					"ค้นหาสินค้าของร้าน Glow Beauty จากคำค้น (ชื่อ, ประเภทผิว, จุดเด่น) " +
					'ใช้เมื่อลูกค้าหรือทีมงานถามหาสินค้า เช่น "ครีมกันแดดสำหรับผิวมัน"',
				inputSchema: { query: z.string().describe("คำค้นภาษาไทยหรืออังกฤษ") },
			},
			async ({ query }) => {
				audit("search_products", { query });
				const q = query.toLowerCase();
				const hits = products.products.filter((p) =>
					[p.name, p.suitable_for, p.highlight].join(" ").toLowerCase().includes(q),
				);
				return {
					content: [
						{
							type: "text",
							text: hits.length
								? hits
										.map((p) => `${p.sku} · ${p.name} · ${p.price_thb} บาท · เหมาะกับ: ${p.suitable_for}`)
										.join("\n")
								: "ไม่พบสินค้าที่ตรงกับคำค้นนี้",
						},
					],
				};
			},
		);

		// Tool 2 — ตรวจสอบสต็อก
		this.server.registerTool(
			"check_stock",
			{
				description:
					"ตรวจสอบจำนวนสต็อกคงเหลือของสินค้าจากรหัส SKU (เช่น GB-001) " +
					"ใช้เมื่อต้องการทราบว่าสินค้ามีของหรือไม่ เหลือกี่ชิ้น",
				inputSchema: { sku: z.string().describe("รหัสสินค้า เช่น GB-001") },
			},
			async ({ sku }) => {
				audit("check_stock", { sku });
				const p = products.products.find((x) => x.sku === sku.toUpperCase());
				return {
					content: [
						{
							type: "text",
							text: p
								? `${p.name}: คงเหลือ ${p.stock} ชิ้น${p.stock === 0 ? " (สินค้าหมด)" : ""}`
								: `ไม่พบสินค้า SKU ${sku}`,
						},
					],
				};
			},
		);

		// Tool 3 — โปรโมชันปัจจุบัน
		this.server.registerTool(
			"get_promotions",
			{
				description: "ดูรายการโปรโมชันที่ใช้ได้ในขณะนี้ พร้อมเงื่อนไข ใช้เมื่อถูกถามเรื่องส่วนลดหรือข้อเสนอ",
				inputSchema: {},
			},
			async () => {
				audit("get_promotions", {});
				return {
					content: [
						{
							type: "text",
							text:
								products.promotions.map((p) => `${p.name}: ${p.detail}`).join("\n") +
								`\nการจัดส่ง: ${products.shipping}`,
						},
					],
				};
			},
		);
	}
}

// ── ตรวจ API key ก่อนเข้าถึง /mcp: รับได้ทั้ง Authorization: Bearer <key> และ X-API-Key ──
function isAuthorized(request: Request, env: Env): boolean {
	if (!env.DEMO_API_KEY) return false; // ยังไม่ได้ตั้ง secret → ปฏิเสธทุกคำขอ
	const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
	const headerKey = request.headers.get("x-api-key");
	return bearer === env.DEMO_API_KEY || headerKey === env.DEMO_API_KEY;
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/mcp") {
			if (!isAuthorized(request, env)) {
				audit("auth_rejected", { path: url.pathname });
				return new Response(
					JSON.stringify({ error: "unauthorized", message: "API key ไม่ถูกต้องหรือยังไม่ได้ส่งมา (ใช้ Authorization: Bearer <key>)" }),
					{ status: 401, headers: { "content-type": "application/json" } },
				);
			}
			return GlowBeautyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
