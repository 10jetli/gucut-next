'use client'
// สินค้า → แก้ไขสินค้า / ลบสินค้า (เขียนทะลุไป ZORT) — งานกระดาน t_mu0tx2wj · soon: product-edit · product-delete
//
// ท่อที่ใช้ (gucut-web netlify/functions/core.mjs · ขึ้นระบบแล้ว 14 ก.ย. 2569):
//   GET    /api/core?zortproduct=<sku>                       → {found, product:{id, sku, name, barcode, sellprice, purchaseprice, stock, unittext}}
//   POST   /api/core?updateproduct=1  ขาเข้าจากจอ: {ref, id, sku, name?, description?, price?, cost?, unit?, barcode?, category?, weight?, …}
//   DELETE /api/core?deleteproduct=<id>&sku=<sku>&ref=<ref>[&confirm=1]
//
// 🔴 **แก้/ลบระบุด้วย id ของ ZORT ไม่ใช่ sku** — กระจก D1 ไม่มี id ⇒ ต้องถาม ?zortproduct ก่อนเสมอ
//    ท่อจะถาม ZORT อีกรอบตอนยืนยันว่า id นี้คือ sku นี้จริง (ไม่ตรง = ไม่ยิง) — จอส่ง sku คู่ไปทุกครั้ง
// 🔴 **ลบแล้วเอาคืนไม่ได้** · ท่อยอมลบเฉพาะสต็อกใน ZORT = 0 เป๊ะ · จอบังคับพิมพ์รหัสสินค้าซ้ำก่อนกดลบจริง
// 🔴 ปุ่มส่งจริงทั้งสองปิดอยู่ (REAL_SEND_ENABLED) — แบบเดียวกับจอเขียนอื่น · เปิดได้เมื่อท่านประธานอนุมัติจอนี้โดยเฉพาะ
// ⚠️ ส่งเฉพาะช่องที่เปลี่ยนจริง — ยังไม่รู้ว่า ZORT ตีความช่องว่างเป็น "ล้างค่า" หรือ "เมิน" (ท่อไม่ส่งช่องว่างอยู่แล้ว)
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { PageHead, WriteResult } from '@/components/zort'
import type { WriteResp } from '@/components/zort'
import ProductImageBox from './ProductImageBox'
import { ส่งจริงได้ } from '@/lib/real-send'

/** 🔴 ห้ามเปิดจนกว่าท่านประธานอนุมัติจอนี้โดยเฉพาะ (แก้/ลบของจริงใน ZORT) */
/* ⚠️ ค่าอยู่ที่ `lib/real-send.ts` ที่เดียว — **ห้ามเขียนค่าตายตรงนี้**
   เพราะค่านี้คือ *สถานะการอนุมัติของท่านประธาน* ไม่ใช่ค่าคงที่ของโค้ด
   (เขียนซ้ำหลายที่มาแล้ว 12 ไฟล์ ⇒ จอรายการซื้อพูดเท็จอยู่ 5 วัน · ใบ S4 19 ก.ย. 2569) */
const REAL_SEND_ENABLED = ส่งจริงได้('stock/[sku]/edit')
interface ZortProduct {
  id: number; sku: string; name: string; barcode: string | null
  sellprice: number | null; purchaseprice: number | null; stock: number | null; availablestock: number | null
  unittext: string | null; imagepath: string | null
}
interface FindResp { ok?: boolean; found?: boolean; product?: ZortProduct; error?: string; unknown?: boolean; fallthrough?: boolean }

type Fields = { name: string; price: string; cost: string; unit: string; barcode: string }
const EMPTY: Fields = { name: '', price: '', cost: '', unit: '', barcode: '' }

const newRef = (kind: string) =>
  `${kind}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`

/** ช่องกรอกหนึ่งช่อง — **ต้องอยู่ระดับโมดูล** (ดูเหตุผลในคอมเมนต์ที่จุดเรียก) */
function Field({ label, value, onChange, ph, hint }:
  { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; ph?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[12.5px] text-gray-600">{label}</span>
      <input value={value} onChange={onChange} placeholder={ph}
        className="w-full border border-gray-300 rounded px-3 py-2 text-[14px] mt-1" />
      {hint && <span className="block text-[11.5px] text-gray-400 mt-0.5">{hint}</span>}
    </label>
  )
}

