// เส้นบอก "รุ่นที่วิ่งจริงของจอ" — ไว้ให้ตัวเฝ้า deploy อ่านได้จากข้างนอก
//
// 🔴 **ที่มา 18 ก.ย. 2569** — วันนี้พิสูจน์กันแล้วว่า **push สำเร็จ ≠ ขึ้นเว็บ**
//    ช่วงต่อ git → Netlify พังตั้งแต่ 08:48 น. โดยไม่มีอะไรฟ้อง · ฝั่งท่อมีหัว `x-core-build`
//    ให้เทียบว่า "ของที่วิ่งอยู่ใหม่กว่าเวลา commit หรือยัง" **แต่ฝั่งจอไม่มีอะไรให้เทียบเลย**
//    ⇒ ตัวเฝ้า `deploy-watch.timer` จึงครอบได้แค่ repo ท่อ (ฝั่ง CEO บอกเองว่าติดข้อนี้)
//
// 🔑 **ทำไมต้องมาจากตัวเว็บที่วิ่งจริง ไม่ใช่จากเครื่องเรา**
//    บทเรียนใน CLAUDE.md: เทียบ hash ของ chunk ที่ build ในเครื่อง **ใช้ไม่ได้**
//    เพราะ hash ของ Next ไม่ reproducible ข้ามเครื่อง ⇒ ต่างทั้งที่โค้ดชุดเดียวกัน
//    ⇒ ของที่เชื่อได้คือค่าที่ **ตัวที่กำลังเสิร์ฟอยู่** ประกาศออกมาเอง
//
// ⚠️ **ไม่มีความลับในคำตอบนี้** — มีแต่เลข commit · ชื่อ branch · เวลา build · บริบท
//    (Netlify ใส่ค่าพวกนี้เป็น env ให้เองตอน build) 🚫 ห้ามเติม env อื่นลงไปเด็ดขาด
//
// ⚠️ **ไม่มีค่า = "ยังไม่รู้" ไม่ใช่ "ยังไม่ได้ deploy"** — รันในเครื่อง (`next dev`) ก็ไม่มีค่าเหมือนกัน
//    ⇒ คืน null พร้อม `source` ให้คนอ่านแยกออกว่าอ่านมาจากไหน
//
// 🔒 **ทำไมต้องมีรหัส ทั้งที่ข้างในไม่มีความลับ**
//    ตัวเฝ้าที่รันบน g1 เข้าไม่ถึงคุกกี้ล็อกอินของเว็บ ⇒ ต้องยกเว้นจากด่านล็อกอิน
//    แต่ "ยกเว้นด่าน" กับ "เปิดสาธารณะ" คนละเรื่อง ⇒ เส้นนี้ตรวจ `DRIVESYNC_SECRET` เอง
//    (ท่าเดียวกับ /api/bills/dupcheck · และด่าน check-secret-routes บังคับว่า
//     เส้นที่ตรวจรหัสเองต้องอยู่ใน PUBLIC_PATHS ด้วย ไม่งั้นคนมีรหัสจะโดนด่านล็อกอินปัดก่อน)
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const required = process.env.DRIVESYNC_SECRET
  if (!required || req.nextUrl.searchParams.get('secret') !== required) {
    /* ⚠️ ตอบสั้นและเหมือนกันทุกกรณีที่ไม่ผ่าน — ไม่บอกว่าเพราะไม่มี env หรือรหัสผิด */
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  /* อ่านตอนถูกเรียก (ไม่ใช่ตอน import) — Netlify ใส่ค่าให้ตั้งแต่ build และคงอยู่ในฟังก์ชัน */
  const commit = process.env.COMMIT_REF || null
  const branch = process.env.BRANCH || null
  const context = process.env.CONTEXT || null

  return NextResponse.json({
    ok: true,
    /** เลข commit ที่ถูก build เป็นรุ่นนี้ · null = ไม่รู้ (เช่นรันในเครื่อง) */
    commit,
    /** 7 ตัวแรก ไว้เทียบกับ `git log --oneline` ด้วยตาได้เร็ว ๆ */
    short: commit ? commit.slice(0, 7) : null,
    branch,
    context,
    /* 🔴 เวลานี้คือ **เวลาที่ตอบคำขอ** ไม่ใช่เวลาที่ build
       ⇒ ตั้งชื่อให้ตรงความหมาย ห้ามเรียกว่า buildAt เพราะคนจะเอาไปคิดอายุของรุ่นผิด */
    servedAtUtc: new Date().toISOString(),
    source: commit ? 'env ของ Netlify ตอน build' : 'ไม่มีค่าใน env — น่าจะรันนอก Netlify (เช่นในเครื่อง)',
  })
}
