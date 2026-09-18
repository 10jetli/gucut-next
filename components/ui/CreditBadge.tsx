'use client'
/* ป้ายเครดิต Netlify — ชิ้นเดียวใช้ทั้ง Sidebar (เดสก์ท็อป) และ MobileHeader (มือถือ)
 *
 * 📍 **รวมมาจากสองไฟล์ 18 ก.ย. 2569** — เดิมโค้ดชุดเดียวกันถูกคัดลอกไว้ทั้งใน
 *    components/layout/Sidebar.tsx และ components/layout/MobileNav.tsx
 *    ⇒ เกณฑ์เตือนก็ถูกคัดลอกไปด้วย (`left < 1000` ทั้งคู่) ⇒ แก้ที่เดียวอีกที่ยังผิด
 *    (กติกาข้อ 5 ของ CLAUDE.md: pattern เดิมเป็นครั้งที่สอง ⇒ แยกเป็น component)
 *
 * 🔴 **สิ่งที่เปลี่ยนไปจากของเดิม ไม่ใช่แค่ย้ายที่:**
 *  · เกณฑ์เดิมเป็น **เลขตายตัว 1,000** ⇒ ถ้าเปลี่ยนแพ็กเกจ เกณฑ์จะผิดทันทีโดยไม่มีอะไรฟ้อง
 *    ของใหม่คิดเป็น **สัดส่วนของเพดานที่ท่อส่งมา** (lib/usage-alert.ts)
 *  · ของเดิม **ไม่สนใจธง `stale`** ที่ท่อส่งมา ⇒ ค่าที่อ่านค้างไว้เมื่อวาน หน้าตาเหมือนค่าสดเป๊ะ
 *  · ของเดิมเขียน title ว่า "จาก 5,000/เดือน" **ฝังเลขไว้ในจอ** ทั้งที่ท่อส่ง `plan` มาให้แล้ว
 *
 * ⚠️ สามสถานะห้ามยุบเหลือสอง: ยังโหลด / อ่านได้ / อ่านไม่ได้
 *    และ **อ่านไม่ได้ต้องขึ้น ⚡? ไม่ใช่หายไป** — มาตรวัดที่หายตอนตัวเองพัง
 *    หน้าตาเหมือน "ทุกอย่างปกติ" เป๊ะ (บทเรียน 13 ก.ย. 2569)
 */
import { useEffect, useState } from 'react'
import { creditAlert, type ผลเตือนเครดิต, type ข้อมูลเครดิต } from '@/lib/usage-alert'

type สถานะ = { state: 'loading' } | { state: 'error' } | { state: 'ok'; a: ผลเตือนเครดิต }

export function useCredits(): สถานะ {
  const [s, setS] = useState<สถานะ>({ state: 'loading' })
  useEffect(() => {
    let alive = true
    fetch('/api/netlify-credits')
      .then((r) => r.json())
      .then((j: ข้อมูลเครดิต) => {
        if (!alive) return
        /* ⚠️ "ตอบมาแต่ไม่มีช่อง left" นับเป็นอ่านไม่ได้ — มีก้อนแม่ ไม่ได้แปลว่ามีช่องลูก
           🔑 แต่ถ้าท่อ**บอกเหตุผลมาเอง** (`off` = ยังไม่ได้ตั้งคีย์ · `unknown` = อ่านไม่ได้รอบนี้)
              ต้องส่งต่อให้ creditAlert เป็นคนเขียนข้อความ **ไม่ใช่กลืนเป็น error ก้อนเดียว**
              ไม่งั้นข้อความ "ยังไม่ได้ตั้งคีย์ — จอนี้ยังไม่ได้เฝ้าอะไรเลย" จะไม่มีวันขึ้นจอ
              (เจอตอนทบทวนของตัวเองก่อน deploy 18 ก.ย. 2569 — คลาสเดียวกับตารางที่ไม่มีวันแสดง) */
        if (j?.off || j?.unknown) { setS({ state: 'ok', a: creditAlert(j) }); return }
        if (typeof j?.left !== 'number' && typeof j?.used !== 'number') { setS({ state: 'error' }); return }
        setS({ state: 'ok', a: creditAlert(j) })
      })
      .catch(() => { if (alive) setS({ state: 'error' }) })
    return () => { alive = false }
  }, [])
  return s
}

