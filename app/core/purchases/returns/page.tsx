// ซื้อ → คืนสินค้า (ให้ผู้ขาย) — จอรายการ · ผัง ZORT `/Sell/list` ในกลุ่มซื้อ
//
// 🔴 **คนละเรื่องกับ "ลูกค้าคืนของ"** (ReturnOrder · /core/return-orders)
//    ZORT ไขว้ชื่อสองอันนี้จนสับกันง่ายมาก (เมนู "รับคืนสินค้า" ชี้ /Buy/list
//    ส่วน "คืนสินค้า" ในกลุ่มซื้อชี้ /Sell/list) ⇒ ทุกข้อความบนจอต้องมีคำว่า **"ให้ผู้ขาย"**
//    สลับสองจอนี้ = ตัดสต็อกผิดทาง แล้วของหายจากคลังโดยไม่มีอะไรฟ้อง
//
// ✅ ต่อท่อจริง 14 ก.ย. 2569 — `?zortlist=returnpurchaseorders` (gucut-web 37bb451)
//    📏 ยิงจริง 23:38: count 0 · totalAmount 0 ทั้งแบบไม่ใส่วันและช่วง 2022–2026
//       ⇒ ร้านไม่มีใบคืนให้ผู้ขายเลย · **0 นี้ ZORT ตอบเอง (ถามสำเร็จ)** ต่างจาก unknown
//    ⚠️ ยังไม่เคยเห็นแถวจริง ⇒ ชื่อช่องมาจากเอกสาร V4 ล้วน · อ่านแบบทนฟิลด์หาย
//    ⚠️ ยอดเงินรวมใช้ `totalAmount` ของ ZORT **ห้ามบวกจากแถวเอง** (ดึงมาแค่หน้าละไม่กี่แถว)
import LedgerScreen from '@/components/zort/LedgerScreen'

export default function PurchaseReturnsPage() {
  return (
    <LedgerScreen
      title="คืนสินค้า (ให้ผู้ขาย)"
      cols={[
        { label: 'เลขที่ใบคืน' },
        { label: 'วันที่' },
        { label: 'ผู้ขาย' },
        { label: 'ใบสั่งซื้ออ้างอิง' },
        { label: 'คลัง' },
        { label: 'มูลค่า', right: true },
        { label: 'สถานะ' },
        { label: 'การชำระเงิน' },
      ]}
      createLabel="สร้างใบคืนให้ผู้ขาย"
      /* ✅ จอสร้างทำเสร็จแล้ว (ใบ t_mu0rliug) ⇒ พาไปของจริง ไม่ใช่หน้า soon */
      createHref="/core/purchases/returns/new"
      soonKey="buy-return"
      zortList="returnpurchaseorders"
      /* 🔴 ยอดรวมมาจากท่อเท่านั้น — ท่อไม่ส่งช่องไหนมา จอขึ้น "ยังไม่รู้" ไม่ใช่ 0 */
      totals={[
        { key: 'totalAmount', label: 'มูลค่ารวม' },
        { key: 'totalPaymentAmount', label: 'จ่ายคืนแล้ว' },
      ]}
      purpose="ใบคืนของที่เราส่งกลับไปให้ผู้ขาย แล้วตัดออกจากคลัง — ไม่ใช่ของที่ลูกค้าคืนเรา"
      meanwhile="ของที่ลูกค้าคืนเราอยู่คนละจอ: ขาย → รับคืนสินค้า"
    />
  )
}
