'use client'
// เชื่อมบัญชี TikTok — ปลายทางของท่อกระจายคลิป (facebook.com/AJt8888 → tiktok.com/@ajtcut_8)
// ท่อ: /api/web/oauth/tiktok-video  ·  ตัวท่อที่ใช้กุญแจนี้จริงคือ ~/repost-fb-yt/ลงtiktok.py
//
// ⚠️ กติกาเจ้าของร้าน: ตรวจเมื่อกดเอง **ห้ามตรวจอัตโนมัติ** (เหมือนหน้าสถานะระบบ)
//    ⇒ ไม่มี useEffect ที่ยิงเส้นใด ๆ ตอนเปิดหน้า · ทุกการยิงมาจากการกดปุ่ม
import { useState } from 'react'
import { คำอธิบายรหัส, ตีความคำตอบ, ลิงก์เพจ, เงียบไปนาที, type กล่อง } from '@/lib/tiktok-pipe-ui'

function I({ d, className = 'w-4 h-4' }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={d} /></svg>
}

/* 🔴 สามสถานะ ไม่ใช่สองสถานะ — "ยังไม่รู้" ต้องไม่ปนกับ "ยังไม่ได้เชื่อม"
   (หน้าที่มีแค่ เชื่อมแล้ว/ยังไม่เชื่อม จะแสดง "ยังไม่เชื่อม" ตอนท่อล่ม ซึ่งหลอกตา
    แล้วคนจะไปกดสร้างลิงก์ใหม่ทั้งที่ของเดิมยังดีอยู่) */
type สถานะ =
  | { แบบ: 'ยังไม่รู้' }
  | { แบบ: 'เชื่อมแล้ว' }
  | { แบบ: 'ยังไม่เชื่อม'; เหตุ: string }
  | { แบบ: 'อ่านไม่ได้'; เหตุ: string }

interface ใบลิงก์ { ลิงก์: string; หมดอายุนาที?: number; บอก?: string }

/* แสดงเวลาไทยให้คนอ่าน — อยู่ในหน้าจอเพราะพึ่ง locale ของเบราว์เซอร์
   ⚠️ **ห้ามเอาไปใช้คำนวณอะไร** ตัวคิดส่วนต่างเวลาอยู่ที่ `เงียบไปนาที` ซึ่งใช้นาฬิกาเซิร์ฟเวอร์ทั้งคู่ */
const เวลาไทย = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

/* 🔑 ชนิดข้อมูล + ตรรกะการตีความคำตอบ ย้ายไป `lib/tiktok-pipe-ui.ts` แล้ว **เพราะต้องมีเทส**
   ความผิดที่แพงที่สุดของจอนี้คือ "อ่านไม่ได้" ถูกแสดงเป็น "ยังไม่เคยส่งคลิป"
   ⇒ ตรรกะที่ฝังใน client component ไม่มีเทสไหนแตะถึง (ดู scripts/tests/tiktok-pipe-ui.test.mjs) */

