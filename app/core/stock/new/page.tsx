'use client'
// สินค้า → เพิ่มสินค้า (เขียนทะลุไป ZORT) — ปิดแถว 17
//
// 🔴 **ปุ่มส่งจริงปิดอยู่ และจอนี้เป็นตัวที่ต้องระวังที่สุดในสามจอเขียน**
//    เหตุผลที่ฝั่งท่อเสนอ และเจ้าของร้านเห็นด้วย (6 ก.ย. 2569):
//    **ยังไม่รู้ว่า ZORT ของร้านตั้ง "ดันสินค้าใหม่ขึ้นมาร์เก็ตเพลสอัตโนมัติ" ไว้หรือเปล่า**
//    🔎 **ตรวจซ้ำ 18 ก.ย. 2569 (งานยืนไล่คำเตือนหมดอายุ) — ยังจริงอยู่ ยังไม่พบสวิตช์นี้**
//       ไล่เมนูตั้งค่าของ ZORT ทั้งหมด (`/Setting/*`) และหน้าเชื่อมต่อ (`/Integration/Main`, `/Integration/list`)
//       เจอแต่ **"การกระจายสินค้า" รายช่องทาง** (TIKTOK · Shopee-gucut · Lazada-gucut · Shopify = 100% ทุกช่อง)
//       กับสวิตช์ etax/สร้างคลังใหม่ ⇒ **ไม่เจอสวิตช์ดันสินค้าใหม่ขึ้นมาร์เก็ตเพลส**
//       ⚠️ "ไม่เจอ" ≠ "ไม่มี" — มันอาจอยู่ในหน้าตั้งค่าของแต่ละช่องทางซึ่งต้องกดเข้าไปทีละเจ้า
//       ⇒ **ยังต้องให้ท่านประธานยืนยันก่อนเปิดปุ่มส่งจริง เหมือนเดิม**
//    ⇒ ถ้าตั้งไว้ สินค้าที่สร้างจากจอนี้ **จะโผล่หน้าร้านลูกค้าจริงทันที**
//       (Shopee/Lazada/TikTok) โดยไม่มีใครกดอะไรเพิ่ม
//    ⇒ ต่างจากใบเสนอราคาที่อยู่ในกล่องของ ZORT อย่างเดียว
//
// ⚠️ **ก่อนเปิดปุ่มส่งจริง ต้องตอบให้ได้ก่อนว่าร้านตั้งค่านั้นไว้ไหม** — ไม่ใช่แค่ "ยิงผ่านไหม"
//    (ยิงผ่านแล้วสินค้าโผล่หน้าร้าน = ยิงผ่านแต่เสียหาย)
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHead, WriteResult } from '@/components/zort'
import type { WriteResp } from '@/components/zort'

/** 🔴 ห้ามเปิดจนกว่าจะตอบสองข้อได้: ① เจ้าของร้านอนุมัติจอนี้โดยเฉพาะ
 *  ② รู้แน่ว่า ZORT ไม่ได้ตั้งดันสินค้าใหม่ขึ้นมาร์เก็ตเพลสอัตโนมัติ */
const REAL_SEND_ENABLED = false

