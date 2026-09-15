'use client'
/* สลิปการชำระเงินของใบขายหนึ่งใบ — **ลอกตำแหน่งจากจอจริงของ ZORT** (ใบ t_mu2p83ql ต่อเนื่องจากสัญญาเส้น gucut-web c496e42)
 *
 * 📍 **ทำไมอยู่ตรงนี้ ไม่ใช่จอรวมสลิป** (CEO ตัดสิน 15 ก.ย. 2569)
 *    อ่าน DOM ของ `/Sell/Details` ใน ZORT แล้ว: ลิงก์ "ดูสลิป" อยู่ใน **แถวของตารางการชำระเงิน**
 *    (`TR.td-payment` ใต้หัวข้อ "การชำระเงิน") ส่วนปุ่ม "แนบไฟล์" อยู่บนหัวจอ (นั่นคือ*อัปโหลด* เราไม่ทำ)
 *    ⇒ จอเราวางสลิปไว้ในการ์ด "การชำระเงิน" ของใบนั้น · **ไม่ทำจอรวมสลิปทั้งร้าน**
 *       เพราะจอรวมคือการเปิดให้ไล่ดูสลิปลูกค้าทุกคนในที่เดียว เสี่ยงกว่า และ ZORT เองก็ไม่มี
 *
 * 🔴 **สามสถานะที่ห้ามปนกัน** (ฝั่งท่อกำชับ · เป็นหัวใจของตัวนี้)
 *    ① กำลังโหลด
 *    ② อ่านที่เก็บไม่ได้ (502 / เน็ตล้ม / 400 เลขที่ใบเพี้ยน) ⇒ **ห้ามเขียนว่า "ใบนี้ไม่มีสลิป"**
 *    ③ ไม่มีในที่เก็บของเรา (`count: 0`) ⇒ เขียนว่าไม่มี**ในที่เก็บของเรา** พร้อม**วันที่**
 *       เพราะ ZORT รับสลิปใหม่ทุกวัน ⇒ "เก็บครบ ณ วันหนึ่ง" ไม่เท่ากับ "ครบตลอดไป"
 *
 * 🔒 **ของลูกค้า** — ตัวไฟล์คือสลิปโอนเงินจริง
 *    · โหลดด้วย `fetch(..., { cache: 'no-store' })` แล้วทำเป็น blob **ไม่ใช้ `<img src>` ตรง ๆ**
 *      เพื่อไม่ให้ภาพสลิปไปนอนอยู่ในแคชรูปของเบราว์เซอร์ (ท่อส่ง `cache-control: private,no-store` มาแล้ว
 *      และท่อกลางของเราส่งต่อหัวนั้นแล้วตั้งแต่ 15 ก.ย. 2569 — แต่ blob ตัดปัญหาได้ตรงกว่า)
 *    · คืน object URL ทุกครั้งที่ออกจากหน้า (`revokeObjectURL`) ไม่งั้นรูปค้างในหน่วยความจำ
 *    · **ไม่มีปุ่มโหลดทั้งหมด** (ฝั่งท่อสั่ง) — เปิดทีละใบเท่านั้น
 *    · ท่อ **ไม่ส่งชื่อไฟล์เดิมจาก ZORT** มาให้ (อาจมีชื่อลูกค้า) ⇒ จอตั้งป้ายเอง "สลิป 1 · 2 · …"
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { thaiDate } from '@/lib/format'

interface SlipFile { fileid: string; kind?: string; bytes?: number; archivedAt?: string }
type Phase = 'loading' | 'ok' | 'unreadable'

/** เวลาที่ท่อส่งมาเป็น UTC (ISO) — แปลงเป็นวันไทยด้วยตัวเดียวกับทั้งระบบ */
function archivedDay(files: SlipFile[]): string {
  const withDate = files.map((f) => f.archivedAt).filter((s): s is string => !!s).sort()
  return withDate.length ? thaiDate(withDate[withDate.length - 1]) : ''
}

