// 🔴 ด่าน: server component ห้ามเอาค่าที่ import จาก '@/components/zort' (ไฟล์ 'use client') ไปต่อสตริง
// เจอจริง 20 ต.ค. 2569: จอผู้ใช้งาน/สิทธิ์การใช้งาน เขียน className={`${TD} text-gray-300`} ⇒ DOM ได้คลาส "[object Object] text-gray-300"
// (ค่าจากไฟล์ 'use client' ที่ server component import มา เป็นตัวอ้างอิง ไม่ใช่สตริง — ส่งตรง ๆ ได้ ต่อสตริงไม่ได้) ⇒ ช่องตารางหลุดทั้งช่องในทั้งขนาดตัวอักษร
// ตรวจจากซอร์ส: ไฟล์ใต้ app/ ที่ไม่มี 'use client' บรรทัดแรก ๆ + import ชื่อตัวพิมพ์ใหญ่จาก '@/components/zort' + มี ${ชื่อนั้น} ในไฟล์
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const เดิน = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n)
  return statSync(p).isDirectory() ? เดิน(p) : p.endsWith('.tsx') ? [p] : []
})

export function หาที่ต่อสตริง(ซอร์ส) {
  if (/^\s*['"]use client['"]/m.test(ซอร์ส.split('\n').slice(0, 5).join('\n'))) return []
  const ชื่อ = [...ซอร์ส.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@\/components\/zort'/g)]
    .flatMap((m) => m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop()))
    .filter((n) => /^[A-Z][A-Z0-9_]+$/.test(n))
  return ชื่อ.filter((n) => ซอร์ส.includes('${' + n + '}'))
}

test('ตัวตรวจจับได้จริง (ปลูกเคสจริงของ 20 ต.ค. 2569)', () => {
  const ปลูก = "import { PageHead, TD } from '@/components/zort'\nexport default function P(){return <td className={`${TD} text-gray-300`}/>}"
  assert.deepEqual(หาที่ต่อสตริง(ปลูก), ['TD'])
  assert.deepEqual(หาที่ต่อสตริง("'use client'\n" + ปลูก), [], "ไฟล์ 'use client' ต่อสตริงได้ปกติ")
  assert.deepEqual(หาที่ต่อสตริง("import { TD } from '@/components/zort'\nconst x = <td className={TD}/>"), [], 'ส่งตรง ๆ ไม่ผิด')
})

test('ไม่มี server component ไหนต่อสตริงกับค่าคลาสจาก @/components/zort', () => {
  const พบ = เดิน('app').map((f) => [f, หาที่ต่อสตริง(readFileSync(f, 'utf8'))]).filter(([, x]) => x.length)
  assert.deepEqual(พบ, [], 'ต่อสตริงแล้วได้ [object Object] — ส่งค่าตรง ๆ แล้วใส่คลาสเพิ่มที่ span ข้างใน หรือทำจอเป็น client')
})
