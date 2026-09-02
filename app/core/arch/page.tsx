'use client'
// สถาปัตยกรรมที่ใช้อยู่ — ผังระบบที่ **อ่านจากซอร์สจริง** ไม่ใช่ผังที่คนวาดค้างไว้
//
// เจ้าของร้านสั่ง (2 ก.ย. 2569): "ทำผังใส่ใน admin.gucut.com ถ้ามีการเปลี่ยนแปลง
// ก็ให้อัปเดตอัตโนมัติ เขียนเมนูว่า สถาปัตยกรรมที่ใช้อยู่"
// แล้วส่งภาพผังของฝั่งเจ้าของร้านมาสั่งว่า "จัดให้สวยแบบนี้เลย" (3 ก.ย. 2569)
// ⇒ วาดเป็น **SVG** ตามผังนั้นจริง ๆ (~/claude-shared/arch-artifact.html) ไม่ใช่กล่องเรียงลงมา
//   เพราะสิ่งที่ทำให้ผังนั้นอ่านง่ายคือ **ลูกศร** ที่บอกว่าอะไรคุยกับอะไร ทิศไหน
//   กล่องเรียงลงมาเฉย ๆ สื่อเรื่องนั้นไม่ได้เลย
//
// ⚠️ **ห้ามพิมพ์ตัวเลขใด ๆ ลงหน้านี้เด็ดขาด** ทุกตัวเลขมาจาก /api/web/core?arch=1
//    ซึ่งสแกนซอร์สจริงตอน build · ผังที่คนกรอกเองจะกลายเป็นของโกหกภายในไม่กี่สัปดาห์
//    ⇒ ผังต้นฉบับมีตัวเลขฝั่งหลังร้านด้วย แต่**นับด้วยมือ** จึงไม่ลอกมา
//      ตอนนี้ฝั่งเซิร์ฟเวอร์ทำตัวสแกนแฝดให้แล้ว (scripts/gen-arch.mjs → lib/arch-admin.ts)
//      เลขฝั่งหลังร้านจึงมาจากการสแกนเหมือนกัน ไม่ใช่เลขที่ใครนับเอง
// ⚠️ **อ่านไม่ได้ต้องขึ้นว่าอ่านไม่ได้ ห้ามโชว์ตัวเลขค้างจากรอบก่อน**
// ⚠️ ค่าที่ยังไม่มาต้องขึ้น "ไม่ทราบ" **ห้ามใส่ 0 เป็นค่าตั้งต้น**
//    (3 ก.ย. 2569 API ห่อคำตอบไว้อีกชั้น หน้าขึ้น "ไม่ทราบจำนวน" ⇒ จับต้นเหตุได้ใน 2 นาที
//     ถ้าเป็น 0 จะกลายเป็น "ฟังก์ชัน 0 ตัว" แล้วไล่หาบั๊กผิดที่ทั้งเช้า)
// ⚠️ SVG ต้องอยู่ในกล่องที่เลื่อนแนวนอนได้ — บนมือถือผังกว้างกว่าจอเสมอ
//    ย่อให้พอดีจอเล็ก = ตัวหนังสือเล็กจนอ่านไม่ออก ซึ่งแย่กว่าต้องเลื่อน
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost } from '@/components/zort'
// ⚠️ ฝั่งหลังร้าน **ไม่ต้องเรียก API** — อยู่ repo เดียวกับหน้าจอ ตัวสแกนเขียนไฟล์นี้ตอน build
//    (scripts/gen-arch.mjs · ห้ามแก้ lib/arch-admin.ts ด้วยมือ เดี๋ยวถูกเขียนทับ)
import { ARCH_ADMIN } from '@/lib/arch-admin'

/* ชุดสีจากผังต้นฉบับ — โทนอุ่น ส้มแบรนด์ GUCUT */
const C = {
  bg: '#FAF8F5', surface: '#FFFFFF', surface2: '#F3EFEA',
  ink: '#221F1D', muted: '#6B6560', line: '#E4DED7',
  accent: '#E03500', accentLine: '#F3B9A4',
  arrow: '#9A938C',
}

interface Integration {
  id: string; name: string; what: string
  inCode: boolean; live: boolean; partial?: boolean
}
interface Arch {
  generatedAt?: string
  site?: string; project?: string; repo?: string
  functions?: { count?: number; scheduled?: { name: string; cron: string }[] }
  edge?: string[]
  blobs?: string[]
  d1?: { tables?: string[] }
  pages?: { count?: number }
  loginProviders?: string[]
  unlabelled?: string[]
  integrations?: Integration[]
}

