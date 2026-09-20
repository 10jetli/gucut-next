/* การจัดวางผัง ZORT — แยกออกจากเพจเพื่อให้ **ทดสอบได้โดยไม่ต้องเปิดจอ**
 *
 * 🔴 ที่มา 20 ก.ย. 2569: จอนี้เขียนเสร็จในวันที่ **เปิดดูด้วยตาไม่ได้เลย**
 *    · Netlify ปิด build ⇒ ขึ้นเว็บจริงไม่ได้
 *    · `next dev` ก็รันไม่ได้ เพราะ systemd ของท่านประธานถือ `.next` อยู่
 *    ⇒ กฎของบ้านนี้คือ **build ผ่าน ≠ จอถูก** ⇒ ถ้าไม่มีตา ต้องมีตัววัดแทน
 *    ⇒ ⇒ ย้ายเรขาคณิตมาที่นี่ แล้วให้เทสตรวจสิ่งที่ตาจะเห็น:
 *       กล่องล้นขอบไหม · กล่องทับกันไหม · เส้นชี้ไปหากล่องที่ไม่มีไหม
 *    (บั๊กชุดแรกของผังแรก 3 ก.ย. 2569 คือ "ตัวหนังสือทะลุกรอบ 9 จุด" ซึ่ง build ไม่มีวันจับได้)
 */

export interface ผังNode { id: string; menu: string; group?: string; ours?: string; stock?: string }
export interface ผังEdge { from: string; to: string; label?: string; basis?: string }

/** จัดชั้นจากเส้นเชื่อมจริง — ไม่ล็อกตำแหน่งไว้ในโค้ด
 *  ⇒ ท่อเพิ่มกล่อง/เส้นเมื่อไหร่ ผังขยับตามเอง ไม่ต้องมีใครมาแก้หน้าจอ
 *  ⚠️ มีเพดานรอบกันกราฟที่วนเป็นวง — ถ้าวันหนึ่งท่อส่งวงมา จะได้ไม่ค้างทั้งหน้า */
export function จัดชั้น(nodes: ผังNode[], edges: ผังEdge[]): Record<string, number> {
  const เข้า: Record<string, string[]> = {}
  for (const n of nodes) เข้า[n.id] = []
  for (const e of edges) if (เข้า[e.to]) เข้า[e.to].push(e.from)
  const ชั้น: Record<string, number> = {}
  for (const n of nodes) ชั้น[n.id] = 0
  for (let รอบ = 0; รอบ < nodes.length + 2; รอบ++) {
    let เปลี่ยน = false
    for (const n of nodes) {
      const พ่อแม่ = เข้า[n.id].filter((p) => p in ชั้น)
      const d = พ่อแม่.length ? Math.max(...พ่อแม่.map((p) => ชั้น[p] + 1)) : 0
      if (d !== ชั้น[n.id]) { ชั้น[n.id] = d; เปลี่ยน = true }
    }
    if (!เปลี่ยน) break
  }
  return ชั้น
}

/** แยกวงเล็บท้ายชื่อออกมาเป็นบรรทัดล่าง — ชื่อเมนูยาวจะถูกบีบจนอ่านไม่ออกถ้ายัดบรรทัดเดียว
 *  (ของจริง: "ช่องทางขาย (Shopee/Lazada/TikTok)" กว้างกว่ากล่องเกือบเท่าตัว)
 *  ⚠️ นี่คือการ **จัดบรรทัด** ไม่ใช่การตัดข้อความทิ้ง — ทุกตัวอักษรยังอยู่บนจอ */
export function แยกหัวกับวงเล็บ(menu: string): [string, string | undefined] {
  const m = /^(.*?)\s*(\([^)]*\))\s*$/.exec(String(menu ?? ''))
  return m ? [m[1], m[2]] : [String(menu ?? ''), undefined]
}

export interface ขนาดผัง { M: number; IN: number; CARD_W: number; GAP_X: number; GAP_Y: number; TOP: number }
export interface กล่อง { x: number; y: number; w: number; h: number }

