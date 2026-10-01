'use client'
// เงินเดือนพนักงาน — ฉบับเนื้อเดียว · ท่อ /api/web/payroll
//
// ท่านประธานสั่ง 1 ต.ค. 2569 · เงินเดือนรายเดือนคงที่ · ธนาคารกสิกรไทย
//
// 🔴 **หน้านี้ไม่โอนเงิน** และต้องเขียนบอกบนจอให้ชัด
//    มันคิดเลขและออกไฟล์ให้เอาไปอัปโหลดใน K BIZ เท่านั้น
//    ⚠️ ห้ามใส่ปุ่มชื่อ "จ่ายเงิน" / "โอนเลย" — คนจะเข้าใจว่ากดแล้วเงินออก
//       แล้ววันที่เงินไม่ออกจริงจะไม่มีใครรู้จนพนักงานทวง
//
// 🔴 **ไม่หักเงินอัตโนมัติจากข้อมูลลงเวลา**
//    คอลัมน์ "มา/สาย" มีไว้ให้ดูประกอบ **ไม่ได้ถูกคิดเข้ายอด**
//    เพราะระบบลงเวลาผิดได้จริง (กล้องไม่ติด · GPS เพี้ยน · ลืมกดออก)
//    จะหักต้องกรอกเองในช่อง "หัก" — ดูเหตุผลเต็มใน netlify/lib/payroll.mjs
import { useCallback, useEffect, useState } from 'react'

interface Row {
  id: string; name: string; position: string
  acc: string; accName: string
  salary: string; add: string; cut: string; net: string; whyAdj: string
  daysPresent: number; daysLate: number
  ready: boolean; problem: string
}

const เดือนไทย = () => {
  const d = new Date(Date.now() + 7 * 3600 * 1000)
  return d.toISOString().slice(0, 7)
}

