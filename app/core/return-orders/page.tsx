'use client'
// รายการขาย → รับคืนสินค้า — **ลอกผังจาก `zort-ui/77-zort-รับคืนสินค้า-Buy-list-sttype1.jpg`**
//
// ⚠️ **URL ของ ZORT หลอก แต่เมนูไม่หลอก** — ภาพนั้น URL เป็น `/Buy/list?&sttype=1`
//    แต่แถบข้างไฮไลต์ "รับคืนสินค้า" ใต้กลุ่ม **รายการขาย** ⇒ จอนี้คือของกลุ่มขาย
//    (บทเรียน 6 ก.ย. 2569: ห้ามจับคู่จอจาก URL ต้องดูจากเมนูที่ไฮไลต์)
//
// ผัง ZORT: หัวจอ "รับคืนสินค้า" + "จำนวน N รายการ, มูลค่าทั้งหมด X บาท | ตรวจสอบการนับสินค้าเข้า"
//   · ปุ่ม นำเข้าไฟล์ (Excel) · สร้าง · ค้นหา + ค้นหาขั้นสูง
//   · คอลัมน์ # · วันที่ · รายการ (CN-…) · อ้างอิง · ลูกค้า · มูลค่า · สถานะ · ชำระเงิน · ⋮
//   · วันที่แสดงแบบ "เมื่อวานนี้" · ชื่อลูกค้าปิดบางส่วน (ZORT เองก็ปิด)
//
// 🔴 **คนละฐานกับจอ `/returns` เดิม — ห้ามเอาเลขสองจอมาเทียบหรือลบกัน**
//    จอนี้อ่าน **ใบคืนของ (CN-)** สดจาก ZORT · จอ `/returns` **คำนวณของคืนจากออเดอร์**
//    สองอย่างนี้คนละของ เลขไม่มีวันตรงกัน และไม่ได้แปลว่าฝั่งไหนผิด
//
// 🔴 **ห้ามรวมยอดจากแถวที่ดึงมาแล้วเรียกว่า "มูลค่าทั้งหมด"**
//    ท่อส่ง `total` (จำนวนใบทั้งหมดจาก ZORT) มาให้ แต่ **ไม่ได้ส่งยอดรวมทั้งหมด**
//    บวกเองจาก N แถวแรกแล้วเขียนว่า "ทั้งหมด" = เลขที่ต่ำกว่าความจริงเสมอ โดยไม่มีอะไรฟ้อง
//    (คลาสเดียวกับ "หน้าแรกไม่ใช่ตัวแทน" ที่เจอมาแล้วสามครั้ง) ⇒ เขียนกำกับว่าเป็นยอดของกี่ใบ
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, BtnGhost, SearchRow, LinkText, TableWrap, TH, THR, TD, TDR,
  EmptyState, Pill, relDay, thaiDate,
} from '@/components/zort'

interface Row {
  number?: string; reference?: string; customer?: string
  amount?: number; status?: string; warehouse?: string
  date?: string; paid?: string
}
interface Resp {
  ok?: boolean; rows?: Row[]; total?: number | null; live?: boolean
  error?: string
}

const LIMIT = 100
const DASH = <span className="text-gray-300">-</span>

/** ⚠️ ระบายสีจาก **ข้อความที่ตรงเป๊ะเท่านั้น** ห้ามใช้ตัวแปลสถานะของออเดอร์
 *  สถานะของคนละชนิดเอกสาร/คนละแพลตฟอร์ม ใช้คำซ้ำกันได้โดยมีความหมายคนละอย่าง
 *  (บทเรียน TikTok 6 ก.ย. — คำว่า COMPLETED ชนกับของ Shopee)
 *  ไม่รู้จัก = เทา แล้วโชว์ข้อความดิบ **ดีกว่าเดาสีผิด** */
function tone(s?: string): 'green' | 'orange' | 'red' | 'gray' {
  const t = (s ?? '').trim()
  if (t === 'สำเร็จ' || t === 'ชำระครบ') return 'green'
  if (t === 'ยกเลิก') return 'red'
  if (t === 'รอดำเนินการ' || t === 'ค้างชำระ') return 'orange'
  return 'gray'
}

