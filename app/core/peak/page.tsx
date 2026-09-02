'use client'
// สะพานส่งเอกสารขายเข้า PEAK — จอตรวจสถานะ + ซ้อมแปลงออเดอร์
//
// ทำไมต้องมี: ตอนนี้ ZORT เป็นสะพานส่งยอดขายเข้า PEAK ให้อยู่ · ตัด ZORT วันไหนบัญชีขาดทันที
// สะพานของเราเขียนเสร็จแล้ว (ฝั่งท่อหลังบ้าน) แต่ **ยังไม่เปิดใช้จริง** รอคีย์กับแพ็กเกจ PEAK
//
// ⚠️ **จอนี้ส่งเอกสารจริงไม่ได้โดยตั้งใจ** — มีแค่ "ตรวจการเชื่อมต่อ" กับ "ซ้อมแปลง"
//    เอกสารขายผูกกับบัญชีและภาษี ยิงผิดต้องตามยกเลิกทีละใบ
//    ฝั่งเซิร์ฟเวอร์ก็ไม่เปิดทางส่งจริงผ่าน URL เช่นกัน (ต้องตั้ง PEAK_LIVE + ตัวสั่งอีกชั้น)
// ⚠️ **ตัวเลขบัญชีที่ระบบเดาเอง ต้องติดป้ายว่าเดา** — ประเภทภาษี (ราคารวมภาษีแล้ว)
//    กับวิธีลงลูกค้ารายช่องทาง เป็นสองจุดที่ต้องให้บัญชีของร้านยืนยันก่อนเปิดใช้จริง
//    (บทเรียนเดียวกับ VAT ในหน้ารายละเอียดใบขาย)
import { useCallback, useState } from 'react'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnPrimary, BtnGhost, Pill, TableWrap, TH, THR, TD, TDR } from '@/components/zort'

interface PeakStatus { ready?: boolean; live?: boolean; note?: string; token?: string; error?: string }
interface DryProduct { code?: string; name?: string; quantity?: number; price?: number }
interface DrySample {
  issuedDate?: string; contactCode?: string; reference?: string
  vatType?: number; products?: DryProduct[]
}
interface DryRun {
  skip?: string
  dryRun?: boolean; ready?: boolean
  count?: number; incomplete?: number; sample?: DrySample
}
interface DryResp { day?: string; orders?: number; peak?: DryRun }

const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

