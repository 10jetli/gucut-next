'use client'
// ขอทะเบียนเลื่อยยนต์ (ใบ ลซ.๒) — ฉบับเนื้อเดียว · ท่อ /api/web/permit-doc
import { useCallback, useEffect, useState } from 'react'

interface Doc {
  phone: string; name: string; at: string; stage: string
  saw?: string; province?: string; images: number; updatedAt?: string
}
// ⚠️ ต้องตรงกับ CASE_STAGES ของ gucut-web (src/lib/permit.ts) — ลำดับคือเส้นเรื่อง
const STAGES: { key: string; label: string; by: string }[] = [
  { key: 'printed',   label: 'พิมพ์แบบ ลซ.๑ แล้ว', by: 'ลูกค้า' },
  { key: 'submitted', label: 'ยื่นที่สำนักงานแล้ว', by: 'ลูกค้า' },
  { key: 'gotlz2',    label: 'ได้ใบ ลซ.๒ มาแล้ว', by: 'ลูกค้า' },
  { key: 'lz2',       label: 'ส่งใบ ลซ.๒ ให้ร้านแล้ว', by: 'ลูกค้า' },
  { key: 'got',       label: 'ร้านได้ใบตัวจริงแล้ว', by: 'ร้าน' },
  { key: 'shipped',   label: 'ร้านส่งเลื่อยแล้ว', by: 'ร้าน' },
  { key: 'done',      label: 'ได้ใบ ลซ.๓ ครบแล้ว', by: 'ลูกค้า' },
]
const labelOf = (k: string) => STAGES.find((s) => s.key === k)?.label || 'ยังไม่เริ่ม'
const idxOf = (k: string) => STAGES.findIndex((s) => s.key === k)

