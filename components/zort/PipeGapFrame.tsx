/* กรอบของตารางที่ ZORT มีแต่เราเติมไม่ได้ — **ต้องบอกเหตุและคำขอ ไม่ใช่แค่ว่าไม่มี**
 *
 * 📍 แยกออกมาจาก `app/core/branches/[code]/page.tsx` ตอนจอที่สองต้องใช้ (5 ต.ค. 2569)
 *    กติกาข้อ 5 ของ CLAUDE.md: ใช้ pattern เดิมเป็นครั้งที่ 2 ⇒ แยกเป็นคอมโพเนนต์
 *
 * 🔑 เหตุผลที่กรอบนี้ต้อง **ค้างอยู่บนจอ ไม่ใช่ซ่อน**:
 *    ช่องที่หายไปเงียบ ๆ ไม่มีใครไปขอให้เปิด — และคนอ่านจะเข้าใจว่าจอเราครบแล้ว
 *    ⇒ `คำขอ` ต้องเป็นคำขอที่ยิงได้จริง (ชื่อพารามิเตอร์/ชื่อเส้น) ไม่ใช่ "ขอข้อมูลเพิ่ม"
 */
import Card from '@/components/ui/Card'

export default function PipeGapFrame({ หัว, คอลัมน์, เหตุ, คำขอ }: {
  หัว: string; คอลัมน์: string; เหตุ: string; คำขอ: string
}) {
  return (
    <Card>
      <p className="text-[14px] font-semibold text-gray-900 mb-1">{หัว}</p>
      <p className="text-[12px] text-gray-500 mb-2">คอลัมน์ของ ZORT: {คอลัมน์}</p>
      <div className="border border-dashed border-gray-300 rounded-md px-4 py-5">
        <p className="text-[12.5px] text-amber-800 leading-relaxed">
          ⚠️ <b>ยังเติมตารางนี้ไม่ได้</b> — {เหตุ}
        </p>
        <p className="text-[12px] text-gray-600 mt-1.5 leading-relaxed">
          🔧 ที่ต้องขอฝั่งท่อ: {คำขอ}
        </p>
        <p className="text-[11.5px] text-gray-400 mt-1.5">
          กรอบนี้ค้างไว้ให้เห็นว่า ZORT มีตารางนี้ — ถ้าซ่อน จะไม่มีใครรู้ว่าต้องไปขอให้เปิด
        </p>
      </div>
    </Card>
  )
}
