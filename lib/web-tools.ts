// รายการเครื่องมือของเว็บไซต์ gucut.com — ใช้ทั้งหน้ารวม (แบบ Shopify App Store)
// และหน้าเปิดเครื่องมือรายตัว (/site/tool/<slug>)
//
// ⚠️ path ต้องตรงกับหน้าจริงใน gucut.com/admin/ — เพิ่ม/ลบหน้าที่โน่นต้องมาแก้ที่นี่
// native = ย้ายเป็นเนื้อเดียวแล้ว ชี้ไปหน้าในโดเมนนี้แทนการฝังกรอบ

export interface WebTool {
  slug: string
  path: string          // ใต้ gucut.com/admin/ (หรือเส้นทางในโดเมนนี้เมื่อ native)
  native?: boolean
  title: string
  desc: string
  cat: 'การขาย' | 'คอนเทนต์' | 'การตลาด' | 'ระบบ'
  icon: string          // path ของ SVG เส้น
  grad: string          // ไล่สีพื้นไอคอน
  isNew?: boolean
}

const IC = {
  bag: 'M6 7h12l1 13H5L6 7zM9 7a3 3 0 016 0',
  chat: 'M21 12a8 8 0 01-8 8H4l2.3-2.9A8 8 0 1121 12zM8.5 12h.01M12 12h.01M15.5 12h.01',
  video: 'M3.5 7.5h11a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-7a1 1 0 011-1zM15.5 11l5-3v9l-5-3',
  tag: 'M4 12.5V5a1 1 0 011-1h7.5L21 12.5 12.5 21 4 12.5zM8.5 8.5h.01',
  star: 'M12 3l2.6 5.6 6.4.8-4.7 4.3 1.3 6.3L12 17l-5.6 3 1.3-6.3L3 9.4l6.4-.8L12 3z',
  link: 'M9 15l6-6M10.5 6.5l1-1a4 4 0 016 6l-1 1M13.5 17.5l-1 1a4 4 0 01-6-6l1-1',
  search: 'M11 5a6 6 0 100 12 6 6 0 000-12zM20 20l-4.2-4.2',
  pixel: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  chart: 'M4 20V10M10 20V4M16 20v-8M2 20h20',
  saw: 'M3 14l9-9 2 2-9 9H3v-2zM14 3l7 7M9 20h12',
  clock: 'M12 3a9 9 0 109 9 9 9 0 00-9-9zM12 7v5l3 2',
  history: 'M4 12a8 8 0 108-8M4 4v5h5M12 8v4l3 2',
  pulse: 'M3 12h4l2.5-6 4 12 2.5-6H21',
  heart: 'M12 21s-7.5-4.8-9.5-9.5C1 7.5 4 4 7.5 4c2 0 3.5 1 4.5 2.5C13 5 14.5 4 16.5 4 20 4 23 7.5 21.5 11.5 19.5 16.2 12 21 12 21z',
  play: 'M12 3a9 9 0 109 9 9 9 0 00-9-9zM10 8.5l5 3.5-5 3.5v-7z',
}

