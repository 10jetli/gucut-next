'use client'
// รายการโอนสินค้า — **ลอกจาก `zort-ui/31-zort-รายการโอนสินค้า-12196.jpg`**
// ผัง: ชื่อจอ → "จำนวน N รายการ | ตรวจสอบการนับสินค้าเข้า"
//      → ปุ่ม นำเข้าไฟล์ (Excel) · สร้างรายการโอนสินค้า → แถวค้นหา
//      → แท็บ ทั้งหมด · รอโอน · สำเร็จ
//      → ตาราง # · วันที่ · รายการ · ประเภท · จาก · ไป · สถานะ · ⋮
//
// ⚠️ **API ส่งรหัสคลังมา (NEW · KLD · ANJ) แต่ ZORT แสดงชื่อคลัง ("โกดัง")**
//    ⇒ ต้องแปลงด้วย list=warehouses ก่อนแสดง ไม่งั้นคนใช้เห็น "NEW" แล้วไม่รู้ว่าคืออะไร
//    ⚠️ แปลงไม่ได้ให้แสดงรหัสเดิม **ห้ามแสดงค่าว่าง** — รหัสที่อ่านไม่ออกยังดีกว่าช่องว่าง
// ⚠️ ช่อง "จาก" หรือ "ไป" ว่างเป็นเรื่องปกติของประเภท "ปรับ" (ปรับสต็อก ไม่ใช่โอนระหว่างคลัง)
//    ⇒ แสดง "-" เหมือน ZORT ไม่ใช่เขียนว่าข้อมูลหาย
// ⚠️ **ห้ามเอาไปรวมกับ stock_moves** — ตารางนั้นคือของที่ "เราปรับเอง"
//    ส่วนจอนี้คือกระจกของ ZORT · รวมกันเมื่อไหร่ = ตัดสต็อกสองรอบ
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, Pill, TableWrap, TH, TD,
  BtnGhost, LinkText, RowMenu, EmptyState, thaiDate,
} from '@/components/zort'

interface Row {
  number: string
  transferType?: string | number
  fromwarehousecode?: string
  towarehousecode?: string
  status?: string
  transferdate?: string
  reference?: string
  description?: string
}
interface Resp {
  skip?: string
  total: number
  oldest?: string
  note?: string
  limit?: number
  offset?: number
  byStatus?: { status: string; c: number }[]
  rows: Row[]
}

const PAGE = 50

// ชื่อสถานะดิบจาก ZORT — **แปลบนจอเท่านั้น** ค่าที่ส่งกลับ API ต้องเป็นค่าดิบ
const STATUS_TH: Record<string, string> = {
  Success: 'สำเร็จ',
  Pending: 'รอโอน',
  Voided: 'ยกเลิก',
}
const statusTh = (s?: string) => STATUS_TH[String(s ?? '')] ?? (s || 'ไม่ระบุ')
const statusTone = (s?: string) =>
  s === 'Success' ? 'green' : s === 'Voided' ? 'red' : s ? 'orange' : 'gray'

/** ประเภทรายการ — ⚠️ แปลเฉพาะค่าที่รู้แน่ ค่าที่ไม่รู้จักแสดงค่าดิบ ห้ามเดา
 *  เดาผิดที่ช่องนี้ = จอบอกว่า "โอนระหว่างคลัง" ทั้งที่เป็นการปรับสต็อก ซึ่งคนละเรื่อง */
const TYPE_TH: Record<string, string> = {
  Adjust: 'ปรับ',
  adjust: 'ปรับ',
  Transfer: 'โอน',
  transfer: 'โอน',
}
const typeTh = (t?: string | number) => {
  const k = String(t ?? '')
  return TYPE_TH[k] ?? (k || '—')
}

