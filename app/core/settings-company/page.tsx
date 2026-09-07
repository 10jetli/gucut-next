'use client'
// ตั้งค่า → บริษัท/ร้านค้า (ปิดแถว 38)
//
// ✅ **ได้ภาพจริงแล้ว 7 ก.ย. 2569** (`zort-ui/84-85`) — ผัง ZORT คือฟอร์ม 2 ส่วน
//    (ข้อมูลบริษัท/ร้านค้า + ข้อมูลติดต่อ) และมี **เมนูย่อยฝั่งซ้าย 10 รายการ**
//    (บริษัท/ร้านค้า · ตั้งค่าโปรแกรม · เอกสาร · ช่องทางจัดส่ง · ช่องทางการขาย · SMS ·
//     การชำระเงิน · ตรวจสลิปอัตโนมัติ · Tracking & Analytics · รีเซ็ตข้อมูลทั้งหมด)
//    ⇒ ใส่เมนูย่อยตามผังแล้ว — จอย่อยที่ยังไม่มีพาไปหน้า soon ที่บอกตรง ๆ (มีภาพ 87-98 รอลอก)
// ⚠️ **ภาพ 84 มีที่อยู่ร้านจริงในฟอร์ม — ของเราไม่ใส่ตามคำสั่งเจ้าของร้าน**
//    ช่องที่อยู่จึงแสดงเป็นคำอธิบายว่าทำไมไม่แสดง ไม่ใช่ปล่อยว่างให้เดา
//
// 🔴 **ข้อมูลนิติบุคคลมีแหล่งความจริงเดียว: `gucut-web/src/lib/shop.ts` + `licenses.ts`**
//    จอนี้ **ห้ามคัดลอกมาเก็บไว้ฝั่งนี้เด็ดขาด** — ต่ออายุใบอนุญาตทีเดียวจะมีสองที่ให้แก้
//    แล้วตกหล่นแน่นอน (กติกาโปรเจกต์: ห้ามพิมพ์ข้อมูลร้านซ้ำที่อื่น)
//    ⇒ อ่านผ่าน `?shopinfo=1` ซึ่งฝั่งท่ออ่านจากไฟล์ต้นทางให้
//
// ⚠️ **สองนิติบุคคล ห้ามยุบรวมกัน** (กติกาเหล็กของร้าน)
//    ผู้ขาย = บริษัท ศีตกาล เทรดดิ้ง (ออกใบกำกับภาษี) ·
//    ผู้ผลิต/ผู้นำเข้า = หจก. นิวเวฟ ซันไชน์ (ถือใบอนุญาตเลื่อยโซ่ยนต์ทุกฉบับ)
//    ⇒ **ห้ามเขียนว่าร้านถือใบอนุญาตเอง** สิ่งที่เป็นของร้านคือหนังสือแต่งตั้งตัวแทนจำหน่าย
//
// ⚠️ **ไม่มีที่อยู่ทั้งสองนิติบุคคลโดยตั้งใจ** — เจ้าของร้านสั่งไม่ให้ที่อยู่เป็นสาธารณะ
//    ฝั่งท่อไม่ส่งมาให้เลย (ตกลงกัน 6 ก.ย.) ⇒ ส่งมาก็จะไปโผล่ในไฟล์ฝั่งนี้แทน = ย้ายปัญหา
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, Pill } from '@/components/zort'

/* 🔴 **ชื่อช่องต้องตรงกับ SHOP_DATA ของจริง** (netlify/lib/shop-data.mjs ฝั่งท่อ)
   ใบอนุญาต: no · issued · expires · authority · note
   เครื่องหมายการค้า: mark · regNo · registered · expires · owner · goods
   หนังสือแต่งตั้ง: brand · appointer · appointee · scope · issued · expires
   ⚠️ ร่างแรกเดาชื่อเอง (number/issuedBy/issuedAt/expiresAt) ⇒ ทุกแถวขึ้นขีด
      และป้ายหมดอายุตายทั้งตาราง **โดยจอดูปกติทุกประการ** (จับได้ 7 ก.ย. ตอนทำ fixture
      จากของจริง) — โรคเดียวกับตัวตรวจที่เดาชื่อคีย์ rows/documents/list */
