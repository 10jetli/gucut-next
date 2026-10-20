'use client'
// ใบโอนรายใบ — เปิดจากเลขที่ใบในจอรายการโอน (กวาดคลาส "ZORT กดได้เราไม่" 8 ก.ย. 2569)
// เส้น: ?transfer=<id ZORT ไม่ใช่เลขที่ใบ> → {live, number, status, date, from, to, tracking,
//   lines:[{sku,name,qty}]|null, fields} — โครงจากซอร์สท่อจริง getTransferDetail
// ⚠️ สามสถานะบรรทัดสินค้า: null = ZORT ไม่ส่งช่องบรรทัดมา · [] = ใบนี้ไม่มีของ — คนละคำ
import AttachLinkOff from '@/components/zort/AttachLinkOff'
import { DETAIL_BTN_OFF } from '@/components/zort/headBtn'
import { ชื่อคลังจากคำตอบ } from '@/lib/warehouse-names'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { TRANSFER_STATUS, zortWord } from '@/lib/zort-words'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip, SKIP } from '@/components/ui/ErrorBox'
import { docErrorView, isDocFail, type DocFail, type DocErrorView } from '@/lib/doc-error'
import { PageHead, Pill, TableWrap, TH, TD, thaiDate, RowMenu, PILL_ZORT_CLASS , ZORT_ICON_BG, ZORT_BLUE } from '@/components/zort'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'

interface Line { sku?: string; name?: string; qty?: number }
interface Resp {
  live?: boolean; number?: string; status?: string; date?: string
  from?: string; to?: string; tracking?: string
  lines?: Line[] | null; fields?: string[]; error?: string; skip?: string
}

/** รหัสคลัง → ชื่อคลัง (กติกาเดียวกับจอรายการโอน)
 *  ไม่มีค่า = "—" (ปกติของใบประเภท "ปรับ") · แปลงไม่ได้ = โชว์รหัสเดิมพร้อมวงเล็บบอกว่าเป็นรหัส */
function wh(code: string | undefined, names: Record<string, string>) {
  const c = String(code ?? '').trim()
  if (!c) return <span className="text-gray-400">—</span>
  const n = names[c]
  return <span className="text-gray-800">{n ? `${n} (${c})` : c}</span>
}

