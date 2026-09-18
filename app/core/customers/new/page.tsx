'use client'
// ลูกค้า/คู่ค้า → เพิ่มผู้ติดต่อใหม่ (เขียนทะลุไป ZORT Contact/AddContact)
//
// 🔴 **ปุ่มส่งจริงปิดอยู่** — ท่านประธานอนุมัติการเขียนจริงเป็นราย ๆ ไป — จอนี้ยังไม่อยู่ในรายการที่อนุมัติ (6 ก.ย. 2569)
//    ผู้ติดต่อต้องขออนุมัติแยก · ระหว่างนี้ "ทดลองส่ง" ได้เต็มที่ เห็นทุกช่องที่จะส่งจริง
//
// 🔴 **ZORT ลบผ่าน API ไม่ได้** ⇒ ผู้ติดต่อที่สร้างผิดจะค้างในทะเบียน
//    ⇒ บังคับซ้อมก่อนเสมอ · ผลซ้อมผูกกับ "เนื้อหา" ไม่ใช่ "การกดปุ่ม"
//
// สัญญาจากเอกสารทางการ ZORT V4 (ฝั่งท่ออ่านให้ 14 ก.ย. 2569 — ไม่ได้เดาชื่อช่อง):
//   บังคับ: code · name
//   ไม่บังคับ: idnumber · phone · email · address · branchname · branchno
//             facebook · line · instagram · properties
//   มี UpdateContact ด้วย (ยังไม่ได้ทำหน้าแก้)
//
// ⚠️ **หมวดหมู่ผู้ติดต่อทำไม่ได้จริง** — ZORT ไม่มี API เลย (ตรวจเอกสารทางการ 14 ก.ย. 2569 · ขึ้นทะเบียน ZORT_NO_API แล้ว)
//    ⇒ จอนี้จึงไม่มีช่องหมวดหมู่ ไม่ใช่ลืมใส่
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHead, WriteResult } from '@/components/zort'
import type { WriteResp } from '@/components/zort'
import { looksLikeFallThrough } from '@/lib/api-shape'
import { ส่งจริงได้ } from '@/lib/real-send'

/** 🔴 สวิตช์ปุ่มส่งจริง — ห้ามเปิดจนกว่าเจ้าของร้านจะอนุมัติการเพิ่มผู้ติดต่อโดยเฉพาะ */
/* ⚠️ ค่าอยู่ที่ `lib/real-send.ts` ที่เดียว — **ห้ามเขียนค่าตายตรงนี้**
   เพราะค่านี้คือ *สถานะการอนุมัติของท่านประธาน* ไม่ใช่ค่าคงที่ของโค้ด
   (เขียนซ้ำหลายที่มาแล้ว 12 ไฟล์ ⇒ จอรายการซื้อพูดเท็จอยู่ 5 วัน · ใบ S4 19 ก.ย. 2569) */
const REAL_SEND_ENABLED = ส่งจริงได้('customers/new')
const inp = 'w-full rounded border border-gray-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-blue-400'

type Resp = WriteResp & { willSend?: Record<string, unknown> }

/** ป้ายกำกับช่องกรอก — **ต้องอยู่ระดับโมดูล** (ดูเหตุผลในคอมเมนต์ที่จุดเรียก) */
function F({ l, children, req: rq }: { l: string; children: React.ReactNode; req?: boolean }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-gray-400 mb-1">{l}{rq && <span className="text-red-500"> *</span>}</span>
      {children}
    </label>
  )
}

