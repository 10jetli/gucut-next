#!/bin/bash
# ล็อกอิน manager.line.biz อัตโนมัติ — เจ้าของร้านสั่งเอง 8 ก.ย. 2569 ("เขียนสคลิป ล็อคอิน")
#
# 🔴🔴 **อ่านก่อนใช้ — สองข้อที่เปลี่ยนความเสี่ยงของทั้งร้าน**
#
#  ① **รหัสไม่ได้อยู่ในไฟล์นี้ และไม่ได้อยู่ในไฟล์ไหนของโปรเจกต์**
#     เก็บใน **พวงกุญแจของ macOS (Keychain)** ซึ่งเข้ารหัสด้วยรหัสเครื่อง
#     เจ้าของร้านเป็นคนใส่เอง (คำสั่งอยู่ข้างล่าง) — **ผมไม่เคยเห็นค่ารหัสเลย**
#     ⇒ ห้ามใครแก้ให้ไปอ่านจากไฟล์ธรรมดาหรือจาก env เด็ดขาด
#
#  ② **บัญชีนี้คุมมากกว่าใบเสร็จ** — LINE OA @gucut1 ส่งข้อความหาลูกค้าได้ทุกคน
#     และ **ผูกกับ ZORT อยู่** (webhook api-social.zortout.com)
#     ⇒ เครื่องที่รันสคริปต์นี้ ถ้าโดนยึด = แชทร้านพังทั้งระบบ ไม่ใช่แค่บิลหาย
#     ผมบอกความเสี่ยงนี้ไปแล้วสองรอบ เจ้าของร้านตัดสินใจให้ทำ — บันทึกไว้ตรงนี้
#     **ห้ามเอาสคริปต์นี้ไปวางบน VPS หรือเครื่องที่คนอื่นเข้าถึงได้**
#
# ⚠️ **ทำไม่ได้แน่ ๆ ในสองกรณี — สคริปต์จะหยุดแล้วเตือน ไม่ใช่พยายามต่อ**
#    · บัญชีล็อกอินแบบ "ยืนยันในแอป LINE" (QR / กดอนุมัติบนมือถือ) — ไม่มีสคริปต์ไหนทำได้
#    · เปิด 2 ชั้น (OTP ทางอีเมล/SMS) — ต้องมีคนอ่านรหัส
#    ⇒ **ถ้าเจอสองอย่างนี้ ให้เลิกใช้สคริปต์นี้ กลับไปล็อกอินมือเดือนละครั้ง**
#       (ตัวเฝ้าบิลวันที่ 10/17/24 จะเตือนให้อยู่แล้ว ไม่มีทางลืม)
#
# ⚠️ ต้องเปิดสวิตช์ Chrome: View → Developer → Allow JavaScript from Apple Events
#    ตั้งใจใช้ทางฉีด JS **ไม่ใช้การพิมพ์คีย์ (System Events keystroke)**
#    เพราะการพิมพ์รหัสแบบตาบอด ถ้าโฟกัสเปลี่ยนกลางคัน **รหัสจะถูกพิมพ์ลงหน้าต่างอื่น**
#    เช่นช่องแชทหรือช่องค้นหา แล้วเราจะไม่มีวันรู้ว่ามันไปโผล่ที่ไหน
#
# ── วิธีใส่รหัสครั้งเดียว (เจ้าของร้านพิมพ์เอง ห้ามให้ใครพิมพ์แทน) ──
#   security add-generic-password -U -s gucut-line-biz -a 'อีเมลที่ใช้ล็อกอิน' -w
#   (พิมพ์คำสั่งแล้วกด Enter → มันจะถามรหัส พิมพ์แล้วกด Enter อีกที · ไม่โชว์บนจอ)
#   แล้วบันทึกอีเมลไว้ที่:  echo 'LINE_BIZ_EMAIL=อีเมล' >> ~/.gucut-bills.env

set -uo pipefail

HIST="https://manager.line.biz/account/@yab4021t/purchase/history"
LOGIN="https://account.line.biz/login"
NOTIFY="https://gucut.com/api/notify"
LOG="$HOME/Library/Logs/gucut-line-bill.log"
CONF="$HOME/.gucut-bills.env"
KC_SERVICE="gucut-line-biz"

mkdir -p "$(dirname "$LOG")"
say() { echo "$(date '+%Y-%m-%d %H:%M:%S') [login] $*" >> "$LOG"; }
tg() {
  [ -z "${GUCUT_WEB_ADMIN_KEY:-}" ] && return 1
  local b; b=$(python3 -c 'import json,sys;print(json.dumps({"text":sys.argv[1]}))' "$1")
  curl -s -m 20 -X POST "$NOTIFY" -H 'content-type: application/json' \
    -H "x-admin-key: $GUCUT_WEB_ADMIN_KEY" --data "$b" >> "$LOG" 2>&1; echo >> "$LOG"
}

[ -f "$CONF" ] || { say "🔴 ไม่มี $CONF"; exit 1; }
# shellcheck disable=SC1090
set -a; . "$CONF"; set +a

if [ -z "${LINE_BIZ_EMAIL:-}" ]; then
  say "🔴 ยังไม่ได้ตั้ง LINE_BIZ_EMAIL ใน $CONF"
  tg "🔴 <b>ล็อกอิน LINE อัตโนมัติ: ยังตั้งค่าไม่ครบ</b>
ยังไม่ได้บอกว่าใช้อีเมลไหนล็อกอิน — ดูวิธีที่หัวไฟล์ scripts/line-login.sh"
  exit 1
fi

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
runjs() { runjs_b64 "$(printf '%s' "$1" | base64 | tr -d '\n')"; }