/* ── พิกัดของผัง — ตัวเลขชุดนี้คือ "การจัดหน้า" ไม่ใช่ข้อมูล จึงเขียนตายตัวได้ ── */
const W = 1160          // ความกว้าง viewBox
const M = 60            // ขอบซ้าย/ขวา
const IN = W - M * 2    // 1040
const ACT_Y = 40
const SITE_W = 470
const SITE_R_X = W - M - SITE_W   // 630
const STO_W = (IN - 24 * 3) / 4   // 242
const stoX = (i: number) => M + i * (STO_W + 24)
const actW = (IN - 26 * 3) / 4    // 240.5
const actX = (i: number) => M + i * (actW + 26)

/* ── ความสูงกล่องต้องคิดจากเนื้อในจริง ห้ามตั้งค่าคงที่ ──
   ⚠️ 3 ก.ย. 2569 เจอของจริงบนจอ: ตัวหนังสือทะลุกรอบ 9 จุด
      เส้นขอบส้มของกล่อง gucut.com ลากผ่ากลางบรรทัดล่างสุด · ชื่อถัง 4 ใบล้นออกทั้งสองข้าง
      สาเหตุ: ตั้งความสูง/ความกว้างเป็นค่าคงที่ แต่ **ภาษาไทยมีสระบนล่าง**
      (ำ ุ ู ่ ้ ๊) กินความสูงมากกว่าที่ค่าเริ่มต้นเผื่อไว้ และชื่อถังภาษาอังกฤษยาวกว่ากล่อง
   ⚠️ **หน้านี้ทั้งหน้ามีไว้เพื่อห้ามผังโกหก แต่กรอบดันตัดตัวเลขของตัวเองทิ้ง**
      ตัวเลขถูกทุกตัวแต่คนอ่านเห็นไม่ครบ = โรคเดิม ย้ายจาก "ข้อมูลผิด" มาเป็น
      "ข้อมูลถูกแต่มองไม่เห็น" · build ผ่าน ไม่มีอะไรฟ้อง ต้องเปิดจอถึงเห็น */
const PAD_T = 18, PAD_B = 15, LINE_H = 22

/** ความกว้างข้อความโดยประมาณ — ไทยกับอังกฤษปนกัน ใช้ 0.53em เป็นค่ากลาง
 *  ประมาณให้**เกินจริงเล็กน้อย**ดีกว่าขาด เพราะขาดแปลว่าล้นกรอบ */
function estW(text: string, fs: number) {
  return String(text ?? '').length * fs * 0.53
}

/** ตัดบรรทัดยาวตรงคั่น " · " ให้พอดีกล่อง — ตัดไม่ได้ก็คืนทั้งก้อน (ยอมล้นดีกว่าตัดคำ) */
function fitLines(text: string, w: number, fs: number): string[] {
  const max = w - 32
  if (!text) return []
  if (estW(text, fs) <= max) return [text]
  const parts = String(text).split(' · ')
  const out: string[] = []
  let cur = ''
  for (const part of parts) {
    const next = cur ? `${cur} · ${part}` : part
    if (!cur || estW(next, fs) <= max) cur = next
    else { out.push(cur); cur = part }
  }
  if (cur) out.push(cur)
  return out
}

const bodyLines = (lines: (string | undefined)[] | undefined, w: number) =>
  (lines ?? []).filter(Boolean).flatMap((l) => fitLines(String(l), w, 14))

/** ความสูงที่กล่องต้องใช้จริง — Card ใช้สูตรเดียวกันนี้ จึงไม่มีทางไม่ตรงกัน */
function cardH(lines: (string | undefined)[] | undefined, w: number, hasMeta = false, accent = false) {
  const titleSize = accent ? 21 : 16
  return PAD_T + titleSize * 0.8 + (hasMeta ? 22 : 0) + bodyLines(lines, w).length * LINE_H + PAD_B
}

/** งานตามเวลาบน Netlify ตั้งเป็น **เวลาสากล** — แปลงเป็นเวลาไทยให้อ่านออก
 *  ⚠️ แปลเฉพาะรูปที่แน่ใจจริง ๆ · รูปอื่นคืน null แล้วโชว์ค่าดิบ
 *     แปลผิดแล้วคนเชื่อ แย่กว่าไม่แปล */
function cronThai(cron: string): string | null {
  const c = String(cron || '').trim()
  let m = /^\*\/(\d+) \* \* \* \*$/.exec(c)
  if (m) return `ทุก ${m[1]} นาที`
  m = /^0 \*\/(\d+) \* \* \*$/.exec(c)
  if (m) return `ทุก ${m[1]} ชั่วโมง`
  if (/^0 \* \* \* \*$/.test(c)) return 'ทุกชั่วโมง'
  m = /^(\d+) (\d+) \* \* \*$/.exec(c)
  if (m) {
    const min = Number(m[1]), hUtc = Number(m[2])
    if (min < 60 && hUtc < 24) {
      const h = (hUtc + 7) % 24
      return `ทุกวัน ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')} น. (เวลาไทย)`
    }
  }
  return null
}

