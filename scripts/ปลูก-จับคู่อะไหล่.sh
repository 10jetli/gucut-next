#!/bin/bash
# ยืนยันแล้ว: ต้องคืนไฟล์ทุกกรณีแม้เทสแดงตามแผน จึงคืนด้วย trap EXIT ไม่ผูกกับรหัสจบของไปป์
set -u
cd /home/jetli/gucut-next || exit 9
T=scripts/tests/parts-models-ถามหน้าร้าน.test.mjs
cp lib/parts-models.ts "$CLAUDE_JOB_DIR/tmp/pm.bak"
restore() { cp "$CLAUDE_JOB_DIR/tmp/pm.bak" lib/parts-models.ts; return 0; }
trap restore EXIT
try1() {
  out="$(node --experimental-test-module-mocks --test "$T" 2>&1)"; rc=$?
  printf '%s ⇒ rc=%s ตก=%s\n' "$1" "$rc" "$(printf '%s\n' "$out" | grep -c '❌')"
  printf '%s\n' "$out" | grep '🔴 ตกที่' | sed 's/^#*  */     /'
}
try1 "⓪ ก่อนปลูก (ต้องเขียว)"
sed -i 's|    if (เดิม\[คีย์\]) { ข้าม++; continue }|    if (เดิม[String(r?.รหัส)]) { ข้าม++; continue }|' lib/parts-models.ts
try1 "① กลับไปเทียบด้วยรหัสดิบ (ต้องแดง)"
restore
try1 "② คืนสภาพแล้ว (ต้องเขียว)"