/** วางตำแหน่งทุกกล่อง — **รับความสูงมาเป็นฟังก์ชัน** ไม่ได้คิดเอง
 *  เพราะความสูงจริงต้องคิดจากตัวหนังสือ (อยู่ฝั่ง SVG) แต่การ *วาง* ต้องทดสอบได้โดยไม่ต้องมีจอ
 *  ⇒ แยกสองเรื่องนี้ออกจากกัน ⇒ เทสป้อนความสูงปลอมเข้ามาตรวจการวางได้ */
export function วางกล่อง(
  แถว: { ชั้น: number; ใน: ผังNode[] }[],
  ข: ขนาดผัง,
  สูงของกล่อง: (n: ผังNode) => number,
) {
  const พิกัด: Record<string, กล่อง> = {}
  const แถวY: number[] = []
  let y = ข.TOP
  let แถวสต็อกสุดท้าย = -1
  แถว.forEach((r, ri) => {
    const สูง = Math.max(...r.ใน.map(สูงของกล่อง))
    const เริ่ม = ข.M + (ข.IN - (r.ใน.length * ข.CARD_W + (r.ใน.length - 1) * ข.GAP_X)) / 2
    r.ใน.forEach((n, i) => {
      พิกัด[n.id] = { x: เริ่ม + i * (ข.CARD_W + ข.GAP_X), y, w: ข.CARD_W, h: สูง }
    })
    แถวY.push(y)
    if (r.ใน.some((n) => n.stock)) แถวสต็อกสุดท้าย = ri
    y += สูง + ข.GAP_Y
  })
  return { พิกัด, แถวY, แถวสต็อกสุดท้าย, สูงรวม: y }
}

/** ดันแถวที่อยู่ใต้แถบกติกาสต็อกลงไปให้พ้นกัน แล้วคืนตำแหน่งแถบ
 *  (แถบนี้ต้องอยู่ **กลางผัง** ตามที่ใบงานกำชับ — คนอ่านถามเรื่องสต็อกเป็นข้อแรกเสมอ) */
export function แทรกแถบกติกา(
  แถว: { ชั้น: number; ใน: ผังNode[] }[],
  ผล: ReturnType<typeof วางกล่อง>,
  สูงแถบ: number,
  GAP_Y: number,
) {
  const { พิกัด, แถวY, แถวสต็อกสุดท้าย } = ผล
  const ตำแหน่ง = แถวสต็อกสุดท้าย >= 0 && แถวY[แถวสต็อกสุดท้าย + 1] !== undefined
    ? แถวY[แถวสต็อกสุดท้าย + 1] - GAP_Y + 10
    : ผล.สูงรวม
  if (!สูงแถบ) return { ตำแหน่ง, สูงรวม: ผล.สูงรวม }
  แถว.forEach((r, ri) => {
    if (ri > แถวสต็อกสุดท้าย) for (const n of r.ใน) if (พิกัด[n.id]) พิกัด[n.id].y += สูงแถบ
  })
  return { ตำแหน่ง, สูงรวม: ผล.สูงรวม + สูงแถบ }
}

/** แบ่งชั้นเป็นแถว — ชั้นที่มีกล่องเกิน `ต่อแถว` ใบ ต้องตัดเป็นหลายแถว
 *  ไม่งั้นกล่องแคบจนชื่อเมนูถูกบีบจนอ่านไม่ออก (ของจริง: ชั้นแรกมี 10 กล่อง) */
export function แบ่งแถว(nodes: ผังNode[], ชั้น: Record<string, number>, ต่อแถว: number) {
  const กอง: ผังNode[][] = []
  for (const n of nodes) (กอง[ชั้น[n.id]] ??= []).push(n)
  const แถว: { ชั้น: number; ใน: ผังNode[] }[] = []
  กอง.forEach((ใน, i) => {
    if (!ใน) return
    for (let k = 0; k < ใน.length; k += ต่อแถว) แถว.push({ ชั้น: i, ใน: ใน.slice(k, k + ต่อแถว) })
  })
  return แถว
}
