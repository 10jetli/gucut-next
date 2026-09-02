# CLAUDE.md — กติกาการเขียนโค้ดโปรเจกต์ gucut-next

> อ่านไฟล์นี้ก่อนแก้โค้ดทุกครั้ง (สำหรับทั้ง AI และคนใหม่) · รายละเอียดระบบ/วิธี deploy อยู่ใน README.md

## โครงสร้างโปรเจกต์ (หลัง refactor ก.ค. 2026)

```
app/                        หน้าเว็บ (App Router) — ห้ามใส่ Navbar/Header/Footer เองในเพจ
  layout.tsx                จุดเดียวที่ครอบ <AppShell> ให้ทุกหน้า
  page.tsx                  Dashboard · orders/ products/ factory/ ads/ bills/ settings/ login/
  api/                      API routes (zort, sheets, ads, bills*, connections, auth, google, rokid)
components/
  layout/                   โครงหน้า — AppShell (state), Sidebar, TopBar, MobileNav
  ui/                       ชิ้นส่วน UI ใช้ซ้ำ — OrderCard, LoadingState, ErrorBox, PillButton
lib/
  nav-config.ts             ⭐ รายการเมนูทั้งหมด — เพิ่ม/แก้เมนูที่นี่ที่เดียว
  vendors.ts                ⭐ ข้อมูล vendor บิลทั้งหมด (ชื่อ/emoji/logo/note/Gmail query/accountId)
  format.ts                 fmtBaht, fmtNum, TH_MONTHS, EN_MONTHS
  gmail.ts                  Gmail API + search บิล (VENDORS มาจาก vendors.ts)
  zort.ts                   ZORT API (2 ร้านจาก env)
  emailPdf.ts               แปลงอีเมลใบเสร็จเป็น PDF (pdf-lib + ฟอนต์ Sarabun runtime)
  billdate.ts               อ่านเดือนบนหัวบิลจาก PDF
  rokid.ts                  สะพานแว่น Rokid Glasses → Claude (แปลง chat completions ↔ Anthropic Messages API)
  types.ts                  TypeScript interfaces ที่ใช้ร่วม
data/ads.json               ข้อมูลโฆษณา (snapshot)
public/catalog/             เว็บแคตตาล็อก static (index.html + products.json) — คนละระบบกับ Next.js
middleware.ts               ล็อกทั้งเว็บด้วย SITE_PASSWORD (ยกเว้น /login, /api/auth, /api/google)
```

## กติกาการเขียนโค้ด (ต้องทำตาม)

1. **เมนู**: เพิ่ม/แก้เมนูที่ `lib/nav-config.ts` เท่านั้น — ห้าม hardcode เมนูใน component/เพจ
2. **vendor บิล**: เพิ่ม/แก้ผู้ให้บริการบิลที่ `lib/vendors.ts` เท่านั้น — มีผลทั้ง Gmail query, เมนูย่อย, หน้ารวมบิล, หน้ารายเจ้า อัตโนมัติ
3. **จัดรูปแบบเงิน/ตัวเลข/เดือน**: import จาก `lib/format.ts` — ห้ามประกาศ `fmtBaht`/`TH_MONTHS` ซ้ำในเพจ
4. **Layout**: ทุกหน้าได้ Sidebar/TopBar อัตโนมัติจาก `app/layout.tsx` → `components/layout/AppShell` — เพจเขียนเฉพาะเนื้อหา
5. **UI ที่ซ้ำ**: ก่อนเขียน markup ใหม่ ดู `components/ui/` ก่อน (LoadingState, ErrorBox, PillButton, OrderCard) — ถ้าใช้ pattern เดิมซ้ำเป็นครั้งที่ 2 ให้แยกเป็น component ใน ui/
6. **ข้อความในเว็บเป็นภาษาไทย** — คงข้อความเดิมไว้เว้นแต่ผู้ใช้สั่งแก้
7. **type ที่ใช้ข้ามไฟล์** ประกาศใน `lib/types.ts` (หรือไฟล์ lib ของโดเมนนั้น แล้ว export)
8. **API route ใหม่** วางใต้ `app/api/<ชื่อ>/route.ts` · logic ที่ยาวแยกไป `lib/` — route ทำหน้าที่รับ request/ตอบ response เท่านั้น
9. **ห้าม commit secrets** — กุญแจทั้งหมดอยู่ใน env (Vercel) หรือ localStorage ฝั่งผู้ใช้เท่านั้น
10. **ก่อนส่งงาน**: รัน `npm run build` ต้องผ่าน (typecheck) · จดจุดเซฟ (deploy id + วันเวลา) แจ้งผู้ใช้เสมอ

## กับดักที่รู้แล้ว (อย่าเหยียบซ้ำ)

