'use client'
// ตั้งค่า → การเชื่อมต่อ — **ลอกจาก `zort-ui/20-ตั้งค่า-การเชื่อมต่อ-หน้าสำคัญสุด.jpg`**
// ผัง ZORT: หัวจอ "การเชื่อมต่อ" + "จำนวน N รายการ | ตั้งค่าการกระจายสินค้า | API Reference"
//   · ปุ่ม "เพิ่มการเชื่อมต่อ" มุมขวาบน
//   · ตารางแบ่งเป็นกลุ่ม แต่ละกลุ่มมีแถวหัวสีเทา: Marketplace · Website · Social · Accounting
//     (สองกลุ่มแรกมีคอลัมน์ "การกระจายสินค้า" เป็น %) แล้วต่อด้วยตาราง API (Store name · API Key)
//
// 🔴 **ทุกบรรทัดในจอนี้ต้องมาจากการวัดจริง ห้ามเขียนตายตัวสักบรรทัด**
//    สถานะการเชื่อมต่อเปลี่ยนได้ทุกวันโดยไม่มีใครมาแก้จอ — จอที่เขียนตายตัวจะกลายเป็นตัวโกหก
//    (บทเรียนเดียวกับหน้าสถานะระบบฝั่งหน้าร้าน 19 ส.ค. 2569 ที่ขึ้นเขียวทั้งที่ของจริงล่ม)
//    ⇒ ข้อมูลมาจาก `GET /api/core?connections=1` ซึ่งยิงของจริงทุกเจ้าแล้วตอบกลับมา
//
// 🔴 **สี่สถานะ ต้องแยกให้ขาด — นี่คือหัวใจของจอนี้**
//    ✅ เชื่อมแล้ว        (connected: true)   ยิงแล้วผ่านจริง
//    ⬜ ยังไม่ได้เชื่อม    (connected: false)  ยิงแล้วไม่ผ่าน/ยังไม่ได้ขอสิทธิ์
//    ❓ ยังไม่มีตัวตรวจ    (connected: null)   **เราไม่รู้ ไม่ใช่ไม่ได้เชื่อม**
//    🚫 เลิกใช้แล้ว       (retired: true)     เช่น Shopify ที่ปิดถาวรไปแล้ว
//    ⚠️ ยุบ null รวมกับ false เมื่อไหร่ = จอบอกว่า "ไม่ได้เชื่อม" ทั้งที่ความจริงคือ "ยังไม่ได้ตรวจ"
//       และไม่มีอะไรมาบังคับให้เห็นว่าตัวตรวจไหนยังขาด
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, TableWrap, TH, TD, EmptyState } from '@/components/zort'
import { parseUtc, thaiDayTime } from '@/components/zort/DataFreshness'

interface Conn {
  name: string
  /** true = ยิงผ่าน · false = ยิงไม่ผ่าน/ยังไม่มีสิทธิ์ · null = ยังไม่มีตัวตรวจ */
  connected: boolean | null
  detail?: string
  lastChecked?: string
  /** เลิกใช้ถาวรแล้ว — คนละความหมายกับ "ยังไม่ได้เชื่อม" */
  retired?: boolean
  /** % การกระจายสินค้า ถ้ามี (ZORT โชว์คอลัมน์นี้ในกลุ่ม Marketplace/Website) */
  spread?: number | null
  /** เวลาที่ใช้ยิงตรวจ — **ช้าไม่ใช่พัง เป็นคนละสถานะ** */
  ms?: number
  /* ── วันหมดอายุ token (UTC) — **ช่องนี้ยังรอฝั่งท่อส่งมา** (ขอไว้ 4 ก.ย. 2569) ──
     ทำไมต้องมี: token ของ Lazada อายุ 7 วัน · ต่ออายุอัตโนมัติมีแล้ว (วิ่งตี 3 ครึ่ง)
     แต่ **วันที่มันหลุดจริง อาการจะเหมือน "API พัง" ทุกประการ** ⇒ คนจะไล่หาผิดที่
     ⚠️ ตอนนี้เลขวันมาในข้อความ `detail` ("token เหลือ 6 วัน") ซึ่งจอ **ไม่แกะ**
        แกะตัวเลขจากประโยค = พังเงียบทันทีที่ฝั่งท่อแก้คำ ⇒ รอฟิลด์จริงดีกว่า
     จอเตรียมช่องไว้แล้ว พอท่อส่งมาก็ขึ้นเอง ไม่ต้องแก้จอ */
  tokenExpiresAtUtc?: string | null
}
interface Resp {
  skip?: string
  checkedAt?: string
  /** ตัวนับจากเซิร์ฟเวอร์ — **ใช้ของเขา ไม่นับเอง** จะได้ไม่มีวันขัดกันเองบนจอเดียว */
  connected?: number
  notConnected?: number
  unchecked?: number
  retired?: number
  note?: string
  groups?: Record<string, Conn[]>
}

