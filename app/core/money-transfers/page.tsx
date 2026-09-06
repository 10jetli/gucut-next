// การเงิน → รายการโอนเงิน — ผังจาก `zort-ui/54-zort-รายการโอนเงิน.jpg`
// ⚠️ คนละเรื่องกับ "รายการโอนสินค้า" (/core/transfers) ซึ่งมีข้อมูลจริง 12,002 ใบ
import LedgerScreen from '@/components/zort/LedgerScreen'

export default function MoneyTransfersPage() {
  return (
    <LedgerScreen
      title="รายการโอนเงิน"
      sumLabel="มี 0 รายการ จำนวนเงินรวม 0 บาท"
      cols={[
        { label: 'วันที่' },
        { label: 'รายการ' },
        { label: 'จำนวนเงิน', right: true },
        { label: 'สถานะ' },
      ]}
      createLabel="สร้างรายการโอนเงิน"
      emptyProof="เปิดช่วงวันกว้าง 10 ปี (2560-2569) แล้วยิงตรวจซ้ำ 6 ก.ย. 2569 — ไม่มีรายการเลย"
      soonKey="money-transfer"
      purpose="ใช้บันทึกประวัติการโอนเงินระหว่างกระเป๋าเงินของร้านค้า"
      meanwhile="ต้องมีทะเบียนกระเป๋าเงินก่อน (การเงิน → กระเป๋าเงิน ยังไม่ได้ทำ)"
    />
  )
}
