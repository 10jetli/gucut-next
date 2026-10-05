'use client'
/* 🏭 ผังโกดัง 3 มิติ — **ข้างในโกดัง เห็นชั้นแร็ค** (ขั้นแรก: ทำทีละหมวด)
 *
 * ท่านประธานสั่งคำต่อคำ 5 ต.ค. 2569: "เป็นโกดัง 3D · ข้างในเป็นชั้นแร็ค ·
 * วางอะไหล่เป็นหมวด ๆ · ทำทีละหมวด" ⇒ ไม่ใช่ฉากเมืองมองจากข้างนอกแบบ WareTrack
 *
 * 🔑 **หมวดเป็นช่องจริงในฐาน ไม่ใช่การเดารุ่นจากชื่อสินค้า**
 *    `list=categories` ให้ 43 หมวด ชื่อเป็นรุ่นเครื่องตรง ๆ ("อะไหล่ MS 381")
 *    และ `list=stock&category=<ชื่อ>` กรองจริง (วัดเอง 5 ต.ค.: 2,674 → 128 = ตรงกับ `skus`)
 *    ⇒ กฎร้าน **no-substring-classification** ปลอดภัย ไม่มี `includes()` เดารุ่นสักจุด
 *    ⚠️ สะกดได้ตัวเดียวคือ `category=` — `cat=` `catname=` `cat_name=` **ถูกเมินเงียบ ๆ**
 *       และ `applied` **ไม่สะท้อนช่องนี้กลับ** ⇒ ตาข่ายคือเทียบ `total` กับ `skus` ของหมวด
 *
 * 🎨 **3D ด้วย CSS transforms ไม่ใช่ three.js** — ของที่ต้องวาดคือกล่องกับชั้นแร็ค
 *    = ทรงสี่เหลี่ยมล้วน ⇒ `perspective` + `rotateX/Y` + `translate3d` พอ
 *    ⇒ **เพิ่มขนาดหน้าเว็บ 0 KB** · มือถือลื่นเพราะ GPU composite
 *    (ใบสั่งห้ามโหลดไลบรารี 3D หนักเข้าหน้าร้าน — ข้อนี้จึงไม่ถูกละเมิดเลย)
 *
 * 🚫 **ไม่มีเลขสมมติแม้ตัวเดียว** ทุกตัวเลขมาจากท่อ · ช่องที่ท่อไม่ส่ง เขียนว่า "ยังไม่รู้"
 * 🚫 **ไม่แตะหน้าคลังเดิม** — `/core/stock` ยังเป็นตัวจริง หน้านี้เป็นของเพิ่ม
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import Card from '@/components/ui/Card'
import { PageHead, BtnGhost } from '@/components/zort'

interface Cat {
  cat_name: string; skus: number
  onhand_value?: number; available_value?: number
  no_cost?: number; services?: number
}
interface Sku {
  sku: string; name?: string; unit?: string
  /** 🔴 `null`/ไม่มีคีย์ = **ท่อไม่ได้บอก** ซึ่งคนละเรื่องกับ `0` = ของหมดจริง */
  qty?: number | null; available?: number | null
  buy?: number | null; price?: number | null
  service?: boolean; active?: boolean
}

/** หมวดที่อยากเปิดก่อน — ท่านประธานเอ่ยชื่อหมวดนี้เอง และข้อมูลครบที่สุดตอนยิงวัด 5 ต.ค. 2569
 *
 *  ⚠️ **เป็นแค่ "อยากได้" ไม่ใช่ "ต้องมี"** — ถ้าท่อที่จอคุยด้วยไม่มีหมวดนี้ จอจะเปิดมาว่างเปล่า
 *     แล้วอ่านเหมือนจอพัง ทั้งที่ท่อแค่มีหมวดอื่น (เจอจริง 5 ต.ค. 2569 บนเครื่องทดสอบ
 *     ที่ชี้ไปท่อปลอม ซึ่งมีหมวดเดียวคือ "(ยังไม่ได้จัดหมวดใน ZORT)")
 *  ⇒ โหลดรายชื่อหมวดแล้วไม่เจอชื่อนี้ ⇒ **ถอยไปใช้หมวดแรกที่ท่อมีจริง** */
const หมวดที่อยากเปิดก่อน = 'อะไหล่ MS 381'

