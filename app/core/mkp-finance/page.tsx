'use client'
// เงินจากมาร์เก็ตเพลส — กระจกในฐาน + อ่านสดจากแพลตฟอร์ม (19 ก.ย. 2569 · ใบ t_mu5bxe47)
//
// 🚫 **ห้ามมีช่อง "รวมทั้งหมด" ในจอนี้เด็ดขาด — ห้ามเพิ่มกลับ**
//    ท่อประกาศเองติดมากับคำตอบว่าสามเจ้าเป็นข้อมูล **คนละระดับ** (`grain`):
//      · Shopee  = `wallet-txn`  รายการเดินบัญชีกระเป๋าเงิน (เงินเข้า-ออกทีละรายการ)
//      · Lazada  = `fee-line`    ค่าธรรมเนียม **รายบรรทัด** ของใบเดียวกันหลายบรรทัด
//      · TikTok  = `statement`   ใบสรุป **รอบโอนเงิน** (หนึ่งแถว = หลายออเดอร์รวมกัน)
//    ⇒ บวกกันเมื่อไหร่ได้เลขที่ไม่มีความหมายอะไรเลย แต่ **หน้าตาน่าเชื่อถือมาก**
//    ⇒ ตัวเลขที่เทียบกันได้คือยอดใน **ตารางเดียวกัน ช่วงวันเดียวกัน** เท่านั้น
//
// 🔴 **จอนี้มีของจากสองแหล่ง ห้ามวางคู่กันเฉย ๆ** (CLAUDE.md ข้อ 4)
//    · `?mkpfinancemirror=1` = สิ่งที่ **เก็บลงฐาน D1 แล้ว** (กระจก · นับได้ทั้งกอง)
//    · `?mkpfinance=1`       = **อ่านสดจากแพลตฟอร์มเดี๋ยวนี้** · ท่อบอกเองว่า
//                              "ยังไม่เขียนลงฐาน" ⇒ เลขสองฝั่งไม่ต้องตรงกันและ **ไม่ใช่บั๊ก**
//    ⇒ แยกเป็นคนละการ์ด พร้อมหัวข้อบอกแหล่งทุกใบ · ห้ามเอามาลบกันเพื่อหา "ส่วนต่าง"
//
// ⚠️ **ทุกเจ้าคืน `truncated: true`** — ที่เห็นคือหน้าแรกเท่านั้น ไม่ใช่ทั้งหมด
//    และ TikTok ไล่หน้าด้วย `pageToken` ไม่ใช่ `page` ⇒ `scope` ของมันบอกเองว่า
//    **ไม่ได้กรองตามช่วงวัน** ⇒ คอลัมน์วันของ TikTok ตอบคนละคำถามกับอีกสองเจ้า
//    🔑 ของพวกนี้ต้องขึ้น **เหนือ** ตัวเลข ไม่ใช่เป็นเชิงอรรถใต้ตาราง
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, EndpointMissing } from '@/components/zort'
import { coreJson } from '@/lib/api-shape'
import { fmtMoney, thaiDate, thaiDateUtc } from '@/lib/format'

/* ── รูปคำตอบ — ยิงของจริงมาแล้วทั้งสองเส้น ห้ามเดาชื่อคีย์ ──
   ทุกช่องเป็น optional เพราะท่อเพิ่ม/ลดได้ · **ไม่มีค่า ≠ 0** (จอต้องขึ้นขีด) */
interface MirrorTable {
  platform?: string; grain?: string
  'กุญแจ'?: string[]
  'แถว'?: number
  'วันแรก'?: string; 'วันล่าสุด'?: string; 'ซิงก์ล่าสุด'?: string
}
interface MirrorResp {
  ok?: boolean
  mkp_wallet_txn?: MirrorTable; mkp_fee_line?: MirrorTable; mkp_statement?: MirrorTable
  '🚫 ห้ามบวกข้ามตาราง'?: string
  error?: string
}
type Row = Record<string, unknown>
interface LiveSide {
  platform?: string; ok?: boolean; grain?: string
  rows?: Row[]; count?: number
  truncated?: boolean
  windowDays?: number; windowClamped?: boolean
  scope?: string
  nextPageToken?: string
  error?: string
}
interface LiveResp {
  ok?: boolean; checkedAt?: string; days?: number; limit?: number
  'range'?: { from?: string; to?: string }
  shopeeMaxDays?: number
  pageApplies?: string
  note?: string
  results?: LiveSide[]
  error?: string
}

