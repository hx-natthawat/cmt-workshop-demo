#!/usr/bin/env bash
# smoke-test.sh — ตรวจทุก demo ก่อนวันงานในคำสั่งเดียว (งาน D-7 ตาม playbook)
#
# ตรวจ 7 ด่าน:
#   1. line-bot     : GET / + POST /webhook จำลอง (คำนวณ x-line-signature จริงจาก .env)
#   2. MCP local    : initialize + tools/list ผ่าน stdio ต้องเจอครบ 3 tools
#   3. MCP showcase : tools/list ครบ 6 + resource store://policy + prompt after_sales_reply
#   4. MCP security : สแกนเนอร์จับ tool poisoning ได้ + ไม่ false positive
#   5. MCP multi    : analytics server (ตัวที่ 2) ตอบ tools/list ครบ
#   6. storefront   : Agent-Ready 4 ประตู (Schema.org · llms.txt · MCP · Agent Card)
#   7. MCP remote   : key ผิดต้องโดน 401 · key ถูกต้องได้ serverInfo
#
# วิธีรัน:
#   ./smoke-test.sh
#   REMOTE_MCP_URL=https://glow-beauty-mcp.xxx.workers.dev/mcp ./smoke-test.sh
#
# ค่าที่ใช้ (อ่านอัตโนมัติ ถ้าไม่ได้ส่งเป็น env):
#   LINE_CHANNEL_SECRET ← s1-martech/line-bot/.env
#   DEMO_API_KEY        ← s2-mcp/remote/.dev.vars
set -u
cd "$(dirname "$0")"

BOT_URL="${BOT_URL:-http://localhost:3000}"
REMOTE_MCP_URL="${REMOTE_MCP_URL:-}"

PASS=0; FAIL=0; SKIP=0
ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ❌ $1"; [ -n "${2:-}" ] && echo "     → $2"; FAIL=$((FAIL+1)); }
skip() { echo "  ⏭️  $1"; [ -n "${2:-}" ] && echo "     → $2"; SKIP=$((SKIP+1)); }

# อ่านค่าจากไฟล์ env แบบระบุ key (ไม่ source ทั้งไฟล์)
# ตัด whitespace นำ/ตาม + quotes ให้เหมือนที่ dotenv/wrangler โหลด (เช่น "KEY= value" → "value")
read_env() { # $1=file $2=key
  [ -f "$1" ] && grep -E "^$2=" "$1" | head -1 | cut -d= -f2- \
    | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | tr -d '"' || true
}

echo "═══ Smoke Test — CMT Workshop Demos ═══"

# ── 1) LINE bot ──────────────────────────────────────────────
echo ""
echo "▌1. line-bot ($BOT_URL)"
if ! curl -s -o /dev/null --max-time 3 "$BOT_URL/"; then
  bad "server ไม่ตอบ" "รันก่อน: cd s1-martech/line-bot && npm start"
else
  ok "server ขึ้นแล้ว (GET /)"
  SECRET="${LINE_CHANNEL_SECRET:-$(read_env s1-martech/line-bot/.env LINE_CHANNEL_SECRET)}"
  if [ -z "$SECRET" ]; then
    skip "ข้าม webhook จำลอง" "ไม่พบ LINE_CHANNEL_SECRET (ต้องมี s1-martech/line-bot/.env)"
  else
    # webhook จำลอง: destination + event ข้อความ (reply จะ fail เพราะ token ปลอม — ไม่เป็นไร
    # เราตรวจแค่ middleware รับ signature แล้วตอบ 200)
    BODY='{"destination":"smoke","events":[{"type":"message","message":{"type":"text","id":"1","text":"smoke test"},"replyToken":"00000000000000000000000000000000","source":{"type":"user","userId":"U-smoke"},"timestamp":0,"mode":"active"}]}'
    SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)
    CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST "$BOT_URL/webhook" \
      -H 'content-type: application/json' -H "x-line-signature: $SIG" -d "$BODY")
    [ "$CODE" = "200" ] && ok "webhook จำลองตอบ 200" || bad "webhook ตอบ $CODE (คาด 200)" "เช็ค LINE_CHANNEL_SECRET ใน .env ให้ตรง channel"
    # signature ผิดต้องโดนปฏิเสธ (ตรวจว่า middleware ทำงานจริง)
    CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST "$BOT_URL/webhook" \
      -H 'content-type: application/json' -H "x-line-signature: wrong" -d "$BODY")
    [ "$CODE" != "200" ] && ok "signature ผิดถูกปฏิเสธ ($CODE)" || bad "signature ผิดแต่ได้ 200" "middleware ไม่ได้ตรวจ signature?"
  fi
