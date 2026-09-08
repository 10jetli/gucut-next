'use client'
// ใบสั่งซื้อรายใบ — เปิดจากเลขที่ใบในจอรายการซื้อ (ตาม /Buy/Details ของ ZORT)
// gucut ทำแทน gucut2 (โควตาชน 89% · เจ้าของร้านสั่งให้หยุดที่ 80%)
//
// เส้น: /api/web/core?purchase=<เลขที่ใบ> — โครงจากซอร์สท่อจริง getPurchaseDetail:
//   { number, vendor, poDate, status, paymentStatus, warehouse, note,
//     amount, lineTotal, lines:[{line,sku,name,qty,price}], updatedAt, source }
//
// 🔴 **ต้องโชว์สองยอดคู่กันเสมอ ห้ามเลือกให้ค่าเดียว** (ท่อสั่งมาเอง):
//    amount    = ยอดหัวใบตามที่ ZORT ให้มา (รวมส่วนลด/ค่าส่ง/ภาษี)
//    lineTotal = ผลรวมบรรทัดที่เราคิดเอง (qty × price)
//    ⚠️ **ต่างกันได้เป็นปกติ ไม่ใช่ข้อมูลผิด** — กระจกไม่ได้เก็บส่วนลด/ค่าส่ง
//       ถ้าจอเลือกโชว์ค่าเดียว คนอ่านจะไม่มีวันรู้ว่ามีส่วนต่าง แล้วไล่บัญชีไม่ได้
//       (คลาสเดียวกับใบเสนอราคาที่ท่อจงใจส่งช่องเงินทุกช่อง)
// ⚠️ อ่านจาก **กระจก** ไม่ใช่ ZORT สด — ต้องเขียนบอกผู้ใช้ ไม่ปล่อยให้เข้าใจว่าสด
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost } from '@/components/zort'

interface Line { line?: number; sku?: string; name?: string; qty?: number; price?: number }
interface Resp {
  number?: string; vendor?: string | null; poDate?: string | null
  status?: string | null; paymentStatus?: string | null; warehouse?: string | null
  note?: string | null; amount?: number; lineTotal?: number
  lines?: Line[]; updatedAt?: string | null; source?: string
  error?: string; skip?: string
}

const baht = (n?: number) =>
  typeof n === 'number' ? n.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—'

