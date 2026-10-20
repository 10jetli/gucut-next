'use client'
// ใบคืนสินค้ารายใบ — เปิดจากเลขที่ใบในจอ "รับคืนสินค้า" (ปิดคู่สุดท้ายของงาน "ZORT กดได้เราไม่")
// เส้น: ?returnorder=<id ZORT ไม่ใช่เลขที่ใบ> — โครงจากซอร์สท่อจริง getReturnOrderDetail (2d6bfea)
//
// ⚠️ **ท่อจงใจไม่ตั้งชื่อช่องเงินให้เส้นนี้** (ต่างจากใบเสนอราคาที่ตั้งแล้ว)
//    เพราะยังไม่เคยเห็นของจริงว่าช่องไหนคือยอดใบ ⇒ จอก็ต้องไม่เดาเหมือนกัน
//    เดาผิด = ยอดคืนผิดทั้งร้าน · เห็นของจริงเมื่อไหร่ค่อยตั้งชื่อพร้อมกันสองฝั่ง
// ⚠️ ห้าม log/ส่งต่อเนื้อหาใบ — มีชื่อลูกค้าจริง
import AttachLinkOff from '@/components/zort/AttachLinkOff'
import { DETAIL_BTN_OFF } from '@/components/zort/headBtn'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import { RETURN_ORDER_STATUS, zortWord } from '@/lib/zort-words'
import ErrorBox, { isSkip, SKIP } from '@/components/ui/ErrorBox'
import { docErrorView, isDocFail, type DocFail, type DocErrorView } from '@/lib/doc-error'
import { PageHead, Pill, TableWrap, TH, THR, TD, TDR, thaiDate, toneOfStatus, PILL_ZORT_CLASS , ZORT_ICON_BG, ZORT_BLUE, RowMenu, DETAIL_BTN } from '@/components/zort'
import ZortLookFold from '@/components/zort/ZortLookFold'
import { เหมือนZORT } from '@/lib/โหมดเหมือนzort'

interface Line {
  sku?: string; name?: string; qty?: number; unit?: string
  'ทุกช่องในบรรทัด'?: Record<string, unknown>
}
interface Resp {
  live?: boolean; number?: string; status?: string; date?: string
  customer?: string; reference?: string
  'เงินที่ ZORT เก็บไว้'?: Record<string, unknown>
  lines?: Line[] | null
  fields?: string[]; error?: string; skip?: string
}

/** เครื่องหมายช่องที่เส้นรายใบไม่ส่ง — คนละอย่างกับ null (ส่งมาแต่ว่าง) */
const ไม่ส่ง = Symbol('ไม่ส่ง')
/* 📏 ยิงตรวจ 19 ต.ค. 2569 (GET อ่านอย่างเดียว): ZORT **ส่งช่องเหล่านี้มาจริง** — อยู่ในรายชื่อ `fields` ของคำตอบ
   (paymentstatus · saleschannel · createusername · customerphone · customeraddress) แต่ท่อส่ง **ค่า** มาให้จอแค่ 6 ช่อง
   ⇒ เหตุคือ "ท่อยังไม่ส่งต่อค่า" ไม่ใช่ "ZORT ไม่มี" · ขอฝั่งท่อแล้ว (ใบถึง CTO 19 ต.ค. 2569) */
const ไม่ส่งช่องนี้ = 'ZORT มีค่านี้ในใบ แต่ท่อของเรายังไม่ส่งต่อมาให้จอ — ยังไม่รู้ ไม่ใช่ว่าง'

const fmtVal = (v: unknown) =>
  typeof v === 'number' ? v.toLocaleString('th-TH') : String(v ?? '—')