/* ── ชิ้นส่วนของ SVG ── */

function Card({
  x, y, w, title, meta, lines, accent, fill, dashed, titleAnchor = 'middle', h,
}: {
  x: number; y: number; w: number
  title: string
  meta?: string
  lines?: (string | undefined)[]
  accent?: boolean
  fill?: string
  dashed?: boolean
  titleAnchor?: 'middle' | 'start'
  /** ความสูงของแถว — กล่องจะสูงอย่างน้อยเท่าเนื้อในเสมอ ไม่ยอมให้ตัวหนังสือทะลุ */
  h?: number
}) {
  const titleSize = accent ? 21 : 16
  const body = bodyLines(lines, w)
  const need = cardH(lines, w, !!meta, !!accent)
  const box = Math.max(h ?? 0, need)
  const cx = titleAnchor === 'middle' ? x + w / 2 : x + 22
  let ty = y + PAD_T + titleSize * 0.8
  return (
    <g>
      <rect
        x={x} y={y} width={w} height={box} rx="12"
        fill={fill ?? C.surface}
        stroke={accent ? C.accent : C.line}
        strokeWidth={accent ? 2.2 : 1.4}
        strokeDasharray={dashed ? '7 6' : undefined}
      />
      <text x={cx} y={ty} textAnchor={titleAnchor} fontSize={titleSize} fontWeight="600" fill={C.ink}>
        {title}
      </text>
      {meta && (
        <text x={cx} y={(ty += 22)} textAnchor={titleAnchor} fontSize="13.5" fill={C.muted} fontFamily="ui-monospace, monospace">
          {meta}
        </text>
      )}
      {body.map((l, i) => (
        <text key={i} x={cx} y={(ty += LINE_H)} textAnchor={titleAnchor} fontSize="14" fill={C.muted}>
          {l}
        </text>
      ))}
    </g>
  )
}

/** ลูกศรโค้ง — สิ่งที่ทำให้ผังนี้อ่านรู้เรื่อง คือทิศทางของเส้น */
function Arrow({ x1, y1, x2, y2, color = C.arrow }: { x1: number; y1: number; x2: number; y2: number; color?: string }) {
  const my = (y1 + y2) / 2
  return (
    <path
      d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
      fill="none" stroke={color} strokeWidth="1.6"
      markerEnd={color === C.accent ? 'url(#head-accent)' : 'url(#head)'}
    />
  )
}

