#!/usr/bin/env bash
# switch-bot.sh — สลับ LINE bot 3 ระดับบนพอร์ตเดียว (สำหรับโชว์ progression หน้าเวที)
#
# ทำไมต้องมี: ถ้าเปิดทีละตัวคนละพอร์ต ต้องเปลี่ยน webhook URL ใน LINE Console ทุกครั้ง
# — ช้าและเสี่ยงพลาดกลางเวที · ตัวนี้ให้ทุกระดับใช้ "พอร์ตเดียว tunnel เดียว webhook เดียว"
# สลับระดับ = พิมพ์คำสั่งเดียว ผู้ชมเห็นความต่างทันทีในแชทเดิม
#
# ใช้:
#   ./switch-bot.sh 1        # line-bot        — context ใน prompt (ไม่มี tool)
#   ./switch-bot.sh 2        # line-bot-mcp   — เรียก MCP tools จริง
#   ./switch-bot.sh 3        # line-bot-rich  — Flex + Quick Reply + ปุ่มยืนยัน
#   ./switch-bot.sh status   # ดูว่าตอนนี้ระดับไหนรันอยู่
#   ./switch-bot.sh stop     # ปิดทั้งหมด
#
# ตั้ง PORT ได้ (ค่าปกติ 3000 — ให้ tunnel ชี้ที่พอร์ตนี้ตัวเดียวตลอดงาน)
set -u
cd "$(dirname "$0")"
PORT="${PORT:-3000}"
LOG="/tmp/line-bot-level.log"

level_dir() { case "$1" in 1) echo line-bot ;; 2) echo line-bot-mcp ;; 3) echo line-bot-rich ;; *) echo "" ;; esac; }
level_name() {
  case "$1" in
    1) echo "ระดับ 1 · line-bot — context ใน prompt (ไม่เรียก tool)" ;;
    2) echo "ระดับ 2 · line-bot-mcp — เรียก MCP tools จริง" ;;
    3) echo "ระดับ 3 · line-bot-rich — Flex + Quick Reply + ปุ่มยืนยัน" ;;
  esac
}

stop_all() {
  # ปิดเฉพาะ bot ที่ฟังพอร์ตนี้ ไม่ไปยุ่ง process อื่นของผู้ใช้
  local pids
  pids=$(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  [ -n "$pids" ] && kill $pids 2>/dev/null && sleep 1
  return 0
}

case "${1:-}" in
  stop)
    stop_all; echo "⏹  ปิด bot บนพอร์ต $PORT แล้ว"; exit 0 ;;
  status)
    pid=$(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1)
    if [ -z "$pid" ]; then echo "⚪️ ไม่มี bot รันบนพอร์ต $PORT"; else
      echo "🟢 กำลังรัน (pid $pid) บนพอร์ต $PORT"
      echo "   $(curl -s --max-time 3 "http://localhost:$PORT/" || echo '(ไม่ตอบ)')"
    fi
    exit 0 ;;
  1|2|3) ;;
  *)
    echo "ใช้: ./switch-bot.sh [1|2|3|status|stop]"
    echo "  1 = $(level_name 1)"
    echo "  2 = $(level_name 2)"
    echo "  3 = $(level_name 3)"
    exit 2 ;;
esac

DIR=$(level_dir "$1")
[ -d "$DIR/node_modules" ] || { echo "❌ ยังไม่ได้ npm install ใน $DIR"; exit 1; }

stop_all
# ตัดขาดจาก terminal ให้หมด (stdin/stdout/stderr) — ไม่งั้น process ลูกค้างคา shell
( cd "$DIR" && PORT="$PORT" nohup node app.js > "$LOG" 2>&1 < /dev/null & ) >/dev/null 2>&1
disown -a 2>/dev/null || true

# รอให้ขึ้นจริงก่อนบอกว่าพร้อม — กันสลับกลางเวทีแล้วทักทันทีตอนยังไม่ขึ้น
for _ in $(seq 1 40); do
  curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/" && break
  sleep 0.5
done

if curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/"; then
  echo "✅ $(level_name "$1")"
  echo "   พอร์ต $PORT · webhook เดิมใช้ได้เลย ไม่ต้องแก้ใน LINE Console"
  echo "   log: tail -f $LOG"
else
  echo "❌ ไม่ขึ้นภายในเวลาที่กำหนด — ดู log: cat $LOG"
  tail -5 "$LOG"
  exit 1
fi