// ชื่อกลุ่มตาม ZORT — เขาใช้ภาษาอังกฤษในแถวหัวกลุ่มจริง ๆ จึงใช้ตาม
// ⚠️ **กลุ่มที่ไม่มีในรายการนี้ต้องยังถูกวาด** (เช่น warehouse ที่ ZORT ไม่มี แต่เรามี ZORT 2 ร้าน)
//    รายการตายตัวที่ "กรองทิ้งของที่ไม่รู้จัก" คือวิธีทำข้อมูลหายแบบเงียบที่สุด —
//    เพิ่มกลุ่มใหม่ฝั่งเซิร์ฟเวอร์แล้วจอไม่ขึ้น และไม่มีอะไรฟ้องสักอย่าง
const GROUPS: { key: string; label: string; spread?: boolean }[] = [
  { key: 'marketplace', label: 'Marketplace', spread: true },
  { key: 'website', label: 'Website', spread: true },
  { key: 'social', label: 'Social' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'warehouse', label: 'Warehouse (คลังต้นทาง)' },
]
/** ช้ากว่านี้ถือว่า "ช้า" — เกณฑ์เดียวกับหน้าสถานะระบบฝั่งหน้าร้าน */
const SLOW_MS = 2500

/** วันหมดอายุ token — เตือนแรงขึ้นเมื่อใกล้หมด
 *  ⚠️ **หมดอายุแล้ว ≠ พัง** — ตัวต่ออายุอัตโนมัติวิ่งตี 3 ครึ่งทุกวัน
 *     แต่ถ้ามันตายเงียบ token จะหลุดจริง และอาการจะเหมือน "API พัง" ทุกประการ
 *     ⇒ โชว์วันที่ไว้เสมอ ไม่ต้องรอให้ใกล้หมดถึงค่อยขึ้น */
function TokenExpiry({ at }: { at?: string | null }) {
  const d = parseUtc(at)
  if (!d) return null
  const hours = Math.round((d.getTime() - Date.now()) / 3600e3)
  const gone = hours <= 0
  const soon = hours <= 48
  return (
    <span
      className={`block text-[11px] mt-0.5 ${gone ? 'text-red-700 font-medium' : soon ? 'text-amber-700' : 'text-gray-400'}`}
      title={'ต่ออายุอัตโนมัติวิ่งทุกวันตี 3 ครึ่ง — เลขนี้บอกว่าถ้าตัวต่ออายุหยุดทำงาน จะเหลือเวลาอีกเท่าไหร่'}
    >
      🔑 token {gone
        ? <b>หมดอายุแล้ว</b>
        : `เหลือ ${hours < 48 ? `${hours} ชม.` : `${Math.round(hours / 24)} วัน`}`}
      {' '}· ถึง {thaiDayTime(d)} (เวลาไทย)
    </span>
  )
}

