'use client'
// ผังการทำงานของ ZORT — **แต่ละเมนูเชื่อมกันยังไง ทำงานยังไง**
//
// ท่านประธานสั่ง 20 ก.ย. 2569: "แบแผนผังสถาปัตยกรรมการทำงานของโปรแกรม ZORT ใส่ในเมนู JET
// ให้ดูหน่อย และอัปเดตด้วยตอนแก้ไขหรืออัปเดต"
//
// ⚠️ **ห้ามพิมพ์ตัวเลขหรือชื่อเมนูลงหน้านี้เด็ดขาด** — ทุกอย่างมาจาก /api/web/core?zortarch=1
//    ซึ่งฝั่งท่อสร้างใหม่ทุกครั้งที่ deploy (scripts/gen-zort-arch.mjs) ⇒ ผังอัปเดตเองตามที่ท่านสั่ง
//    ผังที่คนกรอกเองจะกลายเป็นของโกหกภายในไม่กี่สัปดาห์ โดยไม่มีอะไรฟ้อง
//
// 🔑 **เส้นลูกศรไม่เท่ากันทุกเส้น และหน้านี้ต้องทำให้เห็นข้อนั้น**
//    ฝั่งท่อติด `basis` มากับทุกเส้นว่า "รู้ได้ยังไง" — ถ้าเราวาดเส้นที่ยังเดาอยู่
//    ให้ดูเท่ากับเส้นที่ยิงยืนยันแล้ว **คนจะเอาผังนี้ไปตัดสินใจย้ายระบบจากสิ่งที่เรายังไม่รู้**
//
// ⚠️ สามสถานะที่ต้องแยกให้ออกเวลาข้อมูลไม่มา (เจอจริงวันนี้ทั้งสามแบบ):
//    · `fallthrough` = ท่อยังไม่มีเส้นนี้ (ยังไม่ได้ deploy) — **ไม่ใช่ "ไม่มีข้อมูล"**
//    · `skip`        = ท่อมีเส้น แต่ทำงานไม่ได้รอบนี้ (เช่นยังไม่ได้ตั้งคีย์)
//    · `error`/HTTP  = ยิงไม่ถึงหรือท่อพัง
//    สามอย่างนี้ต้องเขียนคนละข้อความ ไม่งั้นคนไล่ปัญหาผิดที่
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost } from '@/components/zort'
import { C, Card, Arrow, ArrowHeads, FitText, cardH, estW } from '@/components/ui/diagram'
/* เรขาคณิตของผังอยู่ใน lib/ เพื่อให้ **เทสตรวจแทนตาได้** — เหตุผลเต็มอยู่ในไฟล์นั้น
   (วันที่เขียนจอนี้ เปิดดูด้วยตาไม่ได้ทั้งสองทาง: Netlify ปิด build · next dev ติด systemd) */
import { จัดชั้น, แยกหัวกับวงเล็บ, แบ่งแถว, วางกล่อง, แทรกแถบกติกา } from '@/lib/zort-arch-layout'
import type { ผังNode } from '@/lib/zort-arch-layout'

type Node = ผังNode
interface Edge { from: string; to: string; label?: string; basis?: string }
interface Flow { asOf?: string; nodes?: Node[]; edges?: Edge[]; stockRule?: string; basisLegend?: Record<string, string> }
interface Role { who?: string; uses?: string; ourReplacement?: string; blocker?: string }
interface Arch {
  generatedAt?: string
  manual?: { asOf?: string; source?: string; roles?: Role[]; flow?: Flow }
  calls?: { endpoint: string; kind?: string; module?: string; files?: string[] }[]
  modules?: { module: string; endpoints?: string[]; reads?: number; writes?: number }[]
  jobs?: { name: string; cron?: string; zort?: boolean; via?: string[] }[]
  probedCandidates?: { endpoint: string; files?: string[] }[]
  blindSpots?: string[]
  selfCheck?: { ok?: boolean; problems?: string[]; at?: string }
  fallthrough?: boolean
  endpoint?: string
  skip?: string
}