export const WEB_TOOLS: WebTool[] = [
  { slug: 'orders', path: '/web/orders', native: true, isNew: true, cat: 'การขาย',
    title: 'ออเดอร์เว็บ', desc: 'รายการสั่งซื้อจากหน้าเว็บ · เปลี่ยนสถานะ · ดูสลิป · ส่งเข้า ZORT',
    icon: IC.bag, grad: 'from-sky-400 to-blue-600' },
  { slug: 'chat', path: '/web/chat', native: true, isNew: true, cat: 'การขาย',
    title: 'แชทลูกค้า', desc: 'อ่านและตอบข้อความที่ลูกค้าทักจากหน้าเว็บ',
    icon: IC.chat, grad: 'from-emerald-400 to-teal-600' },
  { slug: 'permits', path: 'permits', cat: 'การขาย',
    title: 'ขอทะเบียนเลื่อยยนต์', desc: 'ลูกค้าเดินเรื่องถึงขั้นไหน · ใบ ลซ.๒ ที่ส่งเข้ามา',
    icon: IC.saw, grad: 'from-orange-400 to-red-500' },
  { slug: 'legacy', path: 'legacy', cat: 'การขาย',
    title: 'ประวัติลูกค้าเก่า', desc: 'เคยซื้ออะไรสมัยยังอยู่ Shopify — ไว้ตอบลูกค้าเก่า',
    icon: IC.history, grad: 'from-slate-400 to-gray-600' },
  { slug: 'videos', path: 'videos', cat: 'คอนเทนต์',
    title: 'เลือกคลิป', desc: 'เลือกว่าคลิปไหนขึ้นหน้าวิดีโอของเว็บ',
    icon: IC.video, grad: 'from-fuchsia-400 to-pink-600' },
  { slug: 'clip-shop', path: 'clip-shop', cat: 'คอนเทนต์',
    title: 'ผูกสินค้ากับคลิป', desc: 'ให้คลิปในฟีดมีปุ่มกดซื้อได้',
    icon: IC.link, grad: 'from-violet-400 to-purple-600' },
  { slug: 'comments', path: 'comments', cat: 'คอนเทนต์',
    title: 'คอมเมนต์ใต้คลิป', desc: 'อ่าน / ลบคอมเมนต์ที่ไม่เหมาะสม',
    icon: IC.heart, grad: 'from-rose-400 to-red-500' },
  { slug: 'clips', path: 'clips', cat: 'คอนเทนต์',
    title: 'สถิติคลิป', desc: 'คลิปไหนคนดูเยอะ · ดูจนจบกี่เปอร์เซ็นต์',
    icon: IC.play, grad: 'from-cyan-400 to-sky-600' },
  { slug: 'coupons', path: '/web/coupons', native: true, isNew: true, cat: 'การตลาด',
    title: 'โค้ดส่วนลด', desc: 'สร้างโค้ดให้ลูกค้ากดเก็บแบบ Shopee',
    icon: IC.tag, grad: 'from-amber-400 to-orange-500' },
  { slug: 'points', path: 'points', cat: 'การตลาด',
    title: 'แต้มสะสม', desc: 'ตั้งกติกาแต้ม · ปรับแต้มให้ลูกค้า',
    icon: IC.star, grad: 'from-yellow-400 to-amber-500' },
  { slug: 'marketing', path: 'marketing', cat: 'การตลาด',
    title: 'พิกเซลการตลาด', desc: 'รหัส Meta · TikTok · GA4 · Google Ads · LINE Tag',
    icon: IC.pixel, grad: 'from-blue-400 to-indigo-600' },
  { slug: 'ads', path: 'ads', cat: 'การตลาด',
    title: 'ค่าโฆษณา vs ยอดขาย', desc: 'จ่ายค่าโฆษณาไปเท่าไหร่ ได้ยอดกลับมาเท่าไหร่',
    icon: IC.chart, grad: 'from-lime-400 to-green-600' },
  { slug: 'seo', path: 'seo', cat: 'ระบบ',
    title: 'ตรวจสุขภาพ SEO', desc: 'งานที่ควรแก้ · บอต AI มาเก็บข้อมูลหรือยัง',
    icon: IC.search, grad: 'from-teal-400 to-emerald-600' },
  { slug: 'attendance', path: '/site/attendance', native: true, cat: 'ระบบ',
    title: 'ลงเวลาพนักงาน', desc: 'เข้า-ออกงาน · มาสาย · ชั่วโมงรวมทั้งเดือน',
    icon: IC.clock, grad: 'from-indigo-400 to-blue-600' },
  { slug: 'live', path: '/web/live', native: true, isNew: true, cat: 'ระบบ',
    title: 'คนเข้าเว็บ', desc: 'ออนไลน์ตอนนี้ · มาจากไหน · สมาชิก · PWA',
    icon: IC.pulse, grad: 'from-pink-400 to-rose-600' },
  { slug: 'status', path: '/web/status', native: true, isNew: true, cat: 'ระบบ',
    title: 'สถานะระบบ', desc: 'เช็ค 22 เรื่องว่าอะไรใช้ได้ อะไรพัง',
    icon: IC.heart, grad: 'from-red-400 to-rose-600' },
]

export const CATS = ['ทั้งหมด', 'การขาย', 'คอนเทนต์', 'การตลาด', 'ระบบ'] as const
