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
import { เงียบเกิน, type ก้อนสถานะ } from '@/lib/flow-status'

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
  /* 📥 ขาชีท → เป้า: ผลรอบล่าสุดของตัวดึงชีทอัตโนมัติ (lib/registry-sheet.ts · 22 ต.ค. 2569) */
  const [ดึงชีท, setดึงชีท] = useState<{ log?: { เมื่อ: string; สถานะ: string; เหตุ?: string; ชีทแก้ไขล่าสุด?: string }[] } | null | 'err'>(null)
  const [วัดสมุดเมื่อ, setวัดสมุดเมื่อ] = useState<number>()
  useEffect(() => {
    fetch('/api/web/core?stockpushlog=1').then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((j) => { setLog(Array.isArray(j?.log) ? j.log : 'err'); setวัดสมุดเมื่อ(Date.now()) })
      .catch(() => setLog('err'))
    fetch('/api/registry-sheet').then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((j) => setดึงชีท(j?.ok ? j : 'err')).catch(() => setดึงชีท('err'))
    /* 🧭 สถานะรายขาที่ตัวงานบน g1 รายงานเอง (ใบสั่ง 13:30 — ไม่มีคำว่า "ตรวจด้วยมือ") */
    fetch('/api/flow-status').then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((j) => setรายขา(j?.ok ? (j.ก้อน ?? null) : 'err')).catch(() => setรายขา('err'))
  }, [])
  const [รายขา, setรายขา] = useState<ก้อนสถานะ | null | 'err'>(null)

  /** ขาที่ g1 รายงานเองลงไฟล์สถานะ — เงียบเกิน 2 เท่าของรอบตัวเอง ⇒ 🔴 (ตัดสินที่จอ จากเวลาที่ตัวงานจด) */
  const ขาจากไฟล์ = (คีย์: string, ชื่อ: string, ตอนไม่มี: ขา): ขา => {
    const r = รายขา && รายขา !== 'err' ? รายขา.ขา[คีย์] : undefined
    if (!r) return ตอนไม่มี
    const ms = Date.parse(r.เมื่อ)
    if (เงียบเกิน(r, Date.now())) return { ชื่อ, สถานะ: 'bad', เทียบ: 'เทียบแล้ว', เมื่อ: ms,
      รายละเอียด: `เงียบเกิน ${2 * r.รอบนาที} นาที (รอบปกติ ${r.รอบนาที} นาที) — ตัวงานบน g1 อาจตาย · รายงานล่าสุด: ${r.รายละเอียด}` }
    return { ชื่อ, สถานะ: r.ผล === 'ok' ? 'ok' : r.ผล === 'warn' ? 'warn' : 'bad', เทียบ: 'เทียบแล้ว', เมื่อ: ms, รายละเอียด: r.รายละเอียด }
  }

  const ขาชีท = (): ขา => {
    const ชื่อ = 'ชีททะเบียนของท่าน → สคริปต์ส่งเอง (Apps Script ทุก 15 นาที)'
    if (ดึงชีท === null) return { ชื่อ, สถานะ: 'unknown', เทียบ: 'ยังไม่เคยเทียบ', รายละเอียด: 'กำลังอ่านสถานะตัวดึง…' }
    if (ดึงชีท === 'err') return { ชื่อ, สถานะ: 'unknown', เทียบ: 'วัดจากหน้านี้ไม่ได้', รายละเอียด: 'อ่านสถานะตัวดึงไม่ได้ (/api/registry-sheet)' }
    const ร = ดึงชีท.log?.[0]
    if (!ร) return { ชื่อ, สถานะ: 'unknown', เทียบ: 'ยังไม่เคยเทียบ', รายละเอียด: 'สคริปต์ยังไม่เคยส่งมาสักรอบ — รอติดตั้ง Apps Script ในบัญชีท่าน (ครั้งเดียว)' }
    const ms = Date.parse(ร.เมื่อ)
    const แก้ = ร.ชีทแก้ไขล่าสุด ? ` · ชีทแก้ไขล่าสุด ${เวลาไทย(Date.parse(ร.ชีทแก้ไขล่าสุด))}` : ''
    const สถานะ: สถานะ = ร.สถานะ === 'พร้อม' ? 'ok' : ร.สถานะ === 'สำรวจ' ? 'warn' : 'bad'
    const คำ: Record<string, string> = {
      'พร้อม': 'สคริปต์ส่งถึง ผ่านตาข่ายครบ — เป้าใหม่พร้อมให้ตัวซิงก์ใช้',
      'สำรวจ': 'สคริปต์ส่งถึงแล้ว แต่ยังไม่ผลิตเป้า — รอยืนยันกติกานับให้ตรงกับเลขที่ CEO นับมือ',
      'อ่านไม่ได้': 'ไม่ได้ของจากสคริปต์ — ไม่แทนเป้าเดิม',
      'หยุด-ลดฮวบ': 'ยอดลดผิดปกติ — หยุดไว้ไม่แทนเป้าเดิม รอคนยืนยัน',
      'หยุด-หัวเปลี่ยน': 'หัวคอลัมน์ในชีทเปลี่ยน — หยุดไว้กันนับผิดช่อง',
    }
    return { ชื่อ, สถานะ, เทียบ: ร.สถานะ === 'พร้อม' ? 'เทียบแล้ว' : 'ยังไม่เคยเทียบ', เมื่อ: Number.isFinite(ms) ? ms : undefined,
      รายละเอียด: `${คำ[ร.สถานะ] ?? ร.สถานะ}${ร.เหตุ ? ` · ${ร.เหตุ}` : ''}${แก้}` }
  }

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
    ขาชีท(),
    { ชื่อ: 'ชีททะเบียนของท่าน → ทะเบียน D1', สถานะ: 'unknown', เทียบ: 'ยังไม่เคยเทียบ',
      รายละเอียด: 'ยังไม่เคยเทียบกับชีทจริง — g1 อ่านชีทตรงไม่ได้ ทางเดียวคือ connector ของ CEO · D1 นำเข้าจากชีทภาพเมื่อ 25 ก.ย.' },
    typeof ไม่ตรง === 'number' && typeof ยังไม่จับคู่ === 'number'
      ? { ชื่อ: 'ทะเบียน D1 ↔ ตารางในโค้ด', สถานะ: ไม่ตรง === 0 && ยังไม่จับคู่ === 0 ? 'ok' : 'bad', เทียบ: 'เทียบแล้ว', เมื่อ: วัดทะเบียนเมื่อ,
          รายละเอียด: `ไม่ตรง ${ไม่ตรง} · ยังไม่จับคู่ ${ยังไม่จับคู่} — ⚠️ สองขานี้สร้างจากชีทภาพเดียวกัน ตรงกันไม่ได้แปลว่าตรงกับชีทจริง` }
      : { ชื่อ: 'ทะเบียน D1 ↔ ตารางในโค้ด', สถานะ: 'unknown', เทียบ: 'วัดจากหน้านี้ไม่ได้', รายละเอียด: 'อ่านสรุปทะเบียนไม่ได้รอบนี้' },
    ขาจากไฟล์('ทะเบียน-ZORT', 'ทะเบียน → ZORT (ตัวซิงก์บน g1 · รายงานตัวเองทุก 5 นาที)',
      { ชื่อ: 'ทะเบียน → ZORT (ตัวซิงก์บน g1)', สถานะ: 'unknown', เทียบ: 'วัดจากหน้านี้ไม่ได้',
        รายละเอียด: 'ยังไม่ได้รับรายงานจากตัวซิงก์เลย — ตัวส่งสถานะบน g1 (flow-status-upload ทุก 5 นาที) อาจยังไม่เคยส่งถึง หรือเส้นเพิ่งขึ้น · ⚠️ ทะเบียน = เอกสารที่ถือ ไม่ใช่ของบนชั้น — ดันตามชีทอาจขายซ้ำ (ท่านกำลังตัดสิน)' }),
    ขาจากไฟล์('ดึงเป้าทะเบียน', 'เป้าจากเว็บ → เป้าสต็อกทะเบียน.json บน g1 (ทุก 15 นาที)',
      { ชื่อ: 'เป้าจากเว็บ → เป้าสต็อกทะเบียน.json บน g1', สถานะ: 'unknown', เทียบ: 'วัดจากหน้านี้ไม่ได้', รายละเอียด: 'ยังไม่ได้รับรายงานจากตัวดึงบน g1 เลย' }),
ขาแพลตฟอร์ม('shopee'), ขาแพลตฟอร์ม('tiktok'), ขาแพลตฟอร์ม('lazada'),
    ขาจากไฟล์('หน้าร้าน', 'ทะเบียน → หน้าร้าน gucut.com (ตัววัดบน g1 ทุก 60 นาที)',
      { ชื่อ: 'ทะเบียน → หน้าร้าน gucut.com', สถานะ: 'unknown', เทียบ: 'วัดจากหน้านี้ไม่ได้', รายละเอียด: 'ยังไม่ได้รับรายงานจากตัววัดบน g1 เลย (flow_leg_storefront ทุก 60 นาที)' }),
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
