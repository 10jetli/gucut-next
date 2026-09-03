'use client'
// รายการขาย → ใบเสนอราคา — **ลอกจาก `zort-ui/51-zort-ใบเสนอราคา.jpg`**
// ผัง ZORT: ชื่อจอ + "จำนวน 3 รายการ, มูลค่าทั้งหมด 102,784 บาท" → ปุ่ม นำเข้าไฟล์ (Excel) · สร้าง
//           → ค้นหา + ค้นหาขั้นสูง → แท็บ ทั้งหมด · อนุมัติแล้ว
//           → ตาราง: # · วันที่ · รายการ · ลูกค้า · ช่องทาง · มูลค่า · สถานะ
//
// 💡 **จอนี้ดึงสดจาก ZORT ไม่ทำกระจก** (ของ 3 แถวไม่ควรมีสำเนาให้ไม่ตรงกันได้)
//    ⇒ ต้องเขียนบนจอว่าเป็นข้อมูลสด เพราะจอพี่น้องข้าง ๆ อ่านจากคลังเงาทั้งหมด
//      คนใช้ต้องรู้ว่าจอไหนยิง ZORT จริง เวลา ZORT ล่มจะได้เข้าใจว่าทำไมจอนี้จอเดียวที่ว่าง
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, BtnGhost, SearchRow, LinkText, Tabs, TableWrap, TH, THR, TD, TDR,
  Pill, toneOfStatus, EmptyState, thaiDate,
} from '@/components/zort'

interface Row {
  number: string; customer?: string; phone?: string
  amount?: number; status?: string; date?: string; reference?: string
}
interface Resp { total?: number; live?: boolean; rows?: Row[]; note?: string }

// ⚠️ ZORT เขียนป้ายว่า "รออนุมัติ" กับ "อนุมัติแล้ว" ในจอนี้ — คนละคำกับจอรายการขาย
//    ค่าดิบเป็น Pending/Success เหมือนกัน แต่ความหมายในบริบทใบเสนอราคาคือการอนุมัติ
//    ⇒ แปลตามจอต้นแบบ ไม่ใช่แปลตามค่าดิบ
const STATUS_TH: Record<string, string> = {
  Pending: 'รออนุมัติ',
  Success: 'อนุมัติแล้ว',
  Voided: 'ยกเลิก',
}
const statusTh = (s?: string) => STATUS_TH[String(s ?? '')] ?? (s || 'ไม่ระบุสถานะ')

