'use client'
/* 🚚 รายละเอียดบริการส่งสินค้า — ลอกผังจาก ZORT `/Logistics/Details?tid=…`
 *    (อ่าน DOM สดของ ZORT 5 ต.ค. 2569 · ใบเทียบ ZORT ข้อ 13 ครึ่งหลัง)
 *
 * 🔑 **เส้นทางคีย์ด้วย `number` ไม่ใช่ `id`** — `id` ของท่อเป็น `z1/1130…` ซึ่งมี `/` อยู่ข้างใน
 *    ⇒ ใส่ใน path segment ไม่ได้ · และ `?q=<number>` ยิงแล้วได้ **1 แถวพอดี**
 *    (วัดเอง 5 ต.ค. 2569: `list=logistics&q=1130253768441542` ⇒ `total: 1`)
 *
 * ⚠️ **ท่อให้ไม่ครบเท่า ZORT** — จอ ZORT มี 10 ช่อง ท่อส่งมา 6 ช่องที่ตรงกัน
 *    ที่ขาด: ค่าส่ง · รายการขายที่เกี่ยวข้อง · รายละเอียด Pick up · ประวัติรายการ
 *    ⇒ เขียนกรอบค้างไว้ทุกช่องที่ขาด พร้อม **คำขอที่ยิงได้จริง** (ดู PipeGapFrame)
 *    🚫 ห้ามซ่อน — ช่องที่หายเงียบ ๆ ไม่มีใครไปขอให้เปิด
 *
 * ⚠️ `trackingNo` เป็นสตริงว่างได้ ⇒ **"ยังไม่มีเลขพัสดุ" ไม่ใช่ช่องว่าง**
 *    (ของจริง: ใบ Pending ของ Flash Express ยังไม่มีเลข — ว่างเปล่าอ่านเหมือนจอพัง)
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import Card from '@/components/ui/Card'
import PipeGapFrame from '@/components/zort/PipeGapFrame'
import { PageHead, thaiDate, RowMenu, Pill, toneOfStatus, DETAIL_BTN } from '@/components/zort'
import ZortLookFold from '@/components/zort/ZortLookFold'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'
import { SALE_STATUS, zortWord } from '@/lib/zort-words'

interface Row {
  id: string; number: string; trackingNo?: string; date?: string
  receiver?: string; carrier?: string; status?: string
  isCod?: boolean; lines?: number
}

/** แถวหนึ่งของบัตรข้อมูล · `ค่า` เป็น node ได้ เพราะบางช่องต้องเขียนว่า "ยังไม่มี" ด้วยสีของตัวเอง */
function ช่อง({ ป้าย, ค่า }: { ป้าย: string; ค่า: React.ReactNode }) {
  return (
    <div>
      {/* 📐 โหมดเหมือน ZORT (วัดจากภาพ /Logistics/Details 19 ต.ค. 2569): ป้าย 14 เทา · ค่า 18 หนา #3e3e3e */}
      <p className={เหมือนZORT ? 'text-[14px] text-[#828282] mb-1' : 'text-[11.5px] text-gray-500'}>{ป้าย}</p>
      <div className={เหมือนZORT ? 'text-[18px] font-semibold text-[#3e3e3e]' : 'text-[15px] font-semibold text-gray-900'}>{ค่า}</div>
    </div>
  )
}

/** ปุ่มที่ยังทำไม่ได้ · โหมดเหมือน ZORT ใช้ขนาดปุ่มแถบหัวจอของ ZORT (สูง 39) แต่ตัวอักษรเทา */
const ปุ่มเทา = เหมือนZORT
  ? `${DETAIL_BTN} font-['Kanit',sans-serif] !text-gray-400 cursor-not-allowed`
  : 'text-[12.5px] text-gray-300 bg-white border border-gray-200 rounded px-3 py-1.5 cursor-not-allowed'

const ยังไม่มี = (ข้อความ: string) => <span className="text-[12.5px] text-gray-400">{ข้อความ}</span>

