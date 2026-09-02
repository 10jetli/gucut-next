'use client'
// สถาปัตยกรรมที่ใช้อยู่ — ผังระบบที่ **อ่านจากซอร์สจริง** ไม่ใช่ผังที่คนวาดค้างไว้
//
// เจ้าของร้านสั่ง (2 ก.ย. 2569): "ทำผังใส่ใน admin.gucut.com ถ้ามีการเปลี่ยนแปลง
// ก็ให้อัปเดตอัตโนมัติ เขียนเมนูว่า สถาปัตยกรรมที่ใช้อยู่"
//
// ⚠️ **ห้ามพิมพ์ตัวเลขใด ๆ ลงหน้านี้เด็ดขาด** ทุกตัวเลขมาจาก /api/web/core?arch=1
//    ซึ่งฝั่งเซิร์ฟเวอร์สแกนซอร์สจริงตอน build · ผังที่คนกรอกเองจะกลายเป็นของโกหก
//    ภายในไม่กี่สัปดาห์ (เพิ่มฟังก์ชันแล้วลืมแก้ผัง) และ **แย่กว่าไม่มีผังเลย**
//    เพราะคนเอาไปตัดสินใจต่อโดยเชื่อว่ามันตรง
//
// ⚠️ **อ่านไม่ได้ต้องขึ้นว่าอ่านไม่ได้ ห้ามโชว์ตัวเลขค้างจากรอบก่อน**
//    ผังที่โชว์เลขเก่าโดยไม่บอกว่าเก่า คืออันตรายที่สุดในบรรดาของที่หน้านี้ทำได้
//
// ⚠️ ผังนี้ครอบคลุม **เฉพาะฝั่งหน้าร้าน (gucut-web)** — ตัวสแกนอยู่คนละ repo กับหลังร้าน
//    จึงมองไม่เห็นเส้นทาง API ของฝั่งนี้ · หน้า /core/* · ถัง Blobs ของฝั่งนี้
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

