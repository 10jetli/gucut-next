'use client'
// แสดงผลของ "การเขียนทะลุไป ZORT" — ใช้ร่วมกันทุกฟอร์มที่ส่งข้อมูลเข้า ZORT
// (เพิ่มสินค้า · ใบสั่งซื้อ · ใบเสนอราคา · รับคืนสินค้า · เพิ่มผู้ติดต่อ)
//
// 🔴 **สี่สถานะ ไม่ใช่สอง — ข้อที่สามคือข้อที่ทำให้ของพัง**
//    ① สำเร็จ      ok:true
//    ② เคยส่งไปแล้ว duplicate:true — **ห้ามขึ้นเขียวว่าสำเร็จ** (คนจะกดซ้ำจนได้เอกสารซ้ำ)
//    ③ **ไม่รู้ผล**  unknown:true — ส่งไปแล้วแต่ไม่ได้คำตอบกลับ (เน็ตขาด/หมดเวลารอ)
//       ⚠️ **ห้ามแสดงว่า "ไม่สำเร็จ" เด็ดขาด** ของอาจเข้า ZORT ไปแล้ว
//          บอกว่าไม่สำเร็จ = คนกดส่งใหม่ = เอกสารซ้ำใน ZORT ซึ่ง **ลบไม่ได้ผ่าน API**
//          ต้องบอกให้ไปเปิด ZORT ดูก่อนเสมอ
//    ④ ไม่สำเร็จ    ok:false — ไม่ได้เข้าไปแน่นอน ส่งใหม่ได้เลย
//
// 🔴 **`warn` ต้องขึ้นทุกกรณี ไม่ว่าผลจะเป็นอะไร** — มันคือ "สำเร็จแต่มีบางอย่างไม่ตรงที่ขอ"
//    (เช่น ZORT เมินฟิลด์ที่ไม่รู้จักไปเงียบ ๆ) ซ่อนตอนสำเร็จ = ของหายโดยไม่มีใครรู้
//
// 🔴 **โหมดซ้อมต้องเห็นชัดกว่าทุกอย่างบนจอ** — คนกดแล้วเห็นเขียวจะเดินจากไป
//    ทั้งที่ยังไม่ได้ส่งอะไรเลย ⇒ ป้าย "ทดลองส่ง" ต้องอยู่บนสุดและใหญ่กว่าผลลัพธ์
import type { ReactNode } from 'react'

export interface WriteResp {
  ok?: boolean
  /** เคยส่งใบนี้ไปแล้ว (กันซ้ำด้วย ref ที่ฝั่งท่อ) */
  duplicate?: boolean
  /** ส่งไปแล้วแต่ไม่รู้ผล — **ไม่ใช่ "ไม่สำเร็จ"** */
  unknown?: boolean
  /** สำเร็จแต่มีเรื่องต้องรู้ */
  warn?: string
  /** ข้อความอธิบายผลจากฝั่งท่อ — ให้ท่อเป็นคนเขียน จอไม่แต่งเอง */
  message?: string
  error?: string
  /** ใบนี้คือใบไหน — ใช้ตามหาใน ZORT ตอนต้องไปตรวจเอง */
  ref?: string
  /** ยังไม่ได้ส่งจริง (โหมดซ้อม) */
  dryRun?: boolean
  detail?: unknown
}

function Box({ tone, title, children }: {
  tone: 'green' | 'amber' | 'red' | 'blue'; title: string; children?: ReactNode
}) {
  const c = {
    green: 'text-emerald-900 bg-emerald-50 border-emerald-300',
    amber: 'text-amber-900 bg-amber-50 border-amber-300',
    red: 'text-red-900 bg-red-50 border-red-300',
    blue: 'text-blue-900 bg-blue-50 border-blue-300',
  }[tone]
  return (
    <div className={`text-[13px] border rounded-md px-3.5 py-2.5 leading-relaxed ${c}`}>
      <b>{title}</b>
      {children}
    </div>
  )
}