fi

# ── 2) MCP local (stdio) ─────────────────────────────────────
echo ""
echo "▌2. MCP local (s2-mcp/local · stdio)"
if [ ! -d s2-mcp/local/node_modules ]; then
  bad "ยังไม่ได้ npm install" "รันก่อน: cd s2-mcp/local && npm install"
else
  OUT=$( (printf '%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}' \
    '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'; sleep 2) \
    | (cd s2-mcp/local && node server.mjs 2>/dev/null) )
  MISSING=""
  for t in search_products check_stock get_promotions; do
    echo "$OUT" | grep -q "\"$t\"" || MISSING="$MISSING $t"
  done
  if [ -z "$MISSING" ]; then
    ok "tools/list ครบ 3 tools"
  else
    bad "tools/list ขาด:$MISSING" "เช็ค server.mjs ว่า register ครบ"
  fi
fi

# ── 3) MCP showcase (stdio · tools + resource + prompt) ──────
echo ""
echo "▌3. MCP showcase (s2-mcp/showcase · stdio)"
if [ ! -d s2-mcp/showcase/node_modules ]; then
  bad "ยังไม่ได้ npm install" "รันก่อน: cd s2-mcp/showcase && npm install"
else
  OUT=$( (printf '%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}' \
    '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
    '{"jsonrpc":"2.0","id":3,"method":"resources/list"}' \
    '{"jsonrpc":"2.0","id":4,"method":"prompts/list"}'; sleep 2) \
    | (cd s2-mcp/showcase && node server.mjs 2>/dev/null) )
  MISSING=""
  for t in recommend_for_skin track_order create_draft_order get_bestsellers get_promotions confirm_order; do
    echo "$OUT" | grep -q "\"$t\"" || MISSING="$MISSING $t"
  done
  [ -z "$MISSING" ] && ok "tools/list ครบ 6 tools" || bad "tools/list ขาด:$MISSING" "เช็ค showcase/server.mjs"
  echo "$OUT" | grep -q 'store://policy' && ok "resource store://policy พร้อม" || bad "ไม่พบ resource store://policy"
  echo "$OUT" | grep -q 'after_sales_reply' && ok "prompt after_sales_reply พร้อม" || bad "ไม่พบ prompt after_sales_reply"
fi

# ── 4) MCP security (สแกน tool description) ──────────────────
echo ""
echo "▌4. MCP security (s2-mcp/security · tool poisoning scanner)"
if [ ! -d s2-mcp/security/node_modules ]; then
  skip "ยังไม่ได้ npm install" "รันก่อน: cd s2-mcp/security && npm install"
else
  # สแกนเนอร์ต้องจับ poisoned ได้ (exit 1) และไม่ false positive กับ showcase (exit 0)
  (cd s2-mcp/security && node scan-tools.mjs ./poisoned-server.mjs >/dev/null 2>&1)
  [ $? -eq 1 ] && ok "สแกนเนอร์จับ poisoned-server ได้ (exit 1)" || bad "สแกนเนอร์ไม่จับ poisoned-server" "เช็คกฎใน scan-tools.mjs"
  (cd s2-mcp/security && node scan-tools.mjs ../showcase/server.mjs >/dev/null 2>&1)
  [ $? -eq 0 ] && ok "showcase ผ่านการสแกน (ไม่ false positive)" || bad "showcase ไม่ผ่านการสแกน" "ตรวจคำอธิบาย tool ใน showcase/server.mjs"