/** สีของป้ายตามระดับ — `dark` = พื้นหลังเข้ม (Sidebar) · ปกติ = พื้นขาว (หัวจอมือถือ) */
function สีของ(level: ผลเตือนเครดิต['level'], dark: boolean): string {
  if (dark) {
    return level === 'over' ? 'bg-red-500/30 text-red-100'
      : level === 'warn' ? 'bg-orange-400/30 text-orange-100'
      : level === 'watch' ? 'bg-orange-400/20 text-orange-200'
      : level === 'unknown' ? 'bg-white/5 text-white/40'
      : 'bg-white/10 text-white/70'
  }
  return level === 'over' ? 'bg-red-100 text-red-700'
    : level === 'warn' ? 'bg-orange-100 text-orange-700'
    : level === 'watch' ? 'bg-orange-50 text-orange-600'
    : level === 'unknown' ? 'bg-gray-100 text-gray-400'
    : 'bg-gray-100 text-gray-500'
}

export default function CreditBadge({ dark = false }: { dark?: boolean }) {
  const s = useCredits()
  if (s.state === 'loading') return null
  if (s.state === 'error') {
    return (
      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${สีของ('unknown', dark)}`}
        title="อ่านเครดิต Netlify ไม่ได้รอบนี้ — ไม่ได้แปลว่าเครดิตหมด แปลว่ายังไม่รู้">
        ⚡?
      </span>
    )
  }
  const { a } = s
  /* ตัวเลขบนป้ายคือ "เหลือเท่าไหร่" เหมือนเดิม — คนในร้านคุ้นกับเลขนี้แล้ว ไม่เปลี่ยนความหมาย
     แต่คำอธิบายเต็มย้ายมาอยู่ใน title และ **ข้อความบอกว่าต้องทำอะไรต่อ** มาจาก lib ที่มีเทสคุม */
  const เลข = a.left === null ? '?' : a.left.toLocaleString('th-TH')
  /* 🔴 **ดอกจันต้องอยู่ข้างตัวเลข ไม่ใช่ใน tooltip เท่านั้น** — คำเตือนที่ต้องเอาเมาส์ไปชี้ถึงจะเห็น
     เท่ากับไม่มีสำหรับคนที่กำลังอ่านตัวเลข (บทเรียนเดียวกับเครื่องหมายบนหัวคอลัมน์ 18 ก.ย. 2569)
     ⚠️ เรื่องจริงที่ทำให้ต้องมีดอกจัน: ท่อตั้ง default เพดานไว้ 5,000 แต่ของจริงแพ็กเกจ Pro = **15,000**
        (อ่านจากหน้า Billing ของ Netlify เอง 18 ก.ย. 2569) ⇒ ถ้า Netlify ไม่ส่ง `plan_credits` มา
        เปอร์เซ็นต์จะเพี้ยนไป 3 เท่า และตัวเตือนจะร้องเร็วเกินจริงโดยไม่มีอะไรฟ้อง */
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${สีของ(a.level, dark)}`}
      /* ⚠️ ต่อท้ายเรื่องเพดาน **เฉพาะตอนที่เพดานถูกเอาไปใช้คิดจริง** (มี pct)
         ตอนอ่านไม่ได้/ยังไม่ตั้งคีย์ เพดานไม่เกี่ยวเลย — เติมไปก็เป็นคำเตือนที่ไม่ได้เตือนอะไร */
      title={`${a.ข้อความ}${a.pct !== null && !a.planConfirmed ? ' · เพดานยังไม่ได้ยืนยันจาก Netlify (ท่อใช้ค่าตั้งต้น)' : ''}`}
    >
      {a.stale ? '⚡~' : '⚡'}{เลข}{a.pct !== null && !a.planConfirmed ? '*' : ''}
    </span>
  )
}
