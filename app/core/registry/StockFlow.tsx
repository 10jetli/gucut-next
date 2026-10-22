'use client'
/* 🧭 ผังการอัปเดตสต็อกบาร์/เลื่อยทะเบียน — ท่านประธานสั่ง 22 ต.ค. 2569 ("ทำผัง" · Discord)
 * เหตุ: บาร์ทะเบียนมีของแต่ Shopee ขึ้นเทา และไม่มีใครเห็นว่าตัวเลขหายตรงขาไหน
 * 🔴 กติกาของผังนี้ (ใบสั่ง-ผังอัปเดตสต็อก.md):
 *    · ทุกขาบอกสถานะจริง ✅ ไหล · ⚠️ ช้า/ค้าง/รอคน · 🔴 ขาด · ⚪ วัดไม่ได้ — วัดไม่ได้ห้ามแสดงว่าปกติ
 *    · ขาที่วัดสดได้ต้องมีเวลาวัด (เก่าเกิน 1 ชม. หรี่) · ขาที่วัดจากหน้านี้ไม่ได้ เขียนตรง ๆ ว่าวัดไม่ได้
 *    · ห้ามมีตัวเลขสมมติ — ตัวเลขทุกตัวมาจากเส้นที่ยิงตอนเปิดหน้า
 *    · แยก "เทียบแล้วจริง" ออกจาก "ยังไม่เคยเทียบ" ให้เห็น
 * ขาที่วัดสด: D1 ↔ ตารางในโค้ด (จาก ?registry=1 ที่หน้าใช้อยู่) · ZORT → แพลตฟอร์ม (จาก ?stockpushlog=1)
 * ขาที่หน้านี้วัดไม่ได้: ชีทของท่าน (g1 อ่านตรงไม่ได้ · ทางเดียวคือ connector ของ CEO) · ตัวซิงก์ทะเบียน→ZORT (รันบน g1) · หน้าร้าน gucut.com */
import { useEffect, useState } from 'react'

type สถานะ = 'ok' | 'warn' | 'bad' | 'unknown'
const ป้าย: Record<สถานะ, { icon: string; cls: string; คำ: string }> = {
  ok: { icon: '✅', cls: 'border-emerald-300 bg-emerald-50', คำ: 'ไหลปกติ' },
  warn: { icon: '⚠️', cls: 'border-amber-300 bg-amber-50', คำ: 'ช้า/ค้าง/รอคน' },
  bad: { icon: '🔴', cls: 'border-red-300 bg-red-50', คำ: 'ขาด' },
  unknown: { icon: '⚪', cls: 'border-gray-300 bg-gray-50', คำ: 'วัดไม่ได้' },
}

interface ขา { ชื่อ: string; สถานะ: สถานะ; รายละเอียด: string; เทียบ: 'เทียบแล้ว' | 'ยังไม่เคยเทียบ' | 'วัดจากหน้านี้ไม่ได้'; เมื่อ?: number }

interface LogRow { at?: string; platform?: string; pushed?: number; rejected?: number; notSent?: number
  rows?: { sku?: string; result?: string; notSentKind?: string }[] }

