'use client'
// สุขภาพฟีดสินค้าที่ AI อ่าน — /core/feed-health
//
// 🔑 **ทำไมต้องมีจอนี้ (ใบ t_mukwzjtz · 28 ก.ย. 2569)**
//    เส้น `/api/feed-health` มีมานานและตอบข้อมูลถูกต้อง แต่ **ไม่มีจอไหนอ่านเลยสักจอ**
//    ⇒ ของที่ถูกทั้งหมดแต่ไม่มีใครเห็น = ของที่ไม่มีอยู่จริงสำหรับคนตัดสินใจ
//    (คลาสเดียวกับช่อง `ok` ที่วัดแล้วมีจออ่าน 7 จาก 93 จอ)
//
// ⚠️ **ปุ่มกดเอง ห้ามยิงตอนเปิดหน้า** — ฝั่งท่อวัดเวลาตอบจริงได้ **2.6 วินาที**
//    (เส้นนี้ไล่เทียบหน้าเว็บทั้งหมดกับรหัสใน ZORT ทั้งคลัง) ⇒ ยิงอัตโนมัติ = หน่วงทุกครั้งที่เปิดหน้า
//
// 🔴 **เลขที่สำคัญที่สุดบนจอนี้คือ "ZORT มีของ แต่เว็บไม่มีหน้า"** (ช่อง `missingCount`)
//    ของจริงวันที่ทำจอนี้: **335 รหัส** ⇒ ลูกค้าค้นไม่เจอ และ AI ก็แนะนำให้ไม่ได้
//    ⇒ เป็นเรื่องยอดขาย ไม่ใช่เรื่องเทคนิค ⇒ จอต้องเขียนความหมายออกมาตรง ๆ ไม่ใช่คำว่า "missing"
import { useCallback, useState } from 'react'
import Card from '@/components/ui/Card'
import ErrorBox from '@/components/ui/ErrorBox'
import StatCard from '@/components/ui/StatCard'
import { fmtNum, thaiDate } from '@/lib/format'

/** รูปคำตอบของ `/api/feed-health` — **ทุกช่องเป็น optional เพราะท่อรุ่นเก่าไม่ส่ง**
 *  🔑 `stockSource` เป็นช่องเดียวที่บอกว่าเลขทั้งจอมาจากไหน — ท่อประกาศสี่ค่า:
 *     `live` (สดจาก ZORT) · `cached` (ของเก่าที่แช่ไว้) · `baked` (ค่าที่ฝังตอน build) · `unreadable` (อ่านไม่ได้)
 *  ⚠️ `unreadable` ⇒ ท่อส่ง `inZort`/`missing` เป็น **null** ⇒ จอต้องเขียนว่า "ยังไม่รู้" ห้ามเขียน 0 */
type ผลสุขภาพ = {
  stockLive?: boolean | null
  stockSource?: string | null
  partial?: boolean | null
  at?: string | null
  onSite?: number | null
  inZort?: number | null
  matched?: number | null
  missingCount?: number | null
  missing?: { sku?: string; st?: number | null; price?: number | null }[] | null
  notInZortCount?: number | null
  notInZort?: { sku?: string; t?: string }[] | null
  error?: string
}

const เลข = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const แสดงเลข = (v: number | null) => (v === null ? 'ยังไม่รู้' : fmtNum(v))

/** คำอธิบายที่มาของตัวเลข — **ยึดค่าที่ท่อส่งมา ไม่เดาเอง**
 *  ค่าที่จอไม่รู้จัก ⇒ แสดงค่าดิบพร้อมบอกว่ายังไม่มีคำแปล (ไม่ใช่ถือว่าเสีย) */
function ป้ายที่มา(src: string | null): { คำ: string; สี: string; ความหมาย: string } {
  switch (src) {
    case 'live':
      return { คำ: 'สดจาก ZORT', สี: 'text-green-700', ความหมาย: 'ตัวเลขข้างล่างอ่านจากคลังจริงในรอบนี้' }
    case 'cached':
      return { คำ: 'ของเก่าที่แช่ไว้', สี: 'text-amber-700', ความหมาย: 'ถาม ZORT รอบนี้ไม่ได้ ⇒ ใช้ค่าที่เก็บไว้ครั้งก่อน' }
    case 'baked':
      return { คำ: 'ค่าที่ฝังตอน build', สี: 'text-amber-700', ความหมาย: 'ไม่มีข้อมูลสดเลย ⇒ ใช้ไฟล์ที่ฝังไว้ตอนสร้างเว็บ' }
    case 'unreadable':
      return { คำ: 'อ่านคลังไม่ได้', สี: 'text-red-700', ความหมาย: 'รอบนี้อ่าน ZORT ไม่สำเร็จ ⇒ ตัวเลขด้านล่างเป็น "ยังไม่รู้" ไม่ใช่ศูนย์' }
    default:
      return {
        คำ: src ? `ท่อส่งค่ามาว่า "${src}"` : 'ท่อไม่ได้บอกที่มา',
        สี: 'text-gray-700',
        ความหมาย: 'จอยังไม่มีคำแปลของค่านี้ ⇒ อย่าเพิ่งอ่านว่าดีหรือเสีย',
      }
  }
}

