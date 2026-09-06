'use client'
// ตั้งค่า → ของที่คัดออกมาจาก ZORT (ภาพถ่าย) — จอดูของที่ ZORT ไม่เปิด API ให้ดึง
//
// 🔴 **ทั้งจอนี้เป็น "ภาพถ่าย ณ เวลาหนึ่ง" ไม่ใช่ข้อมูลสด**
//    ของพวกนี้ ZORT ไม่เปิดเส้นให้ดึง (ยิงตรวจแล้ว 6 ก.ย. 2569) ⇒ ฝั่งท่ออ่านจากหน้าจอ ZORT มาเก็บไว้
//    ⇒ **ทุกตารางต้องเขียน "เก็บเมื่อ" กับ "ช่วงที่ใช้เก็บ" ติดไว้เสมอ ห้ามซ่อน**
//    ไม่เขียน = อีกสองเดือนมันคือเลขเก่าที่หน้าตาเหมือนเลขสด แล้วคนเอาไปตัดสินใจเรื่องเงิน
//
// 🔴 **"ว่าง" ต้องเขียนว่า "ตรวจแล้วว่างจริง (ช่วง …)" ห้ามเขียน "0 รายการ" เฉย ๆ**
//    บทเรียนคืน 6 ก.ย. 2569: จอ ZORT ตั้งช่วงวันเริ่มต้นไว้แคบ (/Sell/list 7 วัน = 122 · 10 ปี = 26,030)
//    ⇒ "0 รายการ" ที่อ่านมาด้วยค่าเริ่มต้น อาจแปลว่า "0 ในช่วงสั้น ๆ" ไม่ใช่ "ไม่มีเลย"
//    ⇒ ฝั่งท่อจึงส่งธง emptyVerified มาให้ **แยกสองอย่างนี้ออกจากกัน**
//
// ⚠️ ข้อมูลชุดนี้มีเลขบัญชีธนาคารและยอดเงิน — เข้าได้เฉพาะคนที่ผ่านด่านรหัสหลังร้าน
//    (ท่อกลาง /api/web/* บังคับล็อกอินอยู่แล้ว และรหัสฝั่งเซิร์ฟเวอร์ไม่เคยหลุดถึงเบราว์เซอร์)
import { useCallback, useEffect, useState } from 'react'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { SKIP, isSkip } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, TableWrap, TH, TD, Pill } from '@/components/zort'

/** หนึ่งจอที่เก็บมาแล้ว — ชื่อฟิลด์ตามที่ฝั่งท่อประกาศไว้ 6 ก.ย. 2569
 *  ⚠️ ทุกช่องเป็น optional โดยตั้งใจ — ท่อรุ่นเก่า/รุ่นกำลังเปลี่ยนต้องไม่ทำให้จอพัง */
interface Saved {
  key?: string
  rows?: number
  expected?: number
  complete?: boolean
  emptyVerified?: boolean
  at?: string
}
interface ListResp { saved?: Saved[]; skip?: string; error?: string }

interface OneResp {
  head?: string[]
  rows?: (string | number | null)[][]
  source?: string
  at?: string
  emptyVerified?: boolean
  skip?: string
  error?: string
}

/** ชื่อไทยของแต่ละจอ — ที่ไม่รู้จักให้โชว์ชื่อดิบ ไม่ใช่ซ่อน (จอใหม่ที่ท่อเพิ่มต้องโผล่เองได้) */
const SCREEN_TH: Record<string, string> = {
  wallet: 'กระเป๋าเงิน',
  branch: 'คลังสินค้า/สาขา',
  user: 'ผู้ใช้งาน',
  'category-order': 'หมวดหมู่ (พร้อมลำดับ)',
  income: 'รายได้อื่น',
  expense: 'รายจ่ายอื่น',
  transfer: 'รายการโอนเงิน',
}
const thName = (k?: string) => (k && SCREEN_TH[k]) || k || '(ไม่ทราบชื่อจอ)'

