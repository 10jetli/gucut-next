// ตัวกวาดจอในเบราว์เซอร์ — วางลง DevTools Console ของ admin.gucut.com (หรือ dev ที่ล็อกอินแล้ว)
// ใช้คู่กับ scripts/fake-pipe.mjs เพื่อดูว่า "จอพูดอะไร" ในแต่ละสภาพของข้อมูล
//
// 🔴 **ทำไมต้องมีไฟล์นี้ แทนที่จะเขียนสด ๆ ทุกครั้ง** (7 ก.ย. 2569)
//    ตัวกวาดรอบแรกเขียนสดแบบ "รอ 13 วิแล้วอ่านข้อความ" ⇒ ไปยืนคร่อมเส้นพอดีกับจอที่ใช้ ~13 วิ
//    ⇒ รายงานว่า **"จอว่าง"** ทั้งที่ของจริงแค่ **ช้า** ⇒ พาไล่บั๊กผิดตัว
//    ⚠️ และทางแก้ที่ผิดคือ "รอนานขึ้น" — พรุ่งนี้จอช้าเป็น 20 วิ ก็พังอีก
//       ทางแก้ที่ถูกคือ **ดูสัญญาณบวก ไม่ใช่นับเวลา** (ฝั่งท่อชี้ไว้ และถูก)
//
// 🔑 **สามสถานะ ห้ามยุบเหลือสอง** (กฎเดียวกับที่ใช้ทั้งระบบ)
//    ① ยังโหลดอยู่   — เจอตัวหมุน / คำว่า "กำลังโหลด" ⇒ **รอต่อ ห้ามตัดสิน**
//    ② ตัดสินได้     — เจอเนื้อหาจริง หรือกล่องสถานะที่หน้าเขียนเอง (แดง/เหลือง/เขียว)
//    ③ ตัดสินไม่ได้  — ครบเพดานแล้วยังไม่เจอทั้งสองอย่าง
//                     ⇒ รายงานว่า "ตัดสินไม่ได้ใน N วิ" **ห้ามเขียนว่า "ว่าง" หรือ "พัง"**
//
// วิธีใช้:
//   await sweep(['/core/stock', '/core/pos'])            // เจาะจงหน้า
//   await sweep(ALL_ROUTES)                              // ทั้งชุด (ดูตัวแปรข้างล่าง)
window.sweep = async function sweep(routes, capMs = 45000) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const out = []

  for (const path of routes) {
    const f = document.createElement('iframe')
    f.style.cssText = 'width:1200px;height:900px;position:fixed;left:-9999px'
    f.src = path
    document.body.appendChild(f)
    await new Promise((r) => { f.onload = r; setTimeout(r, 15000) })

    const t0 = Date.now()
    let verdict = null
    while (Date.now() - t0 < capMs) {
      let doc = null
      try { doc = f.contentDocument } catch { /* ข้ามโดเมน — ไม่ควรเกิดกับหน้าเราเอง */ }
      const main = doc && doc.querySelector('main')
      const txt = ((main && main.innerText) || '').replace(/\s+/g, ' ').trim()

      // ① ยังโหลดอยู่ — สัญญาณบวกว่า "ยังไม่จบ" (ห้ามตัดสินตอนนี้)
      const loading = /กำลังโหลด|กำลังตรวจ|กำลังรวม|กำลังวิเคราะห์/.test(txt)
        || !!(doc && doc.querySelector('.animate-pulse, .spinner'))

      // ตัวจับพลาดของหน้า = พังแน่นอน ไม่ต้องรอต่อ
      if (txt.includes('หน้านี้มีปัญหา')) { verdict = { state: '🔴 พัง', txt }; break }

      // ② ตัดสินได้ — มีเนื้อหาจริง หรือมีกล่องสถานะที่หน้าเขียนเอง
      const box = !!(doc && doc.querySelector('.bg-red-50, .bg-amber-50, .bg-emerald-50'))
      if (!loading && (txt.length > 60 || box)) { verdict = { state: '✅ ตัดสินได้', txt }; break }

      await sleep(500)
    }

    // ③ ครบเพดานแล้วยังไม่เจอสัญญาณไหนเลย
    if (!verdict) {
      let txt = ''
      try { txt = ((f.contentDocument.querySelector('main') || {}).innerText || '').replace(/\s+/g, ' ').trim() } catch {}
      verdict = { state: `⚠️ ตัดสินไม่ได้ใน ${Math.round(capMs / 1000)} วิ`, txt }
    }

    const secs = ((Date.now() - t0) / 1000).toFixed(1)
    // ค่าที่ไม่ควรโผล่บนจอเลย — เจอเมื่อไหร่แปลว่าเอา undefined ไปวาด
    const junk = (verdict.txt.match(/.{0,25}(NaN|undefined|\[object Object\]).{0,20}/) || [''])[0]
    out.push({ path, สถานะ: verdict.state, วิ: secs, ค่าเพี้ยน: junk || '-', ตัวอย่าง: verdict.txt.slice(0, 90) })
    f.remove()
  }
  console.table(out)
  return out
}

/** เส้นทางทั้งหมดของหลังร้าน — อัปเดตด้วย: find app -name page.tsx (ตัดที่มี [ ] ออก) */
window.ALL_ROUTES = ['/','/ads','/ai-visibility','/bills','/core','/core/accounting-docs','/core/arch','/core/backup','/core/branches','/core/bundles','/core/buy-report','/core/categories','/core/channels','/core/chat','/core/customer-report','/core/customers','/core/factory-orders','/core/finance','/core/leadtime','/core/logistics','/core/manual','/core/marketplace','/core/marketplace-products','/core/missing-sku','/core/money-transfers','/core/moves','/core/other-expense','/core/other-income','/core/packing','/core/peak','/core/pos','/core/purchases','/core/purchases/new','/core/quotations','/core/quotations/new','/core/receive','/core/reorder','/core/reports','/core/return-orders','/core/salepages','/core/sales','/core/sales/detail','/core/setting-notify','/core/settings-company','/core/settings-jobs','/core/settings-profile','/core/settings-users','/core/stock','/core/stock/new','/core/transfers','/core/usage','/core/variants','/core/wallet','/core/zort-archive','/core/zort-claims','/core/zort-noapi','/core/zort-webhook','/factory','/import','/orders','/products','/returns','/sales','/settings/connections','/settings/connections/health','/site','/site/attendance','/store/products','/tracker','/web/ads','/web/chat','/web/clip-shop','/web/clips','/web/comments','/web/coupons','/web/legacy','/web/live','/web/marketing','/web/orders','/web/permits','/web/points','/web/seo','/web/status','/web/videos']
