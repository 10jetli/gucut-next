#!/bin/bash
# ดึงใบกำกับภาษี LINE OA เข้าคลังบิล — **ไม่ต้องเปิดแอป Claude**
# เจ้าของร้านสั่ง 8 ก.ย. 2569 ("ทำๆ") หลังถามว่า "ล็อคอินไว้มีทางเดียวเหรอ"
#
# 🔴 **แยกสองเรื่องที่คนมักปนกัน**
#    ① ต้องมี session ที่ล็อกอิน manager.line.biz  → **เลี่ยงไม่ได้**
#       (LINE ไม่มี API ใบกำกับภาษี และไม่ส่งเข้าอีเมล — ตรวจแล้ว 8 ก.ย. 2569
#        แหล่งบัญชีไทยยืนยัน: โหลดจาก manager.line.biz ทางเดียว หลังจ่าย 24 ชม.)
#    ② ต้องเปิดแอป Claude ทิ้งไว้                   → **เลี่ยงได้ และไฟล์นี้คือตัวเลี่ยง**
#       ของเดิมเป็นงานตั้งเวลาในแอป Claude ซึ่งเขียนไว้เองว่าวิ่งได้เฉพาะตอนแอปเปิด
#       ⇒ ปิดแอปทั้งเดือน = บิลไม่เข้า **ทั้งที่ล็อกอิน LINE ยังดีอยู่**
#
# วิธีทำงาน: สั่ง Chrome ที่เปิดอยู่ (มี session อยู่แล้ว) ให้รัน JS ในหน้าเว็บนั้น
#   ⇒ **ไม่แตะรหัสผ่าน ไม่อ่านคุกกี้ ไม่เก็บ credential ของ LINE ไว้ที่ไหนเลย**
#      เบราว์เซอร์เป็นคนถือ session เหมือนเดิมทุกประการ
#
# ⚠️ **ต้องเปิดสวิตช์ใน Chrome ครั้งเดียว**: View → Developer →
#    "Allow JavaScript from Apple Events"
#    ไม่เปิด = สคริปต์ตรวจเจอแล้ว **เตือนเข้า Telegram** ไม่ใช่ตายเงียบ
#
# ⚠️ **ค่าลับอ่านจาก ~/.gucut-bills.env (chmod 600) ไม่ใช่จากในไฟล์นี้**
#    ไฟล์นี้อยู่ใน git — ห้ามมีค่าลับเด็ดขาด
#
# ⚠️ **ทุกทางที่ล้มเหลวต้องส่งเสียง** — ตัวเก็บบิลรุ่นก่อนเงียบตอนพัง
#    แล้ว "เงียบเพราะยังไม่มีบิล" กับ "เงียบเพราะตาย" แยกกันไม่ออก (นั่นคือบั๊กตัวจริง)
#
# ⚠️ **osascript ต้องมีเวลาจำกัดเสมอ — ห้ามปล่อยรอไม่มีที่สิ้นสุด**
#    ตอน launchd เป็นคนสั่ง macOS จะเด้งกล่อง "อนุญาตให้ควบคุม Google Chrome ไหม"
#    แล้ว **osascript ค้างรอคนกดตลอดไป** ⇒ งานทุกรอบทับกันจนมีโปรเซสค้างเป็นสิบ
#    (เจอของจริง 8 ก.ย. 2569 ตอนสั่ง launchctl start — ค้างเกิน 5 นาทีไม่จบ)
#    ⇒ ครอบด้วย perl alarm ทุกครั้ง · หมดเวลา = รายงานว่า "รอสิทธิ์อยู่" ไม่ใช่เงียบ
#
# ⚠️ **ตัวหาแท็บต้องนับ `account.line.biz` ด้วย ไม่ใช่แค่ `manager.line.biz`**
#    พอ session หมดอายุ LINE เด้งไป account.line.biz/login ⇒ ถ้าจับแต่ manager
#    จะได้ข้อความ "หาแท็บไม่เจอ" ซึ่ง **ชี้ผิดทางสนิท** (ของจริงคือ session ตาย)
#    เจอตอนทดสอบจริง 8 ก.ย. 2569 — ถ้าไม่ทดสอบคงส่งข้อความผิดให้เจ้าของร้านไล่ผิดที่
#
# ⚠️ **ส่ง JS เข้า Chrome ด้วย base64 ไม่ใช่ต่อสตริงตรง ๆ**
#    AppleScript รับสตริงหลายบรรทัดไม่ได้ และโค้ดมีทั้ง " ' \ และภาษาไทย
#    ต่อสตริงเองจะพังแบบเงียบ ๆ (ได้ JS ที่ถูกตัดครึ่ง) — base64 ไม่มีอักขระพวกนั้นเลย

