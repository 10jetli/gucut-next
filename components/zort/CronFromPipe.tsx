'use client'
// เทียบตาราง cron บนจอ กับตารางที่ท่อสร้างจากซอร์สจริง (18 ก.ย. 2569)
//
// ทำไมต้องมี: ตาราง cron ถูกลอกไว้สองที่ (ไฟล์ฟังก์ชันฝั่งท่อ + ตารางบนจอนี้)
// 18 ก.ย. 2569 ตารางเปลี่ยน **สองรอบในวันเดียว** และจอค้างค่าของรอบกลางอยู่ครึ่งวัน
// ด่าน `scripts/check-cron-table.mjs` จับได้ตอน build — แต่ **จับได้ก็ต่อเมื่อมีคน build**
// ⇒ ตัวนี้เทียบให้ตอนเปิดจอด้วย · คนที่เปิดจอคือคนที่กำลังจะเชื่อตัวเลขนั้น
//
// CEO ทำเส้นให้ตามที่ขอ (ยังไม่ deploy ตอนเขียน): `?crontable=1`
//   { ok, generatedAt, source, jobs:[{id,file,cron,desc}] | null, ทั้งหมด, readError, '⚠️ ขอบเขต' }
//   · `jobs` เป็น **null** เมื่ออ่านตารางไม่ได้ — ตั้งใจไม่ใช่ `[]` เพราะ [] อ่านได้ว่า "ไม่มีงานตามเวลา"
//   · `generatedAt` = เวลา **build** ของท่อ ไม่ใช่เวลายิงคำขอ
//
// 🔴 **กับดักที่ต้องดักเอง: ท่อรุ่นเก่าตอบ HTTP 200** พร้อม `fallthrough: true`
//    (ยิงของจริง 18 ก.ย. 2569 ได้ก้อน counts/recon ของเส้น default มาแทน)
//    ⇒ เช็คแค่ res.ok จะอ่านว่า "สำเร็จแต่ไม่มีงานสักตัว" = คำตอบที่ดูสมบูรณ์ทั้งที่ยังไม่มีเส้นนี้
//    ⇒ ต้องแยกให้ได้สามทาง: ท่อยังไม่มีเส้นนี้ ≠ ท่ออ่านตารางไม่ได้ ≠ ท่อส่งตารางมาจริง
import { useEffect, useState } from 'react'
import PipeNote from '@/components/ui/PipeNote'

interface PipeJob { id?: string; file?: string; cron?: string; desc?: string }
interface Resp {
  ok?: boolean
  generatedAt?: string
  source?: string
  jobs?: PipeJob[] | null
  'ทั้งหมด'?: number
  readError?: string | null
  '⚠️ ขอบเขต'?: string
  fallthrough?: boolean
  error?: string
}

