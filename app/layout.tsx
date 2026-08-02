import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'GUCUT Dashboard',
  description: 'GUCUT Business Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const auth = cookies().get('gucut_auth')?.value
  const adminPass = process.env.SITE_PASSWORD
  const staffPass = process.env.STAFF_PASSWORD
  const role: 'admin' | 'staff' | null =
    auth && adminPass && auth === adminPass ? 'admin' :
    auth && staffPass && auth === staffPass ? 'staff' : null

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