/* ── คำอธิบาย basis ──
   มาจากตัวสร้างฝั่งท่อ (`scripts/gen-zort-arch.mjs` · 20 ก.ย. 2569) ซึ่ง **ยังไม่ได้ส่งคำอธิบายมาในคำตอบ**
   ⇒ ถ้าวันไหนท่อส่ง `flow.basisLegend` มา หน้านี้จะใช้ของท่อทันทีและเลิกใช้ชุดนี้
   ⇒ ขอไว้แล้วกับฝั่งท่อ — ระหว่างนี้เขียนกำกับบนจอว่าคำอธิบายนี้มาจากไหน */
const BASIS_สำรอง: Record<string, string> = {
  code: 'มีโค้ดของเราเรียก/ยิงจริงยืนยัน',
  probe: 'ยิงตรวจแล้วเห็นจริง',
  std: 'เป็นลำดับมาตรฐานของระบบคลัง — **ยังไม่ได้ยิงยืนยันกับ ZORT ของร้าน**',
}
const ยืนยันแล้ว = (basis?: string) => basis === 'code' || basis === 'probe'

/* ── พิกัดของผัง — ชุดนี้คือ "การจัดหน้า" ไม่ใช่ข้อมูล จึงตั้งค่าตายตัวได้ ── */
const W = 1240
const M = 40
const IN = W - M * 2
const ต่อแถว = 5
const GAP_X = 16
const CARD_W = (IN - GAP_X * (ต่อแถว - 1)) / ต่อแถว
const GAP_Y = 64          // ช่องว่างระหว่างแถว — ต้องกว้างพอให้ป้ายบนลูกศรไม่ทับกล่อง
const TOP = 30

