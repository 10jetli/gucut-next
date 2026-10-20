/* 📎 ลิงก์ "แนบไฟล์" ใต้หัวจอรายละเอียดเอกสาร แบบ ZORT — วัด DOM /Warehouse/TransferDetails 20 ต.ค. 2569: Kanit 12 #868e96
 * ของเรายังแนบไฟล์เข้าใบไม่ได้ (แนบใน ZORT = เขียนกลับ) ⇒ สีเดียวกับ ZORT แต่กดไม่ได้ เหตุใน title
 * ใช้ร่วมหลายจอ (ใบโอน · ใบซื้อ · ใบเสนอราคา) — แก้ข้อความ/เหตุที่นี่ที่เดียว (กฎข้อ 5) */
export default function AttachLinkOff() {
  return (
    <span title="ยังทำไม่ได้ — แนบไฟล์เข้าใบใน ZORT = เขียนกลับ"
      className="font-['Kanit',sans-serif] text-[12px] text-[#868e96] cursor-not-allowed mr-3">📎 แนบไฟล์</span>
  )
}
