'use client'
// ตั้งค่า → ผู้ใช้งาน → **เพิ่มผู้ใช้งาน** — ฟอร์มจริง กดบันทึกแล้วเข้าได้เลย
//
// ท่านประธานสั่งเอง 12 ก.ย. 2569: ส่งลิงก์หน้านี้มาแล้วบอกว่า "ทำหน้านี้หน่อยจะใช้"
// ของเดิม (8 ก.ย.) หน้านี้เป็น **ใบสั่งงานให้คนอ่าน**: ไปตั้ง STAFF_NAME_n/STAFF_PASS_n
// ที่ Netlify แล้วสั่ง deploy ใหม่ ⇒ เพิ่มคนหนึ่งคนต้องออกจากระบบเราไปทำที่อื่น รอ 3 นาที
//
// 🔴 **นโยบายเดิมของหน้านี้เคยเขียนห้ามทำฟอร์มตั้งรหัส — เก็บไว้ให้อ่านพร้อมเหตุผลที่เปลี่ยน**
//    ข้อห้ามเดิม (8 ก.ย. 2569): "ไม่ทำฟอร์มตั้งรหัสบนเว็บโดยตั้งใจ — ฟอร์มที่ตั้งรหัสได้
//    = รหัสวิ่งผ่านหน้าเว็บและผ่านเซิร์ฟเวอร์เรา **แล้วต้องเก็บไว้อ่านได้**"
//    ⇒ **วรรคท้ายคือหัวใจของข้อห้าม** ที่ต้องเก็บอ่านได้เพราะตอนนั้นการล็อกอินเทียบ
//      ข้อความดิบกับ env ⇒ ถ้าทำฟอร์ม เราจะต้องเก็บรหัสแบบอ่านย้อนได้ ซึ่งแย่กว่าเดิม
//    ⇒ 12 ก.ย. 2569 เปลี่ยนได้เพราะ **เงื่อนไขนั้นถูกเอาออกไปแล้ว**: รหัสที่กรอกในหน้านี้
//      ถูกเก็บเป็นค่าที่ย้อนกลับไม่ได้ + ค่าสุ่มประจำคน (PBKDF2) และไม่มีทางอ่านย้อน
//      ⇒ ไม่ใช่การฝืนข้อห้าม แต่เอาเหตุผลที่ทำให้ข้อห้ามจำเป็นออก (CEO อนุมัติพร้อมสั่งว่า
//        ห้ามลบข้อห้ามเฉย ๆ คนอ่านรอบหน้าต้องเห็นว่าเคยห้ามเพราะอะไร)
//    ⚠️ **ข้อห้ามที่ยังอยู่เหมือนเดิม**: ห้าม log รหัส · ห้ามส่งรหัสกลับออกจาก API ·
//      ห้ามเก็บข้อความดิบ · ห้ามแยกข้อความผิดพลาดว่า "ไม่มีชื่อนี้" กับ "รหัสผิด"
//
// ⚠️ ช่อง env เดิม (STAFF_NAME_n/STAFF_PASS_n) **ยังใช้ได้เหมือนเดิมทุกคน** — เพิ่มอย่างเดียว
//    ไม่ถอดของเดิม · วันที่ที่เก็บใหม่ล่ม คนใน env ยังล็อกอินได้ และหน้านี้จะขึ้นแถบเตือน
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHead, BtnGhost } from '@/components/zort'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'

interface U { id: string; name: string; active: boolean; createdAt: string }