/** กล่องหนึ่งชั้นของผัง */
function Box({
  title, sub, items, tone = 'plain',
}: {
  title: string
  sub?: string
  items?: (string | null | undefined)[]
  tone?: 'plain' | 'navy' | 'soft'
}) {
  const cls =
    tone === 'navy' ? 'bg-[#1b3b73] text-white border-[#1b3b73]'
      : tone === 'soft' ? 'bg-[#eef3fb] border-[#c9daf3] text-gray-800'
        : 'bg-white border-gray-200 text-gray-800'
  return (
    <div className={`border rounded-md px-3.5 py-3 ${cls}`}>
      <p className={`text-[13.5px] font-semibold ${tone === 'navy' ? 'text-white' : 'text-gray-900'}`}>{title}</p>
      {sub && <p className={`text-[11.5px] mt-0.5 ${tone === 'navy' ? 'text-white/70' : 'text-gray-500'}`}>{sub}</p>}
      {items && items.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {items.filter(Boolean).map((it, i) => (
            <span
              key={i}
              className={`text-[11px] rounded px-1.5 py-0.5 ${
                tone === 'navy' ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {it}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** ลูกศรลง — วาดด้วย CSS ไม่ใช้รูป จะได้ปรับตามความกว้างจอเอง */
function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-1.5">
      <span className="w-px h-4" style={{ background: '#c9daf3' }} />
      {label && <span className="text-[10.5px] text-gray-400 py-0.5">{label}</span>}
      <span className="text-[11px] leading-none" style={{ color: '#c9daf3' }}>▼</span>
    </div>
  )
}

function StatePill({ it }: { it: Integration }) {
  // สามสถานะตามที่ตัวสแกนคืนมา — ห้ามเดาจากชื่อ
  const [text, cls] = it.live
    ? ['ต่อแล้ว', 'text-emerald-800 bg-emerald-100']
    : it.partial
      ? ['ตั้งคีย์ไม่ครบ', 'text-amber-800 bg-amber-100']
      : ['ยังไม่ได้ตั้ง', 'text-gray-600 bg-gray-100']
  return <span className={`text-[11px] font-semibold rounded px-1.5 py-0.5 shrink-0 ${cls}`}>{text}</span>
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
  const scheduled = Array.isArray(fn?.scheduled) ? fn!.scheduled : []
  const blobs = Array.isArray(d?.blobs) ? d!.blobs : []
  const tables = Array.isArray(d?.d1?.tables) ? d!.d1!.tables! : []
  const edge = Array.isArray(d?.edge) ? d!.edge : []
  const logins = Array.isArray(d?.loginProviders) ? d!.loginProviders : []
  const unlabelled = Array.isArray(d?.unlabelled) ? d!.unlabelled : []
  const integrations = Array.isArray(d?.integrations) ? d!.integrations : []
  const liveCount = integrations.filter((i) => i.live).length

  const stamp = d?.generatedAt
    ? new Date(d.generatedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <div className="p-4 md:p-6">
      <PageHead
        title="สถาปัตยกรรมที่ใช้อยู่"
        summary={
          d
            ? `อ่านจากซอร์สจริงตอน build · ${stamp ? `ข้อมูลจากรอบ ${stamp} น.` : 'ไม่ทราบเวลาที่สร้าง'}`
            : 'กำลังอ่านจากเซิร์ฟเวอร์…'
        }
        actions={<BtnGhost onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'อ่านใหม่'}</BtnGhost>}
      />

      <div className="text-[12.5px] text-blue-800 bg-blue-50 border border-blue-100 rounded px-3 py-2 mb-3 leading-relaxed">
        ℹ️ ทุกตัวเลขในหน้านี้<b>สแกนจากโค้ดจริง</b> ไม่มีใครพิมพ์ไว้ — เพิ่มฟังก์ชันหรือถังเก็บข้อมูลใหม่
        แล้ว deploy ผังจะเปลี่ยนตามเอง · ผังนี้แสดง<b>เฉพาะฝั่งหน้าร้าน</b> (gucut.com)
        ยังไม่รวมหลังร้านที่คุณกำลังเปิดอยู่ตอนนี้ เพราะตัวสแกนอยู่คนละที่เก็บโค้ด
      </div>

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
          {/* ───────── ผังโครง ───────── */}
          <div className="bg-white border border-gray-200 rounded-md p-4 mb-3">
            <div className="max-w-[620px] mx-auto">
              <Box tone="soft" title="ลูกค้า / เจ้าของร้าน" sub="เปิดผ่านเบราว์เซอร์หรือแอปที่ติดตั้งจากเว็บ (PWA)" />
              <Arrow />
              <div className="grid sm:grid-cols-2 gap-3">
                <Box
                  tone="navy"
                  title={d.site ?? 'หน้าร้าน'}
                  sub={`หน้าเว็บ${typeof d.pages?.count === 'number' ? ` ${d.pages.count} หน้า` : ''}`}
                  items={logins.length ? [`เข้าสู่ระบบ: ${logins.join(' · ')}`] : []}
                />
                <Box
                  title="หลังร้าน admin.gucut.com"
                  sub="จอที่คุณเปิดอยู่ตอนนี้ — เรียกข้อมูลผ่านท่อกลางไปหาหน้าร้าน"
                  items={['ไม่อยู่ในผังนี้']}
                />
              </div>
              <Arrow label="เรียกผ่าน /api/" />
              <Box
                title="ฟังก์ชันฝั่งเซิร์ฟเวอร์"
                sub={
                  typeof fn?.count === 'number'
                    ? `${fn.count} ตัว${scheduled.length ? ` · ทำงานตามเวลาเอง ${scheduled.length} ตัว` : ''}`
                    : 'ไม่ทราบจำนวน'
                }
                items={scheduled.map((s) => `${s.name} · ${s.cron}`)}
              />
              {edge.length > 0 && (
                <>
                  <Arrow />
                  <Box title="ตัวดักที่ขอบเครือข่าย" sub="ทำงานก่อนถึงเว็บ ใช้กับบอต" items={edge} />
                </>
              )}
              <Arrow label="เก็บข้อมูลที่" />
              <div className="grid sm:grid-cols-2 gap-3">
                <Box
                  title="Netlify Blobs"
                  sub={blobs.length ? `${blobs.length} ถัง` : 'ไม่ทราบจำนวนถัง'}
                  items={blobs}
                />
                <Box
                  title="Cloudflare D1 (คลังเงา)"
                  sub={tables.length ? `${tables.length} ตาราง` : 'ไม่ทราบจำนวนตาราง'}
                  items={tables}
                />
              </div>
            </div>
          </div>

          {/* ───────── ของนอกบ้าน ───────── */}
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-3">
            <div className="px-4 py-3 border-b border-gray-100 flex items-baseline gap-2">
              <p className="text-[14.5px] font-semibold text-gray-900">บริการข้างนอกที่ระบบพึ่งอยู่</p>
              <p className="text-[12px] text-gray-500">
                ต่อแล้ว {liveCount} จาก {integrations.length} เจ้า
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {integrations.length === 0 && (
                <p className="px-4 py-5 text-[13px] text-gray-400">ตัวสแกนไม่พบบริการภายนอกเลย</p>
              )}
              {integrations.map((it) => (
                <div key={it.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-gray-900">{it.name}</span>
                      {/* โค้ดไม่ได้เรียกใช้ = ตั้งคีย์ไว้เฉย ๆ ต้องบอก ไม่งั้นเข้าใจว่าใช้งานอยู่ */}
                      {!it.inCode && (
                        <span className="text-[10.5px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                          โค้ดยังไม่ได้เรียกใช้
                        </span>
                      )}
                    </span>
                    <span className="block text-[12px] text-gray-500 leading-relaxed">{it.what}</span>
                  </span>
                  <StatePill it={it} />
                </div>
              ))}
            </div>
          </div>

          {/* ⚠️ ตัวแปรที่ตัวสแกนยังไม่รู้จัก — ต้องโชว์ ไม่งั้นผังดูครบทั้งที่ยังมีของนอกสายตา */}
          {unlabelled.length > 0 && (
            <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-3 py-2 mb-3 leading-relaxed">
              ⚠️ ยังจัดหมวดไม่ได้ <b>{unlabelled.length} ตัว</b> — ตัวสแกนเห็นว่าโค้ดใช้อยู่
              แต่ยังไม่รู้ว่าเป็นบริการอะไร: {unlabelled.join(' · ')}
            </div>
          )}

          <p className="text-[11.5px] text-gray-400 leading-relaxed">
            {stamp
              ? <>ข้อมูลชุดนี้สร้างตอน build รอบ <b>{stamp} น.</b> — ถ้าเพิ่งแก้โค้ดแล้วยังไม่ deploy ผังจะยังไม่เปลี่ยน</>
              : 'ไม่ทราบเวลาที่สร้างข้อมูลชุดนี้'}
          </p>
        </>
      )}
    </div>
  )
}