/** เพดานกล่องที่วาด — เกินนี้ต้องเขียนบนจอว่า "มีทั้งหมด N แสดง M" (กฎข้อ 4 ของ CLAUDE.md) */
const ชั้น = 8
const ช่องต่อชั้น = 16
const เพดานกล่อง = ชั้น * ช่องต่อชั้น   // 128

/** สภาพของช่องวางหนึ่งช่อง — **สี่อย่าง ห้ามยุบเหลือสอง**
 *  `ไม่รู้` ต้องแยกจาก `หมด` เสมอ ไม่งั้นของที่ท่อไม่ได้บอกจะอ่านเหมือนของหมด */
type สภาพ = 'มีของ' | 'หมด' | 'ติดลบ' | 'ไม่รู้'
function สภาพของ(r: Sku): สภาพ {
  const q = r.qty
  if (q === null || q === undefined || !Number.isFinite(Number(q))) return 'ไม่รู้'
  const n = Number(q)
  if (n < 0) return 'ติดลบ'
  if (n === 0) return 'หมด'
  return 'มีของ'
}
const สีของ: Record<สภาพ, { หน้า: string; บน: string; ข้าง: string }> = {
  มีของ: { หน้า: '#c89b5e', บน: '#e0b878', ข้าง: '#a87f45' },
  หมด: { หน้า: 'transparent', บน: 'transparent', ข้าง: 'transparent' },
  ติดลบ: { หน้า: '#d9534f', บน: '#e8706c', ข้าง: '#b43e3a' },
  ไม่รู้: { หน้า: '#9aa3ad', บน: '#b4bcc4', ข้าง: '#7d858e' },
}

