'use client'
/* บัตรสต็อก (Stock Card) — ประวัติเข้า-ออกรายสินค้า · ใบกระดาน t_mu1i74cu
 *
 * ZORT มี `ExportStockCard()` ในจอรายการสินค้า · ของเราไม่เคยมีเลย (ช่องว่างข้อ 2 ที่ CEO ชี้)
 * เส้นท่อ: `?list=stockcard&sku=&kind=&from=&to=&offset=&limit=(≤500)` (gucut-web c30e3d4)
 *
 * ════════════════════════════════════════════════════════════════════════
 * 🔴 **ของที่ "ตั้งใจไม่มี" และห้ามเติมเอง** (ฝั่งท่อกำชับ 15 ก.ย. 2569)
 *  ① **ไม่มีคอลัมน์คงเหลือสะสม** — ใบปรับ/ยกมา/โอนของ ZORT ยังไม่อยู่ในกระจกรายสินค้า
 *     ⇒ คำนวณย้อนหลังได้ไม่ครบ ⇒ ตัวเลขจะ "ดูสมเหตุสมผลแต่ผิด" ซึ่งแย่กว่าไม่มีคอลัมน์
 *     ⚠️ **ห้ามทำคอลัมน์นี้** แม้จะบวกเองได้ง่าย ๆ ก็ตาม
 *  ② **ไม่มีคอลัมน์คลัง** — ท่อส่ง `warehouses: null` มาตรง ๆ
 *  ③ **ไม่รวมใบโอน/ยกมา/รอโอน** — ท่อบอกชื่อมาใน `missingKinds` ⇒ เอาขึ้นจอและลงไฟล์ตามที่ท่อบอก
 *     **ห้ามเขียนรายชื่อตายตัวในโค้ด** เพราะวันหนึ่งท่อเก็บเพิ่มแล้วจอจะโกหกค้างไว้
 * ════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ `qty` ติดลบ = ของออก · บวก = ของเข้า
 * ⚠️ **ห้ามตัดแถวที่หน้าตาเหมือนกัน** — ของจริงรหัส 00313 มีแถวซ้ำเป๊ะ 106 แถว
 *    และเป็นข้อมูลจริง (ใบเดียวมีหลายบรรทัดรหัสเดียวกัน) ⇒ ตัดซ้ำ = ยอดหายเงียบ ๆ
 */
import { useCallback, useEffect, useState } from 'react'
import { fmtNum, fmtMoney } from '@/lib/format'
import { TableWrap, TH, THR, TD, TDR, BtnGhost, EmptyState } from './index'
import ExportButton from './ExportButton'
import { SALE_STATUS, PURCHASE_STATUS, TRANSFER_STATUS, zortWord } from '@/lib/zort-words'
import type { ZortWord } from '@/lib/zort-words'

/* 🔤 **สถานะในบัตรสต็อกต้องแปลตามชนิดรายการ ไม่ใช่ชุดเดียวทั้งตาราง**
   ยิงของจริง 16 ก.ย. 2569 (740 แถวจาก 3 รหัส): ท่อส่ง `kind` เป็นไทยอยู่แล้ว ("ขาย" · "ซื้อ")
   แต่ `status` เป็นค่าดิบอังกฤษ — เจอ Success 736 · Pending 4 ⇒ เดิมจอขึ้นคำอังกฤษให้คนอ่าน
   🔴 ห้ามใช้ชุดคำเดียวทั้งตาราง เพราะ `Pending` **คนละคำกันตามชนิดใบ**
      (ใบขาย = "รอโอน" · ใบซื้อ = "รอโอนสินค้า" ตามที่ ZORT ใช้จริงในแต่ละจอ)
   ค่าที่ยังไม่รู้คำ zortWord จะคืนค่าดิบมาเอง ⇒ ติด title บอกว่าเป็นค่าที่ท่อส่งมา ไม่เดาคำแทน ZORT */
const KIND_WORDS: Record<string, Record<string, ZortWord>> = {
  'ขาย': SALE_STATUS,
  'ซื้อ': PURCHASE_STATUS,
  'โอน': TRANSFER_STATUS,
}
function statusText(kind?: string, status?: string): { text: string; known: boolean } {
  if (!status) return { text: '—', known: true }
  const map = KIND_WORDS[String(kind ?? '').trim()]
  if (!map) return { text: status, known: false }
  const w = zortWord(map, status)
  return { text: w.text, known: w.known }
}

interface CardRow {
  date?: string; kind?: string; status?: string
  ref?: string; party?: string
  qty?: number; amount?: number
}
interface Resp {
  total?: number
  counts?: Record<string, number>
  failed?: string[]
  hasMore?: boolean
  depthCapped?: boolean
  missingKinds?: string[]
  coverage?: string
  kinds?: { key: string; label: string }[]
  rows?: CardRow[]
  error?: string
}

const PAGE = 100