const ทะเบียน = (sku?: string) => /^Bar (NW|KK) /.test(String(sku ?? ''))
const เวลาไทย = (ms: number) => new Date(ms).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function StockFlow({ ไม่ตรง, ยังไม่จับคู่, วัดทะเบียนเมื่อ }: {
  /** จาก ?registry=1 — undefined = ยังโหลดไม่ได้ */
  ไม่ตรง?: number; ยังไม่จับคู่?: number; วัดทะเบียนเมื่อ?: number
}) {
  const [log, setLog] = useState<LogRow[] | null | 'err'>(null)
  const [วัดสมุดเมื่อ, setวัดสมุดเมื่อ] = useState<number>()
  useEffect(() => {
    fetch('/api/web/core?stockpushlog=1').then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((j) => { setLog(Array.isArray(j?.log) ? j.log : 'err'); setวัดสมุดเมื่อ(Date.now()) })
      .catch(() => setLog('err'))
  }, [])

  const ขาแพลตฟอร์ม = (ชื่อ: string): ขา => {
    if (log === null) return { ชื่อ: `ZORT → ${ชื่อ}`, สถานะ: 'unknown', รายละเอียด: 'กำลังอ่านสมุดดันสต็อก…', เทียบ: 'เทียบแล้ว' }
    if (log === 'err') return { ชื่อ: `ZORT → ${ชื่อ}`, สถานะ: 'unknown', รายละเอียด: 'อ่านสมุดดันสต็อกไม่ได้ (?stockpushlog=1)', เทียบ: 'วัดจากหน้านี้ไม่ได้' }
    const ของ = log.filter((r) => String(r.platform ?? '').toLowerCase() === ชื่อ.toLowerCase())
    if (ของ.length === 0) return { ชื่อ: `ZORT → ${ชื่อ}`, สถานะ: 'bad', รายละเอียด: `ไม่มีรอบดันของ ${ชื่อ} ในสมุด ${log.length} รอบล่าสุดเลย — ไม่รู้ว่าไม่ได้ตั้งเวลาหรือพังก่อนบันทึก`, เทียบ: 'เทียบแล้ว', เมื่อ: วัดสมุดเมื่อ }
    const ล่าสุด = ของ.reduce((a, b) => (String(a.at) > String(b.at) ? a : b))
    const ms = Date.parse(String(ล่าสุด.at))
    const รอคน = (ล่าสุด.rows ?? []).filter((x) => ทะเบียน(x.sku) && x.result === 'not_sent').length
    const เก่า = Number.isFinite(ms) && Date.now() - ms > 3600e3
    return {
      ชื่อ: `ZORT → ${ชื่อ}`,
      สถานะ: รอคน > 0 || เก่า ? 'warn' : 'ok',
      รายละเอียด: `รอบล่าสุด ${Number.isFinite(ms) ? เวลาไทย(ms) : 'ไม่รู้เวลา'} · ดันสำเร็จ ${ล่าสุด.pushed ?? 'ไม่รู้'} · ไม่ได้ยิง ${ล่าสุด.notSent ?? 'ไม่รู้'}`
        + (รอคน > 0 ? ` · บาร์ทะเบียน ${รอคน} รหัสไม่ได้ยิง (รอคนยืนยัน/ติดด่าน — ดูเหตุรายรหัสในสมุด)` : '')
        + (เก่า ? ' · รอบล่าสุดเก่าเกิน 1 ชม.' : ''),
      เทียบ: 'เทียบแล้ว', เมื่อ: Number.isFinite(ms) ? ms : undefined,
    }
  }

  const ขาทั้งหมด: ขา[] = [
    { ชื่อ: 'ชีททะเบียนของท่าน → ทะเบียน D1', สถานะ: 'unknown', เทียบ: 'ยังไม่เคยเทียบ',
      รายละเอียด: 'ยังไม่เคยเทียบกับชีทจริง — g1 อ่านชีทตรงไม่ได้ ทางเดียวคือ connector ของ CEO · D1 นำเข้าจากชีทภาพเมื่อ 25 ก.ย.' },
    typeof ไม่ตรง === 'number' && typeof ยังไม่จับคู่ === 'number'
      ? { ชื่อ: 'ทะเบียน D1 ↔ ตารางในโค้ด', สถานะ: ไม่ตรง === 0 && ยังไม่จับคู่ === 0 ? 'ok' : 'bad', เทียบ: 'เทียบแล้ว', เมื่อ: วัดทะเบียนเมื่อ,
          รายละเอียด: `ไม่ตรง ${ไม่ตรง} · ยังไม่จับคู่ ${ยังไม่จับคู่} — ⚠️ สองขานี้สร้างจากชีทภาพเดียวกัน ตรงกันไม่ได้แปลว่าตรงกับชีทจริง` }
      : { ชื่อ: 'ทะเบียน D1 ↔ ตารางในโค้ด', สถานะ: 'unknown', เทียบ: 'วัดจากหน้านี้ไม่ได้', รายละเอียด: 'อ่านสรุปทะเบียนไม่ได้รอบนี้' },
    { ชื่อ: 'ทะเบียน → ZORT (ตัวซิงก์บน g1)', สถานะ: 'unknown', เทียบ: 'วัดจากหน้านี้ไม่ได้',
      รายละเอียด: 'ตัวซิงก์รันบนเครื่อง g1 หน้านี้อ่านสถานะไม่ได้ · ตรวจด้วยมือ 22 ต.ค. 09:4x: หยุดยิงตั้งแต่ 19 ต.ค. และก่อนหยุดปฏิเสธเขียนเพราะเป้าจากชีทเก่า (11 ต.ค.)' },
    ขาแพลตฟอร์ม('shopee'), ขาแพลตฟอร์ม('tiktok'), ขาแพลตฟอร์ม('lazada'),
    { ชื่อ: 'ทะเบียน → หน้าร้าน gucut.com', สถานะ: 'unknown', เทียบ: 'ยังไม่เคยเทียบ', รายละเอียด: 'ยังไม่มีตัววัดขานี้' },
  ]

  return (
    <section className="bg-white border border-gray-200 rounded-md p-3 sm:p-4 mt-3" aria-label="ผังการอัปเดตสต็อก">
      <h2 className="text-[15px] font-semibold text-gray-900 m-0">ผังการอัปเดตสต็อก — ตัวเลขเดินผ่านขาไหนบ้าง</h2>
      <p className="text-[12px] text-gray-500 mt-1 mb-3">
        ✅ ไหลปกติ · ⚠️ ช้า/ค้าง/รอคน · 🔴 ขาด · ⚪ วัดไม่ได้ (ไม่ใช่ปกติ) · ป้ายขวา = ขานั้นเทียบกับของจริงแล้วหรือยัง
      </p>
      <ol className="space-y-1.5 m-0 p-0 list-none">
        {ขาทั้งหมด.map((x, i) => {
          const p = ป้าย[x.สถานะ]
          const เก่า = x.เมื่อ !== undefined && Date.now() - x.เมื่อ > 3600e3
          return (
            <li key={x.ชื่อ} className={เก่า ? 'opacity-60' : ''}>
              {i > 0 && <div aria-hidden className="text-center text-gray-300 text-[12px] leading-none -mt-0.5 mb-0.5">↓</div>}
              <div className={`border rounded px-3 py-2 ${p.cls}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="text-[13.5px] font-medium text-gray-900"><span aria-label={p.คำ}>{p.icon}</span> {x.ชื่อ}</span>
                  <span className={`text-[11px] rounded px-1.5 py-0.5 ${x.เทียบ === 'เทียบแล้ว' ? 'bg-white text-gray-700 border border-gray-300' : 'bg-gray-800 text-white'}`}>{x.เทียบ}</span>
                </div>
                <p className="text-[12px] text-gray-700 mt-1 m-0 leading-snug">{x.รายละเอียด}</p>
                {x.เมื่อ !== undefined && <p className="text-[11px] text-gray-500 m-0 mt-0.5">วัดเมื่อ {เวลาไทย(x.เมื่อ)}{เก่า ? ' · เก่าเกิน 1 ชม.' : ''}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