set -uo pipefail

OA="@yab4021t"
HIST="https://manager.line.biz/account/${OA}/purchase/history"
NOTIFY="https://gucut.com/api/notify"
LOG="$HOME/Library/Logs/gucut-line-bill.log"
CONF="$HOME/.gucut-bills.env"

mkdir -p "$(dirname "$LOG")"
say() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

tg() {
  if [ -z "${GUCUT_WEB_ADMIN_KEY:-}" ]; then say "เตือนไม่ได้: ไม่มี GUCUT_WEB_ADMIN_KEY"; return 1; fi
  local body; body=$(python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1]}))' "$1")
  curl -s -m 20 -X POST "$NOTIFY" -H 'content-type: application/json' \
    -H "x-admin-key: $GUCUT_WEB_ADMIN_KEY" --data "$body" >> "$LOG" 2>&1
  echo >> "$LOG"
}

if [ ! -f "$CONF" ]; then say "🔴 ไม่มีไฟล์ $CONF"; exit 1; fi
# shellcheck disable=SC1090
set -a; . "$CONF"; set +a
if [ -z "${DRIVESYNC_SECRET:-}" ]; then say "🔴 $CONF ไม่มี DRIVESYNC_SECRET"; exit 1; fi

# กันรอบก่อนยังไม่จบแล้วรอบใหม่มาทับ (ทุก 12 ชม. ทับกันได้ถ้ารอบก่อนค้าง)
LOCK="$HOME/Library/Logs/.gucut-line-bill.lock"
if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then
  say "ข้าม: รอบก่อน (pid $(cat "$LOCK")) ยังทำงานอยู่"
  exit 0
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

if ! pgrep -xq "Google Chrome"; then
  say "ข้าม: Chrome ไม่ได้เปิดอยู่ (ไม่ใช่ความผิดพลาด — ลองใหม่รอบหน้า)"
  exit 0
fi

# ── เปิด/หาแท็บหน้าประวัติการชำระเงิน ──
osa 20 - >/dev/null 2>&1 <<APPLESCRIPT
tell application "Google Chrome"
  set found to false
  repeat with w in windows
    repeat with t in tabs of w
      if (URL of t starts with "https://manager.line.biz/") or (URL of t starts with "https://account.line.biz/") then set found to true
    end repeat
  end repeat
  if not found then tell window 1 to make new tab with properties {URL:"$HIST"}
end tell
APPLESCRIPT
sleep 8

# ── สั่ง JS ด้วย base64 (ปลอดภัยกับ " ' \ ขึ้นบรรทัดใหม่ และภาษาไทย) ──
# ครอบเวลาให้ osascript — perl alarm มีอยู่แล้วบน macOS (ไม่มีคำสั่ง timeout)
osa() { perl -e 'alarm shift; exec @ARGV' "$1" osascript "${@:2}"; }

runjs_b64() {
  osa 25 - 2>&1 <<APPLESCRIPT
tell application "Google Chrome"
  repeat with w in windows
    repeat with t in tabs of w
      if (URL of t starts with "https://manager.line.biz/") or (URL of t starts with "https://account.line.biz/") then
        return (execute t javascript "eval(decodeURIComponent(escape(atob('$1'))))")
      end if
    end repeat
  end repeat
  return "NOTAB"
end tell
APPLESCRIPT
}
b64() { printf '%s' "$1" | base64 | tr -d '\n'; }
runjs() { runjs_b64 "$(b64 "$1")"; }