export default function StockMapPage() {
  const [cats, setCats] = useState<Cat[] | null>(null)
  const [หมวด, setหมวด] = useState(หมวดที่อยากเปิดก่อน)
  /** ผู้ใช้เลือกเองแล้วหรือยัง — ถ้าเลือกแล้ว **ห้ามโค้ดไปเปลี่ยนทับ** */
  const [เลือกเอง, setเลือกเอง] = useState(false)
  const [ถอยหมวด, setถอยหมวด] = useState('')
  const [rows, setRows] = useState<Sku[] | null>(null)
  const [รวมในหมวด, setรวมในหมวด] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [เลือก, setเลือก] = useState<Sku | null>(null)

  // ── มุมกล้อง ──
  const [หมุน, setหมุน] = useState(-18)
  const [ก้ม, setก้ม] = useState(10)
  const [ซูม, setซูม] = useState(1)
  const กลับมุมเริ่มต้น = () => { setหมุน(-18); setก้ม(10); setซูม(1) }

  const โหลดหมวด = useCallback(async () => {
    try {
      const r = await fetch('/api/web/core?list=categories')
      const d = await r.json()
      if (d?.error) throw new Error(d.error)
      const list: Cat[] = Array.isArray(d?.rows) ? d.rows : []
      setCats(list)
      /* ถอยไปหมวดแรกที่ท่อมีจริง — และ **เขียนบนจอว่าถอย** ไม่ใช่สลับเงียบ ๆ */
      if (!เลือกเอง && list.length && !list.some((c) => c.cat_name === หมวดที่อยากเปิดก่อน)) {
        setหมวด(list[0].cat_name)
        setถอยหมวด(หมวดที่อยากเปิดก่อน)
      }
    } catch { setCats([]) }   // หมวดโหลดไม่ได้ไม่ควรล้มทั้งจอ — ฉากยังวาดจากหมวดที่เลือกอยู่ได้
  }, [เลือกเอง])

  /** 🔴 **คำตอบที่มาช้ากว่าต้องถูกทิ้ง** — ไม่งั้นคำขอของหมวดเก่าที่ตอบทีหลังจะทับของหมวดใหม่
   *
   *  เจอจริง 5 ต.ค. 2569 บนเครื่องทดสอบ: จอขอหมวด A (ไม่มีในท่อ ⇒ 0 แถว) แล้วถอยไปหมวด B
   *  ทันที · คำตอบของ B (8 แถว) มาถึงก่อน แล้วคำตอบของ A มาทับ ⇒ **จอขึ้น 0 ทั้งที่มีของ 8**
   *  ⇒ ไม่มี error ไม่มีอะไรแดง · อ่านเหมือน "หมวดนี้ไม่มีของ" ซึ่งเป็นคำตอบที่ผิด
   *  🔑 กันด้วยการจำว่า **คำขอล่าสุดคือของหมวดไหน** แล้วทิ้งคำตอบที่ไม่ตรง */
  const หมวดที่กำลังขอ = useRef('')
  const โหลดของ = useCallback(async (ชื่อ: string) => {
    หมวดที่กำลังขอ.current = ชื่อ
    setLoading(true); setErr(''); setเลือก(null)
    try {
      const r = await fetch(`/api/web/core?list=stock&category=${encodeURIComponent(ชื่อ)}&limit=200`)
      const d = await r.json()
      if (หมวดที่กำลังขอ.current !== ชื่อ) return   // มาช้า — ของหมวดที่เลิกดูแล้ว
      if (d?.error) throw new Error(d.error)
      setRows(Array.isArray(d?.rows) ? d.rows : [])
      setรวมในหมวด(typeof d?.total === 'number' ? d.total : null)
    } catch (e) {
      if (หมวดที่กำลังขอ.current !== ชื่อ) return
      setRows(null); setรวมในหมวด(null)
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      if (หมวดที่กำลังขอ.current === ชื่อ) setLoading(false)
    }
  }, [])

  useEffect(() => { void โหลดหมวด() }, [โหลดหมวด])
  useEffect(() => { void โหลดของ(หมวด) }, [หมวด, โหลดของ])

  const แถวในหมวด = useMemo(() => cats?.find((c) => c.cat_name === หมวด) ?? null, [cats, หมวด])

  /* เรียงให้ของที่ต้องเห็นอยู่หน้าสุด: ติดลบ → หมด → มีของ (น้อยไปมาก) → ไม่รู้ */
  const เรียง = useMemo(() => {
    if (!rows) return []
    const ลำดับ: Record<สภาพ, number> = { ติดลบ: 0, หมด: 1, มีของ: 2, ไม่รู้: 3 }
    return [...rows].sort((a, b) => {
      const d = ลำดับ[สภาพของ(a)] - ลำดับ[สภาพของ(b)]
      if (d !== 0) return d
      return Number(a.qty ?? 0) - Number(b.qty ?? 0)
    })
  }, [rows])

  const วาด = เรียง.slice(0, เพดานกล่อง)
  const ถูกตัด = เรียง.length - วาด.length

  /* ตัวนับบนการ์ด — **นับจากแถวที่โหลดมาจริง** ไม่ใช่จากตัวเลขคนละแหล่ง
     (ถ้าท่อตัดแถว ตัวนับจะเล็กกว่า `skus` ของหมวด ⇒ จอต้องเขียนกำกับ ไม่ใช่วางคู่กันเฉย ๆ) */
  const นับ = useMemo(() => {
    const c = { มีของ: 0, หมด: 0, ติดลบ: 0, ไม่รู้: 0 }
    for (const r of เรียง) c[สภาพของ(r)]++
    return c
  }, [เรียง])

  /** ความสูงกล่อง — ใช้ log เพราะจำนวนต่างกันหลายเท่าตัว ถ้าใช้เชิงเส้นกล่องเล็กจะหายไปเลย */
  const สูงของ = (r: Sku) => {
    const n = Number(r.qty)
    if (!Number.isFinite(n) || n <= 0) return 10
    return Math.min(30, 8 + Math.log10(n + 1) * 11)
  }

  /* ── เรขาคณิตของฉาก (px ในระบบพิกัดของเวที) ──
   * 🔑 **ทุกชิ้นวางด้วยจุดกึ่งกลาง** ผ่าน `วาง()` — `left:50% top:0` แล้วเลื่อนด้วย `translate3d`
   *    รุ่นแรกผสม `top:72%` กับ `transformOrigin:'top center'` ⇒ ชั้นลอยเฉียงเหมือนแผ่นกระดาษ
   *    `tsc` เขียว ด่านเขียว **แต่จอไม่ใช่โกดัง** — เจอตอนถ่ายจอดูด้วยตา 5 ต.ค. 2569
   * 🔑 แกน: x = ขวา · y = **ลง** · z = เข้าหาคนดู */
  const กว้างกล่อง = 26, ช่องว่าง = 6, ลึกชั้น = 64
  const สูงช่วงชั้น = 52, หนาชั้น = 5
  const สูงเวที = 470

  /* 🔑 **แร็คต้องพอดีกับของที่มีจริง** — ตรึงไว้ 8×16 แล้วหมวดที่มี 8 รหัส
     จะได้แร็คสูงลิ่วที่ว่าง 7 ชั้น ⇒ อ่านเหมือน "ของหายไปไหนหมด" ทั้งที่ของครบ
     (เห็นกับตาตอนถ่ายจอ 5 ต.ค. 2569) ⇒ คำนวณจำนวนช่อง/ชั้นจากจำนวนรหัสจริง */
  const ช่องจริง = Math.max(4, Math.min(ช่องต่อชั้น, Math.ceil(Math.sqrt(วาด.length * 2))))
  const ชั้นจริง = Math.max(1, Math.min(ชั้น, Math.ceil(วาด.length / ช่องจริง)))
  const กว้างชั้น = ช่องจริง * (กว้างกล่อง + ช่องว่าง)
  const สูงแร็ค = ชั้นจริง * สูงช่วงชั้น
  const พื้นY = 60 + สูงแร็ค
  const ชั้นYของ = (n: number) => พื้นY - n * สูงช่วงชั้น

  /** 🔑 **ย่อให้พอดีเวทีเอง** — แร็ค 8 ชั้นสูงกว่าเวที ⇒ ขอบล่างถูกตัดหายโดยไม่มีอะไรฟ้อง
   *  (เห็นกับตาตอนถ่ายจอกับข้อมูลจริง 128 รหัส 5 ต.ค. 2569 — ชั้นล่างสุดหลุดขอบ
   *   ซึ่งเป็นชั้นที่เรา**ตั้งใจ**เอาของหมด/ติดลบไปไว้ ⇒ ของที่สำคัญที่สุดคือของที่หายไป) */
  const พอดี = Math.min(1, (สูงเวที - 70) / (พื้นY + 78))

  /** วางชิ้นส่วนด้วยจุดกึ่งกลาง — ใช้ซ้ำทุกชิ้นในฉาก */
  const วาง = (x: number, y: number, z: number, w: number, h: number, หมุน = ''): React.CSSProperties => ({
    position: 'absolute', left: '50%', top: 0, width: w, height: h,
    transform: `translate3d(${x - w / 2}px, ${y - h / 2}px, ${z}px) ${หมุน}`,
    transformStyle: 'preserve-3d',
  })

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHead title="ผังโกดัง 3 มิติ"
        summary="มองจากข้างในโกดัง — หนึ่งแร็คคือหนึ่งหมวด (หมวด = รุ่นเครื่อง) · ขั้นแรกทำทีละหมวดตามที่ท่านประธานสั่ง" />

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/core/stock" className="text-[12.5px] text-blue-600 hover:underline">
          ← หน้าคลังสินค้า (ตัวจริง ยังอยู่ครบ)
        </Link>
        <BtnGhost onClick={() => void โหลดของ(หมวด)} disabled={loading}>โหลดใหม่</BtnGhost>
      </div>

      {/* ── เลือกหมวด = เลือกแร็ค ── */}
      <Card>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-gray-600">
            หมวด (= แร็คหนึ่งตัว){cats === null && <span className="ml-1 font-normal text-gray-400">กำลังอ่านรายชื่อหมวด…</span>}
            {cats?.length === 0 && <span className="ml-1 font-normal text-amber-700">อ่านรายชื่อหมวดไม่สำเร็จ — เลือกหมวดอื่นยังไม่ได้ แต่แร็คนี้ยังวาดได้</span>}
          </span>
          <select value={หมวด} onChange={(e) => { setเลือกเอง(true); setหมวด(e.target.value) }} disabled={!cats?.length}
            className="w-full max-w-xl rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-[14px] disabled:bg-gray-50">
            {!cats?.some((c) => c.cat_name === หมวด) && <option value={หมวด}>{หมวด}</option>}
            {(cats ?? []).map((c) => (
              <option key={c.cat_name} value={c.cat_name}>{c.cat_name} · {fmtNum(c.skus)} รหัส</option>
            ))}
          </select>
        </label>
        {/* 🔑 สลับหมวดเองแล้วเงียบ = คนอ่านว่าจอเลือกผิด ⇒ บอกตรง ๆ ว่าถอยมาจากอะไรเพราะอะไร */}
        {ถอยหมวด && (
          <p className="mt-1.5 text-[11.5px] text-amber-700">
            ⚠️ ท่อที่จอนี้คุยด้วย <b>ไม่มีหมวด &ldquo;{ถอยหมวด}&rdquo;</b> — เปิดหมวดแรกที่มีจริงให้แทน
          </p>
        )}
      </Card>

      {/* ── การ์ดตัวเลข — ของจริงทั้งหมด ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <p className="text-[11.5px] text-gray-500">รหัสในหมวดนี้</p>
          <p className="text-[22px] font-black text-gray-900">
            {รวมในหมวด === null ? <span className="text-[14px] text-gray-400">ยังไม่รู้</span> : fmtNum(รวมในหมวด)}
          </p>
          {/* 🔴 ตัวเลขสองตัวมาคนละเส้น ⇒ ต้องเขียนว่าต่างกันตรงไหน ห้ามวางคู่กันเฉย ๆ */}
          {แถวในหมวด && รวมในหมวด !== null && แถวในหมวด.skus !== รวมในหมวด && (
            <p className="mt-1 text-[11px] font-semibold text-amber-700">
              ⚠️ ตารางหมวดบอก {fmtNum(แถวในหมวด.skus)} — คนละกติกากับเส้นที่ดึงแถวมา
            </p>
          )}
        </Card>
        <Card>
          <p className="text-[11.5px] text-gray-500">มูลค่าทุนคงเหลือ</p>
          <p className="text-[22px] font-black text-gray-900">
            {typeof แถวในหมวด?.onhand_value === 'number'
              ? fmtMoney(แถวในหมวด.onhand_value)
              : <span className="text-[14px] text-gray-400">ยังไม่รู้</span>}
          </p>
          <p className="mt-1 text-[11px] text-gray-400">จากตารางหมวด (ต้นทุนเฉลี่ยที่คัดจาก ZORT)</p>
        </Card>
        <Card>
          <p className="text-[11.5px] text-gray-500">ของหมด (ช่องว่างบนชั้น)</p>
          <p className="text-[22px] font-black text-gray-900">{rows ? fmtNum(นับ.หมด) : <span className="text-[14px] text-gray-400">—</span>}</p>
          {นับ.ติดลบ > 0 && <p className="mt-1 text-[11px] font-semibold text-red-600">ติดลบอีก {fmtNum(นับ.ติดลบ)} รหัส</p>}
        </Card>
        <Card>
          <p className="text-[11.5px] text-gray-500">ท่อไม่ได้บอกจำนวน</p>
          <p className="text-[22px] font-black text-gray-900">{rows ? fmtNum(นับ.ไม่รู้) : <span className="text-[14px] text-gray-400">—</span>}</p>
          <p className="mt-1 text-[11px] text-gray-400">นับแยกจาก &ldquo;ของหมด&rdquo; เสมอ — ไม่รู้ ≠ 0</p>
        </Card>
      </div>

      {loading && <LoadingState />}
      {!loading && err && <ErrorBox title="ดึงของในหมวดนี้ไม่ได้">{err}</ErrorBox>}
      {!loading && !err && rows?.length === 0 && (
        <Card><p className="text-[13px] text-amber-800">
          หมวด <b>{หมวด}</b> ไม่มีรหัสสินค้าเลยในชุดที่ท่อตอบกลับมา — <b>ไม่ได้แปลว่าหมวดนี้ไม่มีอยู่</b>
        </p></Card>
      )}

      {!loading && !err && !!rows?.length && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
            {/* ══ ฉากโกดัง ══ */}
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-[13px] font-semibold text-gray-900">ข้างในโกดัง · แร็คของหมวด {หมวด}</p>
                <div className="flex items-center gap-1">
                  {([
                    ['↺', 'หมุนซ้าย', () => setหมุน((v) => v - 12)],
                    ['↻', 'หมุนขวา', () => setหมุน((v) => v + 12)],
                    ['↑', 'ก้มน้อยลง', () => setก้ม((v) => Math.max(-5, v - 6))],
                    ['↓', 'ก้มมากขึ้น', () => setก้ม((v) => Math.min(55, v + 6))],
                    ['+', 'ซูมเข้า', () => setซูม((v) => Math.min(2.2, v + 0.15))],
                    ['−', 'ซูมออก', () => setซูม((v) => Math.max(0.5, v - 0.15))],
                    ['⌂', 'กลับมุมเริ่มต้น', กลับมุมเริ่มต้น],
                  ] as [string, string, () => void][]).map(([ตัว, ชื่อ, ทำ]) => (
                    <button key={ชื่อ} onClick={ทำ} title={ชื่อ} aria-label={ชื่อ}
                      className="h-7 w-7 rounded-lg border border-gray-200 bg-white text-[13px] text-gray-700 hover:bg-gray-50 active:scale-95">
                      {ตัว}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl"
                style={{
                  /* เพอร์สเปกทีฟแรงเกินทำให้เสาที่อยู่ริมดูเอน — ยิ่งตัวเลขมาก ยิ่งใกล้ภาพฉาย */
                  perspective: '2600px', perspectiveOrigin: '50% 50%',
                  background: 'linear-gradient(#e9eef5 0%, #dbe3ee 55%, #cdd7e4 100%)',
                }}>
                <div style={{
                  position: 'relative', width: '100%', height: สูงเวที,
                  transformStyle: 'preserve-3d',
                  transform: `rotateX(${ก้ม}deg) rotateY(${หมุน}deg) scale(${ซูม * พอดี})`,
                  transformOrigin: '50% 55%',
                  transition: 'transform 220ms ease-out',
                }}>
                  {/* พื้นโกดัง
                      🔴 **ต้องอยู่ต่ำกว่าคานชั้นล่างสุด** — ตอนวางที่ระดับเดียวกัน แผ่นพื้นที่กว้าง
                         และลึก 420px บังของบนชั้นล่างสุดจนหายทั้งแถว (16 รหัส รวมช่องว่าง 9 ช่อง)
                         DOM มีครบ ตัวนับถูก **แต่ตามองไม่เห็น** ⇒ การ์ดบอก "ของหมด 9" แล้วหาในฉากไม่เจอ
                         (วัดด้วยพิกัดจริงจาก DOM 5 ต.ค. 2569 ก่อนจะรู้ว่าไม่ใช่เรื่องสีจาง) */}
                  <div style={{
                    ...วาง(0, พื้นY + 30, 0, กว้างชั้น + 260, 420, 'rotateX(90deg)'),
                    background: 'repeating-linear-gradient(90deg,#c6d0dc 0 58px,#bcc7d4 58px 60px)',
                  }} />
                  {/* ผนังหลัง */}
                  <div style={{
                    ...วาง(0, พื้นY - 230, -ลึกชั้น / 2 - 70, กว้างชั้น + 260, 470),
                    background: 'linear-gradient(#f6f9fc,#e2e9f2)',
                  }} />

                  {/* เสาแร็คสองข้าง */}
                  {[-1, 1].map((ด้าน) => (
                    <div key={`เสา${ด้าน}`} style={{
                      ...วาง(ด้าน * (กว้างชั้น / 2 + 5), พื้นY + 15 - (สูงแร็ค + 30) / 2, 0,
                        10, สูงแร็ค + 30),
                      background: '#5f6b7a', borderRadius: 2,
                    }} />
                  ))}

                  {/* คานชั้น — แผ่นนอนจริง มีความหนา */}
                  {Array.from({ length: ชั้นจริง }).map((_, n) => (
                    <div key={`ชั้น${n}`} style={{ ...วาง(0, ชั้นYของ(n), 0, กว้างชั้น, ลึกชั้น, 'rotateX(90deg)') }}>
                      <span style={{ position: 'absolute', inset: 0, background: '#8d99a8', boxShadow: 'inset 0 0 0 1px #6f7b8a' }} />
                    </div>
                  ))}
                  {/* ขอบหน้าของคาน ให้เห็นความหนา */}
                  {Array.from({ length: ชั้นจริง }).map((_, n) => (
                    <div key={`ขอบ${n}`} style={{
                      ...วาง(0, ชั้นYของ(n) + หนาชั้น / 2, ลึกชั้น / 2, กว้างชั้น, หนาชั้น),
                      background: '#6f7b8a',
                    }} />
                  ))}

                  {/* ── กล่อง = รหัสสินค้าจริง ── */}
                  {วาด.map((r, i) => {
                    const ช่อง = i % ช่องจริง
                    const ชั้นที่ = Math.floor(i / ช่องจริง)
                    const s = สภาพของ(r)
                    const สี = สีของ[s]
                    const h = สูงของ(r)
                    const x = -กว้างชั้น / 2 + ช่อง * (กว้างกล่อง + ช่องว่าง) + (กว้างกล่อง + ช่องว่าง) / 2
                    const yบนชั้น = ชั้นYของ(ชั้นที่) - หนาชั้น
                    const เด่น = เลือก?.sku === r.sku
                    const ลึกกล่อง = 30

                    if (s === 'หมด') {
                      /* ของหมด = **ช่องว่างที่เห็นได้** ไม่ใช่กล่องสีจาง ๆ ที่อ่านเหมือนมีของ */
                      return (
                        <button key={r.sku} onClick={() => setเลือก(r)} title={`${r.sku} — ของหมด`}
                          style={{
                            /* 🔴 เส้นประบาง ๆ บนคานสีเทา **กลืนหายไปเลย** ⇒ ของหมดอ่านเหมือนชั้นเปล่าธรรมดา
                               ⇒ ใส่พื้นแดงจาง + เส้นประแดง ให้ "ช่องที่ของหมด" เป็นสิ่งที่ตาจับได้ */
                            ...วาง(x, yบนชั้น - 9, 0, กว้างกล่อง, 18),
                            /* 📏 วัดแล้ว 5 ต.ค. 2569: ช่องว่างกว้าง ~18px สูง ~14px บนจอ 1440
                               แดง 16% ที่ขนาดนั้น **ตาไม่จับ** ทั้งที่ DOM มีครบ 9 ช่อง
                               ⇒ ของที่ถูกต้องแต่มองไม่เห็น = การ์ดบอก "ของหมด 9" แล้วหาในฉากไม่เจอ */
                            border: `2px dashed ${เด่น ? '#2563eb' : '#b3403b'}`,
                            borderRadius: 2, background: 'rgba(217,83,79,.42)',
                            padding: 0, cursor: 'pointer',
                          }} />
                      )
                    }
                    return (
                      <button key={r.sku} onClick={() => setเลือก(r)}
                        title={`${r.sku} · ${s === 'ไม่รู้' ? 'ท่อไม่ได้บอกจำนวน' : `${fmtNum(Number(r.qty))} ${r.unit || ''}`}`}
                        style={{
                          ...วาง(x, yบนชั้น - h / 2, 0, กว้างกล่อง, h),
                          background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
                          filter: เด่น ? 'drop-shadow(0 0 7px #2563eb)' : undefined,
                        }}>
                        {/* หน้า */}
                        <span style={{
                          position: 'absolute', inset: 0, background: สี.หน้า,
                          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.22)',
                          transform: `translateZ(${ลึกกล่อง / 2}px)`,
                        }} />
                        {/* ฝาบน */}
                        <span style={{
                          position: 'absolute', left: 0, top: '50%', width: กว้างกล่อง, height: ลึกกล่อง,
                          marginTop: -ลึกกล่อง / 2, background: สี.บน,
                          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.22)',
                          transform: `translateY(${-h / 2}px) rotateX(90deg)`,
                        }} />
                        {/* ด้านขวา */}
                        <span style={{
                          position: 'absolute', left: '50%', top: 0, width: ลึกกล่อง, height: h,
                          marginLeft: -ลึกกล่อง / 2, background: สี.ข้าง,
                          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.22)',
                          transform: `translateX(${กว้างกล่อง / 2}px) rotateY(90deg)`,
                        }} />
                      </button>
                    )
                  })}

                  {/* ป้ายหมวดติดหน้าแร็ค — หันเข้าหาคนดูเสมอ */}
                  <div style={{
                    ...วาง(0, พื้นY + 58, ลึกชั้น / 2 + 2, กว้างชั้น, 26, `rotateY(${-หมุน}deg)`),
                    textAlign: 'center',
                  }}>
                    <span className="inline-block rounded bg-[#28333f] px-3 py-1 text-[12px] font-bold text-white">
                      {หมวด}
                    </span>
                  </div>
                </div>
              </div>
              {/* คำอธิบายสี + ขอบเขตของสิ่งที่วาด */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-gray-600">
                <span><span className="inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: สีของ.มีของ.หน้า }} /> มีของ (กล่องสูงตามจำนวน)</span>
                <span><span className="inline-block h-2.5 w-3 rounded-sm border border-dashed border-gray-400 align-middle" /> ของหมด — ช่องว่างบนชั้น</span>
                <span><span className="inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: สีของ.ติดลบ.หน้า }} /> ติดลบ</span>
                <span><span className="inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: สีของ.ไม่รู้.หน้า }} /> ท่อไม่ได้บอกจำนวน</span>
              </div>
              {/* ⚠️ กฎข้อ 4: วาดไม่ครบต้องเขียนว่ามีทั้งหมดเท่าไหร่ แสดงเท่าไหร่ */}
              <p className="mt-1.5 text-[11.5px] text-gray-500">
                {ถูกตัด > 0
                  ? <>⚠️ หมวดนี้มี <b>{fmtNum(เรียง.length)}</b> รหัส · <b>วาดได้ {fmtNum(วาด.length)} กล่อง</b> (ชั้นเต็ม) — อีก {fmtNum(ถูกตัด)} รหัสยังไม่อยู่ในฉาก</>
                  : <>วาดครบทั้ง <b>{fmtNum(วาด.length)}</b> รหัสของหมวดนี้ (แร็ค {ชั้นจริง} ชั้น × {ช่องจริง} ช่อง)</>}
                {' · '}เรียงให้ของที่ต้องดูก่อน (ติดลบ → หมด → ของน้อย) อยู่ชั้นล่างสุด
              </p>
            </Card>

            {/* ══ แผงขวา ══ */}
            <Card>
              <p className="text-[13px] font-semibold text-gray-900 mb-2">รายละเอียดช่องที่เลือก</p>
              {!เลือก && <p className="text-[12.5px] text-gray-400">คลิกกล่องในฉากเพื่อดูรหัสนั้น</p>}
              {เลือก && (
                <div className="space-y-2">
                  <p className="font-mono text-[14px] font-bold text-gray-900">{เลือก.sku}</p>
                  <p className="text-[12.5px] text-gray-700 leading-relaxed">{เลือก.name || <span className="text-gray-400">ท่อไม่ได้ส่งชื่อมา</span>}</p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {([
                      ['คงเหลือ', เลือก.qty],
                      ['พร้อมขาย', เลือก.available],
                    ] as [string, number | null | undefined][]).map(([ป้าย, v]) => (
                      <div key={ป้าย}>
                        <p className="text-[11px] text-gray-500">{ป้าย}</p>
                        <p className="text-[15px] font-semibold text-gray-900">
                          {v === null || v === undefined || !Number.isFinite(Number(v))
                            ? <span className="text-[12.5px] text-gray-400">ท่อไม่ได้บอก</span>
                            : <>{fmtNum(Number(v))} <span className="text-[12px] font-normal text-gray-500">{เลือก.unit || ''}</span></>}
                        </p>
                      </div>
                    ))}
                    <div>
                      <p className="text-[11px] text-gray-500">ราคาทุน (ราคาซื้อที่ตั้งไว้)</p>
                      <p className="text-[15px] font-semibold text-gray-900">
                        {typeof เลือก.buy === 'number' ? fmtMoney(เลือก.buy) : <span className="text-[12.5px] text-gray-400">ท่อไม่ได้บอก</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500">ราคาขาย</p>
                      <p className="text-[15px] font-semibold text-gray-900">
                        {typeof เลือก.price === 'number' ? fmtMoney(เลือก.price) : <span className="text-[12.5px] text-gray-400">ท่อไม่ได้บอก</span>}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-2">
                    <Link href={`/core/stock/${encodeURIComponent(เลือก.sku)}`}
                      className="text-[12.5px] text-blue-600 hover:underline">เปิดจอสินค้ารายตัว →</Link>
                    <Link href={`/core/stock?q=${encodeURIComponent(เลือก.sku)}`}
                      className="text-[12.5px] text-blue-600 hover:underline">ดูในตารางคลัง →</Link>
                  </div>
                  <p className="pt-1 text-[11px] text-gray-400 leading-relaxed">
                    ⚠️ &ldquo;ราคาทุน&rdquo; ตรงนี้คือ <b>ราคาซื้อที่ตั้งไว้</b> ไม่ใช่ต้นทุนเฉลี่ย —
                    มูลค่าบนการ์ดข้างบนใช้ต้นทุนเฉลี่ยที่คัดจาก ZORT ⇒ <b>คนละฐาน อย่าเอามาคูณเทียบกัน</b>
                  </p>
                </div>
              )}
            </Card>
          </div>

          <Card>
            <p className="text-[12px] text-gray-600 leading-relaxed">
              🧭 <b>ขั้นแรกทำทีละหมวดตามที่ท่านประธานสั่ง</b> — ตอนนี้วาดแร็คของหมวดที่เลือกตัวเดียว
              {' '}เปลี่ยนหมวดได้จากช่องด้านบน · ขั้นถัดไปคือเรียงหลายแร็คในโกดังเดียวให้เดินดูได้
              {' '}แล้วค่อยปักหมุดเตือนของหมด และแยกตามสาขา
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
