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
const IMG_BASE = 'https://video.gucut.com/i/128'

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

export function useSkuImages() {
  const [map, setMap] = useState<SkuMap>(cache ?? {})
  useEffect(() => {
    let alive = true
    load().then((m) => { if (alive) setMap(m) })
    return () => { alive = false }
  }, [])
  /** คืน URL รูปของ SKU นั้น หรือ null ถ้าไม่มีรูป (ให้จอโชว์กล่องเทาแทน) */
  return (sku: string): string | null => {
    const f = map[String(sku ?? '').trim()]
    return f ? `${IMG_BASE}/${f}` : null
  }
}
