'use client'
// สถาปัตยกรรมที่ใช้อยู่ — ผังระบบที่ **อ่านจากซอร์สจริง** ไม่ใช่ผังที่คนวาดค้างไว้
//
// เจ้าของร้านสั่ง (2 ก.ย. 2569): "ทำผังใส่ใน admin.gucut.com ถ้ามีการเปลี่ยนแปลง
// ก็ให้อัปเดตอัตโนมัติ เขียนเมนูว่า สถาปัตยกรรมที่ใช้อยู่"
// แล้วสั่งเพิ่ม (3 ก.ย. 2569): "ทำให้สวย ๆ แบบนี้" พร้อมผังที่ฝั่งเจ้าของร้านวาดไว้
// ⇒ โครงกับชุดสีลอกจาก ~/claude-shared/arch-artifact.html (โทนอุ่น · ส้มแบรนด์ #E03500)
//   ผังนั้นมี 5 ชั้น: คนกด → สองเว็บ+ท่อกลาง → ที่เก็บข้อมูล → ของนอกบ้านที่ต่อแล้ว → ยังไม่ต่อ
//
// ⚠️ **ห้ามพิมพ์ตัวเลขใด ๆ ลงหน้านี้เด็ดขาด** ทุกตัวเลขมาจาก /api/web/core?arch=1
//    ซึ่งสแกนซอร์สจริงตอน build · ผังที่คนกรอกเองจะกลายเป็นของโกหกภายในไม่กี่สัปดาห์
//    และ **แย่กว่าไม่มีผังเลย** เพราะคนเอาไปตัดสินใจต่อโดยเชื่อว่ามันตรง
//    ⇒ ผังต้นฉบับมีตัวเลขฝั่งหลังร้านด้วย (17 หน้า · 30 เส้นทาง · 4 ถัง) แต่ตัวสแกน
//      **มองไม่เห็นฝั่งนั้น** เพราะอยู่คนละที่เก็บโค้ด ⇒ ที่นี่จึงไม่ลอกตัวเลขชุดนั้นมา
//      กล่องหลังร้านเขียนตรง ๆ ว่ายังไม่ได้ถูกสแกน
// ⚠️ **อ่านไม่ได้ต้องขึ้นว่าอ่านไม่ได้ ห้ามโชว์ตัวเลขค้างจากรอบก่อน**
// ⚠️ ค่าที่ยังไม่มาต้องขึ้น "ไม่ทราบจำนวน" **ห้ามใส่ 0 เป็นค่าตั้งต้น**
//    (3 ก.ย. 2569 API ห่อคำตอบไว้อีกชั้นแล้วอ่านไม่เจอ — เพราะขึ้น "ไม่ทราบจำนวน"
//     ฝั่งเซิร์ฟเวอร์จับต้นเหตุได้ใน 2 นาที ถ้าเป็น 0 คงไล่หาบั๊กผิดที่ทั้งเช้า)
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost } from '@/components/zort'

/* ชุดสีจากผังต้นฉบับ — โทนอุ่น ส้มแบรนด์ GUCUT */
const C = {
  bg: '#FAF8F5', surface: '#FFFFFF', surface2: '#F3EFEA',
  ink: '#221F1D', muted: '#6B6560', line: '#E4DED7',
  accent: '#E03500', accentSoft: '#FFF0EA', accentLine: '#F3B9A4',
  slate: '#6F7B8C', slateSoft: '#EFF1F4',
}

interface Integration {
  id: string; name: string; what: string
  inCode: boolean; live: boolean; partial?: boolean
}
interface Arch {
  generatedAt?: string
  site?: string; project?: string; repo?: string
  functions?: { count?: number; scheduled?: { name: string; cron: string }[] }
  edge?: string[]
  blobs?: string[]
  d1?: { tables?: string[] }
  pages?: { count?: number }
  loginProviders?: string[]
  unlabelled?: string[]
  integrations?: Integration[]
}

/** งานตามเวลาตั้งบน Netlify เป็น **เวลาสากล** — แปลงเป็นเวลาไทยให้อ่านออก
 *  ⚠️ แปลเฉพาะรูปที่แน่ใจจริง ๆ · รูปอื่นคืน null แล้วโชว์ค่าดิบ
 *    แปลผิดแล้วคนเชื่อ แย่กว่าไม่แปล */
