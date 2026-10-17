'use client'
// ไฟล์ — ลอกผังจาก ZORT `/FileUpload/list` (อ่านจอจริง: # · ไฟล์ · ประเภท · รายการ · โดย · วันที่อัพโหลด · หน้าละ 20)
//
// 📦 แหล่งข้อมูล: `?list=files` อ่านจาก **คลังสลิปของเราเอง** (ถังปิด gucut-zort-slips · งาน slips-sync เติมทุกชั่วโมง)
//    ZORT ไม่มีเส้นรายการไฟล์ทั้งร้าน (ท่อกวาด 10 ชื่อ ไม่พบ · 17 ต.ค. 2569)
//
// 🔴 สามเรื่องที่ท่อกำชับว่าต้องอยู่บนจอ ไม่ใช่ในหัว (จดหมายท่อ 17 ต.ค. 2569 ~02:5x)
//   ① uploadedAt / uploadedBy = null เสมอ — **ZORT ไม่ได้บันทึก** (แถวไฟล์ของ ZORT มี 6 ช่อง · วัด 8 ใบคร่อม มี.ค. 68 → ต.ค. 69)
//      ⇒ คอลัมน์ "โดย" กับ "วันที่อัพโหลด" คงไว้ตามผัง ZORT แต่เขียน "ZORT ไม่ได้บันทึก" ไม่ใช่ "ไม่รู้"
//      ⇒ archivedAt = วันที่ **เราดึงมาเก็บ** ⇒ แยกคอลัมน์ "วันที่เก็บเข้าคลัง" ห้ามวางใต้หัววันที่อัพโหลด
//   ② q ค้นได้แค่ **เลขที่ใบ** (ชื่อไฟล์อยู่ใน metadata ที่อ่านเฉพาะหน้าที่โชว์) ⇒ ช่องค้นเขียนว่า "ค้นเลขที่ใบ"
//   ③ docType ตอนนี้เป็น order ตายตัว (ยังไม่ได้ดึงไฟล์ของใบซื้อ/ใบเสนอ/ใบคืนมาเก็บ) ⇒ ไม่ทำตัวกรองชนิดที่ได้ 0 แถว
//   + อ่านคลังไม่ได้ ⇒ ท่อตอบ 503 + unknown:true และ **ไม่มีคีย์ files** ⇒ "ยังไม่รู้" ห้ามเขียนว่าไม่มีไฟล์
//   + filename อาจมีชื่อคนได้ (สุ่มดู 8/393 ไม่เจอ แต่ไม่ใช่ทั้งชุด) ⇒ จอนี้อยู่หลังล็อกอินพนักงานเท่านั้น
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtNum } from '@/lib/format'
import { ลิงก์ใบขาย } from '@/lib/sale-link'
import { PageHead, TableWrap, TH, TD, EmptyState, thaiDate } from '@/components/zort'

interface FileRow {
  fileid: string; docno?: string; docType?: string; filename?: string | null; kind?: string | null
  bytes?: number | null; archivedAt?: string | null; uploadedAt?: string | null; uploadedBy?: string | null
}
interface FilesResp {
  ok?: boolean; total?: number; totalAll?: number; offset?: number; limit?: number; nextOffset?: number | null
  files?: FileRow[]; applied?: { q?: string | null; limit?: number; offset?: number }
  qScope?: string; sortScope?: string; docTypeScope?: string; metaFailed?: number; unknown?: boolean; error?: string
}

