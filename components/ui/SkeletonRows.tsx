/* โครงร่างกะพริบระหว่างรอข้อมูล — ใช้ร่วมทุกหน้า
 *
 * 🔴 **ที่มา 20 ก.ย. 2569 (ใบ S5 · กฎข้อ 5)** — วัดจอทั้ง 124 ไฟล์แล้วพบว่า **20 ไฟล์เขียนสถานะโหลดเอง**
 *    แต่แยกได้เป็น **สองกองคนละเรื่อง ซึ่งให้ตัวเลขหน้าตาเหมือนกันเป๊ะ**:
 *      · 8 ไฟล์ — เป็นข้อความ/สปินเนอร์ ⇒ `LoadingState` ทำได้อยู่แล้ว ⇒ **เข้าข่ายกฎข้อ 5 จริง**
 *      · 12 ไฟล์ — เป็น **โครงร่างกะพริบ** ⇒ `components/ui/` **ไม่มีของชนิดนี้ให้ใช้**
 *        ⇒ ⇒ ไม่ใช่ "คนไม่ทำตามกฎ" แต่เป็น **กฎสั่งให้ใช้ของที่ยังไม่มี**
 *    🔑 บทเรียนที่ใหญ่กว่าตัวไฟล์: ก่อนอ่านเลขว่า "ละเมิดกฎ N จุด" ต้องถามว่า
 *       **มีของให้ใช้จริงไหม** — ไม่งั้นเราจะไปดุคนที่ไม่มีทางทำถูก
 *
 * ✅ CEO อนุมัติให้ทำ 20 ก.ย. 2569
 *
 * ⚠️ ใช้เมื่อ **ยังไม่รู้ว่ามีกี่แถว** (ข้อมูลยังไม่มา) ⇒ โครงร่างสื่อว่า "กำลังมา" ได้ดีกว่าสปินเนอร์
 *    ถ้าเป็นการรอสั้น ๆ หรือรอคำสั่งเดียว ใช้ `LoadingState` (สปินเนอร์) ตามเดิม
 * 🚫 **ห้ามใส่ข้อความตัวเลขปลอมลงในโครงร่าง** — คนจะอ่านว่าเป็นข้อมูลจริงชั่วขณะหนึ่ง
 */
export default function SkeletonRows({
  rows = 5,
  height = 'h-12',
  className = 'p-3 space-y-2',
  ทรง = 'แถบ',
}: {
  /** จำนวนแถวโครงร่าง — ควรใกล้เคียงจำนวนแถวที่มักโหลดมาจริง */
  rows?: number
  /** ความสูงของแต่ละแถบ (คลาส tailwind) */
  height?: string
  className?: string
  /** `แถบ` = กล่องยาวแถวเดียว · `แถวรายการ` = วงกลม + สองบรรทัด (ใช้กับรายการที่มีรูป/ไอคอน) */
  ทรง?: 'แถบ' | 'แถวรายการ'
}) {
  const ดัชนี = Array.from({ length: Math.max(1, rows) }, (_, i) => i)
  if (ทรง === 'แถวรายการ') {
    return (
      <div className={className} aria-busy="true" aria-live="polite">
        {ดัชนี.map((i) => (
          <div
            key={i}
            className="px-5 py-3.5 flex items-center gap-3 animate-pulse"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className="w-9 h-9 rounded-full bg-gray-100" />
            <span className="flex-1 space-y-1.5">
              <span className="block h-3 w-40 max-w-[50%] rounded bg-gray-100" />
              <span className="block h-2.5 w-56 max-w-[70%] rounded bg-gray-50" />
            </span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className={`${className} animate-pulse`} aria-busy="true" aria-live="polite">
      {ดัชนี.map((i) => (
        <div key={i} className={`${height} rounded bg-gray-50`} />
      ))}
    </div>
  )
}
