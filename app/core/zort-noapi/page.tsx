'use client'
// "ZORT ทำให้ได้แค่ไหนผ่าน API" — จอเดียวแทนหน้าเหตุผลรายเมนู
//
// ปิดหลายแถวในเช็คลิสต์ที่ลงท้ายว่า "ทำไม่ได้" ด้วยจอเดียว แทนที่จะเขียนเหตุผลซ้ำ 7 หน้า
//
// 🔴 **จอนี้ห้ามพิมพ์ผลยิงตรวจลงในตัวเองเด็ดขาด — ต้องดึงจาก ?zortnoapi=1 เสมอ**
//    วันที่ ZORT เปิด API เพิ่ม ข้อความที่พิมพ์ไว้จะกลายเป็นเท็จเงียบ ๆ โดยไม่มีอะไรฟ้อง
//    (คลาส stale-state — เจอมาแล้วหลายจุด รวมทั้งในไฟล์ต้นทางฝั่งท่อเอง)
//
// 🔴 **สามสถานะ ไม่ใช่สอง** — ห้ามเดาจาก "อยู่กองไหน"
//    ① ไม่มีเส้น (noApi) ② มีเส้นแต่ยังไม่เคยยิงจริง (canButNotBuilt + untested:true)
//    ③ ยิงผ่านแล้ว (canButNotBuilt ไม่มีธง untested)
//    ⚠️ ธงชื่อ untested **ไม่ใช่** tested โดยตั้งใจ ⇒ ฟิลด์หายไป = ตกไปทาง "ยังไม่พิสูจน์"
//       ไม่ใช่ทาง "ผ่านแล้ว" · จอนี้จึงอ่านค่าตรง ๆ ห้ามใส่ค่าตั้งต้นเอง
//
// ⚠️ **ขอบเขตของหลักฐาน: "ไม่พบภายใต้ชื่อที่ลอง" ไม่ใช่ "ไม่มีแน่นอน"**
//    บทเรียน 6 ก.ย. 2569: ยิง Quotation/UpdateQuotation ได้ 404 แล้วสรุปว่าแก้ไม่ได้ ⇒ ผิด
//    ของจริงชื่อ EditQuotation · เกือบทำให้ปิดงานทิ้ง 3 แถวที่ทำได้จริง
//    ⇒ จอต้องโชว์ทั้ง "ยิงชื่อไหนไปบ้าง" และ "ตัวคุมกลุ่ม" ให้คนอ่านชั่งน้ำหนักเองเป็น
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, Pill, thaiDate, EndpointMissing } from '@/components/zort'
import { coreJson } from '@/lib/api-shape'

interface Item { what?: string; at?: string; probe?: string; note?: string; untested?: boolean }
interface Method {
  how?: string; control?: string[]; nameShapes?: string[]; caveat?: string; at?: string
  read?: Record<string, string>
}
interface Resp {
  ok?: boolean
  noApi?: Item[]
  canButNotBuilt?: Item[]
  method?: Method
  error?: string
}

