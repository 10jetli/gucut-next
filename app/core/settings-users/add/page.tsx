// ตั้งค่า → ผู้ใช้งาน → **เพิ่มผู้ใช้งาน** (เจ้าของร้านสั่ง 8 ก.ย. 2569 "ผมจะเพิ่มผู้ใช้งาน")
//
// เดิมปุ่มนี้พาไปหน้า /core/soon/user-add ซึ่งเป็นหน้า "ยังไม่ได้ทำ" กลาง ๆ
// บอกแค่ว่า "ไปตั้งที่ Netlify" แล้วจบ — คนกดยังต้องไปหาเองว่าตั้งช่องไหน ตั้งยังไง
// จอนี้ทำหน้าที่นั้นให้ครบ: บอกช่องที่ว่างจริง · ชื่อตัวแปรเป๊ะ ๆ · ลิงก์ตรงไปหน้าตั้งค่า
//
// 🔴 **ไม่ทำฟอร์มตั้งรหัสบนเว็บโดยตั้งใจ** (นโยบายเดิม ห้ามแก้กลับ)
//    ฟอร์มที่ตั้งรหัสได้ = รหัสวิ่งผ่านหน้าเว็บและผ่านเซิร์ฟเวอร์เรา แล้วต้องเก็บไว้อ่านได้
//    ให้เจ้าของร้านพิมพ์รหัสในหน้าตั้งค่าของ Netlify เองที่เดียวปลอดภัยกว่า
//
// 🔴 **พิสูจน์แล้วด้วยการยิงจริง 8 ก.ย. 2569: ใส่ env แล้ว "ยังล็อกอินไม่ได้" จนกว่าจะ deploy ใหม่**
//    วิธีทดสอบ: เพิ่ม STAFF_NAME_8 + STAFF_PASS_8 (รหัสสุ่ม) ผ่าน Netlify API → ยิง
//    POST /api/auth/login ด้วยรหัสนั้นทันที → ได้ **401 "รหัสผ่านไม่ถูกต้อง"** → ลบตัวทดสอบทิ้ง
//    ⇒ ข้อ 3 บนจอนี้ไม่ใช่คำแนะนำเผื่อไว้ **มันจำเป็น** ถ้าไม่เขียนไว้ คนจะใส่ครบแล้วเข้าไม่ได้
//       แล้วนึกว่าตัวเองพิมพ์รหัสผิด — ไล่ผิดทางเป็นชั่วโมง
//
// ⚠️ จอนี้ต้องเป็น server component เหมือนจอผู้ใช้งาน เพราะอ่าน env ฝั่งเซิร์ฟเวอร์
//    และ **ห้ามส่งค่ารหัสออกไป** — อ่านแค่ว่าช่องไหน "มีค่าแล้ว" เพื่อหาช่องว่างถัดไป
import Link from 'next/link'
import { PageHead } from '@/components/zort'

export const dynamic = 'force-dynamic'

const env = (k: string) => (process.env[k] ?? '').trim()

/** ลิงก์ตรงไปหน้า Environment variables ของโปรเจกต์ที่เสิร์ฟ admin.gucut.com */
const ENV_URL = 'https://app.netlify.com/projects/gucut-admin/configuration/env'
const DEPLOY_URL = 'https://app.netlify.com/projects/gucut-admin/deploys'

