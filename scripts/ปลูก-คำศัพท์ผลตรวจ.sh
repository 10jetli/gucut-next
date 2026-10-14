#!/bin/bash
# ยืนยันแล้ว: ต้องคืนไฟล์สารบัญทุกกรณีแม้ด่านแดงตามแผน จึงคืนด้วย trap EXIT ไม่ผูกกับรหัสจบ
set -u
cd /home/jetli/gucut-next || exit 9
cp lib/pipe-snapshot.json "$CLAUDE_JOB_DIR/tmp/snap.bak"
restore() { cp "$CLAUDE_JOB_DIR/tmp/snap.bak" lib/pipe-snapshot.json; return 0; }
trap restore EXIT
try1() {
  out="$(node scripts/check-คำศัพท์ผลตรวจ.mjs 2>&1)"; rc=$?
  printf '%s ⇒ rc=%s\n' "$1" "$rc"
  printf '%s\n' "$out" | grep -E "^(🔴|   ·|   ✓|⚠️)" | head -4 | sed 's/^/     /'
}
try1 "⓪ สารบัญยังไม่มีคำศัพท์ (ต้องบอกว่ายังไม่ได้ตรวจ · rc=0)"
python3 -c "
import json,io
d=json.load(open('lib/pipe-snapshot.json'))
d['endpoints']['auditVocab']={'ประกาศ':{'cat':['seo','geo','speed'],'level':['high','mid','low','ok']},
 'ที่พบจริง':{'cat':['geo','seo','speed'],'level':['high','low','mid'],'scoreKeys':['geo','seo','speed'],'จำนวนข้อ':15}}
io.open('lib/pipe-snapshot.json','w',encoding='utf-8').write(json.dumps(d,ensure_ascii=False,indent=1))"
try1 "① ใส่คำศัพท์จริงของท่อ (จอแก้แล้ว ⇒ ต้องเขียว)"
python3 -c "
import json,io
d=json.load(open('lib/pipe-snapshot.json'))
d['endpoints']['auditVocab']['ที่พบจริง']['level'].append('urgent')
io.open('lib/pipe-snapshot.json','w',encoding='utf-8').write(json.dumps(d,ensure_ascii=False,indent=1))"
try1 "② ท่อส่ง level ใหม่ที่จอไม่รู้จัก (ต้องแดง)"
restore
python3 -c "
import json,io
d=json.load(open('lib/pipe-snapshot.json'))
d['endpoints']['auditVocab']={'ประกาศ':{'cat':['seo','geo','speed','aeo'],'level':['high','mid','low','ok']},'ที่พบจริง':None}
io.open('lib/pipe-snapshot.json','w',encoding='utf-8').write(json.dumps(d,ensure_ascii=False,indent=1))"
try1 "③ ท่อเพิ่มด้านใหม่ aeo (ต้องแดง — แท็บจะว่าง)"
restore
try1 "④ คืนสภาพแล้ว (ต้องกลับเป็นยังไม่ได้ตรวจ)"
