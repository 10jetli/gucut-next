import Link from 'next/link'
/* สีตัวเลขจำนวนสต็อกแบบ ZORT — ใช้ร่วม จอสินค้า · จอสินค้าเป็นชุด (ที่เดียว ห้ามประกาศซ้ำในเพจ)
 * 📏 วัดจากจอ ZORT /Bundle/list (19 ต.ค. 2569) และตรงกับ /Product/list (ภาพ 20 ต.ค. 2569: 0 แดง · 3 เหลือง · 321.5 เขียว)
 *    ≤0 แดง rgb(242,87,87) · 1–4 เหลือง rgb(239,177,93) · ≥5 เขียว rgb(19,175,130)
 *    เกณฑ์ 5 มาจากของที่เห็นบนจอเขา (4 = เหลือง · 5 = เขียว) ไม่ใช่เลขที่เราตั้งเอง
 *    ตัวเลข Lato 600 · หน่วย (PCS/SET) สีเดียวกับตัวเลข */
export const สีจำนวนZORT = (n: number) => (n <= 0 ? '#f25757' : n < 5 ? '#efb15d' : '#13af82')
export const ตัวเลขจำนวนZORT = "font-['Lato',sans-serif] font-semibold"

/** ตัวเลขจำนวน+หน่วยแบบ ZORT (สีตามเกณฑ์ข้างบน) — ไม่ใช่ตัวเลข = ขีด ห้ามแกล้งเป็น 0 */
/** `href` ใส่ = ตัวเลขเป็นลิงก์ขีดเส้นใต้สีเดียวกับตัวเลข แบบ ZORT (ZORT เปิดป็อปอัปสต็อกรายคลัง · DOM 21 ต.ค. 2569)
 *  ⚠️ ใส่เฉพาะเมื่อปลายทางมีข้อมูลเดียวกันจริง (เช่น จอรายละเอียดที่มีตารางสต็อกรายคลัง) — ไม่งั้นเป็นลิงก์หลอก */
export function QtyZ({ n, unit, href, title }: { n?: number | null; unit?: string | null; href?: string; title?: string }) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return <span className="text-gray-300">—</span>
  const เลข = <span className={ตัวเลขจำนวนZORT} style={{ color: สีจำนวนZORT(n) }}>{n.toLocaleString('th-TH')}{unit ? ` ${unit}` : ''}</span>
  return href
    ? <Link href={href} title={title} className="underline underline-offset-2 decoration-1" style={{ textDecorationColor: สีจำนวนZORT(n) }}>{เลข}</Link>
    : เลข
}
