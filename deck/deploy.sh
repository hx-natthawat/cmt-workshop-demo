#!/usr/bin/env bash
# deploy.sh — deploy สไลด์เด็ค (index.html) ขึ้น Cloudflare Pages ในคำสั่งเดียว
#
# ปลายทาง:
#   - Pages project : cmt2026  (บัญชี Harmonyx)
#   - โดเมนจริง      : https://cmt2026.harmonyx.co
#   - alias          : https://cmt2026.pages.dev
#
# วิธีรัน:
#   ./deploy.sh                 # deploy ไฟล์ deck/index.html ปัจจุบัน
#   ./deploy.sh path/to/new.html  # อัปเดต index.html จากไฟล์ใหม่ก่อน แล้วค่อย deploy
#
# ต้องมี wrangler ที่ login แล้ว (wrangler login) — account ID ด้านล่างไม่ใช่ความลับ
set -euo pipefail

# ── ค่าคงที่ของการ deploy ────────────────────────────────────────────────
ACCOUNT_ID="60b088834829272a6ee94498be2ea356"   # บัญชี Harmonyx (ไม่ใช่ secret)
PROJECT="cmt2026"
DOMAIN="cmt2026.harmonyx.co"
DECK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # โฟลเดอร์ที่สคริปต์นี้อยู่
SRC_HTML="$DECK_DIR/index.html"

export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"

# ── ถ้าส่ง path ไฟล์ใหม่มาเป็น argument → ก็อปทับ index.html (source of truth) ──
if [[ $# -ge 1 ]]; then
  NEW="$1"
  if [[ ! -f "$NEW" ]]; then
    echo "❌ ไม่พบไฟล์: $NEW" >&2
    exit 1
  fi
  cp "$NEW" "$SRC_HTML"
  echo "📝 อัปเดต index.html จาก: $NEW ($(wc -c < "$SRC_HTML") bytes)"
fi

if [[ ! -f "$SRC_HTML" ]]; then
  echo "❌ ไม่พบ $SRC_HTML — วางเด็คไว้ที่ deck/index.html ก่อน" >&2
  exit 1
fi

# ── stage: deploy เฉพาะ index.html (ไม่เอา deploy.sh / README.md ไปเสิร์ฟด้วย) ──
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT
cp "$SRC_HTML" "$BUILD_DIR/index.html"

echo "🚀 กำลัง deploy $(wc -c < "$SRC_HTML") bytes → Pages project '$PROJECT' ..."
wrangler pages deploy "$BUILD_DIR" \
  --project-name "$PROJECT" \
  --branch main \
  --commit-dirty=true

cat <<EOF

✅ เสร็จแล้ว — เด็คขึ้น production
   • โดเมนจริง : https://$DOMAIN
   • alias     : https://$PROJECT.pages.dev

ℹ️  ถ้าโดเมนจริงยังเห็นเวอร์ชันเก่า = edge cache ค้าง
   หมดอายุเองในไม่กี่นาที หรือกด hard refresh (Cmd+Shift+R)
   จะล้างทันทีให้ purge cache ที่ dashboard: harmonyx.co → Caching → Configuration → Purge Everything
EOF