export default function NewContactPage() {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [idnumber, setIdnumber] = useState('')
  const [address, setAddress] = useState('')
  const [branchname, setBranchname] = useState('')
  const [branchno, setBranchno] = useState('')
  const [line, setLine] = useState('')
  const [facebook, setFacebook] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<Resp | null>(null)
  const [okDry, setOkDry] = useState('')

  /* เลขอ้างอิงกันส่งซ้ำ — สร้างฝั่งเบราว์เซอร์ครั้งเดียวต่อการเปิดหน้า (กัน hydration + กันกดสองครั้ง) */
  const [ref, setRef] = useState('')
  useEffect(() => {
    setRef(`CT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`)
  }, [])

  const sig = useMemo(() => JSON.stringify({
    code: code.trim(), name: name.trim(), phone: phone.trim(), email: email.trim(),
    idnumber: idnumber.trim(), address: address.trim(),
    branchname: branchname.trim(), branchno: branchno.trim(), line: line.trim(), facebook: facebook.trim(),
  }), [code, name, phone, email, idnumber, address, branchname, branchno, line, facebook])
  const dryOk = okDry !== '' && okDry === sig

  const send = useCallback(async (confirm: boolean) => {
    setErr(''); setRes(null)
    /* ⚠️ สองช่องนี้ ZORT บังคับ ⇒ กันตั้งแต่ต้น ไม่ปล่อยให้ท่อปฏิเสธแล้วคนงงว่าทำไม */
    if (!code.trim()) { setErr('ต้องมีรหัสผู้ติดต่อ (ZORT บังคับ)'); return }
    if (!name.trim()) { setErr('ต้องมีชื่อผู้ติดต่อ (ZORT บังคับ)'); return }
    setBusy(true)
    try {
      const t = (v: string) => (v.trim() === '' ? undefined : v.trim())
      const r: Resp = await fetch('/api/web/core?addcontact=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ref,
          code: code.trim(),
          name: name.trim(),
          phone: t(phone), email: t(email), idnumber: t(idnumber), address: t(address),
          branchname: t(branchname), branchno: t(branchno), line: t(line), facebook: t(facebook),
          ...(confirm ? { confirm: true } : {}),
        }),
      }).then((x) => x.json())
      /* 🔴 ท่อที่ไม่รู้จักพารามิเตอร์ตอบ "คำตอบหน้าแรก" พร้อม 200 ⇒ ถ้าไม่จับ จะกดแล้วเงียบสนิท
         (เจอกับตัวตอนทำหน้าสร้างรายการขาย 14 ก.ย. 2569) */
      if (looksLikeFallThrough(r)) {
        setErr('เส้น addcontact ยังไม่มีบนเซิร์ฟเวอร์ — ท่อตอบ "คำตอบหน้าแรก" กลับมาแทน (ยังไม่ deploy) '
          + '⇒ ยังทดลองส่งไม่ได้ · ไม่ใช่ว่าข้อมูลที่กรอกผิด')
        return
      }
      setRes(r)
      if (!confirm && r?.dryRun && r?.ok !== false) setOkDry(sig)
      if (confirm && r?.ok) setOkDry('')
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e))
    } finally { setBusy(false) }
  }, [code, name, phone, email, idnumber, address, branchname, branchno, line, facebook, ref, sig])

  /* 🔴 **ย้าย `F` ออกไประดับโมดูลแล้ว 18 ก.ย. 2569 — ห้ามย้ายกลับ**
     ตัวห่อนี้ไม่มี `<input>` อยู่ในตัวเอง (รับมาทาง `children`) **แต่ยังทำให้พิมพ์ไม่ได้อยู่ดี**
     เพราะ React ถอด **ทั้งต้นไม้ข้างใน** ทิ้งเมื่อชนิดของตัวห่อเปลี่ยน ⇒ `<input>` ที่เป็นลูกก็ถูกสร้างใหม่
     🔬 วัดของจริง: พิมพ์ "ทดสอบABC123" ⇒ ได้ `'ท'` · `document.activeElement` = `BODY`
     🔑 **ด่านสแกนโครงสร้างรอบแรกจับตัวนี้ไม่ได้** เพราะมันมองหา `<input>` ในตัวคอมโพเนนต์
        ⇒ ตัวที่จับได้คือ **ตัวทดสอบที่พิมพ์ลงช่องจริง** (`scripts/ทดสอบพิมพ์ลงช่อง.py`) ในการรันรอบแรก */

  return (
    <div className="p-4 md:p-6 max-w-[900px]">
      <PageHead
        title="เพิ่มผู้ติดต่อใหม่"
        summary={<>เขียนเข้า ZORT โดยตรง (Contact/AddContact){' | '}
          <span className="text-gray-400">เลขอ้างอิง: <b>{ref || '…'}</b> (กันการส่งซ้ำ)</span></>}
      />

      <div className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-300 rounded-md px-3.5 py-2.5 mt-3 leading-relaxed">
        ⚠️ ZORT <b>ลบผู้ติดต่อผ่าน API ไม่ได้</b> — ที่สร้างผิดจะค้างในทะเบียน ⇒ ต้องทดลองส่งก่อนทุกครั้ง
        {' '}· <b>ไม่มีช่องหมวดหมู่โดยตั้งใจ</b> เพราะ ZORT ไม่มี API สำหรับหมวดหมู่ผู้ติดต่อเลย (ตรวจเอกสารทางการ 14 ก.ย. 2569)
        {' '}(<Link href="/core/soon/contact-group" className="underline">ดูรายละเอียด</Link>)
      </div>

      <div className="grid md:grid-cols-3 gap-3 mt-4">
        <F l="รหัสผู้ติดต่อ" req><input className={inp} value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น C-001" /></F>
        <F l="ชื่อผู้ติดต่อ" req><input className={inp} value={name} onChange={(e) => setName(e.target.value)} /></F>
        <F l="เบอร์โทร"><input className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} /></F>
        <F l="อีเมล"><input className={inp} value={email} onChange={(e) => setEmail(e.target.value)} /></F>
        <F l="เลขประจำตัวผู้เสียภาษี"><input className={inp} value={idnumber} onChange={(e) => setIdnumber(e.target.value)} /></F>
        <F l="LINE"><input className={inp} value={line} onChange={(e) => setLine(e.target.value)} /></F>
        <F l="Facebook"><input className={inp} value={facebook} onChange={(e) => setFacebook(e.target.value)} /></F>
        <F l="ชื่อสาขา"><input className={inp} value={branchname} onChange={(e) => setBranchname(e.target.value)} placeholder="เช่น สำนักงานใหญ่" /></F>
        <F l="เลขที่สาขา"><input className={inp} value={branchno} onChange={(e) => setBranchno(e.target.value)} placeholder="เช่น 00000" /></F>
        <div className="md:col-span-3"><F l="ที่อยู่"><input className={inp} value={address} onChange={(e) => setAddress(e.target.value)} /></F></div>
      </div>

      {err && <div className="text-[13px] text-red-800 bg-red-50 border border-red-300 rounded-md px-3.5 py-2.5 mt-3">{err}</div>}

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button onClick={() => send(false)} disabled={busy || !ref}
          className="rounded-full px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40" style={{ background: '#4669e5' }}>
          {busy ? 'กำลังส่ง…' : '🧪 ทดลองส่ง (ยังไม่เข้า ZORT)'}
        </button>
        <button onClick={() => send(true)} disabled={busy || !ref || !dryOk || !REAL_SEND_ENABLED}
          className="rounded-full px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
          style={{ background: dryOk && REAL_SEND_ENABLED ? '#c0392b' : '#9aa0a6' }}>
          ส่งเข้า ZORT จริง
        </button>
      </div>

      {!REAL_SEND_ENABLED ? (
        <p className="text-[12.5px] text-gray-500 mt-2 leading-relaxed">
          🔒 <b>ปุ่มส่งจริงปิดอยู่</b> — ท่านประธานอนุมัติการเขียนจริงเป็นราย ๆ ไป — จอนี้ยังไม่อยู่ในรายการที่อนุมัติ
          {' '}การเพิ่มผู้ติดต่อต้องขออนุมัติแยก · ระหว่างนี้ทดลองส่งได้เต็มที่ เห็นทุกช่องที่จะส่งจริง
        </p>
      ) : !dryOk && (
        <p className="text-[12.5px] text-gray-500 mt-2">ต้องทดลองส่งให้ผ่านก่อน · แก้อะไรหลังซ้อม ปุ่มส่งจริงจะปิดเองอีกครั้ง</p>
      )}

      <div className="mt-3"><WriteResult r={res} /></div>

      {res?.dryRun && res.willSend != null && (
        <details className="mt-2 border border-gray-200 rounded">
          <summary className="text-[12.5px] text-gray-700 px-3 py-2 cursor-pointer">ดูของจริงที่จะถูกส่งเข้า ZORT</summary>
          <pre className="text-[11px] text-gray-700 px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(res.willSend, null, 1)}
          </pre>
        </details>
      )}
    </div>
  )
}
