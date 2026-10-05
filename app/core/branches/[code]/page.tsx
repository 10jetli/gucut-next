'use client'
// คลังสินค้า/สาขา → รายละเอียด — **ลอกผังจาก ZORT `/Warehouse/Details?wid=`** (อ่าน DOM สด 5 ต.ค. 2569)
//
// 🔑 **ทำไมจอนี้เกิด**: ใบเทียบ ZORT ข้อ 13 — ZORT มีจอรายละเอียดคลัง ของเราไม่มี
//    ⇒ จอคลังของเราเป็นทางตัน กดแถวแล้วไม่ไปไหน
//
// 📐 **ZORT มี 4 ตารางในจอนี้** (อ่านจาก DOM จริง ไม่ใช่เดา):
//    ① `# · ชื่อสินค้า · เข้า · ออก · เปลี่ยน · คงเหลือ`      ← สินค้าในคลังนี้
//    ② `ชื่อสินค้า · จำนวนที่ขายได้ · ยอดขาย`                ← สินค้าขายดีของคลังนี้
//    ③ `วันที่ · ประเภท · รหัสสินค้า · ชื่อสินค้า · จำนวน · รายการ · สถานะ · จาก/ไป` ← สมุดเคลื่อนไหว
//    ④ `สินค้า · จำนวน · ยอดขาย`
//
// 🔴 **สามในสี่ตารางนั้นทำไม่ได้วันนี้ และเหตุไม่ใช่ "ยังไม่ได้ทำ"** — ยิงถามท่อเอง 5 ต.ค. 2569:
//    `list=stock` ประกาศใน `สัญญาของเส้นนี้` ว่า `กรองจริง(วัดแล้ว): ["q"]` เท่านั้น
//    `list=moves` ประกาศว่ารับ `sku` · `limit` · `offset` — **ไม่มีพารามิเตอร์คลังทั้งสองเส้น**
//    ⇒ กรองรายคลังไม่ได้ ⇒ สามตารางนั้น **ขาดที่ท่อ ไม่ใช่ขาดที่จอ**
//    ⇒ ⇒ วาดกรอบไว้พร้อมเหตุและ**คำขอที่เจาะจง** (กติกาในใบ: ห้ามซ่อนของที่ ZORT มี)
//       เพราะช่องว่างที่มองไม่เห็น จะไม่มีใครไปขอให้เปิด
//
// ✅ **ส่วนที่มีของจริง**: ยอดขายของคลังนี้ — `list=orderfacets&warehouses=1` ส่ง `byWarehouse`
//    (ใบ·ยอด รายคลัง) ⇒ ตารางที่ ② กับ ④ ของ ZORT แยกรายสินค้า ของเราได้แค่ยอดรวมของคลัง
//    ⇒ เขียนกำกับว่าได้ถึงระดับไหน **ห้ามปล่อยให้คนอ่านว่าเป็นรายสินค้า**
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import { parseUtc, thaiDayTime } from '@/components/zort/DataFreshness'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import Card from '@/components/ui/Card'
import PipeGapFrame from '@/components/zort/PipeGapFrame'
import { PageHead, BtnGhost, thaiDate } from '@/components/zort'

interface Warehouse {
  code: string; name: string; province?: string; isPos?: boolean
  /** 🔴 `null`/ไม่ส่งมา = **ยังไม่เคยคัด** ห้ามแสดง 0 (0 เป็นค่าจริงของคลังที่ไม่มีของ — ANJ เป็น 0 จริง) */
  stockValue?: number | null
  movedAt?: string
  /** เวลาที่ตัวคัดไปอ่านจอ ZORT ล่าสุด — **UTC ดิบ** ⇒ ต้อง +7 และแสดงคู่กับตัวเลขเสมอ */
  valueCollectedAt?: string
}
/** ⚠️ `null` = **ท่อส่งค่าที่อ่านเป็นตัวเลขไม่ได้** ซึ่งคนละเรื่องกับ `0` = ขายได้ศูนย์ใบจริง */
interface ยอดคลัง { orders: number | null; amount: number | null }

