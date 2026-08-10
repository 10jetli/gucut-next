'use client'
// หน้า AI Visibility — ดูว่าผู้ช่วย AI เอ่ยถึง GUCUT หรือคู่แข่ง เมื่อลูกค้าถามหาร้านเลื่อยยนต์
import { useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import type { RunRecord } from '@/lib/ai-visibility'

interface BrandSummary {
  brandId: string
  name: string
  isUs: boolean
  mentions: number
  checks: number
  sharePct: number
  avgPosition: number | null
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AiVisibilityPage() {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [hasKey, setHasKey] = useState(true)
  const [summary, setSummary] = useState<BrandSummary[]>([])
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [openRun, setOpenRun] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai-visibility', { cache: 'no-store' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setSummary(data.summary ?? [])
      setRuns(data.runs ?? [])
      setHasKey(!!data.hasKey)
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  async function runCheck() {
    setRunning(true)
    setError('')
    try {
      const res = await fetch('/api/ai-visibility', { method: 'POST' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      await load()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const us = summary.find(s => s.isUs)
  const lastRun = runs[0]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">AI Visibility</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            เวลาลูกค้าถามผู้ช่วย AI ว่า “ซื้อเลื่อยยนต์ที่ไหนดี” — เขาเอ่ยถึงเราไหม
          </p>
        </div>
        <button
          onClick={runCheck}
          disabled={running || !hasKey}
          className="px-4 py-2 rounded-full text-[13px] font-semibold bg-blue-600 text-white shadow-[0_4px_10px_-4px_rgba(37,99,235,0.6)] disabled:opacity-40 disabled:shadow-none transition"
        >
          {running ? 'กำลังตรวจ...' : 'ตรวจรอบใหม่'}
        </button>
      </div>

      {!hasKey && (
        <ErrorBox title="ยังใช้งานไม่ได้ — ต้องตั้งค่ากุญแจก่อน">
          <p className="mt-1">
            ขอกุญแจฟรีที่ Google AI Studio (aistudio.google.com/apikey) แล้วไปที่ Netlify → Site
            configuration → Environment variables เพิ่มตัวแปรชื่อ{' '}
            <code className="bg-white/60 px-1 rounded">GEMINI_API_KEY</code> จากนั้น deploy ใหม่หนึ่งครั้ง
          </p>
        </ErrorBox>
      )}

      {error && <ErrorBox title="เกิดข้อผิดพลาด">{error}</ErrorBox>}

      {loading ? (
        <LoadingState text="กำลังโหลดผลการตรวจ..." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon="🎯"
              label="GUCUT ถูกเอ่ยถึง"
              value={us ? `${us.sharePct}%` : '—'}
              note={us ? `${us.mentions} จาก ${us.checks} คำถาม` : 'ยังไม่มีข้อมูล'}
              tone={us && us.sharePct >= 50 ? 'green' : 'orange'}
            />
            <StatCard
              icon="🏅"
              label="อันดับเฉลี่ยที่ถูกเอ่ย"
              value={us?.avgPosition ?? '—'}
              note={us?.avgPosition ? 'ยิ่งน้อยยิ่งดี (1 = เอ่ยก่อนใคร)' : 'ยังไม่ถูกเอ่ยถึง'}
              tone="purple"
            />
            <StatCard
              icon="🔁"
              label="ตรวจไปแล้ว"
              value={runs.length}
              unit="รอบ"
              note={lastRun ? `ล่าสุด ${fmtDate(lastRun.runAt)}` : 'ยังไม่เคยตรวจ'}
              tone="blue"
            />
            <StatCard
              icon="❓"
              label="คำถามต่อรอบ"
              value={lastRun?.results.length ?? 0}
              unit="ข้อ"
              note="แก้ได้ที่ lib/ai-visibility.ts"
              tone="gray"
            />
          </div>

          <Card>
            <p className="text-[13px] font-bold text-gray-900 mb-3">ส่วนแบ่งการถูกพูดถึง</p>
            {summary.length === 0 || summary.every(s => s.checks === 0) ? (
              <p className="text-[13px] text-gray-400 py-4 text-center">
                ยังไม่มีข้อมูล — กด “ตรวจรอบใหม่” เพื่อเริ่มเก็บผล
              </p>
            ) : (
              <div className="space-y-2.5">
                {summary.map((s, i) => (
                  <div
                    key={s.brandId}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                      s.isUs ? 'bg-emerald-50/70 border border-emerald-100' : 'bg-gray-50'
                    }`}
                  >
                    <span className="text-[12px] font-bold text-gray-400 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900 truncate">
                        {s.name}
                        {s.isUs && (
                          <span className="ml-2 text-[10px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                            เรา
                          </span>
                        )}
                      </p>
                      <div className="h-1.5 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.isUs ? 'bg-emerald-500' : 'bg-gray-400'}`}
                          style={{ width: `${s.sharePct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-black text-gray-900">{s.sharePct}%</p>
                      <p className="text-[11px] text-gray-400">
                        {s.avgPosition ? `อันดับ ${s.avgPosition}` : 'ไม่ถูกเอ่ย'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {lastRun && (
            <Card>
              <p className="text-[13px] font-bold text-gray-900 mb-3">
                ผลรอบล่าสุด · {fmtDate(lastRun.runAt)}
              </p>
              <div className="space-y-2">
                {lastRun.results.map((r, i) => {
                  const usHit = r.hits.find(h => h.brandId === 'gucut')
                  const key = `${lastRun.runAt}-${i}`
                  const open = openRun === key
                  return (
                    <div key={key} className="border border-gray-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setOpenRun(open ? null : key)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition"
                      >
                        <span className="text-[15px] shrink-0">
                          {r.error ? '⚠️' : usHit?.mentioned ? '✅' : '❌'}
                        </span>
                        <span className="text-[13px] text-gray-700 flex-1 min-w-0 truncate">{r.prompt}</span>
                        <span className="text-[11px] text-gray-400 shrink-0">{open ? 'ซ่อน' : 'ดูคำตอบ'}</span>
                      </button>
                      {open && (
                        <div className="px-3 pb-3 pt-1 text-[12px] text-gray-600 whitespace-pre-wrap border-t border-gray-100 bg-gray-50/60 leading-relaxed">
                          {r.error ? <span className="text-red-500">{r.error}</span> : r.answer}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