function StatusPill({ c }: { c: Conn }) {
  if (c.retired) {
    return <span className="text-[11.5px] font-semibold text-gray-600 bg-gray-100 rounded px-2 py-0.5">เลิกใช้แล้ว</span>
  }
  if (c.connected === true) {
    return <span className="text-[11.5px] font-semibold text-emerald-800 bg-emerald-100 rounded px-2 py-0.5">เชื่อมแล้ว</span>
  }
  if (c.connected === false) {
    return <span className="text-[11.5px] font-semibold text-gray-700 bg-gray-100 rounded px-2 py-0.5">ยังไม่ได้เชื่อม</span>
  }
  // ⚠️ สีเหลือง ไม่ใช่สีเทา — "ไม่รู้" ต้องสะดุดตากว่า "รู้ว่าไม่ได้เชื่อม"
  //    เพราะมันคือรายการงานที่เหลือ ไม่ใช่สถานะที่จบแล้ว
  return <span className="text-[11.5px] font-semibold text-amber-800 bg-amber-100 rounded px-2 py-0.5">ยังไม่มีตัวตรวจ</span>
}

export default function ConnectionsRegistryPage() {
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/web/core?connections=1')
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setData(j)
    } catch (e) {
      setData(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])

  // ⚠️ กดเองเท่านั้น ห้ามตั้งให้ยิงซ้ำเอง — จอนี้ยิงของจริงไปหาทุกเจ้า (กติกาเจ้าของร้าน)
  useEffect(() => { load() }, [load])

  const groups = data?.groups ?? {}
  const all = Object.values(groups).flat()
  // กลุ่มที่เซิร์ฟเวอร์ส่งมาแต่ไม่มีในรายการข้างบน — ต้องวาดต่อท้าย ห้ามทิ้ง
  const extraGroups = Object.keys(groups).filter((k) => !GROUPS.some((g) => g.key === k))
  const shown = [...GROUPS, ...extraGroups.map((k) => ({ key: k, label: k, spread: false }))]
  const unknown = typeof data?.unchecked === 'number'
    ? data.unchecked
    : all.filter((c) => c.connected === null && !c.retired).length

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="การเชื่อมต่อ"
        summary={
          data
            ? (
              <>
                จำนวน {all.length} รายการ
                {' | '}
                <Link href="/core/soon/spread-setting" className="text-blue-600 hover:underline">ตั้งค่าการกระจายสินค้า</Link>
                {' | '}
                <Link href="/settings/connections/health" className="text-blue-600 hover:underline">ตรวจสุขภาพการเชื่อมต่อ</Link>
              </>
            )
            : 'กำลังตรวจ…'
        }
        actions={
          <>
            <BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังตรวจ…' : 'ตรวจอีกครั้ง'}</BtnGhost>
            <Link href="/core/soon/connection-add"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              เพิ่มการเชื่อมต่อ
            </Link>
          </>
        }
      />

      {error && <ErrorBox title="ตรวจการเชื่อมต่อไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {data?.skip && (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-[13px] text-gray-500">{data.skip}</div>
      )}

      {data && !data.skip && (
        <>
          {/* 🔴 บรรทัดนี้คือสิ่งที่ทำให้จอนี้มีค่ากว่า "ยังไม่มีจอ" — มันคือรายการงานที่เหลือ */}
          <div className="text-[12.5px] text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
            ทุกบรรทัดในจอนี้<b>มาจากการยิงของจริง</b> ไม่มีบรรทัดไหนเขียนตายตัว
            {data.checkedAt && <> · ตรวจเมื่อ {new Date(data.checkedAt).toLocaleString('th-TH')}</>}
            <br />
            ✅ เชื่อมแล้ว <b>{data.connected ?? 0}</b> · ⬜ ยังไม่ได้เชื่อม <b>{data.notConnected ?? 0}</b>
            {' '}· ❓ ยังไม่มีตัวตรวจ <b>{data.unchecked ?? 0}</b> · 🚫 เลิกใช้แล้ว <b>{data.retired ?? 0}</b>
            {unknown > 0 && (
              <>
                <br />
                {/* ⚠️ ไม่พูดเลขซ้ำกับบรรทัดบน — บอกแค่ว่ามันแปลว่าอะไร */}
                ช่อง <b>ยังไม่มีตัวตรวจ</b> <b>ไม่ได้แปลว่าไม่ได้เชื่อม</b> แปลว่า<b>เรายังตรวจไม่ได้</b>
                {' '}· ช่องพวกนี้คือรายการงานที่เหลือของโครงการแก่น
              </>
            )}
          </div>

          {all.length === 0 && (
            <TableWrap>
              <table className="w-full">
                <tbody>
                  <EmptyState cols={1} icon="🔌" title="ยังไม่มีข้อมูลการเชื่อมต่อ"
                    detail="ฝั่งเซิร์ฟเวอร์ยังไม่ได้ส่งผลการตรวจมา — จอพร้อมแสดงทันทีที่ข้อมูลมา" />
                </tbody>
              </table>
            </TableWrap>
          )}

          {shown.map((g) => {
            const rows = groups[g.key] ?? []
            if (rows.length === 0) return null
            return (
              <div key={g.key} className="mb-4">
                <TableWrap>
                  <table className="w-full min-w-[720px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className={TH}>{g.label}</th>
                        <th className={TH} style={{ width: 190 }}>
                          {g.spread ? 'การกระจายสินค้า' : ''}
                        </th>
                        <th className={TH} style={{ width: 150 }}>สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => (
                        <tr key={`${g.key}-${c.name}`} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className={TD}>
                            <span className={c.retired ? 'text-gray-500 line-through' : 'text-blue-600'}>{c.name}</span>
                            {c.detail && <span className="block text-[11.5px] text-gray-400">{c.detail}</span>}
                            <TokenExpiry at={c.tokenExpiresAtUtc} />
                          </td>
                          <td className={TD}>
                            {/* ⚠️ ZORT โชว์ 100% ทุกแถว — ของเราไม่มีระบบกระจายสินค้า
                                ใส่ 100% ตามเขา = โกหกว่ามีระบบนั้น ⇒ ขีดไว้ แล้วอธิบายท้ายจอ */}
                            {g.spread
                              ? (typeof c.spread === 'number'
                                ? `${c.spread}%`
                                : <span className="text-gray-300">—</span>)
                              : null}
                          </td>
                          <td className={TD}>
                            <StatusPill c={c} />
                            {/* ⚠️ ช้าไม่ใช่พัง — โชว์เวลาไว้ให้เห็น แต่ไม่เปลี่ยนสถานะเป็นแดง */}
                            {typeof c.ms === 'number' && (
                              <span className={`block text-[11px] mt-0.5 ${c.ms >= SLOW_MS ? 'text-amber-700' : 'text-gray-400'}`}>
                                {c.ms >= SLOW_MS ? `ช้า ${(c.ms / 1000).toFixed(1)} วินาที` : `${c.ms} ms`}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              </div>
            )
          })}

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            ⚠️ คอลัมน์ <b>การกระจายสินค้า</b> ของ ZORT เขียน 100% ทุกแถว (เขามีระบบแบ่งสต็อกไปรายช่องทาง)
            — ของเรา<b>ยังไม่มีระบบนั้น</b> จึงเป็นขีด · ใส่ 100% ตามเขาก็ได้ แต่นั่นคือการบอกว่ามีระบบที่ไม่มีอยู่
            <br />
            ⚠️ ZORT มีตาราง <b>API</b> ต่อท้าย แสดง Store name กับ API Key ที่ปิดบางส่วน —
            <b> ของเราตั้งใจไม่ทำ</b> คีย์ทั้งหมดอยู่ในตัวแปรลับที่ Netlify
            การเอาคีย์มาโชว์บนจอ (ต่อให้ปิดบางส่วน) ไม่ได้ช่วยให้ทำงานอะไรได้เพิ่ม แต่เพิ่มที่ให้มันรั่ว
            <br />
            ⚠️ กลุ่ม <b>Warehouse</b> ไม่มีในจอ ZORT — เป็นของเราเอง (ZORT 2 ร้านคือ<b>ต้นทาง</b>ของคลังเงา)
            · จอนี้<b>ยิงของจริงทุกครั้งที่กด</b> รวมถึงยิงไปหา ZORT ⇒ <b>ไม่มีรีเฟรชอัตโนมัติ</b> โดยตั้งใจ
          </p>
        </>
      )}
    </div>
  )
}
