// สินค้า → สินค้าหลากคุณสมบัติ — ผังจาก `zort-ui/30-zort-สินค้าหลากคุณสมบัติ-ว่าง.jpg`
// ZORT มี 0 รายการ (ร้านไม่ได้ใช้สินค้าแบบมีตัวเลือก — แต่ละรุ่น/ขนาดเป็นคนละรหัสไปเลย)
import LedgerScreen from '@/components/zort/LedgerScreen'

export default function VariantsPage() {
  return (
    <LedgerScreen
      title="สินค้าหลากคุณสมบัติ"
      sumLabel="มี 0 รายการ"
      cols={[
        { label: 'รหัส' },
        { label: 'ชื่อ' },
        { label: 'คุณสมบัติ' },
        { label: 'ชนิดสินค้า' },
        { label: 'จำนวนคงเหลือ', right: true },
        { label: 'จำนวนพร้อมขาย', right: true },
      ]}
      createLabel="เพิ่มสินค้าหลากคุณสมบัติ"
      soonKey="product-variant"
      purpose="ใช้กับสินค้าตัวเดียวที่มีหลายตัวเลือก เช่น สี/ขนาด แล้วให้แต่ละตัวเลือกมีสต็อกของตัวเอง"
      meanwhile="ร้านไม่ได้ใช้แบบนี้ — แต่ละรุ่นและแต่ละความยาวเป็นคนละรหัสสินค้าไปเลย ดูได้ที่ สินค้า → สินค้า"
    />
  )
}