export default function StockCard({ sku }: { sku: string }) {
  const [kind, setKind] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const qsOf = useCallback((offset: number, limit: number) => {
    const qs = new URLSearchParams({ list: 'stockcard', sku, kind, limit: String(limit), offset: String(offset) })
    if (from) qs.set('from', from)
    if (to) qs.set('to', to)
    return qs.toString()
  }, [sku, kind, from, to])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const r = await fetch(`/api/web/core?${qsOf(0, PAGE)}`)
      const d: Resp = await r.json()
      if (!r.ok || d?.error) throw new Error(d?.error ?? `HTTP ${r.status}`)
      setData(d)
    } catch (e) {
      setData(null)
      setErr(String(e instanceof Error ? e.message : e))
    } finally { setLoading(false) }
  }, [qsOf])

  useEffect(() => { void load() }, [load])

  const rows = data?.rows ?? []
  const shown = rows.length
  const total = typeof data?.total === 'number' ? data.total : null
  const kinds = data?.kinds ?? [{ key: 'all', label: 'การเคลื่อนไหว' }]
  const failed = data?.failed ?? []

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-[15px] font-semibold text-gray-900">บัตรสต็อก (ประวัติเข้า-ออก)</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)}
            className="text-[12.5px] border border-gray-300 rounded-full px-3 py-1.5 bg-white">
            {kinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="text-[12.5px] border border-gray-300 rounded-md px-2 py-1.5 bg-white" aria-label="ตั้งแต่วันที่" />
          <span className="text-[12.5px] text-gray-400">ถึง</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="text-[12.5px] border border-gray-300 rounded-md px-2 py-1.5 bg-white" aria-label="ถึงวันที่" />
          <BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'ดูใหม่'}</BtnGhost>
          {/* 📤 ZORT มี ExportStockCard() — ของเราส่งออกครบทุกหน้าตามตัวกรองเดียวกับที่เห็น */}
          <ExportButton
            disabled={loading || !data}
            label="📤 ส่งออกบัตรสต็อก"
            spec={{
              filename: `บัตรสต็อก-${sku}`,
              scope: from || to ? `${from || 'เริ่มแรก'} ถึง ${to || 'ล่าสุด'}` : 'ทั้งหมดเท่าที่มี',
              title: `บัตรสต็อก ${sku}`,
              /* 🔴 หัวไฟล์ต้องบอกว่า **ไม่รวมอะไร** — ไฟล์ออกนอกระบบแล้วไม่มีใครย้อนมาถาม
                 ข้อความมาจากท่อ (`coverage` · `missingKinds`) ไม่ใช่เขียนตายตัวในโค้ด */
              note: [
                data?.coverage ?? '',
                data?.missingKinds?.length ? `ไม่รวม: ${data.missingKinds.join(' · ')}` : '',
                'จำนวนติดลบ = ของออก · ไม่มีคอลัมน์คลังและคอลัมน์คงเหลือสะสม (ท่อคำนวณย้อนหลังไม่ครบ)',
              ].filter(Boolean).join(' | '),
              filters: [
                ['ชนิดรายการ', kinds.find((k) => k.key === kind)?.label ?? kind],
                ['ตั้งแต่วันที่', from || '(ไม่จำกัด)'],
                ['ถึงวันที่', to || '(ไม่จำกัด)'],
              ],
              limit: 500,
              fetchPage: async (offset, limit) => {
                const r = await fetch(`/api/web/core?${qsOf(offset, limit)}`)
                const d: Resp = await r.json()
                if (!r.ok || d?.error) throw new Error(d?.error ?? `HTTP ${r.status}`)
                /* 🔴 เชื่อ `hasMore` ของท่อ ไม่ใช่เทียบ total เอง (ฝั่งท่อกำชับ)
                   และ **failed ไม่ว่าง / depthCapped ⇒ ห้ามเขียนหัวไฟล์ว่าครบ** */
                const problems: string[] = []
                if (d.failed?.length) problems.push(`ดึงข้อมูลบางแหล่งไม่สำเร็จ: ${d.failed.join(' · ')}`)
                if (d.depthCapped) problems.push('ชนเพดานความลึกของท่อ (5,000 แถว) — ลองแคบช่วงวันแล้วส่งออกทีละช่วง')
                return {
                  rows: Array.isArray(d.rows) ? d.rows : [],
                  total: typeof d.total === 'number' ? d.total : null,
                  done: d.hasMore === false,
                  problem: problems.length ? problems.join(' · ') : undefined,
                }
              },
              header: ['วันที่', 'ชนิดรายการ', 'สถานะ', 'เลขที่เอกสาร', 'คู่ค้า/ลูกค้า', 'จำนวน (ติดลบ = ออก)', 'มูลค่า (บาท)'],
              toRow: (r: CardRow) => [
                r.date ?? null, r.kind ?? null, r.status ?? null, r.ref ?? null, r.party ?? null,
                typeof r.qty === 'number' ? r.qty : null,
                typeof r.amount === 'number' ? r.amount : null,
              ],
            }}
          />
        </div>
      </div>

      {err && <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-2">ดึงบัตรสต็อกไม่ได้: {err}</div>}

      {/* 🔴 สิ่งที่ "ไม่มีในบัตรใบนี้" ต้องอยู่เหนือตาราง ไม่ใช่ท้ายจอ
          ตารางประวัติที่ไม่บอกว่าขาดอะไร จะถูกอ่านว่าเป็นประวัติทั้งหมดของสินค้าตัวนั้น */}
      {data && (
        <div className="text-[12px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3 py-2 mb-2 leading-relaxed">
          ⚠️ <b>บัตรนี้ยังไม่ใช่ประวัติทั้งหมดของสินค้า</b>
          {data.missingKinds?.length ? <> — ยังไม่รวม <b>{data.missingKinds.join(' · ')}</b></> : null}
          <br />
          <span className="text-amber-800">
            ไม่มีคอลัมน์ <b>คลัง</b> (ท่อไม่ส่งมา) และไม่มี <b>คงเหลือสะสม</b> —
            เพราะใบปรับ/ยกมา/โอนของ ZORT ยังไม่อยู่ในกระจกรายสินค้า คำนวณย้อนหลังแล้วจะได้เลขที่ดูน่าเชื่อแต่ผิด
          </span>
          {failed.length > 0 && (
            <><br /><span className="text-red-800">🔴 รอบนี้ดึงบางแหล่งไม่สำเร็จ ({failed.join(' · ')}) — ตัวเลขข้างล่างยังไม่ครบ</span></>
          )}
        </div>
      )}

      <TableWrap>
        <table className="w-full min-w-[720px]">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              <th className={TH}>วันที่</th>
              <th className={TH}>ชนิดรายการ</th>
              <th className={TH}>สถานะ</th>
              <th className={TH}>เลขที่เอกสาร</th>
              <th className={TH}>คู่ค้า / ลูกค้า</th>
              <th className={THR}>จำนวน</th>
              <th className={THR}>มูลค่า</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data && (
              <tr><td colSpan={7} className="px-3 py-4 text-[12.5px] text-gray-400">กำลังโหลดบัตรสต็อก…</td></tr>
            )}
            {data && rows.length === 0 && (
              <EmptyState cols={7} icon="🗃️" title="ไม่มีการเคลื่อนไหวในเงื่อนไขนี้"
                detail="ลองเปลี่ยนชนิดรายการหรือขยายช่วงวัน — และดูคำเตือนข้างบนว่าบัตรนี้ยังไม่รวมอะไร" />
            )}
            {rows.map((r, i) => (
              // ⚠️ คีย์ใช้ index เพราะแถวซ้ำกันเป๊ะได้จริง (106 แถวในรหัส 00313) ห้ามรวมแถว
              <tr key={i} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                <td className={`${TD} whitespace-nowrap`}>{r.date ?? '—'}</td>
                <td className={TD}>{r.kind ?? '—'}</td>
                <td className={TD}>
                  {(() => {
                    const w = statusText(r.kind, r.status)
                    return w.known
                      ? w.text
                      : <span className="text-gray-500" title={`ค่าที่ท่อส่งมา: ${r.status} (ยังไม่รู้คำที่ ZORT ใช้กับชนิดรายการนี้)`}>{w.text}</span>
                  })()}
                </td>
                <td className={`${TD} whitespace-nowrap`}>{r.ref ?? '—'}</td>
                <td className={TD}>{r.party ?? <span className="text-gray-300">—</span>}</td>
                <td className={`${TDR} ${Number(r.qty) < 0 ? 'text-red-500 font-semibold' : 'text-emerald-700'}`}>
                  {typeof r.qty === 'number' ? fmtNum(r.qty) : '—'}
                </td>
                <td className={TDR}>{typeof r.amount === 'number' ? fmtMoney(r.amount) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>

      <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
        {/* 🔴 บอกให้ชัดว่าที่เห็นคือหน้าแรก ไม่ใช่ทั้งหมด — CLAUDE.md กฎตัวนับกับตัวแถว */}
        {total !== null
          ? <>มีทั้งหมด <b>{fmtNum(total)} รายการ</b>{shown < total && <> — จอนี้แสดง <b>{fmtNum(shown)} รายการแรก</b> · กด &ldquo;ส่งออกบัตรสต็อก&rdquo; เพื่อได้ครบทุกแถว</>}</>
          : 'ท่อไม่ได้บอกจำนวนทั้งหมด — ยังไม่รู้ว่าที่เห็นครบหรือไม่'}
        {data?.counts && <> · แยกตามชนิด: {Object.entries(data.counts).map(([k, v]) => `${k} ${fmtNum(v)}`).join(' · ')}</>}
      </p>
    </div>
  )
}
