import { NextRequest, NextResponse } from 'next/server'
import { BILL_VENDORS } from '@/lib/vendors'
import { สรุปทุกเจ้า } from '@/lib/billreport'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// GET /api/bills/report?secret=<DRIVESYNC_SECRET>[&vendor=tiktok]
//
// 🔑 สร้าง 15 ก.ย. 2569 — ทีม AI ทำตารางความครบบิลไม่ได้ เพราะ /bills/* อยู่หลังกำแพงล็อกอิน
//    (ยิงแล้วได้ 401 ⇒ ช่อง "มีในคลังกี่ใบ" เป็น `—` ทั้งตาราง)
//    เส้นนี้ทำให้ไม่ต้องรบกวนท่านประธานเปิดเบราว์เซอร์ล็อกอินค้างไว้
//
// ⚠️ **อ่านอย่างเดียว ไม่คืนเนื้อไฟล์** — คืนแค่ ชื่อไฟล์ · เดือน · จำนวน
//    ใครได้รหัสไปก็โหลดบิลจากเส้นนี้ไม่ได้ (บิลมีชื่อ ที่อยู่ เลขภาษีของร้าน)
// ⚠️ ใช้ DRIVESYNC_SECRET ตัวเดียวกับ /api/bills/upload — ไม่ได้ลดความปลอดภัย
//    รหัสตัวนั้นเขียนไฟล์เข้าคลังได้อยู่แล้ว การให้อ่านจึงเบากว่าของเดิม
// ⚠️ ต้องอยู่ใน PUBLIC_PATHS ของ middleware ไม่งั้นโดน 401 ก่อนถึงโค้ดนี้
//    แล้วจะ **หน้าตาเหมือนรหัสผิด** ทั้งที่รหัสถูก
//
// 🔑 ใช้ตรรกะกลางจาก lib/billreport.ts — **ที่เดียวกับ /api/bills/status และหน้าจอ**
//    รอบแรกเขียนแยกกันแล้วตัวเลขไม่ตรงกับจอทันที (TikTok ส.ค. ได้ 9 ทั้งที่จอโชว์ 4)
//    เพราะใบที่ระบบสร้างเอง (GEN) ไม่มีเลขที่ใบในชื่อ ตัวคัดซ้ำจึงจับไม่ได้
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') ?? ''
  const required = process.env.DRIVESYNC_SECRET
  if (!required || secret !== required) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const only = req.nextUrl.searchParams.get('vendor')
  if (only && !BILL_VENDORS.some(v => v.id === only)) {
    return NextResponse.json({ error: `ไม่รู้จักผู้ให้บริการ: ${only}` }, { status: 400 })
  }

  const สรุป = await สรุปทุกเจ้า(only)
  const เก็บโดย = Object.fromEntries(BILL_VENDORS.map(v => [v.id, v.collect ?? null]))

  return NextResponse.json({
    หมายเหตุ: 'อ่านจากดัชนีที่แคชไว้ ไม่ได้ยิง Gmail · คัดซ้ำด้วยเลขที่ใบแล้ว ตัวเลขตรงกับที่จอแสดง',
    เจ้า: Object.fromEntries(สรุป.map(v => [v.id, { ...v, เก็บโดย: เก็บโดย[v.id] }])),
  })
}
