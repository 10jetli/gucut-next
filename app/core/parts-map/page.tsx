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
import { แปลชื่ออะไหล่ } from '@/lib/parts-thai'
import {
  type ข้อมูลรุ่น, type แถว, ล้างsku, ตรวจรหัสร้าน, แบนรายการ, สถานะของแถว, ความคืบหน้า, ช่องถัดไป,
} from '@/lib/parts-map'

/* 🔴 **รายชื่อรุ่นห้ามเขียนตายตัวอีก** (แก้ 17 ต.ค. 2569 — ท่านประธานสั่ง "หมวดอื่นๆ ลงให้ครบ")
   ของเดิมเขียนไว้ 6 รุ่นตั้งแต่ 11 ต.ค. พร้อมคอมเมนต์เตือนตัวเองว่า
   "เพิ่มรุ่นใหม่แล้วลืมแก้ที่นี่ รุ่นนั้นจะไม่โผล่ โดยไม่มีอะไรฟ้อง"
   ⇒ **คำเตือนนั้นเป็นจริงภายใน 6 วัน** — เพิ่มไป 11 รุ่น หน้านี้ไม่รู้สักรุ่น
      (288XP · 5200 · 7800TB · MINI · 7800 SUPER-S · F180 · F361 · F038 · F360 · F880 · F382)
   🔑 คำเตือนที่พึ่งความจำคนไม่ใช่ตาข่าย — ทางแก้คืออ่านจากแหล่งเดียวกับหน้าร้าน
      models.json ถูก gen ใหม่ทุกครั้งที่ build ⇒ เพิ่มรุ่นครั้งหน้า หน้านี้ตามเอง */
const รุ่นสำรอง = [
  { id: 'f070', ชื่อ: 'F 070' }, { id: 'f090', ชื่อ: 'F 090' }, { id: 'f250', ชื่อ: 'F 250' },
  { id: 'f381', ชื่อ: 'F 381' }, { id: 'f440', ชื่อ: 'F 440' }, { id: 'f660', ชื่อ: 'F 660' },
]

/** รายชื่อรุ่นจากหน้าร้าน — แหล่งเดียวกับที่ /parts/ ใช้จริง
 *  ⚠️ อ่านไม่ได้ ⇒ คืนรายชื่อสำรอง **ห้ามคืนรายการว่าง**
 *     ว่าง = แถบเลือกรุ่นหายทั้งแถบ ⇒ คนใช้คิดว่าข้อมูลอะไหล่หาย ทั้งที่แค่เน็ตสะดุด */
async function ดึงรายชื่อรุ่น(): Promise<{ id: string; ชื่อ: string }[]> {
  try {
    const r = await fetch('https://gucut.com/parts/models.json', { cache: 'no-store' })
    if (!r.ok) return รุ่นสำรอง
    const j = await r.json()
    const ms = Array.isArray(j) ? j : (j?.รุ่น ?? j?.models ?? [])
    const out = ms
      .map((m: any) => ({ id: String(m?.slug ?? ''), ชื่อ: String(m?.ชื่อ ?? m?.slug ?? '') }))
      .filter((m: { id: string }) => m.id)
    return out.length ? out : รุ่นสำรอง
  } catch {
    return รุ่นสำรอง
  }
}

/** รูปสินค้าของร้าน: รหัสร้าน → {รูป, ชื่อ}
 *  มาจากฟีดสาธารณะ /products.json ซึ่งมีอยู่แล้วเพื่อให้ AI อ่าน ⇒ ไม่ต้องทำท่อใหม่
 *
 *  ⚠️ โหลดไม่สำเร็จ ⇒ **ไม่โชว์รูป แต่หน้าต้องใช้งานได้ปกติทุกอย่าง**
 *     รูปเป็นของช่วยดู ไม่ใช่ของที่งานนี้ต้องมี · ให้หน้าพังเพราะรูปโหลดไม่ได้คือเอาหางไปคุมหัว
 *  ⚠️ รหัสในฟีดเป็นรหัสระดับสินค้า ตัวเลือกย่อยอาจไม่อยู่ในนั้น ⇒ หาไม่เจอเป็นเรื่องปกติ
 *     **ห้ามตีความว่า "ไม่เจอรูป = จับคู่ผิด"** */