export default function QuotationsPage() {
  const [data, setData] = useState<Resp | null>(null)
  const [tab, setTab] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/web/core?list=quotations')
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setData(j)
    } catch (e) {
      setData(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const all = Array.isArray(data?.rows) ? data!.rows! : []
  const rows = all.filter((r) => {
    if (tab === 'approved' && r.status !== 'Success') return false
    const s = q.trim().toLowerCase()
    return !s || r.number.toLowerCase().includes(s) || (r.customer ?? '').toLowerCase().includes(s)
  })
  const sum = all.reduce((a, r) => a + (Number(r.amount) || 0), 0)
  /** ⚠️ **ตาข่ายกันวันข้างหน้า ไม่ใช่กันวันนี้** — ตอนนี้ร้านมีใบเสนอราคา 3 ใบ ยังไม่ชนอะไร
   *  แต่ท่อ `list` ทุกตัวตัดที่ 200 แถว และจอนี้ดึงครั้งเดียวไม่มีการแบ่งหน้า
   *  ⇒ วันไหนใบเสนอราคาเกิน 200 **ยอดรวมข้างบนจะเงียบ ๆ ต่ำกว่าจริง**
   *  บทเรียนจากจอรายงานยอดซื้อ: บรรทัดสรุปที่ถูก + ตารางที่ไม่ครบ อันตรายกว่าตัวเลขผิดตรง ๆ
   *  เพราะไม่มีอะไรดูขัดตา — ตาข่ายจึงต้องใส่**ก่อน**ถึงวันนั้น ไม่ใช่รอให้มีคนเจอ */
  const cut = Math.max(0, Number(data?.total ?? 0) - all.length)

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ใบเสนอราคา"
        summary={
          data
            ? (
              <>
                จำนวน {fmtNum(all.length)} รายการ, มูลค่าทั้งหมด {fmtMoney(sum)} บาท
                {' | '}
                {/* ⚠️ ต้องบอกว่าจอนี้ยิง ZORT สด ต่างจากจออื่นที่อ่านคลังเงา */}
                <span className="text-gray-400">
                  {data.live ? 'ดึงสดจาก ZORT ทุกครั้งที่เปิดจอ (ไม่ได้ทำสำเนา)' : 'อ่านจากคลังของเราเอง'}
                </span>
              </>
            )
            : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
            <Link href="/core/soon/quotation"
              className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
              นำเข้าไฟล์ (Excel)
            </Link>
            <Link href="/core/soon/quotation"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#1b3b73' }}>
              สร้าง
            </Link>
          </>
        }
      />

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => {}}
        placeholder="เลขรายการขาย ชื่อลูกค้า ช่องทางการขาย และอื่นๆ"
        advanced={<LinkText onClick={() => setQ('')}>ล้างคำค้น</LinkText>}
      />

      {error && <ErrorBox title="ดึงใบเสนอราคาไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}

      {data && (
        <>
          <Tabs
            tabs={[
              { id: '', label: 'ทั้งหมด', count: all.length },
              { id: 'approved', label: 'อนุมัติแล้ว', count: all.filter((r) => r.status === 'Success').length },
            ]}
            active={tab}
            onChange={setTab}
          />

          <TableWrap>
            <table className="w-full min-w-[780px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>วันที่</th>
                  <th className={TH}>รายการ</th>
                  <th className={TH}>ลูกค้า</th>
                  <th className={TH}>ช่องทาง</th>
                  <th className={THR}>มูลค่า</th>
                  <th className={TH}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyState cols={7} icon="📄" title="ไม่มีใบเสนอราคาในเงื่อนไขนี้"
                    detail={q || tab ? 'ลองล้างคำค้นหรือกลับไปแท็บทั้งหมด' : 'ยังไม่มีใบเสนอราคาใน ZORT'} />
                )}
                {rows.map((r, i) => (
                  <tr key={r.number} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className={`${TD} text-gray-400`}>{i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>
                      {r.date ? thaiDate(r.date) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={TD}><span className="text-gray-900 font-medium">{r.number}</span></td>
                    <td className={`${TD} max-w-[220px] truncate`} title={r.phone || ''}>
                      {r.customer || <span className="text-gray-300">-</span>}
                    </td>
                    {/* ZORT มีคอลัมน์ช่องทางแต่ทั้ง 3 ใบเป็นขีด — ไม่มีค่าให้แสดงจริง ๆ */}
                    <td className={TD}><span className="text-gray-300">-</span></td>
                    <td className={TDR}>{fmtMoney(Number(r.amount) || 0)}</td>
                    <td className={TD}><Pill tone={toneOfStatus(r.status ?? '')}>{statusTh(r.status)}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          {cut > 0 && (
            <p className="text-[12px] text-gray-600 bg-gray-50 border-t border-gray-200 px-4 py-2.5 leading-relaxed">
              ตารางนี้แสดง <b>{all.length}</b> จาก <b>{Number(data?.total ?? 0)}</b> ใบ
              — ขาดอีก <b>{cut}</b> ใบ (ท่อคืนได้สูงสุด 200 แถวต่อครั้ง และจอนี้ยังไม่มีการแบ่งหน้า)
              ⇒ <b>ยอดรวมด้านบนจึงต่ำกว่าความจริง</b>
            </p>
          )}

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            ⚠️ ป้ายสถานะจอนี้เขียนว่า <b>รออนุมัติ / อนุมัติแล้ว</b> ตามจอ ZORT —
            ค่าดิบเป็น Pending/Success ชุดเดียวกับใบขาย แต่ในบริบทใบเสนอราคาแปลว่า<b>การอนุมัติ</b>
            ไม่ใช่การส่งของ · <b>เบอร์ลูกค้าดูได้จากการชี้ค้างที่ชื่อ</b> ไม่แสดงตรง ๆ บนตาราง
          </p>
        </>
      )}
    </div>
  )
}
