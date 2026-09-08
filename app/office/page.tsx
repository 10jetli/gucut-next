'use client'
// 🤖 ห้องทำงาน AI — Usage สดของทีมสามตัว (เจ้าของร้านสั่ง "live จริง ๆ + online" 7 ก.ย. 2569)
//
// ท่อ: GET /api/office ฝั่ง gucut.com (ผ่านท่อกลาง /api/web/office) — เส้นใหม่แยกจาก /api/core
// ตัวส่ง: ~/claude-shared/office-push.py ในเครื่องร้าน ยิงทุก 60 วิ (หนึ่งบัญชี = หนึ่งคีย์)
//
// 🔴 สามกติกาที่ CEO เขียนไว้ในหัวไฟล์ท่อ — จอนี้ต้องเคารพครบ:
// 1) **คนที่ไม่มีแถว = ไม่รู้ ห้ามวาด 0%** — Codex ไม่ทิ้งไฟล์สถานะ จะไม่มีแถวถาวร
//    0% แปลว่า "ยังไม่ได้ใช้เลย" ซึ่งตรงข้ามกับ "ไม่รู้" (บทเรียน statusline-last.json)
//    ⇒ ทะเบียนสมาชิกทีมอยู่ฝั่งจอ คนที่ไม่มีแถวขึ้น "รอรายงาน" เป็นแถวจริง
//      (absence มีแถว — เวที #4) ไม่ใช่หายไปเงียบ ๆ
// 2) **null ในฟิลด์ = ไม่รู้** ไม่ใช่ 0 — วาดขีด ไม่วาดแถบ
// 3) **อายุข้อมูลคิดจาก now - at ที่ท่อส่งมา** ห้ามใช้ Date.now() เครื่องคนดู
//    เกิน ~5 นาที = เตือน (ตัวส่งในเครื่องอาจตายเงียบ)
//
// ⚠️ จอนี้รีเฟรชเองทุก 60 วิ (ตรงจังหวะตัวส่ง — ถี่กว่านี้เปลืองเปล่า) พร้อมปุ่มหยุด
//    เป็น**ข้อยกเว้นที่เจ้าของร้านสั่งเอง** ("live จริง ๆ") ของกติกา "หน้าจอต้องกดเอง"
//    — ขอบเขตข้อยกเว้น: จอนี้จอเดียว ห้ามลามไปจออื่น
import { useCallback, useEffect, useRef, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, Pill } from '@/components/zort'

interface AgentRow {
  agent?: string
  five?: number | null
  week?: number | null
  ctx?: number | null
  model?: string | null
  cost?: number | null
  commits?: number | null
  at?: number | null
}
interface OwnerTask {
  id?: string; text?: string; note?: string; done?: boolean
  at?: number | null; doneAt?: number | null
  /** เจ้าของร้านกด "พร้อมทำ" — ท่อเด้ง Telegram เรียก AI แล้ว (8 ก.ย. 2569) */
  ready?: boolean; readyAt?: number | null
}
interface Resp { now?: number; agents?: AgentRow[]; tasks?: OwnerTask[]; error?: string; skip?: string }

/** ทะเบียนทีม — ใครควรมีแถว · คนหายต้องเห็นเป็นแถว "รอรายงาน" ไม่ใช่หายเงียบ */
const TEAM: Array<{ key: string; label: string; role: string }> = [
  { key: 'gucut', label: 'gucut (CEO)', role: 'ฝั่งท่อ · gucut-web' },
  { key: 'gucut2', label: 'gucut2 (คุณส้ม)', role: 'ฝั่งจอ · gucut-next' },
  { key: 'codex', label: 'Codex', role: 'มือเสริม · branch codex/*' },
]