async function โหลดรูปสินค้า(): Promise<Record<string, { รูป: string; ชื่อ: string }>> {
  try {
    const r = await fetch('https://gucut.com/products.json', { cache: 'no-store' })
    if (!r.ok) return {}
    const j = await r.json()
    const arr = Array.isArray(j) ? j : (j?.products ?? j?.items ?? [])
    if (!Array.isArray(arr)) return {}
    const out: Record<string, { รูป: string; ชื่อ: string }> = {}
    for (const it of arr) {
      const sku = String(it?.sku ?? '').trim().toUpperCase()
      const รูป = String(it?.image ?? '')
      if (sku && รูป) out[sku] = { รูป, ชื่อ: String(it?.name ?? '') }
    }
    return out
  } catch { return {} }
}

/** ลิงก์หารูปอ้างอิง — เปิดแท็บใหม่ไปหน้าค้นหารูป
 *  🔴 **เปิดลิงก์เท่านั้น ห้ามดึงรูปมาแสดงหรือเก็บ** — รูปในผลค้นหาเป็นของเจ้าอื่น
 *     ท่านประธานยืนยันเจตนาไว้ว่าเป็นภาพดูประกอบ ไม่เอาลงเว็บ (17 ต.ค. 2569)
 *  🔑 ใส่ทั้งรหัสคู่มือและชื่ออังกฤษ + คำว่า chainsaw
 *     รหัสเดี่ยว ๆ ให้ผลเป็นเว็บขายอะไหล่ซึ่งมีรูปตรงที่สุด ส่วนชื่อช่วยตอนรหัสไม่ติด */
