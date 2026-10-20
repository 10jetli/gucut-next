/* 🚫 ช่องในฟอร์มสร้างเอกสารที่ ZORT มี แต่ท่อของเรายังส่งไม่ได้ — กรอกไม่ได้ ไม่ส่งค่า · เหตุใน title (จอที่ใช้ต้องเขียนเหตุบนจอด้วย)
 * ใช้ร่วม: ฟอร์มสร้างใบเสนอราคา · ใบสั่งซื้อ (โหมดเหมือน ZORT) — กฎข้อ 5 ใช้ครั้งที่สองแล้วแยกเป็นตัวกลาง */
export default function FieldOff({ ป้าย, เหตุ }: { ป้าย: string; เหตุ: string }) {
  return (
    <label className="block cursor-not-allowed" title={`ยังส่งไม่ได้ — ${เหตุ}`}>
      <span className="block text-[12.5px] text-gray-400">{ป้าย}</span>
      <input disabled placeholder="ยังส่งไม่ได้" className="mt-1 w-full text-[12.5px] border border-gray-200 rounded px-2.5 py-1.5 bg-gray-50 text-gray-400 cursor-not-allowed" />
    </label>
  )
}
