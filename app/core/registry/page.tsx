'use client'
// ทะเบียนบัญชีรับ-จำหน่ายเลื่อยโซ่ยนต์ — เทียบกับจำนวนที่เว็บเสิร์ฟอยู่จริง
//
// ท่านประธานสั่ง 25 ก.ย. 2569: "ทำจอในเมนู JET ที่โชว์ทะเบียนกับเว็บเทียบกัน"
// และ **"ตัด zort ออกได้เลย มันทำไม่ได้ zort ไม่เก่ง"**
// ⇒ จอนี้เคยเทียบ **สองทาง** ทะเบียน vs เว็บ · ไม่มีคอลัมน์ ZORT โดยตั้งใจ
//    (พิสูจน์แล้วว่า ZORT มีซีเรียลที่ว่ายังมีของ ทั้งที่ทะเบียนบอกขายไปแล้ว 3 ใบ)
//
// 🔄 **ท่านกลับคำสั่งเอง 10 ต.ค. 2569**: "น่าจะเอาหน้านี้มาต่อ /core/registry เชื่อม zort"
//    ⇒ เพิ่มคอลัมน์ ZORT + ปุ่มดันเลขทะเบียนลง ZORT
//    ⚠️ **เหตุของคำสั่งเดิมยังจริงอยู่ ไม่ได้ลบทิ้ง** — ZORT ยังเชื่อไม่ได้เป็นความจริง
//       ⇒ จอนี้จึงเอา ZORT มา **โชว์เทียบ** และให้ท่านกดดันเลข **ทะเบียน** ลงไป
//       ไม่ใช่เอาเลข ZORT มาทับทะเบียน (ทิศนั้นห้ามตลอด)
//
// 🔑 **ขาที่สี่ (ชีทของท่าน) ยังไม่มี** — g1 อ่านชีทไม่ได้ (ไม่ได้แชร์แบบลิงก์ ⇒ 401)
//    ⇒ `ตรงกัน` ที่เส้น `?registry=1` คืนมา เทียบแค่ **D1 ↔ ตารางในโค้ด**
//      และสองขานั้น **สร้างจากชีทภาพเดียวกัน (25 ก.ย.)** ⇒ เก่าพร้อมกันได้เพราะต้นกำเนิดร่วม
//      ⇒ `ตรงกัน: true` **ไม่ได้แปลว่าตรงกับชีท** — จอต้องเขียนข้อนี้บนหน้าจอ ไม่ใช่ในคอมเมนต์
//
// 🔴 **นี่คือเอกสารตามกฎหมาย** ผู้ถือทะเบียนคือ หจก. นิวเวฟ ซันไชน์ (ผู้นำเข้า)
//    ไม่ใช่ ศีตกาล เทรดดิ้ง (คนขาย) — คนละนิติบุคคล ห้ามยุบรวมกัน
//
// ⚠️ **ชื่อลูกค้าไม่มาที่หน้าสรุป** — เส้น `?registry=1` ไม่คืนชื่อเลย
//    ชื่อออกทาง `?registryrows=1` ซึ่งต้องกดขอเจาะจงเป็นรุ่น ๆ (ปุ่ม "ดูรายตัว")
//    ทำแบบนี้เพราะหน้าที่เปิดค้างทิ้งไว้ไม่ควรมีชื่อลูกค้า 124 รายอยู่บนจอ
//
// ⚠️ ตัวเลข "เว็บ" มาจาก `licensed-stock` ฝั่ง gucut-web ซึ่งเป็นค่าที่ **ฝังตอน deploy**
//    ⇒ แก้ทะเบียนในชีตแล้วเลขนี้ยังไม่ขยับจนกว่าจะนำเข้าใหม่ + deploy
//    นี่คือเหตุผลที่ต้องมีจอนี้ — เพื่อให้เห็นว่ามันเริ่มห่างกันเมื่อไหร่
import { Fragment, useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR } from '@/components/zort'
import {
  type สภาพZORT, จองอยู่, คาดพร้อมขาย, คำเตือนแถว, ต้องเลือกรหัสเอง,
  refของการกด, ขาที่ยังไม่มี,
} from '@/lib/registry-zort'
// ⚠️ TH/THR/TD/TDR เป็น **สตริงคลาส** ไม่ใช่คอมโพเนนต์ — ใช้เป็น className ของ th/td