function sizeText(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return ''
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

export default function SlipBox({ docno }: { docno?: string | null }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [files, setFiles] = useState<SlipFile[]>([])
  const [why, setWhy] = useState('')
  const [note, setNote] = useState('')
  /** object URL ของแต่ละไฟล์ที่เปิดดูแล้ว · เก็บไว้เพื่อคืนตอนออกจากหน้า */
  const [opened, setOpened] = useState<Record<string, { url: string; type: string }>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [fileErr, setFileErr] = useState<Record<string, string>>({})
  const urls = useRef<string[]>([])

  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current = [] }, [])

  useEffect(() => {
    let dead = false
    const doc = String(docno ?? '').trim()
    if (!doc) { setPhase('unreadable'); setWhy('ใบนี้ไม่มีเลขที่ใบในคลังเงา ⇒ ถามที่เก็บสลิปไม่ได้'); return }
    setPhase('loading'); setFiles([]); setWhy(''); setOpened({}); setFileErr({})
    fetch(`/api/web/core?slips=${encodeURIComponent(doc)}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => null)
        if (dead) return
        /* 🔴 ทุกทางที่ไม่ใช่ 200+ok ⇒ "อ่านไม่ได้" ไม่ใช่ "ไม่มีสลิป"
           (502 ที่ท่อส่ง unknown:true มาด้วย ก็เข้าทางนี้) */
        if (!r.ok || !d || d.ok !== true) {
          setPhase('unreadable')
          setWhy(String(d?.error ?? `ที่เก็บสลิปตอบกลับมาไม่สำเร็จ (HTTP ${r.status})`))
          return
        }
        setFiles(Array.isArray(d.files) ? (d.files as SlipFile[]) : [])
        setNote(typeof d.note === 'string' ? d.note : '')
        setPhase('ok')
      })
      .catch((e) => {
        if (dead) return
        setPhase('unreadable')
        setWhy(String(e instanceof Error ? e.message : e))
      })
    return () => { dead = true }
  }, [docno])

  const openFile = useCallback(async (f: SlipFile) => {
    const doc = String(docno ?? '').trim()
    if (!doc || opened[f.fileid] || busy) return
    setBusy(f.fileid)
    setFileErr((m) => { const n = { ...m }; delete n[f.fileid]; return n })
    try {
      const r = await fetch(`/api/web/core?slip=${encodeURIComponent(doc)}&fileid=${encodeURIComponent(f.fileid)}`,
        { cache: 'no-store' })
      if (!r.ok) {
        /* ท่อตอบ error เป็น JSON ภาษาไทยทุกกรณี (400/404/415/502) ⇒ เอาข้อความของมันมาแสดงตรง ๆ */
        const d = await r.json().catch(() => null)
        setFileErr((m) => ({ ...m, [f.fileid]: String(d?.error ?? `เปิดไฟล์ไม่สำเร็จ (HTTP ${r.status})`) }))
        return
      }
      const type = r.headers.get('content-type') || ''
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      urls.current.push(url)
      setOpened((m) => ({ ...m, [f.fileid]: { url, type } }))
    } catch (e) {
      setFileErr((m) => ({ ...m, [f.fileid]: String(e instanceof Error ? e.message : e) }))
    } finally {
      setBusy(null)
    }
  }, [docno, opened, busy])

  if (phase === 'loading') {
    return <p className="text-[12.5px] text-gray-400 px-4 py-3">กำลังถามที่เก็บสลิปของใบนี้…</p>
  }

  if (phase === 'unreadable') {
    /* 🔴 ห้ามกลายเป็น "ไม่มีสลิป" เด็ดขาด — คนจะไปตามหาสลิปที่มีอยู่แล้วไม่เจอ */
    return (
      <div className="px-4 py-3">
        <p className="text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 leading-relaxed">
          ⚠️ <b>อ่านที่เก็บสลิปของใบนี้ไม่ได้</b> — <b>ยังไม่รู้</b>ว่ามีสลิปหรือไม่
          <br /><span className="text-red-600">{why}</span>
          <br /><span className="text-gray-600">⇒ ไม่ใช่ &ldquo;ใบนี้ไม่มีสลิป&rdquo; · ลองใหม่อีกครั้ง หรือดูที่ ZORT</span>
        </p>
      </div>
    )
  }

  if (files.length === 0) {
    const doc = String(docno ?? '').trim()
    return (
      <div className="px-4 py-3">
        <p className="text-[12.5px] text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 leading-relaxed">
          📭 <b>ไม่มีสลิปของใบนี้ในที่เก็บของเรา</b>
          <br />
          {/* 🔴 วันที่ต้องมี — "เก็บครบ ณ วันหนึ่ง" ไม่เท่ากับ "ครบตลอดไป" */}
          <span className="text-gray-600">
            ที่เก็บของเราเก็บครบ ณ <b>15 ก.ย. 2569</b> · ZORT รับสลิปใหม่ทุกวัน
            {' '}⇒ <b>ไม่ได้แปลว่าใบนี้ไม่มีสลิปใน ZORT</b> (เช่น ลูกค้าเพิ่งแนบวันนี้)
          </span>
          {doc && <><br /><span className="text-gray-400 text-[11.5px]">ถามที่เก็บด้วยเลขที่ใบนี้แล้ว — ได้ 0 ไฟล์</span></>}
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3">
      <p className="text-[12.5px] text-gray-600 mb-2">
        มีสลิปในที่เก็บของเรา <b>{files.length}</b> ไฟล์
        {archivedDay(files) && <> · เก็บเมื่อ <b>{archivedDay(files)}</b></>}
      </p>
      <div className="flex flex-col gap-3">
        {files.map((f, i) => {
          const o = opened[f.fileid]
          const isPdf = (o?.type || '').includes('pdf')
          return (
            <div key={f.fileid} className="border border-gray-200 rounded-md p-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                {/* 🔒 ป้ายของเราเอง — ท่อไม่ส่งชื่อไฟล์เดิมมา (อาจมีชื่อลูกค้า) */}
                <span className="text-[13px] text-gray-800 font-medium">
                  สลิป {i + 1}
                  <span className="text-[11.5px] text-gray-400 font-normal">
                    {f.kind ? ` · ${f.kind}` : ''}{sizeText(f.bytes) ? ` · ${sizeText(f.bytes)}` : ''}
                  </span>
                </span>
                {!o && (
                  <button
                    type="button"
                    onClick={() => void openFile(f)}
                    disabled={busy === f.fileid}
                    className="text-[12.5px] rounded-full border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {busy === f.fileid ? 'กำลังเปิด…' : 'ดูสลิป'}
                  </button>
                )}
              </div>
              {fileErr[f.fileid] && (
                <p className="text-[12px] text-red-700 mt-2 leading-relaxed">
                  ⚠️ {fileErr[f.fileid]}
                  <br /><span className="text-gray-600">⇒ เปิดไฟล์นี้ไม่ได้ — <b>ไม่ได้แปลว่าไม่มีสลิป</b></span>
                </p>
              )}
              {o && !isPdf && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.url} alt={`สลิป ${i + 1}`} className="mt-2 max-w-full rounded border border-gray-200" />
              )}
              {o && isPdf && (
                <p className="text-[12.5px] text-gray-700 mt-2">
                  ไฟล์นี้เป็น PDF —{' '}
                  <a href={o.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">เปิดในแท็บใหม่</a>
                </p>
              )}
            </div>
          )
        })}
      </div>
      {note && <p className="text-[11.5px] text-gray-400 mt-3 leading-relaxed">{note}</p>}
    </div>
  )
}
