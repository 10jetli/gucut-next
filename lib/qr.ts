/* QR code — เขียนเองเพราะโปรเจกต์ไม่มีไลบรารี และ CSP ของเราโหลด CDN ไม่ได้
 *
 * 🔴 **ขอบเขตที่ตั้งใจแคบ**: byte mode · ระดับกันพลาด M · version 1–4 (ยาวได้ถึง 62 ไบต์)
 *    ยาวกว่านั้นคืน null ⇒ **จอต้องเขียนว่าทำ QR ไม่ได้ ห้ามวาดสี่เหลี่ยมมั่ว ๆ แทน**
 *    รหัสสินค้าของร้านยาวสุดราว 20 ตัว ⇒ v1–v4 เหลือเฟือ และตารางสั้นพอที่จะไม่พิมพ์ผิด
 *    (บทเรียนจาก lib/barcode128.ts: ของที่ "ดูเหมือนบาร์โค้ด" แต่สแกนไม่ออก แย่กว่าไม่มี
 *     เพราะคนเอาไปติดของจริงแล้วรู้ตอนหน้าเคาน์เตอร์)
 *
 * ✅ **มีตาข่าย**: scripts/tests/qr.test.mjs เทียบทุกช่องกับผลของ `qrencode` (ตัวมาตรฐาน)
 *    เก็บเป็น golden vector ไว้ในไฟล์เทส ⇒ รันได้ทุกเครื่องแม้ไม่มี qrencode ติดตั้ง
 */

/** จำนวน data codeword และ ec codeword ต่อบล็อก — ระดับ M เท่านั้น */
const SPEC: Record<number, { blocks: number[]; ec: number }> = {
  1: { blocks: [16], ec: 10 },
  2: { blocks: [28], ec: 16 },
  3: { blocks: [44], ec: 26 },
  4: { blocks: [32, 32], ec: 18 },
}
/** ตำแหน่งกลางของ alignment pattern (v1 ไม่มี · v2–v4 มีอันเดียว) */
const ALIGN: Record<number, number | null> = { 1: null, 2: 18, 3: 22, 4: 26 }

/* ── เลขคณิตในสนาม GF(256) สำหรับ Reed–Solomon ───────────────────────────── */
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

function rsPoly(n: number): number[] {
  let p = [1]
  for (let i = 0; i < n; i++) {
    const q = [1, EXP[i]]
    const r = new Array(p.length + 1).fill(0)
    for (let a = 0; a < p.length; a++) for (let b = 0; b < q.length; b++) r[a + b] ^= mul(p[a], q[b])
    p = r
  }
  return p
}

function ecc(data: number[], n: number): number[] {
  const gen = rsPoly(n)
  const res = new Array(n).fill(0)
  for (const byte of data) {
    const f = byte ^ res[0]
    res.shift()
    res.push(0)
    if (f !== 0) for (let i = 0; i < n; i++) res[i] ^= mul(gen[i + 1], f)
  }
  return res
}

/* ── ข้อมูล → บิต ─────────────────────────────────────────────────────────── */
function bitsFor(bytes: number[], version: number): number[] | null {
  const cap = SPEC[version].blocks.reduce((a, b) => a + b, 0)
  const bits: number[] = []
  const push = (v: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((v >> i) & 1) }
  push(0b0100, 4)            // byte mode
  push(bytes.length, 8)      // ตัวนับ 8 บิต (จริงสำหรับ v1–v9 เท่านั้น — เราหยุดที่ v4)
  for (const b of bytes) push(b, 8)
  if (bits.length > cap * 8) return null
  push(0, Math.min(4, cap * 8 - bits.length))          // terminator
  while (bits.length % 8) bits.push(0)
  const pad = [0xec, 0x11]
  for (let i = 0; bits.length < cap * 8; i++) push(pad[i % 2], 8)
  return bits
}

/** แทรก ec + สลับบล็อกตามกติกา (v1–v3 บล็อกเดียว · v4 สองบล็อกเท่ากัน) */
function codewords(bits: number[], version: number): number[] {
  const bytes: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]
    bytes.push(v)
  }
  const { blocks, ec: ecLen } = SPEC[version]
  const dataBlocks: number[][] = []
  const ecBlocks: number[][] = []
  let at = 0
  for (const len of blocks) {
    const d = bytes.slice(at, at + len)
    at += len
    dataBlocks.push(d)
    ecBlocks.push(ecc(d, ecLen))
  }
  const out: number[] = []
  const maxData = Math.max(...blocks)
  for (let i = 0; i < maxData; i++) for (const d of dataBlocks) if (i < d.length) out.push(d[i])
  for (let i = 0; i < ecLen; i++) for (const e of ecBlocks) out.push(e[i])
  return out
}

