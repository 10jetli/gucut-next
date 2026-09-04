'use client'
// สำรองข้อมูล / กู้คืน — เจ้าของร้านสั่ง "ห้ามข้อมูลหาย · เรียกคืนได้ กันเหนียว"
//
// ฝั่งเซิร์ฟเวอร์สำรอง Netlify Blobs → Cloudflare D1 (คนละบริษัท คนละคีย์) ทุกชั่วโมง
//   ?backupstatus=1                                 สถานะสำเนา
//   ?backup=1                                       สั่งสำรองเดี๋ยวนั้น
//   ?restore=<ถัง>[&key=..]                         **ซ้อม** ไม่เขียนอะไร
//   ?restore=<ถัง>&confirm=1[&overwrite=1]          เขียนจริง
//
// ⚠️ **ห้ามมีปุ่มที่กดทีเดียวแล้วเขียนทับ** — ต้องซ้อมก่อนเสมอ แล้วโชว์ว่าจะเขียนกี่คีย์
//    การกู้คืนคือการเขียนทับข้อมูลจริงของร้าน กดพลาดแล้วย้อนไม่ได้
//
// ⚠️ **เวลาจากเซิร์ฟเวอร์เป็น UTC** (รูป "2026-09-02 22:15:25" ไม่มีเขตเวลาต่อท้าย)
//    โชว์ดิบ = คนอ่านเห็นเวลาย้อนไป 7 ชั่วโมงแล้วนึกว่าระบบหยุดทำงาน
//    ต้องบวก 7 แล้วเขียนกำกับว่าเป็นเวลาไทยเสมอ
//
// ⚠️ **`gone` ไม่ใช่ error** — คือคีย์ที่หายจากต้นทางแล้วแต่สำเนายังเก็บไว้
//    นั่นคือหัวใจของระบบ (สำเนาไม่ลบตาม) แต่ถ้าเลขนี้พุ่งผิดปกติ = มีอะไรกำลังลบข้อมูล
//    ⇒ ต้องโชว์ ห้ามซ่อน
// ⚠️ **`never` (ถังที่ตั้งใจไม่สำรอง) ต้องโชว์เสมอ** ไม่งั้นเข้าใจว่าสำรองครบทุกถัง
//    ทั้งที่รูปบัตรประชาชนเราตั้งใจไม่เก็บ (ประกาศกับลูกค้าว่าเก็บ 7 วันแล้วลบ)
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, BtnPrimary, TableWrap, TH, THR, TD, TDR } from '@/components/zort'

interface StoreRow {
  store: string; what?: string
  keys?: number; bytes?: number; gone?: number; last?: string
  saved?: number; unchanged?: number; skipped?: number; left?: number
  error?: string
}
interface NeverRow { store: string; why?: string }
interface Status {
  ready?: boolean; why?: string
  lastRun?: string
  stores?: StoreRow[]
  never?: NeverRow[]
  /** ถังที่ระบบคุ้มครองทั้งหมด — เอามาประกบกับ stores เพื่อให้ถังที่ยังไม่มีคีย์โผล่ด้วย */
  protected?: { store: string; what?: string; skip?: string }[]
}
interface RunResult {
  stores?: StoreRow[]
  totals?: { saved?: number; keys?: number; bytes?: number; failed?: number; left?: number }
  never?: NeverRow[]
}
interface DryResult {
  dryRun?: boolean; store?: string
  willWrite?: number; missing?: number; alreadyThere?: number
  sample?: { key: string; bytes?: number; backedUpAt?: string }[]
  note?: string
}
interface RealResult {
  store?: string; written?: number; skippedExisting?: number
  failed?: { key: string; why?: string }[]
}

