/* ถังเวลาของกราฟรายงาน — คิดคีย์ถังและเติมช่องว่างของช่วงวัน
 *
 * 🔴 **ที่มา: บั๊กจริงที่เจอ 20 ก.ย. 2569** (ฝั่งท่อเจอคลาสเดียวกันในเอกสารบัญชี แล้วผมกวาดฝั่งจอตาม)
 *    จอ `/core/buy-report` เติมช่องว่างด้วย `new Date(`${from}T00:00:00`).toISOString().slice(0, 10)`
 *    · `new Date('2026-09-01T00:00:00')` **ไม่มี `Z`** ⇒ พาร์สเป็น **เวลาท้องถิ่น** (ไทย)
 *    · `.toISOString()` แปลงกลับเป็น **UTC** ⇒ ได้ `2026-08-31T17:00:00Z` ⇒ **ถอยหนึ่งวัน**
 *    ⇒ วัดจริงด้วย `TZ=Asia/Bangkok`:
 *      · `grain='day'`   ช่วง 1–30 ก.ย. ⇒ โครงกราฟได้ **31 ส.ค. – 29 ก.ย.** (เลื่อนทั้งแถบ)
 *      · `grain='month'` ช่วง 1–30 ก.ย. ⇒ โครงกราฟได้ **`2026-08` ตัวเดียว**
 *        ⇒ **เดือน ก.ย. ไม่มีโครงเลย** และมีแถบ ส.ค. ว่างโผล่มา
 *    🔑 ⇒ โครงที่เขียนไว้เพื่อ **กันเดือนที่ไม่มีใบซื้อหายจากกราฟ** ทำสิ่งที่ตรงข้ามกับที่คอมเมนต์อ้าง
 *       ⇒ คอมเมนต์นั้นเป็นคำกล่าวอ้างที่เป็นเท็จ ไม่ใช่แค่โค้ดผิด
 *
 * 🔑 **สาเหตุร่วมของทั้งบั๊กนี้และบั๊กฝั่งท่อ: ตัวเลขสองตัวบนจอเดียวมาจากนาฬิกาคนละเรือน**
 *    โครงกราฟผ่าน `toISOString()` (UTC) · แถวข้อมูลใช้สตริง `po_date` จากท่อตรง ๆ (ไม่แปลง)
 *    ⇒ ตรงกับกฎใน CLAUDE.md: **อย่าเอาตัวเลขจากแหล่งหนึ่งไปโชว์คู่กับของจากอีกแหล่งหนึ่ง**
 *
 * ⚠️ ที่นี่จงใจ **ไม่ใช้ `toISOString()` เลย** — อ่านวัน/เดือน/ปีจากปฏิทินท้องถิ่นตรง ๆ
 *    เพราะช่วงวันที่ผู้ใช้เลือก (`from`/`to`) เป็นวันตามปฏิทินของผู้ใช้ ไม่ใช่เวลาตามเส้นเวลา
 */

export type Grain = 'day' | 'month' | 'quarter' | 'year'

const TH_เดือน = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

/** `YYYY-MM-DD` จาก **ปฏิทินท้องถิ่น** ของ Date — ห้ามใช้ `toISOString()` แทน (จะเลื่อนวัน) */
export function วันตามปฏิทินท้องถิ่น(d: Date): string {
  const ป = d.getFullYear()
  const ด = String(d.getMonth() + 1).padStart(2, '0')
  const ว = String(d.getDate()).padStart(2, '0')
  return `${ป}-${ด}-${ว}`
}

/** คีย์+ป้ายของถัง จากวัน `YYYY-MM-DD` — คีย์ต้องเรียงด้วยสตริงได้ */
export function ถังของวัน(iso: string, g: Grain): { key: string; label: string } {
  const [y, m, d] = iso.split('-')
  if (g === 'year') return { key: y, label: `${Number(y) + 543}` }
  if (g === 'quarter') {
    const q = Math.floor((Number(m) - 1) / 3) + 1
    return { key: `${y}-Q${q}`, label: `Q${q}/${Number(y) + 543}` }
  }
  if (g === 'month') return { key: `${y}-${m}`, label: `${TH_เดือน[Number(m) - 1]}/${Number(y) + 543}` }
  return { key: `${y}-${m}-${d}`, label: `${Number(d)}/${Number(m)}` }
}

/** ถังทั้งหมดของช่วง `from`–`to` (รวมปลายทั้งสองข้าง) เรียงตามเวลา · ใช้เติมช่องว่างของกราฟ
 *
 *  ⚠️ `เพดานรอบ` กันลูปวิ่งไม่จบเมื่อได้ช่วงวันเพี้ยน — **ถ้าชนเพดาน จะคืนเท่าที่ได้**
 *     ⇒ ผู้เรียกต้องดู `ชนเพดาน` แล้วเขียนบนจอ ไม่ใช่โชว์กราฟที่ขาดท้ายเงียบ ๆ
 */
export function ถังของช่วง(
  from: string,
  to: string,
  g: Grain,
  เพดานรอบ = 400,
): { ถัง: { key: string; label: string }[]; ชนเพดาน: boolean } {
  const ถัง: { key: string; label: string }[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { ถัง, ชนเพดาน: false }
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const cur = new Date(fy, fm - 1, fd)
  const end = new Date(ty, tm - 1, td)
  const เห็นแล้ว = new Set<string>()
  let รอบ = 0
  while (cur <= end) {
    if (รอบ++ >= เพดานรอบ) return { ถัง, ชนเพดาน: true }
    const b = ถังของวัน(วันตามปฏิทินท้องถิ่น(cur), g)
    if (!เห็นแล้ว.has(b.key)) { เห็นแล้ว.add(b.key); ถัง.push(b) }
    if (g === 'day') cur.setDate(cur.getDate() + 1)
    else if (g === 'month') cur.setMonth(cur.getMonth() + 1)
    else if (g === 'quarter') cur.setMonth(cur.getMonth() + 3)
    else cur.setFullYear(cur.getFullYear() + 1)
  }
  /* 🔑 เดินเป็นก้าวเดือน/ไตรมาส/ปี อาจ **ข้ามถังสุดท้าย** ได้ เมื่อ `to` ตกก่อนก้าวถัดไป
     (เช่น from=15 ม.ค. to=10 ก.พ. ก้าวเดือน ⇒ 15 ก.พ. > end ⇒ ก.พ. หายทั้งถัง)
     ⇒ ปิดท้ายด้วยถังของ `to` เสมอ */
  const ท้าย = ถังของวัน(to, g)
  if (!เห็นแล้ว.has(ท้าย.key)) ถัง.push(ท้าย)
  return { ถัง, ชนเพดาน: false }
}