# ── ด่าน 1: สวิตช์ Apple Events ──
PROBE=$(runjs 'String(1+1)')
if [ -z "$PROBE" ]; then
  # perl alarm ฆ่า osascript ⇒ ได้ค่าว่าง = ค้างรอกล่องขออนุญาตของ macOS
  say "🔴 osascript หมดเวลา — น่าจะติดกล่องขออนุญาตควบคุม Chrome"
  tg "🔴 <b>ตัวดึงบิล LINE ติดสิทธิ์เครื่อง</b>
macOS ขออนุญาตให้สคริปต์ควบคุม Google Chrome แล้วรอคนกด
เปิด <b>การตั้งค่าระบบ → ความเป็นส่วนตัวและความปลอดภัย → การอัตโนมัติ</b>
แล้วติ๊กให้ <b>bash</b> ควบคุม <b>Google Chrome</b> ได้ (กดครั้งเดียวจบ)"
  exit 1
fi
if printf '%s' "$PROBE" | grep -qi "javascript"; then
  say "🔴 สวิตช์ Apple Events ยังปิดอยู่: $PROBE"
  tg "🔴 <b>ตัวดึงบิล LINE ทำงานไม่ได้</b>
สวิตช์ใน Chrome ยังปิด — เปิดครั้งเดียวจบ:
View → Developer → Allow JavaScript from Apple Events
(ไทย: มุมมอง → นักพัฒนาซอฟต์แวร์ → อนุญาตให้เรียกใช้ JavaScript จากกิจกรรมใน Apple)"
  exit 1
fi
if [ "$PROBE" = "NOTAB" ]; then say "🔴 หาแท็บ manager.line.biz ไม่เจอ"; exit 1; fi

# ── ด่าน 2: ยังล็อกอินอยู่ไหม ──
LOGGED=$(runjs 'String(location.pathname.indexOf("/login")>=0 || location.host.indexOf("account.line.biz")>=0 ? "NO":"YES")')
if [ "$LOGGED" != "YES" ]; then
  say "🔴 session หมดอายุ ($LOGGED)"
  tg "🔴 <b>ตัวดึงบิล LINE: session หมดอายุ</b>
เปิด manager.line.biz แล้วล็อกอิน @gucut1 หนึ่งครั้ง
(ระบบไม่ล็อกอินให้เองโดยตั้งใจ — ไม่เก็บรหัสไว้ที่ไหนเลย)
ใบกำกับภาษี LINE โหลดได้จากหน้านี้ทางเดียว ไม่มี API และไม่ส่งเข้าอีเมล"
  exit 1
fi