export default function ZortArchPage() {
  const [d, setD] = useState<Arch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [at, setAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/web/core?zortarch=1')
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setD(j)
      setAt(new Date())
    } catch (e) {
      setD(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const flow = d?.manual?.flow
  const nodes = Array.isArray(flow?.nodes) ? flow!.nodes! : []
  const edges = Array.isArray(flow?.edges) ? flow!.edges! : []
  const legend = flow?.basisLegend ?? BASIS_สำรอง

  /* ── คำนวณตำแหน่งทุกกล่อง ── */
  const ชั้น = จัดชั้น(nodes, edges)
  const แถว = แบ่งแถว(nodes, ชั้น, ต่อแถว)

  const เนื้อใน = (n: Node) => {
    const [, วงเล็บ] = แยกหัวกับวงเล็บ(n.menu)
    return [วงเล็บ, n.group ? `กลุ่ม: ${n.group}` : undefined,
      n.ours && n.ours !== '—' ? `ของเรา: ${n.ours}` : 'ของเรา: ยังไม่มี',
      n.stock ? `สต็อก: ${n.stock}` : undefined]
  }

  const ขนาด = { M, IN, CARD_W, GAP_X, GAP_Y, TOP }
  const วาง = วางกล่อง(แถว, ขนาด, (n) => cardH(เนื้อใน(n), CARD_W, false, false))
  const พิกัด = วาง.พิกัด
  const RULE_H = flow?.stockRule ? cardH([flow.stockRule], IN, false, false) + 8 : 0
  const แถบ = แทรกแถบกติกา(แถว, วาง, RULE_H, GAP_Y)
  const RULE_Y = แถบ.ตำแหน่ง
  const H = แถบ.สูงรวม

  const นับ = (b: string) => edges.filter((e) => e.basis === b).length

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ผังการทำงานของ ZORT"
        summary="แต่ละเมนูของ ZORT เชื่อมกันยังไง — และของเราอยู่ตรงไหนของผังนั้น"
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'อ่านใหม่'}</BtnGhost>}
      />

      {error && <ErrorBox title="อ่านผังไม่ได้">{error}</ErrorBox>}
      {loading && !d && <LoadingState />}

      {/* 🔴 ด่านกันผังโกหกของฝั่งท่อ — ตกเมื่อไหร่ต้องขึ้นบนสุด ห้ามซ่อนไว้ท้ายหน้า */}
      {d?.selfCheck && d.selfCheck.ok === false && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-[13px] text-red-900">
          <p className="font-semibold">🔴 ตัวตรวจของผังเองบอกว่าผังนี้มีปัญหา — อย่าเพิ่งเชื่อผังข้างล่าง</p>
          {(d.selfCheck.problems ?? []).map((p, i) => <p key={i} className="mt-1">· {p}</p>)}
        </div>
      )}

      {/* ⚠️ ท่อยังไม่มีเส้นนี้ ≠ ไม่มีข้อมูล — ต้องบอกให้ตรงว่าติดอะไรอยู่ */}
      {d?.fallthrough && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900 leading-relaxed">
          ⚠️ <b>ท่อยังไม่มีเส้น <code>?zortarch=1</code></b> — คำตอบที่ได้เป็นก้อนสำรอง
          {d.endpoint ? <> (<code>endpoint: {d.endpoint}</code>)</> : null}
          <br />แปลว่า <b>โค้ดฝั่งท่อยังไม่ได้ขึ้นเว็บ</b> ไม่ใช่ว่าไม่มีข้อมูล —
          สวิตช์ build ที่ Netlify ถูกปิดไว้ ⇒ ผังจะขึ้นเองเมื่อ deploy รอบถัดไป
        </div>
      )}
      {d?.skip && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900">⚠️ {d.skip}</div>
      )}

      {d && !d.fallthrough && nodes.length > 0 && (
        <>
          {/* วันที่ของส่วนที่คนกรอกเอง — ไม่มีอะไรตรวจให้ มันเก่าเงียบ ๆ ได้ */}
          <p className="text-[12.5px] text-gray-500 mb-3" suppressHydrationWarning>
            ส่วนที่คนกรอก (ผัง · บทบาท) ทบทวนล่าสุด <b>{flow?.asOf ?? d.manual?.asOf ?? 'ไม่ทราบวันที่'}</b>
            {d.manual?.source ? <> · ที่มา: {d.manual.source}</> : null}
            {d.generatedAt ? <> · ส่วนที่สแกนจากซอร์สสร้างเมื่อ {new Date(d.generatedAt).toLocaleString('th-TH')}</> : null}
            {at ? <> · จอนี้อ่านเมื่อ {at.toLocaleTimeString('th-TH')}</> : null}
          </p>

          {/* คำอธิบายเส้น — ต้องอยู่ **ก่อน** ผัง เพราะถ้าอ่านผังก่อนจะเข้าใจว่าทุกเส้นเท่ากัน */}
          <div className="mb-3 rounded-md border border-gray-200 bg-white p-3 text-[12.5px] text-gray-700">
            <p className="font-semibold text-gray-900 mb-1">เส้นในผังไม่เท่ากัน — ดูที่เส้นก่อนเชื่อ</p>
            <p>
              <span className="inline-block w-8 border-t-2 border-gray-500 align-middle" /> เส้นทึบ ={' '}
              {legend.code} · <b>{นับ('code')}</b> เส้น
              {นับ('probe') > 0 && <> · {legend.probe} อีก <b>{นับ('probe')}</b> เส้น</>}
            </p>
            <p className="text-amber-900">
              <span className="inline-block w-8 border-t-2 border-dashed border-amber-600 align-middle" /> เส้นประจาง ={' '}
              {String(legend.std).replace(/\*\*/g, '')} · <b>{นับ('std')}</b> เส้น
              {' '}⇒ <b>ห้ามเอาไปตัดสินใจย้ายระบบ</b> ต้องเปิด ZORT ของจริงดูก่อน
            </p>
            {!flow?.basisLegend && (
              <p className="text-[11.5px] text-gray-400 mt-1">
                คำอธิบายสามบรรทัดนี้ยังไม่ได้มากับคำตอบของท่อ — ลอกจากตัวสร้างฝั่งท่อ (20 ก.ย. 2569) ขอให้ส่งมาในคำตอบแล้ว
              </p>
            )}
          </div>

          <div className="overflow-x-auto rounded-md border border-gray-200 bg-[#FAF8F5] mb-4">
            <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 1000, width: '100%', display: 'block' }}
              role="img" aria-label="ผังการทำงานของ ZORT">
              <ArrowHeads />
              {/* เส้นก่อน กล่องทีหลัง — กล่องต้องอยู่บนเส้นเสมอ */}
              {edges.map((e, i) => {
                const a = พิกัด[e.from], b = พิกัด[e.to]
                if (!a || !b) return null
                const x1 = a.x + a.w / 2, y1 = a.y + a.h
                const x2 = b.x + b.w / 2, y2 = b.y
                const ชัด = ยืนยันแล้ว(e.basis)
                const ป้าย = `${e.label ?? ''}${ชัด ? '' : ' · ยังไม่ได้ยิงยืนยัน'}`
                const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
                const w = estW(ป้าย, 11.5) + 10
                return (
                  <g key={i}>
                    <Arrow x1={x1} y1={y1} x2={x2} y2={y2}
                      color={ชัด ? C.arrow : '#C98A00'} dashed={!ชัด} width={ชัด ? 1.6 : 1.2} />
                    <rect x={mx - w / 2} y={my - 9} width={w} height={16} rx="5" fill={C.bg} opacity="0.92" />
                    <FitText x={mx} y={my + 3} text={ป้าย} fs={11.5} maxW={w}
                      fill={ชัด ? C.muted : '#8A5A00'} />
                  </g>
                )
              })}
              {nodes.map((n) => {
                const p = พิกัด[n.id]
                if (!p) return null
                const [หัว] = แยกหัวกับวงเล็บ(n.menu)
                return (
                  <Card key={n.id} x={p.x} y={p.y} w={p.w} h={p.h}
                    title={หัว} lines={เนื้อใน(n)} accent={false}
                    fill={n.stock ? '#FFF6F2' : undefined} />
                )
              })}
              {/* 🔑 กติกาสต็อก — วาง **กลางผัง** ไม่ใช่เชิงอรรถ: คนอ่านถามข้อนี้เป็นข้อแรกเสมอ */}
              {flow?.stockRule && (
                <Card x={M} y={RULE_Y} w={IN} title="กติกาสต็อกของ ZORT"
                  lines={[flow.stockRule]} accent titleAnchor="start" fill="#FFF3EC" />
              )}
            </svg>
          </div>

          {/* ตารางเส้น — ผังบอก "รูปร่าง" ตารางบอก "รายละเอียด" · 14 ป้ายบนลูกศรอ่านครบไม่ไหว */}
          <div className="rounded-md border border-gray-200 bg-white mb-4 overflow-x-auto">
            <p className="text-[14.5px] font-semibold text-gray-900 px-4 pt-3">เส้นเชื่อมทั้งหมด</p>
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead>
                <tr className="text-gray-500 text-left">
                  <th className="px-4 py-2 font-medium">จาก</th>
                  <th className="px-4 py-2 font-medium">ไป</th>
                  <th className="px-4 py-2 font-medium">เกิดอะไรขึ้น</th>
                  <th className="px-4 py-2 font-medium">รู้ได้ยังไง</th>
                </tr>
              </thead>
              <tbody>
                {edges.map((e, i) => {
                  const ชื่อ = (id: string) => nodes.find((n) => n.id === id)?.menu ?? id
                  const ชัด = ยืนยันแล้ว(e.basis)
                  return (
                    <tr key={i} className={`border-t border-gray-100 ${ชัด ? '' : 'bg-amber-50/60'}`}>
                      <td className="px-4 py-2">{ชื่อ(e.from)}</td>
                      <td className="px-4 py-2">{ชื่อ(e.to)}</td>
                      <td className="px-4 py-2">{e.label ?? '—'}</td>
                      <td className={`px-4 py-2 ${ชัด ? 'text-gray-600' : 'text-amber-900 font-medium'}`}>
                        {String(legend[String(e.basis)] ?? e.basis ?? 'ไม่ระบุ').replace(/\*\*/g, '')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ใครใช้ ZORT อยู่จริง — ผังที่ไม่มีคนอยู่ในนั้น ตอบไม่ได้ว่าเลิกใช้ได้ไหม */}
          {Array.isArray(d.manual?.roles) && d.manual!.roles!.length > 0 && (
            <div className="rounded-md border border-gray-200 bg-white mb-4 overflow-x-auto">
              <p className="text-[14.5px] font-semibold text-gray-900 px-4 pt-3">ใครใช้ ZORT อยู่ และติดอะไร</p>
              <table className="w-full min-w-[640px] text-[12.5px]">
                <thead>
                  <tr className="text-gray-500 text-left">
                    <th className="px-4 py-2 font-medium">ใคร</th>
                    <th className="px-4 py-2 font-medium">ใช้ทำอะไร</th>
                    <th className="px-4 py-2 font-medium">ของเราที่แทน</th>
                    <th className="px-4 py-2 font-medium">ติดอะไร</th>
                  </tr>
                </thead>
                <tbody>
                  {d.manual!.roles!.map((r, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-medium text-gray-900">{r.who ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-600">{r.uses ?? '—'}</td>
                      <td className="px-4 py-2"><code>{r.ourReplacement ?? '—'}</code></td>
                      <td className="px-4 py-2 text-amber-900">{r.blocker ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ส่วนที่สแกนจากซอร์สจริง — ตัวเลขทุกตัวมาจากท่อ ไม่มีใครพิมพ์เอง */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-md border border-gray-200 bg-white p-4">
              <p className="text-[12px] text-gray-500">เส้น ZORT ที่ซอร์สเราเรียกจริง</p>
              <p className="text-[26px] font-semibold text-gray-900 leading-tight">
                {Array.isArray(d.calls) ? d.calls.length : 'ไม่ทราบ'}
              </p>
              <p className="text-[11.5px] text-gray-400">
                {Array.isArray(d.modules) ? `${d.modules.length} โมดูล` : 'ไม่ทราบจำนวนโมดูล'}
              </p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-4">
              <p className="text-[12px] text-gray-500">งานตามเวลาที่แตะ ZORT</p>
              <p className="text-[26px] font-semibold text-gray-900 leading-tight">
                {Array.isArray(d.jobs) ? d.jobs.filter((j) => j.zort).length : 'ไม่ทราบ'}
              </p>
              <p className="text-[11.5px] text-gray-400">
                {Array.isArray(d.jobs) ? `จากงานตามเวลาทั้งหมด ${d.jobs.length} ตัว` : 'ไม่ทราบจำนวนงาน'}
              </p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-4">
              <p className="text-[12px] text-gray-500">ไฟล์ที่ตัวสแกนมองไม่เห็น</p>
              <p className="text-[26px] font-semibold leading-tight" style={{ color: '#E03500' }}>
                {Array.isArray(d.blindSpots) ? d.blindSpots.length : 'ไม่ทราบ'}
              </p>
              <p className="text-[11.5px] text-gray-400">รายการให้คนไปดู ไม่ใช่รายการความผิด</p>
            </div>
          </div>

          <p className="text-[11.5px] text-gray-400">
            ผังนี้สร้างใหม่ทุกครั้งที่ deploy — ส่วนที่สแกนจากซอร์สอัปเดตเอง ·
            ส่วนที่คนกรอก (กล่อง · เส้น · บทบาท) ต้องมีคนทบทวน ดูวันที่ด้านบน
          </p>
        </>
      )}
    </div>
  )
}
