// ฟังก์ชันและค่าคงที่สำหรับจัดรูปแบบตัวเลข/วันที่ — ใช้ร่วมทุกหน้า ห้ามเขียนซ้ำในเพจ
export function fmtBaht(n: number) {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
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