/** ชื่อไทยของ "ระดับข้อมูล" — คำนี้ตัดสินว่ายอดเอามาบวกกันได้หรือไม่ ⇒ ต้องขึ้นทุกการ์ด */
const GRAIN_TH: Record<string, string> = {
  'wallet-txn': 'รายการเดินบัญชีกระเป๋าเงิน (หนึ่งแถว = เงินเข้า-ออกหนึ่งครั้ง)',
  'fee-line': 'ค่าธรรมเนียมรายบรรทัด (หนึ่งใบมีได้หลายแถว)',
  'statement': 'ใบสรุปรอบโอนเงิน (หนึ่งแถว = หลายออเดอร์รวมกัน)',
  'order-fees': 'ค่าธรรมเนียมรายใบสั่งซื้อ',
}

/** ชื่อไทยของคอลัมน์ · **คีย์ที่ไม่อยู่ในนี้จะขึ้นชื่อดิบตามเดิม ไม่ใช่ถูกซ่อน**
 *  (ท่อเพิ่มช่องใหม่เมื่อไหร่ จอต้องแสดงทันทีแม้ยังไม่มีใครตั้งชื่อไทยให้) */
const COL_TH: Record<string, string> = {
  id: 'รหัสรายการ', day: 'วัน', dayRaw: 'วัน (ค่าดิบ)', paidDay: 'วันที่จ่าย',
  type: 'ประเภท', flow: 'ทิศเงิน', status: 'สถานะ',
  walletAmount: 'ยอดในกระเป๋า', balanceAfter: 'ยอดคงเหลือหลังรายการ',
  orderRef: 'อ้างอิงออเดอร์', refundRef: 'อ้างอิงคืนเงิน', orderItemRef: 'อ้างอิงรายการในออเดอร์',
  feeName: 'ชื่อค่าธรรมเนียม', feeType: 'ชนิดค่าธรรมเนียม', feeLineAmount: 'ยอดบรรทัดนี้',
  vatIn: 'VAT ที่รวมอยู่', wht: 'หัก ณ ที่จ่าย', statement: 'เลขใบสรุป', paidStatus: 'สถานะจ่าย',
  currency: 'สกุลเงิน', settlement: 'ยอดโอนสุทธิ', revenue: 'รายได้', netSales: 'ยอดขายสุทธิ',
  fee: 'ค่าธรรมเนียม', shippingCost: 'ค่าส่ง', adjustment: 'ปรับปรุง',
  paymentStatus: 'สถานะการจ่าย', paymentRef: 'อ้างอิงการจ่าย',
}
/** ช่องที่เป็นจำนวนเงิน — จัดชิดขวาและใช้ตัวจัดรูปเดียวกับทั้งระบบ */
const เป็นเงิน = new Set([
  'walletAmount', 'balanceAfter', 'feeLineAmount', 'vatIn', 'wht',
  'settlement', 'revenue', 'netSales', 'fee', 'shippingCost', 'adjustment',
])
/** คอลัมน์ซ้ำกับหัวการ์ดอยู่แล้ว ⇒ ไม่ต้องขึ้นในตารางให้รก */
const ซ่อน = new Set(['platform', 'grain'])

