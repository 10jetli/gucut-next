'use client'
// บทสนทนาจากแว่น Rokid — สิ่งที่เจ้าของร้านพูดใส่แว่น และสิ่งที่แว่นตอบ
//
// **ทำไมหน้านี้มีค่า**: ก่อนมีหน้านี้ ไม่มีใครนอกจากคนใส่แว่นที่เห็นว่าเกิดอะไรขึ้น
// วันที่ 9 ก.ย. 2569 เราไล่บั๊กด้วยการให้เจ้าของร้านถ่ายรูปเลนส์กับ**วาดรูปมาให้ดู**
// ⇒ ช้ามาก และมองไม่เห็นสิ่งที่สำคัญที่สุด: **ตัวถอดเสียงได้ยินว่าอะไร**
//    (พูดชัดแต่ถอดผิด = ไล่โทษเซิร์ฟเวอร์ทั้งวันโดยต้นเหตุอยู่ที่ไมค์)
//
// 🔒 เก็บ 7 วันแล้วลบเอง · เก็บข้อความไม่เก็บเสียง · ไม่ส่งเข้า Telegram
//    (เจ้าของร้านตกลงเงื่อนไขนี้ก่อนเปิดใช้ 9 ก.ย. 2569)
import { useCallback, useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnPrimary } from '@/components/zort'

interface Entry {
  at: string
  question: string
  answer: string
  model: string
  ms: number
  ok: boolean
  error?: string
  stream: boolean
  /** สัญญาณ "โค้ดถูกโหลดขึ้นแว่นแล้ว" — agent ยิงตอน onLoad ก่อนรอคำพูดใด ๆ (9 ก.ย. 2569)
   *  🔑 มีไว้แยก **"แพ็กเกจไม่เคยถึงเครื่อง"** ออกจาก **"ถึงแล้วแต่ไม่ทำงาน"** ให้ขาด
   *     ตามมาสองวันโดยแยกสองอย่างนี้ไม่ออกเลย — ping คือตัวตัดสิน
   *  ⚠️ ต้องมีการ์ดของตัวเอง **ห้ามวาดเป็นบทสนทนา** ไม่งั้นช่องคำถามจะว่าง
   *     แล้วจอเขียนว่า "(ถอดเสียงไม่ได้ข้อความ)" ⇒ สัญญาณที่รอมาสองวัน
   *     หน้าตาเหมือนไมค์พัง และอาจถูกอ่านว่า ping ไม่มา ทั้งที่มาแล้ว */
  ping?: boolean
  /** รุ่นแพ็กเกจที่เครื่องรันอยู่จริง (เช่น 'build-7') — ตอบคำถาม
   *  "เครื่องดึงรุ่นไหนไป" ได้เองโดยไม่ต้องรอ Rokid ตอบ */
  build?: string
}

/** รายการนี้เป็นสัญญาณจากแว่น ไม่ใช่บทสนทนา
 *  ⚠️ รับได้ทั้งช่อง `ping` ตรง ๆ และกรณีที่ฝั่งท่อยัดไว้ในข้อความ — ไม่รู้จักก็ไม่พัง */
const isPing = (e: Entry) =>
  /* ฟิลด์จริงเป็นตัวตัดสิน — ท่อยืนยันสัญญาแล้ว (3949adc: ping?: boolean · build?: string)
     ⚠️ ทางถอยจับข้อความไว้เผื่อ deploy เหลื่อม (จอใหม่ + ท่อรุ่นก่อนที่ยังไม่มีฟิลด์)
        ใช้คำว่า "สัญญาณชีพ" ไม่ใช่ /^ping/ เพราะข้อความจริงขึ้นต้นด้วยอิโมจิ
        ⇒ regex ที่ยึดต้นบรรทัดจะไม่ match เลย (ฝั่งท่อทักมาเอง — ตาข่ายที่ไม่เคยยิงจริง
        มักถูกเขียนให้จับสิ่งที่เรา *คิดว่า* ข้อมูลหน้าตาเป็น ไม่ใช่สิ่งที่มันเป็นจริง) */
  e.ping === true || /สัญญาณชีพ/.test(e.question ?? '')
interface Resp { ok?: boolean; count?: number; pruned?: number; entries?: Entry[]; error?: string }

/** เพดานของแว่น — เกินนี้แว่นทิ้งคำขอแล้วขึ้น "request timeout after 5000ms"
 *  ⚠️ ตัวเลขนี้เป็นค่า **เริ่มต้น** ของ AIUI ไม่ใช่เพดานตายตัว
 *     ถ้าวันไหนตั้ง `timeout` ในโค้ดแว่นแล้ว ต้องมาแก้เลขนี้ให้ตรง ไม่งั้นจอจะเตือนผิด */
const GLASSES_TIMEOUT_MS = 5000