fi

# ── 5) MCP multi (analytics server ตัวที่ 2) ─────────────────
echo ""
echo "▌5. MCP multi (s2-mcp/multi · analytics server)"
if [ ! -d s2-mcp/multi/node_modules ]; then
  skip "ยังไม่ได้ npm install" "รันก่อน: cd s2-mcp/multi && npm install"
else
  OUT=$( (printf '%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}' \
    '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'; sleep 2) \
    | (cd s2-mcp/multi && node analytics-server.mjs 2>/dev/null) )
  MISSING=""
  for t in sales_by_channel sales_by_category find_at_risk_channel; do
    echo "$OUT" | grep -q "\"$t\"" || MISSING="$MISSING $t"
  done
  [ -z "$MISSING" ] && ok "analytics tools/list ครบ 3 tools" || bad "analytics ขาด:$MISSING" "เช็ค multi/analytics-server.mjs"
fi

# ── 6) Agent-Ready storefront (4 ประตู) ──────────────────────
echo ""
echo "▌6. Agent-Ready storefront (s3-economy/storefront)"
SCORE=$(cd s3-economy/storefront && node audit-gates.mjs 2>/dev/null | grep -oE 'คะแนนรวม: [0-9]+' | grep -oE '[0-9]+')
if [ -z "$SCORE" ]; then
  bad "รัน audit-gates.mjs ไม่ได้" "เช็ค s3-economy/storefront/audit-gates.mjs"
elif [ "$SCORE" -ge 15 ]; then
  ok "storefront ผ่าน 4 ประตู ($SCORE/20)"
else
  bad "storefront คะแนนต่ำ ($SCORE/20)" "ตรวจ index.html · llms.txt · agent-card.json"
fi

# ── 7) MCP remote (Cloudflare Workers) ───────────────────────
echo ""
echo "▌7. MCP remote"
KEY="${DEMO_API_KEY:-$(read_env s2-mcp/remote/.dev.vars DEMO_API_KEY)}"
if [ -z "$REMOTE_MCP_URL" ]; then
  skip "ข้าม — ยังไม่ได้ตั้ง REMOTE_MCP_URL" "หลัง deploy: REMOTE_MCP_URL=https://.../mcp ./smoke-test.sh"
else
  INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}'
  # key ผิดต้องโดน 401
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST "$REMOTE_MCP_URL" \
    -H 'authorization: Bearer wrong-key-for-smoke-test' \
    -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d "$INIT")
  [ "$CODE" = "401" ] && ok "key ผิดโดนปฏิเสธ (401)" || bad "key ผิดได้ $CODE (คาด 401)" "เช็คว่า deploy เวอร์ชันที่มีการตรวจ key แล้ว"
  # key ถูกต้องได้ serverInfo
  if [ -z "$KEY" ]; then
    skip "ข้ามทดสอบ key ถูก" "ส่ง DEMO_API_KEY=... หรือสร้าง s2-mcp/remote/.dev.vars"
  else
    RES=$(curl -s --max-time 10 -X POST "$REMOTE_MCP_URL" \
      -H "authorization: Bearer $KEY" \
      -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d "$INIT")
    echo "$RES" | grep -q 'glow-beauty-products' \
      && ok "key ถูก → ได้ serverInfo glow-beauty-products" \
      || bad "key ถูกแต่ไม่ได้ serverInfo" "ตรวจ secret บน Cloudflare: npx wrangler secret put DEMO_API_KEY"
  fi
fi

# ── สรุป ─────────────────────────────────────────────────────
echo ""
echo "═══ สรุป: ✅ $PASS ผ่าน · ❌ $FAIL พัง · ⏭️ $SKIP ข้าม ═══"
[ $FAIL -eq 0 ] || exit 1
