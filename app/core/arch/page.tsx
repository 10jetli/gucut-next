'use client'
// สถาปัตยกรรมที่ใช้อยู่ — ผังระบบที่ **อ่านจากซอร์สจริง** ไม่ใช่ผังที่คนวาดค้างไว้
//
// เจ้าของร้านสั่ง (2 ก.ย. 2569): "ทำผังใส่ใน admin.gucut.com ถ้ามีการเปลี่ยนแปลง
// ก็ให้อัปเดตอัตโนมัติ เขียนเมนูว่า สถาปัตยกรรมที่ใช้อยู่"
// แล้วสั่งเพิ่ม (3 ก.ย. 2569): "ทำให้สวย ๆ" พร้อมลิงก์ผังตัวอย่างของฝั่งเจ้าของร้าน
//
// ⚠️ **ห้ามพิมพ์ตัวเลขใด ๆ ลงหน้านี้เด็ดขาด** ทุกตัวเลขมาจาก /api/web/core?arch=1
//    ซึ่งฝั่งเซิร์ฟเวอร์สแกนซอร์สจริงตอน build · ผังที่คนกรอกเองจะกลายเป็นของโกหก
//    ภายในไม่กี่สัปดาห์ (เพิ่มฟังก์ชันแล้วลืมแก้ผัง) และ **แย่กว่าไม่มีผังเลย**
//    เพราะคนเอาไปตัดสินใจต่อโดยเชื่อว่ามันตรง
// ⚠️ **อ่านไม่ได้ต้องขึ้นว่าอ่านไม่ได้ ห้ามโชว์ตัวเลขค้างจากรอบก่อน**
// ⚠️ ผังนี้ครอบคลุม **เฉพาะฝั่งหน้าร้าน (gucut-web)** — ตัวสแกนอยู่คนละ repo กับหลังร้าน
//    ต้องเขียนบอกบนหน้า ไม่งั้นคนอ่านนึกว่านี่คือทั้งระบบ
import { useCallback, useEffect, useState } from 'react'
import LoadingState from '@/components/ui/LoadingState'
import ErrorBox from '@/components/ui/ErrorBox'
import { PageHead, BtnGhost } from '@/components/zort'

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

const NAVY = '#1b3b73'

/** งานตามเวลาตั้งบน Netlify เป็น **เวลาสากล** — แปลงเป็นเวลาไทยให้อ่านออก
 *  ⚠️ แปลเฉพาะรูปที่แน่ใจจริง ๆ · รูปอื่นคืนค่าดิบ ดีกว่าแปลผิดแล้วคนเชื่อ */
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

/** ป้ายชื่อเล็ก ๆ แบบตัวพิมพ์คงความกว้าง — ใช้กับชื่อถัง/ตาราง/ฟังก์ชัน */
function Tag({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'light' }) {
  return (
    <span className={`text-[11px] font-mono rounded px-1.5 py-0.5 leading-relaxed ${
      tone === 'light' ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-600'
    }`}>
      {children}
    </span>
  )
}

/** การ์ดหนึ่งชั้นของผัง — แถบสีซ้ายบอกชั้น ทำให้กวาดตาแล้วเห็นลำดับได้เร็ว */
function Layer({
  accent, icon, title, count, sub, children, dark = false,
}: {
  accent: string
  icon: string
  title: string
  count?: string
  sub?: string
  children?: React.ReactNode
  dark?: boolean
}) {
  return (
    <div
      className={`relative rounded-lg border overflow-hidden ${
        dark ? 'text-white border-transparent' : 'bg-white border-gray-200'
      }`}
      style={dark ? { background: NAVY } : undefined}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />
      <div className="pl-4 pr-3.5 py-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[15px] leading-none">{icon}</span>
          <p className={`text-[13.5px] font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{title}</p>
          {count && (
            <span className={`text-[11.5px] font-semibold rounded-full px-2 py-0.5 ${
              dark ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
              {count}
            </span>
          )}
        </div>
        {sub && <p className={`text-[11.5px] mt-1 ${dark ? 'text-white/70' : 'text-gray-500'}`}>{sub}</p>}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  )
}

/** เส้นเชื่อมระหว่างชั้น — วาดด้วย CSS ล้วน ปรับตามความกว้างจอเอง ไม่ใช้รูป */
function Link({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-1">
      <span className="w-px h-3" style={{ background: '#cbd9ef' }} />
      {label && (
        <span className="text-[10.5px] text-gray-400 bg-white border border-gray-200 rounded-full px-2 py-0.5 my-0.5">
          {label}
        </span>
      )}
      <span className="w-px h-3" style={{ background: '#cbd9ef' }} />
      <span className="text-[10px] leading-none" style={{ color: '#cbd9ef' }}>▼</span>
    </div>
  )
}

