'use client'
// ค่าโฆษณา vs ยอดขายจริง — ฉบับเนื้อเดียว · ท่อ /api/web/ad-stats
// ⚠️ กติกาเจ้าของร้าน: หน้าเรียก API ข้างนอกต้องกดเอง ห้ามยิงอัตโนมัติ
import { useEffect, useMemo, useState } from 'react'

interface Cfg {
  fb: { on: boolean; accountId: string; hasToken: boolean }
  google: {
    on: boolean; customerId: string; loginCustomerId: string
    hasDeveloperToken: boolean; pushKey: string; pushedAt: number; pushRows: number; pushDays: number
  }
}
interface Row { name: string; spend: number; impressions: number; clicks: number; purchases: number; revenue: number }
interface Src { ok: boolean; off?: boolean; error?: string; via?: string; pushedAt?: number; rows: Row[] }
interface Report {
  range: { since: string; until: string; days: number }
  fb: Src; google: Src
  sales: { orders: number; revenue: number; pending: number } | null
  roas: number | null; spend: number; spendBy: { fb: number; google: number }
}
const baht = (n: number) => '฿' + Math.round(n).toLocaleString('th-TH')
const when = (ms?: number) => (ms ? new Date(ms).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '')

// สคริปต์วางใน Google Ads — เหมือนหน้าเดิมทุกตัวอักษร (แก้ที่นี่ต้องเอาไปวางใหม่เอง)
const adsScript = (key: string) => `// GUCUT — ส่งตัวเลขค่าโฆษณาเข้าหลังร้าน
// ตั้งเวลาให้รันวันละครั้งก็พอ (รันซ้ำได้ ไม่ทำให้ยอดพอง)
var ENDPOINT = 'https://gucut.com/api/ads-push';
var KEY = '\${KEY}';

function main() {
  var tz = AdsApp.currentAccount().getTimeZone();
  var day = function (back) {
    var d = new Date();
    d.setDate(d.getDate() - back);
    return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  };

  var q =
    'SELECT campaign.name, segments.date, metrics.cost_micros, metrics.clicks, ' +
    'metrics.impressions, metrics.conversions, metrics.conversions_value ' +
    'FROM campaign WHERE segments.date BETWEEN "' + day(7) + '" AND "' + day(0) + '"';

  var rows = [];
  var it = AdsApp.search(q);
  while (it.hasNext()) {
    var r = it.next();
    rows.push({
      date: r.segments.date,
      campaign: r.campaign.name,
      cost: Number(r.metrics.costMicros || 0) / 1000000,
      clicks: Number(r.metrics.clicks || 0),
      impressions: Number(r.metrics.impressions || 0),
      conversions: Number(r.metrics.conversions || 0),
      convValue: Number(r.metrics.conversionsValue || 0)
    });
  }

  var res = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ key: KEY, rows: rows }),
    muteHttpExceptions: true
  });
  Logger.log('ส่ง ' + rows.length + ' แถว → ' + res.getResponseCode() + ' ' + res.getContentText());
}`.replace('\${KEY}', key)

