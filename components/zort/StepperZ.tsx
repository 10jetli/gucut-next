/* 🧭 แถบขั้นแบบ ZORT /Pickandpack/Main (รับสินค้า type=1 · แพ็คสินค้า type=2 ผังเดียวกัน) — ตัวร่วมสองจอ
 *  📐 การ์ดขาวไม่มีขอบ · สามขั้นกลางจอ ต่อด้วยเส้นประ · ขั้นปัจจุบัน = วงน้ำเงินทึบ ไอคอนขาว · ขั้นอื่น = ไอคอนเส้นน้ำเงิน ไม่มีวง
 *  📏 วัด DOM 21 ต.ค. 2569: ขั้นกว้าง 110 ห่างกัน 215 (รวม 540) · วง 36 ไอคอน 18 · ป้าย Kanit 14 / 12 · การ์ดช่องในบนล่าง 12
 *  🎨 ไอคอนวาดเอง (แว่นขยาย · กล่อง · กล่องมีถูก) — ไม่ใช้ไอคอนของ ZORT */

/** ไอคอนขั้นที่ i (0 แว่นขยาย · 1 กล่อง · 2 กล่องมีถูก) — จอที่มีแถบขั้นแบบเดิมใช้ร่วมได้ */
export function ไอคอนขั้น({ i, สี, ขนาด = 22 }: { i: number; สี: string; ขนาด?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={ขนาด} height={ขนาด} fill="none" stroke={สี} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {i === 0 && <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></>}
      {i >= 1 && <><path d="M4 8l8-4 8 4v9l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v9" /></>}
      {i === 2 && <path d="M15 17.5l2 2 3.5-3.5" />}
    </svg>
  )
}

export default function StepperZ({ steps, at }: { steps: readonly string[]; at: number }) {
  return (
    <div className="bg-white rounded-[6px] py-3 mb-[38px] flex justify-center">
      <div className="flex items-start w-full max-w-[540px]">
        {steps.map((s, i) => (
          <div key={s} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center w-[110px] shrink-0">
              <div className="w-9 h-9 rounded-full grid place-items-center" style={i === at ? { background: '#4165ed' } : undefined}>
                <ไอคอนขั้น i={i} สี={i === at ? '#fff' : '#4165ed'} ขนาด={18} />
              </div>
              <p className={`font-['Kanit',sans-serif] text-[14px] leading-[14px] mt-2 ${i <= at ? 'text-[#3e3e3e]' : 'text-[#ced4da]'}`}>ขั้นตอนที่ {i + 1}</p>
              <p className={`font-['Kanit',sans-serif] text-[12px] leading-[18px] ${i <= at ? 'text-[#868e96]' : 'text-[#ced4da]'}`}>{s}</p>
            </div>
            {i < steps.length - 1 && <div className="flex-1 border-t border-dashed border-[#ced4da] mt-[17px] -mx-[28px]" />}
          </div>
        ))}
      </div>
    </div>
  )
}
