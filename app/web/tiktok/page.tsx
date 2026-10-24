'use client'
// เชื่อมบัญชี TikTok — ปลายทางของท่อกระจายคลิป (facebook.com/AJt8888 → tiktok.com/@ajtcut_8)
// ท่อ: /api/web/oauth/tiktok-video  ·  ตัวท่อที่ใช้กุญแจนี้จริงคือ ~/repost-fb-yt/ลงtiktok.py
//
// ⚠️ กติกาเจ้าของร้าน: ตรวจเมื่อกดเอง **ห้ามตรวจอัตโนมัติ** (เหมือนหน้าสถานะระบบ)
//    ⇒ ไม่มี useEffect ที่ยิงเส้นใด ๆ ตอนเปิดหน้า · ทุกการยิงมาจากการกดปุ่ม
import { useState } from 'react'

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

export default function WebTiktokPage() {
  const [สถานะ, setสถานะ] = useState<สถานะ>({ แบบ: 'ยังไม่รู้' })
  const [ตรวจอยู่, setตรวจอยู่] = useState(false)
  const [ใบ, setใบ] = useState<ใบลิงก์ | null>(null)
  const [สร้างอยู่, setสร้างอยู่] = useState(false)
  const [ผิดพลาดลิงก์, setผิดพลาดลิงก์] = useState('')
  const [คัดลอกแล้ว, setคัดลอกแล้ว] = useState(false)
  const [ตรวจเมื่อ, setตรวจเมื่อ] = useState('')

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
        <p className="text-[12.5px] text-amber-900/90">
          <span className="font-bold">② เจอ HTTP 431 ให้เปิดหน้าต่างไม่ระบุตัวตน</span> — คุกกี้ของ tiktok.com
          บวมเกินที่ TikTok รับ (วัดจริง 24 ต.ค. 2569: เฉพาะคุกกี้ที่มองเห็นได้ <span className="tabular-nums">5,159</span> ไบต์ <span className="tabular-nums">57</span> ตัว)
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
