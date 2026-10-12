'use client'
// แก้ชุดสินค้าใน ZORT — งาน t_mu1w2rth
// GET  /api/core?zortbundle=<sku> → หา id และค่าปัจจุบันจาก ZORT
// POST /api/core?updatebundle=1   → Bundle/UpdateBundle?id=
//
// 🔴 ท่อเทียบ id+sku และค่าก่อนแก้ของทุกช่องกับ GetBundleDetail สดก่อน POST
//    ถ้ามีคนแก้ระหว่างเปิดจอกับกดยืนยันจะหยุด ไม่เขียนทับเงียบ ๆ
// ⚠️ เอกสาร V4 ของ UpdateBundle มีแค่ name · sellprice · sell_vat_status ไม่มี list
//    จอนี้จึงไม่สร้างช่องแก้ส่วนประกอบที่ API ไม่รองรับ
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { PageHead, WriteResult } from '@/components/zort'
import type { WriteResp } from '@/components/zort'
import PillSend from '@/components/ui/PillSend'

interface ZortBundle {
  id: number
  sku: string
  name: string
  sellprice: string | number | null
  sell_vat_status: string | number | null
  active: boolean | null
}
interface ProbeResp {
  ok?: boolean
  found?: boolean
  bundle?: ZortBundle
  error?: string
  unknown?: boolean
  fallthrough?: boolean
}
/** คำตอบของเส้นเขียนชุดสินค้า — **ช่องพวกนี้มาจากสัญญาที่ฝั่งท่อประกาศไว้ 12 ต.ค. 2569**
 *  ⚠️ ไม่ใช่ช่องที่เราคิดเอง ⇒ ถ้าท่อเปลี่ยนชื่อช่อง จอจะอ่านไม่เจอและ **เงียบ**
 *     จึงต้องมีกิ่งที่เขียนว่า "ท่อไม่ได้บอก" ทุกช่องที่ใช้ตัดสินใจ */
interface UpdateResp extends WriteResp {
  updated?: boolean
  /** อ่านกลับจาก ZORT หลังเขียน — `null` = เขียนแล้วแต่อ่านกลับไม่ได้ (คนละเรื่องกับไม่สำเร็จ) */
  after?: Record<string, unknown> | null
  afterUnknown?: string
  /** ท่อส่งสูตรเดิมกลับไปให้ ZORT แทนเรา — ดูเหตุที่กิ่งตรวจด้านล่าง */
  keptRecipe?: boolean
  /** ค่าที่จอเห็นตอนกดไม่ตรงกับของจริงใน ZORT ⇒ มีคนแก้คาบเกี่ยว */
  stale?: boolean
  /** `sku` ที่ส่งไปไม่ตรงกับ `id` นั้นใน ZORT ⇒ ท่อไม่เขียนอะไรเลย */
  mismatch?: boolean
}
type Fields = { name: string; price: string; vat: string }

const EMPTY: Fields = { name: '', price: '', vat: '' }
const newRef = () => `BU-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8)}`

const VAT = [
  ['0', 'ไม่ระบุ'],
  ['1', 'ไม่มี VAT'],
  ['2', 'มี VAT'],
  ['3', 'VAT 0%'],
  ['4', 'ใช้ VAT ตามสินค้า (ต้องมี Advance Vat)'],
] as const

