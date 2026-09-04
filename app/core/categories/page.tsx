'use client'
// หมวดหมู่สินค้า — **หมวดจริงจาก ZORT** ไม่ใช่หมวดที่เดาจากชื่อสินค้าอีกแล้ว
//
// **หน้าตาลอกจาก `zort-ui/26-zort-หมวดหมู่-42หมวด.jpg`**
// ผัง: ชื่อจอ → "จำนวน N รายการ" → ปุ่มขวาบน → ช่องค้นหา → แถบบอกที่มาของมูลค่า + ปุ่มอัพเดท
//      → ตาราง ชื่อหมวดหมู่ · จำนวน SKU · มูลค่าสินค้าคงเหลือ · มูลค่าสินค้าพร้อมขาย
//
// 💡 บทเรียนที่ทำให้หน้านี้เกิด: โค้ดฝั่งเซิร์ฟเวอร์เคยเขียนคอมเมนต์ไว้เองว่า
//    "ZORT ไม่มีหมวดหมู่ในข้อมูลสินค้า" แล้วทุกคนเชื่อตามนั้นมาตลอด
//    จนเจ้าของร้านสั่งให้ไปเปิดดูของจริง — **มันมีมาตั้งแต่แรก 42 หมวด**
//    เราสร้างของทดแทน (เดาจากชื่อ ครอบคลุม 52%) ที่แย่กว่าของจริงที่มีอยู่แล้ว
//    ⇒ **คำกล่าวอ้างว่า "ระบบต้นทางไม่มีข้อมูลนี้" ต้องไปเปิดดูก่อนเสมอ**
//
// ⚠️ **มูลค่าเทียบกับ ZORT ตรง ๆ ไม่ได้ และต้องเขียนบอกบนจอ**
//    ZORT ใช้ต้นทุนถัวเฉลี่ยเคลื่อนที่ (คิดจากประวัติการซื้อทุกครั้ง)
//    ของเรามีแค่ราคาซื้อตั้งต้นในทะเบียนสินค้า ⇒ ตัวเลขคนละความหมาย
//    ⚠️ ราคาขายบังเอิญใกล้เลข ZORT มากกว่าต้นทุน — **ห้ามเลือกอันนั้นเพราะมันใกล้กว่า**
//       ได้จอที่หน้าตาเหมือนแต่ตัวเลขคนละเรื่อง แล้วคนที่เอาไปเทียบจะเชื่อว่าตรงกัน
//       **ใกล้ไม่ใช่เหมือน**
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, EmptyState, RowMenu } from '@/components/zort'

interface Row {
  name: string
  skus: number
  /** 🟢 ค่าที่ **คัดมาจากจอ ZORT ของจริง** (ต้นทุนเฉลี่ยถ่วงน้ำหนัก ซึ่ง API ไม่เปิดให้ดึง)
   *  ⚠️ เป็นค่าที่ "คัดมา" ไม่ใช่ "คิดเอง" ⇒ ซื้อของเข้าใหม่แล้วจะเก่าจนกว่าจะคัดใหม่
   *     ต้องโชว์วันที่คัดควบไปเสมอ (กติกาเดียวกับสูตรสินค้าชุด) */
  zortValue?: number | null
  zortAvailable?: number | null
  zortSkus?: number | null
  onhand_value?: number
  available_value?: number
  onhand_value_sell?: number
  available_value_sell?: number
  no_cost?: number
  services?: number
  zort?: boolean
}
interface Resp {
  zortCollectedAt?: string
  zortTotalValue?: number
  zortCategories?: number
  categories?: number
  total?: number
  uncategorised?: number
  noCost?: number
  valueBasis?: string
  matchesZort?: boolean
  rows?: Row[]
}

/** เฉดสีจริงของ ZORT — อ่านค่าจาก DOM ของเขา ไม่ได้เทียบด้วยตาจากภาพ
 *  ⚠️ ใช้ค่าตรง ๆ ไม่ใช้สีสำเร็จของ Tailwind เพราะ emerald-600/red-500 ใกล้แต่ไม่เท่า
 *     กฎของเจ้าของร้านคือ "เหมือน 100%" — และ **ใกล้ไม่ใช่เหมือน** */
const ZORT_GREEN = 'rgb(19,175,130)'
const ZORT_RED = 'rgb(242,87,87)'

