'use client'
// ── "ช่องทางที่ปิดไปแล้ว ยังปนอยู่ในกองรอจัดส่ง" — แยกให้เห็น ห้ามกรองทิ้งเงียบ ──
//
// ท่านประธานสั่ง 13 ก.ย. 2569 (งานกระดาน t_mtxss3pf): ใบของร้านที่ปิดแล้ว **จะไม่มีวันถูกส่ง**
// แต่มันพองอยู่ในกอง "รอจัดส่ง" ⇒ ต้องแยกโชว์ · 🚫 **ห้ามกรองทิ้ง** ถ้าวันหนึ่งมีใบใหม่
// ของร้านที่ปิดแล้วโผล่มา แปลว่ามีอะไรผิดปกติหนัก — กรองทิ้งไปแล้วจะไม่มีใครเห็น
//
// 🔑 **ท่านประธานตัดสินแล้ว: รู้ว่าช่องทางไหนปิด โดยคิดจากหลักฐาน ไม่เก็บรายชื่อร้านปิดในโค้ด**
//    รายชื่อที่ต้องมีคนมาดูแล จะลืมอัปเดตวันที่ร้านใหม่ปิด แล้วระบบจะเงียบโดยไม่มีอะไรฟ้อง
//    ⇒ ใช้เกณฑ์ของท่อ: `pending=1` ส่ง `channels[].alive` + `dormantCutoff` มาให้แล้ว
//       (เกณฑ์ของท่อ: ไม่มีใบใหม่ตั้งแต่วันตัด = เงียบ — ตัดสินจากวันที่ของใบล่าสุด ไม่ใช่จากชื่อ)
//    🔴 **จอห้ามคิดเกณฑ์เอง** — กฎเดียวกับจอแพ็กของ ("ท่อคิดให้ ⇒ จอห้ามคิดเอง")
//
// 🔴 **ทุกตัวเลขในนี้เป็นยอดทั้งช่วง ไม่ใช่ยอดที่นับจากแถวในหน้าที่เปิดอยู่**
//    ได้มาจาก `list=orders&channel=<ช่องทาง>&limit=1` แล้วอ่าน `shipStatusGroups`
//    ซึ่งท่อประกาศขอบเขตเอง (`shipStatusScope` = ทั้งช่วงที่กรองอยู่)
//    ⇒ ห้ามเปลี่ยนไปนับจาก rows เด็ดขาด นั่นคือโรค "เลขทั้งกอง วางคู่กับแถวหน้าเดียว"
//       ซึ่งเป็นโรคที่งานใบนี้เกิดมาแก้พอดี
//
// ⚠️ **ไม่ยิงอะไรเลยจนกว่าคนจะกด** — ต้องยิง 2 + (จำนวนช่องทางที่เงียบ) คำขอ
//    จอนี้เปิดบ่อยและส่วนใหญ่ไม่ได้มาดูเรื่องนี้ ⇒ จ่ายค่าเรียกเฉพาะตอนมีคนอยากรู้
import { useState } from 'react'
import { BtnGhost } from '@/components/zort'

interface ChannelRow { ch: string; lastOrder: string | null; orders: number; alive: boolean }

interface Found {
  cutoff: string | null
  /** ช่องทางที่ท่อบอกว่าเงียบ + จำนวนใบ "รอจัดส่ง" ในช่วงที่กำลังดู */
  rows: { ch: string; lastOrder: string | null; waiting: number | null; err?: string }[]
  /** ช่องทางที่ถามยอดไม่สำเร็จ — ต้องนับแยก ห้ามรวมกับ 0 */
  failed: number
}

const NUM = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const fmt = (n: number) => n.toLocaleString('th-TH')

async function getJson(url: string) {
  const r = await fetch(url, { cache: 'no-store' })
  const d = await r.json().catch(() => null)
  /* ⚠️ ท่อตอบ 500 พร้อม JSON ได้ ⇒ `.json()` ไม่ throw · ต้องเช็ค res.ok + d.error เอง */
  if (!r.ok || d?.error) throw new Error(d?.error ?? `HTTP ${r.status}`)
  return d
}

