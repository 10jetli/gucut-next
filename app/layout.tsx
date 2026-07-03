import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'GUCUT Dashboard',
  description: 'GUCUT Business Dashboard',
}

const navItems = [
  { href: '/',          icon: '🏠', label: 'หน้าหลัก' },
  { href: '/orders',    icon: '📦', label: 'Orders' },
  { href: '/products',  icon: '🛍', label: 'สินค้า' },
  { href: '/factory',   icon: '🏭', label: 'โรงงาน' },
  { href: '/ads',       icon: '📢', label: 'โฆษณา' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="bg-gray-50 min-h-screen pb-16">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2 shadow-sm">
          <span className="text-lg font-black tracking-tight text-gray-900">GUCUT</span>
          <span className="text-[10px] text-gray-400 mt-0.5">WWW.GUCUT.COM</span>
        </header>
        <main>{children}</main>
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 flex justify-around py-2 z-20">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 text-gray-500 hover:text-blue-500 transition-colors"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px]">{item.label}</span>
            </Link>
          ))}
        </nav>
      </body>
    </html>
  )
}
