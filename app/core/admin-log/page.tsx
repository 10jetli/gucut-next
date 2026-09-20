'use client'
/* สมุดคำสั่งที่ทำผ่านหลังร้าน — ขั้นที่ 1 (จดเวลา · เส้น · อ้างอิง)
 *
 * 🔴 **ที่มา 21 ก.ย. 2569 (ใบ S3)** — เทียบเมนู ZORT แล้วพบว่าเขามีสมุด `Log (ผู้ใช้)`
 *    (`วันที่ · ผู้ใช้งาน · รายละเอียด` · 40 แถวในหน้าแรก) ส่วน **ฝั่งเราไม่มีเลย**
 *    ⇒ วันที่มีคนถามว่า *"ใครแก้ใบนี้"* ZORT ตอบได้ · เราตอบไม่ได้
 *
 * 🔑 **ทำไมจอนี้ไม่มีคอลัมน์ "ผู้ใช้"** — ฝั่งท่อชี้ก่อนเริ่มทำ:
 *    หลังร้านของเรามี **กุญแจแอดมินดอกเดียว** ⇒ ถ้าลอก ZORT ตรง ๆ จะได้
 *    **คอลัมน์ที่ไม่มีวันมีค่า** ⇒ เข้าคลาส *ช่องที่เว้นว่างคือคำกล่าวอ้าง*
 *    ⇒ ⇒ ขั้นที่ 1 จึงจด **เวลา · เส้น · วิธี · อ้างอิง · ผล** และ **เขียนบนจอว่ายังไม่รู้ว่าใครทำ**
 *
 * ⚠️ **สองบรรทัดที่ต้องอยู่บนจอเสมอ** (ฝั่งท่อกำหนด · ห้ามยุบเป็นบรรทัดเดียว):
 *    ① ยังไม่รู้ว่าใครทำ เพราะกุญแจดอกเดียว
 *    ② **ไม่ครอบการแก้ที่ทำใน ZORT โดยตรง** ⇒ ของที่แก้ในจอ ZORT ไม่เคยผ่านเส้นของเรา
 *    🔑 ข้อ ② สำคัญกว่าข้อ ① เพราะคนจะอ่านสมุดนี้ว่า "ประวัติทั้งหมดของร้าน"
 *
 * 🚫 **ห้ามคิด "เห็นครบไหม" เองจาก `แถวที่มี < เพดาน`** — ท่อส่งธง `เห็นครบทุกแถวไหม` มาให้แล้ว
 *    (ท่าคิดเองจะผิดวันที่ยอดรวมเท่าเพดานพอดี — ฝั่งท่อเตือนไว้ก่อนผมเขียนจอนี้)
 *
 * 📏 ยิงเช็คก่อนเขียนจอ (กฎ *จอที่เขียนจากสัญญาในจดหมาย ต้องยิงก่อนเชื่อ*):
 *    21 ก.ย. 2569 00:1x ⇒ ได้ `fallthrough: true` ⇒ **เส้นยังไม่ขึ้นบนของจริง**
 *    ⇒ จอนี้จึงต้องอ่านออกทั้งตอนที่เส้นยังไม่มี และตอนที่มีแล้ว
 */
import { useEffect, useState } from 'react'
import { PageHead } from '@/components/zort'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'

interface แถว {
  at?: string
  endpoint?: string
  method?: string
  ref?: string
  result?: string
  note?: string | null
}
interface Resp {
  ok?: boolean
  fallthrough?: boolean
  'ชั่วโมงย้อนหลัง'?: number
  'เพดานแถวที่ส่งกลับ'?: number
  'แถวที่มี'?: number
  'ทั้งหมดที่ตรงเงื่อนไข'?: number
  /** 🔑 สามสถานะ: `true` ครบ · `false` ไม่ครบ · **`null` = ยังไม่รู้** (ไม่ใช่ครบ) */
  'เห็นครบทุกแถวไหม'?: boolean | null
  'เก็บกี่วัน'?: number
  'อ่านสมุดไม่ได้'?: string
  '⚠️ ค่า hours ถูกปรับ'?: string | null
  รายการ?: แถว[]
  error?: string
}

