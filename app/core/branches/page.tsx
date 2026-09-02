'use client'
// คลังสินค้า/สาขา — ตัวแทนหน้า "สินค้า → คลังสินค้า/สาขา" ของ ZORT
//
// ใช้ข้อมูลชุดเดียวกับตัวเลือกสาขาในจอขายหน้าร้าน (/api/core?list=branches)
// พร้อมยอดขาย 30 วันของแต่ละสาขา ซึ่งอ่านจากช่องทาง "POS <รหัสสาขา>" ในคลังเงา
//
// ⚠️ ของจริงที่ ZORT มี 3 คลัง (โกดัง · KLD · ANJ) แต่ **"โกดัง" ไม่ใช่จุดขาย**
//    จึงไม่มีในรายการสาขาของ POS — เขียนบอกไว้ ไม่งั้นดูเหมือนตกหล่น
import { useCallback, useEffect, useState } from 'react'
import { fmtBaht, fmtNum } from '@/lib/format'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost, TableWrap, TH, THR, TD, TDR } from '@/components/zort'

interface Branch { code: string; name: string }
interface ChannelRow { channel: string; orders: number; amount: number }

const thaiDay = (back = 0) =>
  new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10)

export default function CoreBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [byChannel, setByChannel] = useState<ChannelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [bRes, cRes] = await Promise.all([
        fetch('/api/web/core?list=branches').then((r) => r.json()),
        fetch(`/api/web/core?list=orders&from=${thaiDay(30)}&to=${thaiDay(0)}&limit=1`).then((r) => r.json()),
      ])
      if (bRes?.error) throw new Error(bRes.error)
      setBranches(Array.isArray(bRes?.branches) ? bRes.branches : [])
      setByChannel(Array.isArray(cRes?.byChannel) ? cRes.byChannel : [])
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
      setBranches([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /** ยอดของสาขานั้นใน 30 วัน — จับจากชื่อช่องทางที่มีรหัสสาขาอยู่ */
  const statOf = (code: string) => {
    const rows = byChannel.filter((c) => new RegExp(`\\b${code}\\b`, 'i').test(c.channel))
    return {
      orders: rows.reduce((s, r) => s + (Number(r.orders) || 0), 0),
      amount: rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    }
  }

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="คลังสินค้า/สาขา"
        summary={`จำนวน ${branches.length.toLocaleString('th-TH')} สาขาที่เปิดขายหน้าร้าน · ยอดขาย 30 วันล่าสุด`}
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'รีเฟรช'}</BtnGhost>}
      />

      {error && <ErrorBox title="ดึงรายชื่อสาขาไม่ได้">{error}</ErrorBox>}
      {loading && branches.length === 0 && <LoadingState />}

      {!loading && !error && (
        <>
          <TableWrap>
            <table className="w-full min-w-[520px]">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className={TH} style={{ width: 44 }}>#</th>
                  <th className={TH}>สาขา</th>
                  <th className={TH}>รหัส</th>
                  <th className={THR}>บิล 30 วัน</th>
                  <th className={THR}>ยอดขาย 30 วัน</th>
                </tr>
              </thead>
              <tbody>
                {branches.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-[13px] text-gray-400 text-center">ยังไม่มีสาขา</td></tr>
                )}
                {branches.map((b, i) => {
                  const s = statOf(b.code)
                  return (
                    <tr key={b.code} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className={`${TD} text-gray-400`}>{i + 1}</td>
                      <td className={`${TD} text-gray-800 font-medium`}>{b.name || b.code}</td>
                      <td className={`${TD} text-gray-400`}>{b.code}</td>
                      <td className={TDR}>{fmtNum(s.orders)}</td>
                      <td className={TDR}>{fmtBaht(s.amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>

          <p className="text-[12px] text-gray-500 mt-3 leading-relaxed">
            ⚠️ ใน ZORT มี 3 คลัง (โกดัง · KLD · ANJ) แต่ <b>&quot;โกดัง&quot; เป็นคลังเก็บของ ไม่ใช่จุดขาย</b>
            จึงไม่อยู่ในรายการนี้ · ยอดขายอ่านจากช่องทางที่มีรหัสสาขาอยู่ในชื่อ
            (เช่น &quot;POS KLD&quot;) ⇒ บิลที่เปิดผ่านแอป ZORT ยังไม่ถูกนับมาที่นี่จนกว่าจะเลิกใช้ ZORT
          </p>
        </>
      )}
    </div>
  )
}
