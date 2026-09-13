// node scripts/tests/web-orders-unreadable.test.mjs
// Render จอจริงพร้อม hooks/load จริง เปลี่ยนเฉพาะคำตอบ fetch เป็น fixture
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { create, act } from 'react-test-renderer'

const filename = new URL('../../app/web/orders/page.tsx', import.meta.url)
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const mod = { exports: {} }
let response
const context = vm.createContext({ exports: mod.exports, module: mod, require: createRequire(filename),
  console, Date, fetch: async () => response, setTimeout, clearTimeout })
vm.runInContext(code, context, { filename: filename.pathname })
const Page = mod.exports.default
const words = tree => typeof tree === 'string' ? tree : Array.isArray(tree) ? tree.map(words).join(' ') : words(tree?.children ?? [])
let count = 0
async function check(payload, verify, ok = true) {
  response = { ok, json: async () => payload }
  let root
  await act(async () => { root = create(React.createElement(Page)) })
  verify(words(root.toJSON()), root)
  await act(async () => root.unmount())
  count++
}
await check({ orders: [], unreadable: 2 }, text => {
  assert.match(text, /อ่านได้ 0 ใบ · อ่านไม่ได้อีก 2 ใบ/)
  assert.match(text, /มี\s+2\s+ใบที่อ่านข้อมูลไม่ได้/)
  assert.doesNotMatch(text, /ทั้งหมด 0 ใบในระบบ|ไม่มีออเดอร์ในหมวดนี้/)
})
for (const unreadable of [undefined, null, '2', -1, 0.5, Infinity, NaN]) {
  await check({ orders: [], unreadable }, text => {
    assert.match(text, /ยังยืนยันไม่ได้ว่าอ่านออเดอร์ครบ/)
    assert.doesNotMatch(text, /ทั้งหมด 0 ใบในระบบ|ไม่มีออเดอร์ในหมวดนี้/)
  })
}
await check({ orders: [], unreadable: 0 }, text => {
  assert.match(text, /ทั้งหมด 0 ใบในระบบ/)
  assert.match(text, /ไม่มีออเดอร์ในหมวดนี้/)
  assert.doesNotMatch(text, /ยังยืนยันไม่ได้ว่าอ่านออเดอร์ครบ/)
})
for (const payload of [{}, { orders: null }, { orders: {} }, { orders: [], unreadable: 0, error: 'fixture' }]) {
  await check(payload, text => {
    assert.match(text, /โหลดรายการไม่สำเร็จ/)
    assert.doesNotMatch(text, /ทั้งหมด 0 ใบในระบบ|ไม่มีออเดอร์ในหมวดนี้/)
  })
}
await check({ orders: [], unreadable: 0 }, text => assert.match(text, /โหลดรายการไม่สำเร็จ/), false)
// รีเฟรชแล้วล้ม: ไม่ใช้ unreadable เก่ามาอ้างกับคำตอบรอบใหม่
response = { ok: true, json: async () => ({ orders: [], unreadable: 2 }) }
let root
await act(async () => { root = create(React.createElement(Page)) })
response = { ok: false }
await act(async () => root.root.findAllByType('button').find(b => words(b.props.children).includes('รีเฟรช')).props.onClick())
assert.match(words(root.toJSON()), /โหลดรายการไม่สำเร็จ/)
assert.doesNotMatch(words(root.toJSON()), /มี\s+2\s+ใบที่อ่านข้อมูลไม่ได้/)
await act(async () => root.unmount())
console.log(`PASS: ${count + 1} rendered-page fixtures`)
