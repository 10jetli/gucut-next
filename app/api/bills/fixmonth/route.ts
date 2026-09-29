import { NextRequest, NextResponse } from 'next/server'
import { loadBillIndexBlobs, saveBillIndexBlobs } from '@/lib/billblobs'

export const dynamic = 'force-dynamic'

/** เพดาน "จำนวนใบที่จะถูกย้ายจริง" ต่อหนึ่งคำขอที่ไม่ได้ยืนยัน
 *  🔑 ตั้งด่านที่ **ผลลัพธ์** ไม่ใช่ที่รูปของค่าที่รับเข้า (CEO ตัดสิน 29 ก.ย. 2569):
 *     ความยาวขั้นต่ำของ `match` กั้นที่ input ⇒ `match` ยาวก็ยังกวาดทั้งเจ้าได้
 *     และ "ยืนยันทุกครั้ง" จะถูกกดผ่านเป็นนิสัยภายในสัปดาห์เดียว ⇒ เท่ากับไม่มีด่าน
 *     เพดานรัศมีเงียบตอนงานปกติ (ย้าย 1–3 ใบ) และร้องเฉพาะตอนผลลัพธ์กว้างจริง */
const เพดานรัศมี = 20
/** เก็บประวัติกี่ครั้งล่าสุด — ตัดของเก่าออกได้ แต่ห้ามตัดเงียบ (มีธง `ประวัติย้ายเดือนถูกตัด`) */
const เก็บประวัติ = 50

/** ลายนิ้วมือของ "คำขอ + รายการที่มันจะแตะ" — ผูกการยืนยันกับของที่คนเห็นจริง
 *  🔴 ทำไมไม่รับ `confirm: true` เปล่า ๆ (CEO 29 ก.ย. 2569):
 *     บูลีนเปล่ายืนยันได้แค่ "ฉันกดยืนยัน" ไม่ได้ยืนยัน "ฉันดูรายการชุดนี้"
 *     ⇒ รอบที่ถูกตีกลับเห็นรายการ A แล้วรอบยืนยันพิมพ์ `match` ผิดหนึ่งตัว
 *        = ย้ายรายการ B ผ่านฉลุย โดยคำตอบบอกว่าสำเร็จ **ไม่มีอะไรฟ้อง**
 *     ลายนิ้วมือเปลี่ยนตามทั้งคำขอและรายการที่จะย้าย ⇒ ต่างแม้อักขระเดียวก็ตีกลับใหม่
 *     ผลพลอยได้: ถ้าแคชเปลี่ยนระหว่างสองรอบ (มีบิลใหม่เข้ามา) ลายนิ้วมือก็เปลี่ยน
 *     ⇒ ยืนยันที่ค้างอยู่ใช้กับของที่ไม่ใช่ชุดเดิมไม่ได้
 *  ⚠️ ใช้ Web Crypto — **ห้ามเปลี่ยนไป `node:crypto`** (เหตุผลเต็มใน lib/auth-token.ts)
 *  ⚠️ นี่ไม่ใช่โทเคนกันคนร้าย (คนที่มี secret อยู่แล้วคำนวณเองได้) — มันกันความพลาด */
async function ลายนิ้วมือของคำขอ(
  vendor: string, match: string, month: string,
  จะย้าย: { filename: string; month: string }[],
): Promise<string> {
  const เนื้อ = [vendor, match, month, ...จะย้าย.map((e) => `${e.filename}@${e.month}`).sort()].join('\n')
  const ไบต์ = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(เนื้อ))
  return Array.from(new Uint8Array(ไบต์)).slice(0, 6)
    .map((b) => b.toString(16).padStart(2, '0')).join('')
}

const เวลาไทย = () =>
  new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(' ', 'T')

