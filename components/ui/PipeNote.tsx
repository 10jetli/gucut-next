// ข้อความที่ท่อส่งมา — แสดงให้อ่านรู้เรื่อง (18 ก.ย. 2569)
//
// 🔴 ปัญหาที่ตัวนี้เกิดมาแก้: ฝั่งท่อเขียนหมายเหตุด้วย **ดาวคู่** แบบ markdown
//    (`⚠️ ขอบเขต`, `pagingNote`, `safetyNote`, `readNote` — ของจริงทุกตัวมีดาว)
//    จอเอามาแปะตรง ๆ ⇒ คนอ่านเห็น `**สองเหตุนี้ไม่ใช่ error**` ทั้งดาว
//    = ค่าดิบหลุดขึ้นจอ · และที่แย่กว่าคือ **ส่วนที่ท่อตั้งใจเน้นกลายเป็นส่วนที่อ่านยากที่สุด**
//
// ⚠️ ตั้งใจรองรับแค่ `**ตัวหนา**` อย่างเดียว — ไม่ใช่ตัวแปล markdown
//    ข้อความจากท่อคือ**ข้อมูล ไม่ใช่โค้ด** ⇒ ห้ามแตะ dangerouslySetInnerHTML เด็ดขาด
//    ตัวนี้ตัดเป็นชิ้น ๆ แล้วให้ React วางเป็นข้อความล้วน จึงฝัง HTML เข้ามาไม่ได้
//    ดาวที่ไม่จับคู่จะถูกทิ้งไว้ตามเดิม (เห็นดาวดีกว่ากลืนคำของท่อหาย)
import { Fragment, type ReactNode } from 'react'

export function pipeText(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part)
      ? <b key={i}>{part.slice(2, -2)}</b>
      : <Fragment key={i}>{part}</Fragment>
  )
}

/** ย่อหน้าหมายเหตุจากท่อ — ใช้ตัวนี้แทนการแปะ {note} ตรง ๆ */
export default function PipeNote({ children, className }: { children?: string | null; className?: string }) {
  if (!children) return null
  return <span className={className}>{pipeText(children)}</span>
}