export default function CoreCategoriesPage() {
  const router = useRouter()
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  /** มูลค่าคิดจากอะไร — สามแบบ
   *  `zort` = ต้นทุนเฉลี่ยที่คัดมาจากจอ ZORT (**ตรงกับ ZORT เป๊ะ** — ตั้งเป็นค่าเริ่มต้น
   *           เพราะเป็นเลขที่เจ้าของร้านเอาไปใช้กับบัญชีจริง)
   *  `cost` = ราคาซื้อในทะเบียนสินค้าของเรา — **ต่ำกว่าความจริง 2-3 เท่า** พิสูจน์แล้ว
   *  `sell` = ราคาขาย */
  const [basis, setBasis] = useState<'zort' | 'cost' | 'sell'>('zort')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/web/core?list=categories')
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      setD(j)
    } catch (e) {
      setD(null) // ไม่โชว์ของค้าง
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    const all = Array.isArray(d?.rows) ? d!.rows! : []
    const s = q.trim().toLowerCase()
    return s ? all.filter((r) => (r.name || '').toLowerCase().includes(s)) : all
  }, [d, q])

  const onhandOf = (r: Row) => (
    basis === 'zort' ? (r.zortValue ?? undefined)
      : basis === 'cost' ? r.onhand_value : r.onhand_value_sell
  )
  const availOf = (r: Row) => (
    basis === 'zort' ? (r.zortAvailable ?? undefined)
      : basis === 'cost' ? r.available_value : r.available_value_sell
  )

  /** สีของตัวเลขมูลค่าใน ZORT — **ไม่ใช่แดงตลอดอย่างที่เราเคยทำ**
   *  ฝั่งเซิร์ฟเวอร์อ่านค่าสีจาก DOM ของ ZORT จริงมาให้ ตรงกัน 10/10 แถว:
   *    เขียว rgb(19,175,130) เมื่อ **คงเหลือ = พร้อมขาย** (รวมกรณี 0/0)
   *    แดง  rgb(242,87,87)  เมื่อ **ต่างกัน** = มีของถูกจองไว้ในออเดอร์ที่ยังไม่ตัด
   *  ⚠️ สีจึงมีความหมาย ไม่ใช่ของตกแต่ง — ทำแดงหมดคือทิ้งข้อมูลไปหนึ่งชั้น */
  const val = (n?: number, same?: boolean) => {
    if (typeof n !== 'number') return <span className="text-gray-300">—</span>
    return <span style={{ color: same ? ZORT_GREEN : ZORT_RED }}>{fmtMoney(n)}</span>
  }

  // แถวพิเศษที่ ZORT ไม่มี — สินค้าที่ยังไม่ได้จัดหมวดในระบบเขา
  const extraBucket = rows.some((r) => r.name?.includes('ยังไม่ได้จัดหมวด'))
  const totalSkus = rows.reduce((a, r) => a + (Number(r.skus) || 0), 0)
  const totalOnhand = rows.reduce((a, r) => a + (Number(onhandOf(r)) || 0), 0)
  const guessed = rows.filter((r) => r.zort === false).length

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="หมวดหมู่"
        summary={
          d
            ? (
              <>
                {/* ⚠️ **หัวจอต้องนับให้ตรงกับจำนวนแถวที่เห็น** — เดิมเขียน "42 รายการ"
                    แต่ในตารางมี 43 แถว เพราะมีกลุ่ม "(ยังไม่ได้จัดหมวดใน ZORT)" 139 SKU
                    ซึ่ง **ถูกต้องที่จะมี** (เป็นของจริงที่ ZORT ซ่อนไว้) แต่คนนับแล้วงง
                    ⇒ เขียนแยกให้ชัด · คง "42" ไว้เพราะนั่นคือเลขที่คนเอาไปเทียบกับ ZORT */}
                จำนวน {fmtNum(d.categories ?? 0)} หมวด
                {extraBucket && <> + 1 กลุ่มที่ยังไม่ได้จัดหมวด</>}
              </>
            )
            : 'กำลังโหลด…'
        }
        actions={
          <>
            <BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
            {/* ZORT มีสองปุ่มนี้ — พาไปหน้าที่บอกว่ายังไม่ได้ทำ ไม่ทำปุ่มหลอก */}
            <Link href="/core/soon/product-import"
              className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
              นำเข้าไฟล์ (Excel)
            </Link>
            <Link href="/core/soon/category-add"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#4669e5' }}>
              เพิ่มหมวดหมู่
            </Link>
          </>
        }
      />

      <div className="mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหา"
          className="w-full max-w-[320px] text-[13px] border border-gray-300 rounded px-3 py-2 outline-none focus:border-blue-400"
        />
      </div>

      {error && <ErrorBox title="ดึงหมวดหมู่ไม่ได้">{error}</ErrorBox>}
      {loading && !d && <LoadingState />}

      {d && (
        <>
          {/* แถบเทาบอกที่มาของมูลค่า — ZORT มีแถบนี้พร้อมปุ่มอัพเดทมุมขวา */}
          <div className="bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 flex flex-wrap items-center gap-3">
            <p className="text-[12.5px] text-gray-700 min-w-0 flex-1">
              มูลค่าสินค้าคงเหลือ, มูลค่าสินค้าพร้อมขาย · คิดจาก
              <b>
                {basis === 'zort' ? 'ต้นทุนเฉลี่ยถ่วงน้ำหนัก (คัดมาจากจอ ZORT)'
                  : basis === 'cost' ? 'ราคาซื้อในทะเบียนสินค้า' : 'ราคาขาย'}
              </b>
              {/* ⚠️ ค่าที่คัดมาต้องโชว์วันที่คัดเสมอ — ไม่งั้นคนอ่านนึกว่าเป็นค่าสด
                  ซื้อของเข้าใหม่แล้วเลขนี้จะเก่าทันทีโดยไม่มีอะไรฟ้อง */}
              {basis === 'zort' && d.zortCollectedAt && (
                <span className="text-gray-500"> · คัดมาเมื่อ {d.zortCollectedAt}</span>
              )}
              {/* ⚠️ ZORT เขียน "วันที่อัพเดทล่าสุด: 2 ก.ย. 2026 08:33" ตรงนี้ + ปุ่มอัพเดท
                  ของเราไม่มีเวลานั้นให้แสดง เพราะเลขคิดสดจากทะเบียนสินค้าในคลังเงาทุกครั้งที่เปิดจอ
                  ⇒ เขียนความจริงแทนการใส่เวลาปลอมให้หน้าตาเหมือน */}
              {/* ✅ **เจ้าของร้านเลือกเองแล้ว 3 ก.ย. 2569: เก็บปุ่มสลับของเราไว้**
                  ZORT ตรงนี้เป็น "วันที่อัพเดทล่าสุด + ปุ่มอัพเดท" — เป็นข้อยกเว้นของกฎ
                  "เหมือน 100%" ที่เจ้าของร้านสั่งเอง (กรณีเดียวกับจอการเงินที่เขาให้เก็บของเราไว้)
                  ⚠️ ห้ามเปลี่ยนกลับให้เหมือน ZORT โดยไม่ถามเขาก่อน */}
              <span className="block text-[11.5px] text-gray-500 mt-0.5">
                คิดสดจากทะเบียนสินค้าในคลังเงาทุกครั้งที่เปิดจอ — ไม่ใช่ภาพถ่ายสต็อกรายวัน
                จึงไม่มี &quot;วันที่อัพเดทล่าสุด&quot; แบบ ZORT · ปุ่มสลับวิธีคิดมูลค่าเป็นของเราเอง
                (เจ้าของร้านเลือกให้เก็บไว้ เพราะต้นทุนกับราคาขายต่างกันหลักสิบล้าน)
              </span>
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setBasis('zort')}
                className={`text-[12px] rounded-full px-3 py-1 border ${
                  basis === 'zort' ? 'bg-white border-gray-400 text-gray-800 font-semibold' : 'border-transparent text-gray-500'
                }`}
              >
                ต้นทุนเฉลี่ย (ตรงกับ ZORT)
              </button>
              <button
                onClick={() => setBasis('cost')}
                className={`text-[12px] rounded-full px-3 py-1 border ${
                  basis === 'cost' ? 'bg-white border-gray-400 text-gray-800 font-semibold' : 'border-transparent text-gray-500'
                }`}
              >
                ตามต้นทุน
              </button>
              <button
                onClick={() => setBasis('sell')}
                className={`text-[12px] rounded-full px-3 py-1 border ${
                  basis === 'sell' ? 'bg-white border-gray-400 text-gray-800 font-semibold' : 'border-transparent text-gray-500'
                }`}
              >
                ตามราคาขาย
              </button>
            </div>
          </div>

          {/* ⚠️ ข้อความนี้ห้ามถอด — ตัวเลขหน้าตาเหมือน ZORT แต่คิดคนละวิธี
              ไม่บอก = คนเอาไปเทียบแล้วเชื่อว่าตรงกัน ทั้งที่ต่างกันหลักแสน */}
          {basis === 'zort' && d.matchesZort && (
            <div className="text-[12.5px] text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
              ✅ <b>ตัวเลขชุดนี้ตรงกับ ZORT</b> — เป็นต้นทุนเฉลี่ยถ่วงน้ำหนักที่<b>คัดมาจากจอ ZORT</b>
              {typeof d.zortTotalValue === 'number' && <> · รวมทุกหมวด <b>{fmtMoney(d.zortTotalValue)}</b> บาท</>}
              {d.zortCollectedAt && <> · คัดเมื่อ {d.zortCollectedAt}</>}
              <br />
              ⚠️ <b>เป็นค่าที่คัดมา ไม่ใช่คิดเอง</b> — ซื้อของเข้าใหม่แล้วเลขนี้จะเก่าจนกว่าจะคัดใหม่
              {' '}(ปีนี้มีใบซื้อใบเดียว 10 มี.ค. จึงแทบไม่ขยับ) · หมวด
              {' '}<b>&quot;(ยังไม่ได้จัดหมวดใน ZORT)&quot;</b> ไม่มีค่าคัดมา เพราะ ZORT ไม่มีแถวนั้น
              <br />
              ⚠️ <b>ราคาซื้อในทะเบียนของเราต่ำกว่าต้นทุนจริง 2-3 เท่า</b> (อะไหล่ 7800 Turbo:
              เรา ฿236,399 · ZORT ฿750,957) ⇒ กดดู &quot;ตามต้นทุน&quot; ได้ แต่<b>อย่าเอาไปใช้กับบัญชี</b>
            </div>
          )}

          {basis !== 'zort' && d.matchesZort === false && (
            <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 mb-3 leading-relaxed">
              ⚠️ <b>มูลค่ายังเทียบกับ ZORT ตรง ๆ ไม่ได้</b> — ZORT ใช้ต้นทุนถัวเฉลี่ยเคลื่อนที่
              ซึ่งคิดจากประวัติการซื้อทุกครั้ง ส่วนเรามีแค่ราคาซื้อตั้งต้นในทะเบียนสินค้า
              ⇒ ใช้ดู<b>สัดส่วนระหว่างหมวด</b>ได้ แต่อย่าเอาตัวเลขไปเทียบกับ ZORT ทีละบาท
              {typeof d.noCost === 'number' && d.noCost > 0 && (
                <> · มีสินค้า <b>{fmtNum(d.noCost)}</b> ตัวที่ยังไม่ได้กรอกราคาซื้อ จึงคิดเป็น 0</>
              )}
            </div>
          )}

          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH}>ชื่อหมวดหมู่</th>
                  <th className={THR}>จำนวน SKU</th>
                  <th className={THR}>มูลค่าสินค้าคงเหลือ</th>
                  <th className={THR}>มูลค่าสินค้าพร้อมขาย</th>
                  <th className={TH} style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  q
                    ? <EmptyState cols={5} icon="🔍" title="ไม่พบหมวดหมู่ที่ค้นหา" detail="ลองพิมพ์คำสั้นลง" />
                    : <EmptyState cols={5} icon="🗂️" title="ยังไม่มีหมวดหมู่"
                        detail="หมวดหมู่ดึงมาจาก ZORT — เพิ่มหมวดที่ ZORT แล้วรอบซิงก์ถัดไปจะเข้ามาเอง" />
                )}
                {rows.map((r) => (
                  <tr key={r.name} className="border-b border-[#e8ecf8] last:border-0 hover:bg-[#eef1fa]">
                    <td className={TD}>
                      {/* ⚠️ ไม่ทำสีฟ้า เพราะยังไม่มีหน้าปลายทางให้กด — สีฟ้าในตารางคือสัญญาว่ากดได้ */}
                      <span className="text-gray-800">{r.name}</span>
                      {/* ⚠️ หมวดที่ยัง "เดาจากชื่อสินค้า" ต้องดูออก — ไม่งั้นเข้าใจว่าทุกหมวดมาจาก ZORT */}
                      {r.zort === false && (
                        <span className="ml-1.5 text-[10.5px] text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">
                          เดาจากชื่อสินค้า
                        </span>
                      )}
                      {Number(r.no_cost) > 0 && (
                        <span className="ml-1.5 text-[10.5px] text-amber-800 bg-amber-100 rounded px-1.5 py-0.5">
                          ไม่มีราคาซื้อ {fmtNum(Number(r.no_cost) || 0)}
                        </span>
                      )}
                    </td>
                    {/* เลขจำนวน SKU ของ ZORT เป็นสีเขียวเสมอ ไม่ขึ้นกับเงื่อนไขอะไร */}
                    {/* ⚠️ ZORT ส่งจำนวน SKU มาด้วย — ถ้าไม่ตรงกับของเราต้องเห็นทันที
                        ไม่ตรง = กระจกสินค้าขาดหรือเกินในหมวดนั้น ซึ่งเป็นเรื่องใหญ่กว่ามูลค่า */}
                    <td className={TDR} style={{ color: ZORT_GREEN }}>
                      {fmtNum(r.skus)}
                      {typeof r.zortSkus === 'number' && r.zortSkus !== r.skus && (
                        <span className="block text-[10.5px] text-amber-700" title="จำนวนใน ZORT ไม่ตรงกับคลังเงา">
                          ZORT {fmtNum(r.zortSkus)}
                        </span>
                      )}
                    </td>
                    <td className={TDR}>
                      {basis === 'zort' && r.zortValue == null
                        // ⚠️ ไม่มีค่าคัดมา ≠ มูลค่าศูนย์ — ต้องขีด ห้ามโชว์ 0
                        ? <span className="text-gray-300" title="ZORT ไม่มีหมวดนี้ จึงไม่มีค่าให้คัด">—</span>
                        : val(onhandOf(r), onhandOf(r) === availOf(r))}
                    </td>
                    <td className={TDR}>
                      {basis === 'zort' && r.zortAvailable == null
                        ? <span className="text-gray-300">—</span>
                        : val(availOf(r), onhandOf(r) === availOf(r))}
                    </td>
                    <td className={`${TD} text-right`}>
                      <RowMenu
                        items={[
                          {
                            label: 'คัดลอกชื่อหมวดหมู่',
                            onClick: () => { navigator.clipboard?.writeText(r.name ?? '').catch(() => {}) },
                          },
                          { label: 'เปิดใน POS', onClick: () => router.push('/core/pos') },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-gray-200 bg-white text-[12px] text-gray-600">
              <span>
                รวม {fmtNum(rows.length)} หมวด · {fmtNum(totalSkus)} SKU · มูลค่าคงเหลือรวม {fmtMoney(totalOnhand)}
              </span>
              {guessed > 0 && <span className="text-gray-400">มี {fmtNum(guessed)} หมวดที่เดาจากชื่อสินค้า</span>}
            </div>
          </TableWrap>

          {/* ⚠️ เรื่องลำดับ + ดาว — ตอนนี้เรารู้ "เหตุผลจริง" แล้ว ไม่ใช่แค่ "ไม่มีข้อมูล"
              เปิดเมนู ⋮ ใน ZORT เทียบสองแถว: มีดาว → "ถอนหมุดจากบนสุด" · ไม่มีดาว → "ปักหมุดไว้บนสุด"
              ⇒ ดาว = หมวดที่ปักหมุด และนั่นคือเหตุผลที่ ZORT เรียง โซ่ → บาร์ → เลื่อยยนต์ → อะไหล่
                 ไม่ใช่ลำดับที่ตั้งเอง · ข้อมูลนี้ไม่มีใน API (ไม่มี Category endpoint เลยสักตัว)
              ⇒ **ห้ามใส่ดาวมั่ว และห้ามเดาลำดับให้เหมือน** */}
          <div className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mt-2 leading-relaxed">
            <b>ทำไมลำดับไม่ตรงกับ ZORT</b> — ที่ ZORT เรียง โซ่ → บาร์ → เลื่อยยนต์ แล้วค่อยอะไหล่
            เพราะ 12 หมวดแรกถูก <b>ปักหมุดไว้บนสุด</b> (ดาวเหลืองหน้าชื่อ) ไม่ใช่ลำดับที่ตั้งค่าไว้ ·
            การปักหมุดเป็นข้อมูลที่ <b>API ไม่เปิดให้ดึง</b> (ZORT ไม่มี endpoint หมวดหมู่เลยสักตัว)
            ⇒ จอนี้เรียงตามจำนวน SKU มากไปน้อยแทน และ<b>ไม่ใส่ดาว</b>
            เพราะใส่โดยไม่รู้ว่าหมวดไหนถูกปักหมุดจริงคือการเดา
          </div>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            หมวดหมู่ชุดนี้<b>ดึงมาจาก ZORT ของจริง</b> ไม่ใช่หมวดที่เดาจากชื่อสินค้าเหมือนก่อน ·
            {typeof d.uncategorised === 'number' && (
              <> สินค้าที่ ZORT ยังไม่ได้จัดหมวด <b>{fmtNum(d.uncategorised)}</b> ตัว
                ระบบเดาหมวดให้จากชื่อ (แถวที่มีป้าย &quot;เดาจากชื่อสินค้า&quot;)</>
            )}
            <br />
            แก้หมวดที่นี่ไม่มีผลกับ ZORT และแก้ที่ ZORT จะเข้ามาที่นี่ในรอบซิงก์ถัดไป
          </p>
        </>
      )}
    </div>
  )
}
