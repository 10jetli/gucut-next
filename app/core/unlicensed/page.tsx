'use client'

/* หน้า "เลื่อย/บาร์ ไม่มีทะเบียน" — ท่านประธานสั่งเอง 9 ต.ค. 2569
   "ผมจะได้ดูง่ายๆ รวมถึงคุณก็จะได้ดูง่ายๆ"

   🔒 **หน้าดูอย่างเดียว — ห้ามมีปุ่มแก้ไขหรือปุ่มดันสต็อก**
      ของกลุ่มนี้ขายผ่านแชท/โทรแล้วเปิดบิลใน ZORT เอง · ท่านสั่งไว้ว่าห้ามไปยุ่งฝั่งนั้น
      (~/claude-shared/กฎ-สองสายขาย-ห้ามรวม.md · ปนกับของทะเบียน = ขายผิดราคาและผิดกฎหมาย)

   🔑 **วิธีคัดของที่ไม่มีทะเบียน — ใช้ช่องหมวด ไม่เดาจากชื่อสินค้า**
      กติกา: ชื่อหมวด **ขึ้นต้นด้วย** `บาร์ ` หรือ `เลื่อยยนต์ ` **และไม่มีคำว่า** `มีทะเบียน`
      📏 วัดกับของจริง 9 ต.ค. 2569: ได้ 4 หมวด 46 SKU ตรงกับที่ CEO นับไว้เป๊ะ
         บาร์ KINGKONG 16 · บาร์ NEWWAVE 11 · เลื่อยยนต์ NEWWAVE 8 · เลื่อยยนต์ Series F 11

      ⚠️ **ทำไม "ขึ้นต้นด้วย" ไม่ใช่ "มีคำว่า"** — รอบแรกผมใช้ "มีคำว่า เลื่อย/บาร์" ได้ 6 หมวด 53 SKU
         เพราะเก็บ `น้ำมันเลื่อย` (2) กับ `ใบเลื่อยวงเดือน STIHL, OREGON` (5) มาด้วย
         ซึ่งไม่ใช่เลื่อยโซ่ยนต์หรือบาร์โซ่ ⇒ แก้เป็น "ขึ้นต้นด้วย" ⇒ ตรง 46
      🚫 **ไม่ฮาร์ดโค้ดรายชื่อ 4 หมวด** — ร้านเพิ่มยี่ห้อใหม่ (เช่น `บาร์ XYZ`) หน้านี้เก็บเอง
      ⚠️ ถ้ากติกาได้จำนวนไม่ตรงที่คาด **จอจะเขียนเตือนบนหน้า** ไม่ดัดตัวเลขให้ตรง

   📡 แหล่งข้อมูล: `/api/web/core?list=categories` (หารายชื่อหมวด)
                   `/api/web/core?list=stock&category=<ชื่อหมวด>` (รายตัวในหมวดนั้น)
      📏 ยิงพิสูจน์ 9 ต.ค. 2569: `category=บาร์ NEWWAVE` ⇒ total 2,674 → **11** ตรงกับจำนวนในหมวด
      ⚠️ **ช่อง `applied` ของท่อไม่ประกาศ `category`** ทั้งที่กรองได้จริง ⇒ สัญญาของท่อค้าง
         (เส้นเดียวกันเคยวัดว่า `cat=` ถูกเมิน — คนละชื่อพารามิเตอร์ ห้ามสับสน)
      ⇒ ถ้าวันหนึ่งท่อเลิกรับ `category` จอจะได้ของทั้งคลังมาแทน ⇒ จึง **ตรวจจำนวนกับ list=categories ทุกครั้ง**

   ⚠️ ดึงไม่สำเร็จต้องบอกว่าดึงไม่สำเร็จ **ห้ามโชว์ 0** (ไม่รู้ ≠ ไม่มีของ) */

