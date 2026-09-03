'use client'
// จอทะเบียนของ ZORT ที่ **ว่างเปล่าจริง ๆ ทุกจอ** — **ลอกจากภาพจริงทีละใบ**
//   รายได้อื่น            `zort-ui/53-zort-รายได้อื่น.jpg`
//   รายจ่ายอื่น           `zort-ui/28-zort-รายจ่ายอื่น-ว่าง-empty-state.jpg`
//   รายการโอนเงิน         `zort-ui/54-zort-รายการโอนเงิน.jpg`
//   สินค้าหลากคุณสมบัติ   `zort-ui/30-zort-สินค้าหลากคุณสมบัติ-ว่าง.jpg`
//   เซลเพจ (Sale pages)   `zort-ui/10-ร้านค้าออนไลน์-เซลเพจ-ว่าง.jpg`
//   เอกสารบัญชี           `zort-ui/18-เอกสารบัญชี-ว่าง.jpg`
//
// ทุกจอที่ ZORT **ว่างเปล่าจริง ๆ (0 รายการ)** เพราะร้านไม่ได้ใช้ / ลงบัญชีที่ PEAK
// ⇒ ทำผังให้เหมือนตามกฎ "เหมือน ZORT 100%" แต่ **ห้ามเขียนว่า "0 รายการ" ลอย ๆ**
//    เพราะเรายังไม่ได้ต่อท่อกับ ZORT เลย ⇒ ศูนย์ของเราแปลว่า "ยังไม่รู้" ไม่ใช่ "ไม่มี"
//    ⚠️ ตัวเลข 0 ที่ไม่มีที่มา คือคำกล่าวอ้างที่เราพิสูจน์ไม่ได้ — ตระกูลเดียวกับ
//       ตัวตรวจขึ้นเขียวทั้งที่ของจริงพัง
//
// ⚠️ ปุ่ม "สร้าง…" กับ "นำเข้าไฟล์" พาไปหน้าที่บอกตรง ๆ ว่ายังทำอะไรไม่ได้
//    ห้ามทำปุ่มที่กดแล้วไม่เกิดอะไร — คนใช้จะกดซ้ำแล้วนึกว่าระบบพัง
import Link from 'next/link'
import { PageHead, TableWrap, TH, THR } from './index'

export interface LedgerCol { label: string; right?: boolean }

