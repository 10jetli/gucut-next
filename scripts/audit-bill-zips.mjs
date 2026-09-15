#!/usr/bin/env node
// ตรวจซองบิลทุกเจ้า/ทุกเดือนจาก production โดยไม่บันทึกตัวบิลลงดิสก์
//
// รันโดยคนรีวิวที่มี session ของ admin.gucut.com (read -s กันค่าเข้า shell history):
//   read -rsp 'gucut_auth: ' GUCUT_AUTH; echo; export GUCUT_AUTH
//   node scripts/audit-bill-zips.mjs
//   unset GUCUT_AUTH
//
// stdout เป็นรายงาน Markdown เท่านั้น ส่วนความคืบหน้าไป stderr จึง redirect รายงานได้
// โดยไม่ปนไฟล์ ZIP/PDF หรือค่าคุกกี้ลงผลลัพธ์
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

const site = String(process.env.BILLS_SITE || 'https://admin.gucut.com').replace(/\/$/, '')
const auth = String(process.env.GUCUT_AUTH || '').trim()
const pauseMs = Number(process.env.BILLS_PAUSE_MS || 5000)
const quotaPauseMs = Number(process.env.BILLS_QUOTA_PAUSE_MS || 75000)
const requestTimeoutMs = Number(process.env.BILLS_TIMEOUT_MS || 70000)
const quotaRe = /quota|rate.?limit|429|403/i

