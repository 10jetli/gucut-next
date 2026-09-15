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
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const localRequire = createRequire(import.meta.url)
function loadDependency(name) {
  try {
    return localRequire(name)
  } catch (localError) {
    // git worktree ไม่มี node_modules ของตัวเองเป็นปกติ: หา repo หลักจาก git-common-dir
    // แล้วโหลด dependency ที่ติดตั้งอยู่ตรงนั้น โดยไม่ต้องสร้าง symlink ค้างใน worktree
    try {
      const commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
        cwd: scriptDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
      const mainRoot = dirname(resolve(scriptDir, commonDir))
      return createRequire(join(mainRoot, 'package.json'))(name)
    } catch {
      throw localError
    }
  }
}
const JSZip = loadDependency('jszip')
const pdfParseModule = loadDependency('pdf-parse/lib/pdf-parse.js')
const pdfParse = pdfParseModule.default || pdfParseModule

const site = String(process.env.BILLS_SITE || 'https://admin.gucut.com').replace(/\/$/, '')
const auth = String(process.env.GUCUT_AUTH || '').trim()
const selfTest = process.env.BILLS_AUDIT_SELF_TEST === '1'
const pauseMs = Number(process.env.BILLS_PAUSE_MS || 5000)
const quotaPauseMs = Number(process.env.BILLS_QUOTA_PAUSE_MS || 75000)
const requestTimeoutMs = Number(process.env.BILLS_TIMEOUT_MS || 70000)
const quotaRe = /quota|rate.?limit|429|403/i
const knownMonthCounts = new Map([
  ['tiktok/2026-08', 4],
  ['meta/2026-08', 1],
  ['netlify/2026-08', 4],
])
const knownTotals = new Map([
  ['tiktok', 108],
  ['meta', 4],
  ['netlify', 4],
  ['cloudflare', 2],
])
const knownDocuments = [
  { vendor: 'meta', month: '2026-08', id: 'FBADS-497-106431740', amount: '16625.98' },
  { vendor: 'netlify', month: '2026-08', id: 'VIFWPX-00010', amount: '9.00', expectedStatus: 'refunded' },
  { vendor: 'netlify', month: '2026-08', id: 'VIFWPX-00012', amount: '20.00', expectedStatus: 'refunded' },
  { vendor: 'netlify', month: '2026-08', id: 'VIFWPX-00014', amount: '33.00', expectedStatus: 'refunded' },
  { vendor: 'netlify', month: '2026-08', id: 'VIFWPX-00016', amount: '95.00', expectedStatus: 'send' },
  { vendor: 'cloudflare', month: '2026-08', id: 'IN-75520671', amount: '10.46' },
  { vendor: 'cloudflare', month: '2026-09', id: 'IN-77550881', amount: '2.10' },
]