export default function WebPayrollPage() {
  const [month, setMonth] = useState(เดือนไทย())
  const [rows, setRows] = useState<Row[] | null>(null)
  const [total, setTotal] = useState('0.00')
  const [countReady, setCountReady] = useState(0)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<Row | null>(null)
  const [slip, setSlip] = useState<{ name: string; text: string } | null>(null)

  const โหลด = useCallback(() => {
    setErr('')
    fetch(`/api/web/payroll?month=${month}`)
      .then(async (r) => {
        const d = await r.json()
        // 🔴 ท่อตอบ 500 พร้อม JSON ⇒ .json() ไม่ throw ⇒ catch ไม่ทำงาน
        //    ไม่เช็ค r.ok จะได้ rows = [] เงียบ ๆ แล้วจอเขียนว่า "ยังไม่มีพนักงาน"
        //    ซึ่งอ่านเป็น "ไม่ต้องจ่ายใครเดือนนี้" — กลับหัวความจริงในเรื่องเงิน
        if (!r.ok || d?.error) throw new Error(String(d?.error ?? `HTTP ${r.status}`))
        if (!('rows' in d)) throw new Error('เซิร์ฟเวอร์ตอบมาไม่ครบ')
        return d
      })
      .then((d) => {
        setRows(Array.isArray(d.rows) ? d.rows : [])
        setTotal(String(d.total ?? '0.00'))
        setCountReady(Number(d.countReady ?? 0))
      })
      .catch((e) => {
        // ⚠️ โหลดไม่สำเร็จ ≠ ไม่มีพนักงาน — ต้องแยกให้ขาด ห้ามโชว์ตารางว่าง
        setErr(`โหลดข้อมูลเงินเดือนไม่สำเร็จ — ${e.message} (ไม่ได้แปลว่าไม่มีพนักงาน)`)
        setRows(null)
      })
  }, [month])

  useEffect(() => { โหลด() }, [โหลด])

  const บันทึกคน = async (id: string, body: Record<string, string>) => {
    const r = await fetch(`/api/web/payroll?emp=${encodeURIComponent(id)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null)
    const d = await r?.json().catch(() => null)
    if (!r?.ok || d?.error) { alert(`บันทึกไม่สำเร็จ — ${d?.error ?? 'ลองใหม่อีกครั้ง'}`); return false }
    return true
  }

  const บันทึกปรับ = async (id: string, body: Record<string, string>) => {
    const r = await fetch(`/api/web/payroll?adj=${encodeURIComponent(id)}&month=${month}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null)
    const d = await r?.json().catch(() => null)
    if (!r?.ok || d?.error) { alert(`บันทึกไม่สำเร็จ — ${d?.error ?? 'ลองใหม่อีกครั้ง'}`); return false }
    return true
  }

  const ดูสลิป = async (row: Row) => {
    const r = await fetch(`/api/web/payroll?slip=${encodeURIComponent(row.id)}&month=${month}`).catch(() => null)
    const d = await r?.json().catch(() => null)
    if (!r?.ok || !d?.slip) { alert('เปิดสลิปไม่สำเร็จ'); return }
    setSlip({ name: row.name, text: String(d.slip) })
  }

  const มีปัญหา = (rows ?? []).filter((r) => !r.ready)

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
        <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">เงินเดือนพนักงาน</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">เงินเดือนรายเดือนคงที่ · ธนาคารกสิกรไทย</p>
      </div>

      {/* 🔴 คำเตือนต้องอยู่บนสุด เห็นโดยไม่ต้องเลื่อนจอ — ไม่ใช่เชิงอรรถใต้ตาราง */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        <b>หน้านี้ไม่ได้โอนเงินให้</b> — คิดยอดและออกไฟล์ให้เท่านั้น
        เงินจะออกจากบัญชีก็ต่อเมื่อท่านอัปโหลดไฟล์ใน K BIZ แล้วกดยืนยันเองเท่านั้น
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2 text-[13px]"
        />
        <button onClick={โหลด} className="rounded-xl border border-gray-200 px-3 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">
          โหลดใหม่
        </button>
        <span className="flex-1" />
        {countReady > 0 && (
          <a
            href={`/api/web/payroll?csv=1&month=${month}`}
            className="rounded-xl bg-gray-900 px-4 py-2 text-[13px] font-bold text-white hover:bg-gray-800"
          >
            ดาวน์โหลดไฟล์โอนเงิน ({countReady} คน)
          </a>
        )}
      </div>

      {err && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">{err}</p>}

      {rows && rows.length > 0 && (
        <div className="rounded-2xl border border-gray-100/80 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">ยอดที่ต้องโอนเดือนนี้</p>
          <p className="text-[28px] font-black tracking-tight text-gray-900 tabular-nums">฿{total}</p>
          <p className="text-[12px] text-gray-400">
            พร้อมโอน {countReady} คน
            {มีปัญหา.length > 0 && <> · <span className="text-amber-600 font-semibold">ยังโอนไม่ได้ {มีปัญหา.length} คน</span></>}
          </p>
        </div>
      )}

      {rows === null && !err && <p className="text-[13px] text-gray-400">กำลังโหลด…</p>}
      {rows && rows.length === 0 && (
        <p className="rounded-2xl border border-gray-100 bg-white px-4 py-6 text-center text-[13px] text-gray-400">
          ยังไม่มีพนักงานที่ทำงานอยู่ — เพิ่มได้ที่หน้า “ลงเวลาพนักงาน”
        </p>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-100/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-gray-50 text-[10.5px] font-bold uppercase tracking-wider text-gray-300">
                <th className="px-4 py-2 text-left">พนักงาน</th>
                <th className="px-3 py-2 text-right">เงินเดือน</th>
                <th className="px-3 py-2 text-right">เพิ่ม</th>
                <th className="px-3 py-2 text-right">หัก</th>
                <th className="px-3 py-2 text-right">รับสุทธิ</th>
                <th className="px-3 py-2 text-left">บัญชี</th>
                <th className="px-3 py-2 text-center">มา / สาย</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{r.name}</div>
                    {r.position && <div className="text-[11px] text-gray-400">{r.position}</div>}
                    {!r.ready && <div className="text-[11px] font-semibold text-amber-600">⚠️ {r.problem}</div>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.salary}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-600">{r.add !== '0.00' ? r.add : '—'}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-red-500">{r.cut !== '0.00' ? r.cut : '—'}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-gray-900">{r.net}</td>
                  <td className="px-3 py-3">
                    {/* 🔒 โชว์แค่ 4 ตัวท้าย — เลขบัญชีเต็มไม่จำเป็นต้องอยู่บนจอตลอดเวลา */}
                    {r.acc ? <span className="tabular-nums text-gray-500">•••{r.acc.slice(-4)}</span> : <span className="text-amber-600">ยังไม่มี</span>}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-400 tabular-nums">
                    {r.daysPresent}{r.daysLate > 0 && <span className="text-amber-600"> / {r.daysLate}</span>}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(r)} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[12px] font-semibold text-gray-600 hover:bg-gray-50">แก้</button>
                    <button onClick={() => ดูสลิป(r)} className="ml-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-[12px] font-semibold text-gray-600 hover:bg-gray-50">สลิป</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[12px] leading-relaxed text-gray-400">
        คอลัมน์ <b>มา / สาย</b> เป็นข้อมูลให้ดูประกอบ <b>ไม่ได้ถูกคิดเข้ายอดเงิน</b> —
        ระบบลงเวลาผิดพลาดได้ (กล้องไม่ติด · GPS เพี้ยน · ลืมกดออก) จึงไม่หักเงินใครให้เอง
        ถ้าจะหักให้กรอกในช่อง “หัก” เอง
      </p>

      {editing && (
        <แก้ไขพนักงาน
          row={editing}
          onClose={() => setEditing(null)}
          onSave={async (คน, ปรับ) => {
            const a = await บันทึกคน(editing.id, คน)
            const b = await บันทึกปรับ(editing.id, ปรับ)
            if (a && b) { setEditing(null); โหลด() }
          }}
        />
      )}

      {slip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSlip(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[15px] font-black text-gray-900">สลิปของ {slip.name}</h2>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-[12px] leading-relaxed text-gray-700">{slip.text}</pre>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => { navigator.clipboard?.writeText(slip.text); }}
                className="flex-1 rounded-xl bg-gray-900 px-3 py-2 text-[13px] font-bold text-white"
              >คัดลอก</button>
              <button onClick={() => setSlip(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-[13px] font-semibold text-gray-600">ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function แก้ไขพนักงาน({ row, onClose, onSave }: {
  row: Row
  onClose: () => void
  onSave: (คน: Record<string, string>, ปรับ: Record<string, string>) => void
}) {
  const [salary, setSalary] = useState(row.salary === '0.00' ? '' : row.salary)
  const [acc, setAcc] = useState(row.acc)
  const [accName, setAccName] = useState(row.accName)
  const [position, setPosition] = useState(row.position)
  const [add, setAdd] = useState(row.add === '0.00' ? '' : row.add)
  const [cut, setCut] = useState(row.cut === '0.00' ? '' : row.cut)
  const [why, setWhy] = useState(row.whyAdj)

  const ช่อง = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-[13px]'
  const ป้าย = 'text-[11px] font-bold uppercase tracking-wider text-gray-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-black text-gray-900">{row.name}</h2>

        <div><label className={ป้าย}>ตำแหน่ง</label>
          <input className={ช่อง} value={position} onChange={(e) => setPosition(e.target.value)} /></div>
        <div><label className={ป้าย}>เงินเดือน (บาท/เดือน)</label>
          <input className={ช่อง} inputMode="decimal" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="เช่น 12,000" /></div>
        <div><label className={ป้าย}>เลขที่บัญชี กสิกรไทย</label>
          <input className={ช่อง} inputMode="numeric" value={acc} onChange={(e) => setAcc(e.target.value)} placeholder="10 หลัก" /></div>
        <div>
          <label className={ป้าย}>ชื่อบัญชี</label>
          <input className={ช่อง} value={accName} onChange={(e) => setAccName(e.target.value)} />
          {/* ⚠️ ธนาคารตีกลับทั้งไฟล์ถ้าชื่อไม่ตรงกับเจ้าของบัญชี — ต้องเตือนตรงช่องที่กรอก */}
          <p className="mt-1 text-[11px] text-gray-400">ต้องตรงกับชื่อเจ้าของบัญชีที่ธนาคาร ไม่ใช่ชื่อเล่น</p>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <p className={ป้าย}>เฉพาะเดือนนี้</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-gray-400">เพิ่ม (โบนัส/OT)</label>
              <input className={ช่อง} inputMode="decimal" value={add} onChange={(e) => setAdd(e.target.value)} /></div>
            <div><label className="text-[11px] text-gray-400">หัก</label>
              <input className={ช่อง} inputMode="decimal" value={cut} onChange={(e) => setCut(e.target.value)} /></div>
          </div>
          <input className={`${ช่อง} mt-2`} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="เหตุผล (จะขึ้นในสลิป)" />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onSave({ salary, acc, accName, position }, { add, cut, why })}
            className="flex-1 rounded-xl bg-gray-900 px-3 py-2 text-[13px] font-bold text-white"
          >บันทึก</button>
          <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-[13px] font-semibold text-gray-600">ยกเลิก</button>
        </div>
      </div>
    </div>
  )
}