function ค่าในช่อง(k: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (เป็นเงิน.has(k)) return fmtMoney(typeof v === 'number' ? v : Number(v))
  /* 🔴 **ห้ามตัดเวลาทิ้งก่อนแปลงวัน** — ด่าน check-thai-date จับผมได้ตอนเขียนรอบแรก
     `.slice(0,10)` ทำให้ตัวแปลงไม่มีทางรู้ว่าต้องเลื่อนโซนหรือไม่ ⇒ วัน UTC โผล่บนจอเงียบ ๆ
     ค่าที่ท่อส่งมาวันนี้เป็นวันไทยล้วน (`2026-09-19` ไม่มีเวลา) แต่ **ห้ามผูกกับรูปวันนี้**
     ⇒ แยกสามทางตามสิ่งที่ค่าบอกเกี่ยวกับตัวเอง ไม่ใช่ตามที่เราเดา */
  if ((k === 'day' || k === 'paidDay') && typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return thaiDate(v)               // วันล้วน ไม่มีเวลาให้เสีย
    if (/(Z|[+-]\d{2}:?\d{2})$/.test(v)) return thaiDate(v)             // บอกโซนมาเอง ⇒ ส่งเต็ม
    if (/^\d{4}-\d{2}-\d{2}[T ]/.test(v)) return thaiDateUtc(v)         // มีเวลาแต่ไม่บอกโซน = UTC
  }
  return String(v)
}

/** แถบขอบเขต — **ต้องอยู่เหนือตัวเลขเสมอ** ไม่ใช่เชิงอรรถ
 *  (บทเรียน 19 ก.ย. 2569: ของที่แรงที่สุดต้องอยู่บนสุด) */
function ขอบเขต({ s }: { s: LiveSide }) {
  const เตือน: string[] = []
  if (s.truncated) {
    เตือน.push(
      `ที่เห็นคือหน้าแรก ${s.count ?? '—'} แถวเท่านั้น — ท่อบอกเองว่ายังมีต่อ (truncated)`,
    )
  }
  if (s.windowClamped) เตือน.push(`ช่วงวันถูกย่อลงเหลือ ${s.windowDays ?? '—'} วัน เพราะแพลตฟอร์มจำกัด`)
  if (s.nextPageToken) เตือน.push('เจ้านี้ไล่หน้าด้วยรหัสหน้าถัดไป (pageToken) ไม่ใช่เลขหน้า')
  return (
    <div className="text-[11.5px] leading-relaxed mb-2">
      {s.scope && <p className="text-gray-700">📐 <b>ขอบเขตของตัวเลขข้างล่าง</b> — {s.scope}</p>}
      {เตือน.map((x) => (
        <p key={x} className="text-amber-800">⚠️ {x}</p>
      ))}
    </div>
  )
}

