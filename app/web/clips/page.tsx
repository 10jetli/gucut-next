'use client'
import { fmtNum } from '@/lib/format'
// สถิติคลิป — ฉบับเนื้อเดียว · ท่อ /api/web/clip-stats
import { useEffect, useState } from 'react'

interface Row { id: string; views: number; half: number; full: number; likes: number; comments: number; dur?: number }
const POSTER = (id: string) => `https://video.gucut.com/v2/${id}/poster.jpg`
const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0)

export default function WebClipStatsPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState('')
  /* 🔴 **B10 (แก้ 4 ต.ค. 2569)** — ด่าน `r.ok` ข้างล่างกันได้แค่ชั้นที่มันมองเห็น
     เคสของ B10 คือ Blobs อ่านรายชื่อคีย์ไม่ได้ แล้วท่อตอบ **200 พร้อม rows ว่าง**
     (ตั้งใจ — แถวที่อ่านได้ก็ยังมีประโยชน์) ⇒ `r.ok` เป็นจริง ⇒ จอเดิมขึ้น
     **"ยังไม่มีคลิปที่มีคนดู"** ซึ่งกลับหัวความจริงเหมือนเคสปี 7 ก.ย. แต่คนละชั้น
     🔑 สามสถานะต้องเดินมาถึงจอ **ในเนื้อ JSON** (ช่องที่มีเสมอแม้ค่าปกติ)
        null = ท่อรุ่นเก่ายังไม่ส่งช่องนี้ · [] = อ่านได้ครบ */
  const [ไม่รู้, setไม่รู้] = useState<string[] | null>(null)
  const [หัวใจไม่รู้, setหัวใจไม่รู้] = useState(false)

  useEffect(() => {
    /* 🔴 ท่อตอบ 500 พร้อม JSON ⇒ .json() ไม่ throw ⇒ catch ไม่ทำงาน
       ของเดิมจึงได้ rows = [] เงียบ ๆ แล้วจอเขียนว่า "0 คลิปที่มีคนดู · ยังไม่มีคลิปที่มีคนดู"
       ⇒ อ่านเป็น "คลิปเราไม่มีคนดูเลย" ซึ่งกลับหัวความจริง (เจอด้วยท่อปลอม 7 ก.ย. 2569) */
    fetch('/api/web/clip-stats')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok || d?.error) throw new Error(String(d?.error ?? `HTTP ${r.status}`))
        if (!('rows' in d)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ')
        return d
      })
      .then((d) => {
        setRows(Array.isArray(d.rows) ? d.rows : [])
        setไม่รู้(Array.isArray(d.unreadable) ? d.unreadable : null)
        setหัวใจไม่รู้(d.countsUnknown === true)
      })
      .catch(() => { setErr('โหลดสถิติไม่สำเร็จ — ยังไม่รู้ยอดคนดู (ไม่ได้แปลว่าไม่มีคนดู)'); setRows([]) })
  }, [])

  // ⚠️ แถวที่ไม่มี views ต้องไม่ทำให้ผลรวมกลายเป็น NaN ทั้งคอลัมน์
  const totalViews = (rows ?? []).reduce((a, r) => a + (typeof r.views === 'number' ? r.views : 0), 0)

  // 🔴 B10: ทั้งสามช่องพังแยกกันได้ ⇒ ต้องรู้เป็นรายช่อง
  const วิวไม่รู้ = !!ไม่รู้?.includes('views')
  const ครึ่งไม่รู้ = !!ไม่รู้?.includes('half')
  const จบไม่รู้ = !!ไม่รู้?.includes('full')
  const มีของอ่านไม่ได้ = (ไม่รู้?.length ?? 0) > 0 || หัวใจไม่รู้
  const ช่องที่อ่านไม่ได้ = [
    วิวไม่รู้ && 'คนดู', ครึ่งไม่รู้ && 'ดูถึงครึ่ง', จบไม่รู้ && 'ดูจนจบ',
    หัวใจไม่รู้ && 'หัวใจ/คอมเมนต์',
  ].filter(Boolean).join(' · ')
  // ไม่รู้ ⇒ ขีด · 0 เป็นคำยืนยันที่ผิดได้
  const เลขหรือขีด = (n: number, ไม่รู้ช่องนี้: boolean) => (ไม่รู้ช่องนี้ ? '—' : fmtNum(n))

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
        <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">สถิติคลิป</h1>
        {/* ⚠️ โหลดไม่สำเร็จ ห้ามสรุปยอดเป็นศูนย์ — บรรทัดนี้อยู่เหนือกล่องแดง คนอ่านก่อน */}
        {/* 🔴 B10: อ่านช่องคนดูไม่ได้ ⇒ ห้ามสรุปทั้งบรรทัดนี้ เพราะทั้งสองเลขมาจากช่องนั้น */}
        {rows && !err && !วิวไม่รู้ && <p className="text-[12px] text-gray-400 mt-0.5">{rows.length} คลิปที่มีคนดู · รวม {totalViews.toLocaleString('th-TH')} คนดู</p>}
        {rows && !err && วิวไม่รู้ && <p className="text-[12px] text-gray-400 mt-0.5">ยังไม่รู้ยอดคนดูรอบนี้ — จำนวนคลิปที่เห็นอาจไม่ครบ</p>}
      </div>
      {err && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">{err}</p>}

      {/* 🔴 B10: ท่อตอบ 200 แต่บอกมาในเนื้อว่าอ่านบางช่องไม่ได้ — ต้องเขียนบนจอ
          ⚠️ อยู่เหนือตาราง เพราะคนอ่านเลขก่อนอ่านเชิงอรรถ */}
      {มีของอ่านไม่ได้ && (
        <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800">
          ⚠️ <b>อ่านข้อมูลบางช่องไม่ได้</b> ({ช่องที่อ่านไม่ได้}) — ช่องเหล่านั้นขึ้นขีดไว้{' '}
          <b>ไม่ได้แปลว่าเป็นศูนย์</b> และจำนวนคลิปที่เห็นอาจไม่ครบ ลองโหลดหน้าใหม่อีกครั้งในอีกสักครู่
        </p>
      )}

      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_90px_90px_90px_80px_80px] items-center px-5 py-2 text-[10.5px] font-bold uppercase tracking-wider text-gray-300 border-b border-gray-50">
          <span>คลิป</span><span className="text-right">คนดู</span><span className="text-right">ดูถึงครึ่ง</span>
          <span className="text-right">ดูจนจบ</span><span className="text-right">หัวใจ</span><span className="text-right">คอมเมนต์</span>
        </div>
        {rows === null ? (
          <div className="p-4 space-y-3 animate-pulse">{[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-gray-50" />)}</div>
        ) : rows.length === 0 ? (
          /* 🔴 B10: ของเดิมมีแค่สองทาง (err / ไม่มีคลิป) ⇒ เคส "ท่อตอบ 200 แต่ว่างเพราะอ่านไม่ได้"
             ตกลงมาที่ 'ยังไม่มีคลิปที่มีคนดู' ซึ่งเป็นคำยืนยันที่ผิด */
          <p className="py-14 text-center text-[13px] text-gray-400">
            {err
              ? 'ยังดูไม่ได้ — โหลดสถิติไม่สำเร็จ'
              : มีของอ่านไม่ได้
                ? 'ยังไม่รู้ — อ่านข้อมูลไม่ได้รอบนี้ (ไม่ได้แปลว่าไม่มีคนดู)'
                : 'ยังไม่มีคลิปที่มีคนดู'}
          </p>
        ) : rows.map((r, i) => (
          <div key={r.id} className="md:grid md:grid-cols-[1fr_90px_90px_90px_80px_80px] md:items-center flex flex-wrap items-center gap-2 px-4 md:px-5 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors">
            <span className="flex items-center gap-3 min-w-0">
              <span className="text-[11px] font-black text-gray-300 w-5 text-right tabular-nums shrink-0">{i + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={POSTER(r.id)} alt="" className="w-9 h-14 rounded-lg object-cover bg-gray-100 shrink-0" loading="lazy" />
              <span className="text-[11.5px] text-gray-400 truncate" dir="ltr">{String(r.id ?? '').slice(0, 12)}…</span>
            </span>
            <span className="md:text-right text-[13px] font-black text-gray-900 tabular-nums max-md:ml-auto">{เลขหรือขีด(r.views, วิวไม่รู้)}</span>
            {/* สัดส่วนเชื่อถือได้เฉพาะตอนรู้ทั้งตัวตั้งและตัวหาร */}
            <span className="md:text-right text-[12px] text-gray-500 tabular-nums">{ครึ่งไม่รู้ || วิวไม่รู้ ? '—' : `${pct(r.half, r.views)}%`}</span>
            <span className="md:text-right text-[12px] text-gray-500 tabular-nums">{จบไม่รู้ || วิวไม่รู้ ? '—' : `${pct(r.full, r.views)}%`}</span>
            <span className="md:text-right text-[12px] text-rose-500 tabular-nums">{เลขหรือขีด(r.likes, หัวใจไม่รู้)}</span>
            <span className="md:text-right text-[12px] text-gray-500 tabular-nums">{เลขหรือขีด(r.comments, หัวใจไม่รู้)}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-[11px] text-gray-300">ชุดเดียวกับ gucut.com/admin/clips/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง</p>
    </div>
  )
}