/* ── วาดลงตาราง ───────────────────────────────────────────────────────────── */
type Grid = (0 | 1 | null)[][]

function skeleton(version: number): { m: Grid; reserved: boolean[][] } {
  const size = version * 4 + 17
  const m: Grid = Array.from({ length: size }, () => new Array(size).fill(null))
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false))
  const set = (r: number, c: number, v: 0 | 1) => { m[r][c] = v; reserved[r][c] = true }

  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const r1 = r0 + r; const c1 = c0 + c
      if (r1 < 0 || c1 < 0 || r1 >= size || c1 >= size) continue
      const on = (r >= 0 && r <= 6 && (c === 0 || c === 6))
        || (c >= 0 && c <= 6 && (r === 0 || r === 6))
        || (r >= 2 && r <= 4 && c >= 2 && c <= 4)
      set(r1, c1, on ? 1 : 0)
    }
  }
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0)

  for (let i = 8; i < size - 8; i++) {                    // timing
    const v: 0 | 1 = i % 2 === 0 ? 1 : 0
    set(6, i, v); set(i, 6, v)
  }
  const a = ALIGN[version]
  if (a !== null) {
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) {
      const on = Math.max(Math.abs(r), Math.abs(c)) !== 1
      set(a + r, a + c, on ? 1 : 0)
    }
  }
  set(size - 8, 8, 1)                                     // dark module
  for (let i = 0; i < 9; i++) {                           // จองที่ format info
    if (m[8][i] === null) { m[8][i] = 0; reserved[8][i] = true }
    if (m[i][8] === null) { m[i][8] = 0; reserved[i][8] = true }
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][size - 1 - i] === null) { m[8][size - 1 - i] = 0; reserved[8][size - 1 - i] = true }
    if (m[size - 1 - i][8] === null) { m[size - 1 - i][8] = 0; reserved[size - 1 - i][8] = true }
  }
  return { m, reserved }
}

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

/** โทษตามมาตรฐาน 4 ข้อ — ใช้เลือกหน้ากาก (ต้องตรงกับ qrencode ไม่งั้นลายต่างกัน) */
function penalty(m: number[][]): number {
  const n = m.length
  let p = 0
  const run = (get: (i: number, j: number) => number) => {
    for (let i = 0; i < n; i++) {
      let last = -1; let len = 0
      for (let j = 0; j < n; j++) {
        const v = get(i, j)
        if (v === last) { len++ } else { if (len >= 5) p += len - 2; last = v; len = 1 }
      }
      if (len >= 5) p += len - 2
    }
  }
  run((i, j) => m[i][j]); run((i, j) => m[j][i])
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const v = m[r][c]
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3
  }
  const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]
  const rpat = pat.slice().reverse()
  const hit = (arr: number[], i: number, want: number[]) => want.every((w, k) => arr[i + k] === w)
  /* ⚠️ ขอบสัญลักษณ์: นอกกรอบเป็น quiet zone (ขาว) ⇒ ลายที่ต้องมีขาว 4 ช่องข้างหนึ่ง
     อาจอยู่ชิดขอบได้ ⇒ เติมขาว 4 ช่องหัวท้ายก่อนไล่หา ไม่งั้นนับขาดไปหลายจุด */
  for (let i = 0; i < n; i++) {
    const row: number[] = [0, 0, 0, 0]; const col: number[] = [0, 0, 0, 0]
    for (let j = 0; j < n; j++) { row.push(m[i][j]); col.push(m[j][i]) }
    row.push(0, 0, 0, 0); col.push(0, 0, 0, 0)
    for (const line of [row, col]) {
      for (let j = 0; j + 11 <= line.length; j++) if (hit(line, j, pat) || hit(line, j, rpat)) p += 40
    }
  }
  let dark = 0
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dark += m[r][c]
  p += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10
  return p
}

