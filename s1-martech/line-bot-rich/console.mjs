/**
 * console.mjs — Marketing Console (Enterprise SaaS-grade) สำหรับทีมการตลาด
 * รวมทุกงาน operator ไว้ที่เดียว: Overview · Broadcast · Segments · Restock · Analytics
 *
 * รัน:  node console.mjs   แล้วเปิด http://localhost:3100
 * ⚠️ bind 127.0.0.1 เท่านั้น (ไม่เปิดผ่าน tunnel) · action ส่งจริงมีประตูยืนยัน
 */
import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs';
import { messagingApi } from '@line/bot-sdk';
import * as data from './console-data.mjs';

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) { console.error('❌ ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env'); process.exit(1); }
const api = new messagingApi.MessagingApiClient({ channelAccessToken: token });
const HTML = fs.readFileSync(new URL('./console.html', import.meta.url), 'utf-8');

async function quota() {
  try { const q = await api.getMessageQuota(); const c = await api.getMessageQuotaConsumption();
    return { used: c.totalUsage, limit: q.value || null }; } catch { return { used: null, limit: null }; }
}
const json = (res, obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const readBody = async (req) => { let b = ''; for await (const c of req) b += c; try { return JSON.parse(b); } catch { return {}; } };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  try {
    if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(HTML); }

    // ── GET APIs ──
    if (p === '/api/overview') {
      const voc = data.vocSummary(); const segs = data.segments(); const rs = data.restock();
      return json(res, { conversations: voc.total, users: voc.users, convRate: voc.convRate,
        byChannel: voc.byChannel, topTools: voc.topTools.slice(0, 6), funnel: voc.funnel,
        quota: await quota(), segmentCount: segs.list.length, customerCount: segs.total,
        restockPending: rs.reduce((s, x) => s + x.interested, 0) });
    }
    if (p === '/api/voc') return json(res, data.vocSummary());
    if (p === '/api/segments') return json(res, data.segments());
    if (p === '/api/restock') return json(res, { items: data.restock() });
    if (p === '/api/promotions') return json(res, { ...data.promotions(), quota: await quota() });

    // ── POST actions (guarded) ──
    if (p === '/api/broadcast' && req.method === 'POST') {
      const { confirm } = await readBody(req);
      if (confirm !== 'SEND') return json(res, { ok: false, error: 'ต้องยืนยันด้วย confirm=SEND' });
      const promo = data.promotions();
      await api.broadcast({ messages: [{ type: 'text', text: promo.intro },
        { type: 'flex', altText: 'โปรโมชัน', contents: { type: 'carousel', contents: promo.promos.map((pr) => ({
          type: 'bubble', size: 'kilo',
          header: { type: 'box', layout: 'vertical', backgroundColor: '#345589', paddingAll: '12px',
            contents: [{ type: 'text', text: '🎁 ' + pr.name, color: '#fff', weight: 'bold', wrap: true }] },
          body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: pr.detail, size: 'sm', wrap: true }] } })) } }] });
      return json(res, { ok: true, message: 'ส่ง broadcast ถึงผู้ติดตามทุกคนแล้ว' });
    }
    if (p === '/api/restock-notify' && req.method === 'POST') {
      const { sku, confirm } = await readBody(req);
      if (confirm !== 'SEND') return json(res, { ok: false, error: 'ต้องยืนยันด้วย confirm=SEND' });
      const item = data.restock().find((x) => x.sku === sku);
      if (!item) return json(res, { ok: false, error: 'ไม่พบสินค้า' });
      if (item.stock === 0) return json(res, { ok: false, error: 'สินค้ายังหมด (stock 0) — ยังไม่ควรแจ้งว่าเข้าแล้ว' });
      const users = data.store.readRestock()[sku] || [];
      if (!users.length) return json(res, { ok: false, error: 'ยังไม่มีลูกค้าที่สนใจ' });
      await api.multicast({ to: users, messages: [{ type: 'text',
        text: `🎉 ข่าวดีค่ะ! "${item.name}" กลับมาแล้ว (${item.price} บาท) — พิมพ์ "ขอสั่ง ${sku}" ได้เลยค่ะ` }] });
      return json(res, { ok: true, message: `แจ้งเตือน ${users.length} คนแล้ว` });
    }
    res.writeHead(404); res.end('Not found');
  } catch (e) { json(res, { ok: false, error: e.message }, 500); }
});

// PORT ปรับได้เพื่อให้เทสต์รันโดยไม่ชนกับ console ที่เปิดอยู่ (ค่าปกติ 3100)
const PORT = Number(process.env.PORT) || 3100;
server.listen(PORT, '127.0.0.1', () => console.log(`🏢 Marketing Console: http://localhost:${PORT} (localhost เท่านั้น)`));
