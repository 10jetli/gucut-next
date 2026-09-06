'use client'
// ตั้งค่า → Webhook ของ ZORT (อ่านอย่างเดียว)
//
// ทำไมจอนี้สำคัญกว่าที่หน้าตามันดู:
// ทุกวันนี้ทั้งระบบ **นั่งถาม ZORT ทุกครึ่งชั่วโมง** (core-sync · beam-sweep · zort-order)
// ถ้า ZORT ยิง webhook มาหาเราได้ = รู้ทันทีที่ออเดอร์เปลี่ยนสถานะ ไม่ต้องถามซ้ำ ๆ ทั้งวัน
//
// 🔴 **จอนี้ไม่มีปุ่มตั้งค่า และห้ามเพิ่ม จนกว่าเจ้าของร้านจะสั่งเอง**
//    ฝั่งท่อตั้งใจไม่ทำเส้นเขียน เพราะ **ตัวเชื่อมมาร์เก็ตเพลส/ZORT Social อาจตั้ง URL ไว้อยู่แล้ว**
//    ตั้งทับ = ของที่ร้านใช้ทำงานทุกวันพังเงียบ ๆ โดยไม่มีอะไรฟ้อง
//    ⇒ ต้องเห็นค่าปัจจุบันก่อน แล้วให้คนตัดสิน ไม่ใช่ให้จอตัดสิน
//
// 🔴 **รูปคำตอบของ ZORT ยังไม่มีใครรู้** ⇒ จอนี้ **ไม่แกะฟิลด์ตามชื่อที่เดาเอง**
//    แสดงสิ่งที่ได้มาจริงทั้งก้อน + รายชื่อช่องที่มี
//    เดารูปแล้วอ่านไม่เจอ จะกลายเป็นข้อความ "ยังไม่ได้ตั้ง webhook"
//    ซึ่งชวนให้คนไปตั้งทับของเดิม — ความผิดพลาดที่แพงที่สุดของจอนี้
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost } from '@/components/zort'
import { fromExpectedEndpoint } from '@/lib/api-shape'

interface Resp {
  ok?: boolean
  resCode?: string | null
  fields?: string[] | null
  data?: unknown
  rawHead?: string | null
  error?: string
}

