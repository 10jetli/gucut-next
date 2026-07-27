import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'GUCUT Dashboard',
  description: 'GUCUT Business Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="bg-gray-100 min-h-screen pb-16 md:pb-0">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