export default function WebTiktokPage() {
  const [สถานะ, setสถานะ] = useState<สถานะ>({ แบบ: 'ยังไม่รู้' })
  const [ตรวจอยู่, setตรวจอยู่] = useState(false)
  const [ใบ, setใบ] = useState<ใบลิงก์ | null>(null)
  const [สร้างอยู่, setสร้างอยู่] = useState(false)
  const [ผิดพลาดลิงก์, setผิดพลาดลิงก์] = useState('')
  const [คัดลอกแล้ว, setคัดลอกแล้ว] = useState(false)
  const [ตรวจเมื่อ, setตรวจเมื่อ] = useState('')
  const [กล่อง, setกล่อง] = useState<กล่อง>({ แบบ: 'ยังไม่ได้โหลด' })
  const [โหลดอยู่, setโหลดอยู่] = useState(false)
  const [ส่งอยู่, setส่งอยู่] = useState(false)
  const [ผลขอรอบ, setผลขอรอบ] = useState('')

  /* 📋 โหลดรายการที่ส่งไปแล้ว — **กดเอง** ตามกฎห้ามตรวจอัตโนมัติ (ไม่มี useEffect ยิงเส้นนี้) */
  async function โหลดรายการ() {
    setโหลดอยู่(true)
    try {
      const r = await fetch('/api/web/tiktok-pipe')
      const d = await r.json().catch(() => null)
      /* 🔑 การตีความอยู่ใน lib ที่มีเทสยิงใส่ — ที่นี่แค่เอาผลไปวาด
         (รวมถึงเคส "200 แต่รูปข้อมูลไม่ตรงสัญญา" ซึ่งต้องกลายเป็น 'อ่านไม่ได้') */
      setกล่อง(ตีความคำตอบ(r.ok, r.status, d))
    } catch (e) {
      setกล่อง({ แบบ: 'อ่านไม่ได้', เหตุ: `เรียกท่อไม่สำเร็จ — ${e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'}` })
    } finally { setโหลดอยู่(false) }
  }

  /* ▶️ ฝากคำขอ "ส่งรอบถัดไปเดี๋ยวนี้" ไว้ให้ g1 มาหยิบ
     🔴 **ปุ่มนี้ไม่ได้ส่งคลิปเอง** — ตัวที่ส่งคือท่อบน g1 ซึ่งอ่านคำขอนี้ทุกนาที
        ⇒ ข้อความบนจอต้องเขียนว่า "ฝากคำขอแล้ว" ไม่ใช่ "ส่งแล้ว" (ไม่งั้นคนจะรอดูผลผิดจังหวะ) */
  async function ขอส่งรอบนี้() {
    setส่งอยู่(true); setผลขอรอบ('')
    try {
      const r = await fetch('/api/web/tiktok-pipe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ขอรอบ: 1 }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok || !d?.ok) {
        setผลขอรอบ(`🔴 ฝากคำขอไม่สำเร็จ — ${String(d?.error ?? `HTTP ${r.status}`)}`)
        return
      }
      setผลขอรอบ(d['ซ้ำ']
        ? `ℹ️ มีคำขอค้างอยู่แล้วตั้งแต่ ${เวลาไทย(d['ขอเมื่อ'])} — g1 ยังไม่ได้มาหยิบไปทำ`
        : `✅ ฝากคำขอไว้แล้ว ${เวลาไทย(d['ขอเมื่อ'])} — g1 อ่านคำขอนี้ทุกนาที แล้วกด “โหลดรายการ” ดูผล`)
      await โหลดรายการ()
    } catch (e) {
      setผลขอรอบ(`🔴 เรียกท่อไม่สำเร็จ — ${e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'}`)
    } finally { setส่งอยู่(false) }
  }

  async function ตรวจสถานะ() {
    setตรวจอยู่(true)
    try {
      /* 🔑 อ่าน **รหัส HTTP** เป็นตัวตัดสิน ไม่ใช่เนื้อในคำตอบ
         200 = เชื่อมแล้ว · 409 = ยังไม่ได้เชื่อม · อื่น ๆ = อ่านไม่ได้ (ไม่ใช่ "ไม่ผ่าน")
         ⚠️ **ไม่แตะ `access_token` ที่เส้นนี้คืนมา ไม่เก็บ ไม่แสดง ไม่ log**
            (ดูคำเตือนเรื่องกุญแจที่ท้ายไฟล์นี้) */
      const r = await fetch('/api/web/oauth/tiktok-video?token=1')
      setตรวจเมื่อ(new Date().toLocaleTimeString('th-TH'))
      if (r.status === 200) { setสถานะ({ แบบ: 'เชื่อมแล้ว' }); return }
      let เหตุ = ''
      try { const d = await r.json(); เหตุ = String(d?.['เหตุ'] ?? d?.error ?? '') } catch { /* ปลายทางไม่ใช่ JSON */ }
      if (r.status === 409) { setสถานะ({ แบบ: 'ยังไม่เชื่อม', เหตุ: เหตุ || 'ยังไม่ได้เชื่อมบัญชี TikTok' }); return }
      /* 🔴 ห้ามเขียนเหตุเอง — ใช้เหตุที่ปลายทางบอกมาจริง · ไม่มีก็บอกว่าไม่มี */
      setสถานะ({ แบบ: 'อ่านไม่ได้', เหตุ: เหตุ ? `HTTP ${r.status} · ${เหตุ}` : `HTTP ${r.status} (ปลายทางไม่ได้บอกเหตุมา)` })
    } catch (e) {
      setสถานะ({ แบบ: 'อ่านไม่ได้', เหตุ: `เรียกท่อไม่สำเร็จ — ${e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'}` })
    } finally { setตรวจอยู่(false) }
  }

  async function สร้างลิงก์() {
    setสร้างอยู่(true); setผิดพลาดลิงก์(''); setคัดลอกแล้ว(false)
    try {
      const r = await fetch('/api/web/oauth/tiktok-video')
      const d = await r.json().catch(() => null)
      const ลิงก์ = typeof d?.['ลิงก์'] === 'string' ? d['ลิงก์'] : ''
      if (!r.ok || !ลิงก์) {
        const เหตุ = String(d?.['เหตุ'] ?? d?.error ?? '')
        setผิดพลาดลิงก์(เหตุ ? `HTTP ${r.status} · ${เหตุ}` : `HTTP ${r.status} — ท่อไม่ได้ส่งลิงก์กลับมา`)
        setใบ(null); return
      }
      setใบ({
        ลิงก์,
        /* ⏳ นับถอยหลังจากค่าที่ **เส้นคืนมา** ไม่ใช่เลขที่เราเขียนไว้เอง
           ไม่มีค่ามา = ไม่โชว์เวลา (ว่างดีกว่าเดา) */
        หมดอายุนาที: typeof d?.['หมดอายุนาที'] === 'number' ? d['หมดอายุนาที'] : undefined,
        บอก: typeof d?.['บอก'] === 'string' ? d['บอก'] : undefined,
      })
    } catch (e) {
      setผิดพลาดลิงก์(`เรียกท่อไม่สำเร็จ — ${e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ'}`)
      setใบ(null)
    } finally { setสร้างอยู่(false) }
  }

  const ป้าย = {
    'ยังไม่รู้':     { คำ: 'ยังไม่ได้ตรวจ',  สี: 'text-gray-400',    จุด: 'bg-gray-300',    วง: 'ring-gray-50' },
    'เชื่อมแล้ว':    { คำ: 'เชื่อมแล้ว',     สี: 'text-emerald-600', จุด: 'bg-emerald-500', วง: 'ring-emerald-50' },
    'ยังไม่เชื่อม':  { คำ: 'ยังไม่ได้เชื่อม', สี: 'text-gray-500',    จุด: 'bg-gray-400',    วง: 'ring-gray-50' },
    'อ่านไม่ได้':    { คำ: 'อ่านไม่ได้',     สี: 'text-red-500',     จุด: 'bg-red-500',     วง: 'ring-red-50' },
  }[สถานะ.แบบ]

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="mr-auto">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · ท่อกระจายคลิป</p>
          <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">เชื่อมบัญชี TikTok</h1>
          {ตรวจเมื่อ && <p className="text-[12.5px] mt-0.5 text-gray-400">ตรวจล่าสุด {ตรวจเมื่อ}</p>}
        </div>
        <button onClick={ตรวจสถานะ} disabled={ตรวจอยู่}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-5 py-2.5 text-[12.5px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] transition-all hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50">
          <I d="M20 11a8 8 0 10.9 4.5M20 4v6h-6" className={`w-4 h-4 ${ตรวจอยู่ ? 'animate-spin' : ''}`} />
          {ตรวจอยู่ ? 'กำลังตรวจ…' : 'ตรวจสถานะ'}
        </button>
      </div>

      {/* แถบสถานะ */}
      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] px-4 md:px-5 py-3.5 flex items-center gap-3.5">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ป้าย.จุด} ring-4 ${ป้าย.วง}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-bold text-gray-900">กุญแจของบัญชีปลายทาง (@ajtcut_8)</span>
          <span className="block text-[12.5px] text-gray-500 mt-0.5">
            {สถานะ.แบบ === 'ยังไม่รู้' ? 'กด “ตรวจสถานะ” เพื่อยิงถามของจริง — หน้านี้ไม่ตรวจเอง'
              : สถานะ.แบบ === 'เชื่อมแล้ว' ? 'ท่อลงคลิปใช้กุญแจนี้ได้ · เส้นนี้ไม่ได้คืนชื่อบัญชีมา จึงไม่โชว์ชื่อ'
              : สถานะ.แบบ === 'ยังไม่เชื่อม' ? สถานะ.เหตุ
              : สถานะ.เหตุ}
          </span>
        </span>
        <span className={`text-[12.5px] font-bold shrink-0 ${ป้าย.สี}`}>{ป้าย.คำ}</span>
      </div>

      {/* 🔴 คำเตือนสองข้อ — ของจริงที่เจอวันนี้ (24 ต.ค. 2569) ไม่ใช่คำเตือนลอย ๆ
          วางไว้ "ก่อน" ปุ่มสร้างลิงก์ตามกฎ warning-placement (คำเตือนที่ต้องเลื่อนจอถึงเห็น = วางผิดที่) */}
      <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3.5 space-y-2">
        <p className="text-[12.5px] font-bold text-amber-900">อ่านก่อนกดอนุญาต — เจอมาจริงทั้งสองข้อ</p>
        <p className="text-[12.5px] text-amber-900/90">
          <span className="font-bold">① ต้องยินยอมด้วย @ajtcut_8 เท่านั้น</span> — ล็อกอินบัญชีอื่นแล้วกดอนุญาต
          เซิร์ฟเวอร์จะไม่เก็บกุญแจให้ (เสียเวลาเปล่าและต้องเริ่มใหม่ทั้งรอบ)
        </p>
        {/* 🔑 **ตัวเลขที่วัดได้ย้ายมาอยู่ในคอมเมนต์ ไม่ขึ้นบนจอ** (ด่าน "เลขค้างบนจอ" จับได้ถูก)
            ของจริงที่วัด 24 ต.ค. 2569: เฉพาะคุกกี้ที่มองเห็นได้ 5,159 ไบต์ 57 ตัว
            เลขนั้นเป็นของเครื่องหนึ่งเครื่อง ณ วันหนึ่งวัน ⇒ พิมพ์ไว้บนจอคือคำกล่าวอ้างที่เก่าเงียบ ๆ
            และคนอ่านไม่ต้องใช้เลขนี้ทำอะไรเลย — เขาต้องรู้แค่ว่า "เจอ 431 ให้เปิดหน้าต่างไม่ระบุตัวตน" */}
        <p className="text-[12.5px] text-amber-900/90">
          <span className="font-bold">② เจอ HTTP 431 ให้เปิดหน้าต่างไม่ระบุตัวตน</span> — คุกกี้ของ tiktok.com
          ในเบราว์เซอร์ที่ใช้อยู่บวมเกินที่ TikTok รับ (เจอมาจริงวันนี้) · หน้าต่างใหม่ที่ไม่มีคุกกี้เก่าผ่านได้
        </p>
      </div>

      {/* ปุ่มสร้างลิงก์ + ผล */}
      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] p-4 md:p-5 space-y-3">
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-bold text-gray-900">สร้างลิงก์เชื่อมบัญชี</span>
            <span className="block text-[12.5px] text-gray-500 mt-0.5">เปิดลิงก์แล้วกดอนุญาตด้วยบัญชีปลายทาง · กุญแจจะถูกเก็บฝั่งเซิร์ฟเวอร์</span>
          </span>
          <button onClick={สร้างลิงก์} disabled={สร้างอยู่}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-[12.5px] font-bold text-gray-900 transition-all hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50 shrink-0">
            <I d="M9 15l6-6M10.5 6.5l1-1a4 4 0 016 6l-1 1M13.5 17.5l-1 1a4 4 0 01-6-6l1-1" className={`w-4 h-4 ${สร้างอยู่ ? 'animate-spin' : ''}`} />
            {สร้างอยู่ ? 'กำลังสร้าง…' : 'สร้างลิงก์'}
          </button>
        </div>

        {ผิดพลาดลิงก์ && <p className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-600">{ผิดพลาดลิงก์}</p>}

        {ใบ && (
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 space-y-2.5">
            <p className="break-all text-[12px] font-mono text-gray-700 leading-relaxed">{ใบ.ลิงก์}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { navigator.clipboard?.writeText(ใบ.ลิงก์).then(() => setคัดลอกแล้ว(true)).catch(() => setคัดลอกแล้ว(false)) }}
                className="rounded-lg bg-gray-900 px-3.5 py-1.5 text-[12px] font-bold text-white transition-all hover:bg-gray-800 active:scale-[0.98]">
                {คัดลอกแล้ว ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
              </button>
              <a href={ใบ.ลิงก์} target="_blank" rel="noopener noreferrer"
                className="rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-bold text-gray-900 transition-all hover:bg-gray-50">
                เปิดในแท็บใหม่
              </a>
              {typeof ใบ.หมดอายุนาที === 'number' && (
                <span className="text-[12px] text-gray-500">หมดอายุใน <span className="font-bold tabular-nums text-gray-700">{ใบ.หมดอายุนาที}</span> นาที</span>
              )}
            </div>
            {ใบ.บอก && <p className="text-[12.5px] text-gray-500">{ใบ.บอก}</p>}
            <p className="text-[11.5px] text-gray-400">กดอนุญาตเสร็จแล้วกลับมากด “ตรวจสถานะ” เพื่อยืนยันว่าเซิร์ฟเวอร์เก็บกุญแจจริง</p>
          </div>
        )}
      </div>

      {/* ───────── ส่งคลิป + รายการที่ส่งไปแล้ว ─────────
          ใบสั่ง CEO 24 ต.ค. 2569 11:4x — มีไว้ให้อัดคลิปสาธิตโชว์ขอบเขต
          `video.upload` / `video.publish` ตอนยื่นรีวิวกับ TikTok
          ⚠️ ทั้งสองปุ่มกดเอง **ไม่มีการโหลดอัตโนมัติ** ตามกฎเจ้าของร้าน */}
      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] p-4 md:p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-bold text-gray-900">ส่งคลิปขึ้น TikTok</span>
            {/* 🔑 ไม่พิมพ์ "ทุก 2 ชั่วโมง" และ "เพดาน 5 ใบ" ไว้ที่นี่ — สองค่านั้นอยู่ที่ตัวตั้งเวลา
                กับ `อัปสูงสุดต่อรอบ` ใน ลงtiktok.py บน g1 ⇒ ใครแก้ที่นั่น ข้อความนี้จะโกหกทันที
                เพดานจึงมาจากก้อนที่ g1 ดันขึ้น (โชว์ด้านล่างเมื่อมีข้อมูล) */}
            <span className="block text-[12.5px] text-gray-500 mt-0.5">
              ท่อวิ่งเองเป็นรอบตามเวลาอยู่แล้ว · ปุ่มนี้คือ “ขอให้ยิงรอบพิเศษเดี๋ยวนี้”
            </span>
          </span>
          <button onClick={ขอส่งรอบนี้} disabled={ส่งอยู่}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-[12.5px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] transition-all hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50 shrink-0">
            <I d="M5 12h14M13 6l6 6-6 6" className={`w-4 h-4 ${ส่งอยู่ ? 'animate-pulse' : ''}`} />
            {ส่งอยู่ ? 'กำลังฝากคำขอ…' : 'ส่งคลิปขึ้น TikTok ตอนนี้'}
          </button>
          <button onClick={โหลดรายการ} disabled={โหลดอยู่}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-[12.5px] font-bold text-gray-900 transition-all hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50 shrink-0">
            <I d="M20 11a8 8 0 10.9 4.5M20 4v6h-6" className={`w-4 h-4 ${โหลดอยู่ ? 'animate-spin' : ''}`} />
            {โหลดอยู่ ? 'กำลังโหลด…' : 'โหลดรายการ'}
          </button>
        </div>

        {/* 🔴 ปุ่มไม่ได้ส่งคลิปเอง — เขียนไว้บนจอ ไม่ใช่แค่ในโค้ด (กฎ warning-placement) */}
        <p className="rounded-xl border border-gray-100 bg-gray-50/70 px-3.5 py-2.5 text-[12px] text-gray-500">
          ปุ่มนี้ <span className="font-bold text-gray-700">ฝากคำขอไว้ที่เซิร์ฟเวอร์</span> ตัวที่ส่งคลิปจริงคือท่อบนเครื่อง g1
          ซึ่งมาอ่านคำขอทุกนาที · กดแล้วรออึดใจแล้วกด “โหลดรายการ” ดูผล
        </p>

        {ผลขอรอบ && <p className="rounded-xl border border-gray-100 bg-white px-3.5 py-2.5 text-[12.5px] text-gray-700">{ผลขอรอบ}</p>}

        {กล่อง.แบบ === 'ยังไม่ได้โหลด' && (
          <p className="text-[12.5px] text-gray-400">ยังไม่ได้โหลดรายการ — กด “โหลดรายการ”</p>
        )}

        {/* 🔴 อ่านไม่ได้ ต้องเขียนว่าอ่านไม่ได้ **ห้ามโชว์ตารางว่าง** (จะอ่านเป็น “ยังไม่เคยส่ง”) */}
        {กล่อง.แบบ === 'อ่านไม่ได้' && (
          <p className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-600">
            อ่านรายการไม่ได้ — {กล่อง.เหตุ}
            <span className="block mt-1 text-red-500/80">นี่ไม่ได้แปลว่ายังไม่เคยส่งคลิป แปลว่าเราอ่านไม่ได้รอบนี้</span>
          </p>
        )}

        {กล่อง.แบบ === 'ยังไม่เคยดัน' && (
          <p className="rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-2.5 text-[12.5px] text-amber-900">
            {กล่อง.เหตุ || 'g1 ยังไม่เคยดันผลขึ้นมาเลย'}
            <span className="block mt-1 text-amber-900/80">
              ⇒ ยัง<span className="font-bold">ไม่ทราบ</span>ว่าเคยส่งคลิปไปกี่ใบ (คนละเรื่องกับ “ส่งไปแล้วศูนย์ใบ”)
              · ตัวดันบน g1 คือ <span className="font-mono text-[11.5px]">tiktok-pipe-bridge.timer</span>
            </span>
            {กล่อง.ขอรอบค้าง && <span className="block mt-1">มีคำขอรอบพิเศษค้างตั้งแต่ {เวลาไทย(กล่อง.ขอรอบค้าง)}</span>}
          </p>
        )}

        {กล่อง.แบบ === 'มีข้อมูล' && (() => {
          const เงียบ = เงียบไปนาที(กล่อง.ดันเมื่อ, กล่อง.เวลาเซิร์ฟเวอร์)
          return (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
                <span>ส่งไปแล้ว <span className="font-bold tabular-nums text-gray-800">{กล่อง.รายการ.length}</span> ใบ</span>
                {กล่อง.บัญชี && <span>· บัญชีปลายทาง <span className="font-mono text-[11.5px] text-gray-700">@{กล่อง.บัญชี}</span></span>}
                {กล่อง.โหมด && <span>· โหมดท่อ <span className="font-bold text-gray-700">{กล่อง.โหมด}</span></span>}
                {typeof กล่อง.เพดานต่อรอบ === 'number' && (
                  <span>· เพดาน <span className="font-bold tabular-nums text-gray-800">{กล่อง.เพดานต่อรอบ}</span> ใบ/รอบ <span className="text-gray-400">(ค่าจากท่อ)</span></span>
                )}
                {กล่อง.ดันเมื่อ && <span>· g1 รายงานล่าสุด {เวลาไทย(กล่อง.ดันเมื่อ)}</span>}
              </div>

              {/* ⏱️ เงียบนานต้องฟ้อง — ไม่งั้น "ตัวดันตาย" กับ "ไม่มีอะไรเปลี่ยน" หน้าตาเหมือนกันเป๊ะ
                  (ตัวดันตั้งใจส่งซ้ำทุก ≤5 นาทีแม้เนื้อไม่เปลี่ยน เพื่อให้ช่องนี้ใช้ตัดสินได้) */}
              {typeof เงียบ === 'number' && เงียบ > 10 && (
                <p className="rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-2.5 text-[12.5px] text-amber-900">
                  ⚠️ g1 ไม่ได้รายงานมา <span className="font-bold tabular-nums">{เงียบ}</span> นาที
                  (ตัวดันตั้งใจรายงานเป็นระยะแม้เนื้อไม่เปลี่ยน) ⇒ <span className="font-bold">ตัวเลขในตารางอาจเก่า</span> ·
                  ตรวจที่เครื่อง: <span className="font-mono text-[11.5px]">systemctl --user status tiktok-pipe-bridge.timer</span>
                </p>
              )}

              {กล่อง.ขอรอบค้าง && (
                <p className="rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-2.5 text-[12.5px] text-blue-900">
                  มีคำขอรอบพิเศษค้างตั้งแต่ {เวลาไทย(กล่อง.ขอรอบค้าง)} — g1 ยังไม่ได้มาหยิบไปทำ
                </p>
              )}

              {กล่อง.รอบล่าสุด && (
                <p className="rounded-xl border border-gray-100 bg-gray-50/70 px-3.5 py-2.5 text-[11.5px] font-mono text-gray-600 break-words">
                  รอบพิเศษล่าสุด: {กล่อง.รอบล่าสุด}
                </p>
              )}

              {กล่อง.รายการ.length === 0 ? (
                <p className="text-[12.5px] text-gray-500">
                  g1 รายงานมาแล้วว่า <span className="font-bold">ยังไม่เคยส่งคลิปขึ้น TikTok สักใบ</span>
                </p>
              ) : (
                <div className="overflow-x-auto -mx-4 md:-mx-5 px-4 md:px-5">
                  <table className="w-full min-w-[560px] text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[11.5px] uppercase tracking-wider text-gray-400">
                        <th className="pb-2 font-semibold">คลิป</th>
                        <th className="pb-2 font-semibold">ทาง</th>
                        <th className="pb-2 font-semibold">สถานะที่ TikTok คืนมา</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {กล่อง.รายการ.map((v) => {
                        const ลิงก์ = ลิงก์เพจ(v.ลิงก์fb)
                        /* 🔑 ตัวตัดสินว่าจะโชว์อะไรคือ **`สถานะล่าสุด` มีค่าไหม**
                           null = ถามสดไม่ได้ ⇒ บอกตรง ๆ แล้วโชว์ค่าที่จดไว้พร้อมป้ายว่า “อาจเก่า”
                           🚫 ห้ามเอาค่าที่จดไว้มาโชว์ในช่องเดียวกับของสด */
                        const สด = v.สถานะล่าสุด
                        return (
                          <tr key={v.publish_id} className="align-top">
                            <td className="py-2.5 pr-3">
                              <span className="block font-semibold text-gray-900">{v.ชื่อ || '(ไม่มีชื่อ)'}</span>
                              {ลิงก์ && (
                                <a href={ลิงก์} target="_blank" rel="noopener noreferrer"
                                  className="text-[11.5px] text-gray-400 underline decoration-gray-200 hover:text-gray-600">
                                  ต้นฉบับบนเพจ
                                </a>
                              )}
                            </td>
                            <td className="py-2.5 pr-3 text-gray-600 whitespace-nowrap">{v.ทาง || '—'}</td>
                            <td className="py-2.5">
                              {สด ? (
                                <>
                                  {/* ค่าดิบมาก่อนคำอธิบายเสมอ */}
                                  <span className="font-mono text-[11.5px] font-bold text-gray-900">{สด}</span>
                                  {คำอธิบายรหัส[สด] && (
                                    <span className="block text-[11.5px] text-gray-500 mt-0.5">{คำอธิบายรหัส[สด]}</span>
                                  )}
                                  {v.ถามเมื่อ && <span className="block text-[11px] text-gray-400 mt-0.5">ถามสดเมื่อ {เวลาไทย(v.ถามเมื่อ)}</span>}
                                  {v.ขึ้นบัญชีแล้ว && (
                                    <span className="block text-[11.5px] text-emerald-600 mt-0.5">ขึ้นบัญชีแล้ว · {v.ขึ้นบัญชีแล้ว}</span>
                                  )}
                                  {/* ค่าที่จดไว้ตอนส่งต่างจากของสด = หลักฐานว่าสองช่องนี้ยุบรวมกันไม่ได้ */}
                                  {v.สถานะตอนส่ง && v.สถานะตอนส่ง !== สด && (
                                    <span className="block text-[11px] text-gray-400 mt-0.5">
                                      (ตอนส่งท่อจดไว้ว่า <span className="font-mono">{v.สถานะตอนส่ง}</span>)
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="font-bold text-amber-700">ถามสถานะสดไม่ได้</span>
                                  {v.เหตุถามไม่ได้ && <span className="block text-[11.5px] text-amber-700/90 mt-0.5">{v.เหตุถามไม่ได้}</span>}
                                  <span className="block text-[11.5px] text-gray-500 mt-0.5">
                                    ค่าที่จดไว้ตอนส่ง <span className="font-mono text-gray-700">{v.สถานะตอนส่ง || '—'}</span>
                                    <span className="text-gray-400"> · อาจเก่าแล้ว</span>
                                  </span>
                                </>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 🔴 ข้อที่ต้องเขียนไว้ตลอด จนกว่า TikTok จะอนุมัติ audit
                  ยิงพิสูจน์ 5 ครั้ง 24 ต.ค. 2569 ทั้ง PUBLIC_TO_EVERYONE และ SELF_ONLY */}
              <p className="rounded-xl border border-amber-100 bg-amber-50/70 px-3.5 py-2.5 text-[12px] text-amber-900">
                <span className="font-bold">ทำไมคลิปไปอยู่ “กล่องร่าง” ไม่ขึ้นโปรไฟล์เอง</span> — TikTok ปฏิเสธการโพสต์ตรงด้วย
                <span className="font-mono text-[11px]"> unaudited_client_can_only_post_to_private_accounts</span> ·
                ต้องผ่าน audit ก่อนจึงจะโพสต์อัตโนมัติได้ ⇒ ตอนนี้ต้องเปิดแอป TikTok กดโพสต์จากกล่องร่างเอง
              </p>
            </div>
          )
        })()}
      </div>

      {/* 🔴 ข้อที่ต้องให้ท่อ (gucut-web) แก้ — เขียนไว้ให้คนอ่านโค้ดเห็น ไม่ใช่ขึ้นบนจอลูกค้า
          `GET /api/oauth/tiktok-video?token=1` คืน `access_token` + `open_id` กลับมาด้วย
          ⇒ แม้หน้านี้จะอ่านแต่รหัส HTTP และไม่เก็บ/ไม่แสดงกุญแจเลย
             **ตัวกุญแจก็ยังเดินทางมาถึงเบราว์เซอร์ของคนที่เปิดจอ** (เห็นได้ใน DevTools)
             ซึ่งขัดเจตนาของท่อกลางที่เขียนไว้เองว่า "รหัสไม่เคยหลุดถึงเบราว์เซอร์"
          ✅ ทางแก้ที่ควรทำ: เพิ่มพารามิเตอร์ฝั่งท่อที่ตอบแค่ `{ok, เชื่อมแล้ว, หมดอายุ}` **ไม่คืนกุญแจ**
             แล้วหน้านี้เปลี่ยนไปเรียกตัวนั้น (แก้ที่นี่บรรทัดเดียว)
          ⚠️ ยังไม่ทำในรอบนี้เพราะใบสั่งระบุว่า "เส้น API ที่มีอยู่แล้ว ห้ามเขียนใหม่" ⇒ ขึ้นเป็นข้อเสนอ */}
      <p className="text-center text-[11.5px] text-gray-300">ปลายทางของท่อกระจายคลิป · ตัวท่อจริงอยู่บน g1 ไม่ได้อยู่ในหน้านี้</p>
    </div>
  )
}