- ZORT `GetOrders`: ใช้ `page=` เท่านั้น ห้าม `offset=` และ `fromdate/todate` ไม่ทำงาน (กรองวันที่ฝั่ง client)
- ฟอนต์ไทยใน PDF: ต้องโหลด TTF เต็มไฟล์ + `embedFont(bytes, { subset: true })`
- รูปใน pdf-lib: ใช้ bytes จาก `fetch().arrayBuffer()` เท่านั้น (Buffer ที่มี byteOffset จะพัง)
- แคตตาล็อก static อ้าง `products.json` แบบ relative — สองไฟล์ต้องอยู่โฟลเดอร์เดียวกันเสมอ
- อีเมลไม่มีไฟล์แนบ: ระบบบิลใช้ `attachmentId=GEN` เป็น marker แล้วสร้าง PDF จาก HTML

### ⚠️ กฎเรื่องแท็บ (เจอของจริง 2 ก.ย. 2569 — ใช้กับทุกจอที่มีแท็บ)

**1. แท็บคือสารบัญของข้อมูลทั้งหมด ไม่ใช่ผลของตัวกรองที่เลือกอยู่**
ตัวนับในแท็บต้องไม่ถูกกรองด้วยแท็บที่กำลังเลือก ไม่งั้นกดแท็บแรกแล้วแท็บอื่นเป็นศูนย์หมด
แท็บที่บอกไม่ได้ว่าแท็บอื่นมีกี่ใบ ก็ไม่ใช่แท็บ เป็นแค่ปุ่มกรอง

**2. ตัวเลขในวงเล็บบนแท็บคือคำสัญญา — กดแล้วต้องเจอของเท่านั้นจริง ๆ**
อาการที่หลอกที่สุดคือแท็บบอก "ยกเลิก (44)" แล้วกดได้ 0 แถว เพราะเลขในวงเล็บ
ทำให้คนเชื่อว่ามีของ · เจอจริงที่ `/core/sales`: `list=orders` ตัดใบยกเลิกทิ้ง
ถ้าไม่ส่ง `cancelled=1` ⇒ ตัวนับกับตัวแถวมาคนละกติกา

ผลพลอยได้ที่ต้องระวัง: พอรวมใบยกเลิกในแท็บ "ทั้งหมด" ยอดรวมจะพองขึ้น
**ต้องเขียนกำกับว่ารวมใบยกเลิกไว้เท่าไหร่** ไม่งั้นคนเห็นยอดสูงผิดปกติแล้วไม่รู้ว่าทำไม
(แต่ซ่อนวงเล็บนั้นตอนอยู่แท็บยกเลิกเอง เพราะจะซ้ำกับตัวเลขหลัก)

**3. แท็บที่กรองได้แค่หน้าที่กำลังดู ห้ามปล่อยเงียบ**
ถ้าเซิร์ฟเวอร์ยังไม่มีตัวกรอง ให้เขียนบนจอตรง ๆ ว่ากรองแค่หน้านี้
ตัวนับใช้เลขทั้งชุดได้ แต่ต้องบอกว่าแถวที่เห็นไม่ใช่ทั้งหมด

**4. อย่าเอาตัวเลขจากแหล่งหนึ่ง ไปโชว์คู่กับของจากอีกแหล่งหนึ่ง**
เป็นตัวร่วมของทุกเคสที่เจอวันเดียวกัน 2 ก.ย. 2569 — ทั้งสามเคสจอ "ดูปกติทุกประการ":
· แท็บ "ยกเลิก (44)" กดแล้วได้ 0 แถว — ตัวนับกับตัวแถวคนละกติกา
· ปุ่มหมวด "โซ่ NEWWAVE 17" กดแล้วได้ 2 ตัว — ตัวนับนับจากทั้งคลัง แถวกรองจาก 400 แถวแรก
· แท็บ "ของหมด" นับทั้งคลังแต่กรองแค่ 50 แถวในหน้า
⇒ ถ้าตัวเลขกับรายการมาคนละที่ **ต้องบอกบนจอว่าต่างกันตรงไหน** หรือทำให้มาที่เดียวกัน
   ห้ามวางคู่กันเฉย ๆ เพราะคนอ่านจะเชื่อว่ามันคือชุดเดียวกันเสมอ
   (หมวดที่มีของ 462 ตัวแต่ดึงได้ 200 ⇒ ต้องเขียนว่า "มีทั้งหมด N แสดง M")

## วิธี deploy

ดูหัวข้อ "วิธี deploy" ใน README.md — สรุปสั้น: **push ขึ้น `main` แล้ว Netlify build เอง**
(ย้ายจาก Vercel มา Netlify ส.ค. 2026 — workflow เก่าที่ต้อง clone เป็น `gucut-next-authNN` ยกเลิกแล้ว)