/** 15 บิต format info ของระดับ M (00) + หมายเลขหน้ากาก
 *  🔴 คืนมาแบบ **ดัชนี = เลขบิตจริง (bit 0 = ตัวขวาสุด)** ไม่ใช่เรียง MSB ก่อน
 *     เพราะกติกาวางลงตารางอ้างถึง "บิตที่ i" แบบ LSB — เคยสลับแล้วลายเพี้ยนทั้งดวง */
function formatBits(mask: number): number[] {
  const data = (0b00 << 3) | mask
  let v = data << 10
  for (let i = 4; i >= 0; i--) if ((v >> (i + 10)) & 1) v ^= 0b10100110111 << i
  const full = ((data << 10) | v) ^ 0b101010000010010
  const out: number[] = []
  for (let i = 0; i < 15; i++) out.push((full >> i) & 1)
  return out
}

export interface QrResult { size: number; modules: number[][] }

/** คืนตาราง 0/1 (1 = ช่องดำ) · null = ยาวเกิน version 4 ⇒ **จอต้องบอกว่าทำไม่ได้** */
export function qrEncode(text: string, forceMask?: number): QrResult | null {
  const bytes = Array.from(new TextEncoder().encode(text))
  for (let version = 1; version <= 4; version++) {
    const bits = bitsFor(bytes, version)
    if (!bits) continue
    const cw = codewords(bits, version)
    const { m, reserved } = skeleton(version)
    const size = m.length

    /* เดินซิกแซกจากขวาล่าง ข้ามคอลัมน์ timing ที่ 6 */
    let bi = 0
    const bitAt = (i: number) => (i >> 3) < cw.length ? (cw[i >> 3] >> (7 - (i & 7))) & 1 : 0
    for (let right = size - 1; right > 0; right -= 2) {
      const col = right <= 6 ? right - 1 : right
      for (let step = 0; step < size; step++) {
        const up = ((size - 1 - col) >> 1) % 2 === 0
        const r = up ? size - 1 - step : step
        for (const c of [col, col - 1]) {
          if (reserved[r][c]) continue
          m[r][c] = bitAt(bi++) as 0 | 1
        }
      }
    }

    let best: { score: number; grid: number[][]; mask: number } | null = null
    for (let mask = 0; mask < 8; mask++) {
      const g = m.map((row, r) => row.map((v, c) => (reserved[r][c] ? (v as number) : (v as number) ^ (MASKS[mask](r, c) ? 1 : 0))))
      const fb = formatBits(mask)
      /* 🔴 **แถว/คอลัมน์ของ format info สลับกันสองสำเนา — เคยวางผิดทั้งคู่**
         สำเนา ① รอบ finder ซ้ายบน: บิต 0–5 ลง **คอลัมน์ 8** · บิต 9–14 ลง **แถว 8**
         สำเนา ② บิต 0–7 ลง **แถว 8 ฝั่งขวา** · บิต 8–14 ลง **คอลัมน์ 8 ฝั่งล่าง**
         วางผิดแล้ว "ดูเหมือน QR ทุกประการ" แต่สแกนไม่ออก ⇒ ตาข่ายเดียวที่จับได้
         คือเทียบทุกช่องกับ qrencode (ดูด้วยตาไม่มีทางรู้) */
      for (let i = 0; i <= 5; i++) g[i][8] = fb[i]
      g[7][8] = fb[6]; g[8][8] = fb[7]; g[8][7] = fb[8]
      for (let i = 9; i <= 14; i++) g[8][14 - i] = fb[i]
      for (let i = 0; i <= 7; i++) g[8][size - 1 - i] = fb[i]
      for (let i = 8; i <= 14; i++) g[size - 15 + i][8] = fb[i]
      g[size - 8][8] = 1
      /* 🔑 `forceMask` มีไว้ให้ **ตาข่ายบังคับหน้ากากให้ตรงกับ qrencode** แล้วเทียบทุกช่อง
         ⇒ ตรวจได้ครบทั้งการเข้ารหัส · Reed–Solomon · การวาง · format info
            เหลือเพียง "กติกาเลือกหน้ากาก" ที่เป็นเรื่องคุณภาพการสแกน ไม่ใช่ความถูกต้อง
            (หน้ากากไหนก็สแกนออกทั้งนั้น เพราะเลขหน้ากากเขียนอยู่ใน format info) */
      if (forceMask !== undefined && mask !== forceMask) continue
      const score = penalty(g)
      if (!best || score < best.score) best = { score, grid: g, mask }
    }
    return { size, modules: best!.grid }
  }
  return null
}
