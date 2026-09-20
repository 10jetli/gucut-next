export interface ZortStore {
  storename: string
  apikey: string
  apisecret: string
}

export interface Order {
  number: string
  customername: string
  status: string
  amount: number
  saleschannel: string
  createdatetimeString: string
  orderdateString?: string
  trackingno?: string
}

export interface Product {
  sku: string
  name: string
  stock: string
  availablestock?: string
  sellprice?: string
  purchaseprice?: string
  barcode?: string
}

export interface Return {
  number: string
  customername: string
  status: string
  paymentamount: number
  returnorderdateString?: string
  saleschannel?: string
}

// Google Sheets factory order
export interface FactoryOrder {
  id: string
  product: string
  factory: string
  qty: number
  deposit: string
  total: string
  due: string
  status: string
  note: string
  updated: string
  images: string
}

// ── Order Tracker (เก็บบน Netlify Blobs) ──
export interface TrackerImage {
  url: string
  thumb: string
  name: string
}

export type TrackerStatus =
  | 'pending'    // ยังไม่มัดจำ
  | 'talking'    // เริ่มคุยแล้ว
  | 'deposit'    // มัดจำแล้ว — รอผลิต
  | 'production' // กำลังผลิต
  | 'shipping'   // รอขนส่ง / อยู่ระหว่างส่ง
  | 'warehouse'  // รอเข้าโกดัง
  | 'done'       // เสร็จสิ้น

export interface TrackerOrder {
  id: number
  product: string
  factory: string
  qty: number
  deposit: string
  total: string
  due: string
  status: TrackerStatus
  note: string
  updated: string
  images: TrackerImage[]
}

/* ── เมนูจุดสามจุดท้ายแถว (ย้ายมาจาก components/zort/index.tsx 20 ก.ย. 2569 · ใบ S5) ──
   🔴 เหตุที่ย้าย: `lib/product-menu.ts` import ชนิดนี้จาก `components/` ⇒ **lib พึ่ง components = ทิศกลับหัว**
      (วัดเจอด้วยเกณฑ์ "ชนิดที่ export นอก lib/ แล้วมีไฟล์อื่น import จริง" — จาก 8 ตัว ตัวนี้ตัวเดียวที่เป็นของจริง
       อีก 7 ตัวเป็นชนิดของ component ตัวเอง ⇒ อยู่กับเจ้าของถูกแล้ว)
   ⚠️ ใส่เฉพาะคำสั่งที่ทำได้จริง — ปุ่มที่กดแล้วไม่เกิดอะไรแย่กว่าไม่มีปุ่ม */
export interface RowMenuItem {
  label: string
  onClick?: () => void
  /** 🔴 ทำไม่ได้ตอนนี้ — ใส่ **เหตุผล** ไม่ใช่แค่ true
   *  ⚠️ เมนูที่ตัดรายการที่ทำไม่ได้ทิ้ง จะทำให้คนที่ชิน ZORT หาไม่เจอแล้วนึกว่าระบบเราทำไม่ได้
   *     ⇒ โชว์ให้ครบตามผัง แต่กดไม่ได้ **พร้อมบอกว่าทำไมและต้องไปทำที่ไหนแทน**
   *  ⚠️ ห้ามใส่แค่ "ยังไม่พร้อม" — คนอ่านต้องรู้ว่าต้องไปทำที่ไหนต่อ */
  disabled?: string
}
