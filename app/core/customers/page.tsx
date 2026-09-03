'use client'
// ลูกค้า/คู่ค้า → ผู้ติดต่อ — **ทะเบียนรายชื่อ 28,250 ราย จากกระจก ZORT**
//
// ⚠️ **ตั้งใจไม่เปิดไฟล์ภาพ `05-ลูกค้า-ผู้ติดต่อ.jpg`** เพราะในภาพมีชื่อ เบอร์ อีเมล
//    ลูกค้าจริง — ผังจอนี้ได้มาเป็น "ข้อความบอกคอลัมน์" จากฝั่งเซิร์ฟเวอร์แทน
//    ไม่มีเหตุผลที่ต้องอ่านข้อมูลส่วนตัวของลูกค้าเพื่อจัดหน้าตาราง
//
// ผังจาก ZORT: หัวจอ "ผู้ติดต่อ" + "จำนวน N รายการ" · ปุ่ม นำเข้าไฟล์ (Excel) · เพิ่มผู้ติดต่อใหม่
//   · ค้นหา "พิมพ์คำค้นหา" + ค้นหาขั้นสูง · แท็บ ทั้งหมด · ลูกค้า · คู่ค้า · + เพิ่มหมวดหมู่
//   · คอลัมน์ # · รหัส · ชื่อ · เลขประจำตัวผู้เสียภาษี · เบอร์โทรศัพท์ · อีเมล · ⋮
//   · ช่องว่างแสดงเป็น "-" ทุกคอลัมน์
//
// 🔒 **จอนี้แสดงข้อมูลส่วนบุคคลของคนสองหมื่นแปดพันคน — กติกาที่ห้ามถอด**
//    ① เลขประจำตัวผู้เสียภาษีถูกปิดบางส่วนมาจากเซิร์ฟเวอร์แล้ว (เห็น 4 ตัวท้าย)
//       **ห้ามทำปุ่ม "แสดงเต็ม" ในจอรายการ** — จอรายการมีไว้ "หาให้เจอ" ไม่ใช่ "อ่านของทุกคน"
//    ② **ห้ามทำปุ่ม Export ทั้งก้อน** จนกว่าเจ้าของร้านจะสั่งเอง
//    ③ เดินลึกเกินแถวที่ 500 โดยไม่ค้นหา เซิร์ฟเวอร์จะตอบ needQuery — ต้องอธิบายให้คนใช้เข้าใจ
//       ไม่ใช่โชว์ตารางว่างเฉย ๆ (ตาข่ายกันไล่ดึงทั้งฐานทีละหน้า)
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, SearchRow, Tabs, TableWrap, TH, TD, BtnGhost, LinkText, EmptyState, RowMenu,
} from '@/components/zort'

interface Contact {
  id: string; type?: string; name?: string; code?: string
  phone?: string; email?: string; branchName?: string
  /** ปิดบางส่วนมาจากเซิร์ฟเวอร์แล้ว — ฝั่งจอไม่เคยเห็นเลขเต็ม */
  taxId?: string
  address?: string
}
interface Resp {
  skip?: string
  total: number | null
  withPhone?: number; withEmail?: number; withTax?: number
  limit: number; offset: number
  needQuery?: boolean
  note?: string
  rows: Contact[]
}

const PAGE = 50
const DASH = <span className="text-gray-300">-</span>