/** ตัวเลขใหญ่หนึ่งช่อง — ทั้งแถบบนสุดของหน้า */
function Stat({ n, label, hint }: { n: string; label: string; hint?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3.5 py-3">
      <p className="text-[22px] font-semibold leading-none" style={{ color: NAVY }}>{n}</p>
      <p className="text-[12px] text-gray-700 mt-1.5">{label}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

function stateOf(it: Integration) {
  if (it.live) return { text: 'ต่อแล้ว', dot: '#10b981', cls: 'text-emerald-800 bg-emerald-50 border-emerald-200' }
  if (it.partial) return { text: 'ตั้งคีย์ไม่ครบ', dot: '#f59e0b', cls: 'text-amber-800 bg-amber-50 border-amber-200' }
  return { text: 'ยังไม่ได้ตั้ง', dot: '#cbd5e1', cls: 'text-gray-600 bg-gray-50 border-gray-200' }
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
      setD(j)
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
  const partial = integrations.filter((i) => !i.live && i.partial)
  const off = integrations.filter((i) => !i.live && !i.partial)

  const stamp = d?.generatedAt
    ? new Date(d.generatedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    : null
  const n = (v?: number) => (typeof v === 'number' ? v.toLocaleString('th-TH') : '—')

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สถาปัตยกรรมที่ใช้อยู่"
        summary={
          d
            ? <>ผังนี้<b>สแกนจากโค้ดจริง</b> ไม่มีใครพิมพ์ไว้ — แก้ระบบแล้ว deploy ผังเปลี่ยนตามเอง</>
            : 'กำลังอ่านจากเซิร์ฟเวอร์…'
        }
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
          {/* ───────── ตัวเลขรวม ───────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-4">
            <Stat n={n(d.pages?.count)} label="หน้าเว็บหน้าร้าน" />
            <Stat n={n(fn?.count)} label="ฟังก์ชันเซิร์ฟเวอร์" hint={scheduled.length ? `ทำงานเอง ${scheduled.length}` : undefined} />
            <Stat n={n(blobs.length)} label="ถังเก็บข้อมูล" hint="Netlify Blobs" />
            <Stat n={n(tables.length)} label="ตารางในคลังเงา" hint="Cloudflare D1" />
            <Stat n={`${live.length}/${integrations.length}`} label="บริการข้างนอกที่ต่อแล้ว" />
          </div>

          {/* ───────── ผังชั้น ───────── */}
          <div className="bg-[#f7f9fd] border border-gray-200 rounded-lg p-4 md:p-6 mb-4">
            <div className="max-w-[640px] mx-auto">
              <Layer accent="#94a3b8" icon="👥" title="ลูกค้า และเจ้าของร้าน"
                sub="เปิดผ่านเบราว์เซอร์ หรือแอปที่ติดตั้งจากเว็บ (PWA)" />
              <Link />

              <div className="grid sm:grid-cols-2 gap-3">
                <Layer
                  dark
                  accent="#4f8ef7"
                  icon="🛒"
                  title={d.site ?? 'หน้าร้าน'}
                  count={typeof d.pages?.count === 'number' ? `${d.pages.count} หน้า` : undefined}
                  sub={d.repo ? `โค้ดอยู่ที่ ${d.repo}` : undefined}
                >
                  {logins.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[11px] text-white/60 self-center">เข้าสู่ระบบ:</span>
                      {logins.map((p) => <Tag key={p} tone="light">{p}</Tag>)}
                    </div>
                  )}
                </Layer>
                <Layer
                  accent="#cbd5e1"
                  icon="🖥️"
                  title="หลังร้าน admin.gucut.com"
                  sub="จอที่คุณเปิดอยู่ตอนนี้ — เรียกข้อมูลผ่านท่อกลางไปหาหน้าร้าน"
                >
                  {/* ⚠️ ต้องบอกตรง ๆ ว่าฝั่งนี้ไม่ได้ถูกสแกน ไม่งั้นคนอ่านนึกว่าผังครอบคลุมทั้งระบบ */}
                  <span className="text-[11px] text-amber-800 bg-amber-100 rounded px-1.5 py-0.5">
                    ไม่ได้อยู่ในผังนี้ — ตัวสแกนอยู่คนละที่เก็บโค้ด
                  </span>
                </Layer>
              </div>

              <Link label="เรียกผ่าน /api/" />

              <Layer
                accent="#8b5cf6"
                icon="⚙️"
                title="ฟังก์ชันฝั่งเซิร์ฟเวอร์"
                count={typeof fn?.count === 'number' ? `${fn.count} ตัว` : undefined}
                sub={scheduled.length ? `ในนี้มี ${scheduled.length} ตัวที่ทำงานเองตามเวลา` : undefined}
              >
                {scheduled.length > 0 && (
                  <div className="space-y-1">
                    {scheduled.map((s) => {
                      const gloss = cronThai(s.cron)
                      return (
                        <div key={s.name} className="flex flex-wrap items-baseline gap-2">
                          <Tag>{s.name}</Tag>
                          <span className="text-[11.5px] text-gray-600">{gloss ?? s.cron}</span>
                          {gloss && <span className="text-[10.5px] text-gray-400 font-mono">{s.cron}</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Layer>

              {edge.length > 0 && (
                <>
                  <Link />
                  <Layer accent="#f59e0b" icon="🛡️" title="ตัวดักที่ขอบเครือข่าย"
                    sub="ทำงานก่อนคำขอถึงเว็บ ใช้กับบอตของ AI">
                    <div className="flex flex-wrap gap-1">{edge.map((e) => <Tag key={e}>{e}</Tag>)}</div>
                  </Layer>
                </>
              )}

              <Link label="เก็บข้อมูลที่" />

              <div className="grid sm:grid-cols-2 gap-3">
                <Layer accent="#10b981" icon="🗄️" title="Netlify Blobs"
                  count={blobs.length ? `${blobs.length} ถัง` : undefined}
                  sub="ออเดอร์ · แชท · รีวิวรอเข้า · ลงเวลา ฯลฯ">
                  <div className="flex flex-wrap gap-1">{blobs.map((b) => <Tag key={b}>{b}</Tag>)}</div>
                </Layer>
                <Layer accent="#0ea5e9" icon="🌳" title="Cloudflare D1 — คลังเงา"
                  count={tables.length ? `${tables.length} ตาราง` : undefined}
                  sub="ระบบที่กำลังสร้างมาแทน ZORT">
                  <div className="flex flex-wrap gap-1">{tables.map((t) => <Tag key={t}>{t}</Tag>)}</div>
                </Layer>
              </div>
            </div>
          </div>

          {/* ───────── ของนอกบ้าน ───────── */}
          <div className="mb-4">
            <div className="flex items-baseline gap-2 mb-2">
              <p className="text-[15px] font-semibold text-gray-900">บริการข้างนอกที่ระบบพึ่งอยู่</p>
              <p className="text-[12px] text-gray-500">ต่อแล้ว {live.length} จาก {integrations.length} เจ้า</p>
            </div>

            {integrations.length === 0 ? (
              <p className="text-[13px] text-gray-400 bg-white border border-gray-200 rounded-lg px-4 py-5">
                ตัวสแกนไม่พบบริการภายนอกเลย
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {[...live, ...partial, ...off].map((it) => {
                  const s = stateOf(it)
                  return (
                    <div key={it.id} className={`border rounded-lg px-3.5 py-3 ${s.cls}`}>
                      <div className="flex items-start gap-2">
                        <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: s.dot }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-gray-900">{it.name}</p>
                          <p className="text-[11.5px] text-gray-600 leading-relaxed mt-0.5">{it.what}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2 pl-4">
                        <span className="text-[11px] font-semibold">{s.text}</span>
                        {/* ตั้งคีย์ไว้แต่โค้ดไม่ได้เรียก — ต้องบอก ไม่งั้นเข้าใจว่าใช้งานอยู่ */}
                        {!it.inCode && (
                          <span className="text-[10.5px] text-gray-500 bg-white/70 border border-gray-200 rounded px-1.5 py-0.5">
                            โค้ดยังไม่ได้เรียกใช้
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ⚠️ ตัวแปรที่ตัวสแกนยังไม่รู้จัก — ต้องโชว์ ไม่งั้นผังดูครบทั้งที่ยังมีของนอกสายตา */}
          {unlabelled.length > 0 && (
            <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5 mb-3 leading-relaxed">
              ⚠️ ยังจัดหมวดไม่ได้ <b>{unlabelled.length} ตัว</b> — ตัวสแกนเห็นว่าโค้ดใช้อยู่
              แต่ยังไม่รู้ว่าเป็นบริการอะไร: {unlabelled.join(' · ')}
            </div>
          )}

          <div className="text-[11.5px] text-gray-500 bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 leading-relaxed">
            {stamp
              ? <>ข้อมูลชุดนี้สร้างตอน build รอบ <b>{stamp} น.</b> — แก้โค้ดแล้วยังไม่ deploy ผังจะยังไม่เปลี่ยน</>
              : 'ไม่ทราบเวลาที่สร้างข้อมูลชุดนี้'}
            <br />
            ผังนี้แสดง<b>เฉพาะฝั่งหน้าร้าน</b> (gucut.com) ยังไม่รวมหลังร้านที่คุณเปิดอยู่ตอนนี้
            เพราะตัวสแกนอ่านได้เฉพาะที่เก็บโค้ดของหน้าร้าน
          </div>
        </>
      )}
    </div>
  )
}