function ตารางแถว({ rows }: { rows: Row[] }) {
  if (!rows.length) {
    return <p className="text-[12px] text-gray-500">ท่อไม่ได้ส่งแถวมาในรอบนี้ — <b>ไม่ได้แปลว่าไม่มีรายการ</b></p>
  }
  /* คอลัมน์มาจากคีย์ที่ **มีจริงในแถว** ไม่ใช่รายการที่เราพิมพ์ไว้
     ⇒ ท่อเพิ่มช่องใหม่แล้วจอเห็นทันที (คลาสเดียวกับ "รายชื่อของที่จะตรวจต้องถูกสร้าง ไม่ใช่พิมพ์") */
  /* (ไม่ใช้ spread ของ Set — tsconfig ของ repo นี้ target ต่ำกว่า es2015) */
  const cols = rows
    .flatMap((r) => Object.keys(r))
    .filter((k, i, a) => a.indexOf(k) === i && !ซ่อน.has(k))
  return (
    <div className="overflow-x-auto border border-gray-200 rounded">
      <table className="w-full text-[11.5px]">
        <thead className="bg-gray-50">
          <tr>
            {cols.map((c) => (
              <th key={c} className={`px-2 py-1.5 font-semibold text-gray-700 whitespace-nowrap ${เป็นเงิน.has(c) ? 'text-right' : 'text-left'}`}>
                {COL_TH[c] ?? <span className="font-mono text-gray-500">{c}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-100">
              {cols.map((c) => (
                <td key={c} className={`px-2 py-1 whitespace-nowrap ${เป็นเงิน.has(c) ? 'text-right tabular-nums' : ''}`}>
                  {ค่าในช่อง(c, r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function MkpFinancePage() {
  const [mirror, setMirror] = useState<MirrorResp | null>(null)
  const [live, setLive] = useState<LiveResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notDeployed, setNotDeployed] = useState(false)
  const [known, setKnown] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotDeployed(false)
    try {
      const [m, l] = await Promise.all([
        coreJson<MirrorResp>('/api/web/core?mkpfinancemirror=1', ['mkp_wallet_txn']),
        coreJson<LiveResp>('/api/web/core?mkpfinance=1', ['results']),
      ])
      setKnown(m.known || l.known)
      const err = (m.raw as { error?: string } | null)?.error || (l.raw as { error?: string } | null)?.error
      if (err) throw new Error(err)
      /* 🔑 สองเส้นนี้ **พังแยกกันได้** — เส้นหนึ่งล่มไม่ควรทำให้อีกเส้นหายไปจากจอ
         ⇒ เก็บทีละเส้น · "ยังไม่ขึ้นเว็บ" ประกาศก็ต่อเมื่อ **ทั้งคู่** ตอบไม่ได้ */
      setMirror(m.ok ? m.data : null)
      setLive(l.ok ? l.data : null)
      if (!m.ok && !l.ok) setNotDeployed(true)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e)); setMirror(null); setLive(null)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const ตารางกระจก: Array<[string, MirrorTable | undefined]> = [
    ['mkp_wallet_txn', mirror?.mkp_wallet_txn],
    ['mkp_fee_line', mirror?.mkp_fee_line],
    ['mkp_statement', mirror?.mkp_statement],
  ]
  const ห้ามบวก = mirror?.['🚫 ห้ามบวกข้ามตาราง']

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="เงินจากมาร์เก็ตเพลส"
        summary={
          <>
            เงินที่แต่ละแพลตฟอร์มโอนมาและหักไป
            {' | '}
            <span className="text-gray-400">สามเจ้าเก็บข้อมูลคนละระดับ — จอนี้จึงไม่มียอดรวมทุกเจ้าโดยตั้งใจ</span>
          </>
        }
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      {error && <ErrorBox title="ดึงข้อมูลการเงินมาร์เก็ตเพลสไม่ได้">{error}</ErrorBox>}
      {loading && <LoadingState />}
      {!loading && notDeployed && (
        <EndpointMissing
          known={known}
          what="ข้อมูลการเงินมาร์เก็ตเพลส"
          effect="จอนี้จะว่างทั้งหน้า — ไม่ได้แปลว่าแพลตฟอร์มไม่ได้โอนเงินมา"
        />
      )}

      {!loading && !notDeployed && (
        <div className="space-y-4">
          {/* 🚫 ประโยคของท่อเอง — ขึ้นบนสุดก่อนตัวเลขทุกตัว */}
          {ห้ามบวก && (
            <div className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3.5 py-2.5 leading-relaxed">
              🚫 <b>ห้ามบวกยอดข้ามตาราง</b> — {ห้ามบวก}
            </div>
          )}

          {/* ── แหล่งที่ 1: กระจกในฐาน ── */}
          <section>
            <h2 className="text-[13px] font-semibold text-gray-700 mb-1">
              ① เก็บลงฐานแล้วเท่าไหร่ <span className="font-normal text-gray-500">(กระจก D1 · นับได้ทั้งกอง)</span>
            </h2>
            {!mirror ? (
              <p className="text-[12px] text-gray-500">อ่านกระจกไม่ได้รอบนี้ — <b>ไม่ได้แปลว่าฐานว่าง</b></p>
            ) : (
              <div className="grid gap-2 md:grid-cols-3">
                {ตารางกระจก.map(([ชื่อ, t]) => (
                  <div key={ชื่อ} className="border border-gray-200 rounded-md px-3 py-2.5 text-[12px] leading-relaxed">
                    <p className="font-semibold text-gray-800">{t?.platform ?? '—'}</p>
                    <p className="text-[11px] font-mono text-gray-400">{ชื่อ}</p>
                    {/* 🔑 ระดับข้อมูลต้องติดทุกใบ — เป็นคำที่ตัดสินว่ายอดเอาไปบวกกันได้ไหม */}
                    <p className="text-gray-600 mt-1">
                      ระดับข้อมูล: <b>{t?.grain ?? '—'}</b>
                      {t?.grain && GRAIN_TH[t.grain] && (
                        <span className="block text-[11px] text-gray-500">{GRAIN_TH[t.grain]}</span>
                      )}
                    </p>
                    <p className="text-gray-700 mt-1">
                      เก็บไว้ <b>{typeof t?.['แถว'] === 'number' ? t['แถว']!.toLocaleString('th-TH') : '—'}</b> แถว
                    </p>
                    <p className="text-gray-600">
                      ช่วงวัน {t?.['วันแรก'] ? thaiDate(t['วันแรก']!) : '—'} – {t?.['วันล่าสุด'] ? thaiDate(t['วันล่าสุด']!) : '—'}
                    </p>
                    <p className="text-gray-500 text-[11px]">
                      กุญแจกันซ้ำ: {t?.['กุญแจ']?.length ? t['กุญแจ']!.join(' + ') : '—'}
                    </p>
                    <p className="text-gray-500 text-[11px]">
                      ซิงก์ล่าสุด {t?.['ซิงก์ล่าสุด'] ? new Date(t['ซิงก์ล่าสุด']!).toLocaleString('th-TH') : '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── แหล่งที่ 2: อ่านสด ── */}
          <section>
            <h2 className="text-[13px] font-semibold text-gray-700 mb-1">
              ② อ่านสดจากแพลตฟอร์มเดี๋ยวนี้{' '}
              <span className="font-normal text-gray-500">(ยังไม่ได้เขียนลงฐาน — เลขไม่ตรงกับ ① ได้ และไม่ใช่บั๊ก)</span>
            </h2>
            {!live ? (
              <p className="text-[12px] text-gray-500">อ่านสดไม่ได้รอบนี้ — <b>ไม่ได้แปลว่าไม่มีรายการ</b></p>
            ) : (
              <>
                {/* ข้อจำกัดของ "การไล่หน้า" ต้องขึ้นก่อนตาราง ไม่ใช่ใต้ตาราง */}
                <div className="text-[11.5px] leading-relaxed mb-2">
                  {live.note && <p className="text-gray-600">📖 {live.note}</p>}
                  {live.pageApplies && (
                    <p className="text-amber-800">⚠️ <b>ไล่หน้าได้ไม่เท่ากันทุกเจ้า</b> — {live.pageApplies}</p>
                  )}
                  {live['range']?.from && (
                    <p className="text-gray-500">
                      ช่วงที่ขอ {thaiDate(live['range'].from!)}
                      {live['range'].to ? ` – ${thaiDate(live['range'].to)}` : ''}
                      {typeof live.limit === 'number' ? ` · ขอครั้งละ ${live.limit} แถว` : ''}
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  {(live.results ?? []).map((s) => (
                    <div key={s.platform ?? Math.random()} className="border border-gray-200 rounded-md px-3 py-2.5">
                      <p className="text-[12.5px] font-semibold text-gray-800">
                        {s.platform ?? '—'}
                        <span className="font-normal text-gray-500">
                          {' · ระดับข้อมูล '}
                          <b>{s.grain ?? '—'}</b>
                          {s.grain && GRAIN_TH[s.grain] ? ` — ${GRAIN_TH[s.grain]}` : ''}
                        </span>
                      </p>
                      {s.error ? (
                        <p className="text-[12px] text-red-700 mt-1">อ่านเจ้านี้ไม่ได้: {s.error} <b>(อ่านไม่ได้ ≠ ไม่มีรายการ)</b></p>
                      ) : (
                        <div className="mt-1.5">
                          <ขอบเขต s={s} />
                          <ตารางแถว rows={Array.isArray(s.rows) ? s.rows : []} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            จอนี้ดูอย่างเดียว — การดึงข้อมูลรอบใหม่ (`mkpfinancesync`) เป็นเส้นที่ <b>เขียนลงฐาน</b>{' '}
            จึงไม่มีปุ่มบนจอโดยตั้งใจ · ท่อประกาศเองว่าเส้นไหนอ่าน เส้นไหนเขียนที่ <code>?endpoints=1</code>
          </p>
        </div>
      )}
    </div>
  )
}