export default function EditBundlePage() {
  const params = useParams<{ sku: string }>()
  const sku = (() => {
    const raw = String(params?.sku ?? '')
    try { return decodeURIComponent(raw) } catch { return raw }
  })()

  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [bundle, setBundle] = useState<ZortBundle | null>(null)
  const [orig, setOrig] = useState<Fields>(EMPTY)
  const [fields, setFields] = useState<Fields>(EMPTY)
  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<UpdateResp | null>(null)
  const [drySig, setDrySig] = useState('')

  useEffect(() => { setRef(newRef()) }, [])

  const load = useCallback(async () => {
    setLoading(true); setLoadErr(''); setNotFound(false); setBundle(null); setDrySig('')
    try {
      const response = await fetch(`/api/web/core?zortbundle=${encodeURIComponent(sku)}`)
      const d = await response.json().catch(() => null) as ProbeResp | null
      if (!d) { setLoadErr(`ท่อตอบไม่ใช่ JSON (HTTP ${response.status})`); return }
      if (d.fallthrough) { setLoadErr('ท่อยังไม่มีข้อมูล bundle สำหรับหน้าแก้ — รอขึ้นระบบ'); return }
      if (!response.ok || d.ok === false || d.unknown) { setLoadErr(d.error || `ถาม ZORT ไม่สำเร็จ (HTTP ${response.status})`); return }
      if (d.found !== true || !d.bundle) { setNotFound(true); return }
      const b = d.bundle
      if (!Number.isInteger(Number(b.id)) || Number(b.id) <= 0 || String(b.sku).trim() !== sku) {
        setLoadErr('ZORT คืน id หรือ sku ไม่ตรงกับหน้าที่เปิด — ยังแก้ไม่ได้')
        return
      }
      const f = {
        name: String(b.name ?? ''),
        price: b.sellprice === null || b.sellprice === undefined ? '' : String(b.sellprice),
        vat: b.sell_vat_status === null || b.sell_vat_status === undefined ? '' : String(b.sell_vat_status),
      }
      setBundle({ ...b, id: Number(b.id), sku: String(b.sku).trim() })
      setOrig(f); setFields(f)
    } catch (e) {
      setLoadErr(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [sku])
  useEffect(() => { if (sku) void load() }, [sku, load])

  const changed = useMemo(() => {
    const out: { name?: string; price?: number; vat?: number } = {}
    const name = fields.name.trim()
    if (name !== orig.name.trim()) out.name = name
    const price = fields.price.trim()
    if (price !== orig.price.trim()) out.price = Number(price)
    if (fields.vat !== orig.vat) out.vat = Number(fields.vat)
    return out
  }, [fields, orig])

  const before = useMemo(() => {
    const out: Record<string, string | number | null> = {}
    if (changed.name !== undefined) out.name = orig.name
    if (changed.price !== undefined) out.sellprice = orig.price === '' ? null : orig.price
    if (changed.vat !== undefined) out.sell_vat_status = orig.vat === '' ? null : Number(orig.vat)
    return out
  }, [changed, orig])

  const sig = useMemo(() => JSON.stringify({ ref, id: bundle?.id, changed, before }), [ref, bundle?.id, changed, before])
  const dryOk = drySig !== '' && drySig === sig

  const send = useCallback(async (confirm: boolean) => {
    setError(''); setResult(null)
    if (!bundle) return
    if (!fields.name.trim()) { setError('ชื่อชุดห้ามว่าง'); return }
    if (changed.price !== undefined && !fields.price.trim()) {
      setError('ราคาขายห้ามว่าง'); return
    }
    if (changed.price !== undefined && (!Number.isFinite(changed.price) || changed.price < 0)) {
      setError('ราคาขายต้องเป็นตัวเลขไม่ติดลบ'); return
    }
    if (changed.vat !== undefined && ![0, 1, 2, 3, 4].includes(changed.vat)) {
      setError('สถานะ VAT ต้องเป็นค่าที่ ZORT รองรับ'); return
    }
    if (!Object.keys(changed).length) { setError('ยังไม่มีช่องไหนเปลี่ยน'); return }
    setBusy(true)
    try {
      const response = await fetch('/api/web/core?updatebundle=1', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ref, id: bundle.id, sku: bundle.sku, ...changed, before, ...(confirm ? { confirm: true } : {}) }),
      })
      const d = await response.json().catch(() => null) as UpdateResp | null
      if (!d) {
        setResult(confirm
          ? { ok: false, unknown: true, ref, error: `ท่อตอบไม่ใช่ JSON (HTTP ${response.status})` }
          : { ok: false, error: `ท่อตอบไม่ใช่ JSON (HTTP ${response.status})` })
        return
      }
      setResult(d)
      if (!confirm && d.dryRun && d.ok !== false) setDrySig(sig)
      if (confirm && d.updated) {
        setDrySig('')
        await load()
        setRef(newRef())
      }
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e)
      setResult(confirm ? { ok: false, unknown: true, ref, error: msg } : { ok: false, error: msg })
    } finally {
      setBusy(false)
    }
  }, [bundle, fields.name, changed, before, ref, sig, load])

  return (
    <div className="p-4 md:p-6 max-w-[820px]">
      <PageHead
        title={`แก้ไขสินค้าเป็นชุด ${sku}`}
        summary={bundle
          ? <>เขียนเข้า ZORT โดยตรง (Bundle/UpdateBundle) · id <b>{bundle.id}</b>{' | '}<span className="text-gray-400">เลขอ้างอิง <b>{ref || 'กำลังสร้าง…'}</b></span></>
          : loading ? 'กำลังถาม ZORT…' : ''}
        actions={<Link href={`/core/bundles/${encodeURIComponent(sku)}`} className="text-[12.5px] text-blue-600 hover:underline">← กลับหน้ารายละเอียดชุด</Link>}
      />

      {loading && <p className="text-[12.5px] text-gray-500">กำลังถาม ZORT หา id และค่าปัจจุบัน…</p>}
      {loadErr && (
        <div className="text-[12.5px] text-red-900 bg-red-50 border border-red-300 rounded px-3.5 py-2.5">
          ถาม ZORT ไม่สำเร็จ — <b>ยังไม่ได้แก้อะไร</b> · {loadErr}{' '}
          <button type="button" onClick={() => void load()} className="underline">ลองใหม่</button>
        </div>
      )}
      {notFound && (
        <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded px-3.5 py-2.5">
          ZORT ตอบว่าไม่พบชุดรหัส <b>{sku}</b> ตรงตัว — แก้จากจอนี้ไม่ได้
        </div>
      )}

      {bundle && (
        <div className="bg-white border border-gray-200 rounded-md p-5 space-y-4">
          <label className="block">
            <span className="text-[12.5px] text-gray-600">ชื่อชุดสินค้า</span>
            <input value={fields.name} maxLength={200} onChange={(e) => setFields((v) => ({ ...v, name: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-[14px] mt-1" />
          </label>
          <label className="block max-w-[360px]">
            <span className="text-[12.5px] text-gray-600">ราคาขาย</span>
            <input value={fields.price} inputMode="decimal" onChange={(e) => setFields((v) => ({ ...v, price: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-[14px] mt-1" />
          </label>
          <label className="block max-w-[520px]">
            <span className="text-[12.5px] text-gray-600">สถานะ VAT</span>
            <select value={fields.vat} onChange={(e) => setFields((v) => ({ ...v, vat: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-[14px] mt-1 bg-white">
              {orig.vat === '' && <option value="">ZORT ไม่ส่งค่านี้ — เลือกเมื่อต้องการเปลี่ยน</option>}
              {VAT.map(([value, label]) => <option key={value} value={value}>{value} — {label}</option>)}
            </select>
            <span className="block text-[11.5px] text-gray-500 mt-1">ค่า 4 ใช้ได้เฉพาะร้านที่มีส่วนเสริม Advance Vat ตามเอกสาร ZORT</span>
          </label>

          <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded px-3.5 py-2.5">
            API เส้นนี้แก้ได้เฉพาะชื่อ ราคา และ VAT · <b>ไม่มีช่องแก้รายการส่วนประกอบ</b>ใน UpdateBundle ตามเอกสาร V4 ที่ตรวจ 15 ก.ย. 2569
          </div>
          {error && <div className="text-[12.5px] text-red-800">⚠️ {error}</div>}
          <WriteResult r={result} />

          {/* ── สัญญา 6 ข้อที่ฝั่งท่อประกาศ — ไม่อ่านช่องพวกนี้ = ทิ้งของที่เขาส่งมา ───────
              🔑 แต่ละข้อต้องอ่านต่างกัน เพราะมันคือ **เหตุคนละเหตุ** ที่เคยหน้าตาเหมือนกันหมด */}
          {result?.mismatch && (
            <div className="text-[12.5px] text-red-900 bg-red-50 border border-red-300 rounded px-3.5 py-2.5">
              🔴 <b>รหัสชุดไม่ตรงกับ id ที่ส่งไป — ท่อไม่ได้เขียนอะไรเลย</b>
              <span className="block mt-1">กันแก้ผิดตัว · โหลดหน้านี้ใหม่แล้วลองอีกครั้ง</span>
            </div>
          )}
          {result?.stale && (
            <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded px-3.5 py-2.5">
              ⚠️ <b>ค่าใน ZORT ไม่ตรงกับที่จอนี้เห็นตอนกด</b> — มีคนแก้คาบเกี่ยว ท่อจึงไม่เขียนทับให้
              <span className="block mt-1">กด “ดึงค่าปัจจุบันใหม่” ก่อน แล้วค่อยแก้ซ้ำ</span>
            </div>
          )}
          {/* 🔴 เกณฑ์นี้ต้องอ่าน **สองค่า** ไม่ใช่ค่าเดียว (ฝั่งท่อแก้คำผมเอง 12 ต.ค. 2569)
              `keptRecipe:false` ตอนเราส่ง `items` มาเอง = ถูกต้อง เพราะเราตั้งใจแก้สูตร
              ร้องเฉพาะตอน **ไม่ได้ส่ง `items`** แล้ว `keptRecipe` ไม่เป็น true
              ⇒ แปลว่าท่อไม่ได้ทำอย่างที่สัญญาไว้ และเราไม่รู้ว่าสูตรรอดไหม
              ⚠️ จอนี้ไม่ส่ง `items` เลยสักครั้ง (เส้นนี้แก้ได้แค่ชื่อ/ราคา/VAT) ⇒ เงื่อนไขซ้ายเป็นจริงเสมอ
                 เขียนไว้เต็มรูปเพื่อให้ยังถูกวันที่มีคนเพิ่มช่องแก้สูตร */}
          {result?.updated && result?.keptRecipe !== true && (
            <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded px-3.5 py-2.5">
              ⚠️ <b>ท่อไม่ได้ยืนยันว่าสูตรส่วนประกอบถูกส่งกลับไปครบ</b>
              <span className="block mt-1">
                บันทึกชื่อ/ราคา/VAT แล้ว แต่ <b>ยังไม่รู้ว่าสูตรรอดไหม</b> — ไปเปิดหน้ารายละเอียดชุดตรวจสูตรก่อนขายต่อ
              </span>
            </div>
          )}
          {/* อ่านกลับไม่ได้ ≠ ไม่สำเร็จ — ท่อตอบ ok มาแล้ว ห้ามจอแปลว่าล้มเหลว */}
          {result?.updated && result?.after === null && (
            <div className="text-[12.5px] text-gray-700 bg-gray-50 border border-gray-300 rounded px-3.5 py-2.5">
              ℹ️ <b>บันทึกแล้ว แต่ยังอ่านค่ากลับจาก ZORT ไม่ได้</b>
              {result.afterUnknown ? <span className="block mt-1">เหตุ: {result.afterUnknown}</span> : null}
              <span className="block mt-1">ไม่ได้แปลว่าไม่สำเร็จ · เปิดหน้ารายละเอียดชุดเพื่อดูค่าจริงอีกครั้ง</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void send(false)} disabled={busy || !ref}
              className="text-[14px] font-semibold text-gray-800 bg-white border-2 border-gray-300 rounded-full px-6 py-2 disabled:opacity-50">
              {busy ? 'กำลังส่ง…' : '🧪 ทดลองแก้ (ยังไม่เข้า ZORT)'}
            </button>
            {/* ใช้ปุ่มกลาง ⇒ สภาพ "กดไม่ได้" อ่านออก (เดิมขาวบนน้ำเงิน + opacity-40 = 1.75:1) */}
            <PillSend พร้อมส่งจริง={!!ref && dryOk} กำลังส่ง={busy}
              onClick={() => void send(true)}>บันทึกจริงใน ZORT</PillSend>
            {!dryOk && <span className="text-[12.5px] text-gray-500">ต้องทดลองด้วยค่าชุดปัจจุบันให้ผ่านก่อน</span>}
          </div>
        </div>
      )}
    </div>
  )
}
