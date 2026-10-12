'use client'
// จับคู่รหัสอะไหล่ STIHL → รหัสสินค้าร้าน — ท่านประธานสั่งเอง 11 ต.ค. 2569
// "รหัสผมจะลงจับคู่เองด้วยมือ ขอให้คุณทำช่องให้ผมใส่ง่ายๆ"
//
// 🔑 **ออกแบบรอบ "คนนั่งพิมพ์เป็นร้อยตัว" ไม่ใช่รอบ "ดูข้อมูล"**
//    F440 มี 368 ชิ้น · F070 มี 377 ⇒ พิมพ์แล้วกด Enter ต้องไปช่องว่างถัดไปทันที
//    ⇒ **ไม่มีปุ่ม "บันทึกทั้งหมด"** เพราะกรอกค้างครึ่งทางแล้วเน็ตหลุด = เสียงานทั้งหน้า
//
// 🔴 **ส่งทีละคำขอ เข้าคิว ห้ามยิงขนาน** — เส้น `/api/parts-map` เก็บ **ทั้งรุ่นในคีย์เดียว**
//    และบันทึกแบบ อ่าน-แก้-เขียน (คอมเมนต์ในไฟล์เซิร์ฟเวอร์เตือนข้อนี้ไว้เอง:
//    "วันไหนมีคนกรอกพร้อมกันหลายคน ต้องเปลี่ยนเป็นหนึ่งชิ้น-หนึ่งคีย์ทันที")
//    ⇒ ยิงสองคำขอพร้อมกัน ตัวหลังอ่านของเก่ามาเขียนทับ ⇒ **ค่าที่เพิ่งกรอกหายเงียบ**
//    ⇒ และ "พิมพ์รัว ๆ" คือกรณีที่ทำให้แข่งกันเขียนพอดี
import { useCallback, useEffect, useRef, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost } from '@/components/zort'
import {
  type ข้อมูลรุ่น, type แถว, ล้างsku, แบนรายการ, สถานะของแถว, ความคืบหน้า, ช่องถัดไป,
} from '@/lib/parts-map'

/* รุ่นที่มีไฟล์อะไหล่จริง — ยิงยืนยันแล้ว 11 ต.ค. 2569 ที่ gucut.com/parts/<รุ่น>.json
   ⚠️ เพิ่มรุ่นใหม่แล้วลืมแก้ที่นี่ รุ่นนั้นจะไม่โผล่ **โดยไม่มีอะไรฟ้อง** */
const รุ่นทั้งหมด = [
  { id: 'f070', ชื่อ: 'F 070' }, { id: 'f090', ชื่อ: 'F 090' }, { id: 'f250', ชื่อ: 'F 250' },
  { id: 'f381', ชื่อ: 'F 381' }, { id: 'f440', ชื่อ: 'F 440' }, { id: 'f660', ชื่อ: 'F 660' },
]