export default function ReturnOrdersPage() {
  const [d, setD] = useState<Resp | null>(null)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /** ⚠️ เส้นยังไม่ขึ้นเว็บ ≠ ดึงไม่สำเร็จ ≠ ไม่มีใบสักใบ — สามอย่างนี้ต้องเขียนคนละคำ
   *     เส้นที่ยังไม่มีจะ **ตอบ 200 พร้อมเนื้อหาอื่น** ⇒ ตรวจรูปร่าง ไม่ใช่ดูแค่รหัส 200 */
  const [notDeployed, setNotDeployed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotDeployed(false)
    try {
      const r: Resp = await fetch(`/api/web/core?list=returnorders&limit=${LIMIT}`).then((x) => x.json())
      if (r?.error) throw new Error(r.error)
      if (!Array.isArray(r?.rows)) { setNotDeployed(true); setD(null); return }
      setD(r)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e)); setD(null)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const rows = Array.isArray(d?.rows) ? d!.rows! : []
  const needle = q.trim().toLowerCase()
  const shown = needle
    ? rows.filter((r) => [r.number, r.reference, r.customer].some(
      (v) => String(v ?? '').toLowerCase().includes(needle)))
    : rows
  const sumShown = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const total = typeof d?.total === 'number' ? d.total : null
  /** ดึงมาไม่ครบทั้งหมดหรือเปล่า — ใช้ตัดสินว่าจะเขียนยอดรวมแบบไหน */
  const partial = total !== null && rows.length < total

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="รับคืนสินค้า"
        summary={
          loading ? 'กำลังโหลด…'
            : (
              <>
                จำนวน <b>{total !== null ? fmtNum(total) : fmtNum(rows.length)}</b> รายการ
                {/* 🔴 ยอดรวมต้องประกาศขอบเขตตัวเองเสมอ ห้ามเขียนคำว่า "ทั้งหมด" ถ้าดึงมาไม่ครบ */}
                {rows.length > 0 && (
                  <>
                    {', '}
                    มูลค่า{partial ? `เฉพาะ ${fmtNum(rows.length)} ใบล่าสุด` : 'ทั้งหมด'}{' '}
                    <b>{fmtMoney(sumShown)}</b>
                  </>
                )}
                {' | '}
                <span className="text-gray-400">
                  ใบคืนของ (CN-) อ่านสดจาก ZORT — <b>คนละฐานกับหน้า &ldquo;สินค้าที่ถูกคืนบ่อย&rdquo;</b>
                </span>
              </>
            )
        }
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      {error && <ErrorBox title="ดึงใบคืนของไม่ได้">{error}</ErrorBox>}
      {loading && !d && <LoadingState />}

      {!loading && notDeployed && (
        <div className="text-[13px] text-amber-800 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 leading-relaxed">
          ⚠️ <b>เส้นอ่านใบคืนของยังไม่ขึ้นเว็บ</b> — จอนี้จะมีข้อมูลเองหลัง deploy รอบถัดไป
          <br />
          <b>ไม่ได้แปลว่าไม่มีใบคืนของ</b> — แปลว่ายังอ่านไม่ได้เท่านั้น
        </div>
      )}

      {!loading && !error && d && (
        <>
          {partial && (
            <div className="text-[12.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2 mb-3 leading-relaxed">
              แสดง <b>{fmtNum(rows.length)}</b> ใบล่าสุด จากทั้งหมด <b>{fmtNum(total!)}</b> ใบ —
              ยอดเงินข้างบนเป็นของ<b>เฉพาะที่ดึงมา</b> ไม่ใช่ยอดสะสมทั้งหมด
            </div>
          )}

          <SearchRow
            value={q}
            onChange={setQ}
            onSubmit={() => {}}
            placeholder="พิมพ์คำค้นหา"
            advanced={<LinkText onClick={() => setQ('')}>ล้างคำค้น</LinkText>}
          />

          <TableWrap>
            <table className="w-full min-w-[860px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>วันที่</th>
                  <th className={TH}>รายการ</th>
                  <th className={TH}>อ้างอิง</th>
                  <th className={TH}>ลูกค้า</th>
                  <th className={THR}>มูลค่า</th>
                  <th className={TH}>สถานะ</th>
                  <th className={TH}>ชำระเงิน</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <EmptyState cols={8} icon="↩️"
                    title={rows.length === 0 ? 'ยังไม่มีใบคืนของ' : 'ไม่พบใบในคำค้นนี้'}
                    detail={rows.length === 0
                      ? 'ZORT ตอบกลับมาว่าไม่มีใบคืนของสักใบ (ดึงสำเร็จ แต่ว่างจริง)'
                      : 'ค้นได้จาก เลขที่ใบ · เลขอ้างอิง · ชื่อลูกค้า'} />
                )}
                {shown.map((r, i) => (
                  <tr key={`${r.number}-${i}`} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={`${TD} text-gray-400`}>{i + 1}</td>
                    <td className={`${TD} whitespace-nowrap text-gray-600`} title={thaiDate(r.date)}>
                      {r.date ? relDay(r.date) : DASH}
                    </td>
                    <td className={`${TD} font-medium text-gray-800`}>{r.number || DASH}</td>
                    <td className={`${TD} text-gray-600`}>{r.reference || DASH}</td>
                    <td className={TD}>
                      {/* ⚠️ ชื่อถูกปิดบางส่วนมาจากท่อแล้ว — **ห้ามทำปุ่มขอชื่อเต็มในจอรายการ**
                          จอรายการมีไว้ "หาให้เจอ" ไม่ใช่ "อ่านชื่อทุกคน" (กติกาเดียวกับจอผู้ติดต่อ) */}
                      {r.customer || DASH}
                    </td>
                    {/* ⚠️ ไม่มีมูลค่า ≠ มูลค่า 0 — ท่ออาจไม่ส่งช่องนี้มา ต้องขึ้นขีด ไม่ใช่ ฿0 */}
                    <td className={TDR}>{typeof r.amount === 'number' ? fmtMoney(r.amount) : DASH}</td>
                    <td className={TD}>
                      {r.status ? <Pill tone={tone(r.status)}>{r.status}</Pill> : DASH}
                      {/* ZORT โชว์ชื่อโกดังเป็นบรรทัดย่อยใต้สถานะ */}
                      {r.warehouse && <div className="text-[11.5px] text-gray-400 mt-0.5">{r.warehouse}</div>}
                    </td>
                    <td className={TD}>{r.paid ? <Pill tone={tone(r.paid)}>{r.paid}</Pill> : DASH}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
            อ่านสดจาก ZORT ทุกครั้งที่เปิดจอ (ไม่ได้ผ่านคลังเงา) ·
            ชื่อลูกค้า<b>ถูกปิดบางส่วนมาจากเซิร์ฟเวอร์</b> — ZORT เองก็ปิดในจอนี้เหมือนกัน ·
            สถานะแสดง<b>ข้อความดิบจาก ZORT</b> ระบายสีเฉพาะคำที่ตรงเป๊ะ
            คำที่ไม่รู้จักขึ้นเทา (เดาสีผิดแย่กว่าไม่ระบายสี)
            <br />
            🔴 <b>คนละฐานกับหน้า</b>{' '}
            <Link href="/returns" className="text-blue-600 hover:underline">สินค้าที่ถูกคืนบ่อย</Link>{' '}
            ซึ่งคำนวณของคืนจากออเดอร์ — <b>เลขสองหน้าไม่มีวันตรงกัน และไม่ได้แปลว่าฝั่งไหนผิด</b>
            {' '}(หน้านั้นตอบคำถามที่จอนี้ตอบไม่ได้: ตัวไหนถูกคืนซ้ำ ๆ จนต้องไปแก้ที่ต้นทาง) ·
            ยังไม่มีปุ่ม &ldquo;สร้าง&rdquo; กับ &ldquo;นำเข้าไฟล์&rdquo; แบบ ZORT — เส้นสร้างใบคืนของมีอยู่จริง
            แต่<b>ยังไม่เคยยิงของจริง</b> (ดู{' '}
            <Link href="/core/zort-noapi" className="text-blue-600 hover:underline">ZORT เปิดให้ทำอะไรผ่าน API</Link>)
          </p>
        </>
      )}
    </div>
  )
}
