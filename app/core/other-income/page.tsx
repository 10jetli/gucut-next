// การเงิน → รายได้อื่น — ผังจาก `zort-ui/53-zort-รายได้อื่น.jpg`
import LedgerScreen from '@/components/zort/LedgerScreen'

export default function OtherIncomePage() {
  return (
    <LedgerScreen
      title="รายได้อื่น"
      cols={[
        { label: 'วันที่' },
        { label: 'ชื่อลูกค้า' },
        { label: 'มูลค่า', right: true },
        { label: 'การชำระเงิน' },
      ]}
      createLabel="สร้างรายได้อื่น"
      emptyProof="เปิดช่วงวันกว้าง 10 ปี (2560-2569) แล้วยิงตรวจซ้ำ 6 ก.ย. 2569 — ไม่มีรายการเลย"
      zortList="incomes"
      /* จอนี้เคยโชว์เลขที่คัดมาด้วยมือเมื่อ 3 ก.ย. ⇒ บอกได้ว่าตอนนี้เลิกใช้แล้ว */
      hadHandCheck
      soonKey="income-other"
      withImport
      withTabs
      purpose="ใช้บันทึกรายได้อื่น ๆ ที่นอกเหนือจากการขายสินค้า แล้วนำไปคำนวณกำไรขาดทุน"
      meanwhile="ตัวจริงร้านลงที่ PEAK"
    />
  )
}