# ── ยังล็อกอินอยู่ไหม? อยู่ = ไม่ต้องทำอะไร (ห้ามล็อกอินซ้ำโดยไม่จำเป็น) ──
osa 20 - >/dev/null 2>&1 <<APPLESCRIPT
tell application "Google Chrome"
  set f to false
  repeat with w in windows
    repeat with t in tabs of w
      if (URL of t starts with "https://manager.line.biz/") or (URL of t starts with "https://account.line.biz/") then set f to true
    end repeat
  end repeat
  if not f then tell window 1 to make new tab with properties {URL:"$HIST"}
end tell
APPLESCRIPT
sleep 6

P=$(runjs 'String(1+1)')
if [ -z "$P" ] || printf '%s' "$P" | grep -qi javascript; then
  say "🔴 สวิตช์ Apple Events ปิด หรือติดสิทธิ์เครื่อง"
  tg "🔴 <b>ล็อกอิน LINE อัตโนมัติทำงานไม่ได้</b>
สวิตช์ Chrome ยังปิด: View → Developer → Allow JavaScript from Apple Events"
  exit 1
fi

STATE=$(runjs 'String(location.host.indexOf("manager.line.biz")>=0 ? "IN" : "OUT")')
if [ "$STATE" = "IN" ]; then say "ยังล็อกอินอยู่ ไม่ต้องทำอะไร"; exit 0; fi

# ── หน้าล็อกอิน: ดูก่อนว่าเป็นแบบกรอกรหัส หรือแบบต้องยืนยันบนมือถือ ──
# 🔴 ตรวจก่อนกรอกเสมอ — ถ้าเป็นแบบมือถือ การกรอกจะไม่มีอะไรให้กรอก
#    แล้วสคริปต์จะวนคลิกมั่วในหน้าบัญชีธุรกิจ ซึ่งอันตรายกว่าไม่ทำอะไรเลย
FORM=$(runjs 'JSON.stringify({pw:document.querySelectorAll("input[type=password]").length, tx:document.querySelectorAll("input[type=text],input[type=email]").length})')
say "หน้าล็อกอิน: $FORM"
if ! printf '%s' "$FORM" | grep -q '"pw":1'; then
  say "🔴 ไม่ใช่หน้ากรอกรหัส (อาจต้องยืนยันในแอป LINE)"
  tg "🔴 <b>ล็อกอิน LINE อัตโนมัติทำไม่ได้</b>
หน้าล็อกอินไม่มีช่องรหัสผ่าน — บัญชีนี้น่าจะใช้แบบ <b>ยืนยันในแอป LINE</b>
ซึ่งไม่มีสคริปต์ไหนทำแทนได้ · ให้ล็อกอินมือครั้งเดียวแล้วใช้ตัวดึงบิลตามปกติ"
  exit 1
fi

# ── อ่านรหัสจากพวงกุญแจ (ไม่เคยแตะดิสก์ ไม่เคยเข้าล็อก) ──
PW=$(security find-generic-password -s "$KC_SERVICE" -a "$LINE_BIZ_EMAIL" -w 2>/dev/null)
if [ -z "$PW" ]; then
  say "🔴 ไม่มีรหัสในพวงกุญแจ (service=$KC_SERVICE)"
  tg "🔴 <b>ล็อกอิน LINE อัตโนมัติ: ยังไม่มีรหัสในพวงกุญแจ</b>
เจ้าของร้านต้องใส่เองครั้งเดียว — ดูคำสั่งที่หัวไฟล์ scripts/line-login.sh"
  exit 1
fi

# ⚠️ ส่งรหัสเข้าไปแบบ base64 พร้อมโค้ด — **ห้าม echo ห้ามใส่ใน argv ของคำสั่งอื่น**
#    (argv มองเห็นได้จาก ps ของทั้งเครื่อง)
FILL=$(cat <<EOJS
(function(){
  var e=document.querySelector('input[type=text],input[type=email]');
  var p=document.querySelector('input[type=password]');
  if(!e||!p) return 'NOFORM';
  var set=function(el,v){
    var d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');
    d.set.call(el,v);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  };
  set(e,'$LINE_BIZ_EMAIL'); set(p,'$PW');
  var b=[].slice.call(document.querySelectorAll('button,input[type=submit]'))
        .filter(function(x){return !x.disabled});
  if(b.length) b[b.length-1].click(); else (p.form&&p.form.submit());
  return 'SUBMITTED';
})()
EOJS
)
OUT=$(runjs "$FILL")
unset PW FILL
say "กรอกแล้ว: $OUT"
sleep 8

AFTER=$(runjs 'JSON.stringify({host:location.host,path:location.pathname,otp:/verif|otp|two|pin|รหัสยืนยัน/i.test(document.body.innerText)})')
say "หลังส่ง: $AFTER"

if printf '%s' "$AFTER" | grep -q 'manager.line.biz'; then
  say "✅ ล็อกอินสำเร็จ"
  exit 0
fi
if printf '%s' "$AFTER" | grep -q '"otp":true'; then
  tg "🔐 <b>ล็อกอิน LINE ติดรหัสยืนยัน (2 ชั้น)</b>
สคริปต์กรอกอีเมล+รหัสให้แล้ว แต่ LINE ขอรหัสยืนยันอีกชั้น — ต้องมีคนกรอก
เปิด Chrome แล้วกรอกให้เสร็จ จากนั้นตัวดึงบิลจะทำงานต่อได้เอง
<i>ถ้าเจอทุกครั้ง แปลว่าล็อกอินอัตโนมัติใช้ไม่ได้กับบัญชีนี้ — เลิกใช้สคริปต์นี้ได้เลย</i>"
  exit 2
fi
tg "🔴 <b>ล็อกอิน LINE ไม่สำเร็จ</b> — ยังไม่เข้าหน้า manager
$AFTER
ดูล็อก $LOG"
exit 1
