'use client'

/* หน้า "หัวสมอง Mem0" — ท่านประธานสั่งเอง 9 ต.ค. 2569
 *   "ไปเขียนแผนผังภาพไว้ในนี้ ว่าเชื่อมอะไรบ้าง ให้ดูแล้วเข้าใจง่าย"
 *
 * 🔴 **ข้อที่ท่านย้ำหนักที่สุด: ห้ามวาดผังสวย ๆ แล้วทำเหมือนทุกอย่างทำงานอยู่**
 *    ⇒ ทุกกล่องในผังมีจุดสถานะของตัวเอง และสีมาจากของจริงที่ g1 ประกาศ ไม่ใช่สีที่พิมพ์ค้างไว้
 *    ⇒ อ่านสถานะไม่ได้ ⇒ กล่องเป็นสีเทา + เขียนว่า "ไม่รู้" **ไม่ใช่เขียว**
 *
 * 🔑 กติกาตัดสินสถานะอยู่ที่ `lib/brain-status.ts` **ที่เดียว** — เพจไม่เขียนเงื่อนไขซ้ำ
 *    และเทส `scripts/tests/brain-status.test.mjs` เรียกฟังก์ชันตัวจริงตัวนั้น ไม่ได้ลอกเงื่อนไข
 */

import { useCallback, useEffect, useState } from 'react'
import { fmtNum } from '@/lib/format'
import { ตัดสินสถานะ, นาทีที่ถือว่าขาดการติดต่อ, type ประกาศหัวสมอง } from '@/lib/brain-status'
import LoadingState from '@/components/ui/LoadingState'

type คำตอบ = { ok: boolean; ประกาศ: ประกาศหัวสมอง | null; เหตุ?: string }

const สีของสถานะ = {
  'ปกติ': { ขอบ: 'border-emerald-300', พื้น: 'bg-emerald-50', จุด: 'bg-emerald-500', คำ: 'text-emerald-800' },
  'ติดต่อไม่ได้': { ขอบ: 'border-amber-300', พื้น: 'bg-amber-50', จุด: 'bg-amber-500', คำ: 'text-amber-900' },
  'ยังไม่ได้ติดตั้ง': { ขอบ: 'border-gray-300', พื้น: 'bg-gray-50', จุด: 'bg-gray-400', คำ: 'text-gray-700' },
} as const

