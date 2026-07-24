#!/usr/bin/env bash
# dev-all.sh — สตาร์ตทุก demo แยกพอร์ตพร้อมกันสำหรับซ้อม
#
#   :8080  s1-martech/vibe        (เครื่องมือ Mini-Lab: utm/roi/dashboard — static)
#   :3000  s1-martech/line-bot    (Express webhook — ต้องมี .env จริงถึงตอบ Claude ได้)
#   :8787  s2-mcp/remote          (wrangler dev — remote MCP ที่ /mcp)
#          s2-mcp/local           (stdio — ไม่ใช่พอร์ต; ทดสอบด้วย: cd s2-mcp/local && npm run inspect)
#
# วิธีใช้:   ./dev-all.sh
# หยุด:      Ctrl-C (ปิดทุกตัวให้เอง)
#
# ตั้ง DEMO_API_KEY ของ remote: อ่านจาก s2-mcp/remote/.dev.vars ถ้ามี ไม่งั้นใช้ค่า dev ชั่วคราว
set -u
cd "$(dirname "$0")"
ROOT="$(pwd)"
PIDS=()

cleanup() {
  echo ""
  echo "▌ กำลังปิดทุก demo..."
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null; done
  # เก็บกวาดพอร์ตที่อาจค้าง
  for p in 8080 3000 8787; do lsof -ti:$p 2>/dev/null | xargs kill 2>/dev/null; done
  echo "▌ ปิดครบแล้ว"
  exit 0
}
trap cleanup INT TERM

read_env() { [ -f "$1" ] && grep -E "^$2=" "$1" | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | tr -d '"' || true; }

echo "═══ เริ่มทุก demo แยกพอร์ต ═══"

# ── :8080 vibe (static) ──
python3 -m http.server 8080 --directory "$ROOT/s1-martech/vibe" >/dev/null 2>&1 &
PIDS+=($!)
echo "  ✅ :8080  vibe tools"

# ── :3000 line-bot ──
if [ -f s1-martech/line-bot/.env ]; then
  ( cd s1-martech/line-bot && npm start >/dev/null 2>&1 ) &
  PIDS+=($!)
  echo "  ✅ :3000  line-bot (ใช้ .env จริง)"
else
  # ไม่มี .env → บูตด้วย placeholder เพื่อซ้อมโครง webhook (จะยังตอบ Claude ไม่ได้จนกว่าจะใส่ key จริง)
  ( cd s1-martech/line-bot && LINE_CHANNEL_ACCESS_TOKEN=placeholder LINE_CHANNEL_SECRET=placeholder-secret ANTHROPIC_API_KEY=placeholder node app.js >/dev/null 2>&1 ) &
  PIDS+=($!)
  echo "  ⚠️  :3000  line-bot (placeholder env — ต้องใส่ .env จริงถึงจะตอบ Claude ได้)"
fi

# ── :8787 remote MCP ──
KEY="$(read_env s2-mcp/remote/.dev.vars DEMO_API_KEY)"
[ -z "$KEY" ] && KEY="dev-demo-key"
( cd s2-mcp/remote && ./node_modules/.bin/wrangler dev --port 8787 --var DEMO_API_KEY:"$KEY" >/dev/null 2>&1 ) &
PIDS+=($!)
echo "  ✅ :8787  remote MCP  (DEMO_API_KEY=$KEY)"

echo ""
echo "═══ URL สำหรับซ้อม ═══"
echo "  vibe UTM       → http://localhost:8080/utm_builder.html"
echo "  vibe ROI       → http://localhost:8080/roi_calculator.html"
echo "  vibe Dashboard → http://localhost:8080/mini_dashboard.html"
echo "  line-bot       → http://localhost:3000/  (+ tunnel: npx cloudflared tunnel --url http://localhost:3000)"
echo "  remote MCP     → http://localhost:8787/mcp  (Authorization: Bearer $KEY)"
echo "  MCP local      → cd s2-mcp/local && npm run inspect"
echo ""
echo "กด Ctrl-C เพื่อปิดทุกตัว"
wait
