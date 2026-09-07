'use client'
// รายการใบคืนสินค้า (จอแอดมิน) — ตามร่างสุดท้าย /returns v2 + ผลเวที #3-#4
//
// จอนี้ตอบสามคำถามในคลิกเดียว (กติกาท่อข้อ 3 จากรอบปิดตา):
//   ใบไหนค้างขั้นไหนเกินกำหนด · ใครรับ/ใครประเมิน/ใครรับช่วง · สายตรวจย้อน ใบขาย↔ใบคืน↔move
//
// 🔴 ของจากเวที #4 ที่จอนี้เป็นคนถือ:
// - **heartbeat ของ job recon** — ไม่มี/เก่าเกิน = แถบแดง "UNKNOWN: ตัววัดตาบอดอยู่"
//   ("ZORT ไม่มีใบคืน" กับ "job ไม่ได้รัน" ให้เลข 0 เหมือนกันเป๊ะ — ต้องแยกให้เห็น)
// - **absence มีแถวและมีเจ้าของ** — ใบที่ค้างเกินกำหนดขึ้นกล่องแดงพร้อมชื่อคนถือ ไม่ใช่หายเงียบ
// - **การรับช่วงเป็นรายการแยก** — เห็นบ่อยผิดปกติ = สัญญาณคนใช้ทางลัด (ข้อสังเคราะห์เวที #2)
// - สามสถานะเสมอ: โหลดไม่ได้ ≠ ไม่มีใบจริง ≠ ยังโหลดอยู่
//
// 🔌 สัญญาอยู่ lib/returns-api.ts (นิ่งแล้วหลังรีวิวท่อ) · ยังไม่ผูกเมนู รอ API จริง
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, Pill, TableWrap, TH, TD, thaiDate } from '@/components/zort'
import { returnsApi, ReturnDoc, STATE_LABEL } from '@/lib/returns-api'

/* เกณฑ์ "ค้างเกินกำหนด" ต่อสถานะ (ชั่วโมง) — เลขเริ่มต้นที่ประกาศบนจอ ปรับได้เมื่อมีข้อมูลจริง
   (ตามบทเรียนเวที #3: เลขเดาต้องประกาศตัวว่าเดา และมีตัววัดตามหลัง) */
const OVERDUE_HOURS: Record<string, number> = { received: 4, graded: 24, move_failed: 2 }
const UNMATCHED_OVERDUE_H = 48

const hoursSince = (iso?: string) => {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? (Date.now() - t) / 3600e3 : null
}

function overdue(d: ReturnDoc): { late: boolean; why: string } {
  if (d.state === 'moved' || d.state === 'cancelled') return { late: false, why: '' }
  const h = hoursSince(d.lastActivityAt ?? d.createdAt)
  if (h === null) return { late: true, why: 'ไม่มีเวลากำกับ — อ่านอายุไม่ได้ (นับเป็นต้องดู)' }
  if (d.unmatched && h > UNMATCHED_OVERDUE_H)
    return { late: true, why: `unmatched ค้าง ${Math.floor(h)} ชม. (เกิน ${UNMATCHED_OVERDUE_H})` }
  const cap = OVERDUE_HOURS[d.state]
  if (cap !== undefined && h > cap)
    return { late: true, why: `${STATE_LABEL[d.state].text} ค้าง ${Math.floor(h)} ชม. (เกิน ${cap})` }
  return { late: false, why: '' }
}

const thaiTime = (iso?: string) => {
  if (!iso) return '—'
  const t = new Date(iso)
  if (!Number.isFinite(t.getTime())) return '—'
  return `${thaiDate(iso)} ${String((t.getUTCHours() + 7) % 24).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`
}

