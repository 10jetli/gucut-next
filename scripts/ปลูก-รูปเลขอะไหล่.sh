#!/bin/bash
# ยืนยันแล้ว: ต้องคืนไฟล์ทุกกรณีแม้เทสแดงตามแผน จึงคืนด้วย trap EXIT ไม่ผูกกับรหัสจบของไปป์
set -u
cd /home/jetli/gucut-next || exit 9
T=scripts/tests/parts-models-ถามหน้าร้าน.test.mjs
cp lib/parts-models.ts "$CLAUDE_JOB_DIR/tmp/pm7.bak"
restore() { cp "$CLAUDE_JOB_DIR/tmp/pm7.bak" lib/parts-models.ts; return 0; }
trap restore EXIT
try1() {
  out="$(node --experimental-test-module-mocks --test "$T" 2>&1)"; rc=$?
  printf '%s ⇒ rc=%s ตก=%s\n' "$1" "$rc" "$(printf '%s\n' "$out" | grep -c '❌')"
  printf '%s\n' "$out" | grep '🔴 ตกที่' | sed 's/^#*  */     /'
}
try1 "⓪ ก่อนปลูก (ต้องเขียว)"
sed -i 's@|\\d{3} \\d{2} \\d{2}-\\d{2}@@' lib/parts-models.ts
try1 "① ถอดรูป Husqvarna ออก (ต้องแดง)"
restore
sed -i 's@\\d{4} \\d{3} \\d{4}|@@' lib/parts-models.ts
try1 "② ถอดรูป STIHL ออก (ต้องแดง — ตัวควบคุมลบ)"
restore
try1 "③ คืนสภาพแล้ว (ต้องเขียว)"