/** ⚠️ **ห้ามเอา `status` ดิบขึ้นจอ** — ค่าจากท่อเป็นอังกฤษ (`Pending` · `Shipped`)
 *  ต้องผ่านชุดคำเดียวกับจอรายการ ไม่งั้นค่าเดียวกันอ่านคนละอย่างสองจอ
 *  (ด่าน `check-zort-words` ตีกลับ push ของจอนี้รอบแรกด้วยเหตุนี้ — 5 ต.ค. 2569) */
const statusTh = (s?: string) => zortWord(SALE_STATUS, s).text || 'ไม่ระบุสถานะ'

export default function LogisticsDetailPage() {
  const params = useParams<{ number: string }>()
  const number = decodeURIComponent(String(params?.number ?? ''))
  const [row, setRow] = useState<Row | null>(null)
  const [ไม่เจอ, setไม่เจอ] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr(''); setไม่เจอ(false)
    try {
      const r = await fetch(`/api/web/core?list=logistics&q=${encodeURIComponent(number)}&limit=20`)
      const d = await r.json()
      if (d?.error) throw new Error(d.error)
      /* ⚠️ `q` เป็นการ **ค้นหา** ไม่ใช่การขอรายการเดียว ⇒ อาจได้หลายแถวที่ขึ้นต้นคล้ายกัน
         ⇒ ต้องคัดด้วยเลขที่ตรงเป๊ะเอง ห้ามหยิบแถวแรกมาแสดง */
      const list: Row[] = Array.isArray(d?.rows) ? d.rows : []
      const found = list.find((x) => String(x.number) === number) ?? null
      setRow(found); setไม่เจอ(!found)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setLoading(false) }
  }, [number])
  useEffect(() => { void load() }, [load])

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* 📐 โหมดเหมือน ZORT: ลิงก์กลับอยู่เหนือหัวจอ (Kanit 14 #337ab7) · ไม่มีบรรทัดใต้หัวจอ ⇒ ที่มาเข้า ⓘ */}
      {เหมือนZORT && (
        <p className="font-['Kanit',sans-serif] text-[14px] -mb-3">
          <Link href="/core/logistics" className="text-[#337ab7] hover:underline">‹ บริการขนส่ง</Link>
        </p>
      )}
      <PageHead title={`บริการขนส่ง ${number}`}
        summary={เหมือนZORT
          ? <span className="text-gray-400 cursor-help text-[14px]" title="รายละเอียดใบส่งสินค้า — ลอกผังจาก ZORT /Logistics/Details (อ่าน DOM สด 5 ต.ค. 2569)">ⓘ</span>
          : 'รายละเอียดใบส่งสินค้า — ลอกผังจาก ZORT /Logistics/Details (อ่าน DOM สด 5 ต.ค. 2569)'} />
      {!เหมือนZORT && (
        <div className="flex items-center gap-2">
          <Link href="/core/logistics" className="text-[12.5px] text-[#337ab7] hover:underline">← กลับไปบริการขนส่ง</Link>
        </div>
      )}
      {/* 🧰 แถบปุ่มแบบ ZORT /Logistics/Details (อ่านปุ่ม+เมนูจาก HTML 16 ต.ค. 2569 · ไม่ได้กด)
          คำสั่ง ▾ (ส่งสินค้าสำเร็จ) · ส่ง SMS ให้ลูกค้า · พิมพ์ใบแปะกล่อง — ทั้งหมดเป็นการเขียนกลับ ZORT หรือยังไม่มีหน้าพิมพ์ ⇒ สีเทาพร้อมเหตุ
          (ปุ่ม "โหลดใหม่" ของเราเอาออก — ZORT ไม่มี) */}
      <div className={`flex flex-wrap items-center gap-2 ${เหมือนZORT ? '!mt-[25px]' : ''}`} /* 📐 โหมดเหมือน ZORT: แถบปุ่ม y=194 เท่า ZORT · !mt เพราะ space-y ของกล่องแม่ทับ */>
        <RowMenu label="คำสั่ง" items={[{ label: 'ส่งสินค้าสำเร็จ', disabled: 'ยังทำไม่ได้ — เปลี่ยนสถานะใบส่งต้องเขียนกลับ ZORT' }]} />
        <span title="ยังทำไม่ได้ — SMS ส่งจากระบบของ ZORT (คิดเงินตามข้อความ)"
          className={ปุ่มเทา}>ส่ง SMS ให้ลูกค้า</span>
        <span title="ยังทำไม่ได้ — ใบแปะกล่องต้องใช้ที่อยู่เต็มของผู้รับ ซึ่งเราไม่ได้เก็บ (รอตัดสินเรื่องข้อมูลส่วนบุคคล)"
          className={ปุ่มเทา}>พิมพ์ใบแปะกล่อง</span>
      </div>

      {loading && <LoadingState />}
      {!loading && err && <ErrorBox title="ดึงรายละเอียดใบส่งไม่ได้">{err}</ErrorBox>}
      {!loading && !err && ไม่เจอ && (
        <Card><p className="text-[12.5px] text-amber-800">
          ไม่พบใบส่งเลขที่ <b>{number}</b> ในชุดที่ท่อตอบกลับมา —
          <b> ไม่ได้แปลว่าใบนี้ไม่มีอยู่</b> อาจอยู่นอกช่วงที่กระจกเก็บไว้
        </p></Card>
      )}

      {/* 📐 โหมดเหมือน ZORT (ภาพ /Logistics/Details 19 ต.ค. 2569): ซ้ายการ์ดข้อมูล 2 คอลัมน์ · ขวาการ์ด Pick up + ประวัติ
             ช่องเหมือนกันกับโหมดปกติทุกช่อง (ค่าเดียวกัน) แค่จัดผัง · กรอบช่องที่ท่อยังไม่ส่งยังขึ้นครบ ไม่ซ่อน */}
      {!loading && !err && row && เหมือนZORT && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="bg-white rounded-md p-6 space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <ช่อง ป้าย="รายการ" ค่า={row.number} />
              <ช่อง ป้าย="วันที่" ค่า={row.date ? thaiDate(String(row.date)) : ยังไม่มี('ไม่รู้')} />
              <ช่อง ป้าย="Tracking No" ค่า={row.trackingNo || ยังไม่มี('ยังไม่มีเลขพัสดุ')} />
              <ช่อง ป้าย="สถานะรายการ"
                ค่า={row.status ? <Pill tone={toneOfStatus(String(row.status))}>{statusTh(row.status)}</Pill> : ยังไม่มี('ไม่รู้')} />
              <ช่อง ป้าย="ส่งโดย" ค่า={row.carrier || ยังไม่มี('ท่อไม่ได้ส่งชื่อขนส่งมา')} />
              <ช่อง ป้าย="ชำระเงิน"
                ค่า={typeof row.isCod === 'boolean'
                  ? (row.isCod ? 'เก็บเงินปลายทาง (COD)' : 'ไม่ใช่ COD')
                  : ยังไม่มี('ท่อไม่ได้ส่งธง COD มา')} />
              <ช่อง ป้าย="ชื่อผู้รับ" ค่า={row.receiver || ยังไม่มี('ท่อไม่ได้ส่งชื่อผู้รับมา')} />
              <ช่อง ป้าย="จำนวนรายการขาย"
                ค่า={typeof row.lines === 'number' ? `${fmtNum(row.lines)} รายการ` : ยังไม่มี('ไม่รู้')} />
            </div>
            <div className="border-t border-[#e8ecf8] pt-4 space-y-3">
              <PipeGapFrame
                หัว="ค่าส่ง"
                คอลัมน์="ค่าส่ง (ของจริงที่อ่านได้จาก ZORT: 28 บาท)"
                เหตุ="แถวของ `list=logistics` มี 9 ช่อง และไม่มีช่องค่าส่งเลย (ยิงอ่านรูปข้อมูลจริง 5 ต.ค. 2569)"
                คำขอ="เพิ่มช่อง `shippingCost` ลงในแถวของ `list=logistics`" />
              <PipeGapFrame
                หัว="รายการขายที่เกี่ยวข้อง"
                คอลัมน์="เลขที่ใบขาย (ของจริง: SO-202610010)"
                เหตุ="ท่อส่งมาแค่ `lines` ซึ่งเป็น **จำนวนนับ** ไม่ใช่รายชื่อใบขาย ⇒ กดต่อไปที่ใบขายไม่ได้"
                คำขอ="เพิ่มช่อง `orderNumbers` (อาเรย์ของเลขที่ใบขาย) ลงในแถวของ `list=logistics`" />
            </div>
            <ZortLookFold สรุป="📏 จอนี้ตรงกับ ZORT กี่ช่อง · ปุ่มที่ยังไม่มี">
              <p>
                จอ ZORT ของใบนี้มี 10 ช่อง · ที่นี่ตรงกัน <b>6 ช่อง</b> และมีเพิ่มอีก 2 ช่อง
                (ชื่อผู้รับ · จำนวนรายการขาย) ที่ ZORT แสดงในหน้ารายการแทน — ช่องที่ยังขาด <b>ไม่ได้ซ่อนไว้</b>
              </p>
              <p className="mt-1">
                🖨️ ZORT มีปุ่ม <b>ส่ง SMS ให้ลูกค้า</b> กับ <b>พิมพ์ใบแปะกล่อง</b> — ของเรายังไม่มีทั้งคู่
                ปุ่มบนแถบเป็นสีเทาพร้อมเหตุ (ชี้เมาส์ค้างเพื่ออ่าน)
              </p>
            </ZortLookFold>
          </div>
          <div className="bg-white rounded-md p-6 space-y-3">
            <PipeGapFrame
              หัว="รายละเอียด Pick up"
              คอลัมน์="รายละเอียด Pick up"
              เหตุ="ไม่มีช่องนี้ในแถวที่ท่อส่งมา"
              คำขอ="เพิ่มช่อง `pickup` ลงในแถวของ `list=logistics`" />
            <PipeGapFrame
              หัว="ประวัติรายการ (การเดินทางของพัสดุ)"
              คอลัมน์="ข้อความเหตุการณ์ + วันเวลา (ของจริง 2 เหตุการณ์: รับพัสดุเข้าสาขา · เจ้าหน้าที่สาขารับพัสดุ)"
              เหตุ="เป็นข้อมูลรายเหตุการณ์ของใบเดียว ซึ่ง `list=logistics` เป็นเส้นรายการ ไม่มีที่ให้ใส่"
              คำขอ="เส้นใหม่รายใบ เช่น `?logisticsevents=<number>` คืนรายการเหตุการณ์พร้อมเวลา" />
          </div>
        </div>
      )}

      {!loading && !err && row && !เหมือนZORT && (
        <>
          <Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ช่อง ป้าย="ส่งโดย" ค่า={row.carrier || ยังไม่มี('ท่อไม่ได้ส่งชื่อขนส่งมา')} />
              <ช่อง ป้าย="รายการ" ค่า={<span className="font-mono text-[14px]">{row.number}</span>} />
              <ช่อง ป้าย="Tracking No"
                ค่า={row.trackingNo
                  ? <span className="font-mono text-[14px]">{row.trackingNo}</span>
                  : ยังไม่มี('ยังไม่มีเลขพัสดุ')} />
              {/* ⚠️ วันที่ต้องผ่าน thaiDate เสมอ — ค่าจากท่อเป็น YYYY-MM-DD ไม่มีเวลา/โซน */}
              <ช่อง ป้าย="วันที่" ค่า={row.date ? thaiDate(String(row.date)) : ยังไม่มี('ไม่รู้')} />
              <ช่อง ป้าย="สถานะรายการ" ค่า={row.status ? statusTh(row.status) : ยังไม่มี('ไม่รู้')} />
              {/* 🔴 `isCod` ไม่ส่งมา = **ไม่รู้** ไม่ใช่ "ไม่ใช่ COD" — สองอันนี้ต่างกันเรื่องเงิน */}
              <ช่อง ป้าย="ชำระเงิน"
                ค่า={typeof row.isCod === 'boolean'
                  ? (row.isCod ? 'เก็บเงินปลายทาง (COD)' : 'ไม่ใช่ COD')
                  : ยังไม่มี('ท่อไม่ได้ส่งธง COD มา')} />
              <ช่อง ป้าย="ชื่อผู้รับ" ค่า={row.receiver || ยังไม่มี('ท่อไม่ได้ส่งชื่อผู้รับมา')} />
              <ช่อง ป้าย="จำนวนรายการขาย"
                ค่า={typeof row.lines === 'number' ? `${fmtNum(row.lines)} รายการ` : ยังไม่มี('ไม่รู้')} />
            </div>
            <p className="mt-3 pt-3 border-t border-gray-100 text-[11.5px] text-gray-500 leading-relaxed">
              📏 จอ ZORT ของใบนี้มี 10 ช่อง · ที่นี่ตรงกัน <b>6 ช่อง</b> และมีเพิ่มอีก 2 ช่อง
              (ชื่อผู้รับ · จำนวนรายการขาย) ที่ ZORT แสดงในหน้ารายการแทน —
              ช่องที่ยังขาดอยู่ข้างล่าง <b>ไม่ได้ซ่อนไว้</b>
            </p>
          </Card>

          {/* ── สี่ก้อนที่ ZORT มีแต่ท่อเรายังไม่ส่ง ── */}
          <PipeGapFrame
            หัว="ค่าส่ง"
            คอลัมน์="ค่าส่ง (ของจริงที่อ่านได้จาก ZORT: 28 บาท)"
            เหตุ="แถวของ `list=logistics` มี 9 ช่อง และไม่มีช่องค่าส่งเลย (ยิงอ่านรูปข้อมูลจริง 5 ต.ค. 2569)"
            คำขอ="เพิ่มช่อง `shippingCost` ลงในแถวของ `list=logistics`" />
          <PipeGapFrame
            หัว="รายการขายที่เกี่ยวข้อง"
            คอลัมน์="เลขที่ใบขาย (ของจริง: SO-202610010)"
            เหตุ="ท่อส่งมาแค่ `lines` ซึ่งเป็น **จำนวนนับ** ไม่ใช่รายชื่อใบขาย ⇒ กดต่อไปที่ใบขายไม่ได้"
            คำขอ="เพิ่มช่อง `orderNumbers` (อาเรย์ของเลขที่ใบขาย) ลงในแถวของ `list=logistics`" />
          <PipeGapFrame
            หัว="รายละเอียด Pick up"
            คอลัมน์="รายละเอียด Pick up"
            เหตุ="ไม่มีช่องนี้ในแถวที่ท่อส่งมา"
            คำขอ="เพิ่มช่อง `pickup` ลงในแถวของ `list=logistics`" />
          <PipeGapFrame
            หัว="ประวัติรายการ (การเดินทางของพัสดุ)"
            คอลัมน์="ข้อความเหตุการณ์ + วันเวลา (ของจริง 2 เหตุการณ์: รับพัสดุเข้าสาขา · เจ้าหน้าที่สาขารับพัสดุ)"
            เหตุ="เป็นข้อมูลรายเหตุการณ์ของใบเดียว ซึ่ง `list=logistics` เป็นเส้นรายการ ไม่มีที่ให้ใส่"
            คำขอ="เส้นใหม่รายใบ เช่น `?logisticsevents=<number>` คืนรายการเหตุการณ์พร้อมเวลา" />

          <Card>
            <p className="text-[12.5px] text-gray-600 leading-relaxed">
              🖨️ ZORT มีปุ่ม <b>ส่ง SMS ให้ลูกค้า</b> กับ <b>พิมพ์ใบแปะกล่อง</b> ในจอนี้ —
              ของเรายังไม่มีทั้งคู่ และ <b>ไม่ได้วางปุ่มหลอกไว้</b>
              {' '}(ปุ่มที่กดแล้วไม่เกิดอะไรนับเป็นข้อบกพร่องตามใบสั่ง)
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