export default function CorePeakPage() {
  const [status, setStatus] = useState<PeakStatus | null>(null)
  const [day, setDay] = useState(() => thaiDay(1))
  const [dry, setDry] = useState<DryResp | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const check = useCallback(async () => {
    setBusy('status')
    setError('')
    try {
      const res = await fetch('/api/web/core?peak=status')
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setStatus(d.peak ?? null)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setStatus(null)
    } finally {
      setBusy('')
    }
  }, [])

  const runDry = useCallback(async () => {
    setBusy('dry')
    setError('')
    try {
      const res = await fetch(`/api/web/core?peak=dry&day=${encodeURIComponent(day)}`)
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      setDry(d)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setDry(null)
    } finally {
      setBusy('')
    }
  }, [day])

  const peak = dry?.peak
  const sample = peak?.sample

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHead
        title="สะพานส่งเข้า PEAK"
        summary="ตรวจการเชื่อมต่อ และซ้อมแปลงออเดอร์เป็นใบแจ้งหนี้ — ยังไม่ส่งเอกสารจริง"
        actions={
          <BtnGhost onClick={check} disabled={!!busy}>
            {busy === 'status' ? 'กำลังตรวจ…' : 'ตรวจการเชื่อมต่อ'}
          </BtnGhost>
        }
      />

      <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-3 py-2 leading-relaxed">
        ⚠️ <b>จอนี้ส่งเอกสารเข้า PEAK จริงไม่ได้</b> ทำได้แค่ตรวจการเชื่อมต่อกับซ้อมแปลง —
        เอกสารขายผูกกับบัญชีและภาษี ยิงผิดต้องตามยกเลิกทีละใบ ·
        การเปิดใช้จริงต้องตั้งค่าฝั่งเซิร์ฟเวอร์อีกชั้น
      </div>

      {error && <ErrorBox title="เรียก PEAK ไม่สำเร็จ">{error}</ErrorBox>}

      {/* สถานะการเชื่อมต่อ */}
      <div className="bg-white border border-gray-200 rounded-md">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-[14px] font-bold text-gray-800">สถานะการเชื่อมต่อ</p>
        </div>
        <div className="px-4 py-4">
          {!status && <p className="text-[13px] text-gray-500">กดปุ่ม &quot;ตรวจการเชื่อมต่อ&quot; ด้านบน — ไม่สร้างเอกสารอะไรทั้งนั้น</p>}
          {status && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-[12.5px] text-gray-500 w-[150px]">ตั้งคีย์ครบหรือยัง</span>
                {status.ready
                  ? <Pill tone="green">ตั้งครบแล้ว</Pill>
                  : <Pill tone="orange">ยังไม่ได้ตั้ง</Pill>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[12.5px] text-gray-500 w-[150px]">โหมดส่งจริง</span>
                {status.live
                  ? <Pill tone="red">เปิดอยู่ — ส่งเอกสารจริง</Pill>
                  : <Pill tone="gray">ปิดอยู่ (ซ้อมเท่านั้น)</Pill>}
              </div>
              {status.token && (
                <div className="flex items-center gap-3">
                  <span className="text-[12.5px] text-gray-500 w-[150px]">คุยกับ PEAK ได้</span>
                  <Pill tone="green">ได้ token แล้ว</Pill>
                </div>
              )}
              {status.error && (
                <div className="flex items-start gap-3">
                  <span className="text-[12.5px] text-gray-500 w-[150px] shrink-0">ข้อผิดพลาด</span>
                  <span className="text-[12.5px] text-red-600 break-words">{status.error}</span>
                </div>
              )}
              {status.note && <p className="text-[12.5px] text-gray-500">{status.note}</p>}
            </div>
          )}
        </div>
      </div>

      {/* ซ้อมแปลง */}
      <div className="bg-white border border-gray-200 rounded-md">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <p className="text-[14px] font-bold text-gray-800">ซ้อมแปลงออเดอร์เป็นใบแจ้งหนี้</p>
          <div className="flex items-center gap-2">
            <input
              type="date" value={day} onChange={(e) => setDay(e.target.value)}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5"
            />
            <BtnPrimary onClick={runDry} disabled={!!busy}>
              {busy === 'dry' ? 'กำลังซ้อม…' : 'ซ้อมวันนี้'}
            </BtnPrimary>
          </div>
        </div>

        <div className="px-4 py-4">
          {busy === 'dry' && !dry && <LoadingState />}
          {!dry && busy !== 'dry' && (
            <p className="text-[13px] text-gray-500">
              เลือกวันแล้วกดซ้อม — ระบบจะแปลงออเดอร์ของวันนั้นเป็นใบแจ้งหนี้แล้วบอกว่าแปลงได้กี่ใบ
              ข้อมูลไม่ครบกี่ใบ <b>โดยไม่ส่งอะไรเข้า PEAK</b> · ซ้อมได้แม้ยังไม่มีคีย์
            </p>
          )}
          {peak?.skip && <p className="text-[13px] text-gray-500">{peak.skip}</p>}

          {peak && !peak.skip && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="border border-gray-200 rounded px-3 py-2.5">
                  <p className="text-[11.5px] text-gray-400">ออเดอร์วันที่ {dry?.day}</p>
                  <p className="text-[18px] font-bold text-gray-900">{fmtNum(dry?.orders ?? 0)} <span className="text-[12px] font-normal text-gray-400">ใบ</span></p>
                </div>
                <div className="border border-gray-200 rounded px-3 py-2.5">
                  <p className="text-[11.5px] text-gray-400">แปลงเป็นใบแจ้งหนี้ได้</p>
                  <p className="text-[18px] font-bold text-emerald-600">{fmtNum(peak.count ?? 0)} <span className="text-[12px] font-normal text-gray-400">ใบ</span></p>
                </div>
                <div className="border border-gray-200 rounded px-3 py-2.5">
                  <p className="text-[11.5px] text-gray-400">ข้อมูลไม่ครบ</p>
                  <p className={`text-[18px] font-bold ${(peak.incomplete ?? 0) > 0 ? 'text-red-500' : 'text-gray-900'}`}>
                    {fmtNum(peak.incomplete ?? 0)} <span className="text-[12px] font-normal text-gray-400">ใบ</span>
                  </p>
                </div>
              </div>

              {(peak.incomplete ?? 0) > 0 && (
                <div className="text-[12.5px] text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2 mb-4">
                  ⚠️ มีใบที่ข้อมูลไม่ครบ {fmtNum(peak.incomplete ?? 0)} ใบ (ไม่มีวันที่ ไม่มีรายการสินค้า
                  หรือจำนวนไม่เป็นบวก) — <b>ต้องแก้ให้หมดก่อนเปิดใช้จริง</b> ไม่งั้นบัญชีจะขาดใบ
                </div>
              )}

              {sample && (
                <>
                  <p className="text-[13px] font-semibold text-gray-700 mb-2">ตัวอย่างใบแรกที่แปลงได้</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 mb-3">
                    <div className="flex gap-3 py-1">
                      <span className="text-[12.5px] text-gray-500 w-[110px] shrink-0">วันที่</span>
                      <span className="text-[12.5px] text-gray-800">{sample.issuedDate || '—'}</span>
                    </div>
                    <div className="flex gap-3 py-1">
                      <span className="text-[12.5px] text-gray-500 w-[110px] shrink-0">อ้างอิง</span>
                      <span className="text-[12.5px] text-gray-800">{sample.reference || '—'}</span>
                    </div>
                    <div className="flex gap-3 py-1">
                      <span className="text-[12.5px] text-gray-500 w-[110px] shrink-0">รหัสลูกค้า</span>
                      <span className="text-[12.5px] text-gray-800">
                        {sample.contactCode || '—'}
                        <span className="text-gray-400"> (ลงเป็นลูกค้ารายช่องทาง ไม่ใช่รายคน)</span>
                      </span>
                    </div>
                    <div className="flex gap-3 py-1">
                      <span className="text-[12.5px] text-gray-500 w-[110px] shrink-0">ประเภทภาษี</span>
                      <span className="text-[12.5px] text-gray-800">
                        {sample.vatType === 3 ? 'ราคารวมภาษีแล้ว' : String(sample.vatType ?? '—')}
                      </span>
                    </div>
                  </div>

                  <TableWrap>
                    <table className="w-full min-w-[520px]">
                      <thead className="border-b border-gray-200">
                        <tr>
                          <th className={TH}>รหัส</th>
                          <th className={TH}>ชื่อสินค้า</th>
                          <th className={THR}>จำนวน</th>
                          <th className={THR}>ราคาต่อหน่วย</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sample.products ?? []).map((p, i) => (
                          <tr key={`${p.code}-${i}`} className="border-b border-gray-100 last:border-0">
                            <td className={TD}>{p.code || '—'}</td>
                            <td className={TD}>{p.name || '—'}</td>
                            <td className={TDR}>{fmtNum(Number(p.quantity) || 0)}</td>
                            <td className={TDR}>{fmtNum(Number(p.price) || 0)}</td>
                          </tr>
                        ))}
                        {(sample.products ?? []).length === 0 && (
                          <tr><td colSpan={4} className="px-3 py-5 text-[13px] text-gray-400 text-center">ใบตัวอย่างไม่มีรายการสินค้า</td></tr>
                        )}
                      </tbody>
                    </table>
                  </TableWrap>
                </>
              )}

              <div className="text-[11.5px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-2.5 mt-4 leading-relaxed">
                <b>สองจุดที่ระบบตัดสินใจแทนไว้ ต้องให้บัญชีของร้านยืนยันก่อนเปิดใช้จริง</b>
                <br />
                1. <b>ประเภทภาษี</b> ตั้งเป็น &quot;ราคารวมภาษีแล้ว&quot; — ตัวเลขนี้เปลี่ยนความหมายยอดทั้งใบ
                <br />
                2. <b>รหัสลูกค้า</b> ลงเป็นรายช่องทาง (SHOPEE / LAZADA / TIKTOK / POS / WEB) ไม่ใช่รายคน
                เพราะมาร์เก็ตเพลสปิดบังชื่อผู้ซื้อ (เช่น &quot;อ******อ&quot;) ส่งเข้าไปแบบนั้น
                PEAK จะได้ลูกค้าใหม่วันละหลายสิบรายที่ชื่อเป็นดอกจัน ล้างทีหลังไม่ไหว
                <br />
                ถ้าบัญชีอยากได้รายคน ต้องเปลี่ยนวิธีก่อนเปิดใช้
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
