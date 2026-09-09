'use client'
// รายการขาย → แพ็คสินค้า (ปิดแถว 11)
//
// ✅ ได้ภาพจอ ZORT แล้ว 7 ก.ย. 2569 (`zort-ui/86`) — ของจริงเป็น **wizard แพ็คทีละใบ 3 ขั้น**
//    ⇒ ลอกผังไว้ที่ `/core/packing/pack` (ปุ่ม "เริ่มแพ็คสินค้า" ข้างบน)
//    จอนี้ (รายการงานค้าง) เป็นของที่เราเพิ่มเอง — ZORT ไม่มีจอสรุปว่าค้างกี่ใบ
//    เก็บไว้ทั้งคู่: จอนี้ตอบ "วันนี้ต้องแพ็คใบไหน" · wizard ตอบ "ใบนี้หยิบครบยัง"
//
// คำถามเดียวของจอนี้: **วันนี้ต้องแพ็คใบไหนบ้าง**
// = ใบที่ลูกค้า**จ่ายแล้ว** แต่ใบยัง**ไม่จบ** (ยังไม่ได้ส่ง) ⇒ งานค้างจริงของร้าน
//
// 🔴 **จอนี้ไม่ทำอะไรกับข้อมูล — มีหน้าที่เดียวคือทำให้เห็นว่ามีงานค้างกี่ใบ**
//    ไม่มีปุ่ม "ทำเครื่องหมายว่าแพ็คแล้ว" เพราะสถานะจริงอยู่ที่ ZORT
//    ปุ่มที่กดแล้วเปลี่ยนแค่ในจอเรา = จอสองใบที่ไม่ตรงกัน แล้วคนเชื่อใบผิด
//
// ⚠️ ท่อ `?pending=1` แยกกองมาให้แล้ว 3 กอง — จอนี้ใช้แค่กอง **"ต้องส่งของ"**
//    (อีกสองกองคือ "รอจ่ายอยู่" กับ "ใบผี" ซึ่งเป็นงานคนละเรื่อง อยู่ในจอรายการขาย)
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { findOrderId } from '@/lib/open-order'
import { fmtMoney, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { SKIP, isSkip } from '@/components/ui/ErrorBox'
import {
  PageHead, BtnGhost, SearchRow, LinkText, Tabs, TableWrap, TH, THR, TD, TDR,
  EmptyState, ChannelTag, thaiDate, Pill,
} from '@/components/zort'

interface Job {
  number: string; channel: string; day: string; amount: number
  status?: string; pay?: string; channelLastOrder?: string
}
interface Resp {
  counts?: Record<string, number>
  amounts?: Record<string, number>
  /** วันตัดว่า "ช่องทางเงียบไปแล้ว" — ท่อคิดให้ ⇒ จอห้ามคิดเอง */
  dormantCutoff?: string
  today?: string
  note?: string
  error?: string
  skip?: string
  ['ต้องส่งของ']?: Job[]
}

/** ค้างมากี่วัน — คิดสดจากวันไทย
 *  ⚠️ นี่คือ **อายุ** ไม่ใช่เส้นตาย ⇒ เทียบต้นวันถูกแล้ว (ได้เลขมากสุด = เตือนเร็วกว่าจริง)
 *     ห้ามแก้เป็นสิ้นวันตามจอบริษัท/ร้านค้า — คนละความหมาย ทิศของความผิดกลับด้าน
 *     (บทเรียน 6 ก.ย. 2569: โค้ดรูปเดียวกัน ความถูกต้องกลับด้าน) */
function ageDays(iso?: string): number | null {
  if (!iso || typeof iso !== 'string') return null
  const t = new Date(`${iso}T00:00:00+07:00`).getTime()
  if (!Number.isFinite(t)) return null
  const d = Math.floor((Date.now() - t) / 86400000)
  return d >= 0 ? d : 0
}

/** ยิ่งค้างนาน ยิ่งต้องเห็นชัด — ลูกค้าจ่ายเงินแล้วรออยู่ */
function ageTone(d: number | null): 'green' | 'orange' | 'red' | 'gray' {
  if (d === null) return 'gray'
  if (d >= 3) return 'red'
  if (d >= 1) return 'orange'
  return 'green'
}

export default function PackingPage() {
  const router = useRouter()
  const [d, setD] = useState<Resp | null>(null)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [opening, setOpening] = useState('')
  const [openErr, setOpenErr] = useState<{ number: string; msg: string } | null>(null)

  /** เปิดใบขายจากเลขที่ใบ — ต้องหา id จริงก่อน เพราะ id = `<ร้าน>/<เลขที่ใบ>`
   *  ⚠️ สามสถานะ ห้ามยุบ: หาไม่เจอ · เจอหลายใบ (คนละร้านเลขซ้ำกันได้) · ท่อล่ม
   *     ทั้งสามต้องบอกตรง ๆ ตรงแถวนั้น ห้ามพาไปหน้าที่เขียนว่าไม่พบแล้วให้คนเดาเอง */
  const openOrder = useCallback(async (number: string) => {
    setOpening(number); setOpenErr(null)
    const r = await findOrderId(number)
    if (r.ok) router.push(`/core/sales/detail?id=${encodeURIComponent(r.id)}`)
    else setOpenErr({ number, msg: r.msg })
    setOpening('')
  }, [router])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r: Resp = await fetch('/api/web/core?pending=1').then((x) => x.json())
      if (r?.error) throw new Error(r.error)
      if (r?.skip) throw new Error(SKIP + r.skip)
      /* 🔴 **ตอบ 200 แต่ไม่มีช่องที่จอนี้ต้องใช้ = ยังไม่รู้ ไม่ใช่ "แพ็คครบแล้ว"**
         เจอด้วยท่อปลอมโหมดตอบ {} เปล่า ๆ (6 ก.ย. 2569): จอขึ้น
         "ต้องแพ็คและส่ง 0 ใบ · 📦 ไม่มีใบค้างส่ง — แพ็คครบแล้ว" **โดยไม่มีกล่องแดงสักอัน**
         ⇒ ใบที่ลูกค้าจ่ายแล้วนอนค้างอยู่จริง แต่จอบอกว่าส่งครบ — ไม่มีใครไปตามต่อ
         ⚠️ ต้องเช็ค "มีช่องนั้นไหม" ไม่ใช่ "ในช่องนั้นมีของไหม" (ว่างจริงก็มีช่องอยู่) */
      if (!r || !('ต้องส่งของ' in r)) {
        throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มีรายการงานค้าง) — ยังสรุปไม่ได้ว่าแพ็คครบหรือยัง')
      }
      setD(r)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setD(null)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const jobs = useMemo(() => {
    const raw = d?.['ต้องส่งของ']
    return Array.isArray(raw) ? raw : []
  }, [d])

  /** ⚠️ จัดกลุ่มตามอายุ ไม่ใช่ตามช่องทาง — คนแพ็คของถามว่า "อันไหนช้าสุด" ไม่ได้ถามว่า "มาจากไหน" */
  const late = jobs.filter((j) => (ageDays(j.day) ?? 0) >= 3)
  const soon = jobs.filter((j) => { const a = ageDays(j.day) ?? 0; return a >= 1 && a < 3 })
  const today = jobs.filter((j) => (ageDays(j.day) ?? 0) === 0)

  const inTab = tab === 'late' ? late : tab === 'soon' ? soon : tab === 'today' ? today : jobs
  const needle = q.trim().toLowerCase()
  const rows = [...(needle
    ? inTab.filter((j) => String(j.number ?? '').toLowerCase().includes(needle)
      || String(j.channel ?? '').toLowerCase().includes(needle))
    : inTab)].sort((a, b) => (ageDays(b.day) ?? 0) - (ageDays(a.day) ?? 0))

  const totalAmount = jobs.reduce((s, j) => s + (Number(j.amount) || 0), 0)

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="แพ็คสินค้า"
        summary={
          /* 🔴 ล้มเหลวแล้วห้ามโชว์จำนวน — คนกวาดตาผ่านหัวจอจะอ่านว่า "ไม่มีงานค้าง"
             ทั้งที่ความจริงคือดึงไม่ได้ (คลาสเดียวกับที่เจอในจอใบคืนของ 6 ก.ย. 2569) */
          error ? (isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้ — ดูเหตุผลข้างล่าง' : 'ดึงข้อมูลไม่สำเร็จ — ดูรายละเอียดข้างล่าง')
            : loading ? 'กำลังโหลด…'
            : (
              <>
                ต้องแพ็คและส่ง <b>{fmtNum(jobs.length)}</b> ใบ · รวม {fmtMoney(totalAmount)}
                {' | '}
                <span className="text-gray-400">
                  ใบที่ลูกค้าจ่ายแล้วแต่ยังไม่ได้ส่ง — <b>ลูกค้ารออยู่จริง</b>
                </span>
              </>
            )
        }
        actions={
          <div className="flex items-center gap-2">
            {/* ผัง ZORT: เมนูแพ็คสินค้าเปิด wizard แพ็คทีละใบ — ของเราแยกไว้ที่ /pack */}
            <Link href="/core/packing/pack"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              เริ่มแพ็คสินค้า
            </Link>
            <BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
          </div>
        }
      />

      {error && <ErrorBox title="ดึงงานค้างไม่ได้">{error}</ErrorBox>}
      {loading && !d && <LoadingState />}

      {!loading && !error && d && (
        <>
          {/* 🔴 **แสดงอีกสองกองที่ท่อคำนวณให้ แต่ไม่มีจอไหนเคยแสดง** (เจอ 6 ก.ย. 2569
              ตอนไล่เทียบคีย์ที่ท่อส่ง vs คีย์ที่จออ่าน)
              ⚠️ ของเดิมจอนี้เขียนว่า "ดูที่จอรายการขาย" ซึ่ง **เป็นคำแนะนำที่พาไปไม่ถึง**
                 จอนั้นไม่ได้แยกกองแบบนี้ คนต้องไปเดาตัวกรองเอง
              ⚠️ ตัวเลข "ใบผี" สำคัญกว่าที่เห็น: มันคือใบที่ยังนับรวมอยู่ในยอดค้างจ่าย
                 ทั้งที่ไม่มีวันได้เงิน ⇒ ใครเอายอดค้างจ่ายไปคิดเป็นรายได้ที่จะเข้า จะสูงเกินจริง */}
          {/* ⚠️ **ไม่มีช่อง counts มาเลย = ยังไม่รู้ ไม่ใช่ "ไม่มีใบผี"**
              ของเดิมกล่องนี้จะ **หายไปทั้งกล่อง** ⇒ คำเตือนที่สำคัญที่สุดของจอนี้เงียบหายไป
              โดยจอยังดูปกติทุกประการ (เป็นคลาส "ตาข่ายหายเงียบ" ที่เราไล่ฆ่ากันทั้งคืน) */}
          {!d.counts && (
            <p className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
              ⚠️ เซิร์ฟเวอร์ไม่ได้ส่งยอดแยกกองมา — <b>ยังบอกไม่ได้ว่ามี &ldquo;ใบผี&rdquo; กี่ใบ</b>
              {' '}(ใบที่ยังนับรวมในยอดค้างจ่ายทั้งที่ไม่มีวันได้เงิน) · อย่าเพิ่งสรุปว่าไม่มี
            </p>
          )}
          {(d.counts?.['รอจ่ายอยู่'] || d.counts?.['ใบผี']) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="bg-white border border-gray-200 rounded-md px-3.5 py-2.5">
                <p className="text-[12px] text-gray-500">รอจ่ายอยู่ — ยังไม่จ่าย แต่ช่องทางยังขายอยู่</p>
                <p className="text-[14px] text-gray-800 mt-0.5">
                  <b>{fmtNum(d.counts?.['รอจ่ายอยู่'] ?? 0)}</b> ใบ · {fmtMoney(d.amounts?.['รอจ่ายอยู่'] ?? 0)}
                  <span className="text-gray-400 text-[12px]"> — ยังมีโอกาสได้เงิน</span>
                </p>
              </div>
              <div className="bg-white border border-amber-200 rounded-md px-3.5 py-2.5">
                <p className="text-[12px] text-amber-800">ใบผี — ยังไม่จ่าย และช่องทางเงียบไปแล้ว</p>
                <p className="text-[14px] text-gray-800 mt-0.5">
                  <b>{fmtNum(d.counts?.['ใบผี'] ?? 0)}</b> ใบ · {fmtMoney(d.amounts?.['ใบผี'] ?? 0)}
                  <span className="text-amber-700 text-[12px]"> — ไม่มีวันได้เงิน</span>
                </p>
                <p className="text-[11.5px] text-gray-500 mt-1 leading-relaxed">
                  ยังไม่ได้ลบหรือยกเลิก ⇒ <b>ยังถูกนับรวมอยู่ในยอดค้างจ่าย</b>
                  {d.dormantCutoff && <> · เกณฑ์ &ldquo;ช่องทางเงียบ&rdquo; = ไม่มีบิลหลัง {thaiDate(d.dormantCutoff)}</>}
                </p>
              </div>
            </div>
          )}

          {late.length > 0 && (
            /* 🔴 ค้างเกิน 3 วันคือของที่ต้องรีบ — ต้องเห็นก่อนตาราง ไม่ใช่ซ่อนในแท็บ
               (กฎ warning-placement: คำเตือนที่ต้องกดถึงเห็น คือวางผิดที่) */
            <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
              🔴 <b>ค้างเกิน 3 วัน {fmtNum(late.length)} ใบ</b> — ลูกค้าจ่ายเงินแล้วและยังไม่ได้ของ
              {' '}(ใบเก่าสุดค้างมา <b>{fmtNum(Math.max(...late.map((j) => ageDays(j.day) ?? 0)))} วัน</b>)
            </div>
          )}

          {/* 🔴 **รายการถูกตัดแล้วไม่มีอะไรบอก** — ท่อส่ง counts มาต่างหากจากตัวรายการ
              และ **ไม่มีธงบอกว่ารายการถูกตัด** (เจอ 6 ก.ย. 2569: กอง "ใบผี" counts 170 แต่ส่งมา 50)
              ⇒ วันที่งานค้างเกินโควตา จอจะโชว์ครบตามที่ได้มา แล้วคนนับเองแล้วนึกว่าเห็นหมด
              ⚠️ กันไว้ที่จอ: ถ้า counts มากกว่าจำนวนแถวที่ได้ **ต้องประกาศ** ห้ามเงียบ */}
          {typeof d.counts?.['ต้องส่งของ'] === 'number' && d.counts['ต้องส่งของ'] > jobs.length && (
            <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
              ⚠️ <b>ตารางนี้ไม่ครบ</b> — ระบบบอกว่ามี {fmtNum(d.counts['ต้องส่งของ'])} ใบ
              แต่ส่งรายการมาให้ <b>{fmtNum(jobs.length)}</b> ใบ ⇒ <b>ที่เห็นไม่ใช่ทั้งหมด</b>
              {' '}(ยอดเงินข้างบนคิดจากที่เห็น จึงต่ำกว่าความจริง)
            </div>
          )}

          <SearchRow
            value={q}
            onChange={setQ}
            onSubmit={() => {}}
            placeholder="เลขที่ใบ หรือช่องทาง"
            advanced={<LinkText onClick={() => setQ('')}>ล้างคำค้น</LinkText>}
          />

          <Tabs
            tabs={[
              { id: 'all', label: 'ทั้งหมด', count: jobs.length },
              { id: 'late', label: 'ค้างเกิน 3 วัน', count: late.length },
              { id: 'soon', label: 'ค้าง 1–2 วัน', count: soon.length },
              { id: 'today', label: 'วันนี้', count: today.length },
            ]}
            active={tab}
            onChange={setTab}
          />

          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>เลขที่ใบ</th>
                  <th className={TH}>ช่องทาง</th>
                  <th className={TH}>วันที่สั่ง</th>
                  <th className={TH}>ค้างมา</th>
                  <th className={THR}>มูลค่า</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <EmptyState cols={6} icon="📦"
                    title={jobs.length === 0 ? 'ไม่มีใบค้างส่ง — แพ็คครบแล้ว' : 'ไม่พบใบในเงื่อนไขนี้'}
                    detail={jobs.length === 0
                      ? 'ทุกใบที่ลูกค้าจ่ายแล้วถูกส่งออกไปหมดแล้ว'
                      : 'ลองล้างคำค้นหรือกลับไปแท็บทั้งหมด'} />
                )}
                {rows.map((j, i) => {
                  const a = ageDays(j.day)
                  return (
                    <tr key={j.number} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                      <td className={`${TD} text-gray-400`}>{i + 1}</td>
                      <td className={TD}>
                        {/* 🔴 บั๊กที่แก้ 9 ก.ย. 2569: เดิมเป็น Link ส่ง `j.number` ไปเป็น id
                            แต่ `getOrder` ค้นด้วยคอลัมน์ `id` ซึ่งของจริงคือ `z1/<number>`
                            ⇒ กดแล้วได้ "ไม่พบใบนี้ในคลังเงา" **ทุกใบ** (พิสูจน์ด้วยการยิงสามแบบ)
                            ⚠️ เดา prefix เองไม่ได้ — `pending=1` ไม่ส่ง `source` มาด้วย
                               ใบของร้านที่สองจะพังอีกแบบโดยไม่มีอะไรฟ้อง
                            ⇒ หา id จริงตอนกด (ยิงครั้งเดียวต่อการกด ไม่ใช่ต่อแถว)
                            🗑️ ถ้าท่อเพิ่ม `id` ใน pending=1 เมื่อไหร่ ให้ตัดตัวหานี้ทิ้งแล้วกลับไปเป็น Link */}
                        <button type="button" onClick={() => openOrder(j.number)}
                          disabled={opening === j.number}
                          className="text-blue-600 hover:underline font-medium disabled:opacity-50">
                          {j.number}{opening === j.number && ' …'}
                        </button>
                        {openErr?.number === j.number && (
                          <span className="ml-2 text-[11px] text-red-700">{openErr.msg}</span>
                        )}
                      </td>
                      <td className={TD}><ChannelTag name={j.channel} /></td>
                      <td className={`${TD} whitespace-nowrap text-gray-600`}>{thaiDate(j.day)}</td>
                      <td className={TD}>
                        <Pill tone={ageTone(a)}>
                          {a === null ? 'ไม่ทราบ' : a === 0 ? 'วันนี้' : `${fmtNum(a)} วัน`}
                        </Pill>
                      </td>
                      <td className={TDR}>{fmtMoney(j.amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>

          <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
            ⚠️ <b>จอนี้อ่านอย่างเดียว ไม่มีปุ่มทำเครื่องหมายว่าแพ็คแล้วโดยตั้งใจ</b> —
            สถานะจริงอยู่ที่ ZORT ถ้ามีปุ่มที่เปลี่ยนแค่ในจอเรา จะได้จอสองใบที่ไม่ตรงกัน
            แล้วคนจะเชื่อใบผิด · ใบจะหายจากจอนี้เองเมื่อ ZORT ปิดใบ แล้วรอบซิงก์ถัดไปดูดกลับมา ·
            <b> เกณฑ์: จ่ายแล้วแต่ใบยังไม่จบ</b> (ท่อแยกกองมาให้ 3 กอง — อีกสองกองแสดงไว้ข้างบนแล้ว
            เป็นงานคนละเรื่องกับการแพ็คของ) ·
            ยังไม่มีภาพจอ ZORT ของเมนูนี้ จึงยังไม่ได้จัดผังตาม
          </p>
        </>
      )}
    </div>
  )
}