function cronThai(cron: string): string | null {
  const c = String(cron || '').trim()
  let m = /^\*\/(\d+) \* \* \* \*$/.exec(c)
  if (m) return `ทุก ${m[1]} นาที`
  m = /^0 \*\/(\d+) \* \* \*$/.exec(c)
  if (m) return `ทุก ${m[1]} ชั่วโมง`
  if (/^0 \* \* \* \*$/.test(c)) return 'ทุกชั่วโมง'
  m = /^(\d+) (\d+) \* \* \*$/.exec(c)
  if (m) {
    const min = Number(m[1]), hUtc = Number(m[2])
    if (min < 60 && hUtc < 24) {
      const h = (hUtc + 7) % 24 // เซิร์ฟเวอร์รันเวลาสากล ร้านอยู่ไทย
      return `ทุกวัน ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')} น. (เวลาไทย)`
    }
  }
  return null
}

function Tag({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'accent' }) {
  return (
    <span
      className="text-[11px] font-mono rounded px-1.5 py-0.5 leading-relaxed"
      style={tone === 'accent'
        ? { background: C.accentSoft, color: C.accent }
        : { background: C.slateSoft, color: C.slate }}
    >
      {children}
    </span>
  )
}

/** ตัวแสดงบนสุดของผัง — ใครเป็นคนเริ่มเรื่อง */
function Actor({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-lg border px-3 py-2.5 text-center" style={{ background: C.surface, borderColor: C.line }}>
      <p className="text-[12.5px] font-semibold" style={{ color: C.ink }}>{title}</p>
      <p className="text-[11px] mt-0.5 leading-snug" style={{ color: C.muted }}>{sub}</p>
    </div>
  )
}

/** กล่องใหญ่ของผัง */
function Node({
  title, meta, lines, accent = false, dim = false, dashed = false, children,
}: {
  title: string
  meta?: string
  lines?: string[]
  accent?: boolean
  dim?: boolean
  dashed?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className="rounded-lg border px-3.5 py-3 h-full"
      style={{
        background: accent ? C.accentSoft : C.surface,
        borderColor: accent ? C.accentLine : C.line,
        borderStyle: dashed ? 'dashed' : 'solid',
        opacity: dim ? 0.75 : 1,
      }}
    >
      <p className="text-[14px] font-semibold" style={{ color: accent ? C.accent : C.ink }}>{title}</p>
      {meta && <p className="text-[11px] mt-0.5 font-mono" style={{ color: C.muted }}>{meta}</p>}
      {lines && lines.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {lines.map((l, i) => (
            <p key={i} className="text-[11.5px] leading-snug" style={{ color: C.muted }}>{l}</p>
          ))}
        </div>
      )}
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}

/** เส้นเชื่อมชั้น — CSS ล้วน ปรับตามความกว้างจอเอง */
function Down({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-1.5">
      <span className="w-px h-3.5" style={{ background: C.accentLine }} />
      {label && (
        <span
          className="text-[10.5px] rounded-full px-2 py-0.5 my-1 border"
          style={{ background: C.surface, borderColor: C.line, color: C.muted }}
        >
          {label}
        </span>
      )}
      <span className="w-px h-3.5" style={{ background: C.accentLine }} />
      <span className="text-[10px] leading-none" style={{ color: C.accentLine }}>▼</span>
    </div>
  )
}

function Stat({ n, label, hint }: { n: string; label: string; hint?: string }) {
  return (
    <div className="rounded-lg border px-3.5 py-3" style={{ background: C.surface, borderColor: C.line }}>
      <p className="text-[23px] font-semibold leading-none" style={{ color: C.accent }}>{n}</p>
      <p className="text-[12px] mt-1.5" style={{ color: C.ink }}>{label}</p>
      {hint && <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{hint}</p>}
    </div>
  )
}

