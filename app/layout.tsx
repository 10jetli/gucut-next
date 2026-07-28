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
      <body className="bg-gray-100 min-h-screen pb-16 md:pb-0">
        <AppShell role={role}>{children}</AppShell>
      </body>
    </html>
  )
}
