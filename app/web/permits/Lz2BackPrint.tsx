'use client'
/* 🖨️ พิมพ์หลังใบ ลซ.๒ — "บันทึกการได้มาซึ่งเลื่อยโซ่ยนต์" (ตอนร้านโอนเครื่องให้ลูกค้า)
 *
 * ท่านประธานสั่ง 5 ต.ค. 2569: "กรอกเหมือนเดิม อันที่ต้องเปลี่ยนคือ หมายเลขบนเลื่อยโซ่ยนต์
 * ที่ต้องไปดึงเอากับไดร์ และใบอนุญาตที่ · รุ่นกับแผ่นบังคับโซ่ผมจะเลือกเอง"
 * ⇒ ข้อมูลร้านคงที่ (คัดจากใบจริงตัวอย่าง ธนวัฒน์ 20 ก.ค. 2569 · บ้านเลขที่ 81 ท่านแก้เอง)
 * ⇒ หมายเลขเครื่อง/บาร์ ดึงจากทะเบียน (`?registryrows=1`) เฉพาะตัวที่ยังไม่ขาย
 * ⇒ รุ่นเลื่อยกับบาร์เป็น dropdown ให้ท่านเลือก · ใบอนุญาตที่เป็นช่องแก้ได้
 *
 * 🔑 **PDF มีแต่ตัวหนังสือ พื้นใส ไม่มีเส้นฟอร์ม** — เอาใบจริงใส่เครื่องพิมพ์แล้วพิมพ์ทับ
 *    ⚠️ ต้องพิมพ์ 100% ไม่ย่อ ไม่ fit-to-page ไม่งั้นเลื่อนทั้งใบ (เขียนเตือนบนจอแล้ว)
 * 🔑 พิกัดเป็นสัดส่วนของหน้า (0-1 จากซ้าย/บน) — ชุดเดียวกับใบทดสอบที่ท่านสั่งพิมพ์ทาบ
 *    จะแก้พิกัดต้องพิมพ์ทาบใบจริงดูเท่านั้น ห้ามเดา
 * ⚠️ ฟอนต์ไทย (Sarabun) ไม่มีอักขระ ✓ — ใส่ไปก็หายเงียบ ไม่มี error
 *    (เจอจริง 5 ต.ค. 2569 ติ๊กหายทั้ง 11 ช่อง) ⇒ วาดเครื่องหมายถูกด้วยเส้นเอง
 */
import { useCallback, useEffect, useMemo, useState } from 'react'

interface SerialRow {
  lot: number; kind: string; serial: string; seq: number
  model?: string; spec?: string; license?: string
  sold_at?: string; buyer?: string
}

/* ข้อมูลคงที่ — ท่านประธานยืนยันเอง 5 ต.ค. 2569: "อันที่กรอกเหมือนเดิมทุกครั้งคือ
 * นางศีตกาล บุญประกอบ · หจก.นิวเวฟ ซันไชน์ · 66 หมู่ที่ 11 ตำบลค่ายบกหวาน
 * เมืองหนองคาย หนองคาย 43100 · 0804611616 · เครื่องยนต์น้ำมัน · ลงชื่อ (นางศีตกาล บุญประกอบ)"
 * ⚠️ บ้านเลขที่ **66** = ที่อยู่ หจก.นิวเวฟ ซันไชน์ (ผู้ถือใบอนุญาต) — คนละตัวกับ 81
 *    ของร้านศีตกาล เทรดดิ้ง (สองนิติบุคคล ห้ามสลับ) */
const ร้าน = {
  ผู้ลงนาม: 'นางศีตกาล  บุญประกอบ',
  นิติบุคคล: 'หจก. นิวเวฟ ซันไชน์',
  บ้านเลขที่: '66',
  หมู่ที่: '11', ซอย: '-', ถนน: '-',
  ตำบล: 'ค่ายบกหวาน', อำเภอ: 'เมืองหนองคาย', จังหวัด: 'หนองคาย',
  ไปรษณีย์: '43100', โทรศัพท์: '0804611616', โทรสาร: '-',
  ออกที่จังหวัด: 'มุกดาหาร',
}

const เดือนไทย = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

