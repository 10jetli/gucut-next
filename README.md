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

## โครงสร้างโค้ด (หลัง refactor)

> กติกาการเขียนโค้ดฉบับเต็ม: ดู **CLAUDE.md**

```
app/
  layout.tsx                  ครอบทุกหน้าด้วย <AppShell> (จุดเดียว)
  page.tsx                    Dashboard
  login/ orders/ products/ factory/ ads/   หน้าข้อมูลแต่ละส่วน
  bills/ + bills/[vendor]/    หน้าบิลรายเจ้า
  settings/connections/       สถานะการเชื่อมต่อ + กุญแจ ZORT
  api/
    zort/                     proxy ไป ZORT API (ใช้ env ZORT_*)
    sheets/                   อ่าน Google Sheets โรงงาน (gviz public)
    ads/                      ข้อมูลโฆษณาจาก data/ads.json
    bills/                    ค้นบิลทุกเจ้าของเดือน
    bills/vendor/             ค้นบิลรายเจ้า
    bills/file/               ดาวน์โหลดไฟล์แนบ / สร้าง PDF จากอีเมล (attachmentId=GEN)
    bills/download/           ZIP บิลทั้งเดือน
    connections/              ตรวจสถานะการเชื่อมต่อทุกบริการ
    auth/ google/             ล็อกอิน + Google OAuth callback (public paths)
components/
  layout/                     AppShell (state) + Sidebar + TopBar + MobileNav
  ui/                         OrderCard, LoadingState, ErrorBox, PillButton
lib/
  nav-config.ts               ⭐ รายการเมนูทั้งหมด (แก้เมนูที่นี่ที่เดียว)
  vendors.ts                  ⭐ ข้อมูล vendor บิลทั้งหมด (ชื่อ/query/accountId — แก้ที่นี่ที่เดียว)
  format.ts                   fmtBaht, fmtNum, TH_MONTHS, EN_MONTHS
  gmail.ts                    Gmail API (refresh token) + ค้นบิล
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

> อัปเดต ส.ค. 2026: **ย้ายจาก Vercel มา Netlify แล้ว** — workflow เก่าที่ต้องโคลน repo เป็น
> `gucut-next-authNN` แล้ว reconnect ทุกครั้ง **ยกเลิกแล้ว ไม่ต้องทำอีก**

- **Production**: https://admin.new78.com (Netlify project `gucut-admin`)
- **Deploy อัตโนมัติ**: push ขึ้น branch `main` ของ `10jetli/gucut-next` → Netlify build เอง ไม่ต้องทำอะไรเพิ่ม
- **Runtime**: `@netlify/plugin-nextjs` (Next.js 14 App Router)

**จุดเซฟ:** ทุก deploy ย้อนกลับได้จาก Netlify → Deploys → เลือก deploy เก่า → Publish deploy
จดเลข commit + วันเวลาไว้ทุกครั้งที่แก้

### Environment variables (ตั้งที่ Netlify → Site configuration → Environment variables)

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `SITE_PASSWORD` | รหัสล็อกทั้งเว็บ (middleware.ts) |
| `GEMINI_API_KEY` | หน้า AI Visibility — เรียก Gemini API (Google AI Studio free tier) ตรวจว่า AI เอ่ยถึงร้านไหม |

> ตั้งค่า env ใหม่แล้วต้อง **redeploy หนึ่งครั้ง** ค่าถึงจะมีผล

## กับดักที่รู้แล้ว (อย่าเหยียบซ้ำ)

- **ZORT `GetOrders`**: ใช้ `page=` เท่านั้น ห้ามใช้ `offset=` (ข้อมูลซ้ำ/ตัวเลขเพี้ยน) และ `fromdate/todate` ไม่ทำงาน ต้องกรองวันที่ฝั่ง client
- **ฟอนต์ไทยใน PDF**: ต้องโหลด TTF เต็ม (Sarabun จาก google/fonts raw) แล้ว `embedFont(bytes, { subset: true })` — ฟอนต์แบบ subset รายสคริปต์จะไม่มีตัวเลข/ละติน
- **รูปใน pdf-lib**: ใช้ bytes จาก `fetch().arrayBuffer()` เท่านั้น (Buffer ที่มี byteOffset จะพัง JPEG parser)
- **แคตตาล็อก static**: อ้าง `products.json` แบบ relative — ต้องอยู่โฟลเดอร์เดียวกัน · ข้อมูลผู้ใช้ (โรงงาน/การแก้ไข/หมวด/กุญแจ) อยู่ใน localStorage ผูกกับโดเมน
- **อีเมล Apple ไม่มีไฟล์แนบ**: ระบบบิลใช้ `attachmentId=GEN` เป็น marker แล้วสร้าง PDF จาก HTML ของอีเมล (`lib/emailPdf.ts`)

## เอกสารเพิ่มเติม

คู่มือฉบับเต็ม (สูตรจำนวนสั่ง, ระบบหมวด/โรงงาน, ประวัติจุดเซฟ Netlify เดิม): ไฟล์ `GUCUT-คู่มือรวม.md` ในเครื่องผู้ใช้