// POST /api/bills/fixmonth { secret, vendor, match, month, confirm? }
// Move wrongly-classified cached bill entries to the correct month.
// Any entry whose filename contains `match` gets its month set to `month`.
// ไม่เปิดสาธารณะโดยตั้งใจ: เส้นนี้ **ย้ายบิลข้ามเดือน (เขียนข้อมูล)** ⇒ ต้องล็อกอิน + secret สองชั้น
//    (ต่างจาก dupcheck/report ที่อ่านอย่างเดียว) · scripts/check-secret-routes.mjs อ่านบรรทัดนี้
//
// 🔑 สามด่านที่เพิ่ม 29 ก.ย. 2569 (CEO ตัดสิน) เรียงตามความสำคัญที่เขาให้:
//    ③ **ร่องรอย** — เดิมตอบแค่ `changed: 3` ⇒ วันที่ตัวเลขบนจอบิลเพี้ยน
//       ไม่มีใครตอบได้ว่าเกิดจากการย้ายครั้งไหน ย้ายใบไหน จากเดือนอะไร
//       ⇒ จดลง **ดัชนีเดียวกับข้อมูลที่มันอธิบาย** ไม่ใช่ที่เก็บแยก
//    ② **เพดานรัศมี** — กั้นที่ผลลัพธ์ (ดูคอมเมนต์ที่ `เพดานรัศมี`)
//    ① **ช่วงเดือน** — 01–12 จริง ไม่ใช่แค่รูป `\d{4}-\d{2}`
export async function POST(req: NextRequest) {
    const body = await req.json()
    const { secret, vendor, match, month, confirm } = body
    const required = process.env.DRIVESYNC_SECRET
    if (!required || secret !== required) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    /* เดือนต้องอยู่ในช่วง 01–12 จริง — `2026-13` เคยผ่านแล้วบิลหายจากทุกจอที่ไล่เดือน 01–12 */
    if (!vendor || !match || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) {
          return NextResponse.json({ error: 'need vendor, match, month (YYYY-MM · เดือน 01–12)' }, { status: 400 })
    }
    const idx = await loadBillIndexBlobs(vendor)
    if (!idx) {
          return NextResponse.json({ error: 'no cache for this vendor' }, { status: 404 })
    }

    /* 🔑 สองเลขนี้ **คนละอย่าง ห้ามเอามาแทนกัน** (CEO ย้ำ 29 ก.ย. 2569)
     *    `จับได้`  = ใบที่ชื่อตรงเงื่อนไข — บอก **รัศมีของ `match`** คือขนาดของการกวาดรอบหน้า
     *                ถ้าวันหนึ่งใบพวกนี้อยู่เดือนอื่น มันจะถูกย้ายทั้งหมดด้วยคำขอหน้าตาเดิม
     *    `จะย้าย` = ใบที่ชื่อตรง **และเดือนต่างจริง** — บอก **ผลของรอบนี้**
     *    เพดานคุมตัวหลัง เพราะด่านต้องอยู่ที่ผลลัพธ์ · แต่ตัวแรกต้องโชว์ทุกรอบ
     *    ไม่งั้น `match: "2"` ที่วันนี้ย้าย 1 ใบ จะดูปลอดภัยทั้งที่รัศมีคือทั้งเจ้า */
    const จับได้ = idx.entries.filter((e) => e.filename.includes(match))
    const จะย้าย = จับได้.filter((e) => e.month !== month)

    if (จะย้าย.length > เพดานรัศมี) {
          const ลายนิ้วมือ = await ลายนิ้วมือของคำขอ(vendor, match, month, จะย้าย)
          if (confirm !== ลายนิ้วมือ) {
                /* ⚠️ ตีกลับแล้ว **ต้องไม่เขียนอะไรเลย รวมทั้งประวัติ**
                 *    ถ้าจดประวัติตอนถูกตีกลับ คนพิมพ์ผิด 50 ครั้งจะเบียดการย้ายจริง
                 *    หลุดหน้าต่าง 50 ครั้งไป ⇒ ร่องรอยหายเพราะความพลาดของคนเอง */
                return NextResponse.json({
                      error: `จะย้าย ${จะย้าย.length} ใบ ซึ่งเกินเพดาน ${เพดานรัศมี} ใบ — ยังไม่ได้ย้ายอะไรเลย`,
                      จับได้: จับได้.length,
                      จะย้าย: จะย้าย.length,
                      เพดาน: เพดานรัศมี,
                      ตัวอย่าง: จะย้าย.slice(0, 5).map((e) => `${e.filename} (${e.month} → ${month})`),
                      ลายนิ้วมือ,
                      ทำต่อโดย: typeof confirm === 'boolean'
                            ? `confirm: true ใช้ไม่ได้ — ต้องส่ง confirm: "${ลายนิ้วมือ}" (ลายนิ้วมือของรายการชุดนี้) เพื่อยืนยันว่าดูรายการเดียวกัน`
                            : `ตรวจรายการแล้วส่งซ้ำด้วย confirm: "${ลายนิ้วมือ}"`,
                }, { status: 409 })
          }
    }

    /* จดว่าจะย้ายอะไร **ก่อน** เปลี่ยนค่า — หลังเปลี่ยนแล้วเดือนเดิมไม่มีใครรู้ */
    const ย้ายแล้ว = จะย้าย.map((e) => ({ filename: e.filename, จาก: e.month, เป็น: month }))
    for (const e of จะย้าย) e.month = month
    const changed = จะย้าย.length

    let ประวัติเก็บไว้ = idx.ประวัติย้ายเดือน?.length ?? 0
    if (changed > 0) {
          const ประวัติ = [...(idx.ประวัติย้ายเดือน ?? []), {
                เมื่อ: เวลาไทย(),
                vendor, match, month,
                จับได้: จับได้.length,
                ย้าย: changed,
                ยืนยันเกินเพดาน: changed > เพดานรัศมี,
                รายการ: ย้ายแล้ว,
          }]
          if (ประวัติ.length > เก็บประวัติ) idx.ประวัติย้ายเดือนถูกตัด = true
          idx.ประวัติย้ายเดือน = ประวัติ.slice(-เก็บประวัติ)
          ประวัติเก็บไว้ = idx.ประวัติย้ายเดือน.length
          await saveBillIndexBlobs(vendor, idx)
    }
    return NextResponse.json({
          ok: true,
          changed,
          จับได้: จับได้.length,
          ย้ายแล้ว,
          ประวัติเก็บไว้,
          /* รัศมีกว้างกว่าผล = คำขอนี้วันนี้ไม่แรง แต่รอบหน้าอาจแรง — ต้องพูด ไม่ใช่เงียบ */
          ...(จับได้.length > changed ? {
                หมายเหตุ: `match นี้ตรงกับ ${จับได้.length} ใบ แต่ย้ายจริง ${changed} ใบ (ที่เหลืออยู่เดือน ${month} แล้ว) — รัศมีของ match กว้างกว่าผลของรอบนี้`,
          } : {}),
    })
}
