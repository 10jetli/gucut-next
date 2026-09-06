'use client'
// ตรวจว่า "คำกล่าวอ้างเรื่อง ZORT ที่เขียนไว้ในโค้ด ยังจริงอยู่ไหม"
//
// นี่คือ **ชั้นที่สาม** ของตาข่ายกันข้อความเท็จ (ฝั่งท่อทำเส้นให้ 6 ก.ย. 2569)
//   ① grep — ตาข่ายอัตโนมัติ ใช้ได้ตอนมีชื่อให้ค้น
//   ② กฎตอนคิด "ความรู้ใหม่ 1 ก้อน = ไล่ล่าข้อความเก่าที่มันทำให้เป็นเท็จ"
//   ③ **จอนี้ — ยิงของจริงไปถาม ZORT ว่าโลกข้างนอกยังเป็นอย่างที่เราเขียนไว้ไหม**
//      สองชั้นแรกตรวจได้แค่ "เราเขียนอะไรไว้" · ชั้นนี้ตรวจว่า "มันยังจริงไหม"
//
// 🔴 **จอนี้ไม่มีคำว่า "ปกติ" ถ้าตัวควบคุมไม่ผ่าน**
//    `inconclusive` = ยิง ZORT ไม่ได้รอบนี้ ⇒ ผลทั้งชุดแปลไม่ได้
//    ⚠️ **ห้ามแสดงเป็นเขียวหรือ "ไม่พบปัญหา" เด็ดขาด** — "ตรวจไม่ได้" กับ "ตรวจแล้วไม่เจอ"
//       คนละเรื่อง และการยุบรวมคือรากของบั๊กที่ไล่กันมาทั้งวัน
//
// 🔴 **`unknown` (ยิงไม่ถึงบางเส้น) ต้องขึ้นจอเสมอ ห้ามกลืน**
//    เส้นที่ยิงไม่ถึงคือเส้นที่ **ยังไม่รู้** ไม่ใช่เส้นที่ผ่าน
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, thaiDate, thaiHm, EndpointMissing } from '@/components/zort'
import { coreJson } from '@/lib/api-shape'

interface Claim { what?: string; endpoint?: string; at?: string }
interface Resp {
  ok?: boolean
  inconclusive?: boolean
  why?: string
  controls?: Record<string, string>
  checkedAt?: string
  claimsNowFalse?: Claim[]
  capabilitiesGone?: Claim[]
  unknown?: string[]
  note?: string
  error?: string
}