export default function Page() {
  const [รุ่น, setรุ่น] = useState('f440')
  const [ข้อมูล, setข้อมูล] = useState<ข้อมูลรุ่น | null>(null)
  const [แมป, setแมป] = useState<Record<string, string>>({})
  const [ร่าง, setร่าง] = useState<Record<string, string>>({})
  const [กำลังส่ง, setกำลังส่ง] = useState<Record<string, boolean>>({})
  const [ล้มเหลว, setล้มเหลว] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(true)
  const [err, setErr] = useState('')
  const [เฉพาะว่าง, setเฉพาะว่าง] = useState(false)
  const ช่อง = useRef<Record<number, HTMLInputElement | null>>({})
  /* คิวส่ง — สัญญาเดียวต่อกันไปเรื่อย ๆ ⇒ คำขอถัดไปเริ่มหลังตัวก่อนจบเสมอ */
  const คิว = useRef<Promise<unknown>>(Promise.resolve())

  const โหลด = useCallback(async (m: string) => {
    setBusy(true); setErr(''); setข้อมูล(null); setแมป({}); setร่าง({}); setล้มเหลว({})
    try {
      const [ด, ม] = await Promise.all([
        fetch(`/api/parts-data?model=${encodeURIComponent(m)}`).then((r) => r.json()),
        fetch(`/api/web/parts-map?model=${encodeURIComponent(m)}`).then((r) => r.json()),
      ])
      /* 🔑 ท่อตอบ error มาก็ต้องขึ้นจอ — ไม่ใช่ปล่อยให้จอว่างแล้วเขียนว่า "ไม่มีรายการอะไหล่"
         (อ่านไม่ได้ ≠ ไม่มีของ · ของจริงเคยพลาดเพราะ CORS แล้วจอว่างเงียบ) */
      if (ด && ด.error) throw new Error(String(ด.error))
      setข้อมูล(ด)
      setแมป(ม && typeof ม.map === 'object' && ม.map ? ม.map : {})
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ')
    } finally { setBusy(false) }
  }, [])

  useEffect(() => { void โหลด(รุ่น) }, [รุ่น, โหลด])

  /** บันทึกหนึ่งชิ้น — เข้าคิวเสมอ · อ่านค่าจากคำตอบของท่อ ไม่เชื่อว่า 200 แปลว่าเขียนตามที่ส่ง */
  const บันทึก = useCallback((คีย์: string, ค่า: string) => {
    const sku = ล้างsku(ค่า)
    setกำลังส่ง((ก) => ({ ...ก, [คีย์]: true }))
    setล้มเหลว((ก) => { const ข = { ...ก }; delete ข[คีย์]; return ข })
    คิว.current = คิว.current.then(async () => {
      try {
        const r = await fetch(`/api/web/parts-map?model=${encodeURIComponent(รุ่น)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ part: คีย์, sku }),
        })
        const d = await r.json().catch(() => null)
        if (!r.ok || (d && d.error)) throw new Error(String((d && d.error) || `HTTP ${r.status}`))
        /* 🔑 เอาค่าจาก **คำตอบของท่อ** ถ้ามี — ท่อล้างค่าอีกชั้น
           ถ้าเก็บค่าที่เราพิมพ์ไว้ จอจะไม่ตรงกับฐานโดยไม่มีอะไรฟ้อง */
        const จากท่อ = d && typeof d.map === 'object' && d.map ? ล้างsku(d.map[คีย์]) : sku
        setแมป((ก) => ({ ...ก, [คีย์]: จากท่อ }))
        setร่าง((ก) => { const ข = { ...ก }; delete ข[คีย์]; return ข })
      } catch (e) {
        setล้มเหลว((ก) => ({ ...ก, [คีย์]: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ' }))
      } finally {
        setกำลังส่ง((ก) => { const ข = { ...ก }; delete ข[คีย์]; return ข })
      }
    })
  }, [รุ่น])

  const รายการทั้งหมด = แบนรายการ(ข้อมูล)
  const คืบ = ความคืบหน้า(รายการทั้งหมด, แมป)
  const รายการ = เฉพาะว่าง
    ? รายการทั้งหมด.filter((r) => !ล้างsku(แมป[r.คีย์]))
    : รายการทั้งหมด

  const ไปช่องถัดไป = (จาก: number) => {
    const n = ช่องถัดไป(รายการทั้งหมด, จาก, แมป)
    if (n === null) return
    const el = ช่อง.current[n]
    if (el) { el.focus(); el.select() }
  }

  let กลุ่มก่อนหน้า = ''
  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="จับคู่รหัสอะไหล่"
        summary="รหัสในคู่มือ STIHL → รหัสสินค้าของร้าน · พิมพ์แล้วกด Enter เพื่อไปช่องว่างถัดไป"
        actions={<BtnGhost onClick={() => void โหลด(รุ่น)}>ดึงข้อมูลใหม่</BtnGhost>}
      />

      {err && <ErrorBox>{err}</ErrorBox>}

      <div className="bg-white border border-gray-200 rounded-md p-3 mt-3">
        <div className="flex flex-wrap items-center gap-2">
          {รุ่นทั้งหมด.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setรุ่น(m.id)}
              aria-pressed={รุ่น === m.id}
              className={`px-3 py-2 rounded-md border text-[12.5px] min-h-[40px] ${
                รุ่น === m.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300'
              }`}
            >{m.ชื่อ}</button>
          ))}
        </div>
        {!busy && ข้อมูล && (
          <div className="mt-3 text-[12.5px]">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <span><b className="text-[17px]">{คืบ.จับคู่แล้ว}</b>
                <span className="text-gray-500"> / {คืบ.ทั้งหมด} รหัส</span></span>
              {/* 🔑 แถว ≠ รหัส — ชิ้นเดียวกันโผล่หลายกลุ่มได้ ⇒ บอกสองเลขกันคนอ่านสับสน */}
              <span className="text-gray-500">{คืบ.แถว} แถวในคู่มือ (รหัสซ้ำข้ามกลุ่มได้)</span>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={เฉพาะว่าง}
                  onChange={(e) => setเฉพาะว่าง(e.target.checked)} />
                เฉพาะที่ยังไม่จับคู่
              </label>
            </div>
            <div className="h-2 bg-gray-200 rounded mt-2 overflow-hidden">
              <div className="h-full bg-gray-900"
                style={{ width: `${คืบ.ทั้งหมด ? (คืบ.จับคู่แล้ว / คืบ.ทั้งหมด) * 100 : 0}%` }} />
            </div>
            <p className="text-gray-500 mt-2">
              กรอกแล้วบันทึกทันทีทีละช่อง — ไม่มีปุ่มบันทึกรวม ·
              เว้นว่างแล้ว Enter = ลบการจับคู่ของรหัสนั้น
            </p>
          </div>
        )}
      </div>

      {busy && <LoadingState />}

      {!busy && ข้อมูล && (
        <div className="mt-3 space-y-1">
          {รายการ.map((r: แถว) => {
            const ส = สถานะของแถว(r.คีย์, แมป, กำลังส่ง, ล้มเหลว)
            /* 🔑 รวมหัวที่ "ตัวอักษร+ชื่อ" เหมือนกัน — ข้อมูลจริงแยกแผ่นภาพ (`a` กับ `a2`)
               แต่เป็นหมวดเดียวกัน ⇒ ถ้าใช้ `กลุ่มId` จะได้หัว "A · Crankcase" สองครั้งติดกัน
               (f440 ซ้ำ 4 หมวด · J ซ้ำถึง 3 แผ่น) ⇒ คนกรอกจะงงว่าเลื่อนย้อนกลับมาหรือเปล่า */
            const หัวนี้ = `${r.ตัวอักษร} · ${r.กลุ่มชื่อ}`
            const หัวกลุ่ม = หัวนี้ !== กลุ่มก่อนหน้า
            if (หัวกลุ่ม) กลุ่มก่อนหน้า = หัวนี้
            const ค่าในช่อง = ร่าง[r.คีย์] !== undefined ? ร่าง[r.คีย์] : (แมป[r.คีย์] || '')
            return (
              <div key={`${r.กลุ่มId}-${r.ลำดับ}`}>
                {หัวกลุ่ม && (
                  <h2 className="text-[14px] font-semibold text-gray-800 mt-4 mb-1">
                    {หัวนี้}
                  </h2>
                )}
                <div className="bg-white border border-gray-200 rounded-md px-3 py-2
                                flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="w-7 h-7 shrink-0 rounded-full bg-gray-100 text-gray-700
                                   text-[12.5px] flex items-center justify-center">{r.เลข}</span>
                  <span className="font-mono text-[12.5px] whitespace-nowrap">{r.รหัส}</span>
                  <span className="text-[12.5px] text-gray-600 grow min-w-[140px]">{r.ชื่อ}</span>
                  <span className="text-[11.5px] text-gray-400 whitespace-nowrap">×{r.จำนวน}</span>
                  <input
                    ref={(el) => { ช่อง.current[r.ลำดับ] = el }}
                    className="w-32 border border-gray-300 rounded px-2 py-1.5 text-[12.5px] min-h-[40px]"
                    placeholder="รหัสร้าน"
                    value={ค่าในช่อง}
                    onChange={(e) => setร่าง((ก) => ({ ...ก, [r.คีย์]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      บันทึก(r.คีย์, ค่าในช่อง)
                      ไปช่องถัดไป(r.ลำดับ)
                    }}
                    onBlur={() => {
                      /* ออกจากช่องโดยไม่กด Enter ก็ต้องบันทึก — ไม่งั้นงานที่พิมพ์ไว้หาย */
                      const ร = ร่าง[r.คีย์]
                      if (ร !== undefined && ล้างsku(ร) !== ล้างsku(แมป[r.คีย์] || '')) บันทึก(r.คีย์, ร)
                    }}
                  />
                  {/* 🔴 สี่สถานะ ห้ามยุบ — "บันทึกไม่สำเร็จ" ต้องไม่ดูเหมือน "ยังไม่จับคู่"
                      ไม่งั้นจะกรอกซ้ำทั้งที่เหตุคือเน็ตหลุด */}
                  <span className="text-[11.5px] whitespace-nowrap w-[108px]">
                    {ส === 'จับคู่แล้ว' && <span className="text-green-700">● จับคู่แล้ว</span>}
                    {ส === 'ยังไม่จับคู่' && <span className="text-gray-400">○ ยังไม่จับคู่</span>}
                    {ส === 'กำลังบันทึก' && <span className="text-amber-700">◌ กำลังบันทึก…</span>}
                    {ส === 'บันทึกไม่สำเร็จ' && (
                      <span className="text-red-600" title={ล้มเหลว[r.คีย์]}>▲ บันทึกไม่สำเร็จ</span>
                    )}
                  </span>
                </div>
              </div>
            )
          })}
          {รายการ.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-md p-4 text-[12.5px] text-gray-600">
              {เฉพาะว่าง ? 'จับคู่ครบทุกรหัสของรุ่นนี้แล้ว' : 'รุ่นนี้ยังไม่มีรายการอะไหล่'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
