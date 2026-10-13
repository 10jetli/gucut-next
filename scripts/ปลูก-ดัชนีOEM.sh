#!/bin/bash
# ยืนยันแล้ว: ต้องคืนไฟล์ทุกกรณีแม้เทสแดงตามแผน จึงคืนด้วย trap EXIT ไม่ผูกกับรหัสจบของไปป์
set -u
cd /home/jetli/gucut-next || exit 9
T=scripts/tests/parts-models-ถามหน้าร้าน.test.mjs
cp lib/parts-models.ts "$CLAUDE_JOB_DIR/tmp/pm6.bak"
restore() { cp "$CLAUDE_JOB_DIR/tmp/pm6.bak" lib/parts-models.ts; return 0; }
trap restore EXIT
try1() {
  out="$(node --experimental-test-module-mocks --test "$T" 2>&1)"; rc=$?
  printf '%s ⇒ rc=%s ตก=%s\n' "$1" "$rc" "$(printf '%s\n' "$out" | grep -c '❌')"
  printf '%s\n' "$out" | grep '🔴 ตกที่' | sed 's/^#*  */     /'
}
try1 "⓪ ก่อนปลูก (ต้องเขียว)"
python3 - <<'PY'
import io
p="lib/parts-models.ts"; s=io.open(p,encoding="utf-8").read()
a = """        const เดิม = m.get(เลข)
        if (เดิม) { if (!เดิม.includes(sku)) เดิม.push(sku) } else m.set(เลข, [sku])"""
assert s.count(a)==1
io.open(p,"w",encoding="utf-8").write(s.replace(a, """        if (!m.has(เลข)) m.set(เลข, [sku])"""))
PY
try1 "① กลับไปเก็บ sku ตัวแรกตัวเดียว (ต้องแดง)"
restore
python3 - <<'PY'
import io
p="lib/parts-models.ts"; s=io.open(p,encoding="utf-8").read()
a = "        if (เลข.length < 8 || มาจากคนกรอก.has(เลข)) continue"
assert s.count(a)==1
io.open(p,"w",encoding="utf-8").write(s.replace(a, "        if (เลข.length < 8) continue"))
PY
try1 "② ปล่อยให้ tags เติมทับของที่ท่านกรอก (ต้องแดง)"
restore
try1 "③ คืนสภาพแล้ว (ต้องเขียว)"