function Inner() {
  const id = useSearchParams().get('id') ?? ''
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /* 🔴 **สาเหตุที่ล้มเหลว แยกสามแบบ** (ท่อ gucut-web 01f7b9f · 15 ก.ย. 2569)
     เดิมทุกแบบขึ้นข้อความเดียวกัน ⇒ คนอ่านเดาเองว่า "ไม่มีใบนี้" ซึ่งผิดได้ทั้งสองทาง
     ⚠️ คำตอบที่ล้มเหลว **มาเป็น HTTP 200 + ok:false** ⇒ ดูแต่ res.ok ไม่พอ (ยิงเห็นเองแล้ว) */
  const [why, setWhy] = useState<DocErrorView | null>(null)
  /* 🔴 **จอรายการโอนจดกับดักนี้ไว้เองตั้งแต่ต้น แต่จอรายละเอียดไม่ได้รับบทเรียนตามมา**
     (เจอกับของจริง 14 ก.ย. 2569 · ใบ TF-202609002)
     ท่อส่ง **รหัสคลัง** มา (NEW · KLD · ANJ) ส่วน ZORT แสดง **ชื่อคลัง** ("โกดัง")
     ⇒ จอรายการแปลงแล้วขึ้นว่า "ไป โกดัง" · จอนี้ไม่แปลง ขึ้นว่า "→ NEW"
     ⇒ **ใบเดียวกัน สองจอบอกปลายทางคนละชื่อ** คนกดสลับไปมาแล้วนึกว่าคนละใบ
     ⚠️ ดึงชื่อไม่ได้ = โชว์รหัสดิบ **แต่ต้องบอกว่านี่คือรหัส** ไม่ใช่ปล่อยให้อ่านเป็นชื่อ */
  const [names, setNames] = useState<Record<string, string>>({})
  const [whErr, setWhErr] = useState(false)

  const load = useCallback(async () => {
    if (!id) { setError('ไม่ได้ระบุใบ (ต้องเปิดจากจอรายการโอน)'); setLoading(false); return }
    setLoading(true); setError(''); setWhy(null)
    try {
      const res = await fetch(`/api/web/core?transfer=${encodeURIComponent(id)}`)
      const j = (await res.json().catch(() => null)) as Resp | null
      if (j === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof j.skip === 'string') throw new Error(SKIP + j.skip)
      if (isDocFail(j, res.ok)) {
        const v = docErrorView(j as DocFail, res.status)
        setWhy(v)
        throw new Error(v.text)
      }
      setD(j)
      const w = await fetch('/api/web/core?list=warehouses').then((r) => r.json()).catch(() => null)
      const ชื่อ = ชื่อคลังจากคำตอบ(w)
      setNames(ชื่อ.names)
      setWhErr(ชื่อ.อ่านไม่ได้)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  /* 🛡️ ด่านกัน "ท่อส่งของผิดชั้น" — เก็บถาวร (เหตุผลเต็มอยู่ในจอใบเสนอราคา)
     เคยเกิดจริง 9 ก.ย. 2569: number กลายเป็นจำนวนสินค้า (37/148/11) · ท่อแก้แล้วที่ 6ab53c6 */
  const LINE_ONLY = ['sku', 'productid', 'pricepernumber', 'bundleitemid']
  const wrongLevel = (d?.fields ?? []).some((f) => LINE_ONLY.includes(String(f).toLowerCase()))

  return (
    <div className={`p-4 md:p-6 ${เหมือนZORT ? '' : 'max-w-[860px]'}`}>
      {/* 📐 โหมดเหมือน ZORT (วัดเทียบ /Warehouse/TransferDetails 19 ต.ค. 2569 · TF-202610025): ลิงก์กลับ Kanit 14 · จอกว้างเต็ม */}
      <p className={เหมือนZORT ? "font-['Kanit',sans-serif] text-[14px] mb-1" : 'text-[12.5px] mb-2'}><Link href="/core/transfers" className="text-[#337ab7] hover:underline">‹ รายการโอนสินค้า</Link></p>
      {/* หัวจอตาม ZORT: "รายละเอียดรายการโอนสินค้า" · เลขที่ใบอยู่ในช่อง "รายการ" ข้างล่าง (อ่านจอจริง 16 ต.ค. 2569) */}
      <PageHead title="รายละเอียดรายการโอนสินค้า"
        summary={เหมือนZORT
          ? <span className="inline-flex items-center gap-3">
            {/* 📏 ZORT วางลิงก์ แนบไฟล์ ใต้หัวจอ (DOM 20 ต.ค. 2569: Kanit 12 #868e96) · ของเรายังแนบไม่ได้ (เขียนกลับ ZORT) ⇒ สีเดียวกันแต่กดไม่ได้ เหตุใน title */}
            <AttachLinkOff />
            <span className="text-gray-400 cursor-help text-[14px]" title="ดึงสดจาก ZORT รายใบ — ไม่ใช่กระจก">ⓘ</span>
          </span>
          : <span className="text-gray-400">ดึงสดจาก ZORT รายใบ — ไม่ใช่กระจก</span>}
        /* 🔁 ปุ่ม "รีเฟรช" เอาออก 16 ต.ค. 2569 — ZORT /Warehouse/TransferDetails ไม่มี · แถบปุ่มแบบ ZORT อยู่ข้างล่าง */ />

      {/* 🧰 แถบปุ่มแบบ ZORT /Warehouse/TransferDetails (อ่านปุ่ม+เมนูจาก HTML 16 ต.ค. 2569 · ไม่ได้กด)
          คำสั่ง ▾ (คัดลอก · เพิ่ม Tag · แก้ไข · ยกเลิกรายการ) · พิมพ์เอกสาร — ทุกข้อต้องเขียนกลับ ZORT หรือยังไม่มีหน้าพิมพ์ ⇒ สีเทาพร้อมเหตุ */}
      {d && !wrongLevel && (
        <div className={`flex flex-wrap items-center gap-2 mb-4 ${เหมือนZORT ? 'mt-[25px]' : ''}`} /* 📐 โหมดเหมือน ZORT: แถบปุ่มที่ y=194 เท่า ZORT (วัด DOM 19 ต.ค. 2569 · margin ยุบรวมกับ mb หัวจอ ⇒ ใส่ระยะเต็ม) */>
          <RowMenu label="คำสั่ง" items={([
            ['คัดลอก', 'ยังทำไม่ได้ — สร้างใบโอนใหม่จากใบนี้ยังไม่มี'],
            ['เพิ่ม Tag', 'ยังทำไม่ได้ — ต้องเขียนกลับ ZORT'],
            ['แก้ไข', 'ยังทำไม่ได้ — แก้ใบต้องเขียนกลับ ZORT'],
            ['ยกเลิกรายการ', 'ยังทำไม่ได้ — ยกเลิกใบต้องทำใน ZORT (ย้อนไม่ได้)'],
          ] as const).map(([label, disabled]) => ({ label, disabled }))} />
          {/* 📏 โหมดเหมือน ZORT: ปุ่มขนาดเดียวกับ คำสั่ง (DOM 20 ต.ค. 2569: สูง 39 Kanit 14 ช่องใน 8/12 ขอบ 0.8 #adb5bd) แต่ตัวจาง = กดไม่ได้ */}
          <span title="ยังทำไม่ได้ — ของเรายังไม่มีหน้าพิมพ์ใบโอนสินค้า"
            className={DETAIL_BTN_OFF}>🖨 พิมพ์เอกสาร</span>
          <span title="ยังทำไม่ได้ — ประวัติการแก้ใบเก็บอยู่ที่ ZORT (/User/activitylog) กระจกไม่ได้เก็บ"
            className={DETAIL_BTN_OFF}>ดูกิจกรรมของรายการ</span>
          {!เหมือนZORT && <span title="ยังทำไม่ได้ — แนบไฟล์เข้าใบใน ZORT = เขียนกลับ"
            className="text-[12.5px] text-gray-300 cursor-not-allowed">📎 แนบไฟล์</span>}
        </div>
      )}

      {/* 🔴 กล่องนี้ต้องบอก **สามอย่างที่ต่างกัน** ไม่ใช่ประโยคเดียวคลุมทุกกรณี
             · เลขผิดรูป ⇒ ยังไม่ได้ถาม ZORT เลย  · ติดต่อ ZORT ไม่ได้ ⇒ ยังไม่รู้ว่ามีใบไหม
             · ZORT ตอบแต่ไม่ส่งใบ ⇒ อาจเลขผิดหรือไม่มีใบ — **ห้ามฟันว่า "ไม่มีใบนี้"** */}
      {error && why && (
        <ErrorBox title={why.title}>
          {why.text}
          <br /><span className="text-[12.5px] text-gray-700">⇒ {why.next}</span>
          {why.raw && why.raw !== why.text && (
            <><br /><span className="text-[11.5px] text-gray-500">ข้อความจากระบบ: {why.raw}</span></>
          )}
        </ErrorBox>
      )}
      {error && !why && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดึงใบโอนไม่ได้'}>{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && d && wrongLevel && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2.5 mb-4 text-[12.5px] text-red-800">
          <b>ท่อส่งข้อมูลผิดชั้น — ค่าในใบนี้เชื่อไม่ได้</b>
          <p className="mt-1 text-[11.5px] text-red-700">
            สิ่งที่ได้กลับมาเป็น<b>บรรทัดสินค้าบรรทัดเดียว</b> ไม่ใช่หัวใบ (เห็นจากช่อง sku · productid
            ที่ติดมากับหัวใบ) ⇒ เลขที่ใบด้านบนคือ<b>จำนวนสินค้าในบรรทัด</b> ไม่ใช่เลขที่ใบ ·
            แจ้งฝั่งท่อทันที แล้วดูใบจริงที่ ZORT ไปก่อน
          </p>
        </div>
      )}

      {/* 🔴 ตอบ 200 แต่ไม่มีแม้แต่เลขที่ใบ = **ท่อตอบไม่ครบ ไม่ใช่ใบว่าง**
          เจอด้วยท่อปลอมโหมด partialgood (9 ก.ย. 2569): ทุกช่องขึ้นขีดสวยงาม
          อ่านแล้วเหมือนใบที่ไม่มีข้อมูล ทั้งที่ความจริงคือยังไม่ได้อะไรมาเลย */}
      {!loading && !error && d && !wrongLevel && !d.number && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2.5 mb-4 text-[12.5px] text-red-800">
          <b>ท่อตอบมาไม่ครบ — ไม่มีแม้แต่เลขที่ใบ</b>
          <p className="mt-1 text-[11.5px] text-red-700">
            ช่องที่ขึ้นขีดข้างล่างคือ &ldquo;ยังไม่ได้ข้อมูล&rdquo; ไม่ใช่ &ldquo;ใบนี้ไม่มีข้อมูล&rdquo; ·
            กดรีเฟรชอีกครั้ง ถ้ายังเหมือนเดิมให้ดูใบจริงที่ ZORT
          </p>
        </div>
      )}

      {!loading && !error && d && !wrongLevel && (
        <>
          {เหมือนZORT && (
            /* 📐 โหมดเหมือน ZORT: การ์ดสถานะ "การโอนสินค้า" (ครึ่งแถว) → การ์ดข้อมูล (หัว Kanit 20 · ป้าย/ค่า Boon 16)
               ZORT มีคอลัมน์ "ผู้ติดต่อ" (ผู้สร้างรายการ) ด้วย — ท่อไม่ส่งผู้สร้าง ⇒ 20 ต.ค. 2569 ใส่คอลัมน์แล้วแต่ค่าเป็นขีดพร้อมเหตุใน title (ไม่เดาชื่อ) */
            <>
              {/* 📏 ZORT การ์ดสถานะต่ำกว่าแถวปุ่ม 30 · ของเรา 20 (ภาพ 20 ต.ค. 2569) ⇒ เติมช่องบน 8 CSS — ใช้ padding เพราะ margin ยุบรวมกับแถวปุ่ม */}
              <div className="mb-[30px] pt-2 grid gap-[30px] md:grid-cols-2">
                <div className="bg-white rounded-[6px] p-5 flex items-center justify-between">
                  <span aria-hidden className="w-12 h-12 rounded-full grid place-items-center text-[22px] font-semibold" style={{ background: ZORT_ICON_BG, color: ZORT_BLUE }}>⇄</span>
                  <div className="text-right">
                    <h2 className="font-['Boon',sans-serif] text-[14px] font-medium text-[#868e96] m-0">การโอนสินค้า</h2>
                    {/* 📏 DOM ZORT 20 ต.ค. 2569: การ์ดสูง 88 · ป้ายสถานะสูง 24 (ช่องใน 4/12 · 16px · lh 16) */}
                    <div className="mt-1">
                      <span className={`inline-block rounded-[24px] px-3 py-1 text-[16px] leading-4 ${PILL_ZORT_CLASS(d.status === 'Success' ? 'green' : 'orange')}`}>
                        {zortWord(TRANSFER_STATUS, d.status).text || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {/* 📏 DOM /Warehouse/TransferDetails 20 ต.ค. 2569: กล่อง ช่องใน 20 · คอลัมน์ข้อมูลครึ่งกล่อง ช่องใน 15+30 ⇒ ตัวหนังสือห่างขอบกล่อง 50
                   แถว ป้าย 1/3 (104) | ค่า 2/3 ช่องในข้างละ 15 · วันที่เดือนเต็มแบบ ZORT (13 ตุลาคม 2569)
                   แถวสูง 23 ห่างกัน 31 (วัดซ้ำ 20 ต.ค. 20:3x) ⇒ py-1 */}
              <section className="mb-[30px] bg-white rounded-[6px] p-5">
                {/* 📐 ZORT แบ่งกล่องสองคอลัมน์: ข้อมูล | ผู้ติดต่อ (ผู้สร้างรายการ) — ภาพ TF-202610025 20 ต.ค. 2569 */}
                <div className="md:grid md:grid-cols-2">
                <div>
                <div className="flex items-center gap-3 mb-4 pl-[30px]">
                  <span aria-hidden className="w-8 h-8 rounded-full grid place-items-center text-[14px]" style={{ background: ZORT_ICON_BG }}>📄</span>
                  <h2 className="font-['Kanit',sans-serif] text-[20px] font-medium text-[#3e3e3e] m-0">ข้อมูล</h2>
                </div>
                {([
                  ['รายการ', d.number || '—'],
                  ['วันที่', thaiDate(d.date, 'เต็ม')],
                  /* 📐 ZORT แถว ไป = ชื่อคลังปลายทางอย่างเดียว (ภาพ TF-202610025 20 ต.ค. 2569: "โกดัง") · ใบที่มีต้นทาง แยกแถว จาก ไว้ก่อน */
                  ...(d.from ? [['จาก', wh(d.from, names)] as const] : []),
                  ['ไป', <>{d.to ? (names[String(d.to).trim()] || wh(d.to, names)) : wh(d.to, names)}{whErr && (d.from || d.to) && <span className="block text-[11.5px] text-amber-700 mt-0.5">⚠️ ดึงชื่อคลังไม่ได้ — ที่เห็นคือ<b>รหัสคลัง</b> ไม่ใช่ชื่อ</span>}</>],
                  /* ZORT ไม่มีแถวเลขพัสดุ ⇒ ขึ้นเฉพาะใบที่มีเลขจริง (ใบไม่มีเลข ข้อมูลไม่หาย — ไม่มีอะไรให้แสดง) */
                  ...(d.tracking ? [['เลขพัสดุ', <span key="t" className="font-mono">{d.tracking}</span>] as const] : []),
                ] as const).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[1fr_2fr] py-1 pl-[15px] md:pr-[45px]">
                    <span className="font-['Boon',sans-serif] text-[16px] leading-[23px] text-[#868e96] px-[15px]">{k}</span>
                    <span className="font-['Boon',sans-serif] text-[16px] leading-[23px] text-[#3e3e3e] px-[15px]">{v}</span>
                  </div>
                ))}
                </div>
                <div className="mt-4 md:mt-0">
                  <div className="flex items-center gap-3 mb-4 pl-[30px]">
                    <span aria-hidden className="w-8 h-8 rounded-full grid place-items-center text-[14px]" style={{ background: ZORT_ICON_BG }}>👤</span>
                    <h2 className="font-['Kanit',sans-serif] text-[20px] font-medium text-[#3e3e3e] m-0">ผู้ติดต่อ</h2>
                  </div>
                  {/* ⚠️ ZORT API ไม่ส่งผู้สร้างรายการของใบโอน (ช่องที่ส่งมา: fields ในคำตอบ · ยิงดู 20 ต.ค. 2569) ⇒ ขีด + เหตุ ห้ามเดาชื่อ */}
                  <div className="grid grid-cols-[1fr_2fr] py-1 pl-[15px] md:pr-[45px]">
                    <span className="font-['Boon',sans-serif] text-[16px] leading-[23px] text-[#868e96] px-[15px]">ผู้สร้างรายการ</span>
                    <span className="font-['Boon',sans-serif] text-[16px] leading-[23px] text-gray-300 px-[15px] cursor-help" title="ZORT API ไม่ส่งชื่อผู้สร้างรายการของใบโอนมา — ดูได้ที่จอ ZORT">—</span>
                  </div>
                </div>
                </div>
              </section>
            </>
          )}
          {!เหมือนZORT && <div className="bg-white border border-gray-200 rounded-md p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-[12.5px]">
            <div><p className="text-gray-400 text-[11.5px]">รายการ</p><span className="font-medium">{d.number || '—'}</span></div>
            <div><p className="text-gray-400 text-[11.5px]">การโอนสินค้า</p>{/* คำตาม ZORT (เดิม "สถานะ") · เดิมโชว์ค่าดิบจากท่อ (Success/Pending) = อังกฤษบนจอ · ใบ t_mu23dljn
                  คำมาจาก lib/zort-words.ts ที่เดียว · ไม่รู้จัก = คืนค่าดิบ ไม่เดา */}
              <Pill tone={d.status === 'Success' ? 'green' : 'orange'}>
                {zortWord(TRANSFER_STATUS, d.status).text || '—'}
              </Pill></div>
            <div><p className="text-gray-400 text-[11.5px]">วันที่</p>{thaiDate(d.date)}</div>
            <div>
              <p className="text-gray-400 text-[11.5px]">ไป <span className="text-gray-300">(จากคลัง → ไปคลัง)</span></p>
              {wh(d.from, names)} → {wh(d.to, names)}
              {whErr && (d.from || d.to) && (
                <span className="block text-[10px] text-amber-700 mt-0.5">
                  ⚠️ ดึงชื่อคลังไม่ได้ — ที่เห็นคือ<b>รหัสคลัง</b> ไม่ใช่ชื่อ
                </span>
              )}
            </div>
            <div><p className="text-gray-400 text-[11.5px]">เลขพัสดุ</p>
              {d.tracking ? <span className="font-mono">{d.tracking}</span> : <span className="text-gray-300">ไม่มี</span>}</div>
          </div>}
          {/* 📐 โหมดเหมือน ZORT: หัวการ์ด "สินค้า" Kanit 20 เหนือตาราง */}
          <กล่องสินค้า>
          {เหมือนZORT && (
            <div className="flex items-center gap-3 mb-3">
              <span aria-hidden className="w-8 h-8 rounded-full grid place-items-center text-[14px]" style={{ background: ZORT_ICON_BG }}>📦</span>
              <h2 className="font-['Kanit',sans-serif] text-[20px] font-medium text-[#3e3e3e] m-0">สินค้า</h2>
            </div>
          )}

          {d.lines === null || d.lines === undefined ? (
            <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⏳ ZORT ไม่ส่งช่องบรรทัดสินค้ามากับใบนี้ — ไม่ใช่ว่าใบว่าง (ช่องที่ส่งมาจริง: {(d.fields ?? []).join(', ') || 'ไม่ทราบ'})
            </p>
          ) : d.lines.length === 0 ? (
            <p className="text-[12.5px] text-gray-400">ใบนี้ไม่มีบรรทัดสินค้า</p>
          ) : (
            <TableWrap>
              <table className="w-full min-w-[480px]">
                <thead className="bg-white border-b border-gray-200">
                  {/* 📐 ผัง ZORT `/Warehouse/TransferDetails` (อ่าน 16 ต.ค. 2569): # · รหัสสินค้า · ชื่อสินค้า · จำนวน + บรรทัด จำนวนทั้งหมด */}
                  <tr><th className={TH}>#</th><th className={TH}>รหัสสินค้า</th><th className={TH}>ชื่อสินค้า</th><th className={`${TH} text-right`}>จำนวน</th></tr>
                </thead>
                <tbody>
                  {d.lines.map((l, i) => (
                    <tr key={`${l.sku}-${i}`} className="border-b border-[#e8ecf8] last:border-0">
                      <td className={`${TD} text-gray-400`}>{i + 1}</td>
                      <td className={`${TD} font-mono text-[12.5px]`}>{l.sku || '—'}</td>
                      <td className={TD}>{l.name || '—'}</td>
                      <td className={`${TD} text-right tabular-nums`}>{typeof l.qty === 'number' ? l.qty.toLocaleString('th-TH') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* จำนวนทั้งหมด = ผลรวมบรรทัดที่เป็นตัวเลข · มีบรรทัดที่ไม่รู้จำนวน ⇒ บอกว่าไม่ครบ ห้ามบวกเป็น 0 เงียบ ๆ */}
              {(() => {
                const ไม่รู้ = d.lines.filter((l) => typeof l.qty !== 'number').length
                const รวม = d.lines.reduce((a, l) => a + (typeof l.qty === 'number' ? l.qty : 0), 0)
                return (
                  <div className="flex justify-end gap-3 px-3 py-2.5 border-t border-gray-200 text-[12.5px]">
                    <span className="text-gray-500">จำนวนทั้งหมด</span>
                    <b className="tabular-nums">{รวม.toLocaleString('th-TH')}</b>
                    {ไม่รู้ > 0 && <span className="text-amber-800">(ไม่รวม {ไม่รู้} บรรทัดที่ไม่รู้จำนวน)</span>}
                  </div>
                )
              })()}
            </TableWrap>
          )}
          </กล่องสินค้า>
        </>
      )}
    </div>
  )
}

/** 📐 โหมดเหมือน ZORT: ส่วน "สินค้า" อยู่ในกล่องขาวแบบกล่องข้อมูล (ภาพ /Warehouse/TransferDetails 20 ต.ค. 2569) · โหมดเดิมไม่ห่อ */
function กล่องสินค้า({ children }: { children: React.ReactNode }) {
  return เหมือนZORT ? <section className="bg-white rounded-[6px] p-5 mb-[30px]">{children}</section> : <>{children}</>
}

export default function TransferDetailPage() {
  // useSearchParams ต้องอยู่ใน Suspense (แพตเทิร์นเดียวกับ sales/detail)
  return <Suspense fallback={<div className="p-6"><LoadingState /></div>}><Inner /></Suspense>
}
