// ฟังก์ชันและค่าคงที่สำหรับจัดรูปแบบตัวเลข/วันที่ — ใช้ร่วมทุกหน้า ห้ามเขียนซ้ำในเพจ
export function fmtBaht(n: number) {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

/** เงินแบบ ZORT — **ไม่มีสัญลักษณ์ ฿** และ **ไม่ปัดทศนิยมทิ้ง**
 *
 * ⚠️ ตรวจจากภาพจอ ZORT ทุกใบแล้ว: ในตารางเขียนเลขเปล่า ("72,000" · "1,242,943.72")
 *    ส่วนบรรทัดสรุปใช้คำว่า "บาท" ต่อท้าย ไม่เคยใช้เครื่องหมาย ฿ เลยสักจุด
 * ⚠️ **ทศนิยมสำคัญ** — ของเดิมปัดเป็นจำนวนเต็ม ทำให้ ฿6,243,402.20 กลายเป็น ฿6,243,402
 *    ตัวเลขในฐานถูกทุกบาท แต่ **ตัวที่คนเห็นไม่ตรงกับ ZORT** ⇒ คนที่เอามาเทียบจะสะดุด
 *    และไม่มีทางรู้ว่าต่างเพราะการปัด หรือเพราะข้อมูลไม่ตรงจริง ๆ
 * ทศนิยมท้ายที่เป็นศูนย์ถูกตัดเอง (6,243,402.2 ไม่ใช่ 6,243,402.20) ตรงกับที่ ZORT แสดง
 */
export function fmtMoney(n: number) {
  return (Number(n) || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })
}

export function fmtNum(n: number) {
  return n.toLocaleString('th-TH')
}

export const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
export const EN_MONTHS = ['Jan.','Feb.','Mar.','Apr.','May','Jun.','Jul.','Aug.','Sep.','Oct.','Nov.','Dec.']

// แปลง ISO datetime -> ข้อความไทยอ่านง่าย เช่น "31 ก.ค. 2569 14:32"
export function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
