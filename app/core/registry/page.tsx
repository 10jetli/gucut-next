'use client'
// ทะเบียนบัญชีรับ-จำหน่ายเลื่อยโซ่ยนต์ — เทียบกับจำนวนที่เว็บเสิร์ฟอยู่จริง
//
// ท่านประธานสั่ง 25 ก.ย. 2569: "ทำจอในเมนู JET ที่โชว์ทะเบียนกับเว็บเทียบกัน"
// และ **"ตัด zort ออกได้เลย มันทำไม่ได้ zort ไม่เก่ง"**
// ⇒ จอนี้เทียบ **สองทาง** ทะเบียน vs เว็บ · ไม่มีคอลัมน์ ZORT โดยตั้งใจ
//    (พิสูจน์แล้วว่า ZORT มีซีเรียลที่ว่ายังมีของ ทั้งที่ทะเบียนบอกขายไปแล้ว 3 ใบ)
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
    <div>
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
        </div>
      )}

      {[{ หัว: 'เลื่อยโซ่ยนต์ (ลซ.7/1)', ชุด: เลื่อย }, { หัว: 'แผ่นบังคับโซ่ (ลซ.7/2)', ชุด: บาร์ }]
        .filter((g) => g.ชุด.length > 0)
        .map((g) => (
          <div key={g.หัว} className="mt-4">
            <h2 className="text-[14px] font-semibold text-gray-800 mb-2">{g.หัว}</h2>
            <TableWrap>
              <table className="w-full min-w-[720px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH}>รุ่น / ขนาด</th>
                  <th className={THR}>รับเข้าทั้งหมด</th>
                  <th className={THR}>ทะเบียนเหลือ</th>
                  <th className={THR}>เว็บโชว์</th>
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
                        <button
                          className="text-[12.5px] text-blue-700 hover:underline"
                          onClick={() => void ดูรายตัว(x)}
                        >
                          {เปิด === x.ชื่อ ? 'ปิด' : 'ดูรายตัว'}
                        </button>
                      </td>
                    </tr>
                    {เปิด === x.ชื่อ && (
                      <tr>
                        <td colSpan={6} className="bg-gray-50 px-3 py-2">
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
