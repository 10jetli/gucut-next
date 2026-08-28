'use client'
// พิกเซลการตลาด — ฉบับเนื้อเดียว · ท่อ /api/web/marketing
// ⚠️ token เป็นความลับ — ช่องเป็น password และไม่โชว์ค่าที่เก็บไว้กลับมาเต็ม ๆ
import { useEffect, useState } from 'react'

interface Cfg {
  meta: { on: boolean; pixelId: string; token: string; testCode: string }
  tiktok: { on: boolean; pixelId: string; token: string; testCode: string }
  ga4: { on: boolean; id: string }
  ads: { on: boolean; id: string; label: string }
  line: { on: boolean; tagId: string }
  cf: { on: boolean; token: string }
}
const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100'

function Toggle({ on, set }: { on: boolean; set: (b: boolean) => void }) {
  return (
    <button onClick={() => set(!on)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-emerald-500' : 'bg-gray-200'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}
function Section({ title, sub, on, set, children }: {
  title: string; sub: string; on: boolean; set: (b: boolean) => void; children?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] p-4 md:p-5">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-black text-gray-900">{title}</span>
          <span className="block text-[11.5px] text-gray-400 mt-0.5">{sub}</span>
        </span>
        <Toggle on={on} set={set} />
      </div>
      {on && <div className="grid md:grid-cols-2 gap-3 mt-3.5">{children}</div>}
    </div>
  )
}
const F = ({ l, children }: { l: string; children: React.ReactNode }) => (
  <label className="block"><span className="block text-[11px] font-semibold text-gray-400 mb-1">{l}</span>{children}</label>
)

export default function WebMarketingPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/web/marketing').then((r) => r.json()).then(setCfg).catch(() => setMsg('โหลดค่าไม่สำเร็จ'))
  }, [])

  async function save() {
    if (!cfg) return
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/web/marketing', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cfg),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.error)
      if (j) setCfg(j)
      setMsg('บันทึกแล้ว ✓ มีผลกับหน้าเว็บทันที ไม่ต้อง deploy')
    } catch (e) { setMsg(String((e as Error).message || 'บันทึกไม่สำเร็จ')) }
    finally { setBusy(false) }
  }

  if (!cfg) return (
    <div className="max-w-2xl space-y-3 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-gray-100" />)}</div>
  )

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
        <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">พิกเซลการตลาด</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">ยิง ViewContent · AddToCart · InitiateCheckout · Purchase อัตโนมัติ ทั้งฝั่งเบราว์เซอร์และเซิร์ฟเวอร์ (CAPI)</p>
      </div>
      {msg && <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-[13px] text-blue-700">{msg}</p>}

      <Section title="Meta (Facebook/Instagram)" sub="Pixel + Conversions API" on={cfg.meta.on} set={(b) => setCfg({ ...cfg, meta: { ...cfg.meta, on: b } })}>
        <F l="Pixel ID"><input className={inputCls} inputMode="numeric" value={cfg.meta.pixelId} onChange={(e) => setCfg({ ...cfg, meta: { ...cfg.meta, pixelId: e.target.value } })} /></F>
        <F l="CAPI Token (ลับ)"><input type="password" autoComplete="off" className={inputCls} value={cfg.meta.token} onChange={(e) => setCfg({ ...cfg, meta: { ...cfg.meta, token: e.target.value } })} /></F>
        <F l="Test Event Code (ถ้ามี)"><input className={inputCls} value={cfg.meta.testCode} onChange={(e) => setCfg({ ...cfg, meta: { ...cfg.meta, testCode: e.target.value } })} /></F>
      </Section>
      <Section title="TikTok" sub="Pixel + Events API" on={cfg.tiktok.on} set={(b) => setCfg({ ...cfg, tiktok: { ...cfg.tiktok, on: b } })}>
        <F l="Pixel ID"><input className={inputCls} value={cfg.tiktok.pixelId} onChange={(e) => setCfg({ ...cfg, tiktok: { ...cfg.tiktok, pixelId: e.target.value } })} /></F>
        <F l="Events API Token (ลับ)"><input type="password" autoComplete="off" className={inputCls} value={cfg.tiktok.token} onChange={(e) => setCfg({ ...cfg, tiktok: { ...cfg.tiktok, token: e.target.value } })} /></F>
        <F l="Test Event Code (ถ้ามี)"><input className={inputCls} value={cfg.tiktok.testCode} onChange={(e) => setCfg({ ...cfg, tiktok: { ...cfg.tiktok, testCode: e.target.value } })} /></F>
      </Section>
      <Section title="Google Analytics 4" sub="วัดพฤติกรรมบนเว็บ" on={cfg.ga4.on} set={(b) => setCfg({ ...cfg, ga4: { ...cfg.ga4, on: b } })}>
        <F l="Measurement ID (G-XXXX)"><input className={inputCls} value={cfg.ga4.id} onChange={(e) => setCfg({ ...cfg, ga4: { ...cfg.ga4, id: e.target.value } })} /></F>
      </Section>
      <Section title="Google Ads" sub="Conversion Tracking" on={cfg.ads.on} set={(b) => setCfg({ ...cfg, ads: { ...cfg.ads, on: b } })}>
        <F l="Conversion ID (AW-XXXX)"><input className={inputCls} value={cfg.ads.id} onChange={(e) => setCfg({ ...cfg, ads: { ...cfg.ads, id: e.target.value } })} /></F>
        <F l="Conversion Label"><input className={inputCls} value={cfg.ads.label} onChange={(e) => setCfg({ ...cfg, ads: { ...cfg.ads, label: e.target.value } })} /></F>
      </Section>
      <Section title="LINE Tag" sub="วัดผลโฆษณา LINE" on={cfg.line.on} set={(b) => setCfg({ ...cfg, line: { ...cfg.line, on: b } })}>
        <F l="Tag ID"><input className={inputCls} value={cfg.line.tagId} onChange={(e) => setCfg({ ...cfg, line: { ...cfg.line, tagId: e.target.value } })} /></F>
      </Section>

      <button onClick={save} disabled={busy}
        className="w-full rounded-xl bg-gray-900 py-3 text-[14px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] hover:bg-gray-800 active:scale-[0.99] disabled:opacity-50">
        {busy ? 'กำลังบันทึก…' : 'บันทึกทั้งหมด — มีผลทันที'}
      </button>
      <p className="text-center text-[11px] text-gray-300">ชุดเดียวกับ gucut.com/admin/marketing/ — หน้าเดิมยังใช้ได้เป็นทางสำรอง</p>
    </div>
  )
}