export default function ReturnsInboxPage() {
  const [rows, setRows] = useState<ReturnDoc[] | null>(null)
  const [heartbeat, setHeartbeat] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /* ดูรูปรายใบ — ดึงผ่านท่อ (dataUrl) เปิด URL ตรง ๆ ไม่ได้เพราะรหัสอยู่ในหัวข้อความ */
  const [photoView, setPhotoView] = useState<{ returnId: string; urls: string[]; failed: number } | null>(null)
  const viewPhotos = useCallback(async (returnId: string, count: number) => {
    setPhotoView({ returnId, urls: [], failed: 0 })
    const urls: string[] = []; let failed = 0
    for (let i = 0; i < count; i++) {
      try {
        const r = await returnsApi.photoGet(returnId, i)
        if (r.dataUrl) urls.push(r.dataUrl); else failed++
      } catch { failed++ }
    }
    setPhotoView({ returnId, urls, failed })
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const d = await returnsApi.inbox()
      if (!Array.isArray(d.rows)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี rows)')
      setRows(d.rows)
      setHeartbeat(d.reconHeartbeatAt)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e)); setRows(null)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const lateRows = (rows ?? []).filter((d) => overdue(d).late)
  const takeovers = (rows ?? []).flatMap((d) =>
    (Array.isArray(d.takeovers) ? d.takeovers : []).map((t) => ({ ...t, returnId: d.returnId })))
  /* heartbeat เก่าเกิน 26 ชม. = job รายวันขาดรอบแล้วแน่ (เผื่อเหลื่อม 2 ชม.) */
  const hbAge = hoursSince(heartbeat)
  const hbDead = hbAge === null || hbAge > 26

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="รายการใบคืนสินค้า"
        summary={
          <>
            สายตรวจย้อนครบ: ใบขาย ↔ ใบคืน ↔ รูป ↔ move ด้วย ref เดียว
            {' | '}
            <span className="text-gray-400">พนักงานรับคืนที่จอ รับคืนสินค้า (มือถือ)</span>
          </>
        }
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      {/* ── heartbeat ของ recon — UNKNOWN ต้องแดง ห้ามเงียบ (เวที #4) ── */}
      {!loading && !error && hbDead && (
        <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-4 leading-relaxed">
          🔴 <b>UNKNOWN: ตัวเทียบใบคืนกับ ZORT ตาบอดอยู่</b> — job recon
          {heartbeat ? <> ทิ้ง heartbeat ล่าสุด {thaiTime(heartbeat)} (เกิน 26 ชม.)</> : <> ไม่เคยทิ้ง heartbeat เลย</>}
          {' '}⇒ ตอนนี้แยกไม่ออกว่า &ldquo;ไม่มีใบคืนตกหล่น&rdquo; หรือ &ldquo;ตัวเทียบไม่ได้รัน&rdquo;
          — สองอย่างนี้ให้ตัวเลขหน้าตาเหมือนกันเป๊ะ ห้ามอ่านตารางข้างล่างว่า &ldquo;ครบ&rdquo;
        </div>
      )}

      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดึงรายการใบคืนไม่ได้'}>{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && rows && (
        <>
          {/* ── กล่องแดง: ใบค้างเกินกำหนด — absence มีแถวและมีเจ้าของ ── */}
          {lateRows.length > 0 && (
            <div className="text-[12.5px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-4">
              🔴 <b>ค้างเกินกำหนด {lateRows.length} ใบ — ทุกใบมีเจ้าของ ตามได้เลย</b>
              {lateRows.map((d) => (
                <span key={d.returnId} className="block mt-0.5">
                  · <span className="font-mono">{d.returnId}</span> — {overdue(d).why} ·
                  เจ้าของ: <b>{d.lockedBy ?? d.staff ?? 'ไม่มีชื่อ (ต้องดูว่าทำไม)'}</b>
                  {d.unmatched && d.quarantineNo && <> · เลขกัก <span className="font-mono">{d.quarantineNo}</span></>}
                </span>
              ))}
            </div>
          )}

          {/* ── รายการรับช่วง — แยกให้เห็น เห็นบ่อยผิดปกติ = คนใช้ทางลัด ── */}
          {takeovers.length > 0 && (
            <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mb-4">
              🔁 <b>การรับช่วงงาน {takeovers.length} ครั้ง</b> — ปกติควรนาน ๆ ครั้ง
              เห็นถี่ = คนเลิกตามเจ้าของงานแล้วใช้ทางลัด (ตัววัดจากเวที #2 · เกณฑ์ N วัดผลเดือนแรก)
              {takeovers.map((t, i) => (
                <span key={i} className="block mt-0.5">
                  · {thaiTime(t.at)} — <span className="font-mono">{t.returnId}</span>:
                  {t.from ?? '?'} → {t.to ?? '?'} ({t.reason}{t.note ? ` — ${t.note}` : ''})
                </span>
              ))}
            </div>
          )}

          {rows.length === 0 ? (
            <p className="text-[13px] text-gray-400 bg-white border border-gray-200 rounded-md px-4 py-8 text-center">
              ยังไม่มีใบคืนในระบบ — ใบแรกจะโผล่ที่นี่ทันทีที่พนักงานกดรับที่จอมือถือ
            </p>
          ) : (
            <TableWrap>
              <table className="w-full min-w-[860px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH}>เวลารับ (ไทย)</th><th className={TH}>เลขใบคืน / ref</th><th className={TH}>ใบขายที่ผูก</th>
                    <th className={TH}>ผู้รับ</th><th className={TH}>ชิ้น + คำตัดสิน</th><th className={TH}>รูป</th><th className={TH}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => {
                    const late = overdue(d)
                    return (
                      <tr key={d.returnId} className={`border-b border-[#e8ecf8] last:border-0 ${late.late ? 'bg-red-50/40' : ''}`}>
                        <td className={TD}><span className="whitespace-nowrap">{thaiTime(d.createdAt)}</span></td>
                        <td className={TD}>
                          <span className="font-mono text-[12px]">{d.returnId}</span>
                          <span className="block font-mono text-[10.5px] text-gray-400">{d.ref}</span>
                        </td>
                        <td className={TD}>
                          {d.unmatched
                            ? <span className="text-amber-700">🚩 unmatched{d.quarantineNo && <span className="font-mono"> · {d.quarantineNo}</span>}</span>
                            : <span className="font-mono text-[12px]">{d.orderNumber ?? '—'}</span>}
                        </td>
                        <td className={TD}>{d.staff ?? <span className="text-gray-300">—</span>}
                          {d.lockedBy && d.lockedBy !== d.staff && <span className="block text-[10.5px] text-amber-700">ถือโดย {d.lockedBy}</span>}
                        </td>
                        <td className={TD}>
                          {d.items.map((it) => (
                            <span key={it.sku || it.name} className="block text-[12px]">
                              {it.name || it.sku} ×{it.qty}
                              {it.verdict && (
                                <span className={it.verdict === 'return_in' ? 'text-emerald-700' : 'text-red-700'}>
                                  {' '}{it.verdict === 'return_in' ? '✓ขายต่อ' : '✗เสียหาย'}
                                </span>
                              )}
                              {/* สายตรวจย้อนขา move — duplicate ต้องเห็น ไม่ใช่กลืน */}
                              {it.moveResult === 'duplicate' && <span className="text-amber-700"> (ซ้ำ-ไม่บวก)</span>}
                              {d.state === 'move_failed' && !it.moveResult && <span className="text-red-700 font-semibold"> ยังไม่ลงสต็อก</span>}
                            </span>
                          ))}
                        </td>
                        <td className={TD}>
                          {typeof d.photoCount === 'number' && d.photoCount > 0
                            ? <button onClick={() => viewPhotos(d.returnId, d.photoCount!)}
                                className="text-blue-600 hover:underline">{d.photoCount} รูป — ดู</button>
                            : d.noPhotoReason
                              ? <span className="text-amber-700" title={d.noPhotoReason}>ไม่มีรูป (มีเหตุผล)</span>
                              /* ไม่มีรูปและไม่มีเหตุผล = ผิดกติกา ต้องเห็นเป็นแดง ไม่ใช่ขีดเฉย ๆ */
                              : <span className="text-red-700">ไม่มีรูป ไม่มีเหตุผล</span>}
                        </td>
                        <td className={TD}><Pill tone={STATE_LABEL[d.state]?.tone ?? 'gray'}>{STATE_LABEL[d.state]?.text ?? d.state}</Pill></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableWrap>
          )}

          {photoView && (
            <div className="bg-white border border-gray-300 rounded-md p-3 mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12.5px] font-semibold text-gray-800">รูปใบ <span className="font-mono">{photoView.returnId}</span></p>
                <button onClick={() => setPhotoView(null)} className="text-[12px] text-gray-500 hover:underline">ปิด</button>
              </div>
              {photoView.urls.length === 0 && photoView.failed === 0 && <LoadingState />}
              <div className="flex flex-wrap gap-2">
                {photoView.urls.map((u, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={i} src={u} alt={`รูปที่ ${i + 1}`} className="h-40 rounded border border-gray-200" />
                ))}
              </div>
              {photoView.failed > 0 && (
                <p className="text-[12px] text-red-700 mt-2">ดึงรูปไม่สำเร็จ {photoView.failed} ใบ — ลองกดดูใหม่ (ดึงไม่ได้ ≠ ไม่มีรูป)</p>
              )}
            </div>
          )}

          <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
            เกณฑ์ค้างเกินกำหนด (ชม.): รอประเมิน {OVERDUE_HOURS.received} · รอเข้าสต็อก {OVERDUE_HOURS.graded} ·
            เข้าสต็อกไม่ครบ {OVERDUE_HOURS.move_failed} · unmatched {UNMATCHED_OVERDUE_H} —
            <b> เลขชุดแรกเป็นค่าตั้งต้นที่ยังไม่มีข้อมูลรองรับ</b> (ประกาศตัวตามกติกาเวที #3)
            เดือนแรกวัดจากของจริงแล้วค่อยปรับ · รูปดึงผ่านท่อเป็น dataUrl (เส้น returnphoto — ท่อเพิ่มให้ 7 ก.ย. ดึก)
            เปิด URL ตรง ๆ ไม่ได้เพราะรหัสอยู่ในหัวข้อความ
          </p>
        </>
      )}

      <p className="text-[11.5px] text-gray-400 mt-1">
        จอพนักงาน: <Link href="/returns/receive" className="text-blue-600 hover:underline">รับคืนสินค้า (มือถือ)</Link> ·
        สถิติสินค้าที่ถูกคืนบ่อย: <Link href="/returns" className="text-blue-600 hover:underline">/returns</Link>
      </p>
    </div>
  )
}
