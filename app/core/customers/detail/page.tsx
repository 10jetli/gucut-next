'use client'
// ภาพรวมลูกค้ารายคน — ตาม /Contact/ContactDetail ของ ZORT
// (กวาดคลาส "ZORT กดได้เราไม่" 8 ก.ย. 2569 · เส้นท่อ ?customer= เปิดให้แล้ววันเดียวกัน)
//
// เส้น: /api/web/core?customer=<ชื่อเต็ม หรือ รหัส/id ผู้ติดต่อ>
// รูปคำตอบ (จากซอร์สท่อจริง getCustomerDetail — ไม่ได้เดา):
//   { contact: {...} | null, name, orders:{count,total,firstDay,lastDay,recent[]}, matchNote }
//
// 🔴 **สองอย่างที่ต้องเขียนบอกผู้ใช้ ห้ามซ่อน** (ท่อชี้มาเอง):
//   ① contact = null แปลว่า "ไม่อยู่ในทะเบียนผู้ติดต่อ" **ไม่ใช่ "ไม่มีตัวตน"**
//      ลูกค้ามาร์เก็ตเพลสส่วนใหญ่เป็นแบบนี้ — มีออเดอร์จริงแต่ไม่เคยถูกสร้างเป็นผู้ติดต่อ
//   ② **ชื่อที่แพลตฟอร์มปิดบัง (มี *) จับคู่ออเดอร์ไม่ได้เลย** — วัดจริง 8 ก.ย. 2569:
//      ออเดอร์ 200 ใบล่าสุด มีชื่อไม่ถูกปิดบังแค่ 61 ใบ (30%)
//      ⇒ อีก 70% จะได้ 0 ออเดอร์ ซึ่ง **ถูกตามข้อมูลแต่หลอกตา**
//      ⇒ ตรวจ '*' ก่อน แล้วขึ้นว่า "แพลตฟอร์มปิดบังชื่อ" แทนการโชว์ศูนย์เฉย ๆ
//      (three-states-not-two: ไม่มีประวัติ ≠ ดูประวัติไม่ได้)
// ⚠️ ห้าม log/ส่งต่อเนื้อหา — มีชื่อ/เบอร์/ที่อยู่ลูกค้าจริง
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost } from '@/components/zort'

interface Order {
  id?: string; source?: string; number?: string; channel?: string; status?: string
  amount?: number; order_date?: string; tracking_no?: string; pay_status?: string
}
interface Resp {
  contact?: Record<string, unknown> | null
  name?: string
  orders?: { count?: number; total?: number; firstDay?: string; lastDay?: string; recent?: Order[] }
  matchNote?: string
  error?: string; skip?: string
}

const baht = (n?: number) => (typeof n === 'number' ? n.toLocaleString('th-TH', { maximumFractionDigits: 2 }) : '—')
const LABEL: Record<string, string> = {
  code: 'รหัส', type: 'ประเภท', tax_id: 'เลขผู้เสียภาษี', phone: 'เบอร์โทร',
  email: 'อีเมล', address: 'ที่อยู่', branch_name: 'สาขา', branch_no: 'เลขที่สาขา',
  updated_at: 'อัปเดตล่าสุด',
}

