'use client'
// โครงการแก่น 🌳 — แดชบอร์ดคลังเงา GUCUT Core (D1)
// เงา → เทียบ → สับสวิตช์: หน้านี้คือหน้าปัดของ "เทียบ" — นับถอยหลังยอดตรง 30 วัน
// ข้อมูลผ่านท่อกลาง /api/web/core → gucut.com/api/core · รีเฟรช/สั่งงานด้วยปุ่มเท่านั้น
import { useEffect, useState, useCallback } from 'react'
import { fmtBaht, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'

interface Recon {
  day: string
  zort_orders: number
  zort_amount: number
  core_orders: number
  core_amount: number
  diff_notes: string
}
interface Status {
  ready: boolean
  note?: string
  counts?: { orders: number; items: number; snapshots: number }
  recon?: Recon[]
  channels?: { channel: string; orders: number; amount: number }[]
  shopee?: {
    day: string; api_orders: number; api_amount: number
    zort_orders: number; zort_amount: number; match: boolean
  }[]
}

const GOAL_DAYS = 30 // ประตูระยะ 2: ยอดตรงติดต่อกัน 30 วัน

export default function CorePage() {
  const [st, setSt] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acting, setActing] = useState('')
  const [actMsg, setActMsg] = useState('')
  const [refreshed, setRefreshed] = useState(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/web/core')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setSt(data)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
      setRefreshed(new Date())
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function act(label: string, qs: string) {
    setActing(label)
    setActMsg('')
    try {
      const res = await fetch(`/api/web/core?${qs}`)
      const data = await res.json()
      if (!res.ok || data?.error) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setActMsg(`✅ ${label} สำเร็จ`)
      await load()
    } catch (e) {
      setActMsg(`⚠️ ${label} ไม่สำเร็จ: ${String(e instanceof Error ? e.message : e)}`)
    } finally {
      setActing('')
    }
  }

  // นับวันที่ยอดตรงติดต่อกัน (จากวันล่าสุดย้อนลง)
  const recon = st?.recon ?? []
  let streak = 0
  for (const r of recon) {
    if (r.diff_notes === 'ตรงกัน') streak++
    else break
  }
  const totalChan = Math.max(...(st?.channels?.map(c => c.amount) ?? [0]), 1)

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">🌳 โครงการแก่น — คลังเงา</h1>
          <span className="text-[11px] text-gray-400" suppressHydrationWarning>
            กระจกออเดอร์ทุกช่องทางลงฐานของเราเอง วิ่งคู่ ZORT · อัพเดต {refreshed.toLocaleTimeString('th-TH')}
          </span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-[12px] md:text-[13px] font-semibold text-blue-600 bg-white border border-gray-200 rounded-xl px-3.5 py-2 shadow-sm flex items-center gap-1.5 hover:bg-blue-50 transition-colors disabled:opacity-50"
        >
          <span className={loading ? 'spinner inline-block' : ''}>🔄</span> รีเฟรช
        </button>
      </div>

      {error && <ErrorBox title="ดึงสถานะคลังเงาไม่ได้">{error}</ErrorBox>}
      {loading && !st && <LoadingState />}

      {st && !st.ready && (
        <Card>
          <p className="text-[14px] font-semibold text-gray-800 mb-1">⏳ คลังเงายังไม่เริ่มเดิน</p>
          <p className="text-[13px] text-gray-500">{st.note}</p>
          <p className="text-[13px] text-gray-500 mt-2">
            ต้องตั้ง env ที่ Netlify โปรเจกต์ <code className="text-[12px] bg-gray-100 px-1.5 py-0.5 rounded">gucut-storefront</code>:
            <b> CLOUDFLARE_D1_TOKEN</b> (สร้างที่ Cloudflare → API Tokens → สิทธิ์ D1 Edit)
            และ <b>ZORT_STORENAME_2 / ZORT_APIKEY_2 / ZORT_APISECRET_2</b> (คัดลอกจาก env ของ gucut-admin)
            — ใส่แล้วกลับมากดปุ่ม backfill ที่หน้านี้ได้เลย
          </p>
        </Card>
      )}

      {st?.ready && (
        <>
          {/* นับถอยหลัง 30 วัน — ประตูระยะ 2 */}
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
              <p className="text-[13px] font-semibold text-gray-700">🚪 ประตูระยะ 2 — ยอดตรงติดต่อกัน {GOAL_DAYS} วัน</p>
              <p className="text-[13px] font-bold text-gray-900">{streak} / {GOAL_DAYS} วัน</p>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${streak >= GOAL_DAYS ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min((streak / GOAL_DAYS) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {streak >= GOAL_DAYS
                ? '✅ ผ่านประตูแล้ว — พร้อมคุยเรื่องให้ Core เป็นตัวจริง'
                : recon.length === 0
                  ? 'ยังไม่มีผลเทียบยอด — ยามเทียบยอดวิ่งตี 1 ทุกคืน หรือกดปุ่ม "เทียบยอดเดี๋ยวนี้" ด้านล่าง'
                  : 'ยอดไม่ตรงวันไหน ตัวนับเริ่มใหม่ — ความชัวร์ซื้อด้วยเวลา'}
            </p>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon="📦" tone="blue" label="ออเดอร์ในคลังเงา" value={fmtNum(st.counts?.orders ?? 0)} unit="ใบ" />
            <StatCard icon="🧾" tone="purple" label="รายการสินค้า" value={fmtNum(st.counts?.items ?? 0)} unit="แถว" />
            <StatCard icon="📸" tone="green" label="สแนปช็อตสต็อก" value={fmtNum(st.counts?.snapshots ?? 0)} unit="แถว (วัน×SKU)" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* ผลเทียบยอด 7 วัน */}
            <Card padded={false} className="overflow-hidden">
              <div className="px-4 md:px-5 py-3 border-b border-gray-100">
                <p className="text-[13px] font-semibold text-gray-700">🪞 ผลเทียบยอดรายวัน (ZORT vs Core)</p>
              </div>
              {recon.length === 0 && <p className="text-[13px] text-gray-400 p-4">ยังไม่มีข้อมูล</p>}
              {recon.map((r) => {
                const ok = r.diff_notes === 'ตรงกัน'
                return (
                  <div key={r.day} className="flex items-center gap-3 px-4 md:px-5 py-2.5 border-b border-gray-50 last:border-0">
                    <span className="text-[15px] shrink-0">{ok ? '✅' : '⚠️'}</span>
                    <span className="text-[13px] font-medium text-gray-800 w-24 shrink-0">{r.day}</span>
                    <span className="text-[12px] text-gray-500 flex-1">
                      ZORT {fmtNum(r.zort_orders)} ใบ · {fmtBaht(r.zort_amount)} — Core {fmtNum(r.core_orders)} ใบ · {fmtBaht(r.core_amount)}
                    </span>
                    {!ok && <span className="text-[11px] font-semibold text-red-500 shrink-0">{r.diff_notes}</span>}
                  </div>
                )
              })}
            </Card>

            {/* เทียบ 3 ทางฝั่ง Shopee — แผนลับขั้น 3 (ระยะรันคู่) */}
            <Card padded={false} className="overflow-hidden">
              <div className="px-4 md:px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-gray-700">🛒 Shopee ตรงจาก API vs ZORT (ขั้น 3 — รันคู่)</p>
                <span className="text-[11px] text-gray-400">ต้องตรง 14 วันติดก่อนขยับ</span>
              </div>
              {(st.shopee ?? []).length === 0 && (
                <p className="text-[13px] text-gray-400 p-4">ยังไม่มีข้อมูล — กด "ดึงออเดอร์ Shopee" ด้านล่าง</p>
              )}
              {(st.shopee ?? []).map((r) => (
                <div key={r.day} className="flex items-center gap-3 px-4 md:px-5 py-2.5 border-b border-gray-50 last:border-0">
                  <span className="text-[15px] shrink-0">{r.match ? '✅' : '⚠️'}</span>
                  <span className="text-[13px] font-medium text-gray-800 w-24 shrink-0">{r.day}</span>
                  <span className="text-[12px] text-gray-500 flex-1">
                    API {fmtNum(r.api_orders)} ใบ · {fmtBaht(r.api_amount)} — ZORT {fmtNum(r.zort_orders)} ใบ · {fmtBaht(r.zort_amount)}
                  </span>
                  {!r.match && (
                    <span className="text-[11px] font-semibold text-red-500 shrink-0">
                      ต่าง {fmtNum(Math.abs(r.api_orders - r.zort_orders))} ใบ
                    </span>
                  )}
                </div>
              ))}
            </Card>

            {/* ช่องทางในคลังเงา */}
            <Card>
              <p className="text-[13px] font-semibold text-gray-700 mb-3">🏪 ช่องทางที่กระจกเข้ามาแล้ว (ยอดสะสม)</p>
              {(st.channels ?? []).length === 0 && <p className="text-[13px] text-gray-400">ยังไม่มีข้อมูล — กด backfill ด้านล่าง</p>}
              <div className="space-y-2.5">
                {(st.channels ?? []).map((c) => (
                  <div key={c.channel}>
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[12.5px] font-medium text-gray-800 truncate">{c.channel}</span>
                      <span className="text-[12.5px] text-gray-500 shrink-0">{fmtNum(c.orders)} ใบ · <b className="text-gray-900">{fmtBaht(c.amount)}</b></span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max((c.amount / totalChan) * 100, 2)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* ปุ่มสั่งงาน */}
          <Card>
            <p className="text-[13px] font-semibold text-gray-700 mb-3">🎛 สั่งงาน (กดเองเท่านั้น — ปกติระบบวิ่งเองทุกครึ่งชั่วโมง + เทียบยอดตี 1)</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'กระจก 3 วันล่าสุด', qs: 'sync=1&days=3' },
                { label: 'Backfill 60 วัน', qs: 'sync=1&days=60' },
                { label: 'เทียบยอดเดี๋ยวนี้', qs: 'recon=1' },
                { label: 'ดึงออเดอร์ Shopee (API)', qs: 'shopeesync=1&days=3' },
                { label: 'Shopee ย้อน 15 วัน', qs: 'shopeesync=1&days=15' },
                { label: 'ถ่ายสต็อกเดี๋ยวนี้', qs: 'snapshot=1' },
              ].map((b) => (
                <button
                  key={b.qs}
                  onClick={() => act(b.label, b.qs)}
                  disabled={!!acting}
                  className="text-[12.5px] font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl px-3.5 py-2 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {acting === b.label ? '⏳ กำลังทำ…' : b.label}
                </button>
              ))}
            </div>
            {actMsg && <p className="text-[12.5px] text-gray-600 mt-2.5">{actMsg}</p>}
          </Card>
        </>
      )}
    </div>
  )
}