/** UTC → เวลาไทย พร้อมเขียนกำกับ (กติกาเวลาใน CLAUDE.md: ห้ามโชว์ค่าดิบ) */
function thaiTime(iso: string) {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const d = new Date(t + 7 * 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

export default function GlassesLogPage() {
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/glasses-log', { cache: 'no-store' })
      const j: Resp = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error || `ดึงไม่สำเร็จ (${r.status})`)
      setData(j)
    } catch (e) {
      // "ดึงไม่สำเร็จ" ต้องไม่กลายเป็น "ไม่มีบทสนทนา" — คนละเรื่องกันคนละทาง
      setError(e instanceof Error ? e.message : String(e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const entries = data?.entries ?? []
  const slow = entries.filter(e => e.ms > GLASSES_TIMEOUT_MS).length
  const failed = entries.filter(e => !e.ok && !isPing(e)).length
  /* รายการเรียงใหม่สุดก่อนอยู่แล้ว ⇒ ตัวแรกที่เป็น ping คือครั้งล่าสุด */
  const lastPing = entries.find(isPing) ?? null

  return (
    <div className="space-y-4">
      <PageHead
        title="บทสนทนาจากแว่น"
        summary="สิ่งที่พูดใส่แว่น Rokid และสิ่งที่ได้ตอบกลับ · เก็บ 7 วันแล้วลบอัตโนมัติ"
        actions={<BtnPrimary onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'โหลดใหม่'}</BtnPrimary>}
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {loading && !data && <LoadingState />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard icon="🕶️" label="บทสนทนา (7 วัน)" value={String(data.count ?? 0)} />
            <StatCard
              icon="⏱️"
              label={`ช้าเกิน ${GLASSES_TIMEOUT_MS / 1000} วิ`}
              value={String(slow)}
              note="แว่นทิ้งคำขอพวกนี้ ถ้ายังไม่ได้ตั้ง timeout ในโค้ดแว่น"
              tone={slow > 0 ? 'red' : 'gray'}
            />
            <StatCard icon="⚠️" label="ล้มเหลว" value={String(failed)} tone={failed > 0 ? 'red' : 'gray'} />
            {/* 🔑 ช่องที่คนเปิดจอนี้มาหาตอนนี้: **แว่นเคยโหลดโค้ดขึ้นเครื่องไหม**
                ⚠️ ไม่มี ping = "ยังไม่เคยเห็น" ห้ามเขียนว่า "ไม่เคยโหลด" —
                   ping เพิ่งเริ่มมีในแพ็กเกจรุ่นใหม่ ของเก่าจึงไม่มีสัญญาณนี้อยู่แล้ว */}
            <StatCard
              icon="🕶️"
              label="โหลดขึ้นเครื่องล่าสุด"
              value={lastPing ? (lastPing.build || 'ไม่บอกรุ่น') : 'ยังไม่เคยเห็น'}
              note={lastPing ? `${thaiTime(lastPing.at)} น.` : 'ยังไม่มีสัญญาณจากแว่นในช่วง 7 วัน'}
              tone={lastPing ? 'green' : 'gray'}
            />
          </div>

          {entries.length === 0 && (
            /* ⚠️ ข้อความนี้ต้องไม่กำกวม — "ยังไม่มี" ไม่เท่ากับ "ระบบพัง"
               และเราแยก "ดึงไม่สำเร็จ" ออกไปอยู่ใน ErrorBox ข้างบนแล้ว */
            <Card>
              <p className="p-4 text-sm text-slate-600">
                ยังไม่มีบทสนทนาในช่วง 7 วันที่ผ่านมา — ลองพูดใส่แว่นหนึ่งครั้งแล้วกดโหลดใหม่
              </p>
            </Card>
          )}

          {entries.map((e, i) => isPing(e) ? (
            /* 🟢 สัญญาณจากแว่น — พิสูจน์ว่าโค้ดถึงเครื่องแล้ว (ไม่ใช่บทสนทนา) */
            <Card key={`${e.at}-${i}`}>
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  🟢 แว่นโหลดโค้ดขึ้นเครื่องแล้ว
                </span>
                <span className="text-slate-600">
                  รุ่น {e.build
                    ? <b className="font-mono">{e.build}</b>
                    : <span className="text-slate-400">ไม่ได้บอกรุ่นมา</span>}
                </span>
                <span className="text-xs text-slate-500">{thaiTime(e.at)} น. (เวลาไทย)</span>
              </div>
            </Card>
          ) : (
            <Card key={`${e.at}-${i}`}>
              <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs text-slate-500">
                <span>{thaiTime(e.at)} น. (เวลาไทย)</span>
                <span className={e.ms > GLASSES_TIMEOUT_MS ? 'font-semibold text-red-600' : 'text-slate-600'}>
                  {(e.ms / 1000).toFixed(2)} วิ
                  {e.ms > GLASSES_TIMEOUT_MS && ' — เกินเพดานแว่น'}
                </span>
                <span>{e.model}</span>
                {e.stream && <span>สตรีม</span>}
                {!e.ok && <span className="font-semibold text-red-600">ล้มเหลว</span>}
              </div>
              <div className="space-y-2 px-4 py-3 text-sm">
                <p>
                  <span className="text-slate-500">พูดว่า: </span>
                  <span className="font-medium">{e.question || <em className="text-slate-400">(ถอดเสียงไม่ได้ข้อความ)</em>}</span>
                </p>
                {e.ok ? (
                  <p className="whitespace-pre-wrap text-slate-700">{e.answer}</p>
                ) : (
                  <p className="text-red-600">{e.error || 'ไม่ทราบสาเหตุ'}</p>
                )}
              </div>
            </Card>
          ))}

          {(data.pruned ?? 0) > 0 && (
            <p className="text-xs text-slate-500">ลบของเกิน 7 วันไปแล้ว {data.pruned} รายการในรอบนี้</p>
          )}
        </>
      )}
    </div>
  )
}
