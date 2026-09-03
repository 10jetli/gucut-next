// เอกสาร → เอกสารบัญชี — ผังจาก `zort-ui/18-เอกสารบัญชี-ว่าง.jpg`
// ZORT ตั้งชื่อจอว่า "จัดการเอกสาร" · 0 รายการ · แท็บแยกตามชนิดเอกสาร 6 แท็บ
import LedgerScreen from '@/components/zort/LedgerScreen'

export default function AccountingDocsPage() {
  return (
    <LedgerScreen
      title="จัดการเอกสาร"
      sumLabel="มี 0 รายการ"
      tabs={['ทั้งหมด', 'ใบเสร็จรับเงิน', 'ใบกำกับภาษี', 'ใบแจ้งหนี้', 'ใบเสนอราคา', 'ใบหัก ณ ที่จ่าย']}
      cols={[
        { label: 'ประเภท' },
        { label: 'รายการ' },
        { label: 'อ้างอิง' },
        { label: 'โดย' },
        { label: 'วันที่' },
      ]}
      createLabel=""
      noCreate
      soonKey="accounting-doc"
      purpose="ที่เก็บเอกสารที่ร้านสั่ง “จัดเก็บ” ไว้ เช่น ใบเสร็จ ใบกำกับภาษี ใบแจ้งหนี้"
      meanwhile="เอกสารภาษีตัวจริงของร้านออกจาก PEAK — ที่นี่เป็นแค่ที่เก็บสำเนาของ ZORT"
    />
  )
}