/** เวลาจากฐานเป็น UTC — บวก 7 แล้วบอกว่าเป็นเวลาไทย ห้ามโชว์ค่าดิบ */
function thaiTime(s?: string | null) {
  if (!s) return '—'
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? `${s.replace(' ', 'T')}Z` : s
  const d = new Date(iso)
  if (isNaN(d.getTime())) return s
  try {
    return `${d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' })} น.`
  } catch {
    return s
  }
}
/** ผ่านมานานเท่าไหร่ — ใช้ตัดสินว่าสำเนา "สด" หรือ "ค้าง" */
function minutesSince(s?: string | null): number | null {
  if (!s) return null
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? `${s.replace(' ', 'T')}Z` : s
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 60000)
}
function fmtBytes(n?: number) {
  if (typeof n !== 'number' || n < 0) return '—'
  if (n < 1024) return `${n} ไบต์`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
const num = (n?: number) => (typeof n === 'number' ? n.toLocaleString('th-TH') : '—')

export default function BackupPage() {
  const [st, setSt] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [run, setRun] = useState<RunResult | null>(null)

  const [bucket, setBucket] = useState('')
  const [oneKey, setOneKey] = useState('')
  const [dry, setDry] = useState<DryResult | null>(null)
  const [dryFor, setDryFor] = useState('')   // ซ้อมไว้กับถัง+คีย์ไหน เปลี่ยนแล้วผลซ้อมหมดอายุ
  const [dryAt, setDryAt] = useState(0)      // ซ้อมไว้เมื่อไหร่ — ผลซ้อมเก่าใช้อนุมัติการเขียนไม่ได้
  const [now, setNow] = useState(0)          // เวลาปัจจุบัน (ตั้งหลัง hydrate เพื่อไม่ให้ SSR เพี้ยน)
  const [real, setReal] = useState<RealResult | null>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/web/core?backupstatus=1')
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setSt((j?.backup ?? j) as Status)
    } catch (e) {
      setSt(null) // ไม่โชว์ของค้าง — ไม่งั้นเข้าใจว่ามีสำเนาทั้งที่อ่านไม่ได้
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  // ⚠️ **ตาข่ายนี้จะหยุดทำงานเมื่อไหร่: เมื่อผลซ้อมเก่าเกินไป**
  //    ซ้อมตอน 9 โมงแล้วกดกู้จริงตอนบ่าย = อนุมัติการเขียนด้วยภาพของเมื่อเช้า
  //    ระหว่างนั้นข้อมูลต้นทางเปลี่ยนได้ (มีคนสั่งของ · งานตามเวลาเขียนคีย์ใหม่)
  //    ⇒ นับเวลาถอยหลังให้เห็น แล้วปิดปุ่มเมื่อหมดอายุ ต้องซ้อมใหม่
  useEffect(() => {
    if (!dryAt) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(t)
  }, [dryAt])

  async function call(qs: string, tag: string) {
    setBusy(tag)
    setMsg('')
    try {
      const res = await fetch(`/api/web/core?${qs}`)
      const j = await res.json()
      // ⚠️ ถังที่ไม่ได้คุ้มครองตอบ HTTP 400 พร้อมข้อความไทย — เอาข้อความนั้นมาโชว์ตรง ๆ
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
    if (!j) return
    const r = (j?.backup ?? j) as RunResult
    setRun(r)
    const failed = Number(r?.totals?.failed) || 0
    setMsg(failed > 0 ? `⚠️ สำรองเสร็จ แต่มี ${failed} ถังที่ไม่สำเร็จ` : '✅ สำรองเรียบร้อย')
    loadStatus()
  }

  const dryKey = `${bucket.trim()}|${oneKey.trim()}`

  async function rehearse() {
    if (!bucket.trim()) return
    setReal(null)
    const qs = `restore=${encodeURIComponent(bucket.trim())}`
      + (oneKey.trim() ? `&key=${encodeURIComponent(oneKey.trim())}` : '')
    const j = await call(qs, 'dry')
    if (j) { setDry(j as DryResult); setDryFor(dryKey); setDryAt(Date.now()) }
  }

  async function restoreReal(overwrite: boolean) {
    const b = bucket.trim()
    if (!b || dryFor !== dryKey || !dry) return
    const willWrite = Number(dry.willWrite) || 0
    const warn = overwrite
      ? `กู้คืนถัง "${b}" แบบทับของเดิม — ข้อมูลที่อยู่ในถังตอนนี้จะถูกเขียนทับด้วยสำเนา ย้อนกลับไม่ได้ ยืนยันไหม`
      : `กู้คืนถัง "${b}" เฉพาะคีย์ที่หายไป ${willWrite.toLocaleString('th-TH')} คีย์ (ไม่ทับของที่ยังอยู่) ยืนยันไหม`
    if (!confirm(warn)) return
    const qs = `restore=${encodeURIComponent(b)}`
      + (oneKey.trim() ? `&key=${encodeURIComponent(oneKey.trim())}` : '')
      + `&confirm=1${overwrite ? '&overwrite=1' : ''}`
    const j = await call(qs, overwrite ? 'over' : 'real')
    if (!j) return
    setReal(j as RealResult)
    // ⚠️ ซ้อมใหม่ก่อนกู้รอบถัดไปเสมอ — ผลซ้อมเก่าไม่ตรงกับสภาพหลังเขียนแล้ว
    setDry(null)
    setDryFor('')
    setDryAt(0)
    setMsg('✅ กู้คืนเรียบร้อย')
    loadStatus()
  }

  const stores = Array.isArray(st?.stores) ? st!.stores! : []
  const nevers = Array.isArray(st?.never) ? st!.never! : []
  const protectedList = Array.isArray(st?.protected) ? st!.protected! : []
  const emptyProtected = protectedList.filter((p) => !stores.some((s) => s.store === p.store))
  const totalKeys = stores.reduce((a, s) => a + (Number(s.keys) || 0), 0)
  const totalBytes = stores.reduce((a, s) => a + (Number(s.bytes) || 0), 0)
  const totalGone = stores.reduce((a, s) => a + (Number(s.gone) || 0), 0)
  const mins = minutesSince(st?.lastRun)
  // สำรองทุกชั่วโมง — เกินสองชั่วโมงแปลว่ารอบอัตโนมัติไม่เดิน ต้องเห็นชัด ไม่ใช่เขียวเงียบ
  const stale = mins !== null && mins > 125
  // ผลซ้อมมีอายุ 5 นาที — พอให้อ่านผลและตัดสินใจ แต่ไม่นานพอให้ข้อมูลต้นทางเปลี่ยนไปมาก
  const DRY_TTL = 5 * 60_000
  const dryLeft = dryAt && now ? Math.max(0, DRY_TTL - (now - dryAt)) : DRY_TTL
  const dryExpired = !!dryAt && !!now && dryLeft <= 0
  const canRestore = !!bucket.trim() && dryFor === dryKey && !!dry && !dryExpired

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สำรองข้อมูล"
        summary="สำเนาของข้อมูลในเว็บ เก็บไว้คนละบริษัทและคนละคีย์กับตัวจริง · ทำเองทุกชั่วโมง"
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
          msg.startsWith('✅') ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : msg.startsWith('⚠️') ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-red-50 border-red-200 text-red-700'
        }`}>{msg}</p>
      )}

      {error && <ErrorBox title="อ่านสถานะสำเนาไม่ได้">{error}</ErrorBox>}
      {loading && !st && <LoadingState />}

      {/* ระบบยังไม่พร้อม — ต้องบอกเหตุผลตรง ๆ ไม่ใช่โชว์ตาราง 0 คีย์แล้วปล่อยให้เดา */}
      {st && st.ready === false && (
        <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2.5 mb-3 leading-relaxed">
          🔴 <b>ระบบสำรองยังไม่พร้อมใช้งาน</b>{st.why ? ` — ${st.why}` : ''}
          <br />
          <span className="text-[12.5px]">แปลว่าตอนนี้<b>ยังไม่มีสำเนา</b> ข้อมูลหายแล้วเรียกคืนไม่ได้</span>
        </div>
      )}

      {st && st.ready !== false && (
        <>
          <div className={`rounded px-3 py-2.5 mb-3 text-[13px] border leading-relaxed ${
            stale ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            {stale
              ? <>⚠️ สำเนาล่าสุดทำเมื่อ <b>{thaiTime(st.lastRun)}</b> ({mins} นาทีที่แล้ว) —
                ปกติทำทุกชั่วโมง ทิ้งช่วงนานกว่านี้แปลว่ารอบอัตโนมัติอาจไม่เดิน กด &quot;สำรองเดี๋ยวนี้&quot; ดูได้</>
              : <>✅ สำเนาล่าสุด <b>{thaiTime(st.lastRun)}</b>
                {mins !== null && <> ({mins < 1 ? 'เมื่อครู่' : `${mins} นาทีที่แล้ว`})</>} ·
                รวม <b>{num(totalKeys)}</b> คีย์ · {fmtBytes(totalBytes)} · {stores.length} ถัง</>}
          </div>

          <TableWrap>
            <table className="w-full min-w-[640px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH}>ถังข้อมูล</th>
                  <th className={THR}>คีย์ที่มีสำเนา</th>
                  <th className={THR}>ขนาด</th>
                  <th className={THR}>เก็บต่อแม้ต้นทางลบ</th>
                  <th className={TH}>สำรองล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {stores.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-[13px] text-gray-400 text-center">ยังไม่มีสำเนาสักถัง</td></tr>
                )}
                {stores.map((s) => (
                  <tr key={s.store} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-800 font-medium`}>{s.store}</td>
                    <td className={TDR}>{num(s.keys)}</td>
                    <td className={TDR}>{fmtBytes(s.bytes)}</td>
                    {/* ⚠️ ไม่ใช่ error — คือคีย์ที่ต้นทางลบไปแล้วแต่สำเนายังอยู่ (จุดประสงค์ของระบบ) */}
                    <td className={TDR}>
                      {Number(s.gone) > 0
                        ? <span className="text-blue-700 font-semibold">{num(s.gone)}</span>
                        : <span className="text-gray-300">0</span>}
                    </td>
                    <td className={`${TD} text-gray-500 whitespace-nowrap`}>{thaiTime(s.last)}</td>
                  </tr>
                ))}
                {/* ⚠️ ถังที่คุ้มครองแต่ยังไม่มีคีย์เลยจะไม่อยู่ใน stores (GROUP BY ไม่มีแถว)
                    ไม่เอามาต่อ = ตารางดูเหมือนคุ้มครองน้อยกว่าความจริง */}
                {emptyProtected.map((p) => (
                  <tr key={p.store} className="border-b border-gray-100 last:border-0">
                    <td className={`${TD} text-gray-500`}>{p.store}</td>
                    <td className={TDR}><span className="text-gray-300">0</span></td>
                    <td className={TDR}><span className="text-gray-300">—</span></td>
                    <td className={TDR}><span className="text-gray-300">0</span></td>
                    <td className={`${TD} text-gray-400 text-[12px]`}>คุ้มครองแล้ว แต่ยังไม่มีข้อมูลให้สำรอง</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            &quot;เก็บต่อแม้ต้นทางลบ&quot; รวม <b>{num(totalGone)}</b> คีย์ — <b>ไม่ใช่ข้อผิดพลาด</b>
            สำเนาตั้งใจไม่ลบตามต้นทาง จึงยังกู้ของที่ถูกลบไปแล้วได้ ·
            แต่ถ้าเลขนี้พุ่งขึ้นผิดปกติ แปลว่ามีอะไรกำลังลบข้อมูลอยู่ ควรมาดู
            <br />
            ตารางนี้รวม<b>ทุกถังที่ระบบคุ้มครอง</b>แล้ว — ถังที่ยังไม่มีข้อมูลก็ขึ้นด้วย
            จะได้ไม่เข้าใจว่าคุ้มครองน้อยกว่าความจริง
          </p>

          {/* ⚠️ ต้องโชว์เสมอ ไม่งั้นเข้าใจว่าสำรองครบทุกถัง */}
          {nevers.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-md p-4 mt-3">
              <p className="text-[13.5px] font-semibold text-gray-900 mb-1">
                ถังที่ <span className="text-gray-600">ตั้งใจไม่สำรอง</span> ({nevers.length})
              </p>
              <p className="text-[12px] text-gray-500 mb-2">
                ไม่ใช่ของตกหล่น — เป็นข้อมูลที่เราประกาศกับลูกค้าว่าจะลบทิ้งตามกำหนด การเก็บสำเนาไว้จะขัดกับที่ประกาศไว้
              </p>
              <div className="space-y-1.5">
                {nevers.map((n) => (
                  <div key={n.store} className="flex flex-wrap gap-2 text-[12.5px]">
                    <span className="text-gray-800 font-medium w-[150px] shrink-0">{n.store}</span>
                    <span className="text-gray-500 min-w-0 flex-1">{n.why ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ───────── ผลการสั่งสำรองเดี๋ยวนี้ ───────── */}
      {run && (
        <div className="bg-white border border-gray-200 rounded-md p-4 mt-3">
          <p className="text-[13.5px] font-semibold text-gray-900 mb-2">ผลรอบที่เพิ่งสั่ง</p>
          {run.totals && (
            <p className="text-[12.5px] text-gray-600 mb-2">
              เขียนใหม่ {num(run.totals.saved)} · รวมคีย์ {num(run.totals.keys)} · {fmtBytes(run.totals.bytes)}
              {Number(run.totals.failed) > 0 && <span className="text-red-600"> · ไม่สำเร็จ {num(run.totals.failed)} ถัง</span>}
              {/* ⚠️ left > 0 = หมดงบเวลา รอบหน้าเก็บต่อ **ไม่ใช่ error** ห้ามขึ้นแดง */}
              {Number(run.totals.left) > 0 && (
                <span className="text-gray-500"> · เหลือ {num(run.totals.left)} คีย์ให้รอบหน้าเก็บต่อ (หมดงบเวลารอบนี้ ไม่ใช่ข้อผิดพลาด)</span>
              )}
            </p>
          )}
          <div className="space-y-1">
            {(run.stores ?? []).map((s) => (
              <div key={s.store} className="flex flex-wrap items-baseline gap-2 text-[12.5px]">
                <span className="text-gray-800 font-medium w-[150px] shrink-0">{s.store}</span>
                {/* ⚠️ ถังที่พลาดจะไม่มี keys/saved เลย — ต้องเช็ค error ก่อนอ่านตัวเลข */}
                {s.error
                  ? <span className="text-red-600">ไม่สำเร็จ: {s.error}</span>
                  : (
                    <span className="text-gray-500">
                      เขียนใหม่ {num(s.saved)} · เหมือนเดิม {num(s.unchanged)} · รวม {num(s.keys)}
                      {Number(s.left) > 0 && ` · เหลือ ${num(s.left)} ให้รอบหน้า`}
                    </span>
                  )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────── กู้คืน ───────── */}
      <div className="bg-white border border-gray-200 rounded-md p-4 mt-3">
        <p className="text-[14.5px] font-semibold text-gray-900">กู้คืนข้อมูล</p>
        <p className="text-[12.5px] text-gray-600 leading-relaxed mt-1">
          การกู้คืนคือการ<b>เขียนข้อมูลจริงของร้าน</b> — หน้านี้จึงบังคับให้<b>ซ้อมก่อนเสมอ</b>
          แล้วดูว่าจะเขียนกี่คีย์ ถึงจะกดจริงได้
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <input
            list="backup-stores"
            value={bucket}
            onChange={(e) => { setBucket(e.target.value); setDry(null); setDryFor(''); setDryAt(0); setReal(null) }}
            placeholder="ชื่อถัง เช่น gucut-orders"
            className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 w-[230px]"
          />
          <datalist id="backup-stores">
            {stores.map((s) => <option key={s.store} value={s.store} />)}
            {protectedList.map((p) => <option key={p.store} value={p.store} />)}
          </datalist>
          <input
            value={oneKey}
            onChange={(e) => { setOneKey(e.target.value); setDry(null); setDryFor(''); setDryAt(0); setReal(null) }}
            placeholder="เฉพาะคีย์เดียว (ไม่ใส่ = ทั้งถัง)"
            className="text-[13px] border border-gray-300 rounded px-2.5 py-1.5 w-[230px]"
          />
          <BtnGhost onClick={rehearse} disabled={!bucket.trim() || !!busy}>
            {busy === 'dry' ? 'กำลังซ้อม…' : 'ซ้อมกู้คืน (ไม่เขียนอะไร)'}
          </BtnGhost>
        </div>

        {dry && (
          <div className="mt-3 border border-blue-100 bg-blue-50 rounded p-3">
            <p className="text-[13px] font-semibold text-blue-900">
              ผลการซ้อมถัง “{dry.store ?? bucket}” — ยังไม่มีอะไรถูกเขียน
            </p>
            <p className="text-[13px] text-blue-900 mt-1.5">
              จะเขียนเพิ่ม <b>{num(dry.willWrite)}</b> คีย์ · หายไปจากต้นทาง {num(dry.missing)} ·
              ยังอยู่ครบ {num(dry.alreadyThere)}
            </p>
            {Number(dry.willWrite) === 0 && (
              <p className="text-[12.5px] text-blue-800 mt-1">
                ไม่มีอะไรต้องกู้ — ข้อมูลต้นทางครบอยู่แล้ว
              </p>
            )}
            {Array.isArray(dry.sample) && dry.sample.length > 0 && (
              <div className="mt-2">
                <p className="text-[12px] text-blue-800 mb-1">ตัวอย่างคีย์ (สูงสุด 10)</p>
                <div className="space-y-0.5">
                  {dry.sample.map((s) => (
                    <div key={s.key} className="flex flex-wrap gap-2 text-[11.5px] text-blue-900">
                      <span className="font-mono">{s.key}</span>
                      <span className="text-blue-700">{fmtBytes(s.bytes)}</span>
                      <span className="text-blue-700">สำรองเมื่อ {thaiTime(s.backedUpAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {dryExpired ? (
              <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-3 leading-relaxed">
                ⏱ ผลการซ้อมนี้<b>เก่าเกิน 5 นาทีแล้ว</b> — ระหว่างนี้ข้อมูลต้นทางอาจเปลี่ยนไป
                (มีออเดอร์เข้า หรืองานตามเวลาเขียนคีย์ใหม่) กดซ้อมใหม่ก่อนกู้คืน
              </p>
            ) : (
              <p className="text-[11.5px] text-gray-500 mt-2">
                ผลซ้อมนี้ใช้อนุมัติการกู้คืนได้อีก {Math.ceil(dryLeft / 60000)} นาที
              </p>
            )}
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

        {real && (
          <div className="mt-3 border border-emerald-200 bg-emerald-50 rounded p-3">
            <p className="text-[13px] font-semibold text-emerald-900">ผลการกู้คืนถัง “{real.store ?? bucket}”</p>
            <p className="text-[13px] text-emerald-900 mt-1">
              เขียนไป <b>{num(real.written)}</b> คีย์ · ข้ามเพราะยังมีอยู่ {num(real.skippedExisting)}
            </p>
            {Array.isArray(real.failed) && real.failed.length > 0 && (
              <div className="mt-2">
                <p className="text-[12.5px] text-red-700 font-semibold">เขียนไม่สำเร็จ {real.failed.length} คีย์</p>
                <div className="space-y-0.5 mt-1">
                  {real.failed.map((f) => (
                    <div key={f.key} className="text-[11.5px] text-red-700">
                      <span className="font-mono">{f.key}</span> — {f.why ?? 'ไม่ทราบสาเหตุ'}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[12px] text-emerald-800 mt-2">ต้องซ้อมใหม่ก่อนกู้คืนรอบถัดไป</p>
          </div>
        )}
      </div>

      <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
        เวลาทั้งหมดบนหน้านี้แปลงเป็น<b>เวลาไทย</b>แล้ว (ฐานข้อมูลเก็บเป็นเวลาสากล) ·
        สำเนาอยู่คนละผู้ให้บริการและคนละคีย์กับตัวจริง — ฝั่งหนึ่งล่มหรือบัญชีมีปัญหา อีกฝั่งยังอยู่
      </p>
    </div>
  )
}
