'use client'
// ดันสต็อกขึ้นแพลตฟอร์ม — ประวัติ + ตรวจว่าถึงหน้าร้านจริง (8 ก.ย. 2569)
//
// เกิดหลังหมุดแรกของฝั่ง "เขียน": ดัน Lazada สำเร็จ 16/16 (canary จับ E0501 ที่ไม่มีเอกสารบอก)
// โครงคำตอบจาก payload จริงที่ CEO ส่งให้ก่อนเขียนจอ — ห้ามเดาชื่อคีย์:
//   ?stockpushlog=1 → {ok, log:[{at(ISO), platform, fired, pushed, rejected, rows:[{sku,from,to,kind}]}]}
//     log ใหม่สุดอยู่หัว เก็บ 50 รอบ · kind ∈ reopen|up|down|close
//   ?stockpushverify=<skus,comma> → {ok, landed:[sku], notLanded:[{sku, 'ยังต้องดัน':'x→y'}], note}
//
// 🔴 **จอนี้ไม่มีปุ่มยิงจริงโดยตั้งใจ — ห้ามเพิ่มกลับ** (ยืนยันกับท่อ 8 ก.ย. 2569)
//    การยิง stockpushlive = การเขียนของจริงออกนอกระบบ ต้องเป็นการอนุมัติรายครั้งของ
//    เจ้าของร้านผ่าน AI ที่กางแผนสดให้ดูก่อน · ปุ่มบนจอ = ของที่กดง่ายกว่าคิด
//    (วันเดียวกันเพิ่งเจอมือลั่นบนกระดานงานสองรอบ) · จอทำแค่ ดู + verify
//    อยากดันรอบใหม่ → กด 🙋 บนกระดานงานที่ /office (เด้ง Telegram เรียกทีม ไม่ยิงเอง)
//
// ⚠️ log จดเฉพาะแถวที่ fired — แถว not_sent/rejected รายตัวไม่อยู่ใน log
//    (อยู่ในคำตอบตอนยิงเท่านั้น) จอต้องบอกข้อจำกัดนี้ตรง ๆ ห้ามให้คนอ่านเข้าใจว่าเห็นครบ
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox, { isSkip } from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, Pill } from '@/components/zort'
/* serverTimeMs อยู่ใน returns-api (เกิดจากบั๊กโซนเวลาตอนประกบ /returns) — ตัวเดียวกันใช้ทุกจอ */
import { serverTimeMs } from '@/lib/returns-api'

interface PushRow { sku?: string; from?: number; to?: number; kind?: string }
interface PushRound {
  at?: string; platform?: string
  fired?: number; pushed?: number; rejected?: number
  rows?: PushRow[]
}
interface LogResp { ok?: boolean; log?: PushRound[]; error?: string; skip?: string }
interface VerifyResp {
  ok?: boolean; landed?: string[]
  notLanded?: Array<{ sku?: string; 'ยังต้องดัน'?: string }>
  note?: string; error?: string; skip?: string
}

const KIND: Record<string, { text: string; tone: 'blue' | 'green' | 'orange' | 'red' | 'gray' }> = {
  reopen: { text: 'เปิดขายอีกครั้ง', tone: 'blue' },
  up: { text: 'เพิ่ม', tone: 'green' },
  down: { text: 'ลด', tone: 'orange' },
  close: { text: 'ปิดกันขายเกิน', tone: 'red' },
}