export default function ZortNoApiPage() {
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /** ⚠️ เส้นนี้ยังไม่ขึ้นเว็บ ≠ เรียกไม่สำเร็จ ≠ ไม่มีของ — สามอย่างนี้ต้องแยกกัน
   *     ของเดิมที่ยังไม่มีพารามิเตอร์นี้จะ **ตอบ 200 พร้อมเนื้อหาอย่างอื่น** (ตกไปทางเดิม)
   *     ⇒ ถ้าเช็คแค่ 200 จะได้จอว่างเปล่าที่ดูเหมือน "ไม่มีข้อจำกัดอะไรเลย" ซึ่งกลับหัวความจริง */
  const [notDeployed, setNotDeployed] = useState(false)
  /** ท่อรุ่นใหม่พอจะตัดสินได้ไหม (มีหัว x-core-build) — แยก 'ยังไม่ deploy' ออกจาก 'เส้นหาย' */
  const [known, setKnown] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotDeployed(false)
    try {
      const got = await coreJson<Resp>('/api/web/core?zortnoapi=1', ['noApi', 'canButNotBuilt', 'method'])
      setKnown(got.known)
      const r = got.data
      if (r?.error) throw new Error(r.error)
      /* 🔴 พิสูจน์ต้นทางก่อนตีความ — ใช้หัว x-core-build เป็นหลัก (ดู lib/api-shape.ts)
         แยก "ท่อยังไม่ deploy" ออกจาก "ท่อใหม่แล้วแต่เส้นหาย" ให้ขาด */
      if (!got.ok || !r) { setNotDeployed(true); setD(null); return }
      setD(r)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e)); setD(null)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const noApi = Array.isArray(d?.noApi) ? d!.noApi! : []
  const can = Array.isArray(d?.canButNotBuilt) ? d!.canButNotBuilt! : []
  const m = d?.method

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ZORT เปิดให้ทำอะไรผ่าน API บ้าง"
        summary={
          <>
            ทำไมบางเมนูของ ZORT ถึงยังไม่มีในหลังร้านนี้
            {' | '}
            <span className="text-gray-400">ดึงผลยิงตรวจจริงมาแสดง ไม่ใช่ข้อความที่พิมพ์ไว้</span>
          </>
        }
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      {error && <ErrorBox title="ดึงผลยิงตรวจไม่ได้">{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && notDeployed && (
        <EndpointMissing known={known} what="รายการที่ ZORT ไม่เปิดให้"
          effect="ไม่ได้แปลว่าไม่มีข้อจำกัด — แปลว่ายังอ่านรายการไม่ได้เท่านั้น" />
      )}

      {!loading && !error && d && (
        <>
          {/* ── ① ไม่มีเส้นให้เรียก ─────────────────────────────── */}
          <p className="text-[15px] font-semibold text-gray-800 mb-1">
            ZORT ไม่เปิดให้ทำผ่าน API <span className="text-gray-400 font-normal">({noApi.length} เรื่อง)</span>
          </p>
          <p className="text-[12px] text-gray-500 mb-2.5 leading-relaxed">
            รอไปก็ไม่มา — จนกว่า ZORT จะเปิดเส้นเพิ่ม · <b>ไม่ใช่ของที่เรายังไม่ได้ทำ</b>
          </p>
          <div className="space-y-2.5 mb-6">
            {noApi.length === 0 && (
              <p className="text-[13px] text-gray-400 bg-white border border-gray-200 rounded-md px-3.5 py-3">
                ไม่มีเรื่องไหนอยู่ในกองนี้
              </p>
            )}
            {noApi.map((it, i) => (
              <div key={`${it.what}-${i}`} className="bg-white border border-gray-200 rounded-md p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-[14px] font-medium text-gray-900">{it.what}</p>
                  <span className="flex items-center gap-2">
                    <Pill tone="red">ไม่มีเส้นให้เรียก</Pill>
                    {/* ⚠️ อายุหลักฐานต้องติดมาด้วย — ผลยิงตรวจเมื่อ 3 เดือนก่อนกับเมื่อวานนี้ น้ำหนักไม่เท่ากัน */}
                    {it.at && <span className="text-[11.5px] text-gray-400">ยิงตรวจ {thaiDate(it.at)}</span>}
                  </span>
                </div>
                {it.probe && (
                  <p className="text-[11.5px] text-gray-500 font-mono mt-1.5 leading-relaxed break-words">{it.probe}</p>
                )}
                {it.note && <p className="text-[12px] text-gray-600 mt-1.5 leading-relaxed">{it.note}</p>}
              </div>
            ))}
          </div>

          {/* ── ② มีเส้น แต่เรายังไม่ได้ทำ ───────────────────────── */}
          <p className="text-[15px] font-semibold text-gray-800 mb-1">
            ทำได้ แต่เรายังไม่ได้ทำ <span className="text-gray-400 font-normal">({can.length} เรื่อง)</span>
          </p>
          <p className="text-[12px] text-gray-500 mb-2.5 leading-relaxed">
            เส้นมีอยู่จริง สั่งได้ทุกเมื่อ — คนละเรื่องกับกองบน <b>อย่ายุบรวมกัน</b>
            {' '}(ยุบรวม = คนอ่านจะนั่งรอของที่ไม่มีวันมา)
          </p>
          <div className="space-y-2.5 mb-6">
            {can.length === 0 && (
              <p className="text-[13px] text-gray-400 bg-white border border-gray-200 rounded-md px-3.5 py-3">
                ไม่มีเรื่องไหนค้างอยู่ในกองนี้
              </p>
            )}
            {can.map((it, i) => (
              <div key={`${it.what}-${i}`} className="bg-white border border-gray-200 rounded-md p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-[14px] font-medium text-gray-900">{it.what}</p>
                  <span className="flex items-center gap-2">
                    {/* 🔴 อ่านจากธงตรง ๆ ห้ามเดาจากกอง · ธงเป็น untested ⇒ ไม่มีฟิลด์ = ถือว่ายิงผ่านแล้ว
                        แต่ถ้าฟิลด์หลุดหายทั้งชุด จอจะเผลอบอกว่า "ยิงผ่านแล้ว" ⇒ จึงเขียนข้อความ
                        ให้ต่างกันชัด และไม่ใช้สีเขียวกับ "ยิงผ่านแล้ว" จนกว่าจะมีวันที่กำกับ */}
                    {it.untested
                      ? <Pill tone="orange">มีเส้น · ยังไม่เคยยิงจริง</Pill>
                      : <Pill tone="blue">ยิงผ่านแล้ว</Pill>}
                    {it.at && <span className="text-[11.5px] text-gray-400">ยิงตรวจ {thaiDate(it.at)}</span>}
                  </span>
                </div>
                {it.probe && (
                  <p className="text-[11.5px] text-gray-500 font-mono mt-1.5 leading-relaxed break-words">{it.probe}</p>
                )}
                {it.note && <p className="text-[12px] text-gray-600 mt-1.5 leading-relaxed">{it.note}</p>}
              </div>
            ))}
          </div>

          {/* ── ③ หลักฐานตั้งอยู่บนอะไร ────────────────────────── */}
          {m && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <p className="text-[14px] font-semibold text-gray-800 mb-2">ผลข้างบนพิสูจน์มายังไง</p>
              {m.how && <p className="text-[12.5px] text-gray-700 leading-relaxed">{m.how}</p>}
              {m.read && (
                <ul className="text-[12px] text-gray-600 mt-2 space-y-1">
                  {Object.entries(m.read).map(([k, v]) => (
                    <li key={k}><code className="text-[11.5px] text-gray-500">{k}</code> = {v}</li>
                  ))}
                </ul>
              )}
              {Array.isArray(m.control) && m.control.length > 0 && (
                /* 🔴 ตัวคุมกลุ่มคือสิ่งที่ทำให้ผล 404 มีน้ำหนัก — ถ้าไม่มีตัวนี้
                   404 อาจแปลว่า "คีย์ผิด/ยิงผิดวิธี" ไม่ใช่ "ไม่มีเส้น" */
                <p className="text-[12px] text-gray-700 mt-2 leading-relaxed">
                  <b>ตัวคุมกลุ่ม</b> (เส้นที่รู้ว่ามีจริง ยิงด้วยวิธีเดียวกันแล้วตอบต่างออกไป):{' '}
                  <span className="font-mono text-[11.5px] text-gray-600">{m.control.join(' · ')}</span>
                </p>
              )}
              {Array.isArray(m.nameShapes) && m.nameShapes.length > 0 && (
                <p className="text-[12px] text-gray-700 mt-2 leading-relaxed">
                  <b>รูปชื่อที่ลองแล้ว</b>:{' '}
                  <span className="font-mono text-[11.5px] text-gray-600">{m.nameShapes.join(' · ')}</span>
                </p>
              )}
              {m.caveat && (
                <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mt-2.5 leading-relaxed">
                  ⚠️ <b>ขอบเขตของข้อสรุป:</b> {m.caveat}
                </p>
              )}
            </div>
          )}

          <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
            ⚠️ จอนี้<b>ไม่เก็บผลไว้ในตัวเอง</b> — ดึงจาก <code>?zortnoapi=1</code> ทุกครั้ง
            วันที่ ZORT เปิด API เพิ่ม จอจะเปลี่ยนตามเอง · ถ้าพิมพ์ผลไว้ในจอ
            วันนั้นข้อความจะกลายเป็นเท็จเงียบ ๆ โดยไม่มีอะไรฟ้อง
          </p>
        </>
      )}
    </div>
  )
}