/** เวลาไทยแบบอ่านออก — ค่าที่อ่านไม่ได้ต้องไม่พังและต้องไม่แกล้งเป็นวันนี้ */
function thaiTime(iso?: string) {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const d = new Date(t + 7 * 3600e3)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear() + 543} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} น.`
}

export default function ZortArchivePage() {
  const [list, setList] = useState<Saved[] | null>(null)
  const [pick, setPick] = useState('')
  const [one, setOne] = useState<OneResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [oneLoading, setOneLoading] = useState(false)
  const [error, setError] = useState('')
  const [oneError, setOneError] = useState('')

  const loadList = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/web/zort-archive')
      const d: ListResp = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      if (d?.skip) throw new Error(SKIP + d.skip)
      /* ไม่มีช่อง saved = ตอบมาไม่ครบ ไม่ใช่ "ยังไม่เคยเก็บอะไรเลย" (กติกาเดียวกับทั้งระบบ) */
      if (!('saved' in d)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มีรายการที่เก็บไว้)')
      setList(Array.isArray(d.saved) ? d.saved : [])
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setList(null)
    } finally { setLoading(false) }
  }, [])

  const loadOne = useCallback(async (key: string) => {
    setPick(key); setOne(null); setOneError(''); setOneLoading(true)
    try {
      const res = await fetch(`/api/web/zort-archive?screen=${encodeURIComponent(key)}`)
      const d: OneResp = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error ?? `HTTP ${res.status}`)
      if (d?.skip) throw new Error(SKIP + d.skip)
      if (!('rows' in d)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มีตารางข้อมูล)')
      setOne(d)
    } catch (e) {
      setOneError(String(e instanceof Error ? e.message : e))
    } finally { setOneLoading(false) }
  }, [])

  useEffect(() => { loadList() }, [loadList])

  const rows = Array.isArray(one?.rows) ? one!.rows : []
  const head = Array.isArray(one?.head) ? one!.head : []

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ของที่คัดออกมาจาก ZORT"
        summary={
          error
            ? (isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' : 'ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง')
            : <>ของที่ ZORT <b>ไม่เปิด API ให้ดึง</b> (ยิงตรวจ 6 ก.ย. 2569) — คัดจากหน้าจอ ZORT มาเก็บไว้เอง{' | '}
              <span className="text-gray-400">ทุกตารางในจอนี้เป็น <b>ภาพถ่าย</b> ไม่ใช่ข้อมูลสด</span></>
        }
        actions={<BtnGhost onClick={loadList} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      {/* 🔴 คำเตือนนี้ห้ามถอด — เป็นเหตุผลเดียวที่ทำให้ตัวเลขในจอนี้ปลอดภัยพอจะโชว์ */}
      <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
        ⏳ <b>ตัวเลขทุกตัวในจอนี้คือภาพถ่าย ณ เวลาที่เก็บ ไม่ใช่ยอดปัจจุบัน</b> —
        ของจริงอยู่ใน ZORT และเปลี่ยนได้ตลอดเวลาโดยที่จอนี้ไม่รู้
        <br />
        ⇒ ใช้ดูโครงสร้างและใช้เทียบตอนย้ายระบบได้ · <b>อย่าใช้ตัดสินใจเรื่องเงินโดยไม่เปิด ZORT ดูก่อน</b>
      </div>

      {error && <ErrorBox title="ดึงรายการที่เก็บไว้ไม่ได้">{error}</ErrorBox>}
      {loading && !list && <LoadingState />}

      {list && list.length === 0 && (
        <p className="text-[13px] text-gray-500">ยังไม่มีจอไหนถูกเก็บ</p>
      )}

      {list && list.length > 0 && (
        <TableWrap>
          <table className="w-full min-w-[720px]">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              <th className={TH}>จอ</th><th className={TH}>จำนวนที่เก็บได้</th><th className={TH}>ครบไหม</th><th className={TH}>เก็บเมื่อ (เวลาไทย)</th><th className={TH}> </th>
            </tr>
          </thead>
          <tbody>
            {list.map((s, i) => {
              const when = thaiTime(s.at)
              return (
                <tr key={s.key || i} className="border-t border-gray-100">
                  <td className={TD}><b>{thName(s.key)}</b> <span className="text-gray-400 text-[11.5px]">{s.key}</span></td>
                  <td className={TD}>
                    {/* 🔴 ว่างที่ "ตรวจแล้ว" กับว่างที่ "ยังไม่รู้" ต้องเขียนคนละแบบ */}
                    {s.emptyVerified
                      ? <span className="text-gray-600">ตรวจแล้วว่างจริง</span>
                      : typeof s.rows === 'number'
                        ? <>{fmtNum(s.rows)}{typeof s.expected === 'number' ? <span className="text-gray-400"> / {fmtNum(s.expected)}</span> : null}</>
                        : <span className="text-gray-300">ไม่รู้</span>}
                  </td>
                  <td className={TD}>
                    {s.complete === true ? <Pill tone="green">ครบ</Pill>
                      : s.complete === false ? <Pill tone="orange">ยังไม่ครบ</Pill>
                        : <span className="text-gray-300">—</span>}
                  </td>
                  {/* ⚠️ ไม่มีเวลา = เขียนว่าไม่รู้ ห้ามเว้นว่างให้เดาเอง */}
                  <td className={TD}>{when ?? <span className="text-gray-300">ไม่รู้ว่าเก็บเมื่อไหร่</span>}</td>
                  <td className={TD}>
                    <button onClick={() => loadOne(String(s.key ?? ''))}
                      disabled={!s.key}
                      className="text-[12.5px] text-blue-600 hover:underline disabled:text-gray-300">
                      เปิดดู
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          </table>
        </TableWrap>
      )}

      {pick && (
        <div className="mt-5">
          <p className="text-[14px] font-bold text-gray-800 mb-1.5">{thName(pick)}</p>

          {oneError && <ErrorBox title={`เปิด "${thName(pick)}" ไม่ได้`}>{oneError}</ErrorBox>}
          {oneLoading && <LoadingState />}

          {one && (
            <>
              {/* 🔴 สองบรรทัดนี้คือหัวใจของจอ — เก็บเมื่อไหร่ และเก็บด้วยช่วงไหน */}
              <p className="text-[12px] text-gray-500 mb-2 leading-relaxed">
                📸 เก็บเมื่อ <b>{thaiTime(one.at) ?? 'ไม่รู้'}</b>
                {one.source ? <> · ที่มา/ช่วงที่ใช้เก็บ: <b>{one.source}</b></>
                  : <> · <span className="text-amber-700">ไม่ได้บอกว่าเก็บด้วยช่วงไหน — ตัวเลขนี้เทียบกับอะไรไม่ได้</span></>}
              </p>

              {one.emptyVerified && rows.length === 0 && (
                <p className="text-[13px] text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5">
                  ✅ <b>ตรวจแล้วว่างจริง</b> — เปิดช่วงวันกว้างแล้วยังไม่มีรายการ
                  {one.source ? <> ({one.source})</> : null}
                  <br />
                  <span className="text-gray-500">ต่างจาก &ldquo;0 รายการ&rdquo; เฉย ๆ ซึ่งอาจแปลว่าดูด้วยช่วงวันที่แคบเกินไป</span>
                </p>
              )}

              {!one.emptyVerified && rows.length === 0 && (
                <p className="text-[13px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5">
                  ⚠️ ไม่มีแถวในภาพถ่ายนี้ และ<b>ยังไม่ได้ยืนยันว่าว่างจริง</b> —
                  อาจเก็บด้วยช่วงวันที่แคบเกินไป <b>อย่าเพิ่งสรุปว่าไม่มีข้อมูล</b>
                </p>
              )}

              {rows.length > 0 && (
                <TableWrap>
                  <table className="w-full min-w-[720px]">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      {(head.length > 0 ? head : rows[0].map((_, i) => `คอลัมน์ ${i + 1}`))
                        .map((h, i) => <th key={i} className={TH}>{String(h)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {(Array.isArray(r) ? r : []).map((c, j) => (
                          <td key={j} className={TD}>{c === null || c === undefined || c === ''
                            ? <span className="text-gray-300">-</span>
                            : String(c)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </TableWrap>
              )}
            </>
          )}
        </div>
      )}

      <p className="text-[11.5px] text-gray-400 mt-4 leading-relaxed">
        ⚠️ ของในจอนี้ถูกคัดมาด้วยมือจากหน้าจอ ZORT เพราะ <b>ZORT ไม่เปิด API ให้ดึง</b> (ยิงตรวจ 6 ก.ย. 2569) ·
        เก็บไว้เพื่อว่าวันที่เลิกใช้ ZORT แล้ว ของพวกนี้จะไม่หายไปพร้อมกัน ·
        <b> ไม่ใช่ระบบที่อัปเดตเอง</b> — อยากได้ของใหม่ต้องเก็บใหม่
      </p>
    </div>
  )
}
