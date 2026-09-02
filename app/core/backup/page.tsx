'use client'
// สำรองข้อมูล / กู้คืน — เจ้าของร้านสั่ง "ห้ามข้อมูลหาย · เรียกคืนได้ กันเหนียว"
//
// ฝั่งเซิร์ฟเวอร์สำรอง Netlify Blobs → Cloudflare D1 (คนละบริษัท คนละคีย์) ทุกชั่วโมง
//   ?backupstatus=1                       สถานะสำเนา
//   ?backup=1                             สั่งสำรองเดี๋ยวนั้น
//   ?restore=<ถัง>                        **ซ้อม** ไม่เขียนอะไร
//   ?restore=<ถัง>&confirm=1              เขียนจริง (ไม่ทับของที่ยังอยู่)
//   ?restore=<ถัง>&confirm=1&overwrite=1  ทับด้วย
//
// ⚠️ **ห้ามมีปุ่มที่กดทีเดียวแล้วเขียนทับ** — ต้องซ้อมก่อนเสมอ แล้วโชว์ว่าจะเขียนกี่คีย์
//    ก่อนถึงจะกดจริงได้ · การกู้คืนคือการเขียนทับข้อมูลจริงของร้าน กดพลาดแล้วย้อนไม่ได้
//
// ⚠️ **หน้านี้ไม่เดาชื่อฟิลด์ของคำตอบ** — แสดงทุกอย่างที่เซิร์ฟเวอร์ส่งมาแบบตรงไปตรงมา
//    เดาชื่อฟิลด์แล้วอ่านไม่เจอ = ขึ้น "—" หรือ 0 ทั้งที่ข้อมูลมีอยู่ ⇒ เข้าใจว่าไม่มีสำเนา
//    ซึ่งเป็นความเข้าใจผิดที่แพงที่สุดของหน้านี้
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, BtnPrimary } from '@/components/zort'

type Json = unknown

/** ชื่อไทยของคีย์ที่พอเดาความหมายได้ — เดา "ป้าย" ปลอดภัย เดา "ค่า" ไม่ปลอดภัย
 *  คีย์ที่ไม่รู้จักแสดงชื่อดิบไปตรง ๆ ดีกว่าซ่อน */
const LABEL: Record<string, string> = {
  ok: 'สถานะ', at: 'เวลา', generatedAt: 'เวลา', lastRun: 'สำรองล่าสุด',
  keys: 'จำนวนคีย์', totalKeys: 'จำนวนคีย์ทั้งหมด', bytes: 'ขนาด', size: 'ขนาด',
  stores: 'ถังที่สำรอง', buckets: 'ถังที่สำรอง', store: 'ถัง', name: 'ชื่อ',
  count: 'จำนวน', ms: 'ใช้เวลา (มิลลิวินาที)', took: 'ใช้เวลา',
  wrote: 'เขียนไป', skipped: 'ข้าม', would: 'จะเขียน', dryRun: 'โหมดซ้อม',
  restored: 'กู้คืนแล้ว', error: 'ข้อผิดพลาด', note: 'หมายเหตุ',
}
const label = (k: string) => LABEL[k] ?? k

function fmtVal(v: Json): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'ใช่' : 'ไม่'
  if (typeof v === 'number') return v.toLocaleString('th-TH')
  const s = String(v)
  // ค่าที่หน้าตาเป็นเวลา ISO → แปลงเป็นเวลาไทยให้อ่านออก
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return `${d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} น.`
  }
  return s
}

