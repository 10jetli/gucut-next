// ระยะขอบรวมของทุกหน้าในกลุ่ม /web — เดิมไม่มีเลย บนมือถือเนื้อหาชนขอบจอ
// (บนเดสก์ท็อปมองไม่เห็นปัญหาเพราะ mx-auto ของ AppShell เหลือที่ว่างข้าง ๆ ให้)
export default function WebLayout({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4 md:px-6 md:py-6">{children}</div>
}