function Inner() {
  const id = useSearchParams().get('id') ?? ''
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /* 🔴 **สาเหตุที่ล้มเหลว แยกสามแบบ** (ท่อ gucut-web 01f7b9f · 15 ก.ย. 2569)
     เดิมทุกแบบขึ้นข้อความเดียวกัน ⇒ คนอ่านเดาเองว่า "ไม่มีใบนี้" ซึ่งผิดได้ทั้งสองทาง
     ⚠️ คำตอบที่ล้มเหลว **มาเป็น HTTP 200 + ok:false** ⇒ ดูแต่ res.ok ไม่พอ (ยิงเห็นเองแล้ว) */
  const [why, setWhy] = useState<DocErrorView | null>(null)

  const load = useCallback(async () => {
    if (!id) { setError('ไม่ได้ระบุใบ (ต้องเปิดจากจอรับคืนสินค้า)'); setLoading(false); return }
    setLoading(true); setError(''); setWhy(null)
    try {
      const res = await fetch(`/api/web/core?returnorder=${encodeURIComponent(id)}`)
      const j = (await res.json().catch(() => null)) as Resp | null
      if (j === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof j.skip === 'string') throw new Error(SKIP + j.skip)
      if (isDocFail(j, res.ok)) {
        const v = docErrorView(j as DocFail, res.status)
        setWhy(v)
        throw new Error(v.text)
      }
      setD(j)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  /* ด่านเดียวกับใบเสนอราคา/ใบโอน — ท่อเคยหยิบบรรทัดสินค้ามาเป็นหัวใบมาแล้ว (แก้ที่ 6ab53c6)
     ตัวนี้ใช้ pickDocHeader ตัวเดียวกันจึงไม่ควรเกิดอีก แต่ด่านราคาถูกและจับได้ทันทีถ้ากลับมา */
  const LINE_ONLY = ['sku', 'productid', 'pricepernumber', 'bundleitemid']
  const wrongLevel = (d?.fields ?? []).some((f) => LINE_ONLY.includes(String(f).toLowerCase()))
  const money = d?.['เงินที่ ZORT เก็บไว้']

  return (
    <div className={`p-4 md:p-6 ${เหมือนZORT ? '' : 'max-w-[860px]'}`}>
      {/* 📐 โหมดเหมือน ZORT (วัดเทียบ /Buy/Details ใบรับคืน 19 ต.ค. 2569 · CN-261017TR3HPQHV): ลิงก์กลับ Kanit 14 · จอกว้างเต็ม · ข้อความหัวจอคงเดิม (กติกาข้อ 6) */}
      <p className={เหมือนZORT ? "font-['Kanit',sans-serif] text-[14px] mb-1" : 'text-[12.5px] mb-2'}><Link href="/core/return-orders" className="text-[#337ab7] hover:underline">{เหมือนZORT ? '‹ รายการรับคืนสินค้าเข้า' : '‹ รับคืนสินค้า'}</Link></p>
      {/* 📐 โหมดเหมือน ZORT: หัวจอ/ลิงก์กลับใช้คำของ ZORT /Buy/Details?sttype=1 (ภาพ 20 ต.ค. 2569) · เลขที่ใบอยู่ในช่อง รายการ ข้างล่าง */}
      <PageHead title={เหมือนZORT ? 'รายละเอียดรายการรับคืนสินค้าเข้า' : `ใบคืนสินค้า ${wrongLevel ? '' : d?.number || ''}`}
        summary={เหมือนZORT
          ? <><AttachLinkOff /><span className="text-gray-400 cursor-help text-[14px]" title="ดึงสดจาก ZORT รายใบ · ไม่ใช่กระจก">ⓘ</span></>
          : <span className="text-gray-400">ดึงสดจาก ZORT รายใบ · ไม่ใช่กระจก</span>}
        /* 🔁 ปุ่ม "รีเฟรช" เอาออก 16 ต.ค. 2569 — ZORT จอรายละเอียดเอกสารไม่มี */ />

      {/* 🧰 แถบปุ่มแบบ ZORT /Buy/Details ของใบรับคืน (อ่านชื่อปุ่มจาก DOM 19 ต.ค. 2569 · ไม่ได้กด): คำสั่ง ▾ · พิมพ์เอกสาร ▾ · Accounting
          รายการในเมนูของ ZORT โหลดตอนเปิดเมนู — ไม่ได้กดดู ⇒ ใส่เฉพาะที่รู้แน่ · ทุกปุ่มสีเทาพร้อมเหตุ (คนจาก ZORT จะมองหา ไม่ซ่อน)
          📐 y=194 เท่า ZORT (margin ยุบรวมกับ mb หัวจอ ⇒ ใส่ระยะเต็ม) */}
      {d && !wrongLevel && (
        <div className={`flex flex-wrap items-center gap-2 mb-4 ${เหมือนZORT ? 'mt-[25px]' : ''}`}>
          <RowMenu label="คำสั่ง" items={[
            { label: 'คำสั่งของใบรับคืน', disabled: 'ยังทำไม่ได้ — ทุกคำสั่งของใบรับคืนต้องเขียนกลับ ZORT (รายการในเมนูของ ZORT ยังไม่ได้อ่าน เพราะต้องกดเปิด)' },
          ]} />
          <RowMenu label="🖨 พิมพ์เอกสาร" items={[
            { label: 'พิมพ์เอกสาร', disabled: 'ยังทำไม่ได้ — ของเรายังไม่มีหน้าพิมพ์ใบรับคืน' },
          ]} />
          <span title="ยังทำไม่ได้ — ส่งเอกสารเข้า PEAK รายใบ ของเรายังไม่มีทาง (รอตัดสินคู่กับแผนเลิกใช้ ZORT)"
            className={DETAIL_BTN_OFF}>Accounting</span>
          {/* ZORT มีปุ่มนี้ต่อท้ายแถบ (อ่าน DOM 19 ต.ค. 2569) — เหตุเดียวกับจอใบโอน/ใบเสนอราคา */}
          {เหมือนZORT && <span title="ยังทำไม่ได้ — ประวัติการแก้ใบเก็บอยู่ที่ ZORT (/User/activitylog) กระจกไม่ได้เก็บ"
            className={`${DETAIL_BTN} !text-gray-400 cursor-not-allowed`}>ดูกิจกรรมของรายการ</span>}
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
      {error && !why && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดึงใบคืนไม่ได้'}>{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && d && wrongLevel && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2.5 mb-4 text-[12.5px] text-red-800">
          <b>ท่อส่งข้อมูลผิดชั้น — ค่าในใบนี้เชื่อไม่ได้</b>
          <p className="mt-1 text-[11.5px] text-red-700">
            สิ่งที่ได้กลับมาเป็นบรรทัดสินค้า ไม่ใช่หัวใบ (เห็นจากช่อง sku · productid ที่ติดมากับหัวใบ)
            ⇒ เลขที่ใบและตัวเลขด้านล่างไม่ใช่ของใบนี้ · ให้ดูใบจริงที่ ZORT
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
            /* 📐 โหมดเหมือน ZORT: การ์ดสถานะ (ZORT มีสองใบ: ชำระเงิน · โอนสินค้า — เส้นรายใบของเราส่งแค่สถานะใบ ⇒ ใบเดียว ไม่เดาอีกใบ)
               → การ์ดข้อมูล/ลูกค้า (หัว Kanit 20 · ป้าย/ค่า Boon 16) */
            <>
              <div className="mb-[30px] grid gap-[30px] md:grid-cols-2">
                {/* 🔴 การ์ดชำระเงิน: ZORT มี (ใบแรก) — ท่อยังไม่ส่งต่อค่า paymentstatus ⇒ วาดไว้ตำแหน่งเดิมแต่ขึ้น "ยังไม่รู้" สีเทา
                       (CEO 19 ต.ค. 2569: ช่องที่ท่อยังไม่รองรับ ใส่แล้วปิดไว้พร้อมเหตุบนจอ — ไม่เดาค่า และไม่ซ่อนทั้งใบ) */}
                <div className="bg-white rounded-[6px] p-5 flex items-center justify-between">
                  <span aria-hidden className="w-12 h-12 rounded-full grid place-items-center text-[22px] font-semibold" style={{ background: ZORT_ICON_BG, color: ZORT_BLUE }}>฿</span>
                  <div className="text-right">
                    <h2 className="font-['Boon',sans-serif] text-[14px] font-medium text-[#868e96] m-0">สถานะการชำระเงิน</h2>
                    <div className="mt-2">
                      <span title={ไม่ส่งช่องนี้} className="inline-block rounded-[24px] px-3 py-1 text-[16px] leading-6 text-gray-400 bg-gray-100 cursor-help">ยังไม่รู้</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-[6px] p-5 flex items-center justify-between">
                  <span aria-hidden className="w-12 h-12 rounded-full grid place-items-center text-[22px] font-semibold" style={{ background: ZORT_ICON_BG, color: ZORT_BLUE }}>▤</span>
                  <div className="text-right">
                    <h2 className="font-['Boon',sans-serif] text-[14px] font-medium text-[#868e96] m-0">สถานะการโอนสินค้า</h2>
                    <div className="mt-2">
                      {d.status
                        ? <span title={`ค่าที่ท่อส่งมา: ${d.status}`} className={`inline-block rounded-[24px] px-3 py-1 text-[16px] leading-6 ${PILL_ZORT_CLASS(toneOfStatus(zortWord(RETURN_ORDER_STATUS, d.status).text))}`}>{zortWord(RETURN_ORDER_STATUS, d.status).text}</span>
                        : <span className="text-gray-300">—</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mb-[30px] bg-white rounded-[6px] grid md:grid-cols-2 gap-0 py-2">
                {([
                  /* แถวเรียงตาม ZORT · `ไม่ส่ง` = เส้นรายใบของเรายังไม่ส่งช่องนี้ (ขีด + เหตุ ไม่ใช่ค่าว่างจริง)
                     ประเภทรายการเป็นค่าคงที่ของจอนี้ (ทุกใบในจอนี้คือใบรับคืน) ไม่ได้มาจากท่อ */
                  ['ข้อมูล', '📄', [['รายการ', d.number || null], ['ประเภทรายการ', 'รับคืนสินค้า'], ['วันที่', d.date ? thaiDate(d.date, 'เต็ม') : null], ['อ้างอิง', d.reference || null], ['ช่องทางการขาย', ไม่ส่ง]]],
                  ['ลูกค้า', '👤', [['ผู้สร้างรายการ', ไม่ส่ง], ['ชื่อลูกค้า', d.customer || null], ['เบอร์โทรศัพท์ลูกค้า', ไม่ส่ง], ['ที่อยู่ลูกค้า', ไม่ส่ง]]],
                ] as const).map(([หัว, รูป, แถว]) => (
                  /* 📏 ระยะตาม DOM การ์ดข้อมูลของ ZORT (วัดที่ใบโอน 20 ต.ค. 2569 ผังเดียวกัน): ตัวหนังสือห่างขอบ 50 · ป้าย 1/3 ค่า 2/3 */
                  <section key={หัว} className="px-5 py-3">
                    <div className="flex items-center gap-3 mb-4 pl-[30px]">
                      <span aria-hidden className="w-8 h-8 rounded-full grid place-items-center text-[14px]" style={{ background: ZORT_ICON_BG }}>{รูป}</span>
                      <h2 className="font-['Kanit',sans-serif] text-[20px] font-medium text-[#3e3e3e] m-0">{หัว}</h2>
                    </div>
                    {แถว.map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[1fr_2fr] py-1.5 pl-[15px] pr-[15px]">
                        <span className="font-['Boon',sans-serif] text-[16px] leading-[23px] text-[#868e96] px-[15px]">{k}</span>
                        <span className="font-['Boon',sans-serif] text-[16px] leading-[23px] text-[#3e3e3e] px-[15px] break-words">{v === ไม่ส่ง ? <span className="text-gray-300 cursor-help" title={ไม่ส่งช่องนี้}>—</span> : v ?? <span className="text-gray-300">—</span>}</span>
                      </div>
                    ))}
                  </section>
                ))}
                <p className="md:col-span-2 px-5 pb-2 text-[11.5px] text-gray-400">— ที่ ช่องทางการขาย · ผู้สร้างรายการ · เบอร์ · ที่อยู่ = {ไม่ส่งช่องนี้}</p>
              </div>
            </>
          )}
          {!เหมือนZORT && <div className="bg-white border border-gray-200 rounded-md p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-[12.5px]">
            <div><p className="text-gray-400 text-[11.5px]">สถานะ</p>
              {d.status ? <Pill tone={toneOfStatus(d.status)}>{zortWord(RETURN_ORDER_STATUS, d.status).text}</Pill> : <span className="text-gray-300">—</span>}</div>
            <div><p className="text-gray-400 text-[11.5px]">วันที่คืน</p>
              {d.date ? thaiDate(d.date) : <span className="text-gray-300">—</span>}</div>
            <div><p className="text-gray-400 text-[11.5px]">ลูกค้า</p>{d.customer || <span className="text-gray-300">—</span>}</div>
            <div><p className="text-gray-400 text-[11.5px]">อ้างอิง (ใบขายเดิม)</p>
              {d.reference ? <span className="font-mono text-[12.5px]">{d.reference}</span> : <span className="text-gray-300">—</span>}</div>
          </div>}

          {/* ⚠️ ยอดใบ: ท่อยังไม่ตั้งชื่อช่องให้ ⇒ แสดงทุกช่องที่มีค่าและเขียนบอกตรง ๆ ว่าจอไม่เดา */}
          {/* 📐 โหมดเหมือน ZORT: ZORT ไม่มีกล่องช่องเงินดิบ ⇒ พับ บรรทัดสรุปยังบอกว่าจอไม่เดาว่าช่องไหนคือยอดคืน */}
          <ZortLookFold tone="gray" สรุป={<>ช่องเงินที่ ZORT เก็บไว้{money ? ` (${Object.keys(money).length} ช่อง)` : ''} — จอไม่เดาว่าช่องไหนคือยอดคืนของใบ</>}>
          <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
            <p className="text-[12.5px] font-semibold text-gray-800 mb-1">ช่องเงินที่ ZORT เก็บไว้ (ทุกช่องที่มีค่า)</p>
            <p className="text-[11.5px] text-gray-400 mb-2">
              {/* 🔴 **จอรายการกับจอนี้เคยตอบคนละอย่างเรื่องเดียวกัน** (เจอกับของจริง 14 ก.ย. 2569)
                  จอรายการโชว์คอลัมน์ "มูลค่า" อย่างมั่นใจ (ใช้ช่อง amount) และบวกเป็นยอดรวมด้วย
                  แต่จอนี้เขียนว่า "จะไม่เดาว่าช่องไหนคือยอดคืน"
                  ⇒ คนที่อ่านทั้งสองจอจะไม่รู้ว่าตกลงระบบรู้หรือไม่รู้
                  ⇒ จอนี้ยังไม่เดาเหมือนเดิม (ถูกแล้ว) แต่ต้องบอกว่าจอรายการใช้ช่องไหน
                     ไม่งั้นสองจอดูเหมือนขัดกันเอง ทั้งที่แค่ระมัดระวังคนละระดับ */}
              เส้นนี้ยังไม่ได้ตั้งชื่อว่าช่องไหนคือ &ldquo;ยอดคืนของใบ&rdquo; — <b>จอจะไม่เดาให้</b>
              เพราะเดาผิดคือยอดคืนผิดทั้งร้าน
            </p>
            <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mb-2 leading-relaxed">
              ⚠️ หมายเหตุ: <b>จอรายการใบคืน</b> แสดงคอลัมน์ &ldquo;มูลค่า&rdquo; และยอดรวม
              {' '}โดยใช้ช่อง <b>amount</b> — ไม่ใช่เพราะพิสูจน์แล้วว่านั่นคือยอดคืน
              {' '}แต่เพราะต้องเลือกช่องใดช่องหนึ่งมาเรียงลำดับ ⇒ <b>ถ้าจะเอาไปคิดเงินจริง ให้ดูช่องทั้งหมดข้างล่างนี้</b>
            </p>
            {money && Object.keys(money).length > 0 ? (
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[12.5px]">
                {Object.entries(money).map(([k, v]) => (
                  <div key={k}><dt className="text-gray-400 text-[11.5px] font-mono">{k}</dt>
                    <dd className="tabular-nums">{fmtVal(v)}</dd></div>
                ))}
              </dl>
            ) : (
              <p className="text-[12.5px] text-gray-400">ไม่มีช่องเงินที่มีค่าติดมากับใบนี้</p>
            )}
          </div>
          </ZortLookFold>

          {d.lines === null || d.lines === undefined ? (
            <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⏳ ZORT ไม่ส่งช่องบรรทัดสินค้ามากับใบนี้ — ไม่ใช่ว่าใบว่าง
            </p>
          ) : d.lines.length === 0 ? (
            <p className="text-[12.5px] text-gray-400">ใบนี้ไม่มีบรรทัดสินค้า</p>
          ) : (
            <>
              <p className="text-[12.5px] font-semibold text-gray-800 mb-2">สินค้าที่คืน ({d.lines.length})</p>
              <TableWrap>
                <table className="w-full min-w-[480px]">
                  <thead className="bg-white border-b border-gray-200">
                    {/* 📐 โหมดเหมือน ZORT (REA อ่าน /Buy/Details ใบรับคืน 20 ต.ค. 2569): # · รหัส · ชื่อสินค้า · จำนวน · มูลค่าต่อหน่วย · ส่วนลดต่อหน่วย · รวม
                        ท่อยังไม่ตั้งชื่อช่องเงินของบรรทัด ⇒ อ่านจากก้อนดิบ pricepernumber · discountPerNumber · totalprice (ยิงดูใบ CN-261017TR3HPQHV: 150 · – · 150)
                        ไม่มีช่อง = ขีด ไม่ใช่ 0 · หน่วยต่อท้ายจำนวนแบบ ZORT */}
                    {เหมือนZORT ? (
                      <tr>
                        <th className={TH}>#</th><th className={TH}>รหัส</th><th className={TH}>ชื่อสินค้า</th>
                        <th className={THR}>จำนวน</th>
                        <th className={THR}>มูลค่าต่อหน่วย</th><th className={THR}>ส่วนลดต่อหน่วย</th><th className={THR}>รวม</th>
                      </tr>
                    ) : (
                    <tr>
                      <th className={TH}>รหัส</th><th className={TH}>ชื่อสินค้า</th>
                      <th className={THR}>จำนวน</th><th className={TH}>หน่วย</th>
                    </tr>
                    )}
                  </thead>
                  <tbody>
                    {d.lines.map((l, i) => (
                      <tr key={`${l.sku ?? ''}-${i}`} className="border-b border-[#e8ecf8] last:border-0">
                        {เหมือนZORT && <td className={TD}>{i + 1}</td>}
                        {/* รหัสสินค้ากดเข้าหน้าสินค้าได้ — ปลายทางรับ sku ตรง ๆ (ไม่ต้องหา id) */}
                        <td className={`${TD} font-mono text-[12.5px]`}>
                          {l.sku
                            ? <Link href={`/core/stock/${encodeURIComponent(l.sku)}`}
                                className="text-[#337ab7] hover:underline">{l.sku}</Link>
                            : '—'}
                        </td>
                        <td className={TD}>{l.name || '—'}</td>
                        <td className={TDR}>{typeof l.qty === 'number' ? l.qty.toLocaleString('th-TH') : '—'}{เหมือนZORT && l.unit ? <span className="text-gray-500"> {l.unit}</span> : null}</td>
                        {เหมือนZORT ? (() => {
                          const raw = l['ทุกช่องในบรรทัด'] ?? {}
                          const เลข = (v: unknown) => typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null
                          const เงิน = (v: unknown, ศูนย์เป็นขีด = false) => {
                            const n = เลข(v)
                            return n === null || (ศูนย์เป็นขีด && n === 0)
                              ? <span className="text-gray-400">-</span>
                              : n.toLocaleString('th-TH', { maximumFractionDigits: 2 })
                          }
                          return <>
                            <td className={TDR}>{เงิน(raw.pricepernumber)}</td>
                            <td className={TDR}>{เงิน(raw.discountPerNumber, true)}</td>
                            <td className={TDR}>{เงิน(raw.totalprice)}</td>
                          </>
                        })() : <td className={TD}>{l.unit || <span className="text-gray-300">—</span>}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>

              <details className="mt-3">
                <summary className="text-[12.5px] text-gray-500 cursor-pointer">ดูทุกช่องดิบที่ ZORT ส่งมา (ไว้ไล่ปัญหา)</summary>
                <div className="mt-2 space-y-2">
                  {d.lines.map((l, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-md p-3">
                      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
                        {Object.entries(l['ทุกช่องในบรรทัด'] ?? {}).map(([k, v]) => (
                          <div key={k}><dt className="inline text-gray-400 font-mono text-[10px]">{k}:</dt>{' '}
                            <dd className="inline text-gray-800">{fmtVal(v)}</dd></div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}

          <p className="text-[11.5px] text-gray-400 mt-3">
            ช่องทั้งหมดที่ ZORT ส่งมากับหัวใบ: <span className="font-mono">{(d.fields ?? []).join(', ') || 'ไม่ทราบ'}</span>
          </p>
        </>
      )}
    </div>
  )
}

export default function ReturnOrderDetailPage() {
  // useSearchParams ต้องอยู่ใน Suspense (แพตเทิร์นเดียวกับ sales/detail)
  return <Suspense fallback={<div className="p-6"><LoadingState /></div>}><Inner /></Suspense>
}
