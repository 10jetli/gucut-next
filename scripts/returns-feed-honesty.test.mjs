import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'lib/returns.ts'), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const mod = { exports: {} }
new Function('require', 'module', 'exports', js)(
  (id) => id === './zort' ? { zortFetch: async () => ({ list: [] }) } : require(id),
  mod,
  mod.exports,
)
const { siteReturns } = mod.exports

async function withFetch(response, run) {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.GUCUT_ADMIN_KEY
  process.env.GUCUT_ADMIN_KEY = 'fixture'
  globalThis.fetch = async () => response
  try { return await run() } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.GUCUT_ADMIN_KEY
    else process.env.GUCUT_ADMIN_KEY = originalKey
  }
}

test('returns feed: HTTP ล้มต้องคงความไม่รู้ ไม่คืน list ว่างลอย ๆ', async () => {
  const got = await withFetch(new Response(JSON.stringify({ error: 'list failed' }), { status: 503 }),
    () => siteReturns(30))
  assert.deepEqual(got, { list: [], why: 'list failed' })
})

test('returns feed: ใบที่อ่านไม่ได้ต้องติด why แม้รายการที่อ่านได้ยังใช้ได้', async () => {
  const list = [{ number: 'R-1' }]
  const got = await withFetch(new Response(JSON.stringify({ list, unreadable: 2 })), () => siteReturns(30))
  assert.deepEqual(got, { list, why: 'เว็บหน้าร้านอ่านใบคืนไม่ได้ 2 ใบ' })
})

test('returns feed: อ่านครบและว่างจริงจึงไม่มี why', async () => {
  const got = await withFetch(new Response(JSON.stringify({ list: [], unreadable: 0 })), () => siteReturns(30))
  assert.deepEqual(got, { list: [] })
})
