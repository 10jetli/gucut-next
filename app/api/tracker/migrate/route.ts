import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'
import type { TrackerOrder, TrackerStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// URL Apps Script เดิม (public, อ่านอย่างเดียว) — ใช้ครั้งเดียวตอนย้ายข้อมูล
const OLD_GAS_URL =
  'https://script.google.com/macros/s/AKfycbxqPkEWDKnihSo6_rzLCffNXvyGv9zplYLBWnk3s6bKYayNT0FB0gePLfvQhgt0AJPO6g/exec'

const VALID_STATUS = ['pending', 'talking', 'deposit', 'production', 'shipping', 'warehouse', 'done']

// ครั้งเดียว: ดึงข้อมูลเดิมทั้งหมดจาก Google Apps Script (Order Tracker เดิม) มาเก็บใน Netlify Blobs
// เรียกผ่าน POST /api/tracker/migrate  (เพิ่ม ?force=1 ถ้าต้องการเขียนทับของที่มีอยู่แล้ว)
export async function POST(req: NextRequest) {
  try {
    const force = req.nextUrl.searchParams.get('force') === '1'
    const store = getStore('tracker')

    const existing = await store.get('orders', { type: 'json' })
    if (Array.isArray(existing) && existing.length > 0 && !force) {
      return NextResponse.json({
        ok: false,
        error: `มีข้อมูลอยู่แล้ว ${existing.length} รายการ — ถ้าต้องการเขียนทับ เรียกซ้ำพร้อม ?force=1`,
      }, { status: 409 })
    }

    const r = await fetch(OLD_GAS_URL, { cache: 'no-store' })
    const j = await r.json()
    if (!j || !j.ok || !Array.isArray(j.data)) {
      return NextResponse.json({ ok: false, error: 'ดึงข้อมูลเดิมไม่ได้', detail: j }, { status: 502 })
    }

    const orders: TrackerOrder[] = j.data.map((d: Record<string, unknown>) => ({
      id: Number(d.id) || Date.now() + Math.floor(Math.random() * 1000),
      product: String(d.product ?? ''),
      factory: String(d.factory ?? ''),
      qty: Number(d.qty) || 0,
      deposit: String(d.deposit ?? ''),
      total: String(d.total ?? ''),
      due: String(d.due ?? ''),
      status: (VALID_STATUS.includes(String(d.status)) ? d.status : 'pending') as TrackerStatus,
      note: String(d.note ?? ''),
      updated: String(d.updated ?? new Date().toISOString()),
      images: Array.isArray(d.images)
        ? (d.images as Array<Record<string, unknown>>).map(img => ({
            url: String(img.url ?? ''),
            thumb: String(img.thumb ?? img.url ?? ''),
            name: String(img.name ?? ''),
          }))
        : [],
    }))

    await store.setJSON('orders', orders)

    return NextResponse.json({ ok: true, migrated: orders.length })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
