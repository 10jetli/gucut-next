// การเงิน → รายได้อื่น — ผังจาก `zort-ui/53-zort-รายได้อื่น.jpg`
import LedgerScreen from '@/components/zort/LedgerScreen'

export default function OtherIncomePage() {
  return (
    <LedgerScreen
      title="รายได้อื่น"
      sumLabel="มี 0 รายการ มูลค่ารวม 0 บาท"
      cols={[
        { label: 'วันที่' },
        { label: 'ชื่อลูกค้า' },
        { label: 'มูลค่า', right: true },
        { label: 'การชำระเงิน' },
      ]}
      createLabel="สร้างรายได้อื่น"
      soonKey="income-other"
      withImport
      withTabs
      purpose="ใช้บันทึกรายได้อื่น ๆ ที่นอกเหนือจากการขายสินค้า แล้วนำไปคำนวณกำไรขาดทุน"
      meanwhile="ตัวจริงร้านลงที่ PEAK"
    />
  )
}