export default function AddUserPage() {
  const [users, setUsers] = useState<U[] | null>(null)
  const [max, setMax] = useState(20)
  const [storeError, setStoreError] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [formErr, setFormErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setLoadErr(''); setStoreError('')
    try {
      const r = await fetch('/api/staff-users', { cache: 'no-store' })
      const d = await r.json().catch(() => null)
      /* 🔴 สามสถานะ: อ่านได้ · อ่านไม่ได้ (ที่เก็บล่ม) · อ่านได้แต่ยังไม่มีใคร
         ห้ามยุบ "อ่านไม่ได้" ให้กลายเป็น "ยังไม่มีใคร" — คนจะนึกว่าผู้ใช้หาย */
      if (d?.storeError) { setStoreError(String(d.storeError)); setUsers(null) }
      else if (!r.ok || !d?.ok || !Array.isArray(d.users)) setLoadErr(d?.error || `อ่านรายชื่อไม่สำเร็จ (HTTP ${r.status})`)
      else { setUsers(d.users); setMax(Number(d.max) || 20) }
    } catch (e: any) {
      setLoadErr(String(e?.message ?? e))
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const add = async () => {
    setFormErr(''); setMsg('')
    if (pass !== pass2) { setFormErr('รหัสผ่านสองช่องไม่ตรงกัน'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/staff-users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, password: pass }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok || !d?.ok) { setFormErr(d?.error || `บันทึกไม่สำเร็จ (HTTP ${r.status})`); return }
      // ⚠️ ไม่เอารหัสไปโชว์ซ้ำ ไม่เก็บไว้ในหน้า — ล้างช่องทันทีที่บันทึกเสร็จ
      setName(''); setPass(''); setPass2('')
      setMsg(`เพิ่ม "${d.user?.name}" แล้ว — เข้าใช้งานได้ทันที ไม่ต้องรอ deploy`)
      await load()
    } finally { setBusy(false) }
  }

  const toggle = async (u: U) => {
    setMsg(''); setFormErr('')
    const r = await fetch('/api/staff-users', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: u.id, active: !u.active }),
    })
    const d = await r.json().catch(() => null)
    if (!r.ok || !d?.ok) { setFormErr(d?.error || 'เปลี่ยนสถานะไม่สำเร็จ'); return }
    if (d.note) setMsg(String(d.note))
    await load()
  }

  const remove = async (u: U) => {
    if (!confirm(`ลบ "${u.name}" ออกจากระบบถาวร?\n(ถ้าเป็นพนักงานที่ลาออก แนะนำให้กด "ปิดใช้งาน" แทน จะได้เหลือบันทึกไว้)`)) return
    setMsg(''); setFormErr('')
    const r = await fetch(`/api/staff-users?id=${encodeURIComponent(u.id)}`, { method: 'DELETE' })
    const d = await r.json().catch(() => null)
    if (!r.ok || !d?.ok) { setFormErr(d?.error || 'ลบไม่สำเร็จ'); return }
    setMsg(`ลบ "${u.name}" แล้ว`)
    await load()
  }

  const full = (users?.length ?? 0) >= max

  return (
    <div className="p-4 md:p-6 max-w-[760px]">
      <p className="text-[12px] mb-2">
        <Link href="/core/settings-users" className="text-blue-600 hover:underline">‹ ผู้ใช้งาน</Link>
      </p>
      <PageHead
        title="เพิ่มผู้ใช้งาน"
        summary={<span className="text-gray-500">ตั้งชื่อกับรหัส กดบันทึก แล้วคนนั้นเข้าใช้งานได้ทันที — ไม่ต้องเปิด Netlify ไม่ต้องรอ deploy</span>}
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      {/* 🔴 ทางถอยต้องประกาศตัวเมื่อถูกใช้ — ไม่งั้นมันกลายเป็นทางหลักโดยไม่มีใครรู้ */}
      {storeError && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 leading-relaxed">
          ⚠️ <b>อ่านรายชื่อผู้ใช้จากที่เก็บไม่ได้ตอนนี้</b> — {storeError}
          <div className="mt-1 text-amber-800">
            ⇒ <b>เพิ่มผู้ใช้ใหม่ยังไม่ได้</b> และการล็อกอินกำลังใช้ <b>ช่อง env แบบเดิม</b> เป็นทางถอย
            (คนที่ตั้งไว้ใน STAFF_PASS_1..8 ยังเข้าได้ปกติ) · <b>ไม่ได้แปลว่าผู้ใช้หาย</b>
          </div>
        </div>
      )}
      {loadErr && <ErrorBox title="อ่านรายชื่อผู้ใช้ไม่ได้">{loadErr}</ErrorBox>}

      <section className="rounded-md border border-gray-200 bg-white p-4 mb-4">
        <h2 className="text-[14px] font-semibold text-gray-900 mb-3">เพิ่มคนใหม่</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="text-[12.5px] text-gray-700">
            ชื่อผู้ใช้ (ไว้ดูว่าใครล็อกอิน)
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
              className="mt-1 w-full rounded border border-gray-300 px-2.5 py-1.5 text-[13px]" placeholder="เช่น สมชาย (คลังหน้าร้าน)" />
          </label>
          <label className="text-[12.5px] text-gray-700">
            รหัสผ่าน (อย่างน้อย 6 ตัว)
            <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" autoComplete="new-password"
              className="mt-1 w-full rounded border border-gray-300 px-2.5 py-1.5 text-[13px]" />
          </label>
          <label className="text-[12.5px] text-gray-700 sm:col-start-2">
            พิมพ์รหัสผ่านอีกครั้ง
            <input value={pass2} onChange={(e) => setPass2(e.target.value)} type="password" autoComplete="new-password"
              className="mt-1 w-full rounded border border-gray-300 px-2.5 py-1.5 text-[13px]" />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={add} disabled={busy || !name.trim() || pass.length < 6 || full || !!storeError}
            className="rounded bg-[#4669e5] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40">
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
          {full && <span className="text-[12px] text-amber-800">เต็มเพดาน {max} คนแล้ว — ปิดหรือลบคนที่ไม่ใช้ก่อน</span>}
        </div>
        {formErr && <p className="mt-2 text-[12.5px] text-red-700">⚠️ {formErr}</p>}
        {msg && <p className="mt-2 text-[12.5px] text-green-700">✓ {msg}</p>}

        <p className="mt-3 text-[11.5px] text-gray-500 leading-relaxed">
          รหัสถูกเก็บเป็นค่าที่ <b>ย้อนกลับไม่ได้</b> (พร้อมค่าสุ่มประจำคน) ⇒ <b>ดูรหัสย้อนหลังไม่ได้</b>
          ลืมแล้วต้องตั้งใหม่ · ไม่มีที่ไหนในระบบเก็บตัวรหัสไว้ และไม่ถูกส่งกลับมาที่หน้าจอ
        </p>
      </section>

      <section className="rounded-md border border-gray-200 bg-white p-4">
        <h2 className="text-[14px] font-semibold text-gray-900 mb-1">คนที่เพิ่มจากหน้านี้</h2>
        <p className="text-[11.5px] text-gray-500 mb-3">
          สิทธิ์ <b>เท่ากับพนักงานเดิมเป๊ะ</b> — เห็นได้แค่หน้าโอนสินค้าและเส้น API ของหน้านั้น
        </p>
        {loading && !users ? <LoadingState /> : users === null ? null : users.length === 0 ? (
          <p className="text-[13px] text-gray-500">ยังไม่มีใคร — เพิ่มจากกล่องข้างบนได้เลย</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-[13px]">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr><th className="py-1.5 text-left font-medium">ชื่อ</th><th className="py-1.5 text-left font-medium">สถานะ</th><th className="py-1.5 text-left font-medium">เพิ่มเมื่อ</th><th /></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-2">{u.name}</td>
                    <td className="py-2 pr-2">
                      {u.active
                        ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-[12px] text-green-700">ใช้งานได้</span>
                        : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[12px] text-gray-600">ปิดอยู่</span>}
                    </td>
                    <td className="py-2 pr-2 text-gray-500">{String(u.createdAt).slice(0, 10)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button onClick={() => toggle(u)} className="text-[12.5px] text-blue-600 hover:underline">
                        {u.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                      </button>
                      <button onClick={() => remove(u)} className="ml-3 text-[12.5px] text-red-600 hover:underline">ลบ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* ⏳ บอกความจริงเรื่องเวลาที่การปิดมีผล — ห้ามเขียนว่า "หลุดทันที" ถ้าไม่จริง */}
        <p className="mt-3 text-[11.5px] text-gray-500 leading-relaxed">
          กด <b>ปิดใช้งาน</b> แล้ว <b>ล็อกอินครั้งใหม่ถูกปฏิเสธทันที</b> ·
          เครื่องที่ยังค้างล็อกอินอยู่จะหลุดเมื่อโทเคนหมดอายุ (ไม่เกิน 8 ชั่วโมง)
          ⇒ ถ้าต้องตัดเดี๋ยวนั้นจริง ๆ ให้เปลี่ยน <b>SITE_PASSWORD</b> ซึ่งจะทำให้ทุกคนต้องล็อกอินใหม่
        </p>
      </section>

      <section className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 text-[12px] text-gray-600 leading-relaxed">
        <b>ช่องแบบเดิมยังใช้ได้</b> — คนที่ตั้งไว้ใน <code>STAFF_NAME_1..8</code> / <code>STAFF_PASS_1..8</code>
        ที่ Netlify ล็อกอินได้เหมือนเดิมทุกคน (งานนี้เพิ่มทางใหม่ ไม่ได้ถอดทางเดิม)
        วิธีนั้นยังต้อง deploy ใหม่ทุกครั้ง ⇒ ใช้ฟอร์มข้างบนสะดวกกว่า
      </section>
    </div>
  )
}