export function WriteResult({ r }: { r: WriteResp | null }) {
  if (!r) return null

  /* ⚠️ ลำดับการตัดสินสำคัญมาก — unknown ต้องมาก่อน ok:false เสมอ
     ถ้าเช็ค ok ก่อน ใบที่ไม่รู้ผล (ok ไม่ได้เป็น true) จะตกลงไปเป็น "ไม่สำเร็จ" ทันที
     ซึ่งเป็นข้อความที่พาคนไปกดส่งซ้ำ = เอกสารซ้ำใน ZORT ที่ลบไม่ได้ */
  const state: 'dry' | 'unknown' | 'duplicate' | 'ok' | 'fail' =
    r.dryRun ? 'dry'
      : r.unknown ? 'unknown'
        : r.duplicate ? 'duplicate'
          : r.ok ? 'ok' : 'fail'

  return (
    <div className="space-y-2 mt-3">
      {state === 'dry' && (
        <Box tone="blue" title="🧪 โหมดทดลองส่ง — ยังไม่ได้ส่งเข้า ZORT">
          <p className="mt-1">
            {r.message || 'ตรวจข้อมูลผ่านแล้ว แต่ยังไม่มีอะไรถูกสร้างใน ZORT'}
            {' '}<b>ต้องกด &ldquo;ส่งจริง&rdquo; อีกครั้งถึงจะเข้า</b>
          </p>
        </Box>
      )}

      {state === 'unknown' && (
        /* 🔴 หัวใจของคอมโพเนนต์นี้ทั้งตัวอยู่ที่กล่องนี้
           ห้ามเปลี่ยนข้อความให้อ่านเหมือน "ไม่สำเร็จ" ไม่ว่าจะสั้นลงแค่ไหน */
        <Box tone="amber" title="⚠️ ส่งไปแล้ว แต่ไม่ได้คำตอบกลับ — ยังไม่รู้ว่าเข้าหรือไม่เข้า">
          <p className="mt-1">
            {r.message || 'ปลายทางไม่ตอบกลับภายในเวลาที่รอ'}
            <br />
            <b>ห้ามกดส่งซ้ำทันที</b> — ของอาจเข้า ZORT ไปแล้ว กดซ้ำจะได้เอกสารสองใบ
            และ <b>ZORT ลบเอกสารผ่าน API ไม่ได้</b>
            <br />
            ให้เปิด ZORT ดูก่อนว่ามีใบนี้แล้วหรือยัง{r.ref && <> (อ้างอิง <code>{r.ref}</code>)</>}
          </p>
        </Box>
      )}

      {state === 'duplicate' && (
        <Box tone="blue" title="ℹ️ ใบนี้เคยส่งไปแล้ว — ไม่ได้สร้างซ้ำ">
          <p className="mt-1">
            {r.message || 'ระบบกันซ้ำจับได้ว่าเป็นใบเดียวกับที่เคยส่ง'}
            {r.ref && <> · อ้างอิง <code>{r.ref}</code></>}
          </p>
        </Box>
      )}

      {state === 'ok' && (
        <Box tone="green" title="✅ ส่งเข้า ZORT แล้ว">
          <p className="mt-1">
            {r.message || 'สร้างเอกสารใน ZORT เรียบร้อย'}
            {r.ref && <> · อ้างอิง <code>{r.ref}</code></>}
          </p>
        </Box>
      )}

      {state === 'fail' && (
        <Box tone="red" title="❌ ไม่สำเร็จ — ไม่มีอะไรถูกสร้างใน ZORT">
          <p className="mt-1">{r.error || r.message || 'ไม่ทราบสาเหตุ'} · แก้แล้วส่งใหม่ได้เลย</p>
        </Box>
      )}

      {/* 🔴 ขึ้นทุกกรณี รวมตอนสำเร็จ — "สำเร็จแต่ไม่ครบ" คือของที่หายเงียบที่สุด */}
      {r.warn && (
        <Box tone="amber" title="⚠️ สำเร็จ แต่มีเรื่องต้องรู้">
          <p className="mt-1">{r.warn}</p>
        </Box>
      )}
    </div>
  )
}