export default function ArchPage() {
  const [d, setD] = useState<Arch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/web/core?arch=1')
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error ?? `HTTP ${res.status}`)
      // เผื่อฝั่งเซิร์ฟเวอร์กลับไปห่อคำตอบอีกชั้น — รับได้ทั้งสองรูป ไม่พังเงียบ
      setD((j?.arch ?? j) as Arch)
    } catch (e) {
      // ⚠️ ทิ้งของเก่าทั้งชุด — ผังที่โชว์เลขค้างโดยไม่บอกว่าค้าง คือผังที่โกหก
      setD(null)
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const fn = d?.functions
  const scheduled = Array.isArray(fn?.scheduled) ? fn!.scheduled! : []
  const blobs = Array.isArray(d?.blobs) ? d!.blobs! : []
  const tables = Array.isArray(d?.d1?.tables) ? d!.d1!.tables! : []
  const edge = Array.isArray(d?.edge) ? d!.edge! : []
  const logins = Array.isArray(d?.loginProviders) ? d!.loginProviders! : []
  const unlabelled = Array.isArray(d?.unlabelled) ? d!.unlabelled! : []
  const integrations = Array.isArray(d?.integrations) ? d!.integrations! : []
  const live = integrations.filter((i) => i.live)
  const waiting = integrations.filter((i) => !i.live)
  const hasR2 = integrations.some((i) => /r2|cloudflare/i.test(i.id) || /R2/.test(i.name))

  const stamp = d?.generatedAt
    ? new Date(d.generatedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    : null
  const n = (v?: number) => (typeof v === 'number' ? v.toLocaleString('th-TH') : 'ไม่ทราบจำนวน')

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สถาปัตยกรรมที่ใช้อยู่"
        summary={<>ผังนี้<b>สแกนจากโค้ดจริง</b> ไม่มีใครพิมพ์ไว้ — แก้ระบบแล้ว deploy ผังเปลี่ยนตามเอง</>}
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'อ่านใหม่'}</BtnGhost>}
      />

      {error && (
        <ErrorBox title="อ่านผังไม่ได้">
          {error}
          <br />
          <span className="text-[12.5px]">
            หน้านี้ตั้งใจ<b>ไม่แสดงตัวเลขค้างจากรอบก่อน</b> — ผังที่โชว์เลขเก่าโดยไม่บอกว่าเก่า
            อันตรายกว่าไม่มีผัง เพราะเอาไปตัดสินใจต่อได้
          </span>
        </ErrorBox>
      )}
      {loading && !d && <LoadingState />}

      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-4">
            <Stat n={n(d.pages?.count)} label="หน้าเว็บหน้าร้าน" />
            <Stat n={n(fn?.count)} label="ฟังก์ชันเซิร์ฟเวอร์" hint={scheduled.length ? `ทำงานเอง ${scheduled.length} ตัว` : undefined} />
            <Stat n={n(blobs.length)} label="ถังเก็บข้อมูล" hint="Netlify Blobs" />
            <Stat n={n(tables.length)} label="ตารางในคลังเงา" hint="Cloudflare D1" />
            <Stat n={`${live.length}/${integrations.length}`} label="บริการข้างนอกที่ต่อแล้ว" />
          </div>

          {/* ───────── ผัง 5 ชั้น ───────── */}
          <div className="rounded-xl border p-4 md:p-6 mb-4" style={{ background: C.bg, borderColor: C.line }}>
            <div className="max-w-[760px] mx-auto">

              {/* ชั้น 1 — ใครเป็นคนเริ่มเรื่อง */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <Actor title="ลูกค้า" sub="เบราว์เซอร์ · แอปที่ติดตั้ง (PWA)" />
                <Actor title="งานตั้งเวลา" sub={scheduled.length ? `${scheduled.length} ตัว ทำงานเองตามเวลา` : 'ทำงานเองตามเวลา'} />
                <Actor title="เจ้าของร้าน + ภรรยา" sub="เปิดหลังร้านผ่านเบราว์เซอร์" />
                <Actor title="Telegram" sub="แจ้งเตือน + ปุ่มกดตอบกลับ" />
              </div>

              <Down />

              {/* ชั้น 2 — สองเว็บ + ท่อกลาง */}
              <div className="grid md:grid-cols-[1fr_auto_1fr] gap-2.5 items-stretch">
                <Node
                  accent
                  title={d.site ?? 'หน้าร้าน'}
                  meta={d.repo ? `Netlify · ${d.project ?? '—'} · repo ${d.repo}` : undefined}
                  lines={[
                    'หน้าร้าน · ตะกร้า · เช็คเอาต์ · ฟีดคลิป · ขอทะเบียน',
                    `ไฟล์นิ่ง ${n(d.pages?.count)} หน้า + ฟังก์ชัน ${n(fn?.count)}`
                    + (edge.length ? ` + ตัวดักขอบ ${edge.length}` : ''),
                  ]}
                >
                  {logins.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[11px]" style={{ color: C.muted }}>เข้าสู่ระบบ:</span>
                      {logins.map((p) => <Tag key={p} tone="accent">{p}</Tag>)}
                    </div>
                  )}
                </Node>

                <div className="flex md:flex-col items-center justify-center gap-1 px-1">
                  <span className="hidden md:block w-px flex-1" style={{ background: C.accentLine }} />
                  <span
                    className="text-[11px] rounded-full border px-2.5 py-1 text-center whitespace-nowrap"
                    style={{ background: C.surface, borderColor: C.accentLine, color: C.accent }}
                  >
                    ท่อกลาง
                    <span className="block font-mono text-[10.5px]" style={{ color: C.muted }}>/api/web/*</span>
                  </span>
                  <span className="hidden md:block w-px flex-1" style={{ background: C.accentLine }} />
                </div>

                <Node
                  title="admin.gucut.com"
                  meta="Netlify · gucut-admin · repo gucut-next"
                  lines={['หลังร้านตัวจริง — จอที่คุณเปิดอยู่ตอนนี้']}
                >
                  {/* ⚠️ ตัวสแกนอ่านฝั่งนี้ไม่ได้ ⇒ ห้ามลอกตัวเลขจากผังต้นฉบับมาใส่
                      ตัวเลขที่ไม่มีใครตรวจ = ตัวเลขที่จะผิดโดยไม่มีใครรู้ */}
                  <span
                    className="text-[11px] rounded px-1.5 py-0.5 inline-block leading-relaxed"
                    style={{ background: '#FEF3C7', color: '#92400E' }}
                  >
                    ยังไม่ได้ถูกสแกน — ตัวสแกนอ่านได้เฉพาะที่เก็บโค้ดของหน้าร้าน
                  </span>
                </Node>
              </div>

              <Down label="เก็บข้อมูลที่" />

              {/* ชั้น 3 — ที่เก็บข้อมูล */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                <Node
                  title="Netlify Blobs"
                  meta={blobs.length ? `${blobs.length} ถัง` : 'ไม่ทราบจำนวนถัง'}
                  lines={['ออเดอร์ · แชท · คนเข้าเว็บ · ลงเวลา · รีวิวรอเข้า · สมาชิก']}
                >
                  <div className="flex flex-wrap gap-1">{blobs.map((b) => <Tag key={b}>{b}</Tag>)}</div>
                </Node>
                <Node
                  title="Cloudflare D1"
                  meta={tables.length ? `${tables.length} ตาราง` : 'ไม่ทราบจำนวนตาราง'}
                  lines={['คลังเงา — กระจกของ ZORT', 'และเป็นที่เก็บสำเนาสำรองของถังฝั่งซ้าย']}
                >
                  <div className="flex flex-wrap gap-1">{tables.map((t) => <Tag key={t}>{t}</Tag>)}</div>
                </Node>
                {hasR2 && (
                  <Node
                    title="Cloudflare R2"
                    lines={[
                      'คลิปวิดีโอ (HLS) และรูปสินค้า',
                      'เบราว์เซอร์ลูกค้าโหลดตรงจากที่นี่ ไม่ผ่านตัวเว็บ',
                    ]}
                  />
                )}
              </div>

              {edge.length > 0 && (
                <>
                  <Down />
                  <Node
                    title="ตัวดักที่ขอบเครือข่าย"
                    lines={['ทำงานก่อนคำขอถึงเว็บ ใช้กับบอตของ AI']}
                  >
                    <div className="flex flex-wrap gap-1">{edge.map((e) => <Tag key={e}>{e}</Tag>)}</div>
                  </Node>
                </>
              )}

              {scheduled.length > 0 && (
                <>
                  <Down label="งานที่ทำเองตามเวลา" />
                  <Node title="งานตั้งเวลา" meta={`${scheduled.length} ตัว`}>
                    <div className="space-y-1">
                      {scheduled.map((s) => {
                        const gloss = cronThai(s.cron)
                        return (
                          <div key={s.name} className="flex flex-wrap items-baseline gap-2">
                            <Tag>{s.name}</Tag>
                            <span className="text-[11.5px]" style={{ color: C.ink }}>{gloss ?? s.cron}</span>
                            {gloss && <span className="text-[10.5px] font-mono" style={{ color: C.muted }}>{s.cron}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </Node>
                </>
              )}
            </div>
          </div>

          {/* ───────── ชั้น 4-5: ของนอกบ้าน ───────── */}
          {integrations.length > 0 && (
            <>
              <div className="flex items-baseline gap-2 mb-2">
                <p className="text-[15px] font-semibold" style={{ color: C.ink }}>บริการภายนอกที่ต่อแล้ว</p>
                <p className="text-[12px]" style={{ color: C.muted }}>{live.length} จาก {integrations.length} เจ้า</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-4">
                {live.map((it) => (
                  <div key={it.id} className="rounded-lg border px-3.5 py-3"
                    style={{ background: C.accentSoft, borderColor: C.accentLine }}>
                    <p className="text-[13px] font-semibold" style={{ color: C.ink }}>{it.name}</p>
                    <p className="text-[11.5px] mt-0.5 leading-relaxed" style={{ color: C.muted }}>{it.what}</p>
                    {!it.inCode && (
                      <span className="text-[10.5px] rounded px-1.5 py-0.5 inline-block mt-1.5"
                        style={{ background: C.surface, color: C.muted }}>
                        โค้ดยังไม่ได้เรียกใช้
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {waiting.length > 0 && (
                <>
                  <div className="flex items-baseline gap-2 mb-2">
                    <p className="text-[15px] font-semibold" style={{ color: C.ink }}>ยังไม่ต่อ — โค้ดเขียนรอไว้แล้ว</p>
                    <p className="text-[12px]" style={{ color: C.muted }}>{waiting.length} เจ้า</p>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-4">
                    {waiting.map((it) => (
                      <div key={it.id} className="rounded-lg border border-dashed px-3.5 py-3"
                        style={{ background: C.surface, borderColor: C.line }}>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p className="text-[13px] font-semibold" style={{ color: C.ink }}>{it.name}</p>
                          <span className="text-[10.5px] rounded px-1.5 py-0.5"
                            style={it.partial
                              ? { background: '#FEF3C7', color: '#92400E' }
                              : { background: C.slateSoft, color: C.slate }}>
                            {it.partial ? 'ตั้งคีย์ไม่ครบ' : 'ยังไม่ได้ตั้ง'}
                          </span>
                        </div>
                        <p className="text-[11.5px] mt-0.5 leading-relaxed" style={{ color: C.muted }}>{it.what}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ⚠️ ตัวแปรที่ตัวสแกนยังไม่รู้จัก — ต้องโชว์ ไม่งั้นผังดูครบทั้งที่ยังมีของนอกสายตา */}
          {unlabelled.length > 0 && (
            <div className="text-[12.5px] rounded-lg px-3.5 py-2.5 mb-3 leading-relaxed border"
              style={{ background: '#FEF3C7', borderColor: '#FDE68A', color: '#92400E' }}>
              ⚠️ ยังจัดหมวดไม่ได้ <b>{unlabelled.length} ตัว</b> — ตัวสแกนเห็นว่าโค้ดใช้อยู่
              แต่ยังไม่รู้ว่าเป็นบริการอะไร: {unlabelled.join(' · ')}
            </div>
          )}

          <div className="text-[11.5px] rounded-lg border px-3.5 py-2.5 leading-relaxed"
            style={{ background: C.surface, borderColor: C.line, color: C.muted }}>
            {stamp
              ? <>ข้อมูลชุดนี้สร้างตอน build รอบ <b>{stamp} น.</b> — แก้โค้ดแล้วยังไม่ deploy ผังจะยังไม่เปลี่ยน</>
              : 'ไม่ทราบเวลาที่สร้างข้อมูลชุดนี้'}
            <br />
            ตัวเลขทั้งหมดมาจากการสแกน<b>ฝั่งหน้าร้าน</b> · กล่อง admin.gucut.com ยังไม่ได้ถูกสแกน
            จึงไม่มีตัวเลขกำกับ — ตัวเลขที่ไม่มีใครตรวจ คือตัวเลขที่จะผิดโดยไม่มีใครรู้
          </div>
        </>
      )}
    </div>
  )
}
