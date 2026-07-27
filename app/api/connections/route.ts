import { NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/gmail'
import { zortFetch, STORES } from '@/lib/zort'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// GET /api/connections → ตรวจสถานะการเชื่อมต่อบริการภายนอกทั้งหมด
interface ConnStatus {
  id: string
  name: string
  detail: string
  ok: boolean
  message: string
  latencyMs: number
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result?: T; error?: string; ms: number }> {
  const start = Date.now()
  try {
    const result = await fn()
    return { result, ms: Date.now() - start }
  } catch (e: any) {
    return { error: e?.message ?? String(e), ms: Date.now() - start }
  }
}

async function checkGmail(): Promise<ConnStatus> {
  const t = await timed(async () => {
    const token = await getAccessToken()
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(JSON.stringify(data).slice(0, 200))
    return data.emailAddress as string
  })
  return {
    id: 'gmail',
    name: 'Gmail API (ระบบเก็บบิล)',
    detail: t.result ? 'บัญชี ' + t.result : 'Google OAuth refresh token',
    ok: !t.error,
    message: t.error
      ? (t.error.includes('invalid_grant') ? 'โทเคนหมดอายุ/ถูกเพิกถอน — ต้องขอ refresh token ใหม่' : t.error)
      : 'โทเคนใช้งานได้ (ต่ออายุอัตโนมัติทุกชั่วโมง)',
    latencyMs: t.ms,
  }
}

async function checkZort(storeId: string): Promise<ConnStatus> {
  const store = STORES[storeId]
  const t = await timed(async () => {
    const res: any = await zortFetch('Product/GetProducts', { limit: '1' }, storeId)
    if (res && (res.count !== undefined || res.list !== undefined)) return res.count ?? 0
    throw new Error(JSON.stringify(res).slice(0, 200))
  })
  return {
    id: 'zort' + storeId,
    name: 'ZORT (ร้าน ' + storeId + ')',
    detail: store?.storename ?? '-',
    ok: !t.error,
    message: t.error ? t.error : 'API key ใช้งานได้ • สินค้า ' + t.result + ' รายการ',
    latencyMs: t.ms,
  }
}

async function checkSheets(): Promise<ConnStatus> {
  const SHEET_ID = '1REirvPuMH-OwTMOKx2aDSoAsldiGuwV5cN0ChZOVBy0'
  const t = await timed(async () => {
    const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&sheet=orders'
    const res = await fetch(url, { cache: 'no-store' })
    const raw = await res.text()
    if (!res.ok || !raw.includes('setResponse')) throw new Error('อ่านชีทไม่ได้ (' + res.status + ')')
    return true
  })
  return {
    id: 'sheets',
    name: 'Google Sheets (โรงงาน)',
    detail: 'ชีทสั่งผลิตโรงงาน',
    ok: !t.error,
    message: t.error ? t.error : 'อ่านข้อมูลชีทได้ปกติ',
    latencyMs: t.ms,
  }
}

export async function GET() {
  const results = await Promise.all([
    checkGmail(),
    checkZort('1'),
    checkZort('2'),
    checkSheets(),
  ])
  return NextResponse.json({ checkedAt: new Date().toISOString(), connections: results })
}