/** อ่านเป็นตัวเลข · อ่านไม่ออกคืน `null` **ไม่ใช่ 0** (`Number(x) || 0` ยุบสองกรณีนี้เป็นค่าเดียว) */
const อ่านเลข = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** วันไทยย้อนหลัง N วัน — ห้ามใช้ `toISOString()` ตรง ๆ (ก่อนเจ็ดโมงเช้าจะได้วันของเมื่อวาน) */
const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

/** เวลาที่ตัวคัดไปอ่าน ZORT — **ใช้ตัวกลาง `parseUtc`/`thaiDayTime` ไม่เขียนสูตร +7 ใหม่**
 *  (Intl บางรุ่น throw — เคยทำหน้าคนเข้าเว็บพังมาแล้ว · กติกาเดียวกับจอรายการคลัง)
 *  🔴 `parseUtc` คืน `null` ได้ ⇒ คืนสตริงว่างแล้วให้จอไม่แสดงบรรทัดนั้น **ห้ามโชว์วันที่เดา** */
const เวลาคัด = (raw?: string) => {
  const d = parseUtc(raw)
  return d ? thaiDayTime(d) : ''
}

export default function BranchDetailPage() {
  const params = useParams<{ code: string }>()
  const code = decodeURIComponent(String(params?.code ?? ''))
  const [wh, setWh] = useState<Warehouse | null>(null)
  const [ไม่เจอ, setไม่เจอ] = useState(false)
  const [ยอด, setยอด] = useState<ยอดคลัง | null>(null)
  const [ยอดล้ม, setยอดล้ม] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr(''); setไม่เจอ(false)
    try {
      const w = await fetch('/api/web/core?list=warehouses').then((r) => r.json())
      if (w?.error) throw new Error(w.error)
      /* ⚠️ **แถวอยู่ใต้ช่อง `warehouses` ไม่ใช่ `rows`** — เส้นนี้ตอบ 200 พร้อม `count` แต่ไม่มี `rows`
         ⇒ ใครอ่าน `.rows` จะได้ 0 แถวเงียบ ๆ (คลาสเดิมของทีม: ท่อคืนแถวในชื่อช่องของตัวเอง) */
      const list: Warehouse[] = Array.isArray(w?.warehouses) ? w.warehouses : []
      const found = list.find((x) => String(x.code) === code) ?? null
      setWh(found); setไม่เจอ(!found)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setLoading(false) }

    /* ยอดขายรายคลัง — ล้มก็แค่ส่วนนี้ ไม่ล้มทั้งจอ **แต่ต้องบอกว่าล้ม** */
    setยอดล้ม(false)
    try {
      const c = await fetch(`/api/web/core?list=orderfacets&from=${thaiDay(30)}&to=${thaiDay(0)}&warehouses=1`)
        .then((r) => r.json())
      if (!Array.isArray(c?.byWarehouse)) throw new Error('ไม่มี byWarehouse')
      const row = c.byWarehouse.find(
        (x: { code?: string }) => String(x.code ?? '') === code) as
        { orders?: unknown; amount?: unknown } | undefined
      /* 🔴 ไม่เจอแถวของคลังนี้ = **คลังนี้ไม่มีใบในช่วง 30 วัน** ซึ่งต่างจาก "ถามไม่ได้"
         ⇒ ตั้งเป็น 0 ได้ **เฉพาะกรณีไม่มีแถว** เพราะท่อตอบสำเร็จและบอกครบทุกคลังที่มีใบ
         ⚠️ แต่ถ้า **เจอแถวแล้วเลขอ่านไม่ออก** นั่นคือท่อส่งของแปลก ไม่ใช่ศูนย์
            ของเดิมเขียน `Number(row?.orders) || 0` ⇒ ยุบสองกรณีเป็นเลขเดียวกันเงียบ ๆ */
      setยอด(row
        ? { orders: อ่านเลข(row.orders), amount: อ่านเลข(row.amount) }
        : { orders: 0, amount: 0 })
    } catch { setยอดล้ม(true); setยอด(null) }
  }, [code])
  useEffect(() => { void load() }, [load])

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHead title={`คลัง ${code}`}
        summary="รายละเอียดคลังสินค้า/สาขา — ลอกผังจาก ZORT /Warehouse/Details (อ่าน DOM สด 5 ต.ค. 2569)" />
      <div className="flex items-center gap-2">
        <Link href="/core/branches" className="text-[12.5px] text-blue-600 hover:underline">← กลับไปรายการคลัง</Link>
        <BtnGhost onClick={() => void load()} disabled={loading}>โหลดใหม่</BtnGhost>
      </div>

      {loading && <LoadingState />}
      {!loading && err && <ErrorBox title="ดึงรายละเอียดคลังไม่ได้">{err}</ErrorBox>}
      {!loading && !err && ไม่เจอ && (
        <Card><p className="text-[13px] text-amber-800">
          ⚠️ <b>ไม่พบคลังรหัส “{code}”</b> ในรายการที่ท่อส่งมา — ตรวจรหัสที่หน้ารายการคลังอีกครั้ง
          <br /><span className="text-gray-500">(ท่อส่งรายการคลังทั้งชุด ไม่ได้แบ่งหน้า ⇒ ไม่เจอที่นี่คือไม่มีจริง)</span>
        </p></Card>
      )}

      {!loading && !err && wh && (
        <>
          <Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[11.5px] text-gray-500">รหัส</p>
                <p className="text-[15px] font-semibold text-gray-900">{wh.code}</p>
              </div>
              <div>
                <p className="text-[11.5px] text-gray-500">ชื่อคลัง/สาขา</p>
                <p className="text-[15px] font-semibold text-gray-900">{wh.name || '—'}</p>
              </div>
              <div>
                <p className="text-[11.5px] text-gray-500">ประเภท</p>
                {/* 🔴 อ่านธง `isPos` จากท่อ **ห้ามเดาจากรหัส** — วันหนึ่งร้านเพิ่มคลัง รหัสจะไม่ใช่ KLD/ANJ
                       แล้วการเดาจะพังเงียบ ๆ (กติกาเดียวกับจอรายการคลัง)
                    ⚠️ ไม่ส่งธงมา = **ยังไม่รู้** ไม่ใช่ "ไม่ใช่จุดขาย" */}
                <p className="text-[15px] font-semibold text-gray-900">
                  {wh.isPos === undefined
                    ? <span className="text-gray-400 text-[13px]">ยังไม่รู้ (ท่อไม่ส่งธง isPos)</span>
                    : wh.isPos ? 'จุดขาย (เปิดบิลได้)' : 'คลัง (ไม่ใช่จุดขาย)'}
                </p>
              </div>
              <div>
                <p className="text-[11.5px] text-gray-500">เคลื่อนไหวล่าสุด</p>
                <p className="text-[15px] font-semibold text-gray-900">
                  {/* ⚠️ **ห้าม `.slice(0, 10)` ก่อนส่งเข้า thaiDate** — ค่านี้มีโซน `+07:00` ติดมา
                      thaiDate อ่านโซนเองถูกอยู่แล้ว · ตัดทิ้งก่อน = ถ้าท่อเปลี่ยนไปส่ง UTC
                      วันบนจอเพี้ยนหนึ่งวันโดยไม่มีอะไรฟ้อง (จอรายการคลังเขียนเตือนไว้ตั้งแต่ 18 ก.ย. 2569
                      — จอนี้เพิ่งเหยียบซ้ำ 5 ต.ค. 2569 ด่าน check-thai-date เป็นคนจับ ไม่ใช่คน) */}
                  {wh.movedAt ? thaiDate(String(wh.movedAt)) : <span className="text-gray-400 text-[13px]">ไม่รู้</span>}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[11.5px] text-gray-500">มูลค่าสินค้าคงเหลือ</p>
              {/* 🔴 ไม่ส่งมา/null = **ยังไม่เคยคัด** ห้ามแสดง 0 — ANJ เป็น 0 จริง สองอย่างนี้ต้องต่างกัน */}
              {typeof wh.stockValue === 'number'
                ? (
                  <p className="text-[20px] font-black text-gray-900">
                    {fmtMoney(wh.stockValue)}
                    {เวลาคัด(wh.valueCollectedAt) && (
                      <span className="text-[11.5px] font-normal text-gray-500">
                        {' '}· อ่านจากจอ ZORT เมื่อ {เวลาคัด(wh.valueCollectedAt)}
                      </span>
                    )}
                  </p>
                )
                : <p className="text-[15px] text-gray-400">ยังไม่เคยคัดมูลค่าของคลังนี้ (ไม่ใช่ศูนย์)</p>}
            </div>
          </Card>

          <Card>
            <p className="text-[14px] font-semibold text-gray-900 mb-1">ยอดขายของคลังนี้ · 30 วันล่าสุด</p>
            {ยอดล้ม
              ? <p className="text-[12.5px] text-amber-800">⚠️ ถามยอดขายรายคลังไม่สำเร็จ — <b>ยังไม่รู้</b> ไม่ใช่ว่าไม่มียอด</p>
              : ยอด
                ? (
                  <>
                    <div className="flex items-baseline gap-5">
                      {/* ⚠️ ท่อส่งค่าที่อ่านไม่ออก ⇒ เขียนว่าไม่รู้ ห้ามวาดเลข 0 ให้คนอ่านว่าขายไม่ได้ */}
                      <span className="text-[20px] font-black text-gray-900">
                        {ยอด.amount === null
                          ? <span className="text-[14px] font-semibold text-amber-800">ยังไม่รู้ยอด — ท่อส่งค่าที่อ่านเป็นตัวเลขไม่ได้</span>
                          : fmtMoney(ยอด.amount)}
                      </span>
                      <span className="text-[13px] text-gray-600">
                        {ยอด.orders === null ? 'ยังไม่รู้จำนวนใบ' : `${fmtNum(ยอด.orders)} ใบ`}
                      </span>
                    </div>
                    {/* 🔴 ZORT แยกรายสินค้า ของเราได้แค่ยอดรวมของคลัง ⇒ เขียนกำกับ
                           ห้ามปล่อยให้คนอ่านว่าเป็นรายสินค้า (ตารางที่ ②/④ ของ ZORT) */}
                    <p className="text-[11.5px] text-gray-500 mt-1.5">
                      เป็น<b>ยอดรวมของคลัง</b> — ZORT แยกเป็นรายสินค้าได้ (ตาราง “ชื่อสินค้า · จำนวนที่ขายได้ · ยอดขาย”)
                      แต่ท่อส่งมาถึงระดับคลังเท่านั้น
                    </p>
                  </>
                )
                : <LoadingState text="กำลังถามยอดขายรายคลัง…" />}
          </Card>

          <PipeGapFrame
            หัว="สินค้าในคลังนี้"
            คอลัมน์="# · ชื่อสินค้า · เข้า · ออก · เปลี่ยน · คงเหลือ"
            เหตุ="เส้น `list=stock` ประกาศเองว่ากรองได้แค่คำค้น (`q`) — ไม่มีพารามิเตอร์คลัง ⇒ แยกของรายคลังไม่ได้"
            คำขอ="เพิ่มตัวกรองคลังให้ `list=stock` (เช่น `warehouse=NEW`) และส่งยอดเข้า/ออก/คงเหลือรายคลัง"
          />
          <PipeGapFrame
            หัว="สมุดเคลื่อนไหวของคลังนี้"
            คอลัมน์="วันที่ · ประเภท · รหัสสินค้า · ชื่อสินค้า · จำนวน · รายการ · สถานะ · จาก/ไป"
            เหตุ="เส้น `list=moves` รับแค่ `sku` · `limit` · `offset` (ท่อประกาศเอง) และฐานยังเป็น 0 แถวเพราะเรายังไม่ตัดสต็อกเอง"
            คำขอ="เพิ่มตัวกรองคลังให้ `list=moves` และเติมแถวจากการเคลื่อนไหวจริงของ ZORT"
          />
        </>
      )}
    </div>
  )
}
