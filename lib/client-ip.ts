// หา IP ของคนที่ยิงเข้ามา — ใช้กับ "ตัวกันเดารหัสรัว ๆ" เท่านั้น
//
// ⚠️ **ห้ามใช้ค่านี้ตัดสินสิทธิ์อะไรทั้งนั้น** ปลอมได้บางทาง · หน้าที่เดียวคือเป็นกุญแจของตัวนับ
//
// 🔴 **ไม่รู้ IP = คืน null แล้วต้องไม่นับ** — ห้ามคืน 'unknown' แล้วเอาไปเป็นกุญแจ
//    ยัดทุกคนลงกุญแจก้อนเดียว = ใครก็ได้ยิงผิด 5 ครั้งแล้วทั้งร้านล็อกอินไม่ได้ 15 นาที
//    = เปลี่ยนตัวกันเดารหัส ให้กลายเป็นปุ่มปิดร้านที่ใครก็กดได้ (แย่กว่าไม่มีตัวกัน)
//
// ⚠️ **x-forwarded-for ต้องอ่านตัวท้าย ไม่ใช่ตัวหน้า**
//    ลูกค้าส่งหัวนี้มาเองได้ ตัวหน้าจึงเป็นค่าที่ลูกค้าพิมพ์เอง (เปลี่ยนได้ทุกครั้งที่ยิง = ตัวนับไร้ความหมาย)
//    ตัวที่ผู้ให้บริการเติมท้ายสุดคือค่าที่ใกล้ความจริงที่สุดเท่าที่ชั้นนี้จะรู้ได้
//
// ⚠️ **ยังไม่ได้พิสูจน์ว่าบน Netlify รันไทม์ของ Next มีหัวไหนบ้าง** (ฝั่งท่อยืนยันแทนไม่ได้
//    เพราะเป็นคนละรันไทม์) ⇒ มีเส้น /api/ipcheck ไว้ยิงดูของจริงหลัง deploy
//    ถ้าไม่มีสักทาง ⇒ ตัวนับไม่ทำงานเลย และ **ต้องเขียนบนจอว่ายังไม่มีตัวกัน** ห้ามปล่อยให้เข้าใจว่ามี

interface IpSource { headers: Headers; ip?: string | null }

export function clientIp(req: IpSource): string | null {
  // ① บางแพลตฟอร์มใส่มาให้ในตัว request เอง ไม่ต้องพึ่ง header
  const direct = (req as { ip?: string | null }).ip
  if (direct) return direct
  // ② Netlify ใส่มาให้ตรง ๆ (ปลอมไม่ได้จากฝั่งลูกค้า)
  const nf = req.headers.get('x-nf-client-connection-ip')
  if (nf) return nf
  const real = req.headers.get('x-real-ip')
  if (real) return real
  // ③ ทางสุดท้าย — เอาตัวท้าย ไม่ใช่ตัวหน้า (ดูเหตุผลด้านบน)
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  }
  return null
}

/** มีทางรู้ IP ไหม — ใช้บอกบนจอว่า "ตัวกันเดารหัสทำงานอยู่จริงหรือเปล่า"
 *  ⚠️ คืนแค่ว่า **มี/ไม่มี** ห้ามคืนตัวเลข IP ออกไป */
export function ipSources(req: IpSource) {
  return {
    reqIp: !!(req as { ip?: string | null }).ip,
    nfHeader: !!req.headers.get('x-nf-client-connection-ip'),
    xRealIp: !!req.headers.get('x-real-ip'),
    xff: !!req.headers.get('x-forwarded-for'),
  }
}
