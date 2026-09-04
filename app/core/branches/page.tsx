'use client'
// คลังสินค้า/สาขา — **หน้าตาลอกจาก `zort-ui/25-zort-คลังสินค้า-สาขา.jpg`**
// ผัง: ชื่อจอ → "จำนวน N รายการ" → ปุ่ม นำเข้าไฟล์ (Excel) · เพิ่มคลังสินค้า/สาขา
//      → ช่องค้นหา → แถบเทาบอกวันที่อัพเดทมูลค่า
//      → ตาราง # · รหัส · ชื่อคลัง/สาขา · ประเภท · มูลค่าสินค้าคงเหลือ · เคลื่อนไหวล่าสุด · ⋮
//
// ⚠️ **"คลัง" กับ "สาขาที่เปิดบิลได้" ไม่ใช่สิ่งเดียวกัน — ห้ามรวมกัน**
//    ZORT มี 3 คลัง แต่ **โกดังไม่ใช่จุดขาย** ⇒ POS เปิดบิลได้แค่ 2 แห่ง
//    รวมกันเมื่อไหร่ จะมีคนเปิดบิลขายจากโกดังได้ ซึ่งไม่ตรงกับที่ร้านทำจริง
//    ⇒ อ่านธง `isPos` จากเซิร์ฟเวอร์ **ห้ามเดาจากรหัส** วันหนึ่งร้านเพิ่มคลัง
//      รหัสจะไม่ใช่ KLD/ANJ อีก แล้วการเดาจะพังเงียบ ๆ
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtMoney, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import {
  PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR, RowMenu, EmptyState, thaiDate,
} from '@/components/zort'

interface Warehouse {
  code: string; name: string; province?: string; isPos?: boolean
  /** มูลค่าสินค้าคงเหลือของคลังนั้น — ท่อยังไม่ส่งมา (ZORT ไม่เปิดให้ดึงสต็อกแยกคลัง)
   *  รับไว้ก่อนเพื่อไม่ต้องกลับมาแก้จอ วันที่มีข้อมูล */
  stockValue?: number
  /** วันที่คลังนั้นเคลื่อนไหวล่าสุด — ท่อยังไม่ส่งมา รับไว้ก่อน */
  movedAt?: string
}
interface ChannelRow { channel: string; orders: number; amount: number }

const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

