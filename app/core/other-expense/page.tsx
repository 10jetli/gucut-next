// การเงิน → รายจ่ายอื่น — ผังจาก `zort-ui/28-zort-รายจ่ายอื่น-ว่าง-empty-state.jpg`
import LedgerScreen from '@/components/zort/LedgerScreen'

export default function OtherExpensePage() {
  return (
    <LedgerScreen
      title="รายจ่ายอื่น"
      sumLabel="มี 0 รายการ มูลค่ารวม 0 บาท"
      cols={[
        { label: 'วันที่' },
        { label: 'ชื่อผู้ติดต่อ' },
        { label: 'มูลค่า', right: true },
        { label: 'การชำระเงิน' },
      ]}
      createLabel="สร้างรายจ่ายอื่น"
      soonKey="expense-other"
      withImport
      withTabs
      purpose="ใช้บันทึกรายจ่ายอื่น ๆ ที่นอกเหนือจากการซื้อสินค้า แล้วนำไปคำนวณกำไรขาดทุน"
      meanwhile="ค่าโฆษณาและค่าบริการดูได้ที่ การเงิน → รวมบิลทุกเจ้า · ตัวจริงลงที่ PEAK"
    />
  )
}