function Bar({ pct }: { pct: number | null | undefined }) {
  /* กติกาข้อ 2: null/ไม่ใช่เลข = ขีด ห้ามวาดแถบ (แถบว่าง 0% คือคำโกหกคนละเรื่อง) */
  if (typeof pct !== 'number' || !Number.isFinite(pct)) {
    return <span className="text-[12px] text-gray-400" title="ค่านี้อ่านไม่ได้จากตัวส่ง — ไม่รู้ ไม่ใช่ศูนย์">ไม่รู้</span>
  }
  const p = Math.max(0, Math.min(100, pct))
  const tone = p >= 80 ? 'bg-red-500' : p >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-[72px] h-[8px] rounded-full bg-gray-200 overflow-hidden">
        <span className={`block h-full ${tone}`} style={{ width: `${p}%` }} />
      </span>
      <span className="text-[12px] text-gray-700 tabular-nums w-[34px]">{p}%</span>
    </span>
  )
}

export default function OfficePage() {
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [live, setLive] = useState(true)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/web/office')
      const j = (await res.json().catch(() => null)) as Resp | null
      if (j === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof j.skip === 'string') throw new Error(j.skip)
      if (!res.ok || j.error) throw new Error(j.error || `ท่อตอบ ${res.status}`)
      if (typeof j.now !== 'number' || !Array.isArray(j.agents))
        throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี now/agents)')
      setD(j); setError('')
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      /* คงข้อมูลเก่าไว้ให้ดูได้ — แต่ error ขึ้นคู่กันเสมอ ไม่แกล้งสด */
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    if (live) {
      timer.current = setInterval(load, 60_000)
      return () => { if (timer.current) clearInterval(timer.current) }
    }
    return undefined
  }, [load, live])

  /* งานเจ้าของร้าน — ผลสำเร็จเขียนได้เมื่อปลายทางยืนยัน (ตอบอ่านไม่ออก = ไม่รู้ผล ห้ามกดซ้ำ) */
  const [taskBusy, setTaskBusy] = useState('')
  const [taskErr, setTaskErr] = useState('')
  /* กันมือลั่นบนมือถือ (เหตุจริง 8 ก.ย.: เจ้าของร้าน tap พลาดติ๊กจบ 2 ข้อแล้วย้อนไม่ได้)
     — ติ๊กจบต้องกดสองจังหวะ: แตะช่อง → แถวขึ้นปุ่มยืนยัน/ยกเลิก · ปุ่มอื่นไม่ต้อง confirm
     (ถอนติ๊ก/พร้อมทำ ย้อนได้เองอยู่แล้ว ความเสียหายจากมือลั่นต่ำ) */
  const [confirmId, setConfirmId] = useState('')
  const postTask = useCallback(async (body: Record<string, string>) => {
    const id = Object.values(body)[0]
    setTaskBusy(id); setTaskErr(''); setConfirmId('')
    try {
      const res = await fetch('/api/web/office', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => null)
      if (j === null) { setTaskErr('ส่งแล้วแต่อ่านคำตอบไม่ออก — ไม่รู้ผล อย่าเพิ่งกดซ้ำ กดรีเฟรชดูสถานะจริงก่อน'); return }
      if (!res.ok || j.error) throw new Error(j.error || `ท่อตอบ ${res.status}`)
      await load()
    } catch (e) { setTaskErr(String(e instanceof Error ? e.message : e)) } finally { setTaskBusy('') }
  }, [load])

  const rows = TEAM.map((m) => {
    const r = (d?.agents ?? []).find((a) => (a.agent ?? '').toLowerCase() === m.key)
    /* กติกาข้อ 3: อายุจากนาฬิกาเซิร์ฟเวอร์ (now - at) — เครื่องคนดูเชื่อไม่ได้ */
    const ageMin = r && typeof r.at === 'number' && typeof d?.now === 'number'
      ? Math.max(0, (d.now - r.at) / 60e3) : null
    return { ...m, r, ageMin }
  })

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ห้องทำงาน AI"
        summary={
          <>
            Usage สดของทีมสามตัว — อัปเดตเองทุก 60 วิ ตามจังหวะตัวส่ง
            {' | '}
            <span className="text-gray-400">ตัวเลขจาก statusline ของแต่ละบัญชี · หนึ่งบัญชี = หนึ่งคีย์</span>
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <BtnGhost onClick={() => setLive((v) => !v)}>{live ? '⏸ หยุดอัปเดตเอง' : '▶ อัปเดตเองทุก 60 วิ'}</BtnGhost>
            <BtnGhost onClick={load}>รีเฟรชเดี๋ยวนี้</BtnGhost>
          </div>
        }
      />

      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดึงข้อมูลห้องทำงานไม่ได้'}>{error}</ErrorBox>}
      {loading && !d && <LoadingState />}

      {d && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rows.map((m) => (
            <div key={m.key} className={`bg-white border rounded-md p-4 ${m.r ? 'border-gray-200' : 'border-dashed border-gray-300'}`}>
              <div className="flex items-start justify-between gap-2 mb-0.5">
                <p className="text-[14.5px] font-semibold text-gray-900">{m.label}</p>
                {m.r
                  ? m.ageMin !== null && m.ageMin > 5
                    ? <Pill tone="orange">ข้อมูลเก่า {Math.floor(m.ageMin)} นาที</Pill>
                    : <Pill tone="green">สด{m.ageMin !== null ? ` · ${Math.floor(m.ageMin)} นาทีก่อน` : ''}</Pill>
                  : <Pill tone="gray">รอรายงาน</Pill>}
              </div>
              <p className="text-[11.5px] text-gray-400 mb-3">{m.role}{m.r?.model ? ` · ${m.r.model}` : ''}</p>

              {m.r ? (
                <>
                  <dl className="space-y-2 text-[12px]">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">โควตา 5 ชม.</dt><dd><Bar pct={m.r.five} /></dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">โควตา 7 วัน</dt><dd><Bar pct={m.r.week} /></dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">หน้าต่างสนทนา</dt><dd><Bar pct={m.r.ctx} /></dd>
                    </div>
                  </dl>
                  <div className="flex items-center gap-3 mt-3 text-[11.5px] text-gray-500">
                    {typeof m.r.commits === 'number' && <span>commit วันนี้ {m.r.commits}</span>}
                    {typeof m.r.cost === 'number' && <span>ค่าใช้จ่ายสะสม ${m.r.cost.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>}
                  </div>
                  {m.ageMin !== null && m.ageMin > 5 && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2.5">
                      ⚠️ ตัวส่งของบัญชีนี้เงียบเกิน 5 นาที — เครื่อง/สคริปต์ office-push อาจตายเงียบ
                      ตัวเลขข้างบนคือภาพเก่า ไม่ใช่ปัจจุบัน
                    </p>
                  )}
                </>
              ) : (
                /* กติกาข้อ 1: ไม่มีแถว = ไม่รู้ — ห้ามแถบ 0% · absence ต้องมีแถวและบอกเหตุ */
                <p className="text-[12px] text-gray-400 leading-relaxed">
                  ยังอ่านตัวเลขของสมาชิกนี้ไม่ได้ — ไม่ได้แปลว่าไม่ได้ใช้งาน
                  {m.key === 'codex' && <> (Codex ไม่ทิ้งไฟล์สถานะให้อ่าน — จะขึ้นตรงนี้จนกว่าจะหาทางอ่านได้จริง)</>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── กระดานงานรอเจ้าของร้าน (เจ้าของร้านสั่งเพิ่ม 8 ก.ย. 2569) ──
          สามสถานะ: ท่อรุ่นเก่าไม่ส่ง tasks ≠ ส่งมาแต่ว่าง ≠ ยังโหลด · done เก็บให้เห็น ไม่ซ่อนทันที */}
      {d && (
        <div className="bg-white border border-gray-200 rounded-md p-4 mt-4">
          <p className="text-[14px] font-semibold text-gray-900 mb-2">📋 งานรอเจ้าของร้าน</p>
          {taskErr && <p className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5 mb-2">{taskErr}</p>}
          {!Array.isArray(d.tasks) ? (
            <p className="text-[12px] text-gray-400">ท่อรุ่นที่รันอยู่ยังไม่ส่งรายการงานมา — ขึ้นเองหลัง deploy รุ่นใหม่ ไม่ต้องแก้จอ</p>
          ) : d.tasks.length === 0 ? (
            <p className="text-[12.5px] text-emerald-700">ไม่มีงานค้าง 🎉</p>
          ) : (
            <ul className="space-y-1.5">
              {[...d.tasks].sort((a, b) => Number(a.done ?? false) - Number(b.done ?? false)).map((t) => {
                const ageMin = typeof t.at === 'number' && typeof d.now === 'number'
                  ? Math.max(0, (d.now - t.at) / 60e3) : null
                const ageText = ageMin === null ? '' : ageMin < 60 ? `${Math.floor(ageMin)} นาที`
                  : ageMin < 1440 ? `${Math.floor(ageMin / 60)} ชม.` : `${Math.floor(ageMin / 1440)} วัน`
                return (
                  <li key={t.id ?? t.text} className="flex items-start gap-2.5">
                    {t.done ? (
                      <span className="text-emerald-500 text-[14px] leading-5">✓</span>
                    ) : (
                      <button onClick={() => t.id && setConfirmId(t.id)} disabled={!t.id || taskBusy === t.id}
                        title={t.id ? 'ติ๊กว่าเสร็จแล้ว (มีขั้นยืนยันก่อน)' : 'งานนี้ไม่มี id — ติ๊กไม่ได้'}
                        className="w-[18px] h-[18px] mt-0.5 rounded border-2 border-gray-300 hover:border-emerald-500 disabled:opacity-40 shrink-0" />
                    )}
                    <span className={`text-[13px] leading-5 min-w-0 ${t.done ? 'text-gray-300 line-through' : 'text-gray-800'}`}>
                      {t.text || '(ไม่มีข้อความ)'}
                      {!t.done && t.ready && (
                        <span className="ml-1.5 text-[10px] text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 no-underline whitespace-nowrap">
                          🙋 รอ AI พาทำ
                        </span>
                      )}
                      {t.note && <span className={`block text-[11px] ${t.done ? 'text-gray-300' : 'text-gray-400'}`}>{t.note}</span>}
                      {/* ยืนยันสองจังหวะ — เหตุจริง: มือลั่นบนมือถือติ๊กจบผิด 2 ข้อ */}
                      {confirmId === t.id && !t.done && (
                        <span className="block mt-1">
                          <button onClick={() => t.id && postTask({ taskDone: t.id })}
                            className="text-[11px] font-semibold text-white bg-emerald-600 rounded px-2.5 py-1 mr-1.5">
                            ✓ ยืนยัน เสร็จแล้วจริง
                          </button>
                          <button onClick={() => setConfirmId('')} className="text-[11px] text-gray-500 border border-gray-300 rounded px-2.5 py-1">
                            ยกเลิก
                          </button>
                        </span>
                      )}
                    </span>
                    <span className="text-[10.5px] text-gray-400 ml-auto whitespace-nowrap mt-0.5 text-right">
                      {t.done ? (
                        <>
                          เสร็จแล้ว
                          <button onClick={() => t.id && postTask({ taskUndo: t.id })} disabled={!t.id || taskBusy === t.id}
                            className="block text-[10px] text-gray-400 hover:text-amber-700 hover:underline disabled:opacity-40">
                            ถอนติ๊ก
                          </button>
                        </>
                      ) : (
                        <>
                          {ageText ? `ค้าง ${ageText}` : ''}
                          {!t.ready && (
                            <button onClick={() => t.id && postTask({ taskReady: t.id })} disabled={!t.id || taskBusy === t.id}
                              title="ติดธงว่าพร้อมทำ แล้วเด้ง Telegram เรียกทีม AI"
                              className="block text-[10px] text-blue-600 hover:underline disabled:opacity-40">
                              🙋 พร้อมทำ — เรียก AI
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <p className="text-[11.5px] text-gray-400 mt-4 leading-relaxed">
        อายุข้อมูลคิดจากนาฬิกาเซิร์ฟเวอร์ (now − at ของท่อ) ไม่ใช่นาฬิกาเครื่องที่เปิดดู ·
        จอนี้อัปเดตเองเป็น<b>ข้อยกเว้นที่เจ้าของร้านสั่ง</b> (&ldquo;live จริง ๆ&rdquo; 7 ก.ย. 2569)
        ของกติกาหน้าจอต้องกดเอง — จำกัดจอนี้จอเดียว
      </p>
    </div>
  )
}