export default function ZortClaimsPage() {
  const [d, setD] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notDeployed, setNotDeployed] = useState(false)
  /** ท่อรุ่นใหม่พอจะตัดสินได้ไหม (มีหัว x-core-build) — แยก 'ยังไม่ deploy' ออกจาก 'เส้นหาย' */
  const [known, setKnown] = useState(false)

  const run = useCallback(async () => {
    setLoading(true); setError(''); setNotDeployed(false)
    try {
      const got = await coreJson<Resp>('/api/web/core?zortclaims=1', ['claimsNowFalse', 'inconclusive', 'capabilitiesGone'])
      setKnown(got.known)
      /* 🔴 อ่าน error จาก **คำตอบดิบ** ไม่ใช่จากตัวที่กรองรูปแล้ว
         คำตอบที่ล้มเหลวไม่มีคีย์ประจำตัวของเส้นนี้ (มีแต่ error) ⇒ ถ้าดูแต่ตัวกรอง
         จอจะขึ้นว่า "ยังไม่ขึ้นเว็บ" ทั้งที่ความจริงคือ "ขึ้นแล้วแต่ล้มเหลว"
         ⚠️ ฝั่งท่อเปลี่ยนสัญญา 6 ก.ย. 2569: เส้นที่ล้มเหลวคืน ok:false + error
            (เดิมคืน ok:true เสมอแม้ล้มเหลว) ⇒ ข้อความจริงมาถึงจอได้แล้ว ห้ามกลืนทิ้ง */
      const rawErr = (got.raw as { error?: string } | null)?.error
      if (rawErr) throw new Error(rawErr)
      const r = got.data
      /* 🔴 พิสูจน์ต้นทางก่อนตีความ — ใช้หัว x-core-build เป็นหลัก (ดู lib/api-shape.ts)
         แยก "ท่อยังไม่ deploy" ออกจาก "ท่อใหม่แล้วแต่เส้นหาย" ให้ขาด */
      if (!got.ok || !r) { setNotDeployed(true); setD(null); return }
      setD(r)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e)); setD(null)
    } finally { setLoading(false) }
  }, [])

  /* ⚠️ **ไม่ยิงเองตอนเปิดหน้า** — กฎเจ้าของร้าน "หน้าสถานะระบบห้ามเช็คอัตโนมัติ ต้องกดเอง"
     และตัวนี้ยิง ZORT หลายสิบครั้งต่อรอบ ⇒ เปิดหน้าทิ้งไว้ = ยิงฟรีทั้งวัน */
  useEffect(() => { /* ตั้งใจไม่ยิงอัตโนมัติ */ }, [])

  const broke = Array.isArray(d?.claimsNowFalse) ? d!.claimsNowFalse! : []
  const gone = Array.isArray(d?.capabilitiesGone) ? d!.capabilitiesGone! : []
  const unknown = Array.isArray(d?.unknown) ? d!.unknown! : []

  return (
    <div className="p-4 md:p-6 max-w-[900px]">
      <PageHead
        title="คำกล่าวอ้างเรื่อง ZORT ยังจริงอยู่ไหม"
        summary={
          <>
            ยิงของจริงไปเทียบกับสิ่งที่เขียนไว้ในโค้ด
            {' | '}
            <span className="text-gray-400">กดเอง — ไม่ยิงอัตโนมัติ (ยิง ZORT หลายสิบครั้งต่อรอบ)</span>
          </>
        }
        actions={<BtnGhost onClick={run} disabled={loading}>{loading ? 'กำลังยิง…' : 'ตรวจเดี๋ยวนี้'}</BtnGhost>}
      />

      <div className="text-[12.5px] text-blue-900 bg-blue-50 border border-blue-100 rounded-md px-3.5 py-2.5 mb-4 leading-relaxed">
        ℹ️ วันเดียว (6 ก.ย. 2569) เจอข้อความในโค้ดที่<b>เคยจริงแล้วกลายเป็นเท็จ</b> หลายจุด —
        ทุกอันเขียนละเอียดมีเหตุผลประกอบ <b>ซึ่งคือสิ่งที่ทำให้มันอันตราย</b> ·
        จอนี้มีไว้ถามโลกข้างนอกว่า<b>ยังเป็นอย่างที่เราเขียนไว้ไหม</b> ·
        ดูรายการคำกล่าวอ้างทั้งหมดที่{' '}
        <Link href="/core/zort-noapi" className="text-blue-600 hover:underline">ZORT เปิดให้ทำอะไรผ่าน API</Link>
      </div>

      {error && <ErrorBox title="ยิงตรวจไม่สำเร็จ">{error}</ErrorBox>}
      {loading && <LoadingState />}

      {!loading && notDeployed && (
        <EndpointMissing known={known} what="ตรวจคำกล่าวอ้าง"
          effect="ไม่ได้แปลว่าไม่มีปัญหา — แปลว่ายังตรวจไม่ได้" />
      )}

      {!loading && !error && d?.inconclusive && (
        /* 🔴 กล่องนี้ต้องกินทั้งจอ ห้ามมีอะไรที่ดูเหมือน "ผ่าน" อยู่ข้าง ๆ */
        <div className="text-[13px] text-amber-900 bg-amber-50 border-2 border-amber-400 rounded-md px-4 py-3 leading-relaxed">
          ⚠️ <b>ตรวจไม่ได้รอบนี้ — ผลทั้งชุดแปลไม่ได้</b>
          <p className="mt-1.5">{d.why}</p>
          {d.controls && (
            <p className="mt-1.5 text-[12px] font-mono text-amber-800">
              ตัวควบคุม: {Object.entries(d.controls).map(([k, v]) => `${k} → ${v}`).join(' · ')}
            </p>
          )}
          <p className="mt-2 text-[12.5px]">
            <b>&ldquo;ตรวจไม่ได้&rdquo; ไม่เท่ากับ &ldquo;ตรวจแล้วไม่เจอปัญหา&rdquo;</b> —
            ลองกดใหม่อีกครั้ง ถ้ายังเหมือนเดิมแปลว่ายิง ZORT ไม่ถึงจริง ๆ
          </p>
        </div>
      )}

      {!loading && !error && d && !d.inconclusive && (
        <>
          <div className={`text-[13px] rounded-md px-4 py-3 mb-3 leading-relaxed border ${
            broke.length || gone.length
              ? 'text-red-900 bg-red-50 border-red-300'
              : 'text-emerald-900 bg-emerald-50 border-emerald-300'
          }`}>
            {broke.length || gone.length
              ? <><b>เจอข้อความที่ไม่ตรงกับความจริงแล้ว {broke.length + gone.length} จุด</b> — ต้องไปแก้ในโค้ด
                {' '}<b>ไม่ใช่แค่รับทราบ</b> และต้องไล่หาจอที่พิมพ์เหตุผลนั้นไว้ด้วย</>
              : <><b>คำกล่าวอ้างที่ตรวจได้ ยังตรงกับความจริงทั้งหมด</b>
                {' '}<span className="text-emerald-800">(ตรวจเฉพาะที่มีชื่อเส้นเขียนไว้ในโค้ด)</span></>}
            {d.checkedAt && (
              <span className="block text-[11.5px] mt-1 opacity-80">
                ตรวจเมื่อ {thaiDate(d.checkedAt.slice(0, 10))} {thaiHm(d.checkedAt)} น. (เวลาไทย)
              </span>
            )}
          </div>

          {broke.length > 0 && (
            <div className="mb-3">
              <p className="text-[14px] font-semibold text-gray-800 mb-1.5">
                เคยเขียนว่า &ldquo;ไม่มี&rdquo; แต่ตอนนี้มีแล้ว ({broke.length})
              </p>
              <p className="text-[12px] text-gray-600 mb-2">
                🔴 <b>ข้อความในโค้ดกลายเป็นเท็จ</b> — และมันไม่พังอะไรเลย จึงไม่มีอะไรฟ้อง
                ถ้าไม่มีจอนี้
              </p>
              {broke.map((c, i) => (
                <div key={i} className="bg-white border border-red-200 rounded-md p-3 mb-2">
                  <p className="text-[13.5px] font-medium text-gray-900">{c.what}</p>
                  <p className="text-[12px] text-gray-600 font-mono mt-0.5">{c.endpoint}</p>
                  {c.at && <p className="text-[11.5px] text-gray-400 mt-0.5">เขียนไว้เมื่อ {thaiDate(c.at)}</p>}
                </div>
              ))}
            </div>
          )}

          {gone.length > 0 && (
            <div className="mb-3">
              <p className="text-[14px] font-semibold text-gray-800 mb-1.5">
                เคยเขียนว่า &ldquo;มี&rdquo; แต่ตอนนี้หายไป ({gone.length})
              </p>
              <p className="text-[12px] text-gray-600 mb-2">
                ⚠️ ของที่เราวางแผนจะใช้หายไป — <b>ต้องรู้ก่อนเริ่มทำ</b> ไม่ใช่รู้ตอนต่อท่อแล้วพัง
              </p>
              {gone.map((c, i) => (
                <div key={i} className="bg-white border border-amber-200 rounded-md p-3 mb-2">
                  <p className="text-[13.5px] font-medium text-gray-900">{c.what}</p>
                  <p className="text-[12px] text-gray-600 font-mono mt-0.5">{c.endpoint}</p>
                  {c.at && <p className="text-[11.5px] text-gray-400 mt-0.5">เขียนไว้เมื่อ {thaiDate(c.at)}</p>}
                </div>
              ))}
            </div>
          )}

          {unknown.length > 0 && (
            /* 🔴 ต้องขึ้นเสมอ — เส้นที่ยิงไม่ถึงคือเส้นที่ "ยังไม่รู้" ไม่ใช่เส้นที่ผ่าน
               กลืนทิ้งเมื่อไหร่ จอจะบอกว่าตรวจครบทั้งที่ตรวจไม่ครบ */
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3.5">
              <p className="text-[13px] font-semibold text-gray-700 mb-1">
                ยิงไม่ถึง {unknown.length} เส้น — <b>ยังไม่รู้ผล ไม่ใช่ผ่าน</b>
              </p>
              <p className="text-[11.5px] text-gray-500 font-mono break-words">{unknown.join(' · ')}</p>
            </div>
          )}
        </>
      )}

      {!loading && !d && !notDeployed && !error && (
        <div className="bg-white border border-gray-200 rounded-md px-4 py-6 text-center">
          <p className="text-[13.5px] text-gray-600">กด <b>ตรวจเดี๋ยวนี้</b> เพื่อยิงของจริงไปเทียบ</p>
          <p className="text-[12px] text-gray-400 mt-1">
            ใช้เวลาหลายวินาที เพราะยิงทีละเส้นจริง ๆ · ไม่สร้างข้อมูลอะไรใน ZORT
          </p>
        </div>
      )}
    </div>
  )
}
