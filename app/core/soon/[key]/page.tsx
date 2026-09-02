// หน้าที่เมนูมีแล้วแต่ยังไม่ได้ทำเนื้อหา
//
// เจ้าของร้านสั่ง "ทำเมนูให้ครบ · รายละเอียดจะใส่ทีหลัง" (2 ก.ย. 2569)
// ⚠️ **ห้ามเป็นหน้าเปล่า** — ต้องบอกสามอย่างเสมอ: ยังไม่มีเนื้อหา · จะทำอะไร · ตอนนี้ไปทำที่ไหน
//    หน้าเปล่าทำให้คนใช้นึกว่าระบบพัง แล้วเสียเวลากดซ้ำหรือโทรถาม
import Link from 'next/link'
import { SOON } from '@/lib/zort-menu'

export default function SoonPage({ params }: { params: { key: string } }) {
  const info = SOON[params.key]

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-[620px]">
        <h1 className="text-[26px] leading-tight font-semibold text-gray-900">
          {info?.title ?? 'หน้านี้ยังไม่มีเนื้อหา'}
        </h1>

        <div className="mt-4 bg-white border border-gray-200 rounded-md p-5">
          <span className="inline-block text-[11.5px] font-semibold text-amber-800 bg-amber-100 rounded px-2 py-0.5">
            ยังไม่ได้ทำ
          </span>

          {info ? (
            <>
              <p className="text-[14px] text-gray-800 mt-3 leading-relaxed">{info.what}</p>
              {info.meanwhile && (
                <p className="text-[13px] text-gray-600 mt-3 leading-relaxed">
                  <b>ระหว่างนี้:</b> {info.meanwhile}
                </p>
              )}
            </>
          ) : (
            <p className="text-[14px] text-gray-700 mt-3 leading-relaxed">
              เมนูนี้มีไว้ให้เห็นภาพว่าระบบจะมีอะไรบ้าง แต่ยังไม่ได้ทำเนื้อหาข้างใน
            </p>
          )}

          <p className="text-[12.5px] text-gray-400 mt-4 leading-relaxed">
            เมนูถูกทำให้ครบตาม ZORT ก่อน เนื้อหาจะทยอยใส่ทีหลัง —
            หน้าที่ใช้ได้จริงแล้วจะไม่มีป้าย &quot;ยังไม่ได้ทำ&quot; และในแถบเมนูจะไม่จาง
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/"
            className="text-[13px] font-semibold text-white rounded-full px-5 py-2"
            style={{ background: '#1b3b73' }}
          >
            กลับหน้าภาพรวม
          </Link>
          <Link
            href="/core"
            className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-5 py-2 hover:bg-gray-50"
          >
            ดูความคืบหน้าโครงการแก่น
          </Link>
        </div>
      </div>
    </div>
  )
}