/** ชื่อไฟล์ล้วน — จอเขียนเป็นเส้นทางเต็ม ท่อส่งมาคนละทรงได้ */
const ชื่อไฟล์ = (s: string) => (s.match(/([^\s'"·]+\.mjs)/)?.[1] ?? s).split('/').pop() ?? s

type สถานะ = 'กำลังถาม' | 'ท่อยังไม่มีเส้นนี้' | 'ท่ออ่านไม่ได้' | 'ถามไม่สำเร็จ' | 'ได้ตาราง'

export default function CronFromPipe({ jobs }: { jobs: Array<{ src: string; cron: string; name: string }> }) {
  const [st, setSt] = useState<สถานะ>('กำลังถาม')
  const [d, setD] = useState<Resp | null>(null)
  const [why, setWhy] = useState('')

  useEffect(() => {
    let ยกเลิกแล้ว = false
    ;(async () => {
      try {
        const res = await fetch('/api/web/core?crontable=1')
        const j = (await res.json().catch(() => null)) as Resp | null
        if (ยกเลิกแล้ว) return
        if (j === null) { setWhy(`อ่านคำตอบไม่ออก (HTTP ${res.status})`); setSt('ถามไม่สำเร็จ'); return }
        /* 🔴 **ลำดับนี้สำคัญ — ทดสอบจริงจับได้ 18 ก.ย. 2569**
           ฉบับแรกเช็ค "ไม่มีช่อง jobs" ก่อน ⇒ ท่อล่มตอบ 500 {error} ซึ่งก็ไม่มีช่อง jobs เหมือนกัน
           ⇒ จอรายงานว่า **ท่อรุ่นเก่า** (ข้อความสีเทา อ่านแล้วสบายใจ) ทั้งที่ท่อกำลังล่ม
              = โรคประจำโปรเจกต์ ระบบทำงานถูก แต่สื่อสารผิด · ความพังต้องมาก่อนการอนุมาน */
        if (!res.ok || j.error) { setWhy(j.error || `ท่อตอบ ${res.status}`); setSt('ถามไม่สำเร็จ'); return }
        /* ท่อรุ่นเก่า: **200** + fallthrough หรือไม่มีช่อง jobs ⇒ ไม่ใช่ความพัง แค่ยังไม่มีเส้นนี้ */
        if (j.fallthrough === true || !('jobs' in j)) { setD(j); setSt('ท่อยังไม่มีเส้นนี้'); return }
        setD(j)
        setSt(Array.isArray(j.jobs) ? 'ได้ตาราง' : 'ท่ออ่านไม่ได้')
      } catch (e) {
        if (!ยกเลิกแล้ว) { setWhy(String(e instanceof Error ? e.message : e)); setSt('ถามไม่สำเร็จ') }
      }
    })()
    return () => { ยกเลิกแล้ว = true }
  }, [])

  const กล่อง = (tone: 'gray' | 'amber' | 'red' | 'green', ใน: React.ReactNode) => {
    const สี = {
      gray: 'text-gray-600 bg-gray-50 border-gray-200',
      amber: 'text-amber-900 bg-amber-50 border-amber-200',
      red: 'text-red-900 bg-red-50 border-red-200',
      green: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    }[tone]
    return <div className={`text-[12px] border rounded-md px-3.5 py-2.5 mb-4 leading-relaxed ${สี}`}>{ใน}</div>
  }

  if (st === 'กำลังถาม') return กล่อง('gray', <>⏳ กำลังถามท่อว่าตารางจริงเป็นยังไง…</>)

  if (st === 'ท่อยังไม่มีเส้นนี้')
    return กล่อง('gray', <>
      ℹ️ <b>ท่อรุ่นที่วิ่งอยู่ยังไม่มีเส้นตาราง cron</b> — ตัวเลขข้างล่างจึงเป็น<b>ค่าที่จอจำไว้</b>
      {' '}(ตรวจกับซอร์สครั้งล่าสุดตอน build ด้วยด่าน <code>check-cron-table</code>)
      {' '}· ยังไม่ได้แปลว่าผิด แต่<b>ยังไม่มีอะไรยืนยันตอนนี้</b>
    </>)

  if (st === 'ถามไม่สำเร็จ')
    return กล่อง('amber', <>⚠️ <b>ถามตารางจากท่อไม่สำเร็จ</b> — {why} · ตัวเลขข้างล่างเป็นค่าที่จอจำไว้ (ถามไม่ได้ ≠ ไม่ตรง)</>)

  if (st === 'ท่ออ่านไม่ได้')
    return กล่อง('red', <>
      🔴 <b>ท่อบอกเองว่าอ่านตาราง cron ไม่ได้</b>{d?.readError ? <> — {d.readError}</> : null}
      {' '}⇒ ตัวเลขข้างล่างยังยืนยันไม่ได้
    </>)

  /* ── ได้ตารางจริง: เทียบทีละไฟล์ ── */
  const ของท่อ = new Map<string, string>()
  for (const j of d?.jobs ?? []) if (j.file && j.cron) ของท่อ.set(ชื่อไฟล์(j.file), j.cron)

  /* แถวที่ไฟล์อยู่ repo นี้ ท่อไม่รู้จัก — ไม่ใช่ "หาย" (ไม่รู้ ≠ ไม่มี) */
  const ของจอ = jobs.filter((j) => !j.src.includes('(repo นี้)'))
  const ต่างกัน = ของจอ
    .map((j) => ({ ...j, ท่อ: ของท่อ.get(ชื่อไฟล์(j.src)) }))
    .filter((j) => j.ท่อ && j.ท่อ !== j.cron)
  const ท่อไม่รู้จัก = ของจอ.filter((j) => !ของท่อ.has(ชื่อไฟล์(j.src)))
  const จอไม่มี = Array.from(ของท่อ.keys()).filter((f) => !ของจอ.some((j) => ชื่อไฟล์(j.src) === f))

  const เวลาสร้าง = d?.generatedAt
    ? new Date(d.generatedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  if (!ต่างกัน.length && !ท่อไม่รู้จัก.length && !จอไม่มี.length)
    return กล่อง('green', <>
      ✅ <b>ตารางบนจอตรงกับซอร์สจริงของท่อ</b> ({ของจอ.length} งานที่เทียบได้)
      {เวลาสร้าง && <> · ตารางฝั่งท่อสร้างตอน build รอบ <b>{เวลาสร้าง} น.</b></>}
      {d?.['⚠️ ขอบเขต'] && <span className="block mt-1 text-gray-600">⚠️ <PipeNote>{d['⚠️ ขอบเขต']}</PipeNote></span>}
    </>)

  return กล่อง('red', <>
    🔴 <b>ตารางบนจอไม่ตรงกับซอร์สจริงของท่อ</b> — เชื่อฝั่งท่อ ไม่ใช่ตัวเลขข้างล่าง
    {เวลาสร้าง && <> (ตารางฝั่งท่อสร้างตอน build รอบ {เวลาสร้าง} น.)</>}
    {ต่างกัน.length > 0 && (
      <ul className="mt-1.5 space-y-0.5">
        {ต่างกัน.map((j) => (
          <li key={j.src}>
            · <b>{j.name}</b> — จอว่า <code>{j.cron}</code> · <b>ท่อว่า <code>{j.ท่อ}</code></b>
          </li>
        ))}
      </ul>
    )}
    {/* ⚠️ สองกองล่างนี้ไม่ใช่ความผิดพลาดเสมอไป — บอกไว้ไม่ให้คนแก้ผิดทาง */}
    {ท่อไม่รู้จัก.length > 0 && (
      <p className="mt-1.5 text-red-800">
        · จอมี {ท่อไม่รู้จัก.length} งานที่<b>ท่อไม่รู้จักไฟล์</b>: {ท่อไม่รู้จัก.map((j) => j.name).join(' · ')}
        {' '}— อาจเป็นงานที่ถูกถอดออกไปแล้ว หรือชื่อไฟล์เปลี่ยน
      </p>
    )}
    {จอไม่มี.length > 0 && (
      <p className="mt-1.5 text-red-800">
        · ท่อมี {จอไม่มี.length} งานที่<b>ไม่มีแถวบนจอนี้</b>: <span className="font-mono">{จอไม่มี.join(' · ')}</span>
        {' '}— งานที่วิ่งอยู่จริงแต่ไม่มีใครเห็นบนจอ
      </p>
    )}
    {d?.['⚠️ ขอบเขต'] && <span className="block mt-1.5 text-gray-600">⚠️ <PipeNote>{d['⚠️ ขอบเขต']}</PipeNote></span>}
  </>)
}
