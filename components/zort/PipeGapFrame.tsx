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
import { pipeText } from '@/components/ui/PipeNote'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'

export default function PipeGapFrame({ หัว, คอลัมน์, เหตุ, คำขอ, ในการ์ด = false }: {
  หัว: string; คอลัมน์: string; เหตุ: string; คำขอ: string
  /** โหมดเหมือน ZORT: อยู่ในการ์ดขาวที่มีช่องในอยู่แล้ว ⇒ ไม่ห่อ Card ซ้ำ (ช่องในซ้อนสองชั้น ดันหัวเข้าไป ~31 จาก ZORT · /Logistics/Details 21 ต.ค. 2569) */
  ในการ์ด?: boolean
}) {
  /* 📐 โหมดเหมือน ZORT (ภาพ /Logistics/Details 20 ต.ค. 2569): ZORT ขึ้นหัว + "-" เมื่อไม่มีข้อมูล ไม่มีกล่องเส้นประ
     ⇒ ย่อเป็น หัว · "-" · บรรทัดเตือนสีส้มหนึ่งบรรทัดที่กางอ่านเหตุ/คำขอได้ — **ยังเห็นบนจอเสมอ ไม่ใช่ซ่อน** (เหตุผลของกรอบนี้ยังอยู่ครบ) */
  if (เหมือนZORT) {
    const ห่อ = ({ children }: { children: React.ReactNode }) => ในการ์ด ? <div>{children}</div> : <Card>{children}</Card>
    return (
      <ห่อ>
        <p className="font-['Kanit',sans-serif] text-[14px] font-medium text-[#3e3e3e]">{หัว}</p>
        <p className="font-['Boon',sans-serif] text-[16px] text-[#3e3e3e] mt-1">-</p>
        <details className="mt-1 text-[11.5px]">
          <summary className="cursor-pointer select-none text-amber-800">⚠️ ยังเติมส่วนนี้ไม่ได้ — ต้องขอฝั่งท่อ <span className="text-gray-400">(กดเพื่ออ่าน)</span></summary>
          <div className="mt-1 leading-relaxed">
            <p className="text-gray-500">คอลัมน์ของ ZORT: {คอลัมน์}</p>
            <p className="text-amber-800 mt-1">{pipeText(เหตุ)}</p>
            <p className="text-gray-600 mt-1">🔧 ที่ต้องขอฝั่งท่อ: {pipeText(คำขอ)}</p>
          </div>
        </details>
      </ห่อ>
    )
  }
  return (
    <Card>
      <p className="text-[14px] font-semibold text-gray-900 mb-1">{หัว}</p>
      <p className="text-[12.5px] text-gray-500 mb-2">คอลัมน์ของ ZORT: {คอลัมน์}</p>
      <div className="border border-dashed border-gray-300 rounded-md px-4 py-5">
        <p className="text-[12.5px] text-amber-800 leading-relaxed">
          ⚠️ <b>ยังเติมตารางนี้ไม่ได้</b> — {pipeText(เหตุ)}
        </p>
        <p className="text-[12.5px] text-gray-600 mt-1.5 leading-relaxed">
          🔧 ที่ต้องขอฝั่งท่อ: {pipeText(คำขอ)}
        </p>
        <p className="text-[11.5px] text-gray-400 mt-1.5">
          กรอบนี้ค้างไว้ให้เห็นว่า ZORT มีตารางนี้ — ถ้าซ่อน จะไม่มีใครรู้ว่าต้องไปขอให้เปิด
        </p>
      </div>
    </Card>
  )
}
