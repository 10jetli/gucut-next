// ฟังก์ชันและค่าคงที่สำหรับจัดรูปแบบตัวเลข/วันที่ — ใช้ร่วมทุกหน้า ห้ามเขียนซ้ำในเพจ
export function fmtBaht(n: number) {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function fmtNum(n: number) {
  return n.toLocaleString('th-TH')
}

export const TH_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
export const EN_MONTHS = ['Jan.','Feb.','Mar.','Apr.','May','Jun.','Jul.','Aug.','Sep.','Oct.','Nov.','Dec.']