interface Doc {
  kind?: string; no?: string; issued?: string; expires?: string; authority?: string; note?: string
  mark?: string; regNo?: string; registered?: string; owner?: string; goods?: string
  brand?: string; appointer?: string; appointee?: string; scope?: string
}
/** แปลงสามชนิดเอกสารให้เป็นแถวหน้าตาเดียวกัน — ช่องไหนไม่มีจริงปล่อย undefined ให้ขีด */
function normDoc(d: Doc) {
  return {
    number: d.no ?? d.regNo,
    kind: d.kind ?? (d.mark ? `เครื่องหมายการค้า ${d.mark}${d.goods ? ` — ${d.goods}` : ''}` : undefined)
      ?? (d.brand ? `${d.scope ?? 'หนังสือแต่งตั้ง'} (${d.brand})` : d.scope),
    issuedBy: d.authority ?? d.owner ?? d.appointer,
    issuedAt: d.issued ?? d.registered,
    expiresAt: d.expires,
  }
}
interface Party { name?: string; nameEn?: string; taxId?: string; phone?: string; email?: string }
interface Resp {
  seller?: Party
  licensee?: Party
  licenses?: Doc[]
  trademarks?: Doc[]
  distributorships?: Doc[]
  registry?: Record<string, string>
  error?: string
}

/** วันหมดอายุผ่านไปแล้วหรือยัง — คิดสด ห้ามให้ท่อคิดแล้วแช่ค่า
 *  (กฎที่ตกลงกัน: ค่าที่เดินตามเวลา จอคิดเอง · ค่าที่ต้องเห็นข้อมูลทั้งชุด ท่อคิดให้) */
function expiryTone(iso?: string): { tone: 'green' | 'orange' | 'red' | 'gray'; text: string } {
  if (!iso || typeof iso !== 'string') return { tone: 'gray', text: 'ไม่ระบุวันหมดอายุ' }
  /* 🔴 **ต้องเทียบกับ "สิ้นวัน" ไม่ใช่ "ต้นวัน"** (แก้ 6 ก.ย. 2569 ตอนยิงเคสขอบ)
     ใบที่เขียนว่าหมดอายุ 6 ก.ย. ยังใช้ได้**ตลอดทั้งวันที่ 6**
     เทียบกับ 00:00 ของวันนั้น = พอผ่านเที่ยงคืนไปนิดเดียว จอจะขึ้น "หมดอายุแล้ว 1 วัน"
     ⇒ **จอบอกว่าใบตายทั้งที่ยังใช้ได้อีกทั้งวัน** — ทำให้คนตกใจและอาจหยุดขายเปล่า ๆ
     (คลาสเดียวกับ "คำเตือนที่ไม่มีเงื่อนไข ทำให้ตัดสินใจผิดทางตื่นตูม")
     ⇒ บวกหนึ่งวันก่อนเทียบ · และแยกข้อความ "หมดอายุวันนี้" ออกมาให้ชัด */
  const end = new Date(`${iso}T00:00:00+07:00`).getTime() + 86400000
  if (!Number.isFinite(end)) return { tone: 'gray', text: 'อ่านวันที่ไม่ออก' }
  const left = end - Date.now()
  if (left <= 0) {
    const gone = Math.ceil(-left / 86400000)
    return { tone: 'red', text: `หมดอายุแล้ว ${gone.toLocaleString('th-TH')} วัน` }
  }
  const days = Math.floor(left / 86400000)
  if (days === 0) return { tone: 'red', text: 'หมดอายุวันนี้ — วันสุดท้ายที่ใช้ได้' }
  if (days <= 60) return { tone: 'orange', text: `เหลือ ${days.toLocaleString('th-TH')} วัน` }
  return { tone: 'green', text: `เหลือ ${Math.round(days / 30).toLocaleString('th-TH')} เดือน` }
}