export default function Lz2BackPrint() {
  const [เปิด, setเปิด] = useState(false)
  const [rows, setRows] = useState<SerialRow[] | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // ── ตัวเลือกของท่าน ──
  const [รุ่น, setรุ่น] = useState('')
  const [เลขเลื่อย, setเลขเลื่อย] = useState('')
  const [เลขบาร์, setเลขบาร์] = useState('')
  // ── ช่องแก้ได้ (เติมให้อัตโนมัติ แต่ท่านทับได้) ──
  const [ใบอนุญาต, setใบอนุญาต] = useState('มห 00001/2567')
  const [ลงวันที่, setลงวันที่] = useState('23/12/2567')
  const [เลขเครื่องยี่ห้อ, setเลขเครื่องยี่ห้อ] = useState('')
  const [แรงม้า, setแรงม้า] = useState('')
  const [บาร์ยาว, setบาร์ยาว] = useState('')
  const [ยี่ห้อบาร์, setยี่ห้อบาร์] = useState('KINGKONG')

  const โหลด = useCallback(async () => {
    setBusy(true); setErr('')
    try {
      const [s, b] = await Promise.all([
        fetch('/api/web/core?registryrows=1&kind=saw&limit=500').then((r) => r.json()),
        fetch('/api/web/core?registryrows=1&kind=bar&limit=500').then((r) => r.json()),
      ])
      const ทั้งหมด = [...(Array.isArray(s.rows) ? s.rows : []), ...(Array.isArray(b.rows) ? b.rows : [])]
      if (!ทั้งหมด.length) setErr('ทะเบียนว่าง — ดึงจากหน้า "ทะเบียนเลื่อยโซ่ยนต์" ก่อน')
      setRows(ทั้งหมด)
    } catch { setErr('อ่านทะเบียนไม่สำเร็จ') } finally { setBusy(false) }
  }, [])
  useEffect(() => { if (เปิด && !rows) void โหลด() }, [เปิด, rows, โหลด])

  // เฉพาะตัวที่ยังไม่ขาย — ตัวที่ขายแล้วโอนไปแล้ว พิมพ์ซ้ำ = ทะเบียนเพี้ยน
  const เลื่อยว่าง = useMemo(() => (rows || []).filter((r) => r.kind === 'saw' && !r.sold_at), [rows])
  const บาร์ว่าง = useMemo(() => (rows || []).filter((r) => r.kind === 'bar' && !r.sold_at), [rows])
  const รุ่นทั้งหมด = useMemo(() => Array.from(new Set(เลื่อยว่าง.map((r) => r.model || '?'))), [เลื่อยว่าง])
  const เลขของรุ่น = useMemo(() => เลื่อยว่าง.filter((r) => (r.model || '?') === รุ่น), [เลื่อยว่าง, รุ่น])

  // เลือกเลขเครื่องแล้ว เติมช่องที่เหลือให้ (ท่านทับได้เสมอ)
  const เลือกเลื่อย = useCallback((serial: string) => {
    setเลขเลื่อย(serial)
    const r = เลขของรุ่น.find((x) => x.serial === serial)
    if (!r) return
    if (r.license && r.license !== '?') setใบอนุญาต(r.license)
    setแรงม้า(r.spec || '')
    setเลขเครื่องยี่ห้อ((r.model || '').replace('/', ' รุ่น '))
  }, [เลขของรุ่น])

  const เลือกบาร์ = useCallback((serial: string) => {
    setเลขบาร์(serial)
    const r = บาร์ว่าง.find((x) => x.serial === serial)
    if (!r) return
    // แถวบาร์ในทะเบียน: model = ขนาดนิ้ว ("30") · spec = ยี่ห้อ/รุ่น ("NEWWAVE/9800 SUPER RPO")
    setบาร์ยาว(r.model || '')
    const ยี่ห้อ = (r.spec || '').split('/')[0].trim()
    if (ยี่ห้อ) setยี่ห้อบาร์(ยี่ห้อ)
  }, [บาร์ว่าง])

  const สร้างPDF = useCallback(async () => {
    setBusy(true); setErr('')
    try {
      const [{ PDFDocument, rgb }, fontkit] = await Promise.all([
        import('pdf-lib'), import('@pdf-lib/fontkit').then((m) => m.default),
      ])
      const fontBytes = await fetch('/doc/Sarabun-Regular.ttf').then((r) => {
        if (!r.ok) throw new Error('โหลดฟอนต์ไม่ได้')
        return r.arrayBuffer()
      })
      const doc = await PDFDocument.create()
      doc.registerFontkit(fontkit)
      const font = await doc.embedFont(fontBytes, { subset: true })
      const W = 595.28, H = 841.89 // A4
      const page = doc.addPage([W, H])
      const น้ำเงิน = rgb(0, 0, 0.55)

      const วันนี้ = new Date(Date.now() + 7 * 3600 * 1000) // เวลาไทย
      const วัน = String(วันนี้.getUTCDate())
      const เดือน = เดือนไทย[วันนี้.getUTCMonth()]
      const ปี = String(วันนี้.getUTCFullYear() + 543)

      /* พิกัดสัดส่วน (x, y จากซ้าย/บน) — ชุดเดียวกับใบทดสอบที่พิมพ์ทาบใบจริง ห้ามเดาแก้ */
      const ช่อง: [number, number, string, number][] = [
        [0.115, 0.082, ร้าน.ผู้ลงนาม, 10],
        [0.555, 0.082, ร้าน.นิติบุคคล, 10],
        [0.245, 0.122, ร้าน.บ้านเลขที่, 10],
        [0.350, 0.122, ร้าน.หมู่ที่, 10],
        [0.545, 0.122, ร้าน.ซอย, 10],
        [0.150, 0.146, ร้าน.ถนน, 10],
        [0.430, 0.146, ร้าน.ตำบล, 10],
        [0.185, 0.170, ร้าน.อำเภอ, 10],
        [0.480, 0.170, ร้าน.จังหวัด, 10],
        [0.185, 0.194, ร้าน.ไปรษณีย์, 10],
        [0.390, 0.194, ร้าน.โทรศัพท์, 10],
        [0.640, 0.194, ร้าน.โทรสาร, 10],
        [0.092, 0.305, '✓', 11],
        [0.590, 0.305, ใบอนุญาต, 10],
        [0.790, 0.305, ลงวันที่, 10],
        [0.300, 0.329, ร้าน.ออกที่จังหวัด, 10],
        [0.590, 0.329, ใบอนุญาต, 10],
        [0.790, 0.329, ลงวันที่, 10],
        [0.238, 0.404, '✓', 11],
        [0.092, 0.487, '✓', 11],
        [0.375, 0.487, 'เครื่องยนต์น้ำมัน', 10],
        [0.092, 0.510, '✓', 11],
        [0.330, 0.510, แรงม้า, 10],
        [0.092, 0.533, '✓', 11],
        [0.150, 0.556, เลขเครื่องยี่ห้อ, 10],
        [0.092, 0.578, '✓', 11],
        [0.330, 0.578, เลขเลื่อย, 10],
        [0.553, 0.487, '✓', 11],
        [0.775, 0.487, บาร์ยาว, 10],
        [0.553, 0.510, '✓', 11],
        [0.700, 0.556, ยี่ห้อบาร์, 10],
        [0.553, 0.578, '✓', 11],
        [0.790, 0.578, เลขบาร์, 10],
        [0.360, 0.638, `(  ${ร้าน.ผู้ลงนาม}  )`, 10],
        [0.400, 0.660, วัน, 10],
        [0.490, 0.660, เดือน, 10],
        [0.615, 0.660, ปี, 10],
      ]
      for (const [x, y, ค่า, ขนาด] of ช่อง) {
        if (!ค่า) continue
        const px = W * x, py = H * (1 - y)
        if (ค่า === '✓') {
          // ฟอนต์ไทยไม่มี ✓ — วาดเส้นเอง (เจอจริง: ใส่ตัวอักษรแล้วหายเงียบทั้ง 11 ช่อง)
          page.drawLine({ start: { x: px, y: py + ขนาด * 0.35 }, end: { x: px + ขนาด * 0.33, y: py }, thickness: 1.3, color: น้ำเงิน })
          page.drawLine({ start: { x: px + ขนาด * 0.33, y: py }, end: { x: px + ขนาด, y: py + ขนาด * 0.95 }, thickness: 1.3, color: น้ำเงิน })
          continue
        }
        page.drawText(String(ค่า), { x: px, y: py, size: ขนาด, font, color: น้ำเงิน })
      }
      const bytes = await doc.save()
      const ab = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(ab).set(bytes)
      const url = URL.createObjectURL(new Blob([ab], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `ลซ2-หลัง-${เลขเลื่อย || 'ไม่ระบุ'}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'สร้าง PDF ไม่สำเร็จ')
    } finally { setBusy(false) }
  }, [ใบอนุญาต, ลงวันที่, เลขเครื่องยี่ห้อ, แรงม้า, เลขเลื่อย, บาร์ยาว, ยี่ห้อบาร์, เลขบาร์])

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <button onClick={() => setเปิด(!เปิด)} className="flex w-full items-center justify-between text-left">
        <span className="text-[14px] font-bold text-gray-800">🖨️ พิมพ์หลังใบ ลซ.๒ (ตอนโอนเครื่องให้ลูกค้า)</span>
        <span className="text-gray-400">{เปิด ? '▾' : '▸'}</span>
      </button>
      {เปิด && (
        <div className="mt-3 space-y-3">
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11.5px] font-semibold text-amber-700">
            ⚠️ เอาใบ ลซ.๒ ตัวจริงใส่เครื่องพิมพ์ แล้วพิมพ์ <b>100% ห้ามย่อ ห้าม fit-to-page</b> —
            ใบจริงมีใบเดียว พิมพ์ลงกระดาษเปล่าทาบดูก่อนทุกครั้ง
          </p>
          {busy && !rows && <p className="text-[12.5px] text-gray-400">กำลังอ่านทะเบียน…</p>}
          {err && <p className="text-[12.5px] font-semibold text-red-600">{err}</p>}
          {rows && (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-0.5 block text-[10.5px] font-semibold text-gray-500">รุ่นเลื่อย (เลือกเอง)</span>
                  <select value={รุ่น} onChange={(e) => { setรุ่น(e.target.value); setเลขเลื่อย('') }}
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px]">
                    <option value="">— เลือกรุ่น —</option>
                    {รุ่นทั้งหมด.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-[10.5px] font-semibold text-gray-500">
                    หมายเลขบนเลื่อย (จากทะเบียน · เฉพาะที่ยังไม่ขาย {เลขของรุ่น.length} ตัว)
                  </span>
                  <select value={เลขเลื่อย} onChange={(e) => เลือกเลื่อย(e.target.value)} disabled={!รุ่น}
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-mono text-[13px] disabled:bg-gray-50">
                    <option value="">— เลือกหมายเลข —</option>
                    {เลขของรุ่น.map((r) => <option key={r.serial} value={r.serial}>{r.serial}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-[10.5px] font-semibold text-gray-500">
                    แผ่นบังคับโซ่ (เลือกเอง · ยังไม่ขาย {บาร์ว่าง.length} แผ่น)
                  </span>
                  <select value={เลขบาร์} onChange={(e) => เลือกบาร์(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-mono text-[13px]">
                    <option value="">— เลือกบาร์ —</option>
                    {บาร์ว่าง.map((r) => <option key={r.serial} value={r.serial}>{r.serial} · {r.spec} {r.model}"</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-[10.5px] font-semibold text-gray-500">ใบอนุญาตที่</span>
                  <input value={ใบอนุญาต} onChange={(e) => setใบอนุญาต(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px]" />
                </label>
              </div>
              <details className="rounded-xl border border-gray-100 bg-gray-50/50 p-2.5">
                <summary className="cursor-pointer text-[11.5px] font-semibold text-gray-500">ช่องอื่น (เติมให้แล้ว · แก้ได้)</summary>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {([
                    ['ลงวันที่ (ของใบอนุญาต)', ลงวันที่, setลงวันที่],
                    ['ยี่ห้อ/รุ่นเครื่อง', เลขเครื่องยี่ห้อ, setเลขเครื่องยี่ห้อ],
                    ['แรงม้า', แรงม้า, setแรงม้า],
                    ['บาร์ยาว (นิ้ว)', บาร์ยาว, setบาร์ยาว],
                    ['ยี่ห้อบาร์', ยี่ห้อบาร์, setยี่ห้อบาร์],
                  ] as [string, string, (v: string) => void][]).map(([label, v, set]) => (
                    <label key={label} className="block">
                      <span className="mb-0.5 block text-[10.5px] font-semibold text-gray-500">{label}</span>
                      <input value={v} onChange={(e) => set(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px]" />
                    </label>
                  ))}
                </div>
              </details>
              <button onClick={() => void สร้างPDF()} disabled={busy || !เลขเลื่อย}
                className="rounded-xl bg-gray-900 px-4 py-2 text-[13px] font-bold text-white disabled:opacity-40">
                {busy ? 'กำลังสร้าง…' : 'สร้าง PDF พิมพ์ทับใบจริง'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
