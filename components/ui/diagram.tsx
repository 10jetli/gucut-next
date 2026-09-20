'use client'
/* ชิ้นส่วนวาดผัง SVG ที่ใช้ร่วมกัน — แยกออกมาจาก app/core/arch/page.tsx เมื่อ 20 ก.ย. 2569
 * เหตุ: ท่านประธานสั่งทำผังที่สอง (ผังการทำงานของ ZORT) ⇒ **ใช้ pattern เดิมเป็นครั้งที่ 2**
 *       ⇒ กฎข้อ 5 ของบ้านนี้: ให้แยกเป็นชิ้นส่วนใน components/ui/ ห้ามก๊อปไปวางซ้ำ
 *
 * 🔴 **เหตุผลของทุกบรรทัดในไฟล์นี้มาจากของจริงที่พังบนจอ 3 ก.ย. 2569** (ผังแรก):
 *    ตัวหนังสือทะลุกรอบ 9 จุด · เส้นขอบลากผ่ากลางบรรทัดล่าง · ชื่อถังล้นออกสองข้าง
 *    สาเหตุ: ตั้งความสูง/กว้างเป็นค่าคงที่ แต่ **ภาษาไทยมีสระบนล่าง** (ำ ุ ู ่ ้ ๊)
 *    ⇒ ตัวเลขถูกทุกตัวแต่คนอ่านเห็นไม่ครบ = "ข้อมูลถูกแต่มองไม่เห็น" · build ผ่าน ไม่มีอะไรฟ้อง
 *    ⇒ ⇒ **ความสูงกล่องต้องคิดจากเนื้อในจริงเสมอ** (`cardH` กับ `Card` ใช้สูตรเดียวกัน
 *         จึงไม่มีทางไม่ตรงกัน — ถ้าแยกสองสูตรเมื่อไหร่ กรอบจะตัดเนื้อในอีก)
 */

/* ชุดสีจากผังต้นฉบับ — โทนอุ่น ส้มแบรนด์ GUCUT */
export const C = {
  bg: '#FAF8F5', surface: '#FFFFFF', surface2: '#F3EFEA',
  ink: '#221F1D', muted: '#6B6560', line: '#E4DED7',
  accent: '#E03500', accentLine: '#F3B9A4',
  arrow: '#9A938C',
}

export const PAD_T = 18, PAD_B = 15, LINE_H = 22

/** ความกว้างข้อความโดยประมาณ — ไทยกับอังกฤษปนกัน ใช้ 0.53em เป็นค่ากลาง
 *  ประมาณให้**เกินจริงเล็กน้อย**ดีกว่าขาด เพราะขาดแปลว่าล้นกรอบ */
export function estW(text: string, fs: number) {
  return String(text ?? '').length * fs * 0.53
}

/** แยกคำโดยไม่ตัดกลางวงเล็บ — "(เบราว์เซอร์โหลดตรง)" ต้องอยู่ก้อนเดียวกัน */
function spaceTokens(text: string): string[] {
  const out: string[] = []
  let depth = 0
  for (const word of text.split(' ')) {
    if (depth > 0 && out.length) out[out.length - 1] += ` ${word}`
    else out.push(word)
    depth += (word.match(/[(（]/g) ?? []).length - (word.match(/[)）]/g) ?? []).length
    if (depth < 0) depth = 0
  }
  return out
}

/** ลำดับที่ยอมตัดบรรทัด — ไล่จาก "ตัดแล้วอ่านเป็นธรรมชาติที่สุด" ไปหาตาข่ายสุดท้าย
 *  ⚠️ ต้องมีช่องว่างธรรมดาปิดท้ายเสมอ ไม่งั้นบรรทัดที่ไม่มีตัวคั่นสวย ๆ จะหาที่ตัดไม่เจอ
 *     แล้วปล่อยยาวล้นกรอบเงียบ ๆ (เจอจริง 3 ก.ย. 2569) */
const SEPS = [' · ', ' — ', ' + ', ' ']

/** ตัดบรรทัดยาวให้พอดีกล่อง — ลองตัวคั่นทีละแบบจนกว่าทุกบรรทัดจะพอดี */
export function fitLines(text: string, w: number, fs: number): string[] {
  const max = w - 32
  if (!text) return []
  if (estW(text, fs) <= max) return [text]

  for (const sep of SEPS) {
    const parts = sep === ' ' ? spaceTokens(String(text)) : String(text).split(sep)
    if (parts.length < 2) continue
    const out: string[] = []
    let cur = ''
    for (const part of parts) {
      const next = cur ? `${cur}${sep}${part}` : part
      if (!cur || estW(next, fs) <= max) cur = next
      else { out.push(cur); cur = part }
    }
    if (cur) out.push(cur)
    if (out.every((l) => estW(l, fs) <= max) || sep === ' ') return out
  }
  return [String(text)]
}