# ── ด่าน 3: เก็บใบของเดือนนี้ + เดือนที่แล้ว แล้วอัปเข้าคลัง ──
# ทำในหน้าเว็บทั้งหมด (same-origin ⇒ เบราว์เซอร์แนบ session ให้เอง)
# ⚠️ งานเป็น async — AppleScript คืนค่าทันที จึงเก็บผลไว้ที่ window.__gb แล้ววนถาม
JS=$(cat <<EOJS
(function(){
 window.__gb='RUNNING';
 (async()=>{
  try{
   var OA='@yab4021t', out={added:[],dup:[],err:[]};
   var pad=function(n){return String(n).padStart(2,'0')};
   var now=new Date(), cur=now.getFullYear()+'-'+pad(now.getMonth()+1);
   var p=new Date(now.getFullYear(), now.getMonth()-1, 1);
   var prev=p.getFullYear()+'-'+pad(p.getMonth()+1);
   var want={}; want[cur]=1; want[prev]=1;
   var rows=[].slice.call(document.querySelectorAll('a[href*="/purchase/history/invoice/"]')).map(function(a){
     var id=a.getAttribute('href').split('/').pop();
     var box=a; for(var i=0;i<6&&box.parentElement;i++){ box=box.parentElement;
       if(/\d{2}\/\d{2}\/\d{4}/.test(box.textContent)) break; }
     var m=(box.textContent||'').match(/(\d{2})\/(\d{2})\/(\d{4})/);
     return m ? {id:id, month:m[3]+'-'+m[2]} : null;
   }).filter(Boolean);
   if(!rows.length){ window.__gb=JSON.stringify({fatal:'อ่านตารางไม่เจอสักแถว หน้าอาจเปลี่ยนโครง'}); return; }
   var seen={};
   for(var k=0;k<rows.length;k++){
     var r=rows[k];
     if(!want[r.month] || seen[r.id]) continue;
     seen[r.id]=1;
     var name='LINE-TaxInvoice-'+r.id+'.pdf';
     try{
       var url='https://manager.line.biz/api/bots/'+OA+'/purchase/th/withholding/receipt/'+r.id+'/download';
       var res=await fetch(url,{credentials:'include'});
       if(!res.ok) throw new Error('โหลด PDF ตอบ '+res.status);
       var blob=await res.blob();
       var head=new TextDecoder('latin1').decode(new Uint8Array(await blob.slice(0,5).arrayBuffer()));
       if(head!=='%PDF-') throw new Error('ที่ได้มาไม่ใช่ PDF ('+head+')');
       var fd=new FormData();
       fd.append('secret','$DRIVESYNC_SECRET');
       fd.append('vendor','line'); fd.append('month',r.month);
       fd.append('filename',name); fd.append('file',blob,name);
       var up=await fetch('https://admin.gucut.com/api/bills/upload',{method:'POST',body:fd});
       var d=await up.json().catch(function(){return null});
       if(!up.ok||!d||!d.ok) throw new Error((d&&d.error)||('อัปโหลดตอบ '+up.status));
       (d.uploaded?out.added:out.dup).push(name);
     }catch(e){ out.err.push(name+': '+e.message); }
   }
   out.months=[cur,prev]; out.rows=rows.length;
   window.__gb=JSON.stringify(out);
  }catch(e){ window.__gb=JSON.stringify({fatal:String(e&&e.message||e)}); }
 })();
 return 'STARTED';
})()
EOJS
)

runjs "$JS" >/dev/null
R=""
for _ in $(seq 1 40); do
  sleep 3
  R=$(runjs 'String(window.__gb||"")')
  if [ -n "$R" ] && [ "$R" != "RUNNING" ]; then break; fi
done
say "ผล: $R"

if [ -z "$R" ] || [ "$R" = "RUNNING" ]; then
  tg "🔴 <b>ตัวดึงบิล LINE ค้าง</b> — รันเกิน 2 นาทีแล้วยังไม่จบ ดูล็อก $LOG"
  exit 1
fi

RES=$(python3 - "$R" <<'PY'
import json,sys
try: d=json.loads(sys.argv[1])
except Exception: print("PARSE_FAIL||"); raise SystemExit
if d.get('fatal'): print("FATAL|"+d['fatal']+"|"); raise SystemExit
print("OK|%d|%s" % (len(d.get('added',[])), " · ".join(d.get('err',[]))))
PY
)
KIND=${RES%%|*}; REST=${RES#*|}; N=${REST%%|*}; ERR=${REST#*|}

case "$KIND" in
  FATAL)      tg "🔴 <b>ตัวดึงบิล LINE พัง</b>: $N" ;;
  PARSE_FAIL) tg "🔴 <b>ตัวดึงบิล LINE</b> — อ่านผลลัพธ์ไม่ออก ดูล็อก $LOG" ;;
  OK)
    # เงียบเมื่อไม่มีของใหม่และไม่มีอะไรพลาด (ของซ้ำเป็นเรื่องปกติ เพราะยิงทุกวัน)
    if [ "${N:-0}" != "0" ] || [ -n "$ERR" ]; then
      tg "🧾 <b>ใบกำกับภาษี LINE</b> — ใหม่ ${N} ใบ${ERR:+
🔴 $ERR}"
    fi ;;
esac
exit 0