export default function CoreContactsPage() {
  const [data, setData] = useState<Resp | null>(null)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (off = 0, term = q) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ list: 'contacts', limit: String(PAGE), offset: String(off) })
      if (term.trim()) qs.set('q', term.trim())
      const res = await fetch(`/api/web/core?${qs}`)
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setData(j)
      setOffset(off)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => { load(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.rows ?? []
  // ⚠️ แท็บ ลูกค้า/คู่ค้า ของ ZORT กรองจากชนิดผู้ติดต่อ — ข้อมูลที่เรามี `type` เป็น
  //    "Undefined" ทุกแถวเท่าที่สุ่มดู 600 ราย ⇒ **กดแล้วจะได้ศูนย์ทุกครั้ง**
  //    ปุ่มที่กดแล้วได้ศูนย์เสมอคือปุ่มหลอก ⇒ โชว์ไว้ให้ผังตรง แต่กดไม่ได้ + บอกเหตุผล
  const hasType = rows.some((r) => r.type && r.type !== 'Undefined')

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ผู้ติดต่อ"
        summary={
          data
            ? (
              <>
                {typeof data.total === 'number'
                  ? <>จำนวน {fmtNum(data.total)} รายการ</>
                  : <>ต้องพิมพ์คำค้นก่อนถึงจะดูส่วนนี้ได้</>}
                {typeof data.withPhone === 'number' && (
                  <span className="text-gray-400">
                    {' '}· มีเบอร์ {fmtNum(data.withPhone)} · มีอีเมล {fmtNum(data.withEmail ?? 0)}
                    {' '}· มีเลขผู้เสียภาษี {fmtNum(data.withTax ?? 0)}
                  </span>
                )}
              </>
            )
            : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={() => load(offset)} disabled={loading}>
              {loading ? 'กำลังโหลด…' : 'รีเฟรช'}
            </BtnGhost>
            <Link href="/core/soon/contact-import"
              className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
              นำเข้าไฟล์ (Excel)
            </Link>
            <Link href="/core/soon/contact-add"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#1b3b73' }}>
              เพิ่มผู้ติดต่อใหม่
            </Link>
          </>
        }
      />

      {/* 🔒 ข้อความจากเซิร์ฟเวอร์ที่บอกว่านี่คือข้อมูลส่วนบุคคล — ต้องขึ้นบนจอเสมอ */}
      {data?.note && (
        <div className="text-[12.5px] text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
          🔒 {data.note}
        </div>
      )}

      <SearchRow
        value={q}
        onChange={setQ}
        onSubmit={() => load(0)}
        placeholder="พิมพ์คำค้นหา"
        advanced={<LinkText onClick={() => load(0)}>ค้นหาขั้นสูง</LinkText>}
      />

      {error && <ErrorBox title="ดึงรายชื่อผู้ติดต่อไม่ได้">{error}</ErrorBox>}
      {loading && !data && <LoadingState />}
      {data?.skip && (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-[13px] text-gray-500">{data.skip}</div>
      )}

      {data && !data.skip && (
        <>
          <Tabs
            tabs={[
              { id: '', label: 'ทั้งหมด', count: typeof data.total === 'number' ? data.total : undefined },
              { id: 'customer', label: 'ลูกค้า' },
              { id: 'vendor', label: 'คู่ค้า' },
            ]}
            active={tab}
            onChange={(id) => {
              // ยังกรองจริงไม่ได้ — บอกตรง ๆ ดีกว่าพาไปแท็บที่ว่างเปล่า
              if (id && !hasType) return
              setTab(id)
            }}
            right={
              <Link href="/core/soon/contact-group" className="text-[12.5px] text-blue-600 hover:underline">
                + เพิ่มหมวดหมู่
              </Link>
            }
          />

          {!hasType && (
            <p className="text-[12px] text-amber-800 bg-amber-50 border-x border-b border-amber-200 px-3.5 py-2 leading-relaxed">
              แท็บ <b>ลูกค้า</b> กับ <b>คู่ค้า</b> ยังกดไม่ได้ — ข้อมูลที่ ZORT ส่งมาเป็น
              <b> Undefined ทุกแถว</b> (สุ่มดู 600 ราย) ⇒ กรองแล้วจะได้ศูนย์เสมอ
              <b> ปุ่มที่กดแล้วได้ศูนย์ทุกครั้งคือปุ่มหลอก</b> จึงเปิดไว้ให้ผังตรงแต่ยังกดไม่ได้
            </p>
          )}

          {/* 🔴 ตาข่ายกันไล่ดึงทั้งฐานทีละหน้า — ต้องอธิบาย ไม่ใช่โชว์ตารางว่าง */}
          {data.needQuery && (
            <div className="text-[13px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 mt-3 leading-relaxed">
              <b>ดูลึกกว่านี้ต้องพิมพ์คำค้นก่อน</b> — {data.note}
              <br />
              เป็นตาข่ายที่ตั้งใจใส่ไว้ กันการไล่เปิดทีละหน้าจนได้รายชื่อลูกค้าครบทั้งฐาน
              <br />
              <button
                onClick={() => { setOffset(0); load(0) }}
                className="mt-2 text-[12.5px] font-medium text-gray-700 bg-white border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50"
              >
                กลับไปหน้าแรก
              </button>
            </div>
          )}

          {!data.needQuery && (
            <TableWrap>
              <table className="w-full min-w-[860px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH} style={{ width: 44 }}>#</th>
                    <th className={TH}>รหัส</th>
                    <th className={TH}>ชื่อ</th>
                    <th className={TH}>เลขประจำตัวผู้เสียภาษี</th>
                    <th className={TH}>เบอร์โทรศัพท์</th>
                    <th className={TH}>อีเมล</th>
                    <th className={TH} style={{ width: 56 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <EmptyState cols={7} icon="👥" title="ไม่พบผู้ติดต่อ"
                      detail={q ? 'ค้นได้จาก ชื่อ · เบอร์โทร · รหัสผู้ติดต่อ' : 'ยังไม่มีรายชื่อในคลังเงา — ต้องสั่งซิงก์ก่อน'} />
                  )}
                  {rows.map((r, i) => (
                    <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className={`${TD} text-gray-400`}>{offset + i + 1}</td>
                      <td className={`${TD} whitespace-nowrap`}>{r.code || DASH}</td>
                      <td className={TD}>
                        <span className="text-blue-600">{r.name || DASH}</span>
                        {/* ZORT ต่อท้ายชื่อสาขาในวงเล็บ — ค่าที่ได้มาบางแถวเป็นรหัสดิบ ("1")
                            แสดงตามที่ต้นทางให้มา ไม่แต่งเอง แล้วอธิบายไว้ท้ายตาราง */}
                        {r.branchName && <span className="text-gray-400"> ({r.branchName})</span>}
                      </td>
                      <td className={`${TD} whitespace-nowrap font-mono text-[12px]`}>{r.taxId || DASH}</td>
                      <td className={`${TD} whitespace-nowrap`}>{r.phone || DASH}</td>
                      <td className={`${TD} max-w-[220px] truncate`}>{r.email || DASH}</td>
                      <td className={`${TD} text-right`}>
                        <RowMenu
                          items={[
                            {
                              label: 'คัดลอกเบอร์โทร',
                              onClick: () => { navigator.clipboard?.writeText(r.phone ?? '').catch(() => {}) },
                            },
                            {
                              label: 'ค้นออเดอร์ของคนนี้',
                              onClick: () => { setQ(r.name ?? ''); load(0, r.name ?? '') },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white text-[12px] text-gray-600">
                <span>
                  แสดงแถวที่ {fmtNum(offset + 1)}–{fmtNum(offset + rows.length)}
                  {typeof data.total === 'number' && <> จาก {fmtNum(data.total)}</>}
                </span>
                <span className="flex gap-2">
                  <BtnGhost onClick={() => load(Math.max(0, offset - PAGE))} disabled={loading || offset === 0}>ก่อนหน้า</BtnGhost>
                  <BtnGhost
                    onClick={() => load(offset + PAGE)}
                    disabled={loading || (typeof data.total === 'number' && offset + rows.length >= data.total)}
                  >
                    ถัดไป
                  </BtnGhost>
                </span>
              </div>
            </TableWrap>
          )}

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            เลขประจำตัวผู้เสียภาษี<b>ถูกปิดบางส่วนมาจากเซิร์ฟเวอร์</b> (เห็น 4 ตัวท้าย) —
            จอนี้เห็นเลขเต็มไม่ได้เลยแม้แต่ในหน่วยความจำของเบราว์เซอร์ ·
            ชื่อในวงเล็บคือ<b>ชื่อสาขา</b>ตามที่ ZORT ส่งมา บางรายเป็นรหัสดิบอย่าง (1)
            เพราะต้นทางกรอกไว้แบบนั้น <b>ไม่ได้แต่งเพิ่ม</b>
            <br />
            ⚠️ ZORT มีคอลัมน์ให้ตั้งค่าเพิ่ม/ลด และแสดงป้าย Facebook ใต้ชื่อบางราย —
            ของเราไม่มีเพราะ<b>ตั้งใจไม่เก็บ 15 ฟิลด์นั้น</b> (facebook · line · ig · เพศ · วันเกิด · รูป)
            ซึ่งว่างแทบทั้งหมดและไม่มีจอไหนใช้ — <b>ฟิลด์ที่เก็บไว้เฉย ๆ คือความเสี่ยงเปล่า ๆ</b>
          </p>
        </>
      )}
    </div>
  )
}
