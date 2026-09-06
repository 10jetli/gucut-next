// กล่องแสดงข้อผิดพลาดพื้นแดง — หัวข้อ + รายละเอียดตามแต่ละหน้า
//
// 🔴 **แปลข้อความของเครื่องเป็นภาษาคน — เพราะคนอ่านคือเจ้าของร้าน ไม่ใช่โปรแกรมเมอร์**
//    เจอด้วยท่อปลอมโหมด "ตอบ HTML แทน JSON" (6 ก.ย. 2569 · เกิดจริงเวลาเจอหน้า error ของ Netlify)
//    จอขึ้นว่า: Unexpected token '<', "<html><bod"... is not valid JSON
//    ⇒ ถูกต้องทางเทคนิค แต่ **บอกไม่ได้ว่าต้องทำอะไรต่อ** และอ่านแล้วเหมือนเว็บเราพัง
//    ⇒ แปลเป็นไทยที่ตัวกล่องจุดเดียว ทุกจอที่ใช้กล่องนี้ได้ผลพร้อมกัน (แก้ทีละจอ = ตกหล่นแน่นอน)
//
// ⚠️ **ห้ามทิ้งข้อความต้นฉบับ** — ต้องยังโชว์ตัวเล็ก ๆ ไว้เสมอ
//    คนที่ไล่ปัญหา (เรา) ต้องเห็นของจริง · ซ่อนของจริงเพื่อความสวยคือทำให้แก้ยากขึ้น
// ⚠️ **แปลเฉพาะแบบที่รู้จักจริง ๆ** ที่เหลือปล่อยผ่านตามเดิม — เดาความหมายผิดแล้วชี้ทางผิด
//    แย่กว่าปล่อยข้อความอังกฤษไว้เฉย ๆ

/** ข้อความที่รู้จัก → คำอธิบายไทย + บอกว่าทำอะไรต่อ */
const KNOWN: { match: RegExp; th: string }[] = [
  {
    // เจอตอนปลายทางส่งหน้า HTML (หน้า error ของผู้ให้บริการ) มาแทนข้อมูล
    match: /is not valid JSON|Unexpected token|Failed to execute 'json'|Unexpected end of JSON/i,
    th: 'เซิร์ฟเวอร์ตอบกลับมาไม่ใช่ข้อมูล (น่าจะเป็นหน้าแสดงข้อผิดพลาดของผู้ให้บริการ) — ลองรีเฟรชอีกครั้ง ถ้ายังเหมือนเดิมแปลว่าฝั่งเซิร์ฟเวอร์มีปัญหาอยู่ ไม่ใช่ข้อมูลหาย',
  },
  {
    match: /Failed to fetch|NetworkError|Load failed/i,
    th: 'ต่อกับเซิร์ฟเวอร์ไม่ได้ — เช็คอินเทอร์เน็ตก่อน แล้วกดรีเฟรชอีกครั้ง',
  },
  {
    match: /aborted|timeout|TimeoutError/i,
    th: 'เซิร์ฟเวอร์ตอบช้าเกินกำหนดจนถูกตัดกลางทาง — ข้อมูลไม่ได้หาย ลองกดรีเฟรชอีกครั้ง',
  },
]

function explain(children: React.ReactNode): { th: string; raw: string } | null {
  if (typeof children !== 'string') return null
  const hit = KNOWN.find((k) => k.match.test(children))
  return hit ? { th: hit.th, raw: children } : null
}

export default function ErrorBox({
  title = 'โหลดไม่ได้',
  children,
}: { title?: string; children?: React.ReactNode }) {
  const friendly = explain(children)
  return (
    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-600 flex gap-3">
      <span className="text-lg leading-none shrink-0">⚠️</span>
      <div>
        <p className="font-semibold">{title}</p>
        {friendly ? (
          <>
            <p className="leading-relaxed">{friendly.th}</p>
            <p className="text-[11.5px] text-red-400 mt-1 break-all">({friendly.raw})</p>
          </>
        ) : children}
      </div>
    </div>
  )
}