export default function EditProductPage() {
  const params = useParams<{ sku: string }>()
  const sku = (() => {
    const raw = String(params?.sku ?? '')
    try { return decodeURIComponent(raw) } catch { return raw }
  })()

  /* สามสถานะแยกกันเสมอ: กำลังโหลด · ดึงไม่สำเร็จ · ไม่มีสินค้านี้ใน ZORT จริง */
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [product, setProduct] = useState<ZortProduct | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [orig, setOrig] = useState<Fields>(EMPTY)
  const [f, setF] = useState<Fields>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<WriteResp | null>(null)
  const [okDry, setOkDry] = useState('')

  const [delConfirmSku, setDelConfirmSku] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [delRes, setDelRes] = useState<WriteResp | null>(null)
  const [delDryOk, setDelDryOk] = useState(false)

  /* เลขอ้างอิงสร้างฝั่งเบราว์เซอร์ครั้งเดียวต่อการเปิดหน้า (กันส่งซ้ำ · กัน hydration ไม่ตรง — ดูเหตุผลใน stock/new) */
  const [editRef, setEditRef] = useState('')
  const [delRef, setDelRef] = useState('')
  useEffect(() => { setEditRef(newRef('PE')); setDelRef(newRef('PDEL')) }, [])

  const load = useCallback(async () => {
    setLoading(true); setLoadErr(''); setNotFound(false); setProduct(null)
    try {
      const r = await fetch(`/api/web/core?zortproduct=${encodeURIComponent(sku)}`)
      const j: FindResp = await r.json().catch(() => ({}))
      if (j.fallthrough) { setLoadErr('ท่อยังไม่มีเส้น zortproduct (ท่อรุ่นเก่า) — รอขึ้นระบบ'); return }
      if (!r.ok || j.ok === false) { setLoadErr(j.error || `ถาม ZORT ไม่สำเร็จ (HTTP ${r.status})`); return }
      if (!j.found || !j.product) { setNotFound(true); return }
      const p = j.product
      const fields: Fields = {
        name: p.name ?? '',
        price: p.sellprice === null ? '' : String(p.sellprice),
        cost: p.purchaseprice === null ? '' : String(p.purchaseprice),
        unit: p.unittext ?? '',
        barcode: p.barcode ?? '',
      }
      setProduct(p); setOrig(fields); setF(fields)
    } catch (e) {
      setLoadErr(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [sku])
  useEffect(() => { if (sku) load() }, [sku, load])

  /* ช่องที่เปลี่ยนจริงเท่านั้น — ช่องที่ลบให้ว่างไม่ส่ง (ยังไม่รู้ว่า ZORT ล้างค่าหรือเมิน) */
  const changed = useMemo(() => {
    const out: Record<string, string | number> = {}
    const trim = (s: string) => s.trim()
    if (trim(f.name) && trim(f.name) !== trim(orig.name)) out.name = trim(f.name)
    if (trim(f.unit) && trim(f.unit) !== trim(orig.unit)) out.unit = trim(f.unit)
    if (trim(f.barcode) && trim(f.barcode) !== trim(orig.barcode)) out.barcode = trim(f.barcode)
    for (const k of ['price', 'cost'] as const) {
      const v = trim(f[k])
      if (v !== '' && v !== trim(orig[k])) out[k] = Number(v)
    }
    return out
  }, [f, orig])
  const cleared = useMemo(
    () => (Object.keys(EMPTY) as (keyof Fields)[]).filter((k) => orig[k].trim() !== '' && f[k].trim() === ''),
    [f, orig],
  )
  const sig = useMemo(() => JSON.stringify(changed), [changed])
  const dryOk = okDry !== '' && okDry === sig

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value }))

  const sendEdit = useCallback(async (confirm: boolean) => {
    setErr(''); setRes(null)
    if (!product) return
    for (const [k, label] of [['price', 'ราคาขาย'], ['cost', 'ต้นทุน']] as const) {
      const raw = f[k].trim()
      if (raw !== '' && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) { setErr(`${label}ต้องเป็นตัวเลขไม่ติดลบ`); return }
    }
    if (!Object.keys(changed).length) { setErr('ยังไม่มีช่องไหนเปลี่ยน'); return }
    setBusy(true)
    try {
      const r: WriteResp = await fetch('/api/web/core?updateproduct=1', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ref: editRef, id: product.id, sku: product.sku, ...changed, ...(confirm ? { confirm: true } : {}) }),
      }).then((x) => x.json())
      setRes(r)
      if (!confirm && r?.dryRun && r?.ok !== false) setOkDry(sig)
      if (confirm && r?.ok) { setOkDry(''); await load() }
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)) } finally { setBusy(false) }
  }, [product, f, changed, editRef, sig, load])

  const stockZero = product?.stock === 0
  const sendDelete = useCallback(async (confirm: boolean) => {
    setDelRes(null)
    if (!product) return
    setDelBusy(true)
    try {
      const q = new URLSearchParams({ deleteproduct: String(product.id), sku: product.sku, ref: delRef })
      if (confirm) q.set('confirm', '1')
      const r: WriteResp = await fetch(`/api/web/core?${q}`, { method: 'DELETE' }).then((x) => x.json())
      setDelRes(r)
      if (!confirm) setDelDryOk(!!r?.dryRun && r?.ok !== false)
    } catch (e) {
      setDelRes({ ok: false, error: String(e instanceof Error ? e.message : e) } as WriteResp)
    } finally { setDelBusy(false) }
  }, [product, delRef])

  /* 🔴 **ย้าย `F` ออกไประดับโมดูลแล้ว 18 ก.ย. 2569 — ห้ามย้ายกลับ**
     ประกาศ component ไว้ในตัว component ⇒ React สร้าง `<input>` ใหม่ทุกครั้งที่ state เปลี่ยน
     ⇒ **พิมพ์ได้ตัวเดียวแล้วโฟกัสหลุด** (วัดจริงที่จอเพิ่มสินค้า: พิมพ์ ABCDE ได้ 'A')
     จอนี้เป็นฝาแฝดของจอเพิ่มสินค้า และ **ตัวกวาดจอเปิดมันไม่ได้ด้วย** (มีช่องแปรใน URL)
     ⇒ มองไม่เห็นสองชั้น: ตัวกวาดไม่เปิด และต่อให้เปิดก็ไม่มีใครพิมพ์ */

  return (
    <div className="p-4 md:p-6 max-w-[820px]">
      <PageHead
        title={`แก้ไขสินค้า ${sku}`}
        summary={product
          ? <>แก้ใน ZORT โดยตรง · id ใน ZORT <b>{product.id}</b>{' | '}<span className="text-gray-400">เลขอ้างอิง: <b>{editRef}</b> (กันการส่งซ้ำ)</span></>
          : loading ? 'กำลังถาม ZORT…' : ''}
        actions={<Link href={`/core/stock/${encodeURIComponent(sku)}`} className="text-[13px] text-blue-600 hover:underline">← กลับหน้าสินค้า</Link>}
      />

      {loading && <div className="text-[13px] text-gray-500">กำลังถาม ZORT ว่าสินค้านี้คือ id ไหน…</div>}
      {loadErr && (
        <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5">
          ถาม ZORT ไม่สำเร็จ — <b>ยังไม่รู้ว่ามีสินค้านี้ไหม</b> (ไม่ได้แปลว่าไม่มี) · {loadErr}{' '}
          <button onClick={load} className="underline">ลองใหม่</button>
        </div>
      )}
      {notFound && (
        <div className="text-[13px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5">
          ZORT ตอบว่า<b>ไม่มีสินค้ารหัส {sku} ตรงตัว</b> — แก้หรือลบจากจอนี้ไม่ได้ ·
          {' '}<Link href="/core/stock/new" className="underline">เพิ่มเป็นสินค้าใหม่</Link>
        </div>
      )}

      {product && (
        <>
          <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mb-4 leading-relaxed">
            ⚠️ <b>ส่งเฉพาะช่องที่เปลี่ยน</b> · ช่องที่ลบให้ว่างจะ<b>ไม่ถูกส่ง</b> (ยังไม่รู้ว่า ZORT จะล้างค่าหรือเมิน)
            · ตอนกดส่งจริง ท่อจะถาม ZORT อีกรอบว่า id {product.id} ยังเป็นรหัส {product.sku} — ไม่ตรงจะไม่แก้
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12.5px] text-gray-600">รหัสสินค้า (SKU)</span>
              <input value={product.sku} disabled className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-[14px] mt-1" />
              <span className="block text-[11.5px] text-gray-400 mt-0.5">เปลี่ยนรหัสผ่าน API ไม่ได้ — รหัสคือกุญแจของทั้งระบบ</span>
            </label>
            <Field label="ชื่อสินค้า" value={f.name} onChange={set('name')} />
            <Field label="ราคาขาย" value={f.price} onChange={set('price')} />
            <Field label="ต้นทุน (ราคาซื้อที่ตั้งไว้)" value={f.cost} onChange={set('cost')} hint="ZORT มีแค่ราคาซื้อที่ตั้งไว้ ไม่ใช่ต้นทุนเฉลี่ย" />
            <Field label="หน่วยนับ" value={f.unit} onChange={set('unit')} />
            <Field label="บาร์โค้ด" value={f.barcode} onChange={set('barcode')} />
          </div>

          <div className="text-[12px] text-gray-500 mt-2">
            ช่องที่จะส่ง: {Object.keys(changed).length ? <b>{Object.keys(changed).join(' · ')}</b> : 'ยังไม่มี'}
            {cleared.length > 0 && <span className="text-amber-700"> · ช่องที่ลบให้ว่าง (ไม่ถูกส่ง): {cleared.join(' · ')}</span>}
          </div>

          {err && <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mt-3">{err}</div>}
          <WriteResult r={res} />

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button onClick={() => sendEdit(false)} disabled={busy || !editRef}
              className="text-[14px] font-semibold text-gray-800 bg-white border-2 border-gray-300 rounded-full px-6 py-2 disabled:opacity-50 hover:bg-gray-50">
              {busy ? 'กำลังส่ง…' : '🧪 ทดลองแก้ (ยังไม่เข้า ZORT)'}
            </button>
            <button onClick={() => sendEdit(true)} disabled={busy || !editRef || !dryOk || !REAL_SEND_ENABLED}
              className="text-[14px] font-semibold text-white rounded-full px-6 py-2 disabled:opacity-40"
              style={{ background: dryOk && REAL_SEND_ENABLED ? '#c0392b' : '#9aa0a6' }}>
              บันทึกการแก้เข้า ZORT
            </button>
            {!REAL_SEND_ENABLED
              ? <span className="text-[12.5px] text-amber-800"><b>ยังไม่เปิดให้แก้จริง</b> — รอท่านประธานอนุมัติจอนี้</span>
              : !dryOk && <span className="text-[12.5px] text-gray-500">{okDry === '' ? 'ต้องกดทดลองแก้ให้ผ่านก่อน' : 'เนื้อหาเปลี่ยนหลังทดลอง — ต้องทดลองใหม่'}</span>}
          </div>

          {/* ── รูปสินค้า (t_mu108yr3) ── */}
          <ProductImageBox id={product.id} sku={product.sku} imagepath={product.imagepath} realSendEnabled={REAL_SEND_ENABLED} />

          {/* ── ลบสินค้า ── */}
          <div className="mt-8 border-2 border-red-200 rounded-md p-4 bg-red-50/40">
            <div className="text-[14px] font-semibold text-red-900">🗑️ ลบสินค้านี้ออกจาก ZORT</div>
            <p className="text-[12.5px] text-red-900 mt-1 leading-relaxed">
              🔴 <b>ลบแล้วเอาคืนไม่ได้</b> · ท่อยอมลบเฉพาะเมื่อ<b>สต็อกใน ZORT เป็น 0 เป๊ะ</b> และ id ยังตรงกับรหัสนี้
              <br />
              สต็อกตอนนี้ใน ZORT: <b>{product.stock === null ? 'อ่านไม่ได้ (ท่อจะไม่ยอมลบ)' : product.stock.toLocaleString('th-TH')}</b>
              {!stockZero && product.stock !== null && ' — ต้องทำให้เป็น 0 ก่อน (ปรับยอดหรือขายออก)'}
            </p>
            <label className="block mt-3 max-w-[360px]">
              <span className="text-[12.5px] text-gray-700">พิมพ์รหัสสินค้า <b>{product.sku}</b> ซ้ำเพื่อยืนยัน</span>
              <input value={delConfirmSku} onChange={(e) => setDelConfirmSku(e.target.value)}
                className="w-full border border-red-300 rounded px-3 py-2 text-[14px] mt-1" />
            </label>
            <WriteResult r={delRes} />
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button onClick={() => sendDelete(false)} disabled={delBusy || !delRef}
                className="text-[14px] font-semibold text-gray-800 bg-white border-2 border-gray-300 rounded-full px-6 py-2 disabled:opacity-50">
                {delBusy ? 'กำลังส่ง…' : '🧪 ทดลองลบ (ยังไม่เข้า ZORT)'}
              </button>
              <button onClick={() => sendDelete(true)}
                disabled={delBusy || !delRef || !delDryOk || delConfirmSku.trim() !== product.sku || !stockZero || !REAL_SEND_ENABLED}
                className="text-[14px] font-semibold text-white rounded-full px-6 py-2 disabled:opacity-40"
                style={{ background: '#c0392b' }}>
                ลบจริงใน ZORT
              </button>
              {!REAL_SEND_ENABLED && <span className="text-[12.5px] text-amber-800"><b>ยังไม่เปิดให้ลบจริง</b> — รอท่านประธานอนุมัติ</span>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