export default function NewProductPage() {
  const [f, setF] = useState({ sku: '', name: '', price: '', cost: '', unit: '', barcode: '', category: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<WriteResp | null>(null)
  const [okDry, setOkDry] = useState('')
  /* 🔴 **สร้างเลขอ้างอิงฝั่งเบราว์เซอร์เท่านั้น** (แก้ 14 ก.ย. 2569 · เจอตอนกวาดทุกหน้าด้วยเบราว์เซอร์จริง)
     `useState(() => …Math.random()…)` ทำงาน **ทั้งตอน SSR และตอน hydrate** ⇒ ได้คนละค่า
     React จึงฟ้อง "Text content did not match" แล้ว **ทิ้ง HTML ฝั่งเซิร์ฟเวอร์ทั้งหน้า**
     ⇒ ไม่ได้ทำให้เลขซ้ำ (ค่าฝั่งเบราว์เซอร์ชนะเสมอ กลไกกันส่งซ้ำจึงยังดี)
        แต่เป็น error จริงในคอนโซล ซึ่งกลบ error อื่นที่ควรเห็น และทำให้ทั้งหน้าเรนเดอร์ใหม่
     ⚠️ **ห้ามเปลี่ยนกลไกกันส่งซ้ำ** — ยังต้องสร้างครั้งเดียวต่อการเปิดหน้าหนึ่งครั้ง
        (deps ว่าง) ไม่ใช่สร้างใหม่ทุกครั้งที่กด ไม่งั้นกดสองครั้ง = ได้เอกสารสองใบใน ZORT ที่ลบไม่ได้ */
  const [ref, setRef] = useState('')
  useEffect(() => {
    setRef(`PD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`)
  }, [])

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value }))
  const sig = useMemo(() => JSON.stringify(f), [f])
  const dryOk = okDry !== '' && okDry === sig

  const send = useCallback(async (confirm: boolean) => {
    setErr(''); setRes(null)
    if (!f.sku.trim() || !f.name.trim()) { setErr('ต้องมีทั้งรหัสสินค้าและชื่อสินค้า'); return }
    /* ⚠️ ตัวเลขต้องเป็นตัวเลขจริง — ท่อจะตีกลับอยู่แล้ว แต่บอกที่จอเร็วกว่าและชัดกว่า */
    for (const [k, label] of [['price', 'ราคาขาย'], ['cost', 'ราคาซื้อ']] as const) {
      const raw = f[k].trim()
      if (raw !== '' && !Number.isFinite(Number(raw))) { setErr(`${label}ต้องเป็นตัวเลข`); return }
    }
    setBusy(true)
    try {
      const r: WriteResp = await fetch('/api/web/core?addproduct=1', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ref,
          sku: f.sku.trim(),
          name: f.name.trim(),
          ...(f.price.trim() ? { price: Number(f.price) } : {}),
          ...(f.cost.trim() ? { cost: Number(f.cost) } : {}),
          ...(f.unit.trim() ? { unit: f.unit.trim() } : {}),
          ...(f.barcode.trim() ? { barcode: f.barcode.trim() } : {}),
          ...(f.category.trim() ? { category: f.category.trim() } : {}),
          ...(confirm ? { confirm: true } : {}),
        }),
      }).then((x) => x.json())
      setRes(r)
      if (!confirm && r?.dryRun && r?.ok !== false) setOkDry(sig)
      if (confirm && r?.ok) setOkDry('')
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)) } finally { setBusy(false) }
  }, [f, ref, sig])

  const F = ({ label, k, ph, hint }: { label: string; k: keyof typeof f; ph?: string; hint?: string }) => (
    <label className="block">
      <span className="text-[12.5px] text-gray-600">{label}</span>
      <input value={f[k]} onChange={set(k)} placeholder={ph}
        className="w-full border border-gray-300 rounded px-3 py-2 text-[14px] mt-1" />
      {hint && <span className="block text-[11.5px] text-gray-400 mt-0.5">{hint}</span>}
    </label>
  )

  return (
    <div className="p-4 md:p-6 max-w-[820px]">
      <PageHead
        title="เพิ่มสินค้า"
        summary={<>สร้างสินค้าใน ZORT โดยตรง{' | '}<span className="text-gray-400">เลขอ้างอิง: <b>{ref}</b> (กันการส่งซ้ำ)</span></>}
        actions={<Link href="/core/stock" className="text-[13px] text-blue-600 hover:underline">← กลับรายการสินค้า</Link>}
      />

      {/* 🔴 คำเตือนที่ต่างจากจออื่น — จอนี้มีทางที่ของหลุดออกไปถึงลูกค้า */}
      <div className="text-[12.5px] text-red-900 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mb-4 leading-relaxed">
        🔴 <b>จอนี้เสี่ยงกว่าจอเขียนอื่น</b> — ยังไม่รู้ว่า ZORT ของร้านตั้ง
        {' '}<b>&ldquo;ดันสินค้าใหม่ขึ้นมาร์เก็ตเพลสอัตโนมัติ&rdquo;</b> ไว้หรือเปล่า
        <br />
        ถ้าตั้งไว้ สินค้าที่สร้างจากจอนี้ <b>จะโผล่หน้าร้านลูกค้าจริงทันที</b> (Shopee · Lazada · TikTok)
        โดยไม่มีใครกดอะไรเพิ่ม
        <br />
        ⚠️ <b>ตอนนี้ยังกดส่งจริงไม่ได้</b> — ต้องตอบให้ได้ก่อนว่าร้านตั้งค่านั้นไว้ไหม
        {' '}<b>ไม่ใช่แค่ &ldquo;ยิงผ่านไหม&rdquo;</b> (ยิงผ่านแล้วสินค้าโผล่หน้าร้าน = ยิงผ่านแต่เสียหาย) ·
        ทดลองส่งใช้ได้ตามปกติ
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 🔤 **ป้ายช่องลอกจากจอ ZORT จอเดียวกัน** (`/Product/CreateMainProduct` · อ่านอย่างเดียว 16 ก.ย. 2569)
            เดิมเราตั้งชื่อเอง: "ต้นทุน" · "หน่วยนับ" · "บาร์โค้ด" ⇒ คนที่ชิน ZORT ต้องแปลในหัวทุกช่อง
            ZORT เรียก: ราคาซื้อ · หน่วย · รหัสคิวอาร์โค้ดและบาร์โค้ด (คำสั่งท่านประธาน: ให้เหมือน 100%) */}
        <F label="รหัสสินค้า *" k="sku" ph="เช่น 03731" hint="ใช้เป็นกุญแจของทั้งระบบ — ตั้งผิดแล้วแก้ยาก (ZORT เรียกช่องนี้ว่ารหัสสินค้า ไม่ใช่ SKU)" />
        <F label="ชื่อสินค้า *" k="name" ph="ชื่อที่จะโชว์" />
        <F label="ราคาขาย" k="price" ph="ไม่ใส่ก็ได้" />
        <F label="ราคาซื้อ" k="cost" ph="ไม่ใส่ก็ได้" />
        <F label="หน่วย" k="unit" ph="ตัวอย่าง: ชิ้น, ตัว" />
        <F label="รหัสคิวอาร์โค้ดและบาร์โค้ด" k="barcode" ph="ไม่ใส่ก็ได้" />
        <F label="หมวดหมู่" k="category" ph="ไม่มีหมวดหมู่" hint="ต้องเป็นชื่อที่มีอยู่แล้วใน ZORT ไม่งั้นมันจะเมินช่องนี้เงียบ ๆ (จอ ZORT สร้างหมวดใหม่ได้ในจอเดียวกัน จอเรายังไม่ได้)" />
      </div>

      {/* 🔬 **เทียบกับจอ ZORT จริงแล้วเขียนไว้บนจอ** — ใบงานยืน t_mu2u9mym
          อ่านโครงฟอร์ม `/Product/CreateMainProduct` แบบอ่านอย่างเดียว 16 ก.ย. 2569
          (เก็บไว้ที่ `~/zort-export-private/zort-เพิ่มสินค้า-โครงจอ.json` ไม่เข้า repo)
          ZORT แบ่งเป็น 6 กล่อง: รายละเอียดสินค้า · ราคาสินค้า · ข้อมูลขนส่ง · ตั้งค่า · สินค้าหลากคุณสมบัติ · คลังสินค้า
          ⚠️ **ห้ามแปะช่องพวกนี้ไปก่อนแล้วเงียบ** — ยังไม่ได้ยิงตรวจว่าท่อ addproduct รับช่องไหนได้
             และ ZORT **เมินช่องที่ไม่รู้จักแบบไม่บอก** ⇒ เขียนไว้ว่ายังไม่มี ตรงกว่าใส่ช่องที่ส่งไปแล้วหาย */}
      <div className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mt-3 leading-relaxed">
        <b>ช่องที่จอ ZORT มี แต่จอนี้ยังไม่มี</b> (เทียบของจริง 16 ก.ย. 2569)
        <ul className="list-disc ml-5 mt-1 space-y-0.5">
          <li><b>ประเภท: สินค้า / บริการ</b> — ของเราสร้างได้แบบเดียว ยังไม่รู้ว่าท่อส่งประเภทได้ไหม</li>
          <li><b>รูปสินค้า (ZORT ใส่ได้ 9 รูปตอนสร้าง)</b> — จอเราใส่รูปได้ทีหลังทีละรหัสที่จอแก้สินค้า</li>
          <li><b>น้ำหนัก (กรัม) · ขนาด (กว้าง ยาว สูง) (ซม.)</b> — กล่อง &ldquo;ข้อมูลขนส่ง&rdquo; ของ ZORT · ท่อเรายังไม่มีช่องนี้</li>
          <li><b>Tag สินค้า</b> — ยังไม่มีทั้งตอนสร้างและตอนค้นในจอเรา</li>
          <li><b>Serial Number · ล็อต/วันหมดอายุ · สินค้าแถม · แสดงในหน้าสั่งซื้อ (ดรอปชิป)</b> — กล่อง &ldquo;ตั้งค่า&rdquo; ของ ZORT ทั้งกล่อง</li>
          <li><b>ยอดยกมา + สินค้าเข้าที่คลังไหน</b> — ZORT ตั้งจำนวนตั้งต้นให้ได้ตอนสร้าง · ของเราสร้างแล้วยอดเป็น 0 ต้องไปตั้งต่างหาก</li>
          <li><b>สินค้าหลากคุณสมบัติ (สี/ขนาด)</b> — ZORT ผูกได้ตอนสร้าง (จอ <code>/Product/Variantlist</code> ของร้านมี 0 รายการ ⇒ ร้านยังไม่ได้ใช้)</li>
          <li><b>สร้างหมวดหมู่ใหม่ในจอเดียวกัน</b> — ของเราต้องมีหมวดอยู่ก่อน</li>
        </ul>
        <div className="mt-1.5">
          🖼️ ZORT ยังมีจอแยกชื่อ <b>จัดการรูปภาพสินค้า</b> (<code>/Product/AddPicturelist</code>) —
          อัปโหลดรูปหลายรหัสรวดเดียว กรองด้วยรหัส/ชื่อ/ช่วงราคา/หมวดหมู่/คลัง/Tag ·
          หัวจอนับ <b>2,898 รายการ</b> (คนละจำนวนกับสินค้าในทะเบียนเรา 2,672 — <b>ยังไม่รู้ว่า ZORT นับอะไรเพิ่ม</b>) ·
          <b>จอเรายังไม่มีจอแบบนั้น</b> ⇒ ตอนนี้รูปที่ยังไม่มีต้องไปใส่ที่ ZORT
        </div>
      </div>

      {err && <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mt-3">{err}</div>}
      <WriteResult r={res} />

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button onClick={() => send(false)} disabled={busy || !ref}
          className="text-[14px] font-semibold text-gray-800 bg-white border-2 border-gray-300 rounded-full px-6 py-2 disabled:opacity-50 hover:bg-gray-50">
          {busy ? 'กำลังส่ง…' : '🧪 ทดลองส่ง (ยังไม่เข้า ZORT)'}
        </button>
        <button onClick={() => send(true)} disabled={busy || !ref || !dryOk || !REAL_SEND_ENABLED}
          className="text-[14px] font-semibold text-white rounded-full px-6 py-2 disabled:opacity-40"
          style={{ background: dryOk && REAL_SEND_ENABLED ? '#c0392b' : '#9aa0a6' }}>
          ส่งจริงเข้า ZORT
        </button>
        {!REAL_SEND_ENABLED
          ? <span className="text-[12.5px] text-amber-800"><b>ยังไม่เปิดให้ส่งจริง</b> — รอคำตอบเรื่องการดันขึ้นมาร์เก็ตเพลส</span>
          : !dryOk && <span className="text-[12.5px] text-gray-500">{okDry === '' ? 'ต้องกดทดลองส่งให้ผ่านก่อน' : 'เนื้อหาเปลี่ยนหลังทดลองส่ง — ต้องทดลองใหม่'}</span>}
      </div>

      <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
        ⚠️ <b>ZORT เมินช่องที่ไม่รู้จักแบบเงียบ ๆ</b> — ส่งชื่อหมวดที่ไม่มีอยู่จริง มันจะสร้างสินค้าให้
        โดยไม่ใส่หมวด และ<b>ไม่บอกว่าไม่ได้ใส่</b> ⇒ หลังส่งจริงต้องเปิดดูใน ZORT ว่าช่องที่ตั้งใจใส่เข้าครบไหม ·
        ระบบกันส่งซ้ำด้วยเลขอ้างอิง — กดสองครั้งจะไม่ได้สินค้าสองตัว
      </p>
    </div>
  )
}