function SrcBlock({ title, s }: { title: string; s: Src }) {
  const total = useMemo(() => (s.rows || []).reduce((a, r) => ({
    spend: a.spend + r.spend, clicks: a.clicks + r.clicks, revenue: a.revenue + r.revenue, purchases: a.purchases + r.purchases,
  }), { spend: 0, clicks: 0, revenue: 0, purchases: 0 }), [s.rows])
  return (
    <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 md:px-5 pt-4 pb-2">
        <p className="text-[13px] font-black text-gray-900">{title}</p>
        {s.off ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-400">ยังไม่เปิด</span>
          : s.ok ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">ต่อได้</span>
          : <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500">มีปัญหา</span>}
        {s.via && <span className="text-[10.5px] text-gray-300">ผ่าน{s.via === 'script' ? 'สคริปต์' : s.via}{s.pushedAt ? ` · ${when(s.pushedAt)}` : ''}</span>}
      </div>
      {s.error && <p className="px-5 pb-2 text-[11.5px] text-red-500">{s.error}</p>}
      {(s.rows || []).length > 0 && (
        <>
          <div className="hidden md:grid grid-cols-[1fr_90px_70px_90px_60px] px-5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-300 border-y border-gray-50">
            <span>แคมเปญ</span><span className="text-right">จ่ายไป</span><span className="text-right">คลิก</span><span className="text-right">ยอดขาย</span><span className="text-right">ROAS</span>
          </div>
          <div className="divide-y divide-gray-50">
            {s.rows.map((r, i) => (
              <div key={i} className="md:grid md:grid-cols-[1fr_90px_70px_90px_60px] flex flex-wrap items-center gap-x-2 px-4 md:px-5 py-2">
                <span className="text-[12.5px] text-gray-700 truncate">{r.name}</span>
                <span className="text-[12.5px] font-bold text-gray-900 md:text-right tabular-nums">{baht(r.spend)}</span>
                <span className="text-[12px] text-gray-400 md:text-right tabular-nums">{r.clicks.toLocaleString('th-TH')}</span>
                <span className="text-[12.5px] text-emerald-600 font-semibold md:text-right tabular-nums">{r.revenue ? baht(r.revenue) : '—'}</span>
                <span className={`text-[12px] font-bold md:text-right tabular-nums ${r.spend && r.revenue / r.spend >= 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {r.spend ? (r.revenue / r.spend).toFixed(1) : '—'}
                </span>
              </div>
            ))}
            <div className="md:grid md:grid-cols-[1fr_90px_70px_90px_60px] flex flex-wrap items-center gap-x-2 px-4 md:px-5 py-2 bg-gray-50/60">
              <span className="text-[12.5px] font-black text-gray-900">รวม</span>
              <span className="text-[12.5px] font-black text-gray-900 md:text-right tabular-nums">{baht(total.spend)}</span>
              <span className="text-[12px] text-gray-500 md:text-right tabular-nums">{total.clicks.toLocaleString('th-TH')}</span>
              <span className="text-[12.5px] font-black text-emerald-600 md:text-right tabular-nums">{baht(total.revenue)}</span>
              <span className="text-[12px] font-black md:text-right tabular-nums">{total.spend ? (total.revenue / total.spend).toFixed(1) : '—'}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function WebAdsPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null)
  const [rep, setRep] = useState<Report | null>(null)
  const [days, setDays] = useState(7)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [showScript, setShowScript] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/web/ad-stats').then((r) => r.json()).then(setCfg).catch(() => setMsg('โหลดการตั้งค่าไม่สำเร็จ'))
  }, [])

  async function run(d = days) {
    setBusy(true); setMsg(''); setRep(null)
    try {
      const r = await fetch(`/api/web/ad-stats?report=1&days=${d}`)
      if (!r.ok) throw new Error()
      setRep(await r.json())
    } catch { setMsg('ดึงรายงานไม่สำเร็จ ลองใหม่') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">เว็บไซต์ · gucut.com</p>
          <h1 className="text-[22px] md:text-[26px] font-black tracking-tight text-gray-900 leading-tight">ค่าโฆษณา vs ยอดขายจริง</h1>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] shadow-sm outline-none">
          <option value={7}>7 วันล่าสุด</option><option value={14}>14 วัน</option><option value={30}>30 วัน</option>
        </select>
        <button onClick={() => run()} disabled={busy}
          className="rounded-xl bg-gray-900 px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.5)] hover:bg-gray-800 active:scale-[0.98] disabled:opacity-50">
          {busy ? 'กำลังดึงข้อมูล…' : 'ดึงรายงาน'}
        </button>
      </div>
      {msg && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">{msg}</p>}

      {rep && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">จ่ายค่าโฆษณา</p>
              <p className="text-[26px] font-black text-gray-900 mt-1 tabular-nums leading-none">{baht(rep.spend)}</p>
              <p className="text-[11px] text-gray-400 mt-1.5">FB {baht(rep.spendBy.fb)} · Google {baht(rep.spendBy.google)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">ยอดขายเว็บจริง</p>
              <p className="text-[26px] font-black text-emerald-600 mt-1 tabular-nums leading-none">{rep.sales ? baht(rep.sales.revenue) : '—'}</p>
              <p className="text-[11px] text-gray-400 mt-1.5">{rep.sales ? `${rep.sales.orders} ออเดอร์ · ค้างจ่าย ${rep.sales.pending}` : ''}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">ROAS รวม</p>
              <p className={`text-[26px] font-black mt-1 tabular-nums leading-none ${rep.roas !== null && rep.roas >= 1 ? 'text-emerald-600' : 'text-red-500'}`}>
                {rep.roas !== null ? rep.roas.toFixed(2) : '—'}
              </p>
              <p className="text-[11px] text-gray-400 mt-1.5">ยอดขาย ÷ ค่าโฆษณา (เกิน 1 = คุ้ม)</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">ช่วงเวลา</p>
              <p className="text-[15px] font-black text-gray-900 mt-1 leading-tight">{rep.range.since}<br />→ {rep.range.until}</p>
            </div>
          </div>
          <SrcBlock title="Facebook Ads" s={rep.fb} />
          <SrcBlock title="Google Ads" s={rep.google} />
        </>
      )}

      {/* สคริปต์ Google Ads */}
      {cfg && (
        <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.14)] p-4 md:p-5">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-[13px] font-black text-gray-900">สคริปต์ส่งตัวเลขจาก Google Ads</p>
            <button onClick={() => setShowScript(!showScript)} className="text-[12px] font-semibold text-blue-600">{showScript ? 'ซ่อน' : 'ดูสคริปต์'}</button>
          </div>
          <p className="text-[11.5px] text-gray-400 mt-1">
            Google ส่งล่าสุด {cfg.google.pushedAt ? `${when(cfg.google.pushedAt)} · ${cfg.google.pushRows} แถว ${cfg.google.pushDays} วัน` : 'ยังไม่เคยส่งเข้ามา'}
            {' '}— วางในหน้า Google Ads → เครื่องมือ → สคริปต์ ตั้งรันวันละครั้ง
          </p>
          {showScript && (
            <>
              <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-gray-900 p-3 text-[10.5px] leading-relaxed text-emerald-200"><code>{adsScript(cfg.google.pushKey)}</code></pre>
              <button onClick={() => { navigator.clipboard?.writeText(adsScript(cfg.google.pushKey)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {}) }}
                className="mt-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-50">
                {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกสคริปต์'}
              </button>
            </>
          )}
        </div>
      )}
      <p className="text-center text-[11px] text-gray-300">ตั้งค่า Facebook token / Google เพิ่มเติมได้ที่หน้าเดิม gucut.com/admin/ads/ — ดึงรายงานต้องกดเอง (กติการ้าน)</p>
    </div>
  )
}
