import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import AppShell from '@/components/layout/AppShell'
import { authToken, sameToken } from '@/lib/auth-token'

export const metadata: Metadata = {
  title: 'GUCUT Dashboard',
  description: 'GUCUT Business Dashboard',
}

// 🔴 คุกกี้เป็น "ลายนิ้วมือของรหัส" ไม่ใช่ตัวรหัส (6 ก.ย. 2569 — ดู lib/auth-token.ts)
//    ⇒ ต้องแฮชแล้วเทียบ · ห้ามกลับไปเทียบกับ SITE_PASSWORD ตรง ๆ
// ⚠️ พ่วงแก้บั๊กเงียบของเดิม: ที่นี่รู้จักแค่ STAFF_PASSWORD (รหัสรวมรุ่นเก่า)
//    พนักงานที่ใช้ **รหัสรายคน** (STAFF_PASS_1..8) จึงได้ role = null
//    ⇒ เปลือกจอปฏิบัติกับเขาเหมือนคนยังไม่ล็อกอิน ทั้งที่ middleware ให้ผ่านแล้ว
const cleanEnv = (v?: string) => (v ?? '').trim()
async function roleOf(auth?: string): Promise<'admin' | 'staff' | null> {
  if (!auth) return null
  const adminPass = cleanEnv(process.env.SITE_PASSWORD)
  if (adminPass && sameToken(auth, await authToken(adminPass))) return 'admin'
  const legacy = cleanEnv(process.env.STAFF_PASSWORD)
  if (legacy && sameToken(auth, await authToken(legacy))) return 'staff'
  for (let i = 1; i <= 8; i++) {
    const p = cleanEnv(process.env[`STAFF_PASS_${i}`])
    if (p && sameToken(auth, await authToken(p))) return 'staff'
  }
  return null
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const role = await roleOf(cookies().get('gucut_auth')?.value)

  return (
    <html lang="th">
      {/* ฟอนต์หลักของระบบ — Prompt จาก Google Fonts (โหลดฝั่ง browser ผู้ใช้ตรงๆ ไม่ผูกกับ build) รองรับภาษาไทยเต็มรูปแบบ */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-app min-h-screen pb-16 md:pb-0 text-gray-800">
        <AppShell role={role}>{children}</AppShell>
      </body>
    </html>
  )
}