function Inner() {
  const no = useSearchParams().get('no') ?? ''
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!no) { setError('ไม่ได้ระบุใบ (ต้องเปิดจากจอรายการซื้อ)'); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/web/core?purchase=${encodeURIComponent(no)}`)
      const j = (await res.json().catch(() => null)) as Resp | null
      if (j === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof j.skip === 'string') throw new Error(j.skip)
      if (!res.ok || j.error) throw new Error(j.error || `ท่อตอบ ${res.status}`)
      setD(j)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setLoading(false) }
  }, [no])
  useEffect(() => { load() }, [load])

  // ส่วนต่างหัวใบ vs บรรทัด — คำนวณเพื่อ "ชี้ให้ดู" ไม่ใช่เพื่อตัดสินว่าใครผิด
  const diff =
    typeof d?.amount === 'number' && typeof d?.lineTotal === 'number'
      ? Math.round((d.amount - d.lineTotal) * 100) / 100
      : null

  const Field = ({ k, v }: { k: string; v?: string | null }) =>
    v ? (
      <div className="flex gap-2 text-[13px]">
        <span className="min-w-[92px] text-gray-500">{k}</span>
        <span className="break-words">{v}</span>
      </div>
    ) : null

  return (
    <div className="p-4 md:p-6 max-w-[900px]">
      <p className="text-[12px] mb-2">
        <Link href="/core/purchases" className="text-blue-600 hover:underline">‹ รายการซื้อ</Link>
      </p>
      <PageHead title={`ใบสั่งซื้อ ${d?.number || no}`}
        summary={<span className="text-gray-400">{d?.source || 'อ่านจากคลังเงา'}</span>}
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>} />

      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดึงใบสั่งซื้อไม่ได้'}>{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && d && (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <section className="rounded border border-gray-200 bg-white p-3">
              <h2 className="mb-2 text-[13px] font-semibold">หัวใบ</h2>
              <div className="grid gap-1">
                <Field k="ผู้ขาย" v={d.vendor} />
                <Field k="วันที่" v={d.poDate} />
                <Field k="สถานะ" v={d.status} />
                <Field k="การชำระเงิน" v={d.paymentStatus} />
                <Field k="คลังปลายทาง" v={d.warehouse} />
                <Field k="โน้ต" v={d.note} />
                <Field k="อัปเดตกระจก" v={d.updatedAt} />
              </div>
            </section>

            <section className="rounded border border-gray-200 bg-white p-3">
              <h2 className="mb-2 text-[13px] font-semibold">ยอดเงิน</h2>
              {/* 🔴 สองยอดคู่กันเสมอ — ท่อส่งมาทั้งคู่โดยตั้งใจ */}
              <div className="grid gap-1 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">ยอดหัวใบ (ตาม ZORT)</span>
                  <b className="tabular-nums">{baht(d.amount)}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ผลรวมบรรทัด (คิดเอง)</span>
                  <b className="tabular-nums">{baht(d.lineTotal)}</b>
                </div>
              </div>
              {diff !== null && diff !== 0 && (
                /* ⚠️ ไม่ใช่กล่องแดง — ส่วนต่างเป็นเรื่องปกติ ไม่ใช่ข้อผิดพลาด */
                <p className="mt-2 rounded bg-gray-50 p-2 text-[12px] text-gray-600">
                  ต่างกัน <b className="tabular-nums">{baht(diff)}</b> บาท —
                  ปกติมาจาก<b>ส่วนลด / ค่าส่ง / ภาษี</b>ที่กระจกไม่ได้เก็บแยกไว้
                  <b> ไม่ใช่ข้อมูลผิด</b> · ถ้าต้องใช้ตัวเลขทางบัญชี ให้ยึดยอดหัวใบ
                </p>
              )}
            </section>
          </div>

          <section className="rounded border border-gray-200 bg-white p-3">
            <h2 className="mb-2 text-[13px] font-semibold">
              รายการสินค้า {d.lines?.length ? `(${d.lines.length} บรรทัด)` : ''}
            </h2>
            {!d.lines?.length ? (
              /* สามสถานะ: ใบนี้ไม่มีบรรทัดจริง ≠ ดึงไม่สำเร็จ (ถ้าดึงพลาดจะไปที่ ErrorBox แล้ว) */
              <p className="text-[13px] text-gray-500">
                ใบนี้ไม่มีบรรทัดสินค้าในกระจก — ใบเก่าบางใบ ZORT ไม่ได้ส่งบรรทัดมาให้
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-1 pr-2 font-medium">#</th>
                      <th className="py-1 pr-2 font-medium">รหัส</th>
                      <th className="py-1 pr-2 font-medium">ชื่อสินค้า</th>
                      <th className="py-1 pr-2 font-medium text-right">จำนวน</th>
                      <th className="py-1 pr-2 font-medium text-right">ราคา/หน่วย</th>
                      <th className="py-1 font-medium text-right">รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((l, i) => (
                      <tr key={`${l.sku ?? i}-${l.line ?? i}`} className="border-b border-gray-100 last:border-0">
                        <td className="py-1 pr-2 text-gray-400">{l.line ?? i + 1}</td>
                        <td className="py-1 pr-2 font-mono text-[12px]">
                          {/* เลขรหัสสินค้าเข้าจอสินค้าได้ — แบบแผน "ทุกตัวระบุตัวตนต้องกดได้" */}
                          {l.sku
                            ? <Link href={`/core/stock?q=${encodeURIComponent(l.sku)}`} className="text-blue-600 hover:underline">{l.sku}</Link>
                            : '—'}
                        </td>
                        <td className="py-1 pr-2">{l.name || '—'}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{baht(l.qty)}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{baht(l.price)}</td>
                        <td className="py-1 text-right tabular-nums">
                          {baht((Number(l.qty) || 0) * (Number(l.price) || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default function Page() {
  return <Suspense fallback={<LoadingState />}><Inner /></Suspense>
}