/** ISO UTC → เวลาไทย (บวก 7) — ท่อส่ง UTC มาเสมอ */
function เวลาไทย(iso?: string): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const d = new Date(t + 7 * 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

const TH = 'px-3 py-2 text-left font-semibold text-gray-600'
const TD = 'px-3 py-2 align-top'

export default function AdminLogPage() {
  const [d, setD] = useState<Resp | null>(null)
  const [ผิด, setผิด] = useState('')
  const [ชั่วโมง, setชั่วโมง] = useState(24)

  useEffect(() => {
    let ทิ้งแล้ว = false
    setD(null); setผิด('')
    fetch(`/api/web/core?adminlog=1&hours=${ชั่วโมง}&limit=200`)
      .then((r) => r.json())
      .then((j: Resp) => { if (!ทิ้งแล้ว) setD(j) })
      .catch(() => { if (!ทิ้งแล้ว) setผิด('ยิงเส้นสมุดไม่สำเร็จ — ยังไม่รู้ว่ามีคำสั่งอะไรถูกจดบ้าง') })
    return () => { ทิ้งแล้ว = true }
  }, [ชั่วโมง])

  const รายการ = Array.isArray(d?.รายการ) ? d!.รายการ! : []
  const ครบ = d ? d['เห็นครบทุกแถวไหม'] : undefined

  return (
    <div className="p-3 md:p-4">
      <PageHead
        title="สมุดคำสั่งหลังร้าน"
        summary="จดทุกคำสั่งที่เปลี่ยนข้อมูล (ไม่ใช่การเปิดดู) — เวลาไทย"
        actions={
          <div className="flex items-center gap-1.5">
            {[24, 72, 168].map((h) => (
              <button
                key={h}
                onClick={() => setชั่วโมง(h)}
                className={`text-[13px] rounded-lg px-3 py-1.5 border ${
                  ชั่วโมง === h ? 'bg-[#4669e5] text-white border-[#4669e5]' : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                {h} ชม.
              </button>
            ))}
          </div>
        }
      />

      {/* ⚠️ สองบรรทัดนี้ต้องอยู่เสมอ ไม่ว่าจะมีข้อมูลหรือไม่ — เป็นขอบเขตของสมุด ไม่ใช่คำประกอบ */}
      <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
        ⚠️ <b>ยังไม่รู้ว่าใครทำ</b> — หลังร้านใช้กุญแจดอกเดียว สมุดนี้จึงไม่มีคอลัมน์ผู้ใช้
        <span className="block mt-0.5">
          ⚠️ <b>ไม่ครอบการแก้ที่ทำใน ZORT โดยตรง</b> — ของที่แก้ในจอ ZORT ไม่ผ่านเส้นของเรา จึงไม่ถูกจดที่นี่
        </span>
      </div>

      {ผิด && <ErrorBox>{ผิด}</ErrorBox>}
      {!d && !ผิด && <LoadingState />}

      {/* 🔴 เส้นยังไม่ขึ้น — ต้องแยกจาก "ไม่มีข้อมูล" ให้ขาด */}
      {d?.fallthrough && (
        <ErrorBox>
          เส้นสมุดยังไม่ขึ้นบนของจริง (ท่อรุ่นที่ให้บริการอยู่ยังไม่รู้จัก <code>?adminlog=1</code>)
          <span className="block mt-0.5 text-[12px]">
            ⇒ <b>ยังไม่รู้ว่ามีคำสั่งอะไรถูกจดบ้าง</b> — ไม่ใช่ว่าไม่มีคำสั่งเลย
          </span>
        </ErrorBox>
      )}

      {d?.['อ่านสมุดไม่ได้'] && (
        <ErrorBox>อ่านสมุดไม่ได้: {d['อ่านสมุดไม่ได้']} ⇒ <b>ยังไม่รู้</b> ไม่ใช่ว่าไม่มีคำสั่ง</ErrorBox>
      )}

      {d && !d.fallthrough && !d['อ่านสมุดไม่ได้'] && (
        <>
          <div className="text-[12px] text-gray-600 mb-2 leading-relaxed">
            ย้อนหลัง <b>{d['ชั่วโมงย้อนหลัง'] ?? '—'}</b> ชม. · เห็น <b>{d['แถวที่มี'] ?? รายการ.length}</b> แถว
            {typeof d['ทั้งหมดที่ตรงเงื่อนไข'] === 'number' && <> จากทั้งหมด <b>{d['ทั้งหมดที่ตรงเงื่อนไข']}</b></>}
            {typeof d['เก็บกี่วัน'] === 'number' && <> · เก็บย้อนหลัง <b>{d['เก็บกี่วัน']}</b> วัน (เก่ากว่านั้นถูกลบ)</>}
            {d['⚠️ ค่า hours ถูกปรับ'] && <> · <b>{d['⚠️ ค่า hours ถูกปรับ']}</b></>}
            {/* 🚫 ใช้ธงจากท่อ ไม่คิดเองจาก แถว<เพดาน */}
            {ครบ === false && (
              <span className="block text-amber-800">
                📏 <b>ยังเห็นไม่ครบ</b> — ตัวเลขข้างบนเป็นขอบล่าง (เส้นนี้มีเพดานแถว)
              </span>
            )}
            {ครบ === null && (
              <span className="block text-amber-800">
                📏 <b>ยังไม่รู้ว่าเห็นครบไหม</b> (ท่อนับยอดรวมไม่สำเร็จ) — ไม่ใช่ว่าเห็นครบ
              </span>
            )}
          </div>

          {รายการ.length === 0 ? (
            <div className="text-[13px] text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-3">
              ยังไม่มีคำสั่งไหนถูกจดในช่วงนี้ — สมุดอ่านได้ปกติ
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-[12.5px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className={TH}>เวลา (ไทย)</th>
                    <th className={TH}>คำสั่ง</th>
                    <th className={TH}>วิธี</th>
                    <th className={TH}>อ้างอิง</th>
                    <th className={TH}>ผล</th>
                    <th className={TH}>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {รายการ.map((r, i) => (
                    <tr key={`${r.at}-${r.ref}-${i}`} className="border-b border-gray-100 last:border-0">
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>{เวลาไทย(r.at)}</td>
                      <td className={`${TD} font-mono text-[11.5px] break-all`}>{r.endpoint || '—'}</td>
                      <td className={TD}>{r.method || '—'}</td>
                      {/* ref ว่างมาเป็น '' ไม่ใช่ null ⇒ แสดงขีด ไม่ใช่ช่องว่างที่อ่านเป็น "ไม่มีข้อมูล" */}
                      <td className={TD}>{r.ref ? r.ref : '—'}</td>
                      <td className={TD}>{r.result || '—'}</td>
                      <td className={`${TD} text-gray-500`}>{r.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