export default function LedgerScreen({
  title, cols, createLabel, soonKey, withImport, withTabs, tabs, dateLine, noCreate, sumLabel, purpose, meanwhile,
}: {
  title: string
  cols: LedgerCol[]
  createLabel: string
  /** คีย์ใน lib/zort-menu.ts — หน้าที่บอกว่ายังทำอะไรไม่ได้ */
  soonKey: string
  withImport?: boolean
  /** ZORT มีแท็บ ทั้งหมด · รอชำระ (0) · สำเร็จ เฉพาะจอรายได้/รายจ่าย */
  withTabs?: boolean
  /** แท็บชุดอื่น (เช่น จอเอกสารบัญชีมี 6 แท็บตามชนิดเอกสาร) — ใส่มาแล้วทับ withTabs */
  tabs?: string[]
  /** บรรทัดช่วงวันที่ใต้ช่องค้นหาแบบ ZORT เช่น "วันที่:2/6/2569-2/9/2569" */
  dateLine?: string
  /** ไม่มีปุ่มสร้างในจอนั้น (เช่น ZORT จอเอกสารบัญชีไม่มี) */
  noCreate?: boolean
  /** ข้อความสรุปใต้ชื่อจอแบบ ZORT — ต่างกันคำว่า "มูลค่า" กับ "จำนวนเงิน" */
  sumLabel: string
  /** ZORT เขียนอะไรไว้ในกล่องว่าง — เอาไว้บอกว่าจอนี้มีไว้ทำอะไร */
  purpose: string
  /** ตอนนี้ร้านทำเรื่องนี้ที่ไหน */
  meanwhile: string
}) {
  return (
    <div className="p-4 md:p-6">
      <PageHead
        title={title}
        // ⚠️ ZORT เขียน "จำนวน 0 รายการ, …0 บาท" — ของเราเขียนแบบนั้นไม่ได้
        //    เพราะเราไม่ได้นับอะไรเลย ต้องบอกว่ายังไม่ได้ต่อ
        summary={<span>ยังไม่ได้ต่อกับ ZORT — ที่ ZORT ตอนนี้ {sumLabel}</span>}
        actions={
          <>
            {withImport && (
              <Link href={`/core/soon/${soonKey}`}
                className="text-[13px] font-medium text-gray-600 bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-50">
                นำเข้าไฟล์ (Excel)
              </Link>
            )}
            {!noCreate && (
              <Link href={`/core/soon/${soonKey}`}
                className="text-[13px] font-semibold text-white rounded-full px-4 py-1.5"
                style={{ background: '#1b3b73' }}>
                {createLabel}
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input placeholder="พิมพ์คำค้นหา" disabled
          className="w-full max-w-[400px] text-[13px] border border-gray-300 rounded-full px-4 py-2 bg-gray-50 text-gray-400" />
        <span className="text-[13px] text-gray-300">ค้นหาขั้นสูง</span>
      </div>

      {dateLine && <p className="text-[12.5px] text-gray-600 mb-2">{dateLine}</p>}

      {(withTabs || tabs) && (
        <div className="flex flex-wrap items-center gap-6 border-b border-gray-200 mb-0 px-1">
          {(tabs ?? ['ทั้งหมด', 'รอชำระ', 'สำเร็จ']).map((t, i) => (
            <span key={t}
              className={`text-[13.5px] pb-2 ${i === 0 ? 'text-blue-600 border-b-2 border-blue-600 font-medium' : 'text-gray-400'}`}>
              {t}
            </span>
          ))}
        </div>
      )}

      <TableWrap>
        <table className="w-full min-w-[720px]">
          <thead className="bg-white border-b border-gray-200">
            <tr>
              <th className={TH} style={{ width: 44 }}>#</th>
              {cols.map((c) => <th key={c.label} className={c.right ? THR : TH}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={cols.length + 1} className="py-14 text-center">
                <span className="text-[34px] block opacity-60">🗂️</span>
                <p className="text-[14px] text-gray-800 mt-2">ยังไม่ได้ต่อท่อกับ ZORT</p>
                <p className="text-[12.5px] text-gray-500 mt-1 max-w-[520px] mx-auto leading-relaxed">
                  {purpose}
                  <br />
                  {/* 🔴 ประโยคนี้คือหัวใจของจอนี้ — ห้ามถอด
                      ตารางว่างที่ไม่บอกเหตุผล จะถูกอ่านว่า "ร้านไม่มีรายการพวกนี้เลย" */}
                  ตารางว่างเพราะ<b>ยังไม่ได้ดึงข้อมูล</b> ไม่ใช่เพราะร้านไม่มีรายการ ·
                  ที่ ZORT ตรวจเมื่อ 3 ก.ย. 2569 มี <b>0 รายการ</b> · {meanwhile}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </TableWrap>

      <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">
        ผังจอลอกจาก ZORT ของจริง{!noCreate && <> · ปุ่ม <b>{createLabel}</b></>}
        {withImport && <> และ <b>นำเข้าไฟล์ (Excel)</b></>}{!noCreate && ' ยังทำงานไม่ได้ กดแล้วจะบอกว่าติดอะไรอยู่ · '}
        <b> ไม่มีปุ่ม Export to Excel</b> แบบ ZORT เพราะไม่มีข้อมูลให้ส่งออก — ปุ่มที่กดแล้วได้ไฟล์เปล่า
        แย่กว่าไม่มีปุ่ม
      </p>
    </div>
  )
}