export default function WebPermitsPage() {
  const [items, setItems] = useState<Doc[] | null>(null)
  const [err, setErr] = useState('')
  const [openId, setOpenId] = useState('')
  const [imgs, setImgs] = useState<string[]>([])
  const [loadingImg, setLoadingImg] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/web/permit-doc')
      if (!r.ok) throw new Error()
      const d = await r.json()
      setItems(Array.isArray(d.items) ? d.items : [])
    } catch { setErr('โหลดรายการไม่สำเร็จ'); setItems([]) }
  }, [])
  useEffect(() => { load() }, [load])

  async function open(phone: string) {
    if (openId === phone) { setOpenId(''); setImgs([]); return }
    setOpenId(phone); setImgs([]); setLoadingImg(true)
    try {
      const r = await fetch(`/api/web/permit-doc?phone=${encodeURIComponent(phone)}`)
      const d = await r.json().catch(() => null)
      setImgs(Array.isArray(d?.imageData) ? d.imageData : [])
    } catch { setErr('เปิดรูปไม่สำเร็จ') }
    finally { setLoadingImg(false) }
  }

  async function setStage(phone: string, stage: string) {
    setErr('')
    const r = await fetch('/api/web/permit-doc', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, stage }),
    }).catch(() => null)
    if (!r?.ok) { setErr('เปลี่ยนขั้นไม่สำเร็จ'); return }
    setItems((cur) => (cur ?? []).map((x) => (x.phone === phone ? { ...x, stage } : x)))
  }

  // ── 📮 รับใบ ลซ.๒ ที่ลูกค้าส่งมาทางไปรษณีย์ (5 ต.ค. 2569) ──
  const [openAdd, setOpenAdd] = useState(false)
  const [addPhone, setAddPhone] = useState('')
  const [addName, setAddName] = useState('')
  const [addFiles, setAddFiles] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [addMsg, setAddMsg] = useState('')

  /** วาดลงผืนผ้าใบแล้วคืนเป็น JPEG ย่อแล้ว */
  function วาดเป็นJPEG(src: CanvasImageSource, w: number, h: number): string {
    const กว้าง = Math.min(1600, w)
    const สูง = Math.round((h * กว้าง) / w)
    const cv = document.createElement('canvas')
    cv.width = กว้าง; cv.height = สูง
    cv.getContext('2d')!.drawImage(src, 0, 0, กว้าง, สูง)
    return cv.toDataURL('image/jpeg', 0.82)
  }

  /** ย่อรูปในเครื่องก่อนส่ง — รองรับ **ทุกชนิดไฟล์** รวม HEIC จาก iPhone
   *
   *  🔴 ท่านประธานเจอจริง 5 ต.ค. 2569: IMG_6095.HEIC อ่านไม่ได้
   *     createImageBitmap รองรับแค่ jpeg/png/webp/gif — iPhone ถ่ายเป็น HEIC โดยปริยาย
   *  🔑 ไล่สามทาง ถูกที่สุดก่อน: bitmap → <img> (Safari ถอด HEIC ได้เอง) → heic2any
   *     คนถ่ายจากมือถือผ่านเว็บไม่ต้องโหลดอะไรเลย (iOS แปลงเป็น JPEG ให้ก่อนส่งอยู่แล้ว)
   *  ⚠️ 1600px ยังอ่านตัวหนังสือบนใบ ลซ.๒ ออกสบาย · กล้องให้ไฟล์ 4-8 MB เกินเพดาน 4 MB
   */
  async function ย่อรูป(f: File): Promise<string> {
    // ① เร็วสุด — ใช้ได้กับรูปส่วนใหญ่
    try {
      const bmp = await createImageBitmap(f)
      return วาดเป็นJPEG(bmp, bmp.width, bmp.height)
    } catch { /* ไปทางถัดไป */ }

    // ② <img> — Safari/macOS ถอด HEIC ได้เองโดยไม่ต้องโหลดอะไร
    try {
      const url = URL.createObjectURL(f)
      const im = await new Promise<HTMLImageElement>((ok, ng) => {
        const el = new Image()
        el.onload = () => ok(el)
        el.onerror = () => ng(new Error('decode'))
        el.src = url
      })
      const out = วาดเป็นJPEG(im, im.naturalWidth, im.naturalHeight)
      URL.revokeObjectURL(url)
      return out
    } catch { /* ไปทางถัดไป */ }

    // ③ ตัวแปลง HEIC — โหลดเฉพาะตอนจำเป็น (~1 MB) ไม่ถ่วงคนทั่วไป
    const heic2any = (await import('heic2any')).default as
      (o: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>
    const ผล = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.85 })
    const jpg = Array.isArray(ผล) ? ผล[0] : ผล
    const bmp = await createImageBitmap(jpg)
    return วาดเป็นJPEG(bmp, bmp.width, bmp.height)
  }

  // 🤖 ผลที่ AI อ่านได้จากใบ — โชว์ให้คนตรวจก่อนบันทึกเสมอ
  const [lz2, setLz2] = useState<Record<string, string> | null>(null)
  const [reading, setReading] = useState(false)

  /** ส่งรูปให้ AI อ่าน — ไม่บันทึกอะไร แค่เติมช่องให้ดู */
  async function AIอ่าน(รูป: string) {
    setReading(true); setAddMsg('')
    try {
      const r = await fetch('/api/web/permit-doc?read=1', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image: รูป }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setAddMsg(d?.error || 'อ่านใบไม่สำเร็จ — กรอกเองได้'); return }
      const got = (d?.['อ่านได้'] || {}) as Record<string, string>
      setLz2(got)
      if (got['ชื่อ'] && !addName) setAddName(got['ชื่อ'])
      setAddMsg('🤖 อ่านใบแล้ว — ตรวจให้ถูกก่อนบันทึก')
    } catch { setAddMsg('ตัวอ่านไม่ตอบ — กรอกเองได้') }
    finally { setReading(false) }
  }

  async function เลือกรูป(e: React.ChangeEvent<HTMLInputElement>) {
    setAddMsg('')
    const fs = Array.from(e.target.files || []).slice(0, 2)
    if (!fs.length) return
    // HEIC ต้องโหลดตัวแปลง ~1 MB แล้วถอดเอง — บอกให้รู้ว่ากำลังทำอะไรอยู่
    const heic = fs.some((f) => /heic|heif/i.test(f.type) || /\.hei[cf]$/i.test(f.name))
    setAddMsg(heic ? 'กำลังแปลงรูปจาก iPhone…' : 'กำลังเตรียมรูป…')
    try {
      const ย่อแล้ว = await Promise.all(fs.map(ย่อรูป))
      setAddFiles(ย่อแล้ว)
      setAddMsg('')
      // 🤖 อ่านใบใบแรกทันที — ร้านจะได้ไม่ต้องกรอกอะไรนอกจากเบอร์
      if (ย่อแล้ว[0]) AIอ่าน(ย่อแล้ว[0])
    } catch (e) {
      // ⚠️ บอกชื่อไฟล์ด้วย — เลือกสองใบพร้อมกันแล้วขึ้นว่า "อ่านไม่ได้" เฉย ๆ จะงงว่าใบไหน
      setAddMsg(`อ่านไฟล์ "${fs[0]?.name || '?'}" ไม่ได้ — ลองถ่ายใหม่ หรือบันทึกเป็น JPG ก่อน`)
    }
  }

  async function ส่งใบ() {
    setAddMsg('')
    if (addPhone.replace(/[^0-9]/g, '').length < 9) { setAddMsg('ใส่เบอร์ลูกค้าให้ครบก่อน'); return }
    if (!addFiles.length) { setAddMsg('ยังไม่ได้แนบรูปใบ ลซ.๒'); return }
    setSending(true)
    try {
      const r = await fetch('/api/web/permit-doc?shop=1', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: addPhone, name: addName, images: addFiles,
                               lz2: lz2 || undefined }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) { setAddMsg(d?.error || 'บันทึกไม่สำเร็จ'); return }
      setAddMsg(d?.เรื่องใหม่ ? '✅ บันทึกแล้ว (ลูกค้ารายใหม่)' : '✅ บันทึกแล้ว')
      setAddPhone(''); setAddName(''); setAddFiles([]); setLz2(null)
      await load()
      setTimeout(() => { setOpenAdd(false); setAddMsg('') }, 1200)
    } catch { setAddMsg('ส่งไม่ถึงเซิร์ฟเวอร์') }
    finally { setSending(false) }
  }

  /** 🗑 ลบเรื่องที่บันทึกผิด — ถ่ายรูปผิดคน/ผิดใบต้องมีทางแก้
   *  ⚠️ ถามยืนยันพร้อม "อ่านชื่อ" ไม่ใช่ถามแค่ "แน่ใจไหม" (กดพลาดแล้วเอาคืนไม่ได้) */
  async function ลบเรื่อง(phone: string, name: string) {
    if (!confirm(`ลบเรื่องของ "${name || phone}" ถาวร?\n\nรูปใบ ลซ.๒ ที่เก็บไว้จะถูกลบด้วย เอาคืนไม่ได้`)) return
    const r = await fetch(`/api/web/permit-doc?shop=1&phone=${encodeURIComponent(phone)}&confirm=1`,
      { method: 'DELETE' }).catch(() => null)
    const d = await r?.json().catch(() => null)
    if (!r?.ok) { setErr(d?.error || 'ลบไม่สำเร็จ'); return }
    setItems((cur) => (cur ?? []).filter((x) => x.phone !== phone))
    setOpenId('')
  }

  const waiting = (items ?? []).filter((x) => x.stage === 'lz2').length

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
        <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">
          ขอทะเบียนเลื่อยยนต์
          {waiting > 0 && <span className="ml-2 align-middle rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-black text-white">{waiting} รอร้านรับใบ</span>}
        </h1>
        <p className="text-[12px] text-gray-400 mt-0.5">รูปใช้แทนตัวจริงไม่ได้ — ต้องได้ ลซ.๒ ตอนกลางตัวจริงมาเก็บเป็นหลักฐานการจำหน่าย</p>
      </div>

      {/* 📮 รับใบที่ส่งมาทางไปรษณีย์ — ลูกค้าส่วนใหญ่ไม่เคยเข้าเว็บ ส่งใบตัวจริงมาเลย */}
      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden">
        <button onClick={() => setOpenAdd((v) => !v)}
          className="w-full flex items-center gap-3 px-4 md:px-5 py-3.5 text-left hover:bg-gray-50/70 transition-colors">
          <span className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[17px] flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm">📮</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-bold text-gray-900">รับใบ ลซ.๒ ที่ส่งมาทางไปรษณีย์</span>
            <span className="block text-[11.5px] text-gray-400">ถ่ายรูปใบที่ได้รับ → เข้าระบบทันที (ลูกค้าไม่ต้องเคยเข้าเว็บ)</span>
          </span>
          <span className="shrink-0 text-gray-300 text-[18px]">{openAdd ? '−' : '+'}</span>
        </button>
        {openAdd && (
          <div className="px-4 md:px-5 pb-5 pt-1 space-y-3 border-t border-gray-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="block">
                <span className="block text-[11.5px] font-semibold text-gray-500 mb-1">เบอร์ลูกค้า *</span>
                <input value={addPhone} onChange={(e) => setAddPhone(e.target.value)}
                  inputMode="numeric" placeholder="08xxxxxxxx"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-blue-400" />
              </label>
              <label className="block">
                <span className="block text-[11.5px] font-semibold text-gray-500 mb-1">ชื่อลูกค้า <span className="font-normal text-gray-300">(AI อ่านให้)</span></span>
                <input value={addName} onChange={(e) => setAddName(e.target.value)}
                  placeholder="เว้นไว้ก็ได้ — อ่านจากใบให้"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[14px] outline-none focus:border-blue-400" />
              </label>
            </div>
            <div>
              <span className="block text-[11.5px] font-semibold text-gray-500 mb-1">รูปใบ ลซ.๒ — ถ่ายแล้ว AI อ่านให้ทันที</span>
              {/* capture="environment" = เปิดกล้องหลังทันทีบนมือถือ */}
              <input type="file" accept="image/*" multiple capture="environment" onChange={เลือกรูป}
                className="w-full text-[12.5px] file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-[12.5px] file:font-bold file:text-white" />
              {addFiles.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {addFiles.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt={`รูป ${i + 1}`} className="h-24 rounded-lg border border-gray-200" />
                  ))}
                </div>
              )}
            </div>
            {reading && (
              <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-[12.5px] font-semibold text-blue-600">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />
                กำลังให้ AI อ่านใบ…
              </div>
            )}
            {lz2 && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                <p className="text-[11.5px] font-bold text-blue-700 mb-2">
                  🤖 อ่านจากใบได้แบบนี้ — แก้ตรงไหนก็ได้ก่อนบันทึก
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {([
                    ['เลขที่ใบ', 'เลขที่ใบรับรอง'],
                    ['จังหวัดที่ใช้เลื่อย', '📍 จังหวัดที่จะใช้เลื่อย'],
                    ['วันออก', 'วันออกใบ'],
                    ['วันสิ้นอายุ', '⏰ วันสิ้นอายุใบ'],
                    ['ชื่อ', 'ชื่อผู้รับ'],
                    ['ตอน', 'ตอน (กลาง/ปลาย)'],
                    ['ประเภทต้นกำลัง', 'ประเภทต้นกำลัง'],
                    ['แรงม้า', 'แรงม้า'],
                    ['บาร์นิ้ว', 'ความยาวบาร์ (นิ้ว)'],
                    ['จังหวัดภูมิลำเนา', 'จังหวัดตามทะเบียนบ้าน'],
                  ] as [string, string][]).map(([k, label]) => (
                    <label key={k} className="block">
                      <span className="block text-[10.5px] font-semibold text-gray-500 mb-0.5">{label}</span>
                      <input value={lz2[k] || ''} onChange={(e) => setLz2({ ...lz2, [k]: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-blue-400" />
                    </label>
                  ))}
                </div>
                <p className="text-[10.5px] text-gray-400 mt-2">
                  ⚠️ &ldquo;จังหวัดที่จะใช้เลื่อย&rdquo; มาจากช่องสถานที่ออกใบ — คนละอย่างกับทะเบียนบ้านลูกค้า
                </p>
              </div>
            )}
            {addMsg && <p className={`text-[12.5px] font-semibold ${addMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{addMsg}</p>}
            <button onClick={ส่งใบ} disabled={sending}
              className="rounded-xl bg-gray-900 px-5 py-2.5 text-[13.5px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50">
              {sending ? 'กำลังบันทึก…' : 'บันทึกเข้าระบบ'}
            </button>
            <p className="text-[11px] text-gray-400">บันทึกแล้วขั้นจะขึ้นเป็น &ldquo;ร้านได้ใบตัวจริงแล้ว&rdquo; · ใบตัวจริงตอนกลางต้องเก็บไว้เป็นหลักฐานการจำหน่าย</p>
          </div>
        )}
      </div>
      {err && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">{err}</p>}

      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden divide-y divide-gray-50">
        {items === null ? (
          <div className="p-4 space-y-3 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-50" />)}</div>
        ) : items.length === 0 ? (
          /* ⚠️ โหลดไม่สำเร็จ ห้ามพูดว่า "ยังไม่มีลูกค้าทำเรื่องเข้ามา" — ขัดกับกล่องแดงข้างบน
             และเรื่องนี้คือ ลซ.๒ ที่ลูกค้าส่งมาแล้วรอร้านส่งเครื่องให้ · พลาดแล้วลูกค้ารอเก้อ */
          <p className="py-14 text-center text-[13px] text-gray-400">
            {err ? 'ยังดูไม่ได้ — โหลดรายการไม่สำเร็จ (ไม่ได้แปลว่าไม่มีใครส่งมา)' : 'ยังไม่มีลูกค้าทำเรื่องเข้ามา'}
          </p>
        ) : items.map((d) => {
          const open_ = openId === d.phone
          const idx = idxOf(d.stage)
          return (
            <div key={d.phone} className={open_ ? 'bg-blue-50/30' : ''}>
              <button onClick={() => open(d.phone)} className="w-full flex items-center gap-3.5 px-4 md:px-5 py-3.5 text-left hover:bg-gray-50/70 transition-colors">
                <span className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white text-[13px] font-black flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm">
                  {(d.name || '?').charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold text-gray-900">{d.name || d.phone}</span>
                  <span className="block text-[11.5px] text-gray-400 truncate">
                    {d.phone}{d.saw ? ` · ${d.saw}` : ''}{d.province ? ` · ยื่นที่ ${d.province}` : ''}{d.images ? ` · รูป ${d.images} ใบ` : ''}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${d.stage === 'lz2' ? 'bg-orange-50 text-orange-600' : d.stage === 'done' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                  {labelOf(d.stage)}
                </span>
              </button>
              {open_ && (
                <div className="px-4 md:px-5 pb-5 space-y-3">
                  {/* เส้นเรื่อง */}
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.map((s, i) => (
                      <span key={s.key} className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${i <= idx ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-300'}`}>
                        {i + 1}. {s.label}
                      </span>
                    ))}
                  </div>
                  {/* รูปใบ ลซ.๒ */}
                  {d.images > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {loadingImg ? (
                        <div className="h-40 w-28 rounded-xl bg-gray-100 animate-pulse" />
                      ) : imgs.map((src, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={src} alt={`ใบ ลซ.๒ (${i + 1})`} className="max-h-56 rounded-xl border border-gray-200 shadow-sm" />
                      ))}
                    </div>
                  )}
                  {/* ปุ่มขั้นของร้าน */}
                  <div className="flex flex-wrap gap-2">
                    {d.stage === 'lz2' && (
                      <button onClick={() => setStage(d.phone, 'got')}
                        className="rounded-xl bg-gray-900 px-4 py-2 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] hover:bg-gray-800 active:scale-[0.98]">
                        ✓ ร้านได้ใบตัวจริงแล้ว
                      </button>
                    )}
                    {d.stage === 'got' && (
                      <button onClick={() => setStage(d.phone, 'shipped')}
                        className="rounded-xl bg-gray-900 px-4 py-2 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] hover:bg-gray-800 active:scale-[0.98]">
                        🚚 ร้านส่งเลื่อยแล้ว
                      </button>
                    )}
                    <a href={`tel:${d.phone}`} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-blue-600 hover:bg-blue-50">โทรหาลูกค้า</a>
                    {/* 🗑 จางไว้และอยู่ท้ายแถว คนละฝั่งกับปุ่มที่กดบ่อย — นิ้วพลาดง่ายบนมือถือ */}
                    <button onClick={() => ลบเรื่อง(d.phone, d.name)}
                      className="ml-auto rounded-xl border border-gray-100 bg-white px-3 py-2 text-[12.5px] font-semibold text-gray-300 hover:text-red-600 hover:border-red-200">
                      ลบเรื่องนี้
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-center text-[11px] text-gray-300">ชุดเดียวกับ gucut.com/admin/permits/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง</p>
    </div>
  )
}
