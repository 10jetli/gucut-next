/* 🔴 **ตราประทับรุ่นที่ build** — ต้องฝังตอน build ไม่ใช่ไปอ่าน env ตอนถูกเรียก
   ที่มา 18 ก.ย. 2569: ผมทำเส้น /api/build ให้ตัวเฝ้า deploy อ่าน แล้วมันขึ้นเว็บจริง
   **แต่คืน `commit: null`** เพราะ Netlify ใส่ `COMMIT_REF` ให้ตอน build เท่านั้น
   ไม่ได้ส่งต่อเข้า runtime ของฟังก์ชัน
   ⇒ เส้นมีอยู่ แต่ตอบคำถามที่มันถูกสร้างมาเพื่อตอบไม่ได้
     = "มีของ ≠ ของใช้ได้จริงในบริบทที่มันจะถูกใช้" (กฎข้อ 1 ใน CLAUDE.md)
   ⚠️ ไม่มีค่า (เช่น build ในเครื่อง) ⇒ สตริงว่าง แล้วเส้นนั้นแปลงเป็น null พร้อมบอกที่มา */
const BUILD_ENV = {
  BUILD_COMMIT: process.env.COMMIT_REF || '',
  BUILD_BRANCH: process.env.BRANCH || '',
  BUILD_CONTEXT: process.env.CONTEXT || '',
  /* เวลาที่ build จริง — ตอบ "รุ่นที่วิ่งอยู่เก่าแค่ไหน" ซึ่ง servedAtUtc ตอบไม่ได้ */
  BUILD_AT: new Date().toISOString(),
}

/* 🔴 **ทำไม `distDir` ต้องเปลี่ยนได้ด้วย env** (เพิ่ม 24 ก.ย. 2569)
   บน g1 มี `test2-next.service` รัน **`next dev -p 3001` ในโฟลเดอร์นี้เอง** และ **ต้องเปิดไว้ตลอด**
   (จอทดสอบของท่านประธาน · มี `test-watch.timer` คอยเปิดกลับทุก 10 นาที)
   ⇒ `next build` ที่เขียน `.next/` ทับ **ทำให้ dev server ตอบ 500 "Cannot find module"**
   ⇒ ⇒ ด่าน `check-dev-running` จึงหยุด build ไว้ — ถูกต้องแล้ว **แต่ผลคือ build ไม่ได้เลยตราบใดที่ test2 เปิด**
   ✅ ทางออกที่ไม่ต้องปิดบริการใคร: **ให้ build เขียนคนละที่กับที่ dev เสิร์ฟอยู่**
      `NEXT_DIST_DIR=.next-verify npm run build`  ⇒ dev server ไม่ถูกแตะเลย
   ⚠️ ค่าเริ่มต้นต้องเป็น `.next` เสมอ — Netlify และ `next start` อ่านที่นั่น
      (เปลี่ยนค่าเริ่มต้นเมื่อไหร่ deploy พังทันที) */
const DIST_DIR = process.env.NEXT_DIST_DIR || '.next'

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: DIST_DIR,
  env: BUILD_ENV,
  images: {
    /* 🖼️ โฮสต์รูปสินค้าที่ยอมให้ตัวย่อรูปของ Next ดึงได้ (ใบ t_mu2u6eg6 "รูปต้องขึ้นทุกรหัส")
     *  📏 **วัดของจริงทั้งคลัง 16 ก.ย. 2569 — และตัวเลขแรกที่ผมใช้นั้นผิด**
     *     ถ้านับจากช่อง `imageFile` ของท่ออย่างเดียวจะได้ "ย่อแล้ว 172 · ยังไม่ย่อ 1,930"
     *     แต่จอไม่ได้ใช้ช่องนั้นช่องเดียว — มันใช้ **แผนที่ sku-images.json (2,337 คู่)** ก่อน
     *     ⇒ ของจริง: **จอขึ้นรูปได้แล้ว 2,204 รหัส · ไม่มีรูปเลย 468 · และไม่มีสักรหัสที่
     *        "ZORT มีรูปแต่จอขึ้นไม่ได้"** ⇒ งานที่เหลือคือ **ถ่ายรูป 468 รหัส** ไม่ใช่งานย่อรูป
     *  ⇒ ทางนี้จึงเป็น **ตาข่ายสำหรับรหัสใหม่** ที่ ZORT มีรูปแล้วแต่แผนที่ยังไม่ทันอัปเดต
     *  ⚠️ ห้ามเอา URL ดิบมาวางในตาราง (ไฟล์ละ ~2 MB × 50 แถว) ⇒ ให้ตัวย่อของ Next ย่อให้ก่อน */
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ibb.co' },
      { protocol: 'https', hostname: 'image.zort.co.th' },
      { protocol: 'https', hostname: 'cf.shopee.co.th' },
      { protocol: 'https', hostname: '**.slatic.net' },
    ],
  },
}

export default nextConfig
