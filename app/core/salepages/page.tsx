// ร้านค้าออนไลน์ → เซลเพจ — ผังจาก `zort-ui/10-ร้านค้าออนไลน์-เซลเพจ-ว่าง.jpg`
// ⚠️ ชื่อจอของ ZORT เป็นภาษาอังกฤษว่า "Sale pages" จริง ๆ (เมนูซ้ายเขียนไทยว่า เซลเพจ)
//    ใช้ชื่อตามจอจริงเพื่อให้คนที่ชิน ZORT จำได้ทันที
import LedgerScreen from '@/components/zort/LedgerScreen'

export default function SalePagesPage() {
  return (
    <LedgerScreen
      title="Sale pages"
      sumLabel="มี 0 หน้า"
      cols={[
        { label: 'ชื่อ' },
        { label: 'สินค้า' },
        { label: 'คลังสินค้า/สาขา' },
      ]}
      createLabel="เพิ่มเซลเพจ"
      soonKey="salepage"
      purpose="หน้าขายสินค้าเดี่ยวสำหรับยิงโฆษณา — ลูกค้ากดสั่งจากหน้านั้นได้เลยโดยไม่ต้องเข้าเว็บร้าน"
      meanwhile="ร้านไม่ได้ใช้ของ ZORT เลย — gucut.com ทำหน้าที่นี้อยู่แล้วทั้งเว็บ"
    />
  )
}