export default function CoreTransfersPage() {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<Resp | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [wErr, setWErr] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (off = 0, tabId = tab) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ list: 'transfers', limit: String(PAGE), offset: String(off) })
      if (tabId !== 'all') qs.set('status', tabId)
      if (q.trim()) qs.set('q', q.trim())
      const [tRes, wRes] = await Promise.all([
        fetch(`/api/web/core?${qs}`).then((r) => r.json()),
        fetch('/api/web/core?list=warehouses').then((r) => r.json()).catch(() => null),
      ])
      if (tRes?.error) throw new Error(tRes.error)
      setData(tRes)
      setOffset(off)
      const map: Record<string, string> = {}
      for (const w of (Array.isArray(wRes?.warehouses) ? wRes.warehouses : [])) {
        if (w?.code) map[String(w.code)] = String(w.name || w.code)
      }
      setNames(map)
      // ⚠️ ดึงชื่อคลังไม่ได้ = จอโชว์รหัสคลังดิบ ต้องบอก ไม่ใช่ปล่อยให้อ่านเป็นชื่อจริง
      setWErr(!wRes || !Array.isArray(wRes?.warehouses))
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [q, tab])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** รหัสคลัง → ชื่อคลัง · ไม่มีค่า = "-" (ปกติของประเภท "ปรับ") · แปลงไม่ได้ = โชว์รหัสเดิม */
  const wh = (code?: string) => {
    const c = String(code ?? '').trim()
    if (!c) return <span className="text-gray-400">-</span>
    return <span className="text-gray-700">{names[c] ?? c}</span>
  }

  const rows = data?.rows ?? []
  const shown = offset + rows.length
  const byStatus = Array.isArray(data?.byStatus) ? data!.byStatus! : []
  const countOf = (s: string) => byStatus.find((x) => x.status === s)?.c ?? 0

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="รายการโอนสินค้า"
        summary={
          data
            ? <>
              จำนวน {fmtNum(data.total)} รายการ{' | '}
              <Link href="/core/soon/stock-count" className="text-blue-600 hover:underline">ตรวจสอบการนับสินค้าเข้า</Link>
            </>
            : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            <Link href="/core/soon/product-import"
              className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
              นำเข้าไฟล์ (Excel)
            </Link>
            {/* โอนสินค้าจริงร้านทำที่เครื่องมือเดิมอยู่แล้ว ⇒ ปุ่มนี้พาไปของจริง ไม่ใช่หน้า soon */}
            <Link href="/catalog/index.html#trf"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              สร้างรายการโอนสินค้า
            </Link>
          </>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="เลขที่ใบโอน หรือคำอธิบาย"
        advanced={<LinkText onClick={() => load(0)}>ค้นหา</LinkText>}
      />

      {error && <ErrorBox title="ดึงรายการโอนสินค้าไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {data?.skip && (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-[13px] text-gray-500">{data.skip}</div>
      )}

      {data && !data.skip && (
        <>
          <Tabs
            // ZORT โชว์ ทั้งหมด · รอโอน (2) · สำเร็จ — แท็บที่เป็น 0 ก็ต้องโชว์
            tabs={[
              { id: 'all', label: 'ทั้งหมด', count: data.total },
              { id: 'Pending', label: 'รอโอน', count: countOf('Pending') },
              { id: 'Success', label: 'สำเร็จ', count: countOf('Success') },
            ]}
            active={tab}
            onChange={(id) => { setTab(id); load(0, id) }}
          />

          <TableWrap>
            <table className="w-full min-w-[860px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>วันที่</th>
                  <th className={TH}>รายการ</th>
                  <th className={TH}>ประเภท</th>
                  <th className={TH}>จาก</th>
                  <th className={TH}>ไป</th>
                  <th className={TH}>สถานะ</th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  q
                    ? <EmptyState cols={8} icon="🔍" title="ไม่พบใบโอนที่ค้นหา" detail="ลองพิมพ์เลขที่ใบให้สั้นลง" />
                    : <EmptyState cols={8} icon="🔄" title="ยังไม่มีใบโอนในแท็บนี้"
                        detail="ใบโอนดึงมาจาก ZORT — โอนของที่ ZORT หรือที่เครื่องมือโอนสินค้าแล้วรอบซิงก์ถัดไปจะเข้ามา" />
                )}
                {rows.map((r, i) => (
                  <tr key={`${r.number}-${i}`} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>{thaiDate(r.transferdate)}</td>
                    <td className={TD}><span className="text-gray-900 font-medium">{r.number}</span></td>
                    <td className={`${TD} text-gray-700`}>{typeTh(r.transferType)}</td>
                    <td className={TD}>{wh(r.fromwarehousecode)}</td>
                    <td className={TD}>{wh(r.towarehousecode)}</td>
                    <td className={TD}><Pill tone={statusTone(r.status)}>{statusTh(r.status)}</Pill></td>
                    <td className={`${TD} text-right`}>
                      <RowMenu
                        items={[
                          { label: 'คัดลอกเลขที่ใบ', onClick: () => { navigator.clipboard?.writeText(r.number).catch(() => {}) } },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white">
              <span className="text-[12px] text-gray-500">
                แสดง {fmtNum(offset + 1)}–{fmtNum(shown)} จาก {fmtNum(data.total)} รายการ
              </span>
              <div className="flex gap-2">
                <BtnGhost onClick={() => load(Math.max(0, offset - PAGE))} disabled={loading || offset === 0}>
                  ← ก่อนหน้า
                </BtnGhost>
                <BtnGhost onClick={() => load(offset + PAGE)} disabled={loading || shown >= data.total}>
                  ถัดไป →
                </BtnGhost>
              </div>
            </div>
          </TableWrap>

          {/* ⚠️ **ตัวเลขบนจอนี้น้อยกว่าที่ ZORT แสดง และต้องบอกว่าทำไม**
              ตรวจทีละประเภทแล้ว (3 ก.ย. 2569): โอน 28=28 · ยกมา 6,851=6,851 ·
              ประกอบ/แยกส่วน 0=0 · **ปรับ 5,317 แต่ API ส่งมา 5,123** ⇒ ขาด 194 ใบ
              ⇒ **API ของ ZORT เองไม่ส่งใบ "ปรับ" มาครบ ไม่ใช่ท่อเราพลาด**
              ⚠️ ห้ามเขียนเลข 12,196 ตามจอ ZORT เพราะเราไม่มี 194 ใบนั้นจริง ๆ —
                 เลขสวยแต่กดเข้าไปหาไม่เจอ แย่กว่าเลขน้อยกว่าที่บอกเหตุผลไว้ */}
          <div className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mt-2 leading-relaxed">
            เก็บจาก API ของ ZORT ได้ <b>{fmtNum(data.total)}</b> ใบ
            {data.oldest && <> ({thaiDate(data.oldest)} – ปัจจุบัน)</>} ·
            จอ ZORT เองแสดงมากกว่านี้ <b>194 ใบ</b> (ตรวจเมื่อ 3 ก.ย. 2569) —
            เป็นใบประเภท <b>ปรับ</b> ที่ API ของ ZORT ไม่ส่งออกมา <b>ไม่ใช่ข้อมูลตกหล่นฝั่งเรา</b>
            <br />
            ช่อง <b>จาก</b> หรือ <b>ไป</b> ว่างเป็นเรื่องปกติของประเภท &quot;ปรับ&quot;
            (ปรับสต็อกในคลังเดียว ไม่ได้โอนข้ามคลัง)
            {/* ⚠️ ดึงชื่อคลังไม่ได้ = ช่อง จาก/ไป เป็น "รหัสดิบ" ที่หน้าตาเหมือนชื่อคลัง
                ไม่บอก = คนอ่านนึกว่าคลังชื่อนั้นจริง ๆ แล้วไปหาคลังที่ไม่มีอยู่ */}
            {wErr && (
              <>
                <br />
                <b className="text-amber-700">ดึงชื่อคลังไม่สำเร็จรอบนี้</b> — ช่อง จาก/ไป
                จึงแสดงเป็น <b>รหัสคลัง</b> ไม่ใช่ชื่อ (กดรีเฟรชอีกครั้งได้)
              </>
            )}
            {data.note ? ` · ${data.note}` : ''}
          </div>
        </>
      )}
    </div>
  )
}