export default function AddUserPage() {
  /* ช่องมี 8 ช่อง — หาช่องแรกที่ยังไม่มีทั้งชื่อและรหัส
     ⚠️ ต้องเช็คทั้งสองตัว: ช่องที่มีชื่อแต่ไม่มีรหัสก็ถือว่า "ถูกใช้แล้ว" (ค้างอยู่)
        ไม่งั้นจะแนะนำให้ทับช่องที่มีคนใช้อยู่ */
  const slots = Array.from({ length: 8 }, (_, i) => {
    const n = i + 1
    return { n, name: env(`STAFF_NAME_${n}`), hasPass: env(`STAFF_PASS_${n}`).length > 0 }
  })
  const used = slots.filter((s) => s.name || s.hasPass)
  const free = slots.filter((s) => !s.name && !s.hasPass)
  const next = free[0]

  const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
    <li className="relative pl-10 pb-6 last:pb-0">
      <span className="absolute left-0 top-0 grid h-7 w-7 place-items-center rounded-full bg-[#4669e5] text-[13px] font-bold text-white">
        {n}
      </span>
      <h3 className="text-[14px] font-semibold text-gray-900 leading-7">{title}</h3>
      <div className="mt-1.5 text-[13px] leading-relaxed text-gray-700">{children}</div>
    </li>
  )

  const Code = ({ children }: { children: React.ReactNode }) => (
    <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[12.5px] text-gray-900">{children}</code>
  )

  return (
    <div className="p-4 md:p-6 max-w-[760px]">
      <p className="text-[12px] mb-2">
        <Link href="/core/settings-users" className="text-blue-600 hover:underline">‹ ผู้ใช้งาน</Link>
      </p>

      <PageHead
        title="เพิ่มผู้ใช้งาน"
        summary={
          <span className="text-gray-400">
            ใช้ได้ {used.length}/8 ช่อง · เหลือว่าง {free.length} ช่อง
          </span>
        }
      />

      {!next ? (
        /* สามสถานะ: เต็มจริง ≠ อ่านไม่ได้ — ถ้าอ่าน env ไม่ได้เลย slots จะว่างหมดแล้ว next มีค่า
           เคสนี้จึงแปลว่า "เต็มจริง" เท่านั้น */
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <b>ช่องเต็มทั้ง 8 ช่องแล้ว</b> — ระบบรองรับพนักงานรายคนได้สูงสุด 8 คน
          ถ้าต้องการมากกว่านี้ ต้องแก้โค้ดให้วนมากกว่า 8 ช่อง (ทั้ง <Code>middleware.ts</Code>,{' '}
          <Code>app/api/auth/login/route.ts</Code> และ <Code>app/api/auth/whoami/route.ts</Code> —
          สามที่ ต้องแก้พร้อมกัน) หรือถอดคนที่ไม่ได้ใช้แล้วออกก่อน
        </div>
      ) : (
        <>
          <div className="mb-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-900">
            ช่องว่างถัดไปคือ <b>ช่องที่ {next.n}</b> — ใช้ชื่อตัวแปรสองตัวนี้
            <div className="mt-2 flex flex-wrap gap-2">
              <Code>STAFF_NAME_{next.n}</Code>
              <Code>STAFF_PASS_{next.n}</Code>
            </div>
          </div>

          <ol className="rounded-md border border-gray-200 bg-white p-5">
            <Step n={1} title="เปิดหน้าตั้งค่าของ Netlify">
              <a href={ENV_URL} target="_blank" rel="noreferrer"
                className="inline-block rounded-full px-4 py-1.5 text-[13px] font-semibold text-white"
                style={{ background: '#4669e5' }}>
                เปิด Environment variables ↗
              </a>
              <p className="mt-1.5 text-gray-500">
                โปรเจกต์ <Code>gucut-admin</Code> (ตัวที่เสิร์ฟ admin.gucut.com) → ปุ่ม <b>Add a variable</b>
              </p>
            </Step>

            <Step n={2} title="เพิ่มสองตัวแปร">
              <table className="w-full border-collapse text-[12.5px]">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 pr-3 align-top"><Code>STAFF_NAME_{next.n}</Code></td>
                    <td className="py-2 align-top text-gray-600">ชื่อพนักงาน (ชื่อนี้จะขึ้นในตารางผู้ใช้งาน)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 align-top"><Code>STAFF_PASS_{next.n}</Code></td>
                    <td className="py-2 align-top text-gray-600">
                      รหัสผ่านของคนนั้น — <b>ห้ามซ้ำกับของคนอื่น</b> ไม่งั้นระบบแยกไม่ออกว่าใครเข้ามา
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-gray-500">
                ทั้งสองตัวเลือก <b>Same value for all deploy contexts</b> ก็พอ ·
                ต้องใส่<b>ครบทั้งคู่</b> — ใส่แค่ชื่อ คนนั้นล็อกอินไม่ได้ · ใส่แค่รหัส เข้าได้แต่ระบบไม่รู้ว่าใคร
              </p>
            </Step>

            <Step n={3} title="สั่ง deploy ใหม่หนึ่งครั้ง — ข้อนี้ข้ามไม่ได้">
              {/* 🔴 ข้อนี้มาจากการยิงของจริง ไม่ใช่การเดา — ดูหัวไฟล์ */}
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-red-900">
                <b>ใส่ตัวแปรแล้วยังล็อกอินไม่ได้ทันที</b> — ทดสอบจริงแล้ว (8 ก.ย. 2569):
                เพิ่มคู่ชื่อ+รหัสเสร็จ ยิงล็อกอินเดี๋ยวนั้นได้ <b>&quot;รหัสผ่านไม่ถูกต้อง&quot;</b>
                <br />
                ค่าใหม่จะมีผลก็ต่อเมื่อ deploy รอบถัดไปเท่านั้น
              </div>
              <a href={DEPLOY_URL} target="_blank" rel="noreferrer"
                className="mt-2 inline-block rounded-full border border-gray-300 bg-white px-4 py-1.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50">
                เปิดหน้า Deploys ↗
              </a>
              <p className="mt-1.5 text-gray-500">
                กด <b>Trigger deploy → Deploy site</b> (ไม่ต้อง Clear cache) รอราว 2–3 นาที
              </p>
            </Step>

            <Step n={4} title="ให้พนักงานลองเข้า">
              เปิด <Code>admin.gucut.com</Code> แล้วใส่รหัสของตัวเอง ·
              กลับมาดูที่จอ <Link href="/core/settings-users" className="text-blue-600 hover:underline">ผู้ใช้งาน</Link>{' '}
              ต้องเห็นชื่อคนใหม่ในตาราง ถ้ายังไม่เห็นแปลว่า deploy ยังไม่เสร็จ
            </Step>
          </ol>
        </>
      )}

      {/* สิทธิ์ที่คนใหม่จะได้ — ต้องบอกก่อน ไม่ใช่ให้ไปเจอเอง */}
      <div className="mt-5 rounded-md border border-gray-200 bg-white p-4">
        <h2 className="text-[13px] font-semibold text-gray-900">คนที่เพิ่มเข้ามาจะทำอะไรได้บ้าง</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-700">
          สิทธิ์ของพนักงานรายคนตอนนี้มีชุดเดียว: เข้าได้เฉพาะ <b>หน้าโอนสินค้า</b> กับ API ที่หน้านั้นใช้
          — เห็นออเดอร์ ยอดขาย คูปอง หรือหน้าอื่นไม่ได้
        </p>
        <p className="mt-1.5 text-[13px] text-gray-500">
          อยากได้ชุดสิทธิ์แบบอื่น (เช่น &quot;บัญชี&quot; ที่เห็นเฉพาะการเงิน) ยังต้องแก้โค้ด —
          ดูที่จอ <Link href="/core/settings-roles" className="text-blue-600 hover:underline">สิทธิ์การใช้งาน</Link>
        </p>
      </div>

      {/* รหัสรวมรุ่นเก่า — เตือนซ้ำตรงนี้เพราะเป็นจุดที่คนกำลังคิดเรื่องผู้ใช้พอดี */}
      {env('STAFF_PASSWORD').length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <b>⚠️ รหัสรวมรุ่นเก่า (<Code>STAFF_PASSWORD</Code>) ยังเปิดอยู่</b> — ใครรู้รหัสนี้ก็เข้าได้
          และระบบแยกไม่ออกว่าเป็นใคร · ตั้งรหัสรายคนครบทุกคนแล้ว <b>ควรลบตัวนี้ทิ้ง</b>
          ที่หน้า Environment variables เดียวกัน
        </div>
      )}
    </div>
  )
}