const thaiTime = (iso?: string) => {
  const ms = serverTimeMs(iso)
  if (ms === null) return '—'
  const t = new Date(ms + 7 * 3600e3)
  const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${t.getUTCDate()} ${M[t.getUTCMonth()]} ${t.getUTCFullYear() + 543} ${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`
}

export default function StockPushPage() {
  const [log, setLog] = useState<PushRound[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  /* ผล verify ต่อรอบ — คีย์ = at ของรอบ */
  const [verify, setVerify] = useState<Record<string, VerifyResp | 'busy'>>({})

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/web/core?stockpushlog=1')
      const d = (await res.json().catch(() => null)) as LogResp | null
      if (d === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (typeof d.skip === 'string') throw new Error(d.skip)
      if (!res.ok || d.error) throw new Error(d.error || `ท่อตอบ ${res.status}`)
      if (!Array.isArray(d.log)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี log)')
      setLog(d.log)
    } catch (e) { setError(String(e instanceof Error ? e.message : e)); setLog(null) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const runVerify = useCallback(async (round: PushRound) => {
    const key = round.at ?? ''
    const skus = (round.rows ?? []).map((r) => r.sku).filter(Boolean) as string[]
    if (!skus.length) return
    setVerify((v) => ({ ...v, [key]: 'busy' }))
    try {
      const res = await fetch(`/api/web/core?stockpushverify=${encodeURIComponent(skus.join(','))}`)
      const d = (await res.json().catch(() => null)) as VerifyResp | null
      if (d === null) throw new Error(`อ่านคำตอบไม่ออก (HTTP ${res.status})`)
      if (!res.ok || d.error) throw new Error(d.error || `ท่อตอบ ${res.status}`)
      if (!Array.isArray(d.landed) || !Array.isArray(d.notLanded))
        throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ (ไม่มี landed/notLanded)')
      setVerify((v) => ({ ...v, [key]: d }))
    } catch (e) {
      setVerify((v) => ({ ...v, [key]: { error: String(e instanceof Error ? e.message : e) } }))
    }
  }, [])

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="ดันสต็อกขึ้นแพลตฟอร์ม"
        summary={
          <>
            ประวัติการดันสต็อกจากคลังเงาขึ้นหน้าร้านแพลตฟอร์ม + ตรวจว่าถึงจริง
            {' | '}
            <span className="text-gray-400">งานเขียนชิ้นแรกที่ทำแทน ZORT — Lazada เปิดใช้แล้ว 8 ก.ย. 2569</span>
          </>
        }
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      {/* สถานะรายแพลตฟอร์ม — Shopee/TikTok ยัง skip ตรง ๆ บอกเหตุผลพร้อมวันที่ ห้ามแกล้งเขียว */}
      <div className="flex flex-wrap gap-2 mb-4 text-[12px]">
        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-3 py-1">✅ Lazada — ยิงจริงแล้ว (16/16 · 8 ก.ย. 2569)</span>
        <span className="bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-3 py-1" title="เส้นยิงตอบ skip ตรง ๆ — ไม่ใช่ของพัง">⏳ Shopee — รอ Go-Live (เส้นตอบ skip)</span>
        <span className="bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-3 py-1" title="เส้นยิงตอบ skip ตรง ๆ — ไม่ใช่ของพัง">⏳ TikTok — รอตารางแปลง id (เส้นตอบ skip)</span>
      </div>

      {/* 🔴 ไม่มีปุ่มยิงจริง — บอกทางที่ถูกแทน */}
      <p className="text-[12px] text-blue-900 bg-blue-50 border border-blue-100 rounded-md px-3.5 py-2 mb-4 leading-relaxed">
        จอนี้<b>ดูอย่างเดียวโดยตั้งใจ</b> — การดันรอบใหม่เป็นการอนุมัติรายครั้งของเจ้าของร้าน
        ผ่าน AI ที่กางแผนสดให้ดูก่อน ไม่ใช่ปุ่มบนจอ · อยากดันรอบใหม่: กด{' '}
        <a href="/office" className="underline font-semibold">🙋 บนกระดานงานที่ห้องทำงาน AI</a>
      </p>

      {error && <ErrorBox title={isSkip(error) ? 'ยังทำงานส่วนนี้ต่อไม่ได้' : 'ดึงประวัติไม่ได้'}>{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && !error && log && (
        log.length === 0 ? (
          <p className="text-[13px] text-gray-400 bg-white border border-gray-200 rounded-md px-4 py-8 text-center">
            ยังไม่เคยมีการดันสต็อก — ประวัติรอบแรกจะโผล่ที่นี่
          </p>
        ) : (
          <div className="space-y-3">
            {log.map((round) => {
              const key = round.at ?? ''
              const v = verify[key]
              const bad = (round.rejected ?? 0) > 0
              return (
                <div key={key} className={`bg-white border rounded-md p-4 ${bad ? 'border-red-300' : 'border-gray-200'}`}>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[13px] font-semibold text-gray-900">{thaiTime(round.at)}</span>
                    <Pill tone="blue">{round.platform ?? '?'}</Pill>
                    <span className="text-[12px] text-gray-500">
                      ยิง {round.fired ?? '?'} · สำเร็จ {round.pushed ?? '?'}
                    </span>
                    {bad && <Pill tone="red">ถูกปฏิเสธ {round.rejected}</Pill>}
                    <button onClick={() => runVerify(round)} disabled={v === 'busy' || !(round.rows ?? []).length}
                      className="ml-auto text-[12px] text-blue-600 hover:underline disabled:opacity-40">
                      {v === 'busy' ? 'กำลังเทียบสด…' : 'ตรวจว่าถึงหน้าร้านจริง'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(round.rows ?? []).map((r, i) => {
                      const k = KIND[r.kind ?? ''] ?? { text: r.kind ?? '?', tone: 'gray' as const }
                      return (
                        <span key={r.sku ?? i} className="text-[11.5px] border border-gray-200 rounded px-2 py-0.5 bg-gray-50">
                          <span className="font-mono">{r.sku ?? '—'}</span>{' '}
                          <span className="text-gray-400">{r.from ?? '?'}→{r.to ?? '?'}</span>{' '}
                          <Pill tone={k.tone}>{k.text}</Pill>
                        </span>
                      )
                    })}
                  </div>
                  {bad && (
                    <p className="text-[11.5px] text-red-700 mt-2">
                      ⚠️ รอบนี้มีแถวถูกปฏิเสธ {round.rejected} แถว — รายละเอียดรายตัว<b>ไม่อยู่ใน log</b>
                      (จดเฉพาะแถวที่ยิงติด) ดูจากบันทึกตอนยิงหรือถามฝั่งท่อ
                    </p>
                  )}

                  {v && v !== 'busy' && (
                    v.error ? (
                      <p className="text-[12px] text-red-700 mt-2">ตรวจไม่สำเร็จ: {v.error} (ตรวจไม่ได้ ≠ ไม่ถึง — ลองใหม่ได้)</p>
                    ) : (
                      <div className="text-[12px] mt-2 border-t border-gray-100 pt-2">
                        <span className="text-emerald-700">✅ ถึงหน้าร้านแล้ว {(v.landed ?? []).length} ตัว</span>
                        {(v.notLanded ?? []).length > 0 && (
                          <span className="block text-red-700 mt-0.5">
                            🔴 ยังไม่ถึง {(v.notLanded ?? []).length} ตัว:{' '}
                            {(v.notLanded ?? []).map((n) => `${n.sku ?? '?'} (ยังต้องดัน ${n['ยังต้องดัน'] ?? '?'})`).join(' · ')}
                          </span>
                        )}
                        {v.note && <span className="block text-gray-400 mt-0.5">{v.note}</span>}
                      </div>
                    )
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      <p className="text-[11.5px] text-gray-400 mt-4 leading-relaxed">
        เวลาเป็นเวลาไทย (แปลงจากนาฬิกาเซิร์ฟเวอร์) · log เก็บ 50 รอบล่าสุด และ<b>จดเฉพาะแถวที่ยิง</b> —
        แถวที่ไม่ถูกส่ง/ถูกปฏิเสธรายตัวอยู่ในคำตอบตอนยิงเท่านั้น ·
        ปุ่ม &ldquo;ตรวจว่าถึงหน้าร้านจริง&rdquo; เทียบกับสต็อกสดบนแพลตฟอร์ม ไม่ใช่กับ log
        (ตาข่ายต้องเทียบกับต้นทางนอกระบบ — กฎ mirror-needs-outside-check)
      </p>
    </div>
  )
}
