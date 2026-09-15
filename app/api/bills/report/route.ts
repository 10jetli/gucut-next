import { NextRequest, NextResponse } from 'next/server'
import { BILL_VENDORS } from '@/lib/vendors'
import { loadBillIndexBlobs, listVendorBlobFiles } from '@/lib/billblobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// GET /api/bills/report?secret=<DRIVESYNC_SECRET>[&vendor=tiktok]
//
// 🔑 สร้าง 15 ก.ย. 2569 — ทีม AI ทำตารางความครบบิลไม่ได้ เพราะ /bills/* อยู่หลังกำแพงล็อกอิน
//    (คุณส้มยิงแล้วได้ 401 ทั้งตาราง ⇒ ช่อง "มีในคลังกี่ใบ" เป็น `—` หมด)
//    เดิมต้องให้ท่านประธานเปิดเบราว์เซอร์ล็อกอินค้างไว้บน g1 — เส้นนี้ทำให้ไม่ต้องรบกวนท่าน
//
// ⚠️ **อ่านอย่างเดียว และไม่คืนเนื้อไฟล์เลย** — คืนแค่ ชื่อไฟล์ · ขนาด · เดือน · จำนวน
//    ใครได้รหัสไปก็ยังโหลดบิลไม่ได้จากเส้นนี้ (บิลมีชื่อ ที่อยู่ เลขภาษีของร้าน)
// ⚠️ ใช้ DRIVESYNC_SECRET ตัวเดียวกับ /api/bills/upload — **ไม่ได้ลดระดับความปลอดภัย**
//    เพราะรหัสตัวนั้นเขียนไฟล์เข้าคลังได้อยู่แล้ว การให้อ่านจึงเบากว่าที่มีอยู่เดิม
// ⚠️ ต้องเพิ่ม path นี้ใน PUBLIC_PATHS ของ middleware ด้วย ไม่งั้นโดน 401 ตั้งแต่ยังไม่ถึงโค้ดนี้
//    แล้วจะ **หน้าตาเหมือนรหัสผิด** ทั้งที่รหัสถูก (บทเรียนเดิมในไฟล์ middleware 8 ก.ย. 2569)
//
// 🔑 อ่านจาก **ดัชนีที่แคชไว้** เท่านั้น — ไม่แตะ Gmail เลย
//    ⇒ ทีมยิงกี่รอบก็ได้ ไม่กินโควตา Gmail (บั๊ก 403 ที่เพิ่งแก้ไปวันนี้)
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') ?? ''
  const required = process.env.DRIVESYNC_SECRET
  if (!required || secret !== required) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const only = req.nextUrl.searchParams.get('vendor')
  const list = only ? BILL_VENDORS.filter(v => v.id === only) : BILL_VENDORS
  if (only && !list.length) {
    return NextResponse.json({ error: `ไม่รู้จักผู้ให้บริการ: ${only}` }, { status: 400 })
  }

  // ชื่อไฟล์เดียวกันอาจเข้ามาสองทาง (ตัวเก็บอัตโนมัติ + ไฟล์แนบอีเมล) ⇒ คัดซ้ำด้วยเลขที่ใบ
  // กติกาเดียวกับที่จอใช้ — ไม่งั้นตัวเลขในตารางความครบจะไม่ตรงกับที่ตาเห็น
  const เลขที่ใบ = (n: string) =>
    (n.match(/(THTT\d{6,}|FBADS-[\d-]{6,}|IN-\d{6,}|INV[-_]?\d{6,})/i)?.[1] ?? '').toUpperCase()

  const out: Record<string, any> = {}
  for (const v of list) {
    try {
      const idx = await loadBillIndexBlobs(v.id)
      const real = (await listVendorBlobFiles(v.id).catch(() => []))
        .map(f => f.name.match(/^(\d{4}-\d{2})_REAL_(.+)$/))
        .filter(Boolean) as RegExpMatchArray[]

      const เดือน: Record<string, { ชื่อไฟล์: string[]; ใบจริง: number }> = {}
      const เห็นแล้ว = new Set<string>()

      for (const m of real) {
        const b = (เดือน[m[1]] ??= { ชื่อไฟล์: [], ใบจริง: 0 })
        b.ชื่อไฟล์.push(m[2]); b.ใบจริง++
        const no = เลขที่ใบ(m[2]); if (no) เห็นแล้ว.add(no)
      }
      for (const e of idx?.entries ?? []) {
        const no = เลขที่ใบ(e.filename)
        if (no && เห็นแล้ว.has(no)) continue          // ซ้ำกับใบจริงแล้ว
        if (no) เห็นแล้ว.add(no)
        ;(เดือน[e.month] ??= { ชื่อไฟล์: [], ใบจริง: 0 }).ชื่อไฟล์.push(e.filename)
      }

      out[v.id] = {
        ชื่อ: v.name,
        ต้องมีทุกเดือน: !!v.everyMonth,
        ลิงก์ต้นทาง: v.portal ?? null,
        รวมทุกเดือน: Object.values(เดือน).reduce((a, b) => a + b.ชื่อไฟล์.length, 0),
        เดือน: Object.fromEntries(
          Object.entries(เดือน).sort(([a], [b]) => b.localeCompare(a))
            .map(([k, b]) => [k, { จำนวน: b.ชื่อไฟล์.length, ใบจริงที่อัปไว้: b.ใบจริง, ไฟล์: b.ชื่อไฟล์ }]),
        ),
        สแกนล่าสุด: idx?.lastScan ?? null,
      }
    } catch (e: any) {
      // 🔑 แยก "อ่านไม่ได้" ออกจาก "ไม่มีบิล" — ห้ามยุบเป็น 0
      out[v.id] = { ชื่อ: v.name, อ่านไม่ได้: String(e?.message ?? e).slice(0, 120) }
    }
  }

  return NextResponse.json({
    หมายเหตุ: 'อ่านจากดัชนีที่แคชไว้ ไม่ได้ยิง Gmail · ตัวเลขคัดซ้ำด้วยเลขที่ใบแล้ว ตรงกับที่จอแสดง',
    เจ้า: out,
  })
}