const thai = (iso?: string) => {
  if (!iso || typeof iso !== 'string') return '—'
  const [y, m, d] = iso.split('-').map(Number)
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return m >= 1 && m <= 12 ? `${d} ${M[m - 1]} ${y + 543}` : iso
}

/* ── แถวฟอร์มอ่านอย่างเดียวตามผังภาพ 84/85: ป้ายซ้าย + กล่องค่าขวา ──
   ⚠️ ของ ZORT เป็น input แก้ได้ · ของเราอ่านอย่างเดียวโดยตั้งใจ (แก้ต้องแก้ไฟล์ต้นทาง)
   ⇒ วาดเป็นกล่องเทาไม่ใช่ input ขาว — จะได้ไม่มีใครพยายามคลิกแก้ */
function FormRow({ label, value, muted, mutedWhy }: {
  label: string; value?: string; muted?: string; mutedWhy?: string
}) {
  return (
    <div className="flex items-start gap-3 mb-2.5">
      <span className="w-[150px] shrink-0 text-[12px] text-gray-500 pt-1.5">{label}</span>
      {typeof value === 'string' && value ? (
        <span className="flex-1 max-w-[420px] text-[12.5px] text-gray-800 bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
          {value}
        </span>
      ) : (
        <span className="flex-1 max-w-[420px] text-[12px] text-gray-400 bg-gray-50/60 border border-dashed border-gray-200 rounded px-3 py-1.5"
          title={mutedWhy}>
          {muted ?? '—'}
        </span>
      )}
    </div>
  )
}

function PartyCard({ title, role, p, warn }: { title: string; role: string; p?: Party; warn?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <p className="text-[11.5px] text-gray-400">{role}</p>
      <p className="text-[15px] font-semibold text-gray-900">{title}</p>
      {p ? (
        <dl className="text-[13px] mt-2 space-y-1.5">
          <div><dt className="text-gray-400 text-[11.5px]">ชื่อตามทะเบียน</dt><dd className="text-gray-800">{p.name || '—'}</dd></div>
          {p.nameEn && <div><dt className="text-gray-400 text-[11.5px]">ชื่ออังกฤษ</dt><dd className="text-gray-700">{p.nameEn}</dd></div>}
          <div><dt className="text-gray-400 text-[11.5px]">เลขประจำตัวผู้เสียภาษี</dt>
            <dd className="text-gray-800 font-mono">{p.taxId || '—'}</dd></div>
          {p.phone && <div><dt className="text-gray-400 text-[11.5px]">โทร</dt><dd className="text-gray-700">{p.phone}</dd></div>}
          {p.email && <div><dt className="text-gray-400 text-[11.5px]">อีเมล</dt><dd className="text-gray-700">{p.email}</dd></div>}
        </dl>
      ) : (
        <p className="text-[12.5px] text-gray-400 mt-2">ท่อยังไม่ส่งข้อมูลนิติบุคคลนี้มา</p>
      )}
      {warn && (
        <p className="text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mt-2 leading-relaxed">
          ⚠️ {warn}
        </p>
      )}
    </div>
  )
}