/** แสดงคำตอบของเซิร์ฟเวอร์ตามรูปที่มันเป็นจริง ไม่บังคับให้เข้าโครงที่เราคิดไว้ */
function Show({ data }: { data: Json }) {
  if (data === null || typeof data !== 'object') {
    return <p className="text-[13px] text-gray-700">{fmtVal(data)}</p>
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return <p className="text-[12.5px] text-gray-400">ว่าง</p>
    const allObj = data.every((x) => x && typeof x === 'object' && !Array.isArray(x))
    if (!allObj) {
      return (
        <div className="flex flex-wrap gap-1">
          {data.map((x, i) => (
            <span key={i} className="text-[11.5px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{fmtVal(x)}</span>
          ))}
        </div>
      )
    }
    const cols = Array.from(
      new Set(data.flatMap((x) => Object.keys(x as Record<string, Json>))),
    )
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-gray-200">
              {cols.map((c) => <th key={c} className="text-left font-medium text-gray-500 px-2 py-1.5">{label(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 last:border-0">
                {cols.map((c) => (
                  <td key={c} className="px-2 py-1.5 text-gray-700">
                    {fmtVal((row as Record<string, Json>)[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  const entries = Object.entries(data as Record<string, Json>)
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex flex-wrap items-start gap-2">
          <span className="text-[12.5px] text-gray-500 w-[140px] shrink-0">{label(k)}</span>
          <span className="text-[12.5px] text-gray-800 min-w-0 flex-1">
            {v && typeof v === 'object' ? <Show data={v} /> : fmtVal(v)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** ดึงรายชื่อถังจากคำตอบสถานะ — ลองหลายรูป ไม่เจอก็ให้พิมพ์เอง ไม่ล็อกคนใช้ */
function bucketsOf(status: Json): string[] {
  const s = (status ?? {}) as Record<string, Json>
  for (const key of ['stores', 'buckets']) {
    const v = s[key]
    if (Array.isArray(v)) {
      const names = v.map((x) => {
        if (typeof x === 'string') return x
        const o = (x ?? {}) as Record<string, Json>
        const n = o.store ?? o.name ?? o.bucket
        return typeof n === 'string' ? n : ''
      }).filter(Boolean)
      if (names.length) return names as string[]
    }
  }
  return []
}

export default function BackupPage() {
  const [status, setStatus] = useState<Json>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const [bucket, setBucket] = useState('')
  const [dry, setDry] = useState<Json>(null)
  const [dryFor, setDryFor] = useState('')   // ซ้อมไว้กับถังไหน — เปลี่ยนถังแล้วผลซ้อมต้องหมดอายุ
  const [result, setResult] = useState<Json>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/web/core?backupstatus=1')
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setStatus(j)
    } catch (e) {
      setStatus(null) // ไม่โชว์ของค้าง — เดียวเข้าใจว่ามีสำเนาทั้งที่อ่านไม่ได้
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  async function call(qs: string, tag: string) {
    setBusy(tag)
    setMsg('')
    try {
      const res = await fetch(`/api/web/core?${qs}`)
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      return j
    } catch (e) {
      setMsg(`❌ ${String(e instanceof Error ? e.message : e)}`)
      return null
    } finally {
      setBusy('')
    }
  }

  async function backupNow() {
    const j = await call('backup=1', 'backup')
    if (j) { setMsg('✅ สำรองเรียบร้อย'); loadStatus() }
  }

  async function rehearse() {
    if (!bucket.trim()) return
    setResult(null)
    const j = await call(`restore=${encodeURIComponent(bucket.trim())}`, 'dry')
    if (j) { setDry(j); setDryFor(bucket.trim()); setMsg('') }
  }

  async function restoreReal(overwrite: boolean) {
    const b = bucket.trim()
    if (!b || dryFor !== b) return
    const warn = overwrite
      ? `กู้คืนถัง "${b}" แบบ **ทับของเดิม** — ข้อมูลที่อยู่ในถังตอนนี้จะถูกเขียนทับด้วยสำเนา ย้อนกลับไม่ได้ ยืนยันไหม`
      : `กู้คืนถัง "${b}" เฉพาะคีย์ที่หายไป (ไม่ทับของที่ยังอยู่) ยืนยันไหม`
    if (!confirm(warn)) return
    const j = await call(
      `restore=${encodeURIComponent(b)}&confirm=1${overwrite ? '&overwrite=1' : ''}`,
      overwrite ? 'over' : 'real',
    )
    if (j) {
      setResult(j)
      setDry(null)
      setDryFor('')   // ซ้อมใหม่ทุกครั้งก่อนกู้รอบถัดไป
      setMsg('✅ กู้คืนเรียบร้อย')
      loadStatus()
    }
  }

  const buckets = bucketsOf(status)
  const canRestore = !!bucket.trim() && dryFor === bucket.trim() && !!dry

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สำรองข้อมูล"
        summary="สำเนาของข้อมูลในเว็บ เก็บไว้คนละบริษัทกับตัวจริง · ทำเองทุกชั่วโมง"
        actions={
          <>
            <BtnGhost onClick={loadStatus} disabled={loading}>{loading ? 'กำลังโหลด…' : 'อ่านใหม่'}</BtnGhost>
            <BtnPrimary onClick={backupNow} disabled={!!busy}>
              {busy === 'backup' ? 'กำลังสำรอง…' : 'สำรองเดี๋ยวนี้'}
            </BtnPrimary>
          </>
        }
      />

      {msg && (
        <p className={`text-[13px] rounded px-3 py-2 mb-3 border ${
          msg.startsWith('✅')
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>{msg}</p>
      )}

      {error && <ErrorBox title="อ่านสถานะสำเนาไม่ได้">{error}</ErrorBox>}
      {loading && !status && <LoadingState />}

      {status != null && (
        <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
          <p className="text-[14.5px] font-semibold text-gray-900 mb-2.5">สถานะสำเนาล่าสุด</p>
          <Show data={status} />
        </div>
      )}

      {/* ───────── กู้คืน ───────── */}
      <div className="bg-white border border-gray-200 rounded-md p-4">
        <p className="text-[14.5px] font-semibold text-gray-900">กู้คืนข้อมูล</p>
        <p className="text-[12.5px] text-gray-600 leading-relaxed mt-1">
          การกู้คืนคือการ<b>เขียนข้อมูลจริงของร้าน</b> — หน้านี้จึงบังคับให้
          <b>ซ้อมก่อนเสมอ</b> แล้วดูว่าจะเขียนกี่คีย์ ถึงจะกดจริงได้
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {buckets.length > 0 ? (
            <select
              value={bucket}
              onChange={(e) => { setBucket(e.target.value); setDry(null); setDryFor(''); setResult(null) }}
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 bg-white"
            >
              <option value="">— เลือกถัง —</option>
              {buckets.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          ) : (
            <input
              value={bucket}
              onChange={(e) => { setBucket(e.target.value); setDry(null); setDryFor(''); setResult(null) }}
              placeholder="ชื่อถัง เช่น gucut-orders"
              className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 w-[240px]"
            />
          )}
          <BtnGhost onClick={rehearse} disabled={!bucket.trim() || !!busy}>
            {busy === 'dry' ? 'กำลังซ้อม…' : 'ซ้อมกู้คืน (ไม่เขียนอะไร)'}
          </BtnGhost>
        </div>

        {dry != null && (
          <div className="mt-3 border border-blue-100 bg-blue-50 rounded p-3">
            <p className="text-[13px] font-semibold text-blue-900 mb-1.5">
              ผลการซ้อมถัง “{dryFor}” — ยังไม่มีอะไรถูกเขียน
            </p>
            <Show data={dry} />
            <div className="flex flex-wrap gap-2 mt-3">
              <BtnPrimary onClick={() => restoreReal(false)} disabled={!canRestore || !!busy}>
                {busy === 'real' ? 'กำลังกู้คืน…' : 'กู้คืนจริง — เฉพาะคีย์ที่หายไป'}
              </BtnPrimary>
              <button
                onClick={() => restoreReal(true)}
                disabled={!canRestore || !!busy}
                className="rounded-full border border-red-300 bg-white px-4 py-1.5 text-[13px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                {busy === 'over' ? 'กำลังทับ…' : 'กู้คืนแล้วทับของเดิม'}
              </button>
            </div>
            <p className="text-[11.5px] text-gray-500 mt-2 leading-relaxed">
              ⚠️ &quot;ทับของเดิม&quot; ใช้เมื่อข้อมูลปัจจุบัน<b>เสียหาย</b>เท่านั้น —
              ของที่อยู่ในถังตอนนี้จะถูกเขียนทับด้วยสำเนา และย้อนกลับไม่ได้
            </p>
          </div>
        )}

        {result != null && (
          <div className="mt-3 border border-emerald-200 bg-emerald-50 rounded p-3">
            <p className="text-[13px] font-semibold text-emerald-900 mb-1.5">ผลการกู้คืน</p>
            <Show data={result} />
          </div>
        )}
      </div>

      <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
        สำเนาเก็บที่ผู้ให้บริการคนละเจ้ากับตัวจริงและใช้คีย์คนละชุด —
        ถ้าฝั่งหนึ่งล่มหรือบัญชีมีปัญหา อีกฝั่งยังอยู่ ·
        หน้านี้แสดงค่าที่เซิร์ฟเวอร์ส่งมาตรง ๆ ไม่ได้ตีความใหม่
      </p>
    </div>
  )
}
