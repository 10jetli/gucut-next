import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'GUCUT Dashboard',
  description: 'GUCUT Business Dashboard',
}

const navItems = [
  { href: '/', icon: '🏠', label: 'หน้าหลัก' },
  { href: '/orders', icon: '📦', label: 'Orders' },
  { href: '/products', icon: '🛍', label: 'สินค้า' },
  { href: '/factory', icon: '🏭', label: 'โรงงาน' },
  { href: '/ads', icon: '📢', label: 'โฆษณา' },
  { href: '/bills', icon: '🧾', label: 'บิล' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="bg-gray-100 min-h-screen pb-16 md:pb-0">
        {/* ── Sidebar (desktop) สไตล์ระบบหลังบ้านแบบ Zort ── */}
        <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-[#17386b] text-white z-30">
          <div className="px-5 py-5 border-b border-white/10">
            <p className="text-xl font-black tracking-tight">GUCUT</p>
            <p className="text-[10px] text-blue-200/70 mt-0.5">BACK OFFICE • WWW.GUCUT.COM</p>
          </div>
          <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] text-blue-100/90 hover:bg-white/10 hover:text-white transition-colors"
              >
                <span className="text-lg w-6 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="px-5 py-4 border-t border-white/10 text-[10.5px] text-blue-200/60">
            ระบบจัดการร้าน GUCUT
          </div>
        </aside>

        {/* ── Top bar (desktop) ── */}
        <header className="hidden md:flex fixed top-0 left-60 right-0 h-14 bg-white border-b border-gray-200 items-center justify-between px-6 z-20">
          <p className="text-[13px] font-semibold text-gray-700">ระบบหลังบ้าน GUCUT</p>
          <p className="text-[11.5px] text-gray-400" suppressHydrationWarning>
            {new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}
          </p>
        </header>

        {/* ── Header (mobile) ── */}
        <header className="md:hidden sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2 shadow-sm">
          <span className="text-lg font-black tracking-tight text-gray-900">GUCUT</span>
          <span className="text-[10px] text-gray-400 mt-0.5">WWW.GUCUT.COM</span>
        </header>

        {/* ── Main content ── */}
        <main className="md:ml-60 md:pt-14">
          <div className="md:max-w-[1200px] md:mx-auto">{children}</div>
        </main>

        {/* ── Bottom nav (mobile) ── */}
        <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 flex justify-around py-2 z-20">
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