export default function ArchPage() {
  const [d, setD] = useState<Arch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/web/core?arch=1')
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      // รับได้ทั้งคำตอบแบบแบนและแบบห่อ — เช้านี้ฝั่งเซิร์ฟเวอร์เปลี่ยนจากห่อเป็นแบน
      setD((j?.arch ?? j) as Arch)
    } catch (e) {
      setD(null) // ⚠️ ทิ้งของเก่าทั้งชุด — ผังที่โชว์เลขค้างโดยไม่บอกว่าค้าง คือผังที่โกหก
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const fn = d?.functions
  const scheduled = Array.isArray(fn?.scheduled) ? fn!.scheduled! : []
  const blobs = Array.isArray(d?.blobs) ? d!.blobs! : []
  const tables = Array.isArray(d?.d1?.tables) ? d!.d1!.tables! : []
  const edge = Array.isArray(d?.edge) ? d!.edge! : []
  const logins = Array.isArray(d?.loginProviders) ? d!.loginProviders! : []
  const unlabelled = Array.isArray(d?.unlabelled) ? d!.unlabelled! : []
  const integrations = Array.isArray(d?.integrations) ? d!.integrations! : []
  const live = integrations.filter((i) => i.live)
  const waiting = integrations.filter((i) => !i.live)
  const hasR2 = integrations.some((i) => /r2/i.test(i.id) || /R2/.test(i.name))

  // ── ฝั่งหลังร้าน: มาจากไฟล์ที่ตัวสแกนเขียนตอน build ไม่ได้ยิง API ──
  // ⚠️ ฝั่งนี้มีแค่ `inCode` (โค้ดเรียกอยู่ไหม) **ไม่มี live/partial** เพราะดูตอน build ไม่ใช่ตอนรัน
  //    ⇒ ห้ามเขียนว่า "ต่อแล้ว" กับกล่องฝั่งนี้ ต้องเขียนว่า "มีในโค้ด"
  //    เขียนว่าต่อแล้วทั้งที่ยังไม่ได้ตั้งคีย์ = คำโกหกชนิดที่ตรวจไม่เจอจนถึงวันที่ต้องใช้
  const A = ARCH_ADMIN as unknown as {
    generatedAt?: string; site?: string; project?: string; repo?: string
    apiRoutes?: { count?: number }
    pages?: { count?: number; core?: number }
    blobs?: string[]
    pipe?: { count?: number }
    integrations?: { id: string; name: string; what: string; inCode: boolean }[]
    unlabelled?: string[]
  }
  const adminBlobs = Array.isArray(A.blobs) ? A.blobs : []
  const adminInts = Array.isArray(A.integrations) ? A.integrations : []
  const adminStamp = A.generatedAt
    ? new Date(A.generatedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  const n = (v?: number) => (typeof v === 'number' ? v.toLocaleString('th-TH') : 'ไม่ทราบ')

  // ── ความสูงทุกแถวคิดจากเนื้อในจริง แล้วค่อยวางตำแหน่ง ──
  //    ทำแบบนี้ตั้งแต่แรกก็ไม่มีปัญหาตัวหนังสือทะลุกรอบ (แผงล่างทำถูกอยู่แล้ว แถวบนลืมทำ)
  const actLines = [
    ['เบราว์เซอร์ · แอปที่ติดตั้ง (PWA)'],
    [scheduled.length ? `${scheduled.length} ตัว · ทำงานเองตามเวลา` : 'ทำงานเองตามเวลา'],
    ['เบราว์เซอร์'],
    ['แจ้งเตือน + ปุ่มอนุมัติ'],
  ]
  const ACT_H = Math.max(...actLines.map((l) => cardH(l, actW)))

  const siteLeftLines = [
    'หน้าร้าน · ตะกร้า · เช็คเอาต์ · ฟีดคลิป · ขอทะเบียน',
    `ไฟล์นิ่ง ${n(d?.pages?.count)} หน้า + ฟังก์ชัน ${n(fn?.count)} ตัว`
    + (edge.length ? ` + edge ${edge.length} ตัว` : ''),
  ]
  const siteRightLines = [
    `หลังร้านตัวจริง · จอ ${n(A.pages?.count)} หน้า (โครงการแก่น ${n(A.pages?.core)})`,
    `API ของตัวเอง ${n(A.apiRoutes?.count)} เส้นทาง · ท่อกลางอนุญาต ${n(A.pipe?.count)}`,
  ]
  const SITE_H = Math.max(cardH(siteLeftLines, SITE_W, true, true), cardH(siteRightLines, SITE_W, true, true))
  const SITE_Y = ACT_Y + ACT_H + 76

  // ⚠️ **ชื่อในกล่องต้องมาจากการสแกน ไม่ใช่คำบรรยายที่พิมพ์ไว้เอง**
  //    เจ้าของร้านย้ำ 3 ก.ย. 2569: "มันไม่ใช่ภาพนะ มันปรับเปลี่ยนตามงานตลอด"
  //    ของเดิมเขียนว่า "ออเดอร์ · แชท · คนเข้าเว็บ" ไว้เอง ⇒ จำนวนถังอัปเดตตามจริง
  //    แต่รายชื่อข้างในแช่แข็ง วันที่เพิ่มถังใหม่ ผังจะบอกจำนวนถูกแต่บอกชื่อผิด
  //    ซึ่งเนียนกว่าเดิมอีก เพราะดูเหมือนอัปเดตอยู่
  const stoLines: string[][] = [
    blobs.length ? [blobs.join(' · ')] : ['ไม่ทราบรายชื่อถัง'],
    tables.length ? ['คลังเงา — กระจกของ ZORT', tables.join(' · ')] : ['คลังเงา — กระจกของ ZORT', 'ไม่ทราบรายชื่อตาราง'],
    hasR2
      ? ['คลิปวิดีโอ (HLS) · รูปสินค้า', 'เบราว์เซอร์ลูกค้าโหลดตรง ไม่ผ่านตัวเว็บ']
      : ['ตัวสแกนไม่พบว่าต่ออยู่'],
    adminBlobs.length ? [adminBlobs.join(' · ')] : ['ไม่ทราบรายชื่อถัง'],
  ]
  const STO_H = Math.max(...stoLines.map((l) => cardH(l, STO_W)))
  const STO_Y = SITE_Y + SITE_H + 96

  // ── สองแผงล่าง: จำนวนแถวขึ้นกับจำนวนบริการ · ความสูงกล่องขึ้นกับคำอธิบายที่ยาวที่สุด ──
  const PER_ROW = 5, SB_GAP = 12
  const sbW = (IN - 28 - (PER_ROW - 1) * SB_GAP) / PER_ROW
  const WAIT_PER_ROW = 3
  const wbW = (IN - (WAIT_PER_ROW - 1) * 24) / WAIT_PER_ROW
  const liveWhat = live.map((it) => fitLines(it.what, sbW, 12.5))
  const waitWhat = waiting.map((it) => fitLines(it.partial ? `${it.what} · ตั้งคีย์ไม่ครบ` : it.what, wbW, 12.5))
  const maxLines = (arr: string[][]) => arr.reduce((m, a) => Math.max(m, a.length), 1)
  const SB_H = 30 + maxLines(liveWhat) * 18 + 12
  const WB_H = 30 + maxLines(waitWhat) * 18 + 12

  const liveRows = Math.max(1, Math.ceil(live.length / PER_ROW))
  const PANEL_Y = STO_Y + STO_H + 140
  const PANEL_H = 42 + liveRows * SB_H + (liveRows - 1) * SB_GAP + 18
  const waitRows = Math.ceil(waiting.length / WAIT_PER_ROW)
  const WAIT_LABEL_Y = PANEL_Y + PANEL_H + 34
  const WAIT_Y = WAIT_LABEL_Y + 16
  const H = waitRows > 0 ? WAIT_Y + waitRows * WB_H + (waitRows - 1) * SB_GAP + 30 : PANEL_Y + PANEL_H + 30

  const stamp = d?.generatedAt
    ? new Date(d.generatedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สถาปัตยกรรมที่ใช้อยู่"
        summary={<>ผังนี้<b>สแกนจากโค้ดจริง</b> ไม่มีใครพิมพ์ไว้ — แก้ระบบแล้ว deploy ผังเปลี่ยนตามเอง</>}
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'อ่านใหม่'}</BtnGhost>}
      />

      {error && (
        <ErrorBox title="อ่านผังไม่ได้">
          {error}
          <br />
          <span className="text-[12.5px]">
            หน้านี้ตั้งใจ<b>ไม่แสดงตัวเลขค้างจากรอบก่อน</b> — ผังที่โชว์เลขเก่าโดยไม่บอกว่าเก่า
            อันตรายกว่าไม่มีผัง เพราะเอาไปตัดสินใจต่อได้
          </span>
        </ErrorBox>
      )}
      {loading && !d && <LoadingState />}

      {d && (
        <>
          {/* ⚠️ เลื่อนแนวนอนได้ — ย่อให้พอดีจอเล็กจะเล็กจนอ่านไม่ออก */}
          <div className="rounded-xl border overflow-x-auto" style={{ background: C.bg, borderColor: C.line }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 980, width: '100%', display: 'block' }}
              role="img" aria-label="ผังระบบ GUCUT">
              <defs>
                <marker id="head" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 z" fill={C.arrow} />
                </marker>
                <marker id="head-accent" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 z" fill={C.accent} />
                </marker>
              </defs>

              {/* ── ชั้น 1: ใครเป็นคนเริ่มเรื่อง ── */}
              <Card x={actX(0)} y={ACT_Y} w={actW} h={ACT_H} fill={C.surface2}
                title="ลูกค้า" lines={['เบราว์เซอร์ · แอปที่ติดตั้ง (PWA)']} />
              <Card x={actX(1)} y={ACT_Y} w={actW} h={ACT_H} fill={C.surface2}
                title="งานตั้งเวลา"
                lines={[scheduled.length ? `${scheduled.length} ตัว · ทำงานเองตามเวลา` : 'ทำงานเองตามเวลา']} />
              <Card x={actX(2)} y={ACT_Y} w={actW} h={ACT_H} fill={C.surface2}
                title="เจ้าของร้าน + ภรรยา" lines={['เบราว์เซอร์']} />
              <Card x={actX(3)} y={ACT_Y} w={actW} h={ACT_H} fill={C.surface2}
                title="Telegram" lines={['แจ้งเตือน + ปุ่มอนุมัติ']} />

              <Arrow x1={actX(0) + actW / 2} y1={ACT_Y + ACT_H} x2={M + 240} y2={SITE_Y - 6} />
              <Arrow x1={actX(1) + actW / 2} y1={ACT_Y + ACT_H} x2={M + 360} y2={SITE_Y - 6} />
              <Arrow x1={actX(2) + actW / 2} y1={ACT_Y + ACT_H} x2={SITE_R_X + 180} y2={SITE_Y - 6} />
              <Arrow x1={actX(3) + actW / 2} y1={ACT_Y + ACT_H} x2={SITE_R_X + 320} y2={SITE_Y - 6} />

              {/* ── ชั้น 2: สองเว็บ + ท่อกลาง ── */}
              <Card
                x={M} y={SITE_Y} w={SITE_W} h={SITE_H} accent titleAnchor="start"
                title={d.site ?? 'หน้าร้าน'}
                meta={`Netlify · ${d.project ?? '—'} · repo ${d.repo ?? '—'}`}
                lines={siteLeftLines}
              />
              <Card
                x={SITE_R_X} y={SITE_Y} w={SITE_W} h={SITE_H} accent titleAnchor="start"
                title={A.site ?? 'admin.gucut.com'}
                meta={`Netlify · ${A.project ?? '—'} · repo ${A.repo ?? '—'}`}
                lines={siteRightLines}
              />
              {/* ท่อกลาง — ลูกศรชี้ซ้าย เพราะหลังร้านเป็นฝ่ายเรียกไปหาหน้าร้าน */}
              <path d={`M ${SITE_R_X - 8} ${SITE_Y + 52} L ${M + SITE_W + 10} ${SITE_Y + 52}`}
                stroke={C.accent} strokeWidth="1.8" fill="none" markerEnd="url(#head-accent)" />
              <text x={(M + SITE_W + SITE_R_X) / 2} y={SITE_Y + 40} textAnchor="middle" fontSize="14" fill={C.accent}>
                ท่อกลาง
              </text>
              <text x={(M + SITE_W + SITE_R_X) / 2} y={SITE_Y + 80} textAnchor="middle" fontSize="13"
                fill={C.accent} fontFamily="ui-monospace, monospace">
                /api/web/*
              </text>

              {/* ── ชั้น 3: ที่เก็บข้อมูล ── */}
              <Card x={stoX(0)} y={STO_Y} w={STO_W} h={STO_H}
                title={`Netlify Blobs · ${blobs.length ? `${blobs.length} ถัง` : 'ไม่ทราบ'}`}
                lines={stoLines[0]} />
              <Card x={stoX(1)} y={STO_Y} w={STO_W} h={STO_H}
                title="Cloudflare D1"
                lines={stoLines[1]} />
              {hasR2 ? (
                <Card x={stoX(2)} y={STO_Y} w={STO_W} h={STO_H}
                  title="Cloudflare R2"
                  lines={stoLines[2]} />
              ) : (
                <Card x={stoX(2)} y={STO_Y} w={STO_W} h={STO_H} fill={C.surface2}
                  title="Cloudflare R2" lines={stoLines[2]} />
              )}
              {/* ⚠️ ถังฝั่งหลังร้าน — ผังต้นฉบับเขียน "4 ถัง" แต่ตัวสแกนมองไม่เห็น จึงไม่ใส่ตัวเลข */}
              <Card x={stoX(3)} y={STO_Y} w={STO_W} h={STO_H}
                title={`Netlify Blobs · ${adminBlobs.length ? `${adminBlobs.length} ถัง` : 'ไม่ทราบ'}`}
                lines={stoLines[3]} />

              <Arrow x1={M + 120} y1={SITE_Y + SITE_H} x2={stoX(0) + STO_W / 2} y2={STO_Y - 6} />
              <Arrow x1={M + 260} y1={SITE_Y + SITE_H} x2={stoX(1) + STO_W / 2} y2={STO_Y - 6} />
              <Arrow x1={M + 400} y1={SITE_Y + SITE_H} x2={stoX(2) + STO_W / 2} y2={STO_Y - 6} />
              <Arrow x1={SITE_R_X + 300} y1={SITE_Y + SITE_H} x2={stoX(3) + STO_W / 2} y2={STO_Y - 6} />

              {/* เส้นข้างสองเส้นลงไปหาแผงบริการภายนอก */}
              <path d={`M ${M + 40} ${SITE_Y + SITE_H} L ${M - 22} ${SITE_Y + SITE_H + 60} L ${M - 22} ${PANEL_Y + 78} L ${M + 6} ${PANEL_Y + 78}`}
                fill="none" stroke={C.arrow} strokeWidth="1.4" markerEnd="url(#head)" />
              <path d={`M ${W - M - 40} ${SITE_Y + SITE_H} L ${W - M + 22} ${SITE_Y + SITE_H + 60} L ${W - M + 22} ${PANEL_Y + 78} L ${W - M - 6} ${PANEL_Y + 78}`}
                fill="none" stroke={C.arrow} strokeWidth="1.4" markerEnd="url(#head)" />

              {/* webhook ยิงกลับเข้ามา — ลูกศรชี้ขึ้น เพราะเป็นของนอกบ้านที่เรียกเข้ามาหาเรา */}
              <path d={`M ${M + 450} ${PANEL_Y - 8} L ${M + 450} ${SITE_Y + SITE_H + 4}`}
                fill="none" stroke={C.arrow} strokeWidth="1.4" markerEnd="url(#head)" />
              <text x={M + 466} y={PANEL_Y - 38} fontSize="14" fill={C.muted}>
                webhook ยิงกลับเข้ามา (Beam · Telegram)
              </text>

              {/* ── ชั้น 4: บริการภายนอกที่ต่อแล้ว ── */}
              <rect x={M} y={PANEL_Y} width={IN} height={PANEL_H} rx="14" fill={C.surface} stroke={C.line} strokeWidth="1.4" />
              <text x={M + 20} y={PANEL_Y + 26} fontSize="14.5" fill={C.ink} fontWeight="600">
                บริการภายนอกที่ต่อแล้ว {live.length ? `· ${live.length} เจ้า` : ''}
              </text>
              {live.map((it, i) => {
                const r = Math.floor(i / PER_ROW), c = i % PER_ROW
                const x = M + 14 + c * (sbW + SB_GAP)
                const y = PANEL_Y + 42 + r * (SB_H + SB_GAP)
                return (
                  <g key={it.id}>
                    <rect x={x} y={y} width={sbW} height={SB_H} rx="10" fill={C.surface2} />
                    <text x={x + sbW / 2} y={y + 24} textAnchor="middle" fontSize="14.5" fontWeight="600" fill={C.ink}>{it.name}</text>
                    {(liveWhat[i] ?? []).map((t, k) => (
                      <text key={k} x={x + sbW / 2} y={y + 42 + k * 18} textAnchor="middle" fontSize="12.5" fill={C.muted}>{t}</text>
                    ))}
                  </g>
                )
              })}
              {live.length === 0 && (
                <text x={M + 20} y={PANEL_Y + 70} fontSize="13.5" fill={C.muted}>ตัวสแกนไม่พบบริการที่ต่ออยู่</text>
              )}

              {/* ── ชั้น 5: ยังไม่ต่อ (เส้นประ) ── */}
              {waiting.length > 0 && (
                <>
                  <text x={M} y={WAIT_LABEL_Y} fontSize="14" fill={C.muted}>
                    ยังไม่ต่อ — โค้ดเขียนรอไว้แล้ว (เส้นประ)
                  </text>
                  {waiting.map((it, i) => {
                    const r = Math.floor(i / WAIT_PER_ROW), c = i % WAIT_PER_ROW
                    const x = M + c * (wbW + 24)
                    const y = WAIT_Y + r * (WB_H + SB_GAP)
                    return (
                      <g key={it.id}>
                        <rect x={x} y={y} width={wbW} height={WB_H} rx="10" fill="none"
                          stroke={C.line} strokeWidth="1.4" strokeDasharray="7 6" />
                        <text x={x + wbW / 2} y={y + 24} textAnchor="middle" fontSize="14.5" fontWeight="600" fill={C.muted}>{it.name}</text>
                        {(waitWhat[i] ?? []).map((t, k) => (
                          <text key={k} x={x + wbW / 2} y={y + 42 + k * 18} textAnchor="middle" fontSize="12.5" fill={C.muted}>{t}</text>
                        ))}
                      </g>
                    )
                  })}
                </>
              )}
            </svg>
          </div>

          {/* ── รายละเอียดที่ผังใส่ไม่ไหว ── */}
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            {scheduled.length > 0 && (
              <div className="rounded-lg border p-3.5" style={{ background: C.surface, borderColor: C.line }}>
                <p className="text-[13.5px] font-semibold mb-1.5" style={{ color: C.ink }}>
                  งานที่ทำเองตามเวลา · {scheduled.length} ตัว
                </p>
                <div className="space-y-1">
                  {scheduled.map((s) => {
                    const gloss = cronThai(s.cron)
                    return (
                      <div key={s.name} className="flex flex-wrap items-baseline gap-2">
                        <span className="text-[11px] font-mono rounded px-1.5 py-0.5" style={{ background: C.surface2, color: C.muted }}>{s.name}</span>
                        <span className="text-[12px]" style={{ color: C.ink }}>{gloss ?? s.cron}</span>
                        {gloss && <span className="text-[10.5px] font-mono" style={{ color: C.muted }}>{s.cron}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {adminInts.length > 0 && (
              <div className="rounded-lg border p-3.5" style={{ background: C.surface, borderColor: C.line }}>
                <p className="text-[13.5px] font-semibold mb-0.5" style={{ color: C.ink }}>
                  ของนอกบ้านที่ฝั่งหลังร้านเรียกใช้ · {adminInts.length} เจ้า
                </p>
                {/* ⚠️ ฝั่งนี้บอกได้แค่ว่า "โค้ดเรียกอยู่" ไม่ได้บอกว่าตั้งคีย์ครบแล้ว
                    เพราะข้อมูลมาจากตอน build ไม่ใช่ตอนรัน — เขียนว่า "ต่อแล้ว" จะเป็นคำโกหก
                    ชนิดที่ตรวจไม่เจอจนถึงวันที่ต้องใช้จริง */}
                <p className="text-[11.5px] mb-2" style={{ color: C.muted }}>
                  บอกว่า<b>มีในโค้ด</b>เท่านั้น ไม่ได้บอกว่าตั้งคีย์ครบแล้ว (ต่างจากฝั่งหน้าร้านที่ดูตอนรันได้)
                </p>
                <div className="space-y-1">
                  {adminInts.map((it) => (
                    <div key={it.id} className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[12.5px] font-medium" style={{ color: C.ink }}>{it.name}</span>
                      <span className="text-[11.5px]" style={{ color: C.muted }}>{it.what}</span>
                      {!it.inCode && (
                        <span className="text-[10.5px] rounded px-1.5 py-0.5" style={{ background: C.surface2, color: C.muted }}>
                          ไม่พบการเรียกใช้ในโค้ด
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border p-3.5" style={{ background: C.surface, borderColor: C.line }}>
              <p className="text-[13.5px] font-semibold mb-1.5" style={{ color: C.ink }}>รายละเอียดที่ผังย่อไว้</p>
              <div className="space-y-1.5 text-[12px]" style={{ color: C.muted }}>
                {logins.length > 0 && <p>เข้าสู่ระบบด้วย: <b style={{ color: C.ink }}>{logins.join(' · ')}</b></p>}
                {edge.length > 0 && <p>ตัวดักที่ขอบเครือข่าย: <b style={{ color: C.ink }}>{edge.join(' · ')}</b> (ใช้กับบอตของ AI)</p>}
                <p>
                  ทุกชื่อและทุกตัวเลขในผัง<b>มาจากการสแกนโค้ดจริงตอน build</b> —
                  เพิ่มฟังก์ชัน ถัง ตาราง หรือบริการใหม่แล้ว deploy ผังเปลี่ยนตามเอง
                  ไม่มีใครต้องมาแก้ผัง
                </p>
                <p>
                  ที่<b>ไม่ได้</b>มาจากการสแกนมีสามอย่าง: ชื่อกล่องแถวบนสุด (ลูกค้า · งานตั้งเวลา ·
                  เจ้าของร้าน · Telegram) · ป้าย &quot;webhook ยิงกลับเข้ามา&quot; ·
                  และตำแหน่งของกล่องกับลูกศร — สามอย่างนี้เป็นการจัดหน้า ไม่ใช่ข้อมูล
                </p>
              </div>
            </div>
          </div>

          {/* ⚠️ ตัวแปรที่ตัวสแกนยังไม่รู้จัก — ต้องโชว์ ไม่งั้นผังดูครบทั้งที่ยังมีของนอกสายตา */}
          {unlabelled.length > 0 && (
            <div className="text-[12.5px] rounded-lg px-3.5 py-2.5 mt-3 leading-relaxed border"
              style={{ background: '#FEF3C7', borderColor: '#FDE68A', color: '#92400E' }}>
              ⚠️ ยังจัดหมวดไม่ได้ <b>{unlabelled.length} ตัว</b> — ตัวสแกนเห็นว่าโค้ดใช้อยู่
              แต่ยังไม่รู้ว่าเป็นบริการอะไร: {unlabelled.join(' · ')}
            </div>
          )}

          <div className="text-[11.5px] rounded-lg border px-3.5 py-2.5 mt-3 leading-relaxed"
            style={{ background: C.surface, borderColor: C.line, color: C.muted }}>
            {stamp
              ? <>ข้อมูลชุดนี้สร้างตอน build รอบ <b>{stamp} น.</b> — แก้โค้ดแล้วยังไม่ deploy ผังจะยังไม่เปลี่ยน</>
              : 'ไม่ทราบเวลาที่สร้างข้อมูลชุดนี้'}
            <br />
            ตัวเลขฝั่ง<b>หลังร้าน</b>มาจากตัวสแกนคนละตัว ซึ่งอ่านซอร์สของ repo นี้ตอน build
            {adminStamp ? ` (รอบ ${adminStamp} น.)` : ''} — จึงเป็นของที่ตรวจได้เหมือนกัน
            ไม่ใช่เลขที่ใครนับด้วยมือ
          </div>
        </>
      )}
    </div>
  )
}