if (!auth) {
  console.error('ต้องส่ง GUCUT_AUTH เป็นค่า cookie gucut_auth จาก session ที่ล็อกอิน admin.gucut.com อยู่')
  process.exit(2)
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const clean = (value) => String(value ?? '').replace(/[\r\n|]+/g, ' ').trim()

async function vendorIds() {
  const selected = String(process.env.BILLS_VENDORS || '').split(',').map(x => x.trim()).filter(Boolean)
  if (selected.length) return [...new Set(selected)]
  const source = await readFile(new URL('../lib/vendors.ts', import.meta.url), 'utf8')
  const ids = [...source.matchAll(/\{\s*id:\s*'([^']+)'/g)].map(match => match[1])
  if (!ids.length) throw new Error('อ่านรายชื่อ vendor จาก lib/vendors.ts ไม่ได้')
  return [...new Set(ids)]
}

async function get(path) {
  return fetch(`${site}${path}`, {
    headers: { Cookie: `gucut_auth=${auth}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(requestTimeoutMs),
  })
}

async function readJsonResponse(path) {
  const response = await get(path)
  const text = await response.text()
  let data
  try { data = JSON.parse(text) } catch { data = null }
  if (!response.ok || !data) {
    throw new Error(`${response.status} ${data?.error || data?.message || text.slice(0, 180)}`)
  }
  return data
}

async function loadVendor(vendor) {
  const path = `/api/bills/vendor?vendor=${encodeURIComponent(vendor)}`
  let data
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      data = await readJsonResponse(path)
    } catch (error) {
      if (attempt === 0 && quotaRe.test(String(error))) {
        console.error(`  Gmail quota: พัก ${Math.ceil(quotaPauseMs / 1000)} วินาทีก่อนลอง ${vendor} ใหม่`)
        await sleep(quotaPauseMs)
        continue
      }
      throw error
    }
    if (attempt === 0 && quotaRe.test(String(data.staleReason || ''))) {
      console.error(`  Gmail quota: พัก ${Math.ceil(quotaPauseMs / 1000)} วินาทีก่อนสแกน ${vendor} ใหม่`)
      await sleep(quotaPauseMs)
      continue
    }
    return data
  }
  return data
}

function parseCsvLine(line) {
  const cells = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++ }
      else quoted = !quoted
    } else if (ch === ',' && !quoted) {
      cells.push(value); value = ''
    } else value += ch
  }
  cells.push(value)
  return cells
}

function parseSummary(csv) {
  const lines = String(csv).replace(/^\uFEFF/, '').split(/\r?\n/)
  const values = parseCsvLine(lines[1] || '')
  const marker = lines.findIndex(line => parseCsvLine(line)[0] === 'รายการที่ขาด')
  const reasons = marker < 0
    ? []
    : lines.slice(marker + 1).filter(Boolean).map(line => parseCsvLine(line)[0]).filter(Boolean)
  return { added: Number(values[2]), missing: Number(values[3]), reasons }
}

async function inspectMetaAugust(zip) {
  const needleId = 'FBADS-497-106431740'
  const needleAmount = '16625.98'
  let combined = ''
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !/\.pdf$/i.test(entry.name)) continue
    combined += ` ${entry.name}`
    try {
      const parsed = await pdfParse(await entry.async('nodebuffer'), { max: 2 })
      combined += ` ${String(parsed.text || '').slice(0, 12000)}`
    } catch { /* ชื่อไฟล์ยังอาจยืนยันเลขที่ใบได้ */ }
  }
  const compact = combined.replace(/\s+/g, '').replace(/,/g, '').toUpperCase()
  return {
    invoice: compact.includes(needleId),
    amount: compact.includes(needleAmount),
  }
}

async function loadZip(vendor, month, expected) {
  const path = `/api/bills/zip?vendor=${encodeURIComponent(vendor)}&month=${encodeURIComponent(month)}`
  let last
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await get(path)
    if (!response.ok) {
      const message = `${response.status} ${(await response.text()).slice(0, 180)}`
      if (attempt === 0 && quotaRe.test(message)) {
        console.error(`  Gmail quota: พัก ${Math.ceil(quotaPauseMs / 1000)} วินาทีก่อนลองซองใหม่`)
        await sleep(quotaPauseMs)
        continue
      }
      throw new Error(message)
    }

    const rawAdded = response.headers.get('x-bills-added')
    const rawMissing = response.headers.get('x-bills-missing')
    const headerAdded = Number(rawAdded)
    const headerMissing = Number(rawMissing)
    const zip = await JSZip.loadAsync(await response.arrayBuffer())
    const summaryFile = zip.file('summary.csv')
    if (!summaryFile) throw new Error('ซองไม่มี summary.csv')
    const summary = parseSummary(await summaryFile.async('string'))
    const reasons = [...summary.reasons]
    if (rawAdded === null || rawMissing === null) {
      reasons.push('หัวตอบไม่มี X-Bills-Added/X-Bills-Missing')
    } else if (headerAdded !== summary.added || headerMissing !== summary.missing) {
      reasons.push(`หัวตอบ ${headerAdded}/${headerMissing} ไม่ตรง summary.csv ${summary.added}/${summary.missing}`)
    }
    if (!Number.isFinite(summary.added) || !Number.isFinite(summary.missing)) {
      throw new Error('อ่านจำนวนจาก summary.csv ไม่ได้')
    }
    if (expected !== summary.added + summary.missing) {
      reasons.push(`ต้นทาง ${expected} ใบ แต่ซองอธิบายได้ ${summary.added + summary.missing} ใบ`)
    }
    const meta = vendor === 'meta' && month === '2026-08'
      ? await inspectMetaAugust(zip)
      : null
    last = { ...summary, reasons, meta }
    if (attempt === 0 && reasons.some(reason => quotaRe.test(reason))) {
      console.error(`  Gmail quota ในซอง: พัก ${Math.ceil(quotaPauseMs / 1000)} วินาทีก่อนลองใหม่`)
      await sleep(quotaPauseMs)
      continue
    }
    return last
  }
  return last
}

const rows = []
let metaProof = null
for (const vendor of await vendorIds()) {
  console.error(`อ่านดัชนี ${vendor}`)
  try {
    const data = await loadVendor(vendor)
    const months = Object.keys(data.months || {}).sort()
    if (!months.length) {
      rows.push({ vendor, month: '—', added: 0, missing: 0, reason: data.staleReason || 'ต้นทางไม่มีเดือนที่มีข้อมูล' })
    }
    for (const month of months) {
      const expected = Array.isArray(data.months[month]) ? data.months[month].length : 0
      console.error(`  ยิงซอง ${vendor} ${month} (ต้นทาง ${expected})`)
      try {
        const result = await loadZip(vendor, month, expected)
        const reasons = [...result.reasons]
        if (data.staleReason) reasons.unshift(`ดัชนีค้าง: ${data.staleReason}`)
        rows.push({
          vendor: data.name || vendor,
          month,
          added: result.added,
          missing: result.missing,
          reason: reasons.length ? reasons.join('; ') : 'ครบตามต้นทาง',
        })
        if (result.meta) metaProof = { month, expected, ...result.meta }
      } catch (error) {
        rows.push({ vendor: data.name || vendor, month, added: 0, missing: expected, reason: clean(error) })
      }
      await sleep(pauseMs)
    }
  } catch (error) {
    rows.push({ vendor, month: '—', added: 0, missing: '?', reason: `อ่านดัชนีไม่ได้: ${clean(error)}` })
  }
  await sleep(pauseMs)
}

console.log('| เจ้า | เดือน | ได้ | ขาด | เหตุผล |')
console.log('|---|---:|---:|---:|---|')
for (const row of rows) {
  console.log(`| ${clean(row.vendor)} | ${clean(row.month)} | ${row.added} | ${row.missing} | ${clean(row.reason) || '—'} |`)
}
console.log('')
if (metaProof) {
  console.log(`Meta ส.ค. 2026: ต้นทาง ${metaProof.expected} ใบ · พบเลข FBADS-497-106431740=${metaProof.invoice ? 'ใช่' : 'ไม่พบ'} · พบยอด ฿16,625.98=${metaProof.amount ? 'ใช่' : 'ไม่พบ'}`)
} else {
  console.log('Meta ส.ค. 2026: ตรวจไฟล์ไม่ได้ เพราะไม่มีซองเดือนนี้ในผล')
}
