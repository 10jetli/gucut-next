# GUCUT — ระบบหลังบ้าน (gucut-next)

ระบบภายในของร้าน GUCUT (ร้านอะไหล่เลื่อยยนต์) รันที่ **https://gucut-next.vercel.app** ล็อกทั้งเว็บด้วยรหัสผ่านเดียว (env `SITE_PASSWORD`)

## ภาพรวมระบบ

| ส่วน | path | คืออะไร |
|---|---|---|
| Dashboard | `/` | ภาพรวมร้าน: orders วันนี้, ยอดขาย 7 วัน, สินค้า, ตีกลับ, โรงงาน (ดึงจาก ZORT + Google Sheets) |
| Orders | `/orders` | รายการออเดอร์จาก ZORT |
| สินค้า | `/products` | สินค้าจาก ZORT |
| โรงงาน | `/factory` | งานสั่งผลิต (Google Sheets) |
| โฆษณา | `/ads` | ข้อมูลโฆษณา |
| ระบบสั่งของ | `/catalog/index.html` | **static site** แคตตาล็อก 2,256 SKU + แผนสั่งซื้อ (ย้ายมาจาก Netlify) |
| โอนสินค้า | `/catalog/index.html#trf` | สร้างใบโอนจริงระหว่าง 3 บัญชี ZORT (ในไฟล์ static เดียวกัน) |
| บิล | `/bills`, `/bills/[vendor]` | ระบบเก็บบิลจาก Gmail รายเดือน 8 เจ้า + แปลงอีเมลเป็น PDF |
| ตั้งค่า → เชื่อมต่อบริการอื่น | `/settings/connections` | เช็คสถานะ Gmail token / ZORT / Sheets + ฟอร์มกุญแจ ZORT (localStorage) |

## โครงสร้างโค้ด

```
app/
  page.tsx                    Dashboard
  layout.tsx                  ครอบด้วย <AppShell> (sidebar/topbar)
  login/                      หน้าล็อกอิน (SITE_PASSWORD)
  orders/ products/ factory/ ads/   หน้าข้อมูลแต่ละส่วน
  bills/ + bills/[vendor]/    หน้าบิลรายเจ้า
  settings/connections/       สถานะการเชื่อมต่อ + กุญแจ ZORT
  api/
    zort/                     proxy ไป ZORT API (ใช้ env ZORT_*)
    sheets/                   อ่าน Google Sheets โรงงาน (gviz public)
    bills/                    ค้นบิลทุกเจ้าของเดือน
    bills/vendor/             ค้นบิลรายเจ้า
    bills/file/               ดาวน์โหลดไฟล์แนบ / สร้าง PDF จากอีเมล (attachmentId=GEN)
    bills/download/           ZIP บิลทั้งเดือน
    connections/              ตรวจสถานะการเชื่อมต่อทุกบริการ
    auth/ google/             ล็อกอิน + Google OAuth callback (public paths)
components/
  AppShell.tsx                sidebar ย่อ/ขยายได้ + เมนูย่อยแบบ accordion + mobile nav
  OrderCard.tsx               การ์ดออเดอร์
lib/
  gmail.ts                    Gmail API (refresh token) + นิยาม VENDORS ทั้ง 8 เจ้า + query
  emailPdf.ts                 แปลงอีเมลบิลเป็น PDF (pdf-lib + ฟอนต์ Sarabun โหลด runtime)
  zort.ts                     ZORT API helper (2 ร้านจาก env)
  billdate.ts types.ts        helper/types
public/catalog/
  index.html products.json    เว็บแคตตาล็อก static (แก้ตรงนี้ = แก้ระบบสั่งของ/โอนสินค้า)
middleware.ts                 ล็อกทั้งเว็บ ยกเว้น /login /api/auth /api/google
```

## Environment variables (ตั้งใน Vercel)

- `SITE_PASSWORD` — รหัสเข้าเว็บ (cookie `gucut_auth`)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` — Gmail API (บัญชี 10jetli@gmail.com)
- `ZORT_STORENAME_1` / `ZORT_APIKEY_1` / `ZORT_APISECRET_1` — ร้าน gucut@icloud.com
- `ZORT_STORENAME_2` / `ZORT_APIKEY_2` / `ZORT_APISECRET_2` — ร้าน ceojet@gmail.com

**กุญแจ ZORT ของระบบโอนสินค้า (3 บัญชี) ไม่อยู่ใน env** — เก็บใน localStorage `gucut_zort_conn_v1` ของเบราว์เซอร์ผู้ใช้ กรอกผ่านหน้า ตั้งค่า → เชื่อมต่อบริการอื่น

## วิธี deploy (สำคัญ — workflow เฉพาะของโปรเจกต์นี้)

repo หลักที่แก้ไขคือ `10jetli/gucut-next` (repo นี้) แต่ Vercel project `gucut-next` เชื่อมกับ repo โคลนภายใต้บัญชี `gucut-jet` การ push มาที่ repo นี้**ไม่ trigger deploy อัตโนมัติ** ต้องทำรอบ deploy ดังนี้:

1. เปิด `vercel.com/new/clone?repository-url=https://github.com/10jetli/gucut-next`
2. ตั้งชื่อ repo ใหม่ตามลำดับ `gucut-next-authNN` (เลขถัดจากตัวล่าสุด) → Create → รอ build เสร็จ
3. ไป Project `gucut-next` → Settings → Git → Disconnect → เลือก GitHub → Connect กับ `gucut-next-authNN` ตัวใหม่
4. สร้าง Deploy Hook ใหม่ (ของเก่าใช้ไม่ได้หลัง reconnect) → เปิด URL hook เพื่อ trigger
5. รอ Deployments ขึ้น Ready แล้วตรวจผลจริงบน gucut-next.vercel.app

**จุดเซฟ:** ทุก deploy ย้อนกลับได้ผ่านปุ่ม Promote to Production ในหน้า Deployments — จดเลข commit + วันเวลาไว้ทุกครั้งที่แก้

## กับดักที่รู้แล้ว (อย่าเหยียบซ้ำ)

- **ZORT `GetOrders`**: ใช้ `page=` เท่านั้น ห้ามใช้ `offset=` (ข้อมูลซ้ำ/ตัวเลขเพี้ยน) และ `fromdate/todate` ไม่ทำงาน ต้องกรองวันที่ฝั่ง client
- **ฟอนต์ไทยใน PDF**: ต้องโหลด TTF เต็ม (Sarabun จาก google/fonts raw) แล้ว `embedFont(bytes, { subset: true })` — ฟอนต์แบบ subset รายสคริปต์จะไม่มีตัวเลข/ละติน
- **รูปใน pdf-lib**: ใช้ bytes จาก `fetch().arrayBuffer()` เท่านั้น (Buffer ที่มี byteOffset จะพัง JPEG parser)
- **แคตตาล็อก static**: อ้าง `products.json` แบบ relative — ต้องอยู่โฟลเดอร์เดียวกัน · ข้อมูลผู้ใช้ (โรงงาน/การแก้ไข/หมวด/กุญแจ) อยู่ใน localStorage ผูกกับโดเมน
- **อีเมล Apple ไม่มีไฟล์แนบ**: ระบบบิลใช้ `attachmentId=GEN` เป็น marker แล้วสร้าง PDF จาก HTML ของอีเมล (`lib/emailPdf.ts`)

## เอกสารเพิ่มเติม

คู่มือฉบับเต็ม (สูตรจำนวนสั่ง, ระบบหมวด/โรงงาน, ประวัติจุดเซฟ Netlify เดิม): ไฟล์ `GUCUT-คู่มือรวม.md` ในเครื่องผู้ใช้
