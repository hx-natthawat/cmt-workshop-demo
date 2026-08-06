#!/usr/bin/env bash
# dev-all.sh — สตาร์ตบริการที่ฟังพอร์ตทั้งหมดพร้อมกันสำหรับพัฒนา/ซ้อม
#
#   :8080  s1-martech/vibe          เครื่องมือ Mini-Lab (static)
#   :8090  s3-economy/storefront    Agent-Ready storefront
#   :3000  LINE bot                 เลือกระดับด้วย BOT=1|2|3 (ค่าปกติ 3 = line-bot-rich)
#   :8787  s2-mcp/remote            MCP remote ผ่าน wrangler dev
#
# MCP server แบบ stdio (local · showcase · security · multi) ไม่ได้ฟังพอร์ต
# จึงไม่อยู่ในนี้ — รันด้วย npm start --prefix <dir> หรือ npm run inspect
#
# ใช้:   ./dev-all.sh              # bot ระดับ 3
#        BOT=1 ./dev-all.sh        # bot ระดับ 1
#        SKIP_REMOTE=1 ./dev-all.sh   # ข้าม wrangler (เร็วขึ้นมากถ้าไม่ต้องใช้)
# หยุด:  Ctrl-C (ปิดให้ทุกตัว)
set -u
cd "$(dirname "$0")"
ROOT="$(pwd)"
BOT="${BOT:-3}"
PIDS=()
PORTS=(8080 8090 3000 8787)

cleanup() {
  echo ""
  echo "▌ กำลังปิด..."
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null; done
  for p in "${PORTS[@]}"; do lsof -ti:"$p" 2>/dev/null | xargs kill 2>/dev/null; done
  echo "▌ ปิดครบแล้ว"
  exit 0
}
trap cleanup INT TERM

bot_dir() { case "$1" in 1) echo line-bot ;; 2) echo line-bot-mcp ;; *) echo line-bot-rich ;; esac; }
DIR="$(bot_dir "$BOT")"

echo "═══ เริ่มบริการที่ฟังพอร์ต ═══"

# ── :8080 vibe (static) ──
python3 -m http.server 8080 --directory "$ROOT/s1-martech/vibe" >/dev/null 2>&1 &
PIDS+=($!)
echo "  ✅ :8080  vibe tools"

# ── :8090 storefront ──
( cd s3-economy/storefront && node serve.mjs >/dev/null 2>&1 ) &
PIDS+=($!)
echo "  ✅ :8090  storefront"

# ── :3000 LINE bot ──
if [ ! -d "s1-martech/$DIR/node_modules" ]; then
  echo "  ⏭️  :3000  ข้าม $DIR — ยังไม่ได้ npm install"
elif [ -f "s1-martech/$DIR/.env" ]; then
  ( cd "s1-martech/$DIR" && npm start >/dev/null 2>&1 ) &
  PIDS+=($!)
  echo "  ✅ :3000  $DIR"
else
  echo "  ⏭️  :3000  ข้าม $DIR — ยังไม่มี .env (คัดลอกจาก .env.example)"
fi

# ── :8787 remote MCP ──
# หมายเหตุความปลอดภัย: ไม่พิมพ์ค่า key ออกจอ — ถ้าอยากทดสอบให้อ่านจาก .dev.vars เอง
if [ -n "${SKIP_REMOTE:-}" ]; then
  echo "  ⏭️  :8787  ข้ามตามที่สั่ง (SKIP_REMOTE)"
elif [ ! -d s2-mcp/remote/node_modules ]; then
  echo "  ⏭️  :8787  ข้าม remote — ยังไม่ได้ npm install"
else
  if [ -f s2-mcp/remote/.dev.vars ]; then
    KEY_SRC=".dev.vars"
    KEY="$(grep -E '^DEMO_API_KEY=' s2-mcp/remote/.dev.vars | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | tr -d '"')"
  else
    KEY_SRC="ค่า dev ชั่วคราวที่สุ่มให้ (ดูวิธีอ่านด้านล่าง)"
    KEY="dev-$(head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    printf '%s' "$KEY" > "$ROOT/.dev-remote-key"
    chmod 600 "$ROOT/.dev-remote-key"
  fi
  ( cd s2-mcp/remote && ./node_modules/.bin/wrangler dev --port 8787 --var DEMO_API_KEY:"$KEY" >/dev/null 2>&1 ) &
  PIDS+=($!)
  echo "  ✅ :8787  remote MCP  (DEMO_API_KEY จาก $KEY_SRC)"
fi

echo ""
echo "═══ เปิดที่ ═══"
echo "  vibe        http://localhost:8080/utm_builder.html · roi_calculator.html · mini_dashboard.html"
echo "  storefront  http://localhost:8090"
echo "  LINE bot    http://localhost:3000   (tunnel: cloudflared tunnel --url http://localhost:3000)"
echo "  remote MCP  http://localhost:8787/mcp"
[ -f "$ROOT/.dev-remote-key" ] && echo "              key อยู่ที่ .dev-remote-key — ใช้: DEMO_API_KEY=\$(cat .dev-remote-key)"
echo ""
echo "  ตรวจทั้งหมด: ./smoke-test.sh"
echo "  กด Ctrl-C เพื่อปิดทุกตัว"
wait