if (!auth && !selfTest) {
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

function documentStatus(text) {
  if (/\bREFUNDED\b/i.test(text)) return 'refunded'
  if (/\bCREDIT\s+NOTE\b/i.test(text) || /ใบลดหนี้/.test(text)) return 'credit-note'
  return 'no-refund-marker'
}

function invoiceNumber(text) {
  return text.match(/(?:FBADS-[\d-]{6,}|THTT\d{6,}|VIFWPX-\d{5,}|IN-\d{6,}|INV[-_]?\d{6,})/i)?.[0] || ''
}

if (selfTest) {
  const csv = '\uFEFF"ผู้ให้บริการ","เดือน","จำนวนที่ใส่ซองได้","จำนวนที่ขาด"\n'
    + '"Netlify","2026-08","3","1"\n\n"รายการที่ขาด"\n"VIFWPX-00016 (อ่านไม่ได้)"'
  const parsed = parseSummary(csv)
  const passed = parsed.added === 3 && parsed.missing === 1
    && parsed.reasons[0] === 'VIFWPX-00016 (อ่านไม่ได้)'
    && documentStatus('invoice footer REFUNDED') === 'refunded'
    && documentStatus('Credit Note') === 'credit-note'
    && documentStatus('ใบลดหนี้') === 'credit-note'
    && documentStatus('PAID') === 'no-refund-marker'
    && invoiceNumber('invoice VIFWPX-00016') === 'VIFWPX-00016'
  if (!passed) throw new Error('self-test ของตัวอ่าน summary/สถานะบิลไม่ผ่าน')
  console.log('audit-bill-zips self-test: summary + refunded/credit-note + invoice number ผ่าน')
  process.exit(0)
}

async function inspectDocuments(zip, vendor, month) {
  const records = []
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !/\.(pdf|zip)$/i.test(entry.name)) continue
    if (/\.zip$/i.test(entry.name)) {
      records.push({ name: entry.name, invoice: invoiceNumber(entry.name), compact: entry.name.toUpperCase(), status: 'unreadable' })
      continue
    }
    try {
      // สถานะ REFUNDED ของ Netlify อยู่บรรทัดสุดท้าย จึงต้องอ่านครบทุกหน้า
      const parsed = await pdfParse(await entry.async('nodebuffer'), { max: 9999 })
      const text = `${entry.name} ${String(parsed.text || '')}`
      records.push({
        name: entry.name,
        invoice: invoiceNumber(text),
        compact: text.replace(/\s+/g, '').replace(/,/g, '').toUpperCase(),
        status: documentStatus(text),
      })
    } catch {
      records.push({ name: entry.name, invoice: invoiceNumber(entry.name), compact: entry.name.toUpperCase(), status: 'unreadable' })
    }
  }
  const known = knownDocuments
    .filter(doc => doc.vendor === vendor && doc.month === month)
    .map(doc => {
      const record = records.find(item => item.compact.includes(doc.id))
      return {
        ...doc,
        invoice: !!record,
        amountFound: !!record?.compact.includes(doc.amount),
        actualStatus: record?.status || 'not-found',
      }
    })
  return { known, records }
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
    const documents = await inspectDocuments(zip, vendor, month)
    last = { ...summary, reasons, documents }
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
const totals = new Map()
const documentProof = []
const usabilityRows = []
const requestedVendors = await vendorIds()
for (const vendor of requestedVendors) {
  console.error(`อ่านดัชนี ${vendor}`)
  try {
    const data = await loadVendor(vendor)
    const months = Object.keys(data.months || {}).sort()
    const indexedTotal = months.reduce((sum, month) => (
      sum + (Array.isArray(data.months[month]) ? data.months[month].length : 0)
    ), 0)
    totals.set(vendor, { name: data.name || vendor, indexed: indexedTotal, staleReason: data.staleReason || '' })
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
        const knownMonth = knownMonthCounts.get(`${vendor}/${month}`)
        if (knownMonth !== undefined && expected !== knownMonth) {
          reasons.unshift(`ต้นทางยืนยัน ${knownMonth} ใบ แต่ดัชนีมี ${expected} ใบ`)
        }
        rows.push({
          vendor: data.name || vendor,
          month,
          added: result.added,
          missing: result.missing,
          reason: reasons.length ? reasons.join('; ') : 'ZIP ครบตามดัชนี',
        })
        documentProof.push(...result.documents.known)
        const records = result.documents.records
        const refunded = records.filter(item => item.status === 'refunded' || item.status === 'credit-note')
        const unreadable = records.filter(item => item.status === 'unreadable')
        usabilityRows.push({
          vendor: data.name || vendor,
          month,
          clear: records.length - refunded.length - unreadable.length,
          refunded: refunded.length,
          unreadable: unreadable.length,
          reason: [
            refunded.length ? `คืนเงิน/ใบลดหนี้: ${refunded.map(item => item.invoice || item.name).join(', ')}` : '',
            unreadable.length ? `อ่านสถานะไม่ได้: ${unreadable.map(item => item.invoice || item.name).join(', ')}` : '',
          ].filter(Boolean).join('; ') || 'ไม่พบคำ REFUNDED/Credit Note/ใบลดหนี้',
        })
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
console.log('สถานะเอกสารภายในไฟล์ (คนละคำถามกับความครบ):')
console.log('| เจ้า | เดือน | ไม่พบคำคืนเงิน | คืนเงิน/ใบลดหนี้ | ตรวจไม่ได้ | หมายเหตุ |')
console.log('|---|---:|---:|---:|---:|---|')
for (const row of usabilityRows) {
  console.log(`| ${clean(row.vendor)} | ${clean(row.month)} | ${row.clear} | ${row.refunded} | ${row.unreadable} | ${clean(row.reason)} |`)
}
console.log('')
console.log('หมายเหตุ: “ไม่พบคำคืนเงิน” ยังไม่เท่ากับบัญชียอมรับ เอกสารอาจขาดข้อมูลภาษีหรือมีเงื่อนไขอื่น')
console.log('')
console.log('ตรวจเทียบต้นทางภายนอกที่ท่านประธานยืนยัน:')
for (const [vendor, source] of knownTotals) {
  if (!requestedVendors.includes(vendor)) continue
  const got = totals.get(vendor)
  const note = got?.staleReason ? ` · ดัชนีค้าง: ${clean(got.staleReason)}` : ''
  console.log(`- ${got?.name || vendor}: ต้นทาง ${source} ใบ · ดัชนี ${got?.indexed ?? 'อ่านไม่ได้'} ใบ${note}`)
}
for (const doc of knownDocuments) {
  if (!requestedVendors.includes(doc.vendor)) continue
  const proof = documentProof.find(item => item.vendor === doc.vendor && item.month === doc.month && item.id === doc.id)
  const status = proof?.actualStatus || 'not-found'
  const decision = doc.expectedStatus === 'refunded'
    ? ` · ต้องเป็น REFUNDED=${status === 'refunded' ? 'ใช่' : `ไม่ตรง (${status})`}`
    : doc.expectedStatus === 'send'
      ? ` · ท่านประธานตัดสินส่งบัญชีใบนี้ · สถานะ=${status}`
      : ''
  console.log(`- ${doc.vendor} ${doc.month} ${doc.id}: พบเลข=${proof?.invoice ? 'ใช่' : 'ไม่พบ'} · พบยอด=${proof?.amountFound ? 'ใช่' : 'ไม่พบ'}${decision}`)
}