export default function CoreBranchesPage() {
  const [rows, setRows] = useState<Warehouse[]>([])
  const [note, setNote] = useState('')
  const [byChannel, setByChannel] = useState<ChannelRow[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [wRes, cRes] = await Promise.all([
        fetch('/api/web/core?list=warehouses').then((r) => r.json()),
        fetch(`/api/web/core?list=orders&from=${thaiDay(30)}&to=${thaiDay(0)}&limit=1`).then((r) => r.json()),
      ])
      if (wRes?.error) throw new Error(wRes.error)
      setRows(Array.isArray(wRes?.warehouses) ? wRes.warehouses : [])
      setNote(typeof wRes?.note === 'string' ? wRes.note : '')
      setByChannel(Array.isArray(cRes?.byChannel) ? cRes.byChannel : [])
    } catch (e) {
      setRows([])
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /** ยอดขาย 30 วันของคลังนั้น — จับจากชื่อช่องทางที่มีรหัสคลังอยู่ (เช่น "POS KLD") */
  const statOf = (code: string) => {
    const hit = byChannel.filter((c) => new RegExp(`\\b${code}\\b`, 'i').test(c.channel))
    return {
      orders: hit.reduce((s, r) => s + (Number(r.orders) || 0), 0),
      amount: hit.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    }
  }

  const list = q.trim()
    ? rows.filter((r) => `${r.code} ${r.name}`.toLowerCase().includes(q.trim().toLowerCase()))
    : rows

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="คลังสินค้า/สาขา"
        summary={`จำนวน ${fmtNum(rows.length)} รายการ`}
        actions={
          <>
            <BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>
            <Link href="/core/soon/product-import"
              className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
              นำเข้าไฟล์ (Excel)
            </Link>
            <Link href="/core/soon/warehouse-add"
              className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
              style={{ background: '#1b3b73' }}>
              เพิ่มคลังสินค้า/สาขา
            </Link>
          </>
        }
      />

      <div className="mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหา"
          className="w-full max-w-[320px] text-[13px] border border-gray-300 rounded px-3 py-2 outline-none focus:border-blue-400"
        />
      </div>

      {error && <ErrorBox title="ดึงรายชื่อคลังไม่ได้">{error}</ErrorBox>}
      {loading && rows.length === 0 && <LoadingState />}

      {!loading && !error && (
        <>
          <div className="bg-gray-50 border border-gray-200 rounded-md px-3.5 py-2.5 mb-3 text-[12.5px] text-gray-700">
            {/* ⚠️ ZORT มีคอลัมน์มูลค่าสินค้าคงเหลือกับเคลื่อนไหวล่าสุด — เรายังไม่มีข้อมูลสองอย่างนี้
                เขียนบอกตรงนี้ ดีกว่าปล่อยคอลัมน์ "—" ให้เดาเอาเองว่าคือไม่มีของหรือดึงไม่ได้ */}
            มูลค่าสินค้าคงเหลือรายคลัง กับ เคลื่อนไหวล่าสุด <b>ยังไม่ได้ดึงมา</b> —
            คลังเงาเก็บสต็อกรวมทั้งร้าน ยังไม่ได้แยกตามคลัง
            {' '}<b>จอ ZORT มีตัวเลขสองช่องนี้อยู่</b> (ตรวจจากภาพจอจริง 4 ก.ย. 2569)
            ⇒ เป็นของที่<b>ยังไม่ได้ทำ ไม่ใช่ทำไม่ได้</b> · ขอจากฝั่งเซิร์ฟเวอร์ไว้แล้ว
            ถ้า API ไม่ส่งมาก็คัดมาด้วยมือได้ (มีแค่ 3 คลัง)
          </div>

          <TableWrap>
            <table className="w-full min-w-[820px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>รหัส</th>
                  <th className={TH}>ชื่อคลัง/สาขา</th>
                  <th className={TH}>ประเภท</th>
                  <th className={THR}>มูลค่าสินค้าคงเหลือ</th>
                  {/* ZORT มีคอลัมน์นี้ต่อจากมูลค่า — ของเรายังไม่มีข้อมูล แต่ต้องมีคอลัมน์ให้ผังตรง
                      ⚠️ ZORT ขึ้นเป็นสีแดงเมื่อคลังนั้นไม่ขยับนาน (ANJ = 13 มี.ค. 2568 สีแดง)
                         สีเป็นข้อมูล ไม่ใช่การตกแต่ง — วันไหนมีข้อมูลต้องทำสีตามด้วย */}
                  <th className={TH}>เคลื่อนไหวล่าสุด</th>
                  <th className={THR}>บิล 30 วัน</th>
                  <th className={THR}>ยอดขาย 30 วัน</th>
                  <th className={TH} style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <EmptyState cols={9} icon="🏬" title={q ? 'ไม่พบคลังที่ค้นหา' : 'ยังไม่มีคลังสินค้า'}
                    detail="คลังสินค้าดึงมาจาก ZORT — เพิ่มคลังที่ ZORT แล้วรอบซิงก์ถัดไปจะเข้ามาเอง" />
                )}
                {list.map((w, i) => {
                  const s = statOf(w.code)
                  return (
                    <tr key={w.code} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className={`${TD} text-gray-400`}>{i + 1}</td>
                      <td className={`${TD} text-gray-700 font-medium whitespace-nowrap`}>{w.code}</td>
                      <td className={TD}><span className="text-gray-800">{w.name || w.code}</span></td>
                      <td className={TD}>
                        <span className="text-gray-600">ทั่วไป</span>
                        {/* ⚠️ ธงนี้มาจากเซิร์ฟเวอร์ ไม่ได้เดาจากรหัส — โกดังเปิดบิลขายไม่ได้ */}
                        <span className={`ml-1.5 text-[10.5px] rounded px-1.5 py-0.5 ${
                          w.isPos ? 'text-emerald-800 bg-emerald-100' : 'text-gray-600 bg-gray-100'
                        }`}>
                          {w.isPos ? 'จุดขาย' : 'โกดัง — เปิดบิลไม่ได้'}
                        </span>
                      </td>
                      {/* 🔴 **แก้คำอธิบายที่เคยผิด (4 ก.ย. 2569)** — เคยเขียนว่า
                          "ZORT ไม่เปิดให้ดึงสต็อกแยกตามคลัง" ⇒ อ่านแล้วเข้าใจว่า **ทำไม่ได้**
                          แต่พอเปิดภาพจอจริง (`zort-ui/25-zort-คลังสินค้า-สาขา.jpg`)
                          **ZORT มีตัวเลขนี้อยู่ครบทั้ง 3 คลัง** (โกดัง 16,456,971.3 · KLD 1,562.32 · ANJ 0)
                          ⇒ ของจริงคือ **API ไม่ส่งมา** ไม่ใช่ **ZORT ไม่มี** — คนละเรื่องกัน
                             และแปลว่าคัดตัวเลขมาด้วยมือได้ (ท่าเดียวกับต้นทุนเฉลี่ย 42 หมวด)
                          ⇒ **นี่คือ ⏳ ยังไม่ได้ทำ ไม่ใช่ ❌ ทำไม่ได้** ห้ามเขียนสลับกันอีก */}
                      <td className={TDR}>
                        {typeof w.stockValue === 'number'
                          ? fmtMoney(w.stockValue)
                          : <span className="text-gray-300" title="ยังไม่ได้ดึงมา — จอ ZORT มีตัวเลขนี้อยู่ แต่ API ไม่ส่งค่าแยกรายคลังมา ยังคัดมาด้วยมือได้">—</span>}
                      </td>
                      <td className={TD}>
                        {w.movedAt
                          ? thaiDate(String(w.movedAt).slice(0, 10))
                          : <span className="text-gray-300" title="ยังไม่ได้ดึงมา — จอ ZORT มีช่องนี้ แต่ API ไม่ส่งมา">—</span>}
                      </td>
                      <td className={TDR}>{w.isPos ? fmtNum(s.orders) : <span className="text-gray-300">—</span>}</td>
                      <td className={TDR}>{w.isPos ? fmtMoney(s.amount) : <span className="text-gray-300">—</span>}</td>
                      <td className={`${TD} text-right`}>
                        <RowMenu
                          items={[
                            { label: 'คัดลอกรหัสคลัง', onClick: () => { navigator.clipboard?.writeText(w.code).catch(() => {}) } },
                            ...(w.isPos ? [{ label: 'เปิดจอขายหน้าร้าน', onClick: () => { window.location.href = '/core/pos' } }] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>

          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
            {note || 'คลังสินค้าดึงมาจาก ZORT ทั้งหมด'} ·
            <b> โกดังไม่ใช่จุดขาย</b> จึงไม่มีให้เลือกในจอขายหน้าร้านและไม่มียอดขาย —
            เป็นความตั้งใจ ไม่ใช่ข้อมูลตกหล่น
          </p>
        </>
      )}
    </div>
  )
}