function DocTable({ title, rows, empty }: { title: string; rows?: Doc[]; empty: string }) {
  const list = Array.isArray(rows) ? rows : []
  return (
    <div className="mb-5">
      <p className="text-[15px] font-semibold text-gray-800 mb-2">{title} {list.length > 0 && <span className="text-gray-400 text-[13px]">({list.length})</span>}</p>
      {list.length === 0
        ? <p className="text-[12.5px] text-gray-400">{empty}</p>
        : (
          <div className="border border-gray-200 rounded-md overflow-hidden bg-white overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className="text-left font-normal text-[12px] text-gray-500 px-3 py-2.5">เลขที่</th>
                  <th className="text-left font-normal text-[12px] text-gray-500 px-3 py-2.5">ชนิด / ขอบเขต</th>
                  <th className="text-left font-normal text-[12px] text-gray-500 px-3 py-2.5">ออกโดย</th>
                  <th className="text-left font-normal text-[12px] text-gray-500 px-3 py-2.5">ออกเมื่อ</th>
                  <th className="text-left font-normal text-[12px] text-gray-500 px-3 py-2.5">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {list.map(normDoc).map((d, i) => {
                  const e = expiryTone(d.expiresAt)
                  return (
                    <tr key={`${d.number ?? i}`} className="border-b border-[#e8ecf8] last:border-0">
                      <td className="px-3 py-3 text-[12.5px] text-gray-900 font-mono">{d.number || '—'}</td>
                      <td className="px-3 py-3 text-[12.5px] text-gray-700">{d.kind || '—'}</td>
                      <td className="px-3 py-3 text-[12.5px] text-gray-600">{d.issuedBy || '—'}</td>
                      <td className="px-3 py-3 text-[12.5px] text-gray-600 whitespace-nowrap">{thai(d.issuedAt)}</td>
                      <td className="px-3 py-3 text-[12.5px] whitespace-nowrap">
                        <Pill tone={e.tone}>{e.text}</Pill>
                        {d.expiresAt && <span className="block text-[11px] text-gray-400 mt-0.5">ถึง {thai(d.expiresAt)}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}

export default function SettingsCompanyPage() {
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/web/core?shopinfo=1').then((x) => x.json())
      if (r?.error) throw new Error(r.error)
      setD(r)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setD(null)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  /* ⚠️ ตัดสินว่า "ท่อพร้อม" จาก **การมีฟิลด์จริง** ไม่ใช่จากวันที่หรือคำบอกเล่า
     ก่อน endpoint ขึ้นเว็บ จะไม่มี seller/licensee ⇒ จอขึ้นสถานะรอ ไม่ใช่พัง
     (บทเรียน orderfacets: ยิงเส้นที่ยังไม่ deploy ได้ 200 พร้อม body คนละชุด) */
  const ready = !!(d?.seller || d?.licensee)

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ข้อมูลบริษัท/ร้านค้า"
        summary={
          <>
            ข้อมูลนิติบุคคลและเอกสารตามกฎหมายที่ระบบใช้อ้างอิงจริง
            {' | '}
            <span className="text-gray-400">อ่านจากแหล่งเดียวกับหน้าร้าน ไม่ได้พิมพ์ซ้ำ</span>
          </>
        }
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      <div className="flex gap-5 items-start">
        {/* ── เมนูย่อยฝั่งซ้ายตามผังภาพ 84 — 10 รายการของ ZORT ──
            จอที่ยังไม่มีพาไปหน้า soon (ห้ามลิงก์หลอก) · ภาพจอจริง 87-98 มีแล้ว รอลอกทีละจอ */}
        <nav className="hidden md:block w-[190px] shrink-0 bg-white border border-gray-200 rounded-md py-1.5 text-[12.5px]">
          {[
            ['บริษัท / ร้านค้า', '/core/settings-company', true],
            ['ตั้งค่าโปรแกรม', '/core/soon/setting-program', false],
            ['ตั้งค่าเอกสาร', '/core/soon/setting-docs', false],
            ['ตั้งค่าช่องทางจัดส่ง', '/core/soon/setting-shipping', false],
            ['ตั้งค่าช่องทางการขาย', '/core/soon/setting-channels', false],
            ['ตั้งค่า SMS', '/core/soon/setting-sms', false],
            ['ตั้งค่าการชำระเงิน', '/core/soon/setting-payment', false],
            ['ตั้งค่าการตรวจสอบสลิปอัตโนมัติ', '/core/soon/setting-slipcheck', false],
            ['Tracking & Analytics', '/core/soon/setting-tracking', false],
            ['รีเซ็ตข้อมูลทั้งหมด', '/core/soon/setting-reset', false],
          ].map(([label, href, active]) => (
            <a key={String(href)} href={String(href)}
              className={`block px-3 py-1.5 ${active ? 'text-blue-700 font-semibold border-l-2 border-blue-600 bg-blue-50/50' : 'text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </a>
          ))}
        </nav>

        <div className="flex-1 min-w-0">
          {error && <ErrorBox title="ดึงข้อมูลบริษัทไม่ได้">{error}</ErrorBox>}
          {loading && !d && <LoadingState />}
          {!loading && !error && !ready && (
            <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 leading-relaxed">
              ⏳ <b>ท่อยังไม่ส่งข้อมูลนิติบุคคลมา</b> — จอนี้อ่านจาก <code>?shopinfo=1</code> ซึ่งฝั่งท่ออ่าน
              จากไฟล์ต้นทางไฟล์เดียวกับหน้าร้าน · ขึ้นเว็บเมื่อไหร่จอจะแสดงเอง ไม่ต้องแก้จอ
            </div>
          )}
      {ready && (
        <>
          {/* ── ฟอร์มตามผังภาพ 84/85 — สองส่วน: ข้อมูลบริษัท/ร้านค้า + ข้อมูลติดต่อ ──
              ⚠️ ช่องที่ท่อไม่ส่ง = กล่องเส้นประพร้อมเหตุผล **ห้ามพิมพ์ค่าจาก ZORT ใส่เอง**
                 (สาขา/เบอร์/อีเมล เห็นในภาพ 84 แต่แหล่งความจริงคือไฟล์ต้นทางฝั่งหน้าร้าน)
              ⚠️ ไม่มีปุ่ม "บันทึก" ของ ZORT โดยตั้งใจ — จอนี้อ่านอย่างเดียว (ดูท้ายหน้า) */}
          <div className="bg-white border border-gray-200 rounded-md p-4 md:p-5 mb-4">
            <p className="text-[13.5px] font-semibold text-gray-800 mb-3">🏢 ข้อมูลบริษัท/ร้านค้า</p>
            <FormRow label="บริษัท/ร้านค้า" value={d?.seller?.name} />
            <FormRow label="เลขผู้เสียภาษี" value={d?.seller?.taxId} />
            <FormRow label="ชื่อสาขาหลัก" muted="ท่อยังไม่ส่งช่องนี้มา"
              mutedWhy="ยังไม่มีจอไหนใช้ — ต้องการเมื่อไหร่ขอเพิ่มใน ?shopinfo=1 ได้" />
            <FormRow label="เลขที่สาขาหลัก" muted="ท่อยังไม่ส่งช่องนี้มา"
              mutedWhy="ยังไม่มีจอไหนใช้ — ต้องการเมื่อไหร่ขอเพิ่มใน ?shopinfo=1 ได้" />
            <FormRow label="ที่อยู่" muted="ไม่แสดง — เจ้าของร้านสั่งไม่ให้ที่อยู่ร้านอยู่ในระบบเว็บ"
              mutedWhy="ตกลงกัน 6 ก.ย. — ท่อไม่ส่งที่อยู่มาเลย ไม่ใช่ของหาย" />
            <FormRow label="ที่อยู่เข้ารับสินค้า" muted="ไม่แสดง — เหตุผลเดียวกับที่อยู่"
              mutedWhy="ตกลงกัน 6 ก.ย. — ท่อไม่ส่งที่อยู่มาเลย ไม่ใช่ของหาย" />
            <div className="h-2" />
            <FormRow label="บริษัท/ร้านค้า (English)" value={d?.seller?.nameEn} />

            <p className="text-[13.5px] font-semibold text-gray-800 mt-5 mb-3">📞 ข้อมูลติดต่อ</p>
            <FormRow label="เบอร์โทรศัพท์" value={d?.seller?.phone} muted="ท่อยังไม่ส่งช่องนี้มา"
              mutedWhy="ท่อเพิ่ม seller.phone/email แล้ว 7 ก.ย. — ขึ้นค่าจริงหลัง deploy รอบ 21:00" />
            <FormRow label="อีเมล" value={d?.seller?.email} muted="ท่อยังไม่ส่งช่องนี้มา"
              mutedWhy="ท่อเพิ่ม seller.phone/email แล้ว 7 ก.ย. — ขึ้นค่าจริงหลัง deploy รอบ 21:00" />
            <FormRow label="Website" muted="ท่อยังไม่ส่งช่องนี้มา"
              mutedWhy="ที่อยู่เว็บอ่านจาก env ฝั่งหน้าร้าน — ห้ามพิมพ์ตายตัว (กติการ้านต้นแบบ)" />
          </div>

          {/* 🔴 สองนิติบุคคล — ห้ามยุบรวม · ฟอร์มข้างบนคือ "ผู้ขาย" เท่านั้น */}
          <div className="mb-5">
            <PartyCard
              role="ผู้ผลิต/ผู้นำเข้า · ผู้ถือใบอนุญาตเลื่อยโซ่ยนต์ — คนละนิติบุคคลกับผู้ขายข้างบน"
              title="ผู้ผลิต"
              p={d?.licensee}
              warn="ใบอนุญาตเลื่อยโซ่ยนต์ทุกฉบับออกในนามนิติบุคคลนี้ ไม่ใช่ของร้าน — สิ่งที่เป็นของร้านคือหนังสือแต่งตั้งตัวแทนจำหน่าย ห้ามเขียนสลับกัน"
            />
          </div>

          <DocTable title="ใบอนุญาตเลื่อยโซ่ยนต์ (ของผู้ผลิต)" rows={d?.licenses}
            empty="ท่อยังไม่ส่งรายการใบอนุญาตมา" />
          <DocTable title="เครื่องหมายการค้า" rows={d?.trademarks}
            empty="ท่อยังไม่ส่งรายการเครื่องหมายการค้ามา" />
          <DocTable title="หนังสือแต่งตั้งตัวแทนจำหน่าย (ของร้าน)" rows={d?.distributorships}
            empty="ท่อยังไม่ส่งรายการหนังสือแต่งตั้งมา" />

          {d?.registry && Object.keys(d.registry).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
              <p className="text-[15px] font-semibold text-gray-800 mb-2">บัญชีทะเบียนราชการ</p>
              <dl className="text-[13px] space-y-1.5">
                {Object.entries(d.registry).map(([k, v]) => (
                  <div key={k}><dt className="text-gray-400 text-[11.5px]">{k}</dt><dd className="text-gray-800">{String(v)}</dd></div>
                ))}
              </dl>
            </div>
          )}
        </>
      )}

        </div>
      </div>

      <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">
        ⚠️ <b>ไม่มีที่อยู่ของทั้งสองนิติบุคคลโดยตั้งใจ</b> — เจ้าของร้านสั่งไม่ให้ที่อยู่เป็นสาธารณะ
        และฝั่งท่อไม่ส่งมาให้เลย (ส่งมาก็จะไปติดในไฟล์ฝั่งนี้แทน = ย้ายปัญหา ไม่ใช่แก้) ·
        <b> สถานะ &ldquo;หมดอายุ/เหลือกี่วัน&rdquo; จอคิดสดจากวันนี้</b> ไม่ได้ให้ท่อคิดแล้วแช่ค่า
        (ค่าที่เดินตามเวลาต้องคิดตอนแสดงเสมอ) · แก้ข้อมูลต้องแก้ที่ไฟล์ต้นทางฝั่งหน้าร้าน
        <b> จอนี้ไม่มีปุ่มแก้โดยตั้งใจ</b> — เอกสารตามกฎหมายไม่ควรแก้ผ่านหน้าเว็บ
      </p>
    </div>
  )
}