/* ZORT ให้เลือก 10/20/50/100 ต่อหน้า (ตั้งต้น 20) · ท่อรับ limit ≤ 200 */
const ต่อหน้าที่เลือกได้ = [10, 20, 50, 100]
const ชนิดเอกสาร = (t?: string) => (t === 'order' ? 'รายการขาย' : t || '—')
const ขนาด = (b?: number | null) => (typeof b !== 'number' ? '—' : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

export default function FilesPage() {
  const [q, setQ] = useState('')
  const [คำค้น, setคำค้น] = useState('')
  const [ต่อหน้า, setต่อหน้า] = useState(20)
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<FilesResp | null>(null)
  const [สถานะ, setสถานะ] = useState<'loading' | 'ok' | 'unknown' | 'error'>('loading')
  const [ผิด, setผิด] = useState('')

  const load = useCallback(async (off: number, per: number, needle: string) => {
    setสถานะ('loading'); setผิด('')
    try {
      const qs = new URLSearchParams({ list: 'files', limit: String(per), offset: String(off) })
      if (needle.trim()) qs.set('q', needle.trim())
      const r = await fetch(`/api/web/core?${qs}`)
      const d: FilesResp = await r.json().catch(() => ({}))
      /* สามสถานะ: ไม่มีคีย์ files = ยังไม่รู้ (อ่านคลังไม่ได้ / ท่อรุ่นที่ยังไม่มีเส้นนี้) · อาร์เรย์ = รู้แล้ว (ว่างได้) */
      if (!Array.isArray(d.files)) {
        setData(null); setสถานะ(d.unknown ? 'unknown' : 'error')
        setผิด(d.unknown ? 'อ่านคลังไฟล์ไม่ได้รอบนี้' : 'ระบบหลังบ้านยังไม่พร้อมสำหรับจอนี้ หรือตอบผิดพลาดรอบนี้')
        return
      }
      /* ท่อสะท้อน q เป็นตัวพิมพ์เล็ก (เช่น so-202610026) ⇒ เทียบแบบไม่สนตัวพิมพ์ · เดิมเทียบตรงตัว ⇒ ค้นทุกครั้งขึ้นว่าผิดเงื่อนไข (เจอตอนทดสอบกับของจริง 17 ต.ค.) */
      if (d.applied && ((d.applied.offset ?? off) !== off || (needle.trim() && String(d.applied.q ?? '').toLowerCase() !== needle.trim().toLowerCase()))) {
        setData(null); setสถานะ('error'); setผิด('ระบบหลังบ้านไม่ได้ใช้เงื่อนไขที่ขอ — ไม่แสดงเพื่อไม่ให้ผิดชุด'); return
      }
      setData(d); setสถานะ('ok')
    } catch (e) {
      setData(null); setสถานะ('error'); setผิด(String(e instanceof Error ? e.message : e))
    }
  }, [])
  useEffect(() => { load(offset, ต่อหน้า, คำค้น) }, [load, offset, ต่อหน้า, คำค้น])

  const rows = data?.files ?? []
  const total = typeof data?.total === 'number' ? data.total : null
  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ไฟล์"
        summary={total !== null
          ? <span>จำนวน <b>{fmtNum(total)}</b> รายการ{คำค้น && typeof data?.totalAll === 'number' ? ` (จากทั้งหมด ${fmtNum(data.totalAll)})` : ''}</span>
          : undefined}
      />

      <form className="flex flex-wrap items-center gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); setOffset(0); setคำค้น(q) }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นเลขที่ใบ"
          className="text-[12.5px] border border-gray-300 rounded px-2.5 py-1.5 w-[220px] max-w-full" />
        <button type="submit" className="text-[12.5px] font-medium text-white rounded px-3 py-1.5" style={{ background: '#4165ed' }}>ค้นหา</button>
        {/* ② ท่อค้นได้แค่เลขที่ใบ — เขียนตรงนี้ คนพิมพ์ชื่อไฟล์แล้วได้ 0 จะได้ไม่สรุปว่าไม่มีไฟล์ */}
        <span className="text-[11.5px] text-gray-400">ค้นได้เฉพาะเลขที่ใบ ยังค้นชื่อไฟล์ไม่ได้</span>
      </form>

      <TableWrap>
        <table className="w-full min-w-[820px]">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              <th className={TH} style={{ width: 44 }}>#</th>
              <th className={TH}>ไฟล์</th>
              <th className={TH}>ประเภท</th>
              <th className={TH}>รายการ</th>
              <th className={TH}>โดย</th>
              <th className={TH}>วันที่อัพโหลด</th>
              {/* ① คอลัมน์ที่ ZORT ไม่มี — วันที่ "เรา" เก็บไฟล์เข้าคลัง (ตอบคนละคำถามกับวันที่อัพโหลด) */}
              <th className={TH}>วันที่เก็บเข้าคลัง</th>
            </tr>
          </thead>
          <tbody>
            {สถานะ === 'loading' && <tr><td colSpan={7} className="py-6 text-center text-[12.5px] text-gray-400">กำลังโหลด…</td></tr>}
            {(สถานะ === 'unknown' || สถานะ === 'error') && (
              <EmptyState cols={7} icon="⚠️" title="ยังไม่รู้ว่ามีไฟล์อะไรบ้าง" detail={`ตารางนี้ว่างเพราะ${ผิด} — ไม่ได้แปลว่าไม่มีไฟล์`} />
            )}
            {สถานะ === 'ok' && rows.length === 0 && (
              <EmptyState cols={7} icon="📁" title={คำค้น ? 'ไม่พบเลขที่ใบที่ค้น' : 'ยังไม่มีไฟล์ในคลัง'} detail={คำค้น ? 'ค้นได้เฉพาะเลขที่ใบ ลองพิมพ์เลขให้ครบ' : 'งานดึงสลิปเติมคลังทุกชั่วโมง'} />
            )}
            {สถานะ === 'ok' && rows.map((f, i) => (
              <tr key={f.fileid} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                <td className={`${TD} text-gray-500`}>{fmtNum((data?.offset ?? offset) + i + 1)}</td>
                <td className={TD}>
                  <span className="break-all">{f.filename || <span className="text-gray-400">(ไม่มีชื่อไฟล์)</span>}</span>
                  <span className="block text-[11px] text-gray-400">{f.kind || '—'} · {ขนาด(f.bytes)}</span>
                </td>
                <td className={TD}>{ชนิดเอกสาร(f.docType)}</td>
                <td className={TD}>
                  {f.docno
                    ? <Link href={ลิงก์ใบขาย(f.docno)} className="text-[#337ab7] hover:underline whitespace-nowrap">{f.docno}</Link>
                    : '—'}
                </td>
                <td className={`${TD} text-gray-400 text-[12px]`}>{f.uploadedBy || 'ZORT ไม่ได้บันทึก'}</td>
                <td className={`${TD} text-gray-400 text-[12px]`}>{f.uploadedAt ? thaiDate(f.uploadedAt) : 'ZORT ไม่ได้บันทึก'}</td>
                <td className={`${TD} whitespace-nowrap`}>{f.archivedAt ? thaiDate(f.archivedAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>

      {/* แถบท้ายตารางตามผัง ZORT: จำนวน N รายการ | จำนวนต่อหน้า */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-[12.5px] text-gray-500">
        <span>
          {total !== null && rows.length > 0 && <>แสดง {fmtNum((data?.offset ?? offset) + 1)}–{fmtNum((data?.offset ?? offset) + rows.length)} จาก {fmtNum(total)} รายการ</>}
        </span>
        <span className="flex items-center gap-2">
          <button type="button" disabled={offset <= 0 || สถานะ === 'loading'} onClick={() => setOffset(Math.max(0, offset - ต่อหน้า))}
            className="px-2.5 py-1 rounded border border-gray-300 bg-white disabled:opacity-40">← ก่อนหน้า</button>
          <button type="button" disabled={typeof data?.nextOffset !== 'number' || สถานะ === 'loading'} onClick={() => { if (typeof data?.nextOffset === 'number') setOffset(data.nextOffset) }}
            className="px-2.5 py-1 rounded border border-gray-300 bg-white disabled:opacity-40">ถัดไป →</button>
          <label className="ml-2">จำนวนต่อหน้า</label>
          <select value={ต่อหน้า} onChange={(e) => { setOffset(0); setต่อหน้า(Number(e.target.value)) }}
            className="border border-gray-300 rounded px-2 py-1 bg-white">
            {ต่อหน้าที่เลือกได้.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </span>
      </div>

      <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
        ไฟล์ที่ระบบเราดึงจาก ZORT มาเก็บไว้เอง (ตอนนี้มีเฉพาะไฟล์แนบของ<b>รายการขาย</b> — ใบซื้อ/ใบเสนอราคา/ใบคืน ยังไม่ได้ดึงมาเก็บ)
        {' '}· เรียงตามเลขที่ใบใหม่→เก่า · <b>โดย</b> กับ <b>วันที่อัพโหลด</b>: ZORT ไม่ได้บันทึกข้อมูลสองช่องนี้ไว้เลย
        {' '}· เปิดดูตัวไฟล์ได้ที่หน้ารายละเอียดของใบขาย (กดเลขที่ใบ)
        {typeof data?.metaFailed === 'number' && data.metaFailed > 0 && <> · ⚠️ อ่านชื่อไฟล์ไม่ได้ {fmtNum(data.metaFailed)} ไฟล์ในหน้านี้</>}
      </p>
    </div>
  )
}
