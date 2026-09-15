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
          {/* 🔴 "ทำไม่ได้จริง" กับ "ยังไม่ได้ทำ" ต้องแยกป้ายให้ขาด
              ป้ายเดียวกัน = คนรอของที่ไม่มีวันมา และคนทำงานรอบหน้าไปลองซ้ำที่พิสูจน์แล้วว่าไม่มีทาง */}
          {/* 🔴 **สี่สถานะ ห้ามยุบ** — ยุบทีไรคนอ่านตัดสินใจผิดทุกที
              ① ทำแล้ว (เขียว) ② ทำไม่ได้จริง (แดง) ③ **ทำได้แต่รอคนตัดสิน (ฟ้า)** ④ ยังไม่ได้ทำ (เหลือง)
              ข้อ ③ เพิ่ม 14 ก.ย. 2569 เพราะ `shipping` ตกร่องระหว่างข้อ ② กับ ④:
              เส้นมีจริง (แดงคือโกหก) แต่กดแล้วรถมารับของจริง (เหลืองคือชวนให้คนมาทำต่อแบบไม่รู้ตัว) */}
          <span className={`inline-block text-[11.5px] font-semibold rounded px-2 py-0.5 ${
            info?.builtAt ? 'text-emerald-800 bg-emerald-100'
              : info?.impossible ? 'text-red-800 bg-red-100'
                : info?.awaitingDecision ? 'text-blue-800 bg-blue-100' : 'text-amber-800 bg-amber-100'
          }`}>
            {/* 🔴 **`impossibleScope: 'write'` = อ่านได้ แต่สร้าง/แก้ไม่ได้ — ป้ายต้องไม่พูดเหมาว่า "ทำไม่ได้"**
                   (เจอ 15 ก.ย. 2569 ตอนไล่ตรวจคู่ของ check-inherited)
                   คีย์ product-variant ติดธงนี้ และ **อ่านได้จริง** — จอ /core/variants ดึงข้อมูลสดจาก ZORT อยู่
                   แต่หน้านี้ขึ้นป้ายแดงว่า "ทำไม่ได้" เฉย ๆ ⇒ ขัดกับของที่ใช้งานอยู่จริงในระบบเดียวกัน
                   ⚠️ LedgerScreen อ่าน impossibleScope ถูกมาตั้งแต่แรก แต่หน้านี้ไม่ได้อ่าน
                      — บทเรียนซ้ำ: **บทเรียนที่แก้ไว้ทางหนึ่ง ไม่เดินไปหาพี่น้องของมันเอง** */}
            {info?.builtAt ? 'ทำเสร็จแล้ว — หน้านี้เลิกใช้'
              : info?.impossible
                ? (info.impossibleScope === 'write' ? 'สร้าง/แก้ไม่ได้ — แต่อ่านได้' : 'ทำไม่ได้ — ไม่ใช่ยังไม่ได้ทำ')
                : info?.awaitingDecision ? 'ทำได้ แต่รอท่านประธานตัดสิน — ไม่ใช่ทำไม่ทัน' : 'ยังไม่ได้ทำ'}
          </span>

          {/* ทำเสร็จแล้วต้องพาไปให้ถึง ไม่ใช่แค่บอกว่าเสร็จ — คนมาถึงหน้านี้เพราะกดลิงก์เก่า */}
          {info?.builtAt && (
            <p className="text-[14px] text-gray-800 mt-3 leading-relaxed">
              หน้านี้ทำเสร็จแล้ว ย้ายไปอยู่ที่{' '}
              <Link href={info.builtAt} className="text-blue-600 underline font-semibold">{info.builtAt}</Link>
              {' '}— ถ้ามาถึงหน้านี้แปลว่ายังมีลิงก์เก่าค้างอยู่ที่ไหนสักแห่ง ช่วยแจ้งด้วย
            </p>
          )}

          {info ? (
            <>
              <p className="text-[14px] text-gray-800 mt-3 leading-relaxed">{info.what}</p>
              {/* 🔴 **ประโยค "ต้อง Export Excel" เคยผูกตายตัวไว้กับ `impossible` — ผิด 16 จาก 19 หน้า**
                     (เจอ 14 ก.ย. 2569 ตอนจะติดป้ายปุ่มกลุ่มสินค้าชุด)
                     คีย์ที่มี impossible มี 19 อัน แต่ส่วนใหญ่ **ไม่มีข้อมูลอะไรให้ export**
                     (ล้างข้อมูลทั้งระบบ · เพิ่มสิทธิ์ · ตั้งค่าเอกสาร · วิธีชำระเงิน · Lead Time …)
                     ⇒ จอสั่งงานด่วนที่ไม่มีอยู่จริงให้คนไปทำ และสั่งเหมือนกันหมดทุกหน้า
                     ⇒ ตอนนี้แยกเป็นช่อง `exportByHand` ที่ต้องเขียนว่า **มีอะไรค้างอยู่เท่าไหร่**
                        ไม่มีของค้าง = ไม่มีประโยคนี้ */}
              {info.impossible && (
                <p className="text-[13px] text-red-900 bg-red-50 border border-red-200 rounded-md px-3 py-2.5 mt-3 leading-relaxed">
                  <b>{info.impossibleScope === 'write' ? 'สร้าง/แก้ไม่ได้เพราะ:' : 'ทำไม่ได้เพราะ:'}</b> {info.impossible}
                </p>
              )}

              {/* 🔴 **คำเตือนของค้างต้องไม่ผูกกับธง `impossible`** (แก้ 15 ก.ย. 2569)
                  เดิมวางไว้ในกล่องแดง ⇒ พอถอด `impossible` ของคีย์ `files` ออก
                  (เพราะ ZORT มีเส้นอ่านไฟล์แนบจริง) **คำเตือนเรื่องสลิป 376 ใบหายไปด้วยเงียบ ๆ**
                  ⇒ "ทำได้แล้ว" กับ "ยังต้องเซฟด้วยมือ" เป็นคนละคำถาม ห้ามผูกกัน
                     ของที่ยังต่อท่อไม่เสร็จก็ยังต้องเซฟมือก่อนปิดบัญชีอยู่ดี
                  ⚠️ นี่คือบั๊กตระกูลเดียวกับที่ใบนี้เกิดมาแก้ — และผมเพิ่งสร้างมันเองเมื่อกี้ */}
              {info.exportByHand && (
                <p className="text-[13px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3 py-2.5 mt-3 leading-relaxed">
                  📤 <b>มีของค้างอยู่ใน ZORT: {info.exportByHand}</b>
                  {' '}⇒ ต้อง <b>กด Export Excel ด้วยมือก่อนวันปิดบัญชี ZORT</b> ทำหลังปิดไม่ได้อีก
                </p>
              )}
              {info.awaitingDecision && (
                <p className="text-[13px] text-blue-900 bg-blue-50 border border-blue-200 rounded-md px-3 py-2.5 mt-3 leading-relaxed">
                  <b>รอการตัดสิน:</b> {info.awaitingDecision}
                  <br />
                  ⇒ อันนี้ <b>ไม่ต้องไปหาทางทำเพิ่ม</b> — ของพร้อมแล้ว ติดที่ต้องมีคนตัดสินใจ
                </p>
              )}
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
            style={{ background: '#4669e5' }}
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