export const bodyLines = (lines: (string | undefined)[] | undefined, w: number) =>
  (lines ?? []).filter(Boolean).flatMap((l) => fitLines(String(l), w, 14))

/** ความสูงที่กล่องต้องใช้จริง — Card ใช้สูตรเดียวกันนี้ จึงไม่มีทางไม่ตรงกัน */
export function cardH(lines: (string | undefined)[] | undefined, w: number, hasMeta = false, accent = false) {
  const titleSize = accent ? 21 : 16
  return PAD_T + titleSize * 0.8 + (hasMeta ? 22 : 0) + bodyLines(lines, w).length * LINE_H + PAD_B
}

/** ข้อความที่ **ไม่มีทางล้นกรอบ** — ยาวเกินเมื่อไหร่บีบระยะตัวอักษรให้พอดี */
export function FitText({
  x, y, text, fs, maxW, fill, anchor = 'middle', weight, mono,
}: {
  x: number; y: number; text: string; fs: number; maxW: number
  fill: string; anchor?: 'middle' | 'start'; weight?: string; mono?: boolean
}) {
  const over = estW(text, fs) > maxW
  return (
    <text
      x={x} y={y} textAnchor={anchor} fontSize={fs} fill={fill}
      fontWeight={weight} fontFamily={mono ? 'ui-monospace, monospace' : undefined}
      textLength={over ? maxW : undefined}
      lengthAdjust={over ? 'spacingAndGlyphs' : undefined}
    >
      {text}
    </text>
  )
}

export function Card({
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
      <FitText x={cx} y={ty} text={title} fs={titleSize} maxW={w - 32} fill={C.ink} anchor={titleAnchor} weight="600" />
      {meta && (
        <FitText x={cx} y={(ty += 22)} text={meta} fs={13.5} maxW={w - 32} fill={C.muted} anchor={titleAnchor} mono />
      )}
      {body.map((l, i) => (
        <FitText key={i} x={cx} y={(ty += LINE_H)} text={l} fs={14} maxW={w - 32} fill={C.muted} anchor={titleAnchor} />
      ))}
    </g>
  )
}

/** ลูกศรโค้ง — สิ่งที่ทำให้ผังอ่านรู้เรื่อง คือทิศทางของเส้น
 *  `dashed` มีไว้สำหรับเส้นที่ **ยังไม่ได้ยิงยืนยัน** — ห้ามวาดเท่าเส้นที่พิสูจน์แล้ว
 *  เพราะคนเอาผังไปตัดสินใจย้ายระบบ จากสิ่งที่เรายังเดาอยู่ */
export function Arrow({
  x1, y1, x2, y2, color = C.arrow, dashed, width,
}: {
  x1: number; y1: number; x2: number; y2: number
  color?: string; dashed?: boolean; width?: number
}) {
  const my = (y1 + y2) / 2
  return (
    <path
      d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
      fill="none" stroke={color} strokeWidth={width ?? 1.6}
      strokeDasharray={dashed ? '6 5' : undefined}
      markerEnd={color === C.accent ? 'url(#head-accent)' : 'url(#head)'}
    />
  )
}

/** หัวลูกศร — ต้องมีใน <defs> ของทุก svg ที่ใช้ <Arrow> */
export function ArrowHeads() {
  return (
    <defs>
      {/* ⚠️ รูปหัวลูกศรต้องตรงกับของเดิมเป๊ะ — ตอนย้ายมา ผมพิมพ์ใหม่จากความจำเป็น
          `M0,0 L0,6 L7,3 z` ซึ่งเป็นสามเหลี่ยมคนละรูป ⇒ ผังเดิมจะเปลี่ยนหน้าตาโดยไม่มีใครสั่ง
          ⇒ ของจริงคือบรรทัดข้างล่างนี้ (ลอกจาก app/core/arch/page.tsx ก่อนย้าย) */}
      <marker id="head" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 z" fill={C.arrow} />
      </marker>
      <marker id="head-accent" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 z" fill={C.accent} />
      </marker>
    </defs>
  )
}