function Inner() {
  const sp = useSearchParams()
  const key = sp.get('name') ?? sp.get('id') ?? ''
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const masked = key.includes('*')

  const load = useCallback(async () => {
    if (!key) { setError('ไม่ได้ระบุลูกค้า (ต้องเปิดจากจอผู้ติดต่อหรือรายการขาย)'); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/web/core?customer=${encodeURIComponent(key)}`)
      const j = (await res.json().catch(() => null)) as Resp | null
      if (j === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof j.skip === 'string') throw new Error(j.skip)
      if (!res.ok || j.error) throw new Error(j.error || `ท่อตอบ ${res.status}`)
      setD(j)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setLoading(false) }
  }, [key])
  useEffect(() => { load() }, [load])

  const o = d?.orders
  const c = d?.contact

  return (
    <div className="p-4 md:p-6 max-w-[980px]">
      <p className="text-[12px] mb-2">
        <Link href="/core/customers" className="text-blue-600 hover:underline">‹ ผู้ติดต่อ</Link>
      </p>
      <PageHead title={d?.name || key || 'ลูกค้า'}
        summary={<span className="text-gray-400">ภาพรวมรายคน · ข้อมูลติดต่อ + ประวัติการซื้อจากคลังเงา</span>}
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>} />

      {/* 🔴 **ข้อจำกัดการจับคู่ต้องอยู่ใต้ชื่อลูกค้า ไม่ใช่ท้ายจอ** (ย้ายขึ้นมา 12 ก.ย. 2569)
          มันตอบคำถามว่า "ใบพวกนี้เป็นของคนนี้จริงไหม" ⇒ กำกับ**ทุกอย่างที่อยู่ใต้มัน**
          เดิมอยู่บรรทัดสุดท้ายของจอด้วยสี gray-400 (อ่อนที่สุดในโปรเจกต์)
          = คนอ่านประวัติการซื้อจบแล้วจึงเจอว่าอาจไม่ใช่คนเดียวกัน */}
      {d?.matchNote && (
        <p className="mb-3 text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 leading-relaxed">
          ⚠️ <b>ข้อจำกัดการจับคู่ลูกค้า</b> — {d.matchNote}
        </p>
      )}

      {/* 🔴 ชื่อถูกปิดบัง — ต้องบอกก่อนที่ผู้ใช้จะเห็นเลข 0 แล้วเข้าใจผิด */}
      {masked && (
        <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900">
          <b>แพลตฟอร์มปิดบังชื่อลูกค้ารายนี้</b> (มีเครื่องหมาย <code>*</code>) —
          ระบบจับคู่ประวัติการซื้อ<b>ไม่ได้</b> เพราะออเดอร์เก็บชื่อที่ถูกปิดบังมาแล้ว
          <div className="mt-1 text-amber-800">
            เลขข้างล่างที่เป็น 0 จึงแปลว่า <b>“ดูไม่ได้”</b> ไม่ใช่ “ไม่เคยซื้อ” ·
            ดูรายละเอียดจริงได้ในหลังบ้านของแพลตฟอร์มนั้น
          </div>
        </div>
      )}

      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดึงข้อมูลลูกค้าไม่ได้'}>{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && d && (
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          {/* ── ข้อมูลติดต่อ ── */}
          <section className="rounded border border-gray-200 bg-white p-3">
            <h2 className="mb-2 text-[13px] font-semibold">ข้อมูลติดต่อ</h2>
            {c ? (
              <table className="w-full text-[13px]">
                <tbody>
                  {Object.entries(LABEL).map(([k, label]) =>
                    c[k] ? (
                      <tr key={k} className="border-b border-gray-100 last:border-0">
                        <td className="py-1 pr-2 align-top text-gray-500 whitespace-nowrap">{label}</td>
                        <td className="py-1 break-words">{String(c[k])}</td>
                      </tr>
                    ) : null
                  )}
                </tbody>
              </table>
            ) : (
              /* ⚠️ ไม่ใช่ error — ต้องอ่านออกว่าเป็นสภาพปกติของลูกค้ามาร์เก็ตเพลส */
              <p className="text-[13px] text-gray-500">
                <b>ไม่อยู่ในทะเบียนผู้ติดต่อ</b> — เป็นเรื่องปกติของลูกค้าที่ซื้อผ่านมาร์เก็ตเพลส
                (มีออเดอร์จริง แต่ไม่เคยถูกสร้างเป็นผู้ติดต่อในระบบ)
              </p>
            )}
          </section>

          {/* ── ประวัติการซื้อ ── */}
          <section className="rounded border border-gray-200 bg-white p-3">
            <h2 className="mb-2 text-[13px] font-semibold">ประวัติการซื้อ</h2>
            <div className="mb-3 flex flex-wrap gap-4 text-[13px]">
              <div><span className="text-gray-500">จำนวนใบ </span><b>{o?.count ?? 0}</b></div>
              <div><span className="text-gray-500">ยอดรวม </span><b>{baht(o?.total)}</b> บาท</div>
              {o?.firstDay && <div><span className="text-gray-500">ซื้อครั้งแรก </span>{o.firstDay}</div>}
              {o?.lastDay && <div><span className="text-gray-500">ล่าสุด </span>{o.lastDay}</div>}
            </div>

            {!o?.recent?.length ? (
              <p className="text-[13px] text-gray-500">
                {masked ? 'ดูประวัติไม่ได้เพราะชื่อถูกปิดบัง' : 'ยังไม่มีออเดอร์ที่จับคู่กับชื่อนี้'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-1 pr-2 font-medium">วันที่</th>
                      <th className="py-1 pr-2 font-medium">เลขที่</th>
                      <th className="py-1 pr-2 font-medium">ช่องทาง</th>
                      <th className="py-1 pr-2 font-medium text-right">มูลค่า</th>
                      <th className="py-1 pr-2 font-medium">สถานะ</th>
                      <th className="py-1 font-medium">ชำระเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.recent.map((r, i) => (
                      <tr key={`${r.id ?? r.number ?? i}`} className="border-b border-gray-100 last:border-0">
                        <td className="py-1 pr-2 whitespace-nowrap">{r.order_date ?? '—'}</td>
                        <td className="py-1 pr-2">
                          {/* ลิงก์ข้ามจอ — เลขที่ใบต้องกดเข้ารายละเอียดได้เสมอ (แบบแผนข้อ 1 ของ ZORT) */}
                          {r.number
                            ? <Link href={`/core/sales?q=${encodeURIComponent(r.number)}`} className="text-blue-600 hover:underline">{r.number}</Link>
                            : '—'}
                        </td>
                        <td className="py-1 pr-2">{r.channel ?? '—'}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{baht(r.amount)}</td>
                        <td className="py-1 pr-2">{r.status ?? '—'}</td>
                        <td className="py-1">{r.pay_status ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[12px] text-gray-400">
                  แสดง {o.recent.length} ใบล่าสุด{typeof o.count === 'number' && o.count > o.recent.length ? ` จากทั้งหมด ${o.count} ใบ` : ''}
                </p>
              </div>
            )}

          </section>
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return <Suspense fallback={<LoadingState />}><Inner /></Suspense>
}
