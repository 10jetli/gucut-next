/* รหัสคลัง → ชื่อคลัง จากคำตอบของ `list=warehouses` (15 ต.ค. 2569)
 *
 * 🔑 แยกออกมาเมื่อใช้เป็นครั้งที่ 3 (จอโอนสินค้า · รายละเอียดใบโอน · จอขาย) — กติกาข้อ 5 ของ CLAUDE.md
 *    สองสำเนาเดิมเขียนเหมือนกันทุกบรรทัด ⇒ วันหนึ่งแก้ที่เดียวแล้วอีกที่เพี้ยน
 * ⚠️ แยกสามสถานะ: ได้ชื่อ · คลังนี้ไม่มีชื่อ (ใช้รหัสแทน) · **อ่านคำตอบไม่ได้** (`อ่านไม่ได้: true`)
 *    จอต้องบอกเมื่ออ่านไม่ได้ ไม่งั้นคนอ่านรหัสดิบ (`NEW`) เป็นชื่อคลังจริง
 */
export function ชื่อคลังจากคำตอบ(j: unknown): { names: Record<string, string>; อ่านไม่ได้: boolean } {
  const list = (j as { warehouses?: unknown } | null)?.warehouses
  if (!Array.isArray(list)) return { names: {}, อ่านไม่ได้: true }
  const names: Record<string, string> = {}
  for (const w of list as { code?: unknown; name?: unknown }[]) {
    if (w?.code) names[String(w.code)] = String(w.name || w.code)
  }
  return { names, อ่านไม่ได้: false }
}
