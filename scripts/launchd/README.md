# งานตั้งเวลาในเครื่อง (launchd) — ของที่ทำบนเซิร์ฟเวอร์ไม่ได้

ไฟล์จริงต้องอยู่ที่ `~/Library/LaunchAgents/` (ที่นี่เก็บสำเนาไว้ใน git เฉย ๆ)

| งาน | ทำอะไร | ทำไมไม่อยู่บนเซิร์ฟเวอร์ |
|---|---|---|
| `com.gucut.line-bill.plist` | ดึงใบกำกับภาษี LINE OA เข้าคลังบิล 09:30 · 20:30 | **LINE ไม่มี API ใบกำกับภาษี และไม่ส่งเข้าอีเมล** (ตรวจแล้ว 8 ก.ย. 2569) โหลดได้จากหน้าที่ล็อกอินแล้วทางเดียว ⇒ ต้องยืม session ของเบราว์เซอร์ในเครื่อง |

## ติดตั้ง
```bash
cp scripts/launchd/com.gucut.line-bill.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.gucut.line-bill.plist
launchctl start com.gucut.line-bill      # สั่งวิ่งเดี๋ยวนี้เพื่อทดสอบ
tail -5 ~/Library/Logs/gucut-line-bill.log
```

## ต้องเปิดสิทธิ์ 2 อย่าง (ครั้งเดียว) — ไม่เปิด = สคริปต์เตือนเข้า Telegram ไม่ตายเงียบ
1. **Chrome**: View → Developer → *Allow JavaScript from Apple Events*
2. **macOS**: การตั้งค่าระบบ → ความเป็นส่วนตัวและความปลอดภัย → การอัตโนมัติ →
   ติ๊กให้ `bash` ควบคุม `Google Chrome`
   ⚠️ ข้อ 2 จะเด้งกล่องถามตอน launchd สั่งครั้งแรก **และ osascript จะค้างรอคนกด**
   สคริปต์จึงครอบเวลาไว้ (perl alarm) แล้วรายงานว่า "ติดสิทธิ์เครื่อง" แทนที่จะค้าง

## ค่าลับ
อ่านจาก `~/.gucut-bills.env` (chmod 600) — **ห้าม commit** ต้องมี
`DRIVESYNC_SECRET` และ `GUCUT_WEB_ADMIN_KEY` (ค่าเดียวกับ Netlify env ของ gucut-admin)
