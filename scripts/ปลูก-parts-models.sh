#!/bin/bash
# ยืนยันแล้ว: ต้องคืนไฟล์ต้นฉบับทุกกรณีแม้เทสแดงตามแผน จึงคืนด้วย trap EXIT ไม่ผูกกับรหัสจบ
set -u
cd /home/jetli/gucut-next || exit 9
T=scripts/tests/parts-models-ถามหน้าร้าน.test.mjs
cp lib/parts-models.ts "$CLAUDE_JOB_DIR/tmp/parts-models.bak"
restore() { cp "$CLAUDE_JOB_DIR/tmp/parts-models.bak" lib/parts-models.ts; return 0; }
trap restore EXIT
try1() {
  out="$(node --experimental-test-module-mocks --test "$T" 2>&1)"; rc=$?
  BAD="$(printf '%s\n' "$out" | grep -c '❌')"
  printf '%s ⇒ rc=%s ข้อที่ตก=%s\n' "$1" "$rc" "$BAD"
  printf '%s\n' "$out" | grep '🔴 ตกที่' | sed 's/^#*  */     /'
}
try1 "⓪ ก่อนปลูก (ต้องเขียว)"
sed -i 's/      ถามได้: false,/      ถามได้: true,/' lib/parts-models.ts
try1 "① ล้มแล้วบอกว่าถามได้ (ต้องแดง)"
restore
sed -i "s/    if (!รุ่น.length) throw new Error('อ่านได้แต่ไม่มีรุ่นเลย')//" lib/parts-models.ts
try1 "② 200 ว่างแล้วเชื่อว่าไม่มีรุ่น (ต้องแดง)"
restore
sed -i 's|`⚠️ ของสำรองในโค้ด (ถามหน้าร้านไม่ได้: ${เหตุ}) — รุ่นที่เพิ่งเพิ่มจะไม่ถูกจับคู่รอบนี้`|"ใช้ของสำรอง"|' lib/parts-models.ts
try1 "③ ใช้ของสำรองแบบไม่บอกเหตุ (ต้องแดง)"
restore
try1 "④ คืนสภาพแล้ว (ต้องเขียว)"