interface Row {
  ชนิด: string
  ชื่อ: string
  ทั้งหมด: number
  ทะเบียนเหลือ: number
  รหัสสินค้า: string[]
  เว็บโชว์: number | null
  ตรงกัน: boolean | null
}
interface Summary {
  ok?: boolean
  skip?: string
  error?: string
  รวม?: { เลื่อยเหลือ: number; บาร์เหลือ: number }
  ไม่ตรง?: number
  ยังไม่ได้จับคู่?: number
  รายการ?: Row[]
}
interface Serial {
  lot: number; kind: string; serial: string; seq: number
  model?: string; spec?: string; received?: string
  sold_at?: string; buyer?: string; lz2?: string; lz2_date?: string; province?: string
}

export default function Page() {
  const [sum, setSum] = useState<Summary | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(true)
  const [เปิด, setเปิด] = useState<string | null>(null)
  const [รายตัว, setรายตัว] = useState<Serial[] | null>(null)
  const [busyRows, setBusyRows] = useState(false)
  /* สภาพ ZORT รายรหัส — คีย์คือ sku · **ไม่มีคีย์ = ยังไม่อ่าน** (ไม่ใช่ 0) */
  const [zort, setZort] = useState<Record<string, สภาพZORT>>({})
  const [zortอ่านแล้ว, setZortอ่านแล้ว] = useState(0)
  const [zortทั้งหมด, setZortทั้งหมด] = useState(0)
  /* ผลโหมดซ้อมรายรหัส — ต้องกดซ้อมก่อนจึงจะมีปุ่มยืนยัน */
  const [ซ้อม, setซ้อม] = useState<Record<string, { ข้อความ: string; ผ่าน: boolean }>>({})
  const [กำลังยิง, setกำลังยิง] = useState<string | null>(null)
  const [ผลเขียน, setผลเขียน] = useState<Record<string, string>>({})
  const [รหัสที่เลือก, setรหัสที่เลือก] = useState<Record<string, string>>({})
  const [ดัน, setดัน] = useState<string | null>(null)

  const โหลด = useCallback(async () => {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/web/core?registry=1')
      const d: Summary = await r.json()
      if (d.error) setErr(d.error)
      setSum(d)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'เรียกข้อมูลไม่สำเร็จ')
    } finally { setBusy(false) }
  }, [])

  useEffect(() => { void โหลด() }, [โหลด])

  /* อ่านสภาพ ZORT ของทุกรหัสในตาราง — ยิงขนานทีละ 6 แล้วเติมช่องทันทีที่ได้
     ⚠️ **ยิงทีละรหัสเท่านั้น** — ส่งหลายรหัสคั่นคอมมาไปที่ `?zortproduct=` ได้ `found:false`
        (วัดเอง 10 ต.ค. 2569 · 0.6 วิ/รหัส ⇒ 30 รหัส ≈ 19 วิ ถ้าเรียงต่อกัน จึงต้องขนาน)
     ⚠️ ล้มหนึ่งรหัส **ห้ามทำให้ช่องอื่นว่าง** ⇒ เก็บเหตุไว้ที่ช่องนั้นช่องเดียว */
  const โหลดZORT = useCallback(async (skus: string[]) => {
    setZortทั้งหมด(skus.length); setZortอ่านแล้ว(0)
    const คิว = skus.slice()
    const คนทำงาน = async () => {
      for (;;) {
        const sku = คิว.shift()
        if (!sku) return
        let ผล: สภาพZORT
        try {
          const r = await fetch(`/api/web/core?zortproduct=${encodeURIComponent(sku)}`)
          const d = await r.json()
          if (!r.ok || d?.error) ผล = { สถานะ: 'อ่านไม่ได้', เหตุ: String(d?.error || r.status) }
          else if (!d?.found || !d?.product) ผล = { สถานะ: 'ไม่มีรหัสนี้' }
          else ผล = {
            สถานะ: 'มีค่า',
            คงเหลือ: Number(d.product.stock),
            พร้อมขาย: Number(d.product.availablestock),
            ชื่อ: String(d.product.name ?? ''),
            ราคา: d.product.sellprice === undefined ? null : Number(d.product.sellprice),
          }
        } catch (e) {
          ผล = { สถานะ: 'อ่านไม่ได้', เหตุ: e instanceof Error ? e.message : 'เรียกไม่สำเร็จ' }
        }
        setZort((ก) => ({ ...ก, [sku]: ผล }))
        setZortอ่านแล้ว((n) => n + 1)
      }
    }
    await Promise.all([0, 1, 2, 3, 4, 5].map(() => คนทำงาน()))
  }, [])

  useEffect(() => {
    const skus: string[] = []
    for (const x of sum?.รายการ ?? []) for (const s of x.รหัสสินค้า) if (skus.indexOf(s) < 0) skus.push(s)
    if (skus.length) void โหลดZORT(skus)
  }, [sum, โหลดZORT])

  /* ปุ่มดัน — **กดครั้งแรกเป็นโหมดซ้อมเสมอ** แล้วค่อยมีปุ่มยืนยัน
     🔑 `ref` ต่างกันทุกครั้งที่กด ⇒ ฐานกันกดซ้ำได้ (`refของการกด` มีเทสคุม) */
  const ยิง = useCallback(async (sku: string, จำนวน: number, จริง: boolean) => {
    setกำลังยิง(sku)
    try {
      const body: Record<string, unknown> = {
        ref: refของการกด(sku, Date.now()),
        field: 'stock',
        warehousecode: 'NEW',
        stocks: [{ sku, stock: จำนวน }],
      }
      if (จริง) body.confirm = true
      const r = await fetch('/api/web/core?updatestock=1', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await r.json()
      const ข้อความ = JSON.stringify(d, null, 1)
      if (จริง) {
        setผลเขียน((ก) => ({ ...ก, [sku]: ข้อความ }))
        setซ้อม((ก) => { const ข = { ...ก }; delete ข[sku]; return ข })
        const rr = await fetch(`/api/web/core?zortproduct=${encodeURIComponent(sku)}`)
        const dd = await rr.json()
        if (dd?.found && dd?.product) {
          setZort((ก) => ({ ...ก, [sku]: {
            สถานะ: 'มีค่า', คงเหลือ: Number(dd.product.stock),
            พร้อมขาย: Number(dd.product.availablestock),
            ชื่อ: String(dd.product.name ?? ''),
            ราคา: dd.product.sellprice === undefined ? null : Number(dd.product.sellprice),
          } }))
        }
      } else {
        setซ้อม((ก) => ({ ...ก, [sku]: { ข้อความ, ผ่าน: r.ok && d?.ok !== false } }))
      }
    } catch (e) {
      const ข้อความ = e instanceof Error ? e.message : 'ยิงไม่สำเร็จ'
      if (จริง) setผลเขียน((ก) => ({ ...ก, [sku]: ข้อความ }))
      else setซ้อม((ก) => ({ ...ก, [sku]: { ข้อความ, ผ่าน: false } }))
    } finally { setกำลังยิง(null) }
  }, [])

  const ดูรายตัว = useCallback(async (row: Row) => {
    if (เปิด === row.ชื่อ) { setเปิด(null); setรายตัว(null); return }
    setเปิด(row.ชื่อ); setรายตัว(null); setBusyRows(true)
    try {
      // บาร์: ชื่อคือ "ยี่ห้อ ขนาด" ⇒ ค้นด้วยขนาด (model) · เลื่อย: ชื่อคือ model ตรง ๆ
      const kind = row.ชนิด === 'เลื่อย' ? 'saw' : 'bar'
      const model = row.ชนิด === 'เลื่อย' ? row.ชื่อ : row.ชื่อ.split(' ').slice(-1)[0]
      const r = await fetch(`/api/web/core?registryrows=1&kind=${kind}&model=${encodeURIComponent(model)}&limit=500`)
      const d = await r.json()
      setรายตัว(Array.isArray(d.rows) ? d.rows : [])
    } catch { setรายตัว([]) } finally { setBusyRows(false) }
  }, [เปิด])

  const รายการ = sum?.รายการ ?? []
  const เลื่อย = รายการ.filter((x) => x.ชนิด === 'เลื่อย')
  const บาร์ = รายการ.filter((x) => x.ชนิด === 'บาร์')

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ทะเบียนเลื่อยโซ่ยนต์"
        summary="บัญชีรับ-จำหน่ายตามกฎหมาย เทียบกับจำนวนที่หน้าร้านเสิร์ฟอยู่จริง"
        actions={<BtnGhost onClick={() => void โหลด()}>ดึงข้อมูลใหม่</BtnGhost>}
      />

      {err && <ErrorBox>{err}</ErrorBox>}
      {sum?.skip && <ErrorBox title="ยังใช้ไม่ได้">{sum.skip}</ErrorBox>}
      {busy && !sum && <LoadingState />}

      {sum?.รวม && (
        <div className="bg-white border border-gray-200 rounded-md p-4 mt-3">
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-[13.5px]">
            <div><span className="text-gray-500">เลื่อยคงเหลือ </span>
              <b className="text-[17px]">{sum.รวม.เลื่อยเหลือ}</b> <span className="text-gray-500">เครื่อง</span></div>
            <div><span className="text-gray-500">บาร์คงเหลือ </span>
              <b className="text-[17px]">{sum.รวม.บาร์เหลือ}</b> <span className="text-gray-500">แผ่น</span></div>
            <div>
              <span className="text-gray-500">เทียบกับเว็บ </span>
              {sum.ไม่ตรง === 0 && sum.ยังไม่ได้จับคู่ === 0
                ? <b className="text-green-700">ตรงกันทุกรายการ</b>
                : <b className="text-red-600">
                    ไม่ตรง {sum.ไม่ตรง} · ยังไม่จับคู่ {sum.ยังไม่ได้จับคู่}
                  </b>}
            </div>
          </div>
          {/* ⚠️ คำเตือนนี้ต้องอยู่ตรงที่คนเห็นโดยไม่ต้องเลื่อนจอ — ไม่ใช่ซ่อนท้ายหน้า */}
          <p className="text-[12.5px] text-gray-500 mt-2">
            ตัวเลข “เว็บ” ฝังตอน deploy — แก้ทะเบียนในชีตแล้วต้องนำเข้าใหม่และ deploy ถึงจะขยับ ·
            ทะเบียนเป็นของ <b>หจก. นิวเวฟ ซันไชน์</b> (ผู้นำเข้า) ไม่ใช่ผู้ขาย
          </p>
          {/* 🔴 ข้อนี้ต้องอยู่บนจอ ไม่ใช่ในคอมเมนต์ — ไม่งั้น “ตรงกันทุกรายการ” จะถูกอ่านเกินจริง */}
          <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-2">
            ⚠️ “ตรงกัน” ข้างบนเทียบ <b>ทะเบียน D1 ↔ ตารางในโค้ด</b> เท่านั้น —
            <b> ยังไม่ได้เทียบกับชีทของท่าน</b> และสองขานั้นสร้างจากชีทภาพเดียวกัน (25 ก.ย.)
            ⇒ เก่าพร้อมกันได้ ⇒ ตรงกัน <b>ไม่ได้แปลว่าถูก</b>
            <br />ขาที่ยังไม่มี: {ขาที่ยังไม่มี}
          </p>
          <p className="text-[12.5px] text-gray-600 mt-2">
            สภาพ ZORT:{' '}
            {zortทั้งหมด === 0
              ? <span className="text-gray-400">ยังไม่เริ่มอ่าน</span>
              : zortอ่านแล้ว < zortทั้งหมด
                ? <b>กำลังอ่าน {zortอ่านแล้ว}/{zortทั้งหมด} รหัส…</b>
                : <>อ่านครบ <b>{zortทั้งหมด}</b> รหัส</>}
            {' · '}เลข “ติดจอง” เป็นค่าที่ <b>เราคิดเอง</b> จาก คงเหลือ − พร้อมขาย
            (ZORT ไม่ส่งช่องนี้มาให้)
          </p>
        </div>
      )}

      {[{ หัว: 'เลื่อยโซ่ยนต์ (ลซ.7/1)', ชุด: เลื่อย }, { หัว: 'แผ่นบังคับโซ่ (ลซ.7/2)', ชุด: บาร์ }]
        .filter((g) => g.ชุด.length > 0)
        .map((g) => (
          <div key={g.หัว} className="mt-4">
            <h2 className="text-[14px] font-semibold text-gray-800 mb-2">{g.หัว}</h2>
            <TableWrap>
              <table className="w-full min-w-[1040px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH}>รุ่น / ขนาด</th>
                  <th className={THR}>รับเข้าทั้งหมด</th>
                  <th className={THR}>ทะเบียนเหลือ</th>
                  <th className={THR}>ตารางในโค้ด</th>
                  <th className={THR}>ZORT คงเหลือ</th>
                  <th className={THR}>พร้อมขาย</th>
                  <th className={THR}>ติดจอง</th>
                  <th className={TH}>สถานะ</th>
                  <th className={TH}> </th>
                </tr>
              </thead>
              <tbody>
                {g.ชุด.map((x) => (
                  <Fragment key={x.ชื่อ}>
                    <tr className={x.ตรงกัน === false ? 'bg-red-50' : undefined}>
                      <td className={TD}>{x.ชื่อ}</td>
                      <td className={TDR}>{x.ทั้งหมด}</td>
                      <td className={TDR}><b>{x.ทะเบียนเหลือ}</b></td>
                      <td className={TDR}>{x.เว็บโชว์ === null ? <span className="text-gray-400">—</span> : x.เว็บโชว์}</td>
                      {/* 🔑 สามช่อง ZORT — **สามสถานะ ห้ามยุบ** และ "ไม่รู้" ห้ามแสดงเป็น 0
                          รวมหลายรหัสในกลุ่มเดียวด้วยการ **บวก** ไม่ได้ ⇒ โชว์รายรหัสในแถวขยาย
                          ที่นี่โชว์เฉพาะตอนกลุ่มมีรหัสเดียว · กลุ่มฝาแฝดให้กด "ดันเข้า ZORT" ดูรายรหัส */}
                      {(() => {
                        const หนึ่งรหัส = x.รหัสสินค้า.length === 1 ? x.รหัสสินค้า[0] : null
                        const z: สภาพZORT = หนึ่งรหัส
                          ? (zort[หนึ่งรหัส] ?? { สถานะ: 'ยังไม่อ่าน' })
                          : { สถานะ: 'ยังไม่อ่าน' }
                        const จ = จองอยู่(z)
                        const ป้าย = (v: number | null) =>
                          v === null ? <span className="text-gray-400">—</span> : <b>{v}</b>
                        if (!หนึ่งรหัส) return (
                          <td className={TD} colSpan={3}>
                            <span className="text-amber-700 text-[12.5px]">
                              {x.รหัสสินค้า.length} รหัสในขนาดนี้ — กดดูรายรหัส
                            </span>
                          </td>
                        )
                        return (
                          <>
                            <td className={TDR}>{z.สถานะ === 'มีค่า' ? <b>{z.คงเหลือ}</b> : ป้าย(null)}</td>
                            <td className={TDR}>{z.สถานะ === 'มีค่า' ? <b>{z.พร้อมขาย}</b> : ป้าย(null)}</td>
                            <td className={TDR}>
                              {จ === null ? ป้าย(null)
                                : จ > 0 ? <b className="text-amber-700">{จ}</b> : <span className="text-gray-400">0</span>}
                            </td>
                          </>
                        )
                      })()}
                      <td className={TD}>
                        {x.ตรงกัน === true && <span className="text-green-700">ตรงกัน</span>}
                        {x.ตรงกัน === false && (
                          <span className="text-red-600">
                            ต่างกัน {Math.abs((x.เว็บโชว์ ?? 0) - x.ทะเบียนเหลือ)}
                          </span>
                        )}
                        {/* 🔑 "ยังไม่จับคู่" ≠ "ตรงกัน" — ต้องแยกให้เห็น ไม่งั้นของที่ยังไม่ได้ตรวจ
                            จะดูเหมือนของที่ตรวจแล้วผ่าน (three-states-not-two) */}
                        {x.ตรงกัน === null && (
                          <span className="text-amber-700">ยังไม่จับคู่กับสินค้าในเว็บ</span>
                        )}
                      </td>
                      <td className={TD}>
                        <div className="flex gap-3">
                          <button
                            className="text-[12.5px] text-blue-700 hover:underline"
                            onClick={() => void ดูรายตัว(x)}
                          >
                            {เปิด === x.ชื่อ ? 'ปิด' : 'ดูรายตัว'}
                          </button>
                          {x.รหัสสินค้า.length > 0 && (
                            <button
                              className="text-[12.5px] text-blue-700 hover:underline"
                              onClick={() => setดัน(ดัน === x.ชื่อ ? null : x.ชื่อ)}
                            >
                              {ดัน === x.ชื่อ ? 'ปิด' : 'ดันเข้า ZORT'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {ดัน === x.ชื่อ && (
                      <tr>
                        <td colSpan={9} className="bg-blue-50/60 px-3 py-3">
                          <div className="text-[12.5px]">
                            <p className="mb-2">
                              ทะเบียนบอกว่าขนาดนี้เหลือ <b>{x.ทะเบียนเหลือ}</b> ·
                              เขียนลงช่อง <b>คงเหลือ</b> ของ ZORT คลัง <b>NEW (โกดัง)</b>
                            </p>
                            {/* 🔴 ขนาดเดียวมีหลายรหัส แต่ของมีกองเดียว ⇒ ห้ามเติมเลขให้อัตโนมัติ
                                (ชีทแท็บ 2566 ไม่ระบุรุ่นเครื่อง ⇒ บอกไม่ได้ว่า 7800/8800/9800) */}
                            {ต้องเลือกรหัสเอง(x.รหัสสินค้า) && (
                              <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-2">
                                ⚠️ ขนาดนี้มี {x.รหัสสินค้า.length} รหัสใน ZORT แต่ของมี <b>กองเดียว</b> —
                                ใส่เลขทั้งสองรหัสจะทำให้ลูกค้าเห็นของ <b>สองเท่าของที่มีจริง</b>
                                <br />⇒ <b>ท่านต้องพิมพ์เลขเองว่าให้รหัสไหนถือของ</b> ระบบไม่เติมให้
                              </p>
                            )}
                            <table className="min-w-full">
                              <tbody>
                                {x.รหัสสินค้า.map((sku) => {
                                  const z: สภาพZORT = zort[sku] ?? { สถานะ: 'ยังไม่อ่าน' }
                                  const ค่าในช่อง = รหัสที่เลือก[sku]
                                  const จะเขียน = ค่าในช่อง === undefined || ค่าในช่อง === ''
                                    ? (ต้องเลือกรหัสเอง(x.รหัสสินค้า) ? null : x.ทะเบียนเหลือ)
                                    : Number(ค่าในช่อง)
                                  const เตือน = คำเตือนแถว(
                                    จะเขียน === null || Number.isNaN(จะเขียน) ? null : จะเขียน, z)
                                  const คาด = จะเขียน === null || Number.isNaN(จะเขียน)
                                    ? null : คาดพร้อมขาย(จะเขียน, z)
                                  const ซ = ซ้อม[sku]
                                  return (
                                    <tr key={sku} className="border-t border-blue-200 align-top">
                                      <td className="py-2 pr-3 font-mono whitespace-nowrap">{sku}</td>
                                      <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                                        {z.สถานะ === 'มีค่า'
                                          ? <>คงเหลือ {z.คงเหลือ} · ขายได้ {z.พร้อมขาย}</>
                                          : z.สถานะ === 'ยังไม่อ่าน' ? <span className="text-gray-400">ยังไม่ได้อ่าน</span>
                                          : z.สถานะ === 'ไม่มีรหัสนี้' ? <span className="text-red-600">ZORT ไม่รู้จักรหัสนี้</span>
                                          : <span className="text-red-600">อ่านไม่ได้</span>}
                                      </td>
                                      <td className="py-2 pr-3 whitespace-nowrap">
                                        <input
                                          type="number"
                                          className="w-20 border border-gray-300 rounded px-2 py-1"
                                          placeholder={ต้องเลือกรหัสเอง(x.รหัสสินค้า) ? 'พิมพ์เลข' : String(x.ทะเบียนเหลือ)}
                                          value={ค่าในช่อง ?? ''}
                                          onChange={(e) => setรหัสที่เลือก((ก) => ({ ...ก, [sku]: e.target.value }))}
                                        />
                                      </td>
                                      <td className="py-2 pr-3">
                                        {คาด !== null && (
                                          <span className={คาด < 0 ? 'text-red-600' : 'text-gray-700'}>
                                            คาดพร้อมขายหลังเขียน <b>{คาด}</b>
                                          </span>
                                        )}
                                        {เตือน && <div className="text-amber-800 mt-0.5">⚠️ {เตือน}</div>}
                                        {ผลเขียน[sku] && (
                                          <pre className="mt-1 bg-white border border-gray-200 rounded p-1.5 overflow-x-auto max-h-40">{ผลเขียน[sku]}</pre>
                                        )}
                                        {ซ && (
                                          <pre className="mt-1 bg-white border border-gray-200 rounded p-1.5 overflow-x-auto max-h-40">{ซ.ข้อความ}</pre>
                                        )}
                                      </td>
                                      <td className="py-2 whitespace-nowrap">
                                        {/* กดครั้งแรก = โหมดซ้อม เสมอ · ปุ่มยืนยันโผล่หลังเห็นผลซ้อมแล้วเท่านั้น */}
                                        <button
                                          className="text-blue-700 hover:underline disabled:text-gray-400"
                                          disabled={กำลังยิง === sku || จะเขียน === null || Number.isNaN(จะเขียน)
                                            || z.สถานะ === 'ไม่มีรหัสนี้'}
                                          onClick={() => void ยิง(sku, จะเขียน as number, false)}
                                        >
                                          {กำลังยิง === sku ? 'กำลังยิง…' : 'ซ้อม (ไม่เขียน)'}
                                        </button>
                                        {ซ && (
                                          <button
                                            className="ml-3 text-red-700 font-semibold hover:underline disabled:text-gray-400"
                                            disabled={กำลังยิง === sku}
                                            onClick={() => void ยิง(sku, จะเขียน as number, true)}
                                          >
                                            ยืนยันเขียนจริง
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                    {เปิด === x.ชื่อ && (
                      <tr>
                        <td colSpan={9} className="bg-gray-50 px-3 py-2">
                          {busyRows && <span className="text-[12.5px] text-gray-500">กำลังโหลด…</span>}
                          {!busyRows && รายตัว && (
                            <div className="text-[12.5px]">
                              <p className="text-gray-500 mb-1">
                                {รายตัว.length} ใบ · มีชื่อลูกค้าและเลขใบ ลซ.๒ — ห้ามถ่ายจอส่งต่อ
                              </p>
                              <div className="overflow-x-auto">
                                <table className="min-w-full">
                                  <tbody>
                                    {รายตัว.map((s) => (
                                      <tr key={`${s.lot}-${s.serial}`} className="border-t border-gray-200">
                                        <td className="py-1 pr-3 font-mono">{s.serial}</td>
                                        <td className="py-1 pr-3">
                                          {s.sold_at
                                            ? <span className="text-gray-500">ขาย {s.sold_at}</span>
                                            : <span className="text-green-700">ยังอยู่</span>}
                                        </td>
                                        <td className="py-1 pr-3">{s.buyer || ''}</td>
                                        <td className="py-1 pr-3">{s.lz2 || ''}</td>
                                        <td className="py-1">{s.province || ''}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              </table>
            </TableWrap>
          </div>
        ))}

      {!busy && !err && รายการ.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-4 mt-3 text-[13px] text-gray-600">
          ยังไม่มีข้อมูลทะเบียนในระบบ — นำเข้าด้วย <code>POST /api/core?registryimport=1</code>
        </div>
      )}
    </div>
  )
}
