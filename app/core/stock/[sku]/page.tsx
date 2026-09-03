'use client'
// รายละเอียดสินค้า — **ลอกจาก `zort-ui/34-zort-รายละเอียดสินค้า.jpg`**
// ผัง ZORT: breadcrumb "‹ สินค้า" → หัวข้อ "รายละเอียดสินค้า <ชื่อเต็ม>" → Share Link มุมขวา
//   → ปุ่ม 7 ปุ่ม (แก้ไข · ลบ · คำสั่ง▾ · ปรับจำนวน · พิมพ์เอกสาร · อัพเดทช่องทางอื่น▾ · ดูกิจกรรม)
//   → การ์ด 3 ใบ (สินค้าคงเหลือ · สินค้าพร้อมขาย · ยอดขายเดือนนี้)
//   → กล่องข้อมูล: รูปซ้าย · ขวาสองคอลัมน์ (รหัสสินค้า · ต้นทุนคงเหลือเฉลี่ย · สินค้าในสินค้าเป็นชุด
//     | ราคาขาย · ราคาซื้อ)
//   → การ์ด "ยอดขาย" (กราฟ) · การ์ด "จำนวนสินค้าคงเหลือ รายคลัง" · การ์ด "รายงาน" (stock card)
//
// 🔴 **หน้านี้เกิดเพราะบั๊กที่เจ็บที่สุดของวัน: ชื่อสินค้าในตารางเป็นสีฟ้าแต่กดไม่ได้**
//    เจ้าของร้านกดจากมือถือ 5 จุดแล้วรายงานว่า "กดเข้าสินค้าไม่ได้เลย"
//    **สีฟ้าในตาราง = สัญญาว่ากดได้** — จอกำลังบอกว่ามีทั้งที่ไม่มี
//    ⇒ กลับด้านกับกรณี ZZFAKE999 ที่ซ่อนแล้วบอกว่าซ่อน · อันนี้โชว์ว่ากดได้ทั้งที่กดไม่ได้
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { fmtMoney, fmtNum } from '@/lib/format'
import Card from '@/components/ui/Card'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { useSkuImages } from '@/lib/sku-images'
import {
  PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, EmptyState, thaiDate, MarketLogos,
} from '@/components/zort'

interface Row {
  sku: string; name: string; qty: number; price: number; sold: number
  buy?: number | null; available?: number | null; unit?: string | null
  service?: boolean; active?: boolean | null; marketplaces?: string[]
}
interface Move {
  id?: number; sku: string; qty: number; reason: string; ref?: string; at?: string
}
interface MovesResp { rows?: Move[]; reasons?: Record<string, string>; total?: number }