export default function DormantInShipPile({ from, to }: { from: string; to: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const [found, setFound] = useState<Found | null>(null)

  async function check() {
    setState('loading')
    setMsg('')
    try {
      /* ① ถามท่อว่าช่องทางไหนเงียบ — ถามทั้งสองร้าน
         🔴 `store=all` ใช้ไม่ได้: ท่อไม่รู้จักค่านี้แล้ว **ตกเงียบกลับไปเป็น z1**
            (พิสูจน์แล้ว 13 ก.ย. 2569 · แจ้งฝั่งท่อไว้ในกระดานแล้ว t_mtzwnua2)
            ⇒ ถามทีละร้านแล้วรวมเอง · ร้านที่ ZAMA อยู่คือ z2 ถ้าถามแต่ z1 จะไม่เจอเลย */
      const [a, b] = await Promise.all([
        getJson('/api/web/core?pending=1'),
        getJson('/api/web/core?pending=1&store=z2'),
      ])
      const cutoff: string | null = a?.dormantCutoff ?? b?.dormantCutoff ?? null
      const all: ChannelRow[] = [...(a?.channels ?? []), ...(b?.channels ?? [])]
      /* ช่องทางชื่อซ้ำข้ามร้านได้ — ยุบด้วยชื่อ แล้วถือว่า "ยังขายอยู่" ถ้าร้านใดร้านหนึ่งยังขาย */
      const byName = new Map<string, ChannelRow>()
      for (const c of all) {
        const prev = byName.get(c.ch)
        if (!prev) byName.set(c.ch, c)
        else byName.set(c.ch, { ...prev, alive: prev.alive || c.alive, lastOrder: (c.lastOrder ?? '') > (prev.lastOrder ?? '') ? c.lastOrder : prev.lastOrder })
      }
      const dormant = Array.from(byName.values()).filter((c) => c.alive === false)

      /* ② ถามยอด "รอจัดส่ง" ของแต่ละช่องทางที่เงียบ — ยอดทั้งช่วง ไม่ใช่จากแถว
         ⚠️ ส่ง cancelled=1 ด้วยเหตุผลเดียวกับจอหลัก (ค่าเริ่มต้นของท่อตัดใบยกเลิกทิ้ง) */
      const rows = await Promise.all(dormant.map(async (c) => {
        const qs = new URLSearchParams({ list: 'orders', from, to, limit: '1', cancelled: '1', channel: c.ch })
        try {
          const d = await getJson(`/api/web/core?${qs}`)
          const g = (d?.shipStatusGroups ?? []).find((x: { group?: string }) => x?.group === 'waiting_ship')
          return { ch: c.ch, lastOrder: c.lastOrder, waiting: NUM(g?.count) }
        } catch (e) {
          /* 🔴 ถามไม่สำเร็จ ≠ ไม่มีใบ — ห้ามคืน 0 (จะกลายเป็น "ไม่มีปัญหา" ทั้งที่ยังไม่รู้) */
          return { ch: c.ch, lastOrder: c.lastOrder, waiting: null, err: String(e instanceof Error ? e.message : e) }
        }
      }))
      rows.sort((x, y) => (y.waiting ?? -1) - (x.waiting ?? -1))
      setFound({ cutoff, rows, failed: rows.filter((r) => r.waiting === null).length })
      setState('done')
    } catch (e) {
      setMsg(String(e instanceof Error ? e.message : e))
      setState('error')
    }
  }

  if (state === 'idle') {
    return (
      <p className="text-[12px] text-gray-500 mb-3">
        กอง <b>รอจัดส่ง</b> อาจมีใบของช่องทางที่ปิดไปแล้วปนอยู่ (ใบพวกนี้จะไม่มีวันถูกส่ง){' '}
        <BtnGhost onClick={check}>ตรวจช่องทางที่ปิดแล้ว</BtnGhost>
      </p>
    )
  }
  if (state === 'loading') return <p className="text-[12px] text-gray-500 mb-3">กำลังถามท่อว่าช่องทางไหนเงียบ…</p>
  if (state === 'error') {
    return (
      <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
        ⚠️ ตรวจช่องทางที่ปิดแล้วไม่สำเร็จ: {msg} — <b>ไม่ได้แปลว่าไม่มี</b> แปลว่ายังไม่รู้{' '}
        <BtnGhost onClick={check}>ลองใหม่</BtnGhost>
      </p>
    )
  }

  const rows = found?.rows ?? []
  /* ⚠️ ผลรวมนับเฉพาะตัวที่ถามสำเร็จ — ตัวที่ถามไม่ได้ต้องประกาศแยก ไม่ใช่กลืนเป็น 0 */
  const sum = rows.reduce((a, r) => a + (r.waiting ?? 0), 0)
  const withOrders = rows.filter((r) => (r.waiting ?? 0) > 0)

  return (
    <div className="text-[12.5px] bg-white border border-gray-200 rounded-md px-3 py-2.5 mb-3">
      {rows.length === 0 ? (
        /* ⚠️ ตรวจแล้วไม่เจอ ต้องพูดออกมา — เงียบไป คนจะไม่รู้ว่ามีตัวตรวจนี้อยู่
           แล้ววันที่มันเงียบเพราะพัง ก็ดูเหมือนเดิมเป๊ะ */
        <p className="text-gray-600">✅ ตรวจแล้ว — ท่อไม่ได้บอกว่ามีช่องทางไหนเงียบ (เทียบกับวันตัด {found?.cutoff ?? '—'})</p>
      ) : (
        <>
          <p className="font-semibold text-gray-800 mb-1">
            🟠 ช่องทางที่เงียบไปแล้ว {fmt(rows.length)} ช่องทาง
            {withOrders.length > 0 && <> · มีใบค้างในกองรอจัดส่งรวม <b className="text-amber-800">{fmt(sum)}</b> ใบ</>}
          </p>
          <p className="text-gray-500 mb-2">
            เกณฑ์ของท่อ: ไม่มีบิลใหม่ตั้งแต่ <b>{found?.cutoff ?? '—'}</b> ถือว่าเงียบ (ตัดสินจากวันที่ใบล่าสุด ไม่ใช่จากชื่อช่องทาง)
            {' · '}ยอดด้านล่างเป็นยอด<b>ทั้งช่วงที่กรองอยู่</b> ({from} ถึง {to}) ไม่ใช่นับจากแถวในหน้านี้
          </p>
          <ul className="space-y-0.5">
            {rows.map((r) => (
              <li key={r.ch} className="flex justify-between gap-3 border-b border-[#e8ecf8] last:border-0 py-1">
                <span className="text-gray-700">
                  {r.ch}
                  <span className="text-gray-400"> · ใบล่าสุด {r.lastOrder ?? '—'}</span>
                </span>
                <span className="tabular-nums">
                  {r.waiting === null
                    ? <span className="text-amber-800">ถามยอดไม่ได้</span>
                    : r.waiting === 0
                      ? <span className="text-gray-400">ไม่มีใบค้าง</span>
                      : <b className="text-amber-800">{fmt(r.waiting)} ใบ</b>}
                </span>
              </li>
            ))}
          </ul>
          {found && found.failed > 0 && (
            <p className="text-amber-800 mt-2">
              ⚠️ ถามยอดไม่สำเร็จ {fmt(found.failed)} ช่องทาง — ยอดรวม {fmt(sum)} ใบ <b>ยังไม่ครบ</b>
            </p>
          )}
          <p className="text-gray-500 mt-2">
            🚫 ใบเหล่านี้<b>ไม่ได้ถูกกรองทิ้ง</b> ยังนับรวมอยู่ในกองรอจัดส่งตามเดิม — แยกมาให้เห็นเฉย ๆ
            เพราะถ้าวันหนึ่งมีใบ<b>ใหม่</b>ของช่องทางที่ปิดแล้วโผล่มา นั่นคือสัญญาณว่ามีอะไรผิดปกติหนัก
          </p>
        </>
      )}
    </div>
  )
}