function ลิงก์หารูป(รหัส: string, ชื่อ: string) {
  const q = [รหัส, ชื่อ, 'chainsaw'].filter(Boolean).join(' ')
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`
}

export default function Page() {
  const [รุ่น, setรุ่น] = useState('f440')
  const [รุ่นทั้งหมด, setรุ่นทั้งหมด] = useState(รุ่นสำรอง)
  useEffect(() => { ดึงรายชื่อรุ่น().then(setรุ่นทั้งหมด) }, [])
  const [รูปสินค้า, setรูปสินค้า] = useState<Record<string, { รูป: string; ชื่อ: string }>>({})
  useEffect(() => { โหลดรูปสินค้า().then(setรูปสินค้า) }, [])
  const [ข้อมูล, setข้อมูล] = useState<ข้อมูลรุ่น | null>(null)
  const [แมป, setแมป] = useState<Record<string, string>>({})
  const [ร่าง, setร่าง] = useState<Record<string, string>>({})
  /** คำเตือนรายแถว — "บันทึกแล้วแต่ไม่ตรงกับที่พิมพ์" ซึ่งไม่ใช่ทั้งสำเร็จและไม่ใช่ทั้งล้มเหลว */
  const [เตือน, setเตือน] = useState<Record<string, string>>({})
  const [กำลังส่ง, setกำลังส่ง] = useState<Record<string, boolean>>({})
  const [ล้มเหลว, setล้มเหลว] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(true)
  const [err, setErr] = useState('')
  const [เฉพาะว่าง, setเฉพาะว่าง] = useState(false)
  const ช่อง = useRef<Record<number, HTMLInputElement | null>>({})
  /* คิวส่ง — สัญญาเดียวต่อกันไปเรื่อย ๆ ⇒ คำขอถัดไปเริ่มหลังตัวก่อนจบเสมอ */
  const คิว = useRef<Promise<unknown>>(Promise.resolve())

  const โหลด = useCallback(async (m: string) => {
    setBusy(true); setErr(''); setข้อมูล(null); setแมป({}); setร่าง({}); setล้มเหลว({}); setเตือน({})
    try {
      /* 🔴 **ตัวกันแคชที่ขาอ่านตารางจับคู่ — ไม่ใช่ของประดับ** (วัดจริง 12 ต.ค. 2569)
         `/api/parts-map` ขา GET ของท่อคืน `s-maxage=60` ⇒ ขอบเครือข่ายจ่ายคำตอบเก่าได้ถึงนาที
         ยิงวัดแล้ว: เขียนเสร็จ ยิงอ่านทันที ได้ `{}` อยู่ **44 วินาที** (age ไต่ 21→53 แล้วค่อยพลิก)
         ส่วนคำขอเดียวกันที่เติมตัวกันแคช ได้ของจริง **ตั้งแต่วินาทีแรก** ⇒ ของเขียนลงแล้ว แคชบังอยู่
         ⇒ หน้านี้คือ **คนเขียนที่กำลังอ่านของตัวเอง** (ท่านนั่งกรอกเป็นร้อยตัว แล้วสลับรุ่นไปมา)
            เห็นของที่เพิ่งพิมพ์หายไป = พิมพ์ซ้ำ แล้วเชื่อว่าจอพัง ทั้งที่ของอยู่ครบ
         ⚠️ `cache: 'no-store'` อย่างเดียวไม่พอ — มันคุมแคชในเบราว์เซอร์ ไม่ได้คุมขอบเครือข่าย
            ตัวที่คุมได้คือ **url ที่ไม่ซ้ำ** · ขา /parts/ ของลูกค้ายังใช้แคชเดิมต่อไป ไม่ถูกแตะ */
      const [ด, ม] = await Promise.all([
        fetch(`/api/parts-data?model=${encodeURIComponent(m)}`).then((r) => r.json()),
        fetch(`/api/web/parts-map?model=${encodeURIComponent(m)}&_=${Date.now()}`, { cache: 'no-store' })
          .then((r) => r.json()),
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
    /* 🔴 **ตรวจก่อนบันทึก — เจอตอนพิมพ์จริงบนเว็บจริง 12 ต.ค. 2569**
       พิมพ์ `ทดสอบ-ลบทิ้ง` ⇒ ท่อเก็บแค่ `-` แล้วจอขึ้นป้ายเขียว "จับคู่แล้ว" ตัวนับเดินเป็น 1
       เหตุ: `[^\w.-]` ของ JS **ไม่นับอักษรไทยเป็น `\w`** ⇒ ตัวไทยถูกตัดทิ้งหมด
       ⇒ ระบบถูกทุกชั้น (ล้างค่าตรงกับเซิร์ฟเวอร์เป๊ะ · บันทึกสำเร็จจริง)
          แต่ **ยืนยันกับคนว่าสำเร็จในสิ่งที่เขาไม่ได้พิมพ์**
       ⚠️ ห้ามแก้ `ล้างsku` — มันต้องตรงกับเซิร์ฟเวอร์ ไม่งั้นคีย์เพี้ยนกันสองฝั่ง
          ⇒ เพิ่ม **ชั้นตรวจ** แยกต่างหาก แล้วให้จอพูดต่างกันตามผล */
    const ผลตรวจ = ตรวจรหัสร้าน(ค่า)
    if (ผลตรวจ.สภาพ === 'ใช้ไม่ได้') {
      /* ค่าอย่าง `-` หรือ `.` ผ่านตัวล้างได้สบาย แล้วหน้าร้านจะขึ้น "มีขาย" ให้รหัสที่ไม่มีอยู่
         ⇒ ไม่บันทึกเลย และบอกว่าทำไม — ไม่ใช่เงียบแล้วเก็บเศษ
         🔴 **ห้ามใช้ช่อง `ล้มเหลว`** แม้ผลจะคล้ายกัน เพราะสองเรื่องนี้ต่างกัน:
            "บันทึกไม่สำเร็จ" = เราพยายามแล้วแต่ไม่ผ่าน (เน็ตหลุด/ท่อตาย) ⇒ ลองใหม่ได้
            อันนี้ = **เราไม่ได้พยายามเลย** เพราะค่าที่พิมพ์ใช้ไม่ได้ ⇒ ต้องพิมพ์ใหม่
            บอกผิดชนิด คนจะกด Enter ซ้ำแล้วงงว่าทำไมไม่ติด
         🔴 และเหตุผลต้อง **เห็นบนจอ** ไม่ใช่ซ่อนใน `title` — จอนี้ใช้บนมือถือ
            ซึ่ง **ไม่มีการชี้ค้าง** ⇒ tooltip = ข้อความที่ไม่มีใครได้อ่าน */
      /* 🔑 เหตุผลมาจาก **ตัวตรวจ** ไม่ได้พิมพ์ซ้ำที่นี่ — ข้อความกับตรรกะต้องมาจากที่เดียวกัน
         (ถ้าพิมพ์เอง วันที่เกณฑ์เปลี่ยน ข้อความจะค้างอยู่กับเกณฑ์เก่าโดยไม่มีอะไรฟ้อง) */
      setเตือน((ก) => ({ ...ก, [คีย์]: `ไม่ได้บันทึก — ${ผลตรวจ.เหตุ}` }))
      return
    }
    const sku = ผลตรวจ.sku
    if (ผลตรวจ.สภาพ === 'จัดระเบียบ') {
      /* ของใหม่ **ไม่ตัดอักขระทิ้งแล้ว** — เหลือแค่ยุบช่องว่าง/ตัดหัวท้าย
         แต่ยังต้องบอก เพราะสิ่งที่เก็บไม่ตรงกับที่พิมพ์ทุกตัวอักษร */
      setเตือน((ก) => ({ ...ก, [คีย์]: ผลตรวจ.เหตุ }))
    } else {
      setเตือน((ก) => { const ข = { ...ก }; delete ข[คีย์]; return ข })
    }
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
            const คำแปล = แปลชื่ออะไหล่(r.ชื่อ).ไทย || r.ชื่อ
            /* รูปของร้านโชว์เฉพาะเมื่อ **บันทึกแล้วจริง** ไม่ใช่ตอนกำลังพิมพ์
               ไม่งั้นรูปจะกระพริบเปลี่ยนไปมาทุกตัวอักษรที่พิมพ์ */
            const รูปของแถว = รูปสินค้า[(แมป[r.คีย์] || '').trim().toUpperCase()] || null
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
                  {/* 🔑 **รูปสองทางตามสถานะ** — จับคู่แล้วโชว์รูปของร้าน (ยืนยันว่าใส่ถูกตัว)
                      ยังไม่จับคู่ให้ปุ่มหารูปอ้างอิง (ตอบว่าชิ้นนี้หน้าตายังไง)
                      ⚠️ ที่ว่างต้องกว้างเท่ากันทั้งสองทาง ไม่งั้นแถวกระตุกตอนกรอกเสร็จ */}
                  <span className="w-11 h-11 shrink-0 flex items-center justify-center">
                    {รูปของแถว ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={รูปของแถว.รูป} alt={รูปของแถว.ชื่อ} title={รูปของแถว.ชื่อ}
                           className="w-11 h-11 object-contain rounded border border-gray-200 bg-white" />
                    ) : (
                      <a href={ลิงก์หารูป(r.รหัส, r.ชื่อ)} target="_blank" rel="noopener noreferrer"
                         title={`หารูปอ้างอิงของ ${r.รหัส} — เปิดแท็บใหม่ ไม่ได้เก็บรูปลงเว็บ`}
                         className="w-9 h-9 rounded border border-gray-300 text-gray-500
                                    flex items-center justify-center text-[14px] hover:bg-gray-50">🔍</a>
                    )}
                  </span>
                  <span className="font-mono text-[12.5px] whitespace-nowrap">{r.รหัส}</span>
                  {/* 🔴 **ชื่อไทยเพิ่มเข้ามา แต่อังกฤษห้ามหาย** (ท่านประธานสั่ง "แปลไทย" 17 ต.ค. 2569)
                      คนที่กรอกหน้านี้ถือคู่มือ**ภาษาอังกฤษ**อยู่ในมือ โชว์แต่ไทย = หาแถวในคู่มือไม่เจอ
                      ⇒ คำแปลที่ทำให้ทำงานช้าลงคือคำแปลที่ผิดหน้าที่ */}
                  <span className="text-[12.5px] grow min-w-[140px]">
                    <span className="text-gray-800">{คำแปล}</span>
                    {คำแปล !== r.ชื่อ && (
                      <span className="text-gray-400 ml-1.5 text-[11.5px]">{r.ชื่อ}</span>
                    )}
                  </span>
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
                {/* 🔑 **สถานะที่ห้าที่เคยไม่มี: "บันทึกแล้วแต่ไม่ตรงกับที่พิมพ์"**
                    ไม่ใช่สำเร็จ (คนพิมพ์อีกอย่าง) และไม่ใช่ล้มเหลว (ของลงฐานแล้วจริง)
                    ⇒ ต้องเป็นข้อความของตัวเอง · ยุบเข้ากองไหนก็โกหกคนอ่านทั้งคู่ */}
                {เตือน[r.คีย์] && (
                  <div className="text-[11.5px] text-amber-800 mt-1 ml-[132px]">
                    ⚠ {เตือน[r.คีย์]}
                  </div>
                )}
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