export default function ProductDetailPage() {
  const params = useParams<{ sku: string }>()
  const sku = decodeURIComponent(String(params?.sku ?? ''))
  const [row, setRow] = useState<Row | null>(null)
  const [moves, setMoves] = useState<MovesResp | null>(null)
  const [movesErr, setMovesErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const imgOf = useSkuImages()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [sRes, mRes] = await Promise.all([
        fetch(`/api/web/core?list=stock&q=${encodeURIComponent(sku)}&limit=20&marketplaces=1`).then((r) => r.json()),
        fetch(`/api/web/core?list=moves&sku=${encodeURIComponent(sku)}&limit=100`).then((r) => r.json()).catch(() => null),
      ])
      if (sRes?.error) throw new Error(sRes.error)
      const rows: Row[] = Array.isArray(sRes?.rows) ? sRes.rows : []
      // ⚠️ ค้นหาคืนหลายแถว — ต้องหาแถวที่รหัสตรงเป๊ะ ไม่ใช่หยิบแถวแรก
      setRow(rows.find((r) => r.sku === sku) ?? null)
      setMoves(mRes && !mRes.error ? mRes : null)
      setMovesErr(!mRes ? 'ยิงไปที่ท่อความเคลื่อนไหวไม่สำเร็จ' : (typeof mRes.error === 'string' ? mRes.error : ''))
    } catch (e) {
      setRow(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [sku])

  useEffect(() => { load() }, [load])

  const img = imgOf(sku)
  const moveRows = moves?.rows ?? []

  return (
    <div className="p-4 md:p-6">
      <Link href="/core/stock" className="text-[12.5px] text-blue-600 hover:underline">‹ สินค้า</Link>

      {error && <ErrorBox title="ดึงข้อมูลสินค้าไม่ได้">{error}</ErrorBox>}
      {loading && !row && <LoadingState />}

      {!loading && !row && !error && (
        <div className="bg-white border border-gray-200 rounded-md p-6 mt-3 text-[13px] text-gray-500">
          ไม่พบรหัส <b>{sku}</b> ในคลังเงา — อาจเป็นสินค้าที่ <b>ไม่มีรหัสใน ZORT</b> (มี 226 ตัว
          ซึ่งเก็บเข้ากระจกไม่ได้เลย) หรือรหัสพิมพ์ผิด
        </div>
      )}

      {row && (
        <>
          <PageHead
            title={`รายละเอียดสินค้า ${row.name || sku}`}
            actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
          />

          {/* ⚠️ ZORT มีปุ่ม 7 ปุ่มแถวนี้ — ของเราทำได้จริงเฉพาะที่มีท่อรองรับ
              ปุ่มที่กดแล้วไม่เกิดอะไรคือปุ่มหลอก ⇒ ที่ยังไม่ได้ทำพาไปหน้าที่บอกตรง ๆ */}
          <div className="flex flex-wrap items-center gap-2 -mt-1 mb-4">
            <Link href="/core/soon/product-edit"
              className="text-[12.5px] text-gray-700 bg-white border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">
              แก้ไข
            </Link>
            <Link href="/core/soon/product-delete"
              className="text-[12.5px] text-gray-700 bg-white border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">
              ลบ
            </Link>
            <Link href={`/core/moves?sku=${encodeURIComponent(sku)}`}
              className="text-[12.5px] text-gray-700 bg-white border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">
              ปรับจำนวน
            </Link>
            <Link href="/core/soon/product-print"
              className="text-[12.5px] text-gray-700 bg-white border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">
              พิมพ์เอกสาร
            </Link>
            <Link href="/core/channels"
              className="text-[12.5px] text-gray-700 bg-white border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50">
              อัพเดทช่องทางอื่น
            </Link>
          </div>

          {/* การ์ด 3 ใบแบบ ZORT — ค่าว่างแสดงเป็น "-" ตามจอเขา */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <p className="text-[12px] text-gray-500 text-right">สินค้าคงเหลือ</p>
              <p className={`text-[28px] font-semibold text-right leading-none mt-1 ${
                Number(row.qty) < 0 ? 'text-red-500' : 'text-gray-900'
              }`}>
                {fmtNum(Number(row.qty ?? 0))}
              </p>
            </Card>
            <Card>
              <p className="text-[12px] text-gray-500 text-right">สินค้าพร้อมขาย</p>
              <p className="text-[28px] font-semibold text-right leading-none mt-1 text-gray-900">
                {/* ⚠️ null = ยังไม่มีในทะเบียน **ห้ามเดาว่าเท่ากับคงเหลือ** */}
                {row.available == null ? <span className="text-gray-300">-</span> : fmtNum(Number(row.available))}
              </p>
            </Card>
            <Card>
              <p className="text-[12px] text-gray-500 text-right">ยอดขายเดือนนี้ (บาท)</p>
              <p className="text-[28px] font-semibold text-right leading-none mt-1 text-gray-300">-</p>
              {/* ⚠️ ยังไม่มีท่อถามยอดขายรายสินค้าเป็นเดือน — ขอไว้แล้ว
                  ห้ามเอา sold (จำนวนที่ขายได้ 30 วัน) มาคูณราคาขายแล้วบอกว่าเป็นยอดเงิน
                  เพราะราคาที่ขายจริงต่างจากราคาป้ายได้ (ส่วนลด · โปรมาร์เก็ตเพลส) */}
              <p className="text-[11px] text-gray-400 text-right mt-1">ยังไม่มีท่อยอดขายรายสินค้าเป็นเดือน</p>
            </Card>
          </div>

          {/* กล่องข้อมูล — รูปซ้าย ขวาสองคอลัมน์ ตามผัง ZORT */}
          <div className="bg-white border border-gray-200 rounded-md p-5 mt-4 flex flex-wrap gap-6">
            {img
              ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" className="w-[220px] h-[160px] rounded border border-gray-200 object-cover bg-white" />
              )
              : (
                <span className="w-[220px] h-[160px] rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-[28px] text-gray-300">
                  🖼️
                </span>
              )}

            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-gray-900">{row.name || sku}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4 mt-4 max-w-[640px]">
                <div>
                  <p className="text-[12px] text-gray-500">รหัสสินค้า</p>
                  <p className="text-[15px] text-gray-900">{row.sku}</p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">ราคาขาย</p>
                  <p className="text-[15px] text-gray-900">
                    {typeof row.price === 'number' ? `${fmtMoney(row.price)} บาท` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">ต้นทุนคงเหลือเฉลี่ย</p>
                  {/* 🔴 ต้นทุนเฉลี่ยเรามีแค่ **ระดับหมวด** (คัดจากจอ ZORT) ไม่มีระดับสินค้า
                      ⇒ ขึ้นขีด + บอกว่าไปดูที่ไหนได้ · ห้ามเอาราคาซื้อในทะเบียนมาแสดงแทน
                      เพราะพิสูจน์แล้วว่ามันต่ำกว่าต้นทุนจริง 2-3 เท่า */}
                  <p className="text-[15px] text-gray-300">-</p>
                  <p className="text-[11px] text-gray-400">
                    มีเฉพาะระดับหมวด · ดูที่ <Link href="/core/categories" className="text-blue-600 hover:underline">หมวดหมู่</Link>
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">ราคาซื้อ</p>
                  <p className="text-[15px] text-gray-900">
                    {/* ⚠️ null = ยังไม่ได้กรอก ไม่ใช่ 0 */}
                    {row.buy == null ? <span className="text-gray-300">-</span> : `${fmtMoney(row.buy)} บาท`}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">สินค้าในสินค้าเป็นชุด</p>
                  {/* ท่อถามย้อน (รหัสนี้อยู่ในชุดไหน) กำลังทำ — ยังไม่มีก็บอกตรง ๆ */}
                  <p className="text-[15px] text-gray-300">ยังดูย้อนไม่ได้</p>
                </div>
                <div>
                  <p className="text-[12px] text-gray-500">ลงขายที่</p>
                  <div className="text-[15px]"><MarketLogos list={row.marketplaces} /></div>
                </div>
              </div>
            </div>
          </div>

          {/* การ์ด "รายงาน" — stock card เท่าที่คลังเงามี */}
          <Card padded={false} className="mt-4">
            <div className="flex flex-wrap items-center gap-3 px-4 md:px-5 pt-4 pb-2">
              <p className="text-[15px] font-semibold text-gray-900 mr-auto">รายงานการเคลื่อนไหว</p>
            </div>

            <TableWrap>
              <table className="w-full min-w-[680px]">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className={TH}>วันที่</th>
                    <th className={TH}>ประเภท</th>
                    <th className={TH}>อ้างอิง</th>
                    <th className={THR}>จำนวน</th>
                  </tr>
                </thead>
                <tbody>
                  {moveRows.length === 0 && (
                    <EmptyState
                      cols={4}
                      icon={movesErr ? '⚠️' : '📋'}
                      title={movesErr ? 'ดึงความเคลื่อนไหวไม่ได้' : 'ยังไม่มีรายการปรับสต็อกของรหัสนี้'}
                      detail={movesErr
                        ? `ตารางว่างเพราะระบบถามข้อมูลไม่สำเร็จ ไม่ใช่เพราะไม่มีการเคลื่อนไหว — ${movesErr}`
                        : 'ตารางนี้แสดงเฉพาะการปรับสต็อกด้วยมือ (รับของ · โอน · ปรับยอด · ของเสีย · รับคืน)'}
                    />
                  )}
                  {moveRows.map((m, i) => (
                    <tr key={m.id ?? `${m.ref}-${i}`} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className={`${TD} whitespace-nowrap text-gray-600`}>
                        {m.at ? thaiDate(String(m.at).slice(0, 10)) : '-'}
                      </td>
                      <td className={TD}>{moves?.reasons?.[m.reason] ?? m.reason}</td>
                      <td className={`${TD} text-gray-500`}>{m.ref || '-'}</td>
                      <td className={`${TDR} ${Number(m.qty) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {Number(m.qty) > 0 ? '+' : ''}{fmtNum(Number(m.qty ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>

            {/* 🔴 ต้องบอกให้ชัดว่าตารางนี้ครอบคลุมแค่ไหน — ZORT รวมทุกทาง ของเรายังไม่ครบ */}
            <p className="text-[12px] text-amber-800 bg-amber-50 border-t border-amber-200 px-4 py-2.5 leading-relaxed">
              ⚠️ ตารางนี้<b>ยังไม่ใช่ Stock Card เต็มแบบ ZORT</b> — ตอนนี้แสดงเฉพาะ
              <b> การปรับสต็อกด้วยมือ</b> ในระบบเรา · ยังไม่ได้รวม ขาย · ซื้อ · โอน เข้าด้วยกัน
              (ข้อมูลมีครบในคลังเงาแล้ว รอต่อท่อรวม) · และจะขาดใบ &quot;ปรับ&quot; 194 ใบเสมอ
              เพราะ API ของ ZORT เองไม่ส่งออกมา
            </p>
          </Card>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            ⚠️ ZORT มีการ์ด <b>กราฟยอดขาย</b> กับ <b>จำนวนคงเหลือรายคลัง</b> ในหน้านี้ด้วย —
            ยังไม่ทำเพราะ<b>สต็อกรายคลัง ZORT ไม่เปิดให้ดึง</b> (ยิงมาแล้วไม่ผ่านทุกทาง)
            และยอดขายรายสินค้าเป็นเดือนยังไม่มีท่อ · <b>ทำการ์ดเปล่าไว้ = สัญญาของที่ไม่มี</b> จึงไม่ทำ
          </p>
        </>
      )}
    </div>
  )
}
