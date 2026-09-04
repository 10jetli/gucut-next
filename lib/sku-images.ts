'use client'
// แผนที่ SKU → ชื่อไฟล์รูปสินค้า · ใช้ร่วมกันทั้งจอสินค้าและจอ POS
//
// ที่มา: ฝั่งท่อหลังบ้านทำ https://gucut.com/sku-images.json (2,337 คู่ · เปิด CORS ให้ admin.gucut.com)
// รูปจริงอยู่ที่ https://video.gucut.com/i/128/<ชื่อไฟล์> — ขั้นย่อ 128px มีครบทุกใบ
//
// ⚠️ **โหลดครั้งเดียวต่อการเปิดเว็บ** เก็บไว้ในโมดูล — ไม่ใช่โหลดใหม่ทุกครั้งที่เปลี่ยนหน้า
//    ไฟล์นี้มีสองพันกว่ารายการ โหลดซ้ำทุกหน้า = เปลืองเน็ตของแท็บเล็ตหน้าร้านฟรี ๆ
// ⚠️ **โหลดไม่ได้ต้องไม่พังจอ** — คืนแผนที่ว่าง แล้วทุกตัวขึ้นกล่องเทา
//    รูปเป็นของประกอบ ไม่ใช่ข้อมูลที่ต้องมีถึงจะขายได้
import { useEffect, useState } from 'react'

const MAP_URL = 'https://gucut.com/sku-images.json'
/** ขั้นย่อที่มีบน R2 — ยิงจริงยืนยันแล้วครบทั้ง 4 ขั้น (5 ก.ย. 2569)
 *  ⚠️ ขอขั้นที่ไม่มี = 404 รูปหายทั้งจอ ⇒ เพิ่มขั้นใหม่ต้องยิงเช็คก่อน
 *  (ตารางขั้นจริงอยู่ที่ `LADDER` ใน gucut-web/src/lib/image-loader.js) */
const STEPS = [128, 256, 384, 640] as const
export type ImgStep = typeof STEPS[number]
const IMG_BASE = 'https://video.gucut.com/i'

type SkuMap = Record<string, string>

let cache: SkuMap | null = null
let inflight: Promise<SkuMap> | null = null

function load(): Promise<SkuMap> {
  const done = cache
  if (done) return Promise.resolve(done)
  const running = inflight
  if (running) return running
  const p: Promise<SkuMap> = fetch(MAP_URL)
    .then((r) => (r.ok ? r.json() : {}))
    .then((j): SkuMap => {
      const m: SkuMap = j && typeof j === 'object' ? (j as SkuMap) : {}
      cache = m
      return m
    })
    .catch((): SkuMap => {
      cache = {}   // จำว่าล้มเหลวไว้ด้วย จะได้ไม่ยิงซ้ำทุกครั้งที่เปลี่ยนหน้า
      return {}
    })
    .finally(() => { inflight = null })
  inflight = p
  return p
}

/* 🔴 **ขนาดรูปต้องเลือกตามที่จอวาดจริง ไม่ใช่ค่าเดียวทั้งระบบ** (แก้ 5 ก.ย. 2569)
   เดิมทุกจอใช้ขั้น 128 เหมือนกันหมด — พอเอาไปวางในกรอบ 220×160 บนจอ Retina
   ต้องขยายราว 3.4 เท่า ⇒ **เบลอจนอ่านตัวหนังสือบนกล่องสินค้าไม่ออก** (เจ้าของร้านทัก)
   ⇒ ตารางเล็ก/การ์ด POS ใช้ 128 ต่อไป (เร็วและพอ) · หน้ารายละเอียดขอขั้นใหญ่ขึ้น
   ⚠️ อย่าใช้ 640 กับตารางที่มีหลายสิบแถว — รูปละ 50KB × 50 แถว = 2.5MB ต่อการเปิดหน้า */
export function useSkuImages(step: ImgStep = 128) {
  const [map, setMap] = useState<SkuMap>(cache ?? {})
  useEffect(() => {
    let alive = true
    load().then((m) => { if (alive) setMap(m) })
    return () => { alive = false }
  }, [])
  /** คืน URL รูปของ SKU นั้น หรือ null ถ้าไม่มีรูป (ให้จอโชว์กล่องเทาแทน) */
  return (sku: string): string | null => {
    const f = map[String(sku ?? '').trim()]
    return f ? `${IMG_BASE}/${step}/${f}` : null
  }
}