import { useCallback, useEffect, useState } from 'react'
import { fmtBaht, fmtNum } from '@/lib/format'
/* 🔑 กติกาคัดหมวดอยู่ที่ lib/unlicensed.ts **ที่เดียว** — เพจไม่เขียนซ้ำ
   เหตุ: เขียนซ้ำ = สองแหล่งความจริง แก้ฝั่งเดียวแล้วเพี้ยนกันเงียบ ๆ
   และเทส scripts/tests/unlicensed.test.mjs เรียก **ตัวจริงตัวนี้** ไม่ได้ลอกเงื่อนไข */
import { กลุ่มของหมวด, หมวดไม่มีทะเบียน } from '@/lib/unlicensed'

type แถวสต็อก = {
  sku?: string
  name?: string
  qty?: number | null
  buy?: number | null
  price?: number | null
  unit?: string | null
  active?: number | boolean | null
}
type รายการ = แถวสต็อก & { หมวด: string; กลุ่ม: 'เลื่อย' | 'บาร์' }

const น = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

export default function หน้าไม่มีทะเบียน() {
  const [กำลังโหลด, ตั้งกำลังโหลด] = useState(true)
  const [พลาด, ตั้งพลาด] = useState<string | null>(null)
  const [รายการทั้งหมด, ตั้งรายการ] = useState<รายการ[]>([])
  const [หมวดที่ใช้, ตั้งหมวดที่ใช้] = useState<{ ชื่อ: string; คาด: number; ได้: number }[]>([])
  const [ดึงเมื่อ, ตั้งดึงเมื่อ] = useState<string>('')

  const โหลด = useCallback(async () => {
    ตั้งกำลังโหลด(true)
    ตั้งพลาด(null)
    try {
      const rc = await fetch('/api/web/core?list=categories', { cache: 'no-store' })
      if (!rc.ok) throw new Error(`อ่านรายชื่อหมวดไม่ได้ (ท่อตอบ ${rc.status})`)
      const jc = await rc.json()
      const หมวดทั้งหมด: { cat_name?: string; skus?: number }[] = jc?.rows || []
      if (!หมวดทั้งหมด.length) throw new Error('ท่อส่งรายชื่อหมวดมาว่าง — ยังไม่รู้ว่ามีหมวดอะไร')

      const เลือก = หมวดทั้งหมด
        .map((x) => ({ ชื่อ: String(x.cat_name || '').trim(), คาด: Number(x.skus || 0) }))
        .filter((x) => หมวดไม่มีทะเบียน(x.ชื่อ))
      if (!เลือก.length) throw new Error('กติกาคัดหมวดไม่เจอหมวดไหนเลย — กติกาหรือชื่อหมวดเปลี่ยนไป')

      const รวม: รายการ[] = []
      const สรุปหมวด: { ชื่อ: string; คาด: number; ได้: number }[] = []
      for (const ม of เลือก) {
        const r = await fetch(
          `/api/web/core?list=stock&limit=200&category=${encodeURIComponent(ม.ชื่อ)}`,
          { cache: 'no-store' },
        )
        if (!r.ok) throw new Error(`อ่านสต็อกหมวด "${ม.ชื่อ}" ไม่ได้ (ท่อตอบ ${r.status})`)
        const j = await r.json()
        const แถว: แถวสต็อก[] = j?.rows || []
        สรุปหมวด.push({ ชื่อ: ม.ชื่อ, คาด: ม.คาด, ได้: แถว.length })
        for (const x of แถว) รวม.push({ ...x, หมวด: ม.ชื่อ, กลุ่ม: กลุ่มของหมวด(ม.ชื่อ) })
      }
      ตั้งรายการ(รวม)
      ตั้งหมวดที่ใช้(สรุปหมวด)
      ตั้งดึงเมื่อ(new Date().toLocaleString('th-TH'))
    } catch (e) {
      ตั้งพลาด(e instanceof Error ? e.message : String(e))
      ตั้งรายการ([])          // ⚠️ ล้างของเก่าทิ้ง — ห้ามโชว์เลขเก่าคู่กับข้อความว่าดึงไม่สำเร็จ
      ตั้งหมวดที่ใช้([])
    } finally {
      ตั้งกำลังโหลด(false)
    }
  }, [])

  useEffect(() => { void โหลด() }, [โหลด])

  if (กำลังโหลด) {
    return <div className="p-6 text-sm text-gray-600">กำลังอ่านของจริงจากคลัง…</div>
  }
  if (พลาด) {
    return (
      <div className="p-6">
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm">
          <div className="font-semibold text-red-700">🔴 ดึงข้อมูลไม่สำเร็จ — ตัวเลขบนหน้านี้จึงยังไม่รู้</div>
          <div className="mt-1 text-red-800">{พลาด}</div>
          <div className="mt-2 text-gray-700">
            ไม่แสดงตัวเลขใด ๆ เพราะ <b>&quot;ไม่รู้&quot; ไม่ใช่ &quot;ไม่มีของ&quot;</b> — การโชว์ 0 ตอนนี้จะทำให้เข้าใจผิดว่าของหมด
          </div>
          <button onClick={() => void โหลด()} className="mt-3 rounded border px-3 py-1 text-sm">ลองอีกครั้ง</button>
        </div>
      </div>
    )
  }

  const ไม่รู้จำนวน = รายการทั้งหมด.filter((x) => น(x.qty) === null)
  const จำนวนรวม = รายการทั้งหมด.reduce((s, x) => s + (น(x.qty) ?? 0), 0)
  const ทุนรวม = รายการทั้งหมด.reduce((s, x) => s + (น(x.qty) ?? 0) * (น(x.buy) ?? 0), 0)
  const ต้องดู = รายการทั้งหมด.filter((x) => (น(x.qty) ?? 1) <= 0)
  const ไม่ตรง = หมวดที่ใช้.filter((m) => m.คาด !== m.ได้)

  /* 🪚 **ด่านหน่วย** — วัดของจริง 9 ต.ค. 2569: ทั้ง 46 รหัสเป็นชิ้น
     (เจอ `PCS` 45 · `pcs` 1 — ต่างแค่ตัวพิมพ์ ⇒ หน่วยเดียวกัน จึงรวมได้)
     🔑 เหตุที่ต้องมีด่าน ไม่ใช่แค่ความเรียบร้อย:
        คลังนี้มีของที่ **หน่วยคือฟัน ไม่ใช่ชิ้น** (โซ่ม้วน 820 ฟัน/ม้วน · 740 · 920 · 1,200)
        ถ้าวันหนึ่งมีรหัสหน่วยอื่นหลุดเข้าหมวดที่ขึ้นต้น `บาร์ `/`เลื่อยยนต์ `
        ยอด "รวมคงเหลือ" จะกลายเป็น ฟัน+ชิ้น บวกกัน = เลขที่ไม่มีความหมาย
        **และไม่มีอะไรฟ้อง** เพราะหน้าจอยังดูปกติทุกประการ ⇒ ให้จอบอกเองว่าหน่วยปน */
  /* ⚠️ ไม่ใช้ [...new Set()] — tsconfig ของรีโปตั้ง target ต่ำกว่า es2015 (TS2802) */
  const หน่วยที่เจอ = รายการทั้งหมด
    .map((x) => String(x.unit ?? '').trim().toUpperCase())
    .filter((u, i, a) => u !== '' && a.indexOf(u) === i)
  const หน่วยปน = หน่วยที่เจอ.length > 1
  const คำหน่วย = หน่วยปน ? 'หน่วยปนกัน' : 'ชิ้น'

  const กลุ่ม: ('เลื่อย' | 'บาร์')[] = ['เลื่อย', 'บาร์']

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold">เลื่อย/บาร์ ไม่มีทะเบียน</h1>
        <div className="mt-1 text-sm text-gray-600">
          ของกลุ่มนี้ <b>ขายผ่านแชท/โทร</b> ไม่ขึ้น Shopee/Lazada/TikTok ·{' '}
          <span className="rounded bg-gray-100 px-1.5 py-0.5">หน้าดูอย่างเดียว — ไม่มีปุ่มแก้ไขหรือดันสต็อก</span>
        </div>
      </div>

      {/* ③ ตัวเลขสรุปบนสุด */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { ป้าย: 'รายการ', ค่า: fmtNum(รายการทั้งหมด.length), ย่อย: `${หมวดที่ใช้.length} หมวด` },
          {
            ป้าย: 'รวมคงเหลือ',
            ค่า: หน่วยปน ? 'รวมไม่ได้' : fmtNum(จำนวนรวม),
            ย่อย: หน่วยปน ? '🔴 หน่วยปนกัน — ดูคำเตือน' : คำหน่วย,
          },
          { ป้าย: 'มูลค่าทุนคงเหลือ', ค่า: fmtBaht(ทุนรวม), ย่อย: 'คงเหลือ × ราคาซื้อ' },
          { ป้าย: 'ต้องดู (0 หรือติดลบ)', ค่า: fmtNum(ต้องดู.length), ย่อย: 'รายการ' },
        ].map((k) => (
          <div key={k.ป้าย} className="rounded border bg-white p-3">
            <div className="text-xs text-gray-500">{k.ป้าย}</div>
            <div className="text-lg font-semibold">{k.ค่า}</div>
            <div className="text-xs text-gray-500">{k.ย่อย}</div>
          </div>
        ))}
      </div>

      {/* ⚠️ กติกาได้จำนวนไม่ตรงกับทะเบียนหมวด ⇒ เขียนเตือน ไม่ดัดตัวเลข */}
      {ไม่ตรง.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <b>⚠️ จำนวนที่ดึงมาไม่ตรงกับที่ทะเบียนหมวดบอก</b> — แสดงของที่ดึงได้จริงไว้ก่อน ไม่ดัดตัวเลขให้ตรง
          <ul className="mt-1 list-inside list-disc">
            {ไม่ตรง.map((m) => (
              <li key={m.ชื่อ}>{m.ชื่อ}: ทะเบียนหมวดบอก {m.คาด} · ดึงได้ {m.ได้}</li>
            ))}
          </ul>
        </div>
      )}

      {หน่วยปน && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm">
          <b>🔴 หน่วยในหมวดนี้ปนกัน {หน่วยที่เจอ.join(' · ')}</b> — จึง<b>ไม่รวม</b>เป็นเลขเดียวให้
          <div className="mt-1 text-gray-700">
            คลังนี้มีของที่นับเป็น <b>ฟัน</b> (โซ่ม้วน) ไม่ใช่ชิ้น · บวกข้ามหน่วยแล้วได้เลขที่ไม่มีความหมาย
            ⇒ ดูยอดรายตัวในตารางด้านล่างแทน
          </div>
        </div>
      )}

      {ไม่รู้จำนวน.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <b>⚠️ {ไม่รู้จำนวน.length} รายการที่ท่อไม่ส่งจำนวนมา</b> — แสดงเป็น &quot;—&quot; ไม่ใช่ 0
          และ <b>ไม่ถูกนับ</b> ในยอดรวมข้างบน
        </div>
      )}

      {/* ④ ชี้ตัวที่ 0 หรือติดลบ */}
      {ต้องดู.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm">
          <b>🔴 {ต้องดู.length} รายการคงเหลือ 0 หรือติดลบ</b> — ของกลุ่มนี้ขายผ่านแชท
          ถ้าติดลบแปลว่ามีอะไรไม่ตรง (ขายแล้วยังไม่ได้รับของเข้า หรือเปิดบิลซ้ำ)
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ต้องดู.map((x) => (
              <span key={x.sku} className={`rounded px-1.5 py-0.5 text-xs ${(น(x.qty) ?? 0) < 0 ? 'bg-red-200' : 'bg-gray-200'}`}>
                {x.sku} ({น(x.qty) ?? '—'})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ② แยกกลุ่มเลื่อย / บาร์ · ① ตารางรายตัว */}
      {กลุ่ม.map((ก) => {
        const แถว = รายการทั้งหมด.filter((x) => x.กลุ่ม === ก)
        if (!แถว.length) return null
        const ชิ้น = แถว.reduce((s, x) => s + (น(x.qty) ?? 0), 0)
        const ทุน = แถว.reduce((s, x) => s + (น(x.qty) ?? 0) * (น(x.buy) ?? 0), 0)
        return (
          <div key={ก} className="rounded border bg-white">
            <div className="flex flex-wrap items-baseline gap-x-3 border-b bg-gray-50 px-3 py-2">
              <h2 className="font-semibold">{ก}</h2>
              <span className="text-sm text-gray-600">
                {fmtNum(แถว.length)} รายการ · {fmtNum(ชิ้น)} ชิ้น · ทุน {fmtBaht(ทุน)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-600">
                  <tr>
                    <th className="px-3 py-2">รหัส</th>
                    <th className="px-3 py-2">ชื่อ</th>
                    <th className="px-3 py-2">หมวด</th>
                    <th className="px-3 py-2 text-right">คงเหลือ</th>
                    <th className="px-3 py-2 text-right">ราคาขาย</th>
                    <th className="px-3 py-2">ขายช่องทางไหน</th>
                  </tr>
                </thead>
                <tbody>
                  {แถว
                    .slice()
                    .sort((a, b) => (น(a.qty) ?? 1e9) - (น(b.qty) ?? 1e9))
                    .map((x) => {
                      const q = น(x.qty)
                      return (
                        <tr key={`${x.หมวด}-${x.sku}`} className="border-t">
                          <td className="px-3 py-1.5 font-mono text-xs">{x.sku}</td>
                          <td className="px-3 py-1.5">{x.name || <span className="text-gray-400">(ไม่มีชื่อ)</span>}</td>
                          <td className="px-3 py-1.5 text-xs text-gray-600">{x.หมวด}</td>
                          <td className={`px-3 py-1.5 text-right ${q === null ? 'text-gray-400' : q < 0 ? 'bg-red-100 font-semibold text-red-700' : q === 0 ? 'bg-gray-100 text-gray-600' : ''}`}>
                            {q === null ? '—' : fmtNum(q)}
                            {x.unit ? <span className="ml-1 text-xs text-gray-500">{x.unit}</span> : null}
                          </td>
                          <td className="px-3 py-1.5 text-right">{น(x.price) === null ? '—' : fmtBaht(น(x.price) as number)}</td>
                          <td className="px-3 py-1.5 text-xs text-gray-600">แชท / โทร</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* ⑤ ป้ายบอกที่มาและเวลา */}
      <div className="rounded border bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
        <div><b>ที่มาของตัวเลข:</b> <code>/api/web/core?list=categories</code> (รายชื่อหมวด) + <code>?list=stock&amp;category=&lt;หมวด&gt;</code> (รายตัว) — คลัง ZORT ผ่านกระจกของร้าน</div>
        <div className="mt-0.5"><b>ดึงเมื่อ:</b> {ดึงเมื่อ || '—'} · กดรีเฟรชหน้าเพื่อดึงใหม่</div>
        <div className="mt-0.5">
          <b>กติกาคัดของไม่มีทะเบียน:</b> ชื่อหมวดขึ้นต้นด้วย <code>บาร์ </code> หรือ <code>เลื่อยยนต์ </code> และไม่มีคำว่า <code>มีทะเบียน</code>
          {' '}— ใช้ <b>ช่องหมวด</b> ไม่เดาจากชื่อสินค้า · ไม่ฮาร์ดโค้ดรายชื่อหมวด
        </div>
        <div className="mt-0.5">หมวดที่เข้าเกณฑ์รอบนี้: {หมวดที่ใช้.map((m) => `${m.ชื่อ} (${m.ได้})`).join(' · ') || '—'}</div>
        <div className="mt-0.5"><b>มูลค่าทุนคงเหลือ</b> = คงเหลือ × ราคาซื้อ · รายการที่ไม่รู้จำนวนไม่ถูกนับ</div>
      </div>
    </div>
  )
}