export default function จอสุขภาพฟีด() {
  const [ผล, setผล] = useState<ผลสุขภาพ | null>(null)
  const [กำลังยิง, setกำลังยิง] = useState(false)
  const [พัง, setพัง] = useState<string | null>(null)
  const [ยิงเมื่อ, setยิงเมื่อ] = useState<string | null>(null)

  const ยิง = useCallback(async () => {
    setกำลังยิง(true); setพัง(null)
    try {
      const r = await fetch('/api/web/feed-health')
      const j = (await r.json()) as ผลสุขภาพ
      if (!r.ok || j.error) throw new Error(j.error || `ท่อตอบ ${r.status}`)
      setผล(j); setยิงเมื่อ(new Date().toLocaleString('th-TH'))
    } catch (e) {
      setผล(null)
      setพัง(e instanceof Error ? e.message : String(e))
    } finally {
      setกำลังยิง(false)
    }
  }, [])

  const ที่มา = ป้ายที่มา(ผล?.stockSource ?? null)
  const ไม่มีหน้า = เลข(ผล?.missingCount)
  const ไม่มีในคลัง = เลข(ผล?.notInZortCount)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">สุขภาพฟีดสินค้าที่ AI อ่าน</h1>
          <p className="text-sm text-gray-600">
            เทียบ “หน้าสินค้าบนเว็บ” กับ “รหัสในคลัง ZORT” ว่าตรงกันแค่ไหน
          </p>
        </div>
        <button
          onClick={() => void ยิง()}
          disabled={กำลังยิง}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {กำลังยิง ? 'กำลังตรวจ…' : ผล ? 'ตรวจใหม่' : 'ตรวจเดี๋ยวนี้'}
        </button>
      </div>

      {/* ⚠️ เขียนบนจอว่าทำไมต้องกดเอง — ไม่งั้นคนจะคิดว่าจอพังเพราะเปิดมาแล้วว่าง */}
      <Card>
        <p className="text-sm text-gray-700">
          จอนี้ <b>ไม่ยิงเองตอนเปิดหน้า</b> — เส้นนี้ใช้เวลาตอบราว <b>2–3 วินาที</b>
          {' '}เพราะต้องไล่เทียบหน้าเว็บทั้งหมดกับรหัสทั้งคลัง ⇒ กดปุ่มเมื่อต้องการดู
        </p>
      </Card>

      {พัง && <ErrorBox title="ตรวจไม่สำเร็จ">{พัง}</ErrorBox>}

      {ผล && (
        <>
          <Card>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <span className="text-gray-600">ที่มาของตัวเลข:</span>
              <b className={ที่มา.สี}>{ที่มา.คำ}</b>
              <span className="text-gray-600">{ที่มา.ความหมาย}</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              ท่อวัดเมื่อ {ผล.at ? thaiDate(ผล.at) : 'ไม่รู้เวลา'}
              {ยิงเมื่อ ? ` · จอกดตรวจเมื่อ ${ยิงเมื่อ}` : ''}
              {ผล.partial ? ' · ⚠️ ท่อบอกว่ารอบนี้อ่านได้ไม่ครบทุกหน้า' : ''}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard icon="🌐" label="หน้าสินค้าบนเว็บ" value={แสดงเลข(เลข(ผล.onSite))} />
            <StatCard icon="📦" label="รหัสในคลัง ZORT" value={แสดงเลข(เลข(ผล.inZort))} />
            <StatCard icon="🔗" label="จับคู่กันได้" value={แสดงเลข(เลข(ผล.matched))} />
          </div>

          {/* 🔴 กล่องนี้คือหัวใจของจอ — เขียนความหมายเป็นประโยค ไม่ใช่คำว่า missing */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-900">
              ZORT บอกว่ามีของ แต่เว็บ<b className="text-red-700">ไม่มีหน้าสินค้า</b>
            </h2>
            <p className="mt-1 text-3xl font-bold text-red-700">{แสดงเลข(ไม่มีหน้า)}</p>
            <p className="mt-1 text-sm text-gray-700">
              ลูกค้าค้นหน้าร้านแล้ว<b>ไม่เจอ</b> และผู้ช่วย AI ก็<b>แนะนำให้ไม่ได้</b> —
              ของอยู่ในคลังแต่ไม่มีที่ให้ขาย
            </p>
            {Array.isArray(ผล.missing) && ผล.missing.length > 0 && (
              <>
                <div className="mt-2 text-xs text-gray-500">
                  ตัวอย่าง {ผล.missing.length} รหัสแรก (ท่อส่งมาเท่านี้
                  {ไม่มีหน้า !== null ? ` จากทั้งหมด ${fmtNum(ไม่มีหน้า)} รหัส` : ''})
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ผล.missing.map((m, i) => (
                    <span key={`${m.sku}-${i}`} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800">
                      {m.sku}
                      {เลข(m.st) !== null ? ` · คงเหลือ ${fmtNum(เลข(m.st))}` : ''}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-gray-900">
              เว็บมีหน้าสินค้า แต่<b className="text-amber-700">หารหัสนั้นในคลังไม่เจอ</b>
            </h2>
            <p className="mt-1 text-3xl font-bold text-amber-700">{แสดงเลข(ไม่มีในคลัง)}</p>
            <p className="mt-1 text-sm text-gray-700">
              หน้าพวกนี้ยังขายได้ แต่ตัวเลขสต็อกที่โชว์เป็น<b>ค่าที่แช่ไว้</b> ไม่ใช่ของสด
              ⇒ อาจขายของที่หมดแล้ว หรือปิดของที่ยังมี
            </p>
            {Array.isArray(ผล.notInZort) && ผล.notInZort.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-gray-700">
                {ผล.notInZort.map((x, i) => (
                  <li key={`${x.sku}-${i}`}>
                    <b>{x.sku}</b> {x.t ? `· ${x.t}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