export default function ZortWebhookPage() {
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /** เส้นยังไม่ขึ้นเว็บ — ตอบ 200 พร้อมเนื้อหาอื่น ⇒ ต้องตรวจรูปร่าง ไม่ใช่ดูแค่รหัส 200 */
  const [notDeployed, setNotDeployed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotDeployed(false)
    try {
      const r: Resp = await fetch('/api/web/core?zortwebhook=1').then((x) => x.json())
      /* 🔴 พิสูจน์ก่อนว่าคำตอบมาจากเส้นที่ตั้งใจถาม — **ห้ามใช้ `ok` เป็นเครื่องพิสูจน์เดี่ยว ๆ**
         เส้นเกือบทุกเส้นส่ง ok:true เหมือนกันหมด · คำตอบหน้าแรกบังเอิญไม่มี ok
         แต่นั่นคือความบังเอิญ ไม่ใช่สัญญา (ดู lib/api-shape.ts) */
      if (!fromExpectedEndpoint(r, ['resCode', 'fields', 'rawHead', 'data'])) {
        setNotDeployed(true); setD(null); return
      }
      setD(r)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e)); setD(null)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="p-4 md:p-6 max-w-[900px]">
      <PageHead
        title="Webhook ของ ZORT"
        summary={
          <>
            ตอนนี้ ZORT ตั้งให้ยิงไปที่ไหนอยู่
            {' | '}
            <span className="text-gray-400">อ่านอย่างเดียว — ไม่มีปุ่มตั้งค่าโดยตั้งใจ</span>
          </>
        }
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'อ่านใหม่'}</BtnGhost>}
      />

      {/* 🔴 คำเตือนต้องอยู่เหนือข้อมูล ไม่ใช่ท้ายจอ — คนอ่านข้อมูลแล้วอาจรีบไปทำอะไรต่อ */}
      <div className="text-[12.5px] text-red-900 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-4 leading-relaxed">
        🔴 <b>ห้ามตั้งทับก่อนดูให้ชัดว่าใครใช้อยู่</b> — ZORT มีช่อง webhook ช่องเดียว
        {' '}และ<b>ตัวเชื่อมมาร์เก็ตเพลสกับ ZORT Social Commerce อาจตั้ง URL ไว้อยู่แล้ว</b>
        {' '}ตั้งทับ = ของที่ร้านใช้ทำงานทุกวันพังเงียบ ๆ ไม่มีอะไรฟ้อง
        <br />
        จอนี้จึง<b>อ่านอย่างเดียว</b> — จะเปลี่ยนต้องให้เจ้าของร้านตัดสินหลังเห็นค่าปัจจุบัน
      </div>

      {error && <ErrorBox title="อ่านค่า webhook ไม่ได้">{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && notDeployed && (
        <div className="text-[13px] text-amber-800 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 leading-relaxed">
          ⚠️ <b>เส้นอ่าน webhook ยังไม่ขึ้นเว็บ</b> — จอนี้จะมีข้อมูลเองหลัง deploy รอบถัดไป
          <br />
          <b>ไม่ได้แปลว่าไม่มี webhook ตั้งไว้</b> — แปลว่ายังอ่านไม่ได้เท่านั้น
        </div>
      )}

      {!loading && !error && d && (
        <>
          <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`text-[13px] font-semibold ${d.ok ? 'text-emerald-700' : 'text-amber-800'}`}>
                {d.ok ? '● ZORT ตอบกลับสำเร็จ' : '● ZORT ไม่ได้ตอบว่าสำเร็จ'}
              </span>
              {d.resCode && <span className="text-[12px] text-gray-500">resCode {d.resCode}</span>}
            </div>
            {!d.ok && (
              /* ⚠️ ไม่สำเร็จ ≠ ไม่มี webhook — ห้ามเขียนแทนกันเด็ดขาด (ดูเหตุผลหัวไฟล์) */
              <p className="text-[12.5px] text-gray-700 mt-1.5 leading-relaxed">
                <b>ไม่ได้แปลว่ายังไม่ได้ตั้ง webhook</b> — อาจเป็นเพราะรหัสร้านไม่มีสิทธิ์อ่านช่องนี้
                {' '}หรือ ZORT ตอบมาคนละรูปที่เราคาด · <b>อย่าใช้จอนี้เป็นหลักฐานว่าช่องว่าง</b>
              </p>
            )}
            {d.error && <p className="text-[12.5px] text-red-700 mt-1.5">{d.error}</p>}
          </div>

          {Array.isArray(d.fields) && d.fields.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
              <p className="text-[13px] font-semibold text-gray-800 mb-1">ช่องที่ ZORT ส่งกลับมาจริง</p>
              <p className="text-[12px] text-gray-600 font-mono break-words">{d.fields.join(' · ')}</p>
            </div>
          )}

          {/* 🔴 โชว์ของดิบทั้งก้อน — เพราะยังไม่มีใครรู้ว่ารูปคำตอบหน้าตายังไง
              วันที่มีคนมาแกะฟิลด์ จะได้แกะจากของจริงที่เห็นกับตา ไม่ใช่จากที่เดา */}
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <p className="text-[13px] font-semibold text-gray-800 mb-1.5">คำตอบดิบจาก ZORT</p>
            <pre className="text-[11.5px] text-gray-700 bg-gray-50 border border-gray-200 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words">
              {d.data != null ? JSON.stringify(d.data, null, 2) : (d.rawHead || '(ว่าง)')}
            </pre>
            {d.data == null && d.rawHead && (
              <p className="text-[11.5px] text-amber-800 mt-1.5">
                ⚠️ ZORT ตอบมาเป็นข้อความที่ไม่ใช่ JSON — แสดง 400 ตัวอักษรแรก
              </p>
            )}
          </div>

          <div className="text-[12.5px] text-blue-900 bg-blue-50 border border-blue-100 rounded-md px-3.5 py-2.5 mt-3 leading-relaxed">
            ℹ️ <b>ถ้าวันหนึ่งตั้ง webhook มาที่เราได้จริง จะได้อะไร</b> — ทุกวันนี้ระบบ
            <b> นั่งถาม ZORT ทุกครึ่งชั่วโมง</b> (ซิงก์ออเดอร์ · กวาดใบจ่ายเงิน · เช็คสถานะจัดส่ง)
            {' '}⇒ ช้าสุด 30 นาทีกว่าจะรู้ว่ามีอะไรเปลี่ยน · ถ้า ZORT ยิงมาบอกเอง จะรู้ในไม่กี่วินาที
            {' '}และเลิกยิงถามซ้ำทั้งวันได้
            <br />
            ⚠️ แต่ <b>ยังไม่มีใครยิงของจริง</b> — รู้แค่ว่าเส้นมีอยู่ ยังไม่รู้ว่าส่งอะไรมาบ้าง
            {' '}ส่งบ่อยแค่ไหน หรือใช้ช่องนี้ร่วมกับคนอื่นได้ไหม
          </div>
        </>
      )}
    </div>
  )
}