export default function หน้าหัวสมอง() {
  const [กำลังโหลด, ตั้งกำลังโหลด] = useState(true)
  const [คำตอบ, ตั้งคำตอบ] = useState<คำตอบ | null>(null)
  const [อ่านเมื่อ, ตั้งอ่านเมื่อ] = useState('')

  const โหลด = useCallback(async () => {
    ตั้งกำลังโหลด(true)
    try {
      const r = await fetch('/api/brain-status', { cache: 'no-store' })
      ตั้งคำตอบ(await r.json())
    } catch (e) {
      ตั้งคำตอบ({ ok: false, ประกาศ: null, เหตุ: String((e as Error)?.message ?? e) })
    } finally {
      ตั้งอ่านเมื่อ(new Date().toLocaleString('th-TH'))
      ตั้งกำลังโหลด(false)
    }
  }, [])

  useEffect(() => { void โหลด() }, [โหลด])

  if (กำลังโหลด && !คำตอบ) return <LoadingState text="กำลังอ่านสถานะหัวสมองจาก g1…" />

  const ประกาศ = คำตอบ?.ประกาศ ?? null
  /* 🔴 ยิงไปอ่านไฟล์ประกาศไม่ได้ (ok:false) **ไม่ใช่** "ยังไม่ได้ติดตั้ง"
     ⇒ บังคับให้เป็น "ติดต่อไม่ได้" ไม่งั้นเน็ตสะดุดจะอ่านว่าระบบไม่เคยมีอยู่ */
  const ผล = คำตอบ && !คำตอบ.ok
    ? { สถานะ: 'ติดต่อไม่ได้' as const, อายุนาที: null,
        เหตุ: คำตอบ.เหตุ ?? 'อ่านไฟล์ประกาศไม่ได้ — ยังบอกไม่ได้ว่าหัวสมองเป็นยังไง' }
    : ตัดสินสถานะ(ประกาศ, Math.floor(Date.now() / 1000))

  const สี = สีของสถานะ[ผล.สถานะ]
  const ฐาน = (ประกาศ?.['ฐานเวกเตอร์'] ?? {}) as Record<string, unknown>
  const การป้อน = (ประกาศ?.['การป้อน'] ?? {}) as Record<string, unknown>
  const สำรอง = (ประกาศ?.['สำรองสิงคโปร์'] ?? {}) as Record<string, unknown>
  const ssd = (ประกาศ?.['ssd'] ?? {}) as Record<string, unknown>
  const รุ่น = (ประกาศ?.['รุ่น'] ?? {}) as Record<string, unknown>
  const ผู้เชื่อม = (ประกาศ?.['ผู้เชื่อม'] ?? {}) as Record<string, boolean | null>
  const ปกติ = ผล.สถานะ === 'ปกติ'
  const ท่อน = ฐาน['ท่อน']
  const เลขท่อน = typeof ท่อน === 'number' ? fmtNum(ท่อน) : '—'

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold">🧠 หัวสมอง Mem0</h1>
        <div className="mt-1 text-sm text-gray-600">
          ที่ค้นความจำก้อนเดียวของทั้งทีม — <b>ไฟล์เป็นตัวจริง Mem0 เป็นแค่ตัวค้น</b>
        </div>
      </div>

      {/* ── แถบสถานะ: สามสถานะ ห้ามยุบรวม ───────────────────────────── */}
      <div className={`rounded border ${สี.ขอบ} ${สี.พื้น} p-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-block h-3 w-3 rounded-full ${สี.จุด}`} />
          <b className={สี.คำ}>{ผล.สถานะ}</b>
          <span className="text-sm text-gray-700">— {ผล.เหตุ}</span>
          <button onClick={() => void โหลด()} className="ml-auto rounded border bg-white px-3 py-1 text-sm">
            อ่านใหม่
          </button>
        </div>
        {ผล.สถานะ === 'ยังไม่ได้ติดตั้ง' && (
          <div className="mt-2 text-sm text-gray-700">
            หน้านี้ยัง<b>ไม่มีตัวเลขจริงให้ดู</b> เพราะยังไม่มีใครตั้งหัวสมองขึ้นมา —
            ผังข้างล่างคือ<b>แบบที่จะสร้าง</b> ไม่ใช่ของที่ทำงานอยู่
          </div>
        )}
        {ผล.สถานะ === 'ติดต่อไม่ได้' && (
          <div className="mt-2 text-sm text-amber-900">
            ⚠️ ตัวเลขข้างล่าง (ถ้ามี) คือ<b>ภาพเก่า</b> ไม่ใช่สถานะตอนนี้ —
            g1 ประกาศสถานะทุก 10 นาที เกิน {นาทีที่ถือว่าขาดการติดต่อ} นาทีถือว่าขาดการติดต่อ
          </div>
        )}
      </div>

      {/* ── ① ผังการเชื่อมต่อ — SVG ไม่ใช่รูปนิ่ง สีตามสถานะจริง ───────── */}
      <div className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">เชื่อมอะไรกับอะไรบ้าง</h2>
        <div className="overflow-x-auto">
          <ผังหัวสมอง ปกติ={ปกติ} เลขท่อน={เลขท่อน} ผู้เชื่อม={ผู้เชื่อม}
            สำรองล่าสุด={(สำรอง['สำรองล่าสุด'] as string) ?? null} />
        </div>
      </div>

      {/* ── ② ตัวเลขจริง ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { ป้าย: 'ความจำในหัวสมอง', ค่า: เลขท่อน, ย่อย: 'ท่อน' },
          {
            ป้าย: 'ไฟล์ต้นทางที่ป้อนแล้ว',
            ค่า: typeof การป้อน['ไฟล์ต้นทาง'] === 'number' ? fmtNum(การป้อน['ไฟล์ต้นทาง'] as number) : '—',
            ย่อย: (การป้อน['ป้อนล่าสุด'] as string) ?? 'ยังไม่เคยป้อน',
          },
          {
            ป้าย: 'สำรองขึ้นสิงคโปร์ล่าสุด',
            ค่า: (สำรอง['สำรองล่าสุด'] as string) ?? '—',
            ย่อย: สำรอง['รอบล่าสุดล้ม'] ? '🔴 รอบล่าสุดล้ม' : ((สำรอง['ขนาดล่าสุด'] as string) ?? 'ยังไม่เคยสำรอง'),
          },
          {
            ป้าย: 'ที่ว่างบน SSD',
            ค่า: typeof ssd['ว่างMB'] === 'number' ? `${Math.round((ssd['ว่างMB'] as number) / 1024)} GB` : '—',
            ย่อย: typeof ssd['ทั้งหมดMB'] === 'number' ? `จาก ${Math.round((ssd['ทั้งหมดMB'] as number) / 1024)} GB` : 'ไม่รู้',
          },
        ].map((k) => (
          <div key={k.ป้าย} className="rounded border bg-white p-3">
            <div className="text-xs text-gray-500">{k.ป้าย}</div>
            <div className="text-lg font-semibold">{k.ค่า}</div>
            <div className="text-xs text-gray-500">{k.ย่อย}</div>
          </div>
        ))}
      </div>

      {/* ── ③ ใครเชื่อมแล้วบ้าง ───────────────────────────────────── */}
      <div className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">ใครเชื่อมแล้วบ้าง</h2>
        {Object.keys(ผู้เชื่อม).length === 0 ? (
          <div className="text-sm text-gray-600">ยังไม่รู้ — ไฟล์ประกาศยังไม่มีข้อมูลส่วนนี้</div>
        ) : (
          <ul className="space-y-1 text-sm">
            {Object.entries(ผู้เชื่อม).map(([ชื่อ, ค่า]) => (
              <li key={ชื่อ}>
                {ค่า === true ? '✅' : ค่า === false ? '⬜' : '❔'} {ชื่อ}
                {ค่า === null && <span className="ml-1 text-gray-500">(ยังไม่ได้ตรวจ — ไม่ใช่ว่าไม่ได้เชื่อม)</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 text-xs text-gray-500">
          ติ๊กถูกมาจาก<b>การตรวจไฟล์ตั้งค่าจริง</b> ไม่ใช่รายชื่อที่พิมพ์ไว้เอง —
          ติ๊กที่พิมพ์เองคือคำกล่าวอ้าง ไม่ใช่สถานะ
        </div>
      </div>

      {/* ── ④ กฎที่ต้องให้คนเปิดหน้านี้เห็น (ท่านสั่งให้เขียนบนหน้า ไม่ใช่ซ่อนในโค้ด) ── */}
      <div className="rounded border bg-white p-3 text-sm">
        <h2 className="mb-2 font-semibold">ทำไมออกแบบแบบนี้</h2>
        <ul className="space-y-1.5">
          <li>🚫 <b>ไม่ให้ AI ย่อความจำ</b> — ย่อผิดเมื่อไหร่ ความจำจะผิดแบบมั่นใจ แล้วหลอกคนอ่านทีหลัง
            <span className="text-gray-600"> ความจำที่ผิดแย่กว่าไม่มีความจำ เพราะไม่มีใครสงสัย</span></li>
          <li>🚫 <b>ไฟล์คือตัวจริง Mem0 เป็นแค่ตัวค้น</b> — ผลค้นคืนที่อยู่ไฟล์เสมอ ให้ไปเปิดฉบับเต็ม ·
            Mem0 พังก็ยังทำงานได้ด้วยไฟล์เหมือนเดิม</li>
          <li>🚫 <b>Linode เขียนขึ้นอย่างเดียว</b> — ห้ามสร้างทางถอยที่อ่านจาก Linode ตอนทำงานปกติ
            <span className="text-gray-600"> ไม่งั้นมันจะกลายเป็นของที่ระบบพึ่งพาจริงโดยไม่มีใครตั้งใจ</span></li>
          <li>💰 <b>ค่าใช้จ่าย 0 บาท</b> — ไม่มีขั้นไหนยิงออกเน็ต ตัวฝังความหมายรันในเครื่อง ข้อมูลไม่ออกนอกบ้าน</li>
          <li>📌 <b>ปักรุ่นไว้ ห้ามอัปอัตโนมัติ</b> — รุ่นที่รันอยู่:{' '}
            <code>mem0ai {(รุ่น['mem0ai'] as string) ?? '—'}</code>{' · '}
            <code>qdrant-client {(รุ่น['qdrant-client'] as string) ?? '—'}</code>{' · '}
            ตัวฝัง <code>{(รุ่น['ตัวฝัง'] as string) ?? '—'}</code>
          </li>
        </ul>
      </div>

      <div className="rounded border bg-gray-50 p-3 text-xs text-gray-600">
        <div><b>ที่มาของตัวเลขบนหน้านี้</b> — g1 ประกาศไฟล์สถานะขึ้น R2 เป็นรอบ แล้วหน้านี้อ่านไฟล์นั้น
          ⇒ <b>เป็นภาพ ณ เวลาที่ประกาศ ไม่ใช่สถานะวินาทีนี้</b></div>
        <div className="mt-0.5">ประกาศเมื่อ <b>{(ประกาศ?.ประกาศเมื่อ as string) ?? '—'}</b>
          {ผล.อายุนาที !== null && <> (เก่า {ผล.อายุนาที} นาที)</>} · หน้านี้อ่านเมื่อ {อ่านเมื่อ}</div>
        <div className="mt-0.5">หัวสมองอยู่บน g1 ฟังเฉพาะในเครื่อง — <b>ไม่เปิดออกเน็ตสาธารณะ</b> โดยตั้งใจ</div>
      </div>
    </div>
  )
}

/* ── ผัง SVG ───────────────────────────────────────────────────────
 * วาดเป็น SVG ตามที่ท่านสั่ง (ไม่ใช่รูปนิ่ง) ⇒ สีและข้อความเปลี่ยนตามสถานะจริงได้
 * ⚠️ กล่องที่ยังไม่รู้สถานะต้องเป็น **สีเทา** ไม่ใช่เขียว — เขียวคือคำยืนยัน
 */
function ผังหัวสมอง({ ปกติ, เลขท่อน, ผู้เชื่อม, สำรองล่าสุด }: {
  ปกติ: boolean
  เลขท่อน: string
  ผู้เชื่อม: Record<string, boolean | null>
  สำรองล่าสุด: string | null
}) {
  const เขียว = '#059669'
  const เทา = '#9ca3af'
  const สีสมอง = ปกติ ? เขียว : เทา
  const สีสำรอง = สำรองล่าสุด ? เขียว : เทา
  /* 🔑 กล่องคนในผัง **สร้างจากข้อมูลที่ g1 ส่งมาจริง** ไม่ใช่รายชื่อที่พิมพ์ไว้ในหน้า
     เหตุ: รายชื่อที่พิมพ์ไว้จะไม่ขยับตามของจริง ⇒ วันที่ฝั่ง g1 เปลี่ยนชื่อแถว
     ผังจะยังโชว์ชื่อเดิมพร้อมสถานะ "ยังไม่ได้ตรวจ" ทุกคน โดยไม่มีอะไรฟ้องว่าจับคู่ไม่ติด */
  const คน = Object.entries(ผู้เชื่อม).slice(0, 5)

  return (
    <svg viewBox="0 0 860 560" className="h-auto w-full min-w-[640px]" role="img"
      aria-label="ผังการเชื่อมต่อของหัวสมอง Mem0">
      <defs>
        <marker id="ลูกศร" markerWidth="9" markerHeight="9" refX="7" refY="3.2" orient="auto">
          <path d="M0,0 L0,6.4 L7,3.2 z" fill="#6b7280" />
        </marker>
      </defs>

      {/* แหล่งความรู้ */}
      <rect x="20" y="14" width="400" height="118" rx="10" fill="#eff6ff" stroke="#93c5fd" />
      <text x="34" y="38" fontSize="15" fontWeight="700" fill="#1e3a8a">แหล่งความรู้ (ตัวจริง)</text>
      <text x="34" y="58" fontSize="12" fill="#1e40af">คนเขียนเอง มีเหตุผลกำกับ · แก้ที่นี่เสมอ</text>
      <text x="34" y="80" fontSize="12.5" fill="#1f2937">• ความจำรายเรื่อง (ไฟล์ .md ของแต่ละคน)</text>
      <text x="34" y="99" fontSize="12.5" fill="#1f2937">• claude-shared/ เช่นไฟล์โซ่ 27 KB</text>
      <text x="34" y="118" fontSize="12.5" fill="#1f2937">• สมุดส่งงาน handoff.md</text>

      <line x1="220" y1="132" x2="220" y2="186" stroke="#6b7280" strokeWidth="1.6" markerEnd="url(#ลูกศร)" />
      <text x="232" y="158" fontSize="12" fill="#374151">ป้อนเต็ม ๆ ไม่ย่อ ไม่ตัด</text>
      <text x="232" y="174" fontSize="11" fill="#9ca3af">(ไฟล์เปลี่ยน ⇒ ป้อนทับท่อนเดิม)</text>

      {/* หัวสมอง */}
      <rect x="20" y="188" width="400" height="140" rx="10" fill={ปกติ ? '#ecfdf5' : '#f9fafb'}
        stroke={สีสมอง} strokeWidth="2" />
      <circle cx="40" cy="212" r="6" fill={สีสมอง} />
      <text x="56" y="217" fontSize="15" fontWeight="700" fill="#111827">
        🧠 Mem0 — g1 · เก็บบน SSD
      </text>
      <text x="34" y="242" fontSize="12.5" fill="#1f2937">
        ความจำในฐาน: <tspan fontWeight="700">{เลขท่อน}</tspan> ท่อน
      </text>
      <text x="34" y="262" fontSize="12.5" fill="#1f2937">ตัวฝังความหมาย: Ollama bge-m3 (ในเครื่อง · ฟรี)</text>
      <text x="34" y="282" fontSize="12.5" fill="#b91c1c">❌ ไม่มีขั้น AI ย่อ (ท่านสั่งปิด)</text>
      <text x="34" y="302" fontSize="12.5" fill="#1f2937">หน้าที่เดียว: ค้นให้เจอ แล้วชี้ไฟล์ต้นทาง</text>
      <text x="34" y="320" fontSize="11" fill="#6b7280">ฟังเฉพาะ 127.0.0.1 — ไม่เปิดออกเน็ต</text>

      {/* ผู้ใช้ */}
      <line x1="220" y1="328" x2="220" y2="368" stroke="#6b7280" strokeWidth="1.6" />
      <line x1="470" y1="368" x2="820" y2="368" stroke="#6b7280" strokeWidth="1.6" />
      <line x1="220" y1="368" x2="470" y2="368" stroke="#6b7280" strokeWidth="1.6" />
      <text x="232" y="360" fontSize="12" fill="#374151">ทุกคนค้นก้อนเดียวกัน</text>
      {คน.map(([ชื่อ, สถานะคน], i) => {
        const กว้าง = 150
        const ซ้าย = 40 + i * 160
        const สีกล่อง = สถานะคน === true ? เขียว : สถานะคน === false ? '#d1d5db' : เทา
        return (
          <g key={ชื่อ}>
            <line x1={ซ้าย + กว้าง / 2} y1="368" x2={ซ้าย + กว้าง / 2} y2="396"
              stroke="#6b7280" strokeWidth="1.4" markerEnd="url(#ลูกศร)" />
            <rect x={ซ้าย} y="398" width={กว้าง} height="46" rx="8" fill="#ffffff" stroke={สีกล่อง} strokeWidth="1.8" />
            <circle cx={ซ้าย + 16} cy="421" r="5" fill={สีกล่อง} />
            <text x={ซ้าย + 28} y="418" fontSize="11.5" fill="#111827">{ชื่อ.slice(0, 22)}</text>
            <text x={ซ้าย + 28} y="434" fontSize="10.5" fill="#6b7280">
              {สถานะคน === true ? 'เชื่อมแล้ว' : สถานะคน === false ? 'ยังไม่เชื่อม' : 'ยังไม่ได้ตรวจ'}
            </text>
          </g>
        )
      })}

      {/* สำรอง */}
      <line x1="220" y1="444" x2="220" y2="482" stroke="#6b7280" strokeWidth="1.6" markerEnd="url(#ลูกศร)" />
      <text x="232" y="470" fontSize="12" fill="#374151">สำเนาเผื่อไฟดับ — เขียนขึ้นอย่างเดียว</text>
      <rect x="20" y="484" width="560" height="60" rx="10" fill="#fff7ed" stroke={สีสำรอง} strokeWidth="1.8" />
      <circle cx="40" cy="508" r="6" fill={สีสำรอง} />
      <text x="56" y="512" fontSize="14" fontWeight="700" fill="#7c2d12">🗄️ Linode สิงคโปร์ — ตู้เซฟเย็น</text>
      <text x="56" y="532" fontSize="11.5" fill="#7c2d12">
        {สำรองล่าสุด ? `สำรองล่าสุด ${สำรองล่าสุด}` : 'ยังไม่เคยสำรอง'} ·
        ไม่มีใครอ่านตอนใช้งานปกติ (ห้ามทำทางถอยที่อ่านจากที่นี่)
      </text>
    </svg>
  )
}
