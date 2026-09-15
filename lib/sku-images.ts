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

/* ── รูปสินค้า: ลำดับที่ใช้ทั้งระบบ ──────────────────────────────────────────
   🔴 **ลำดับนี้ฝั่งท่อเป็นคนกำหนด** (gucut-web fc52832 + e2e9634 · 15 ก.ย. 2569)
     ① `sku-images.json` ของเรา — รูปย่อเดิม มีครบ 2,337 รหัส เร็วที่สุด
     ② `imageFile` — รูปของ ZORT ที่ **ย่อเข้าถังเราแล้ว** (webp · มี 4 ขั้นเหมือนกัน)
        ⇒ ใช้กับ **ตารางร้อยแถวได้** เพราะเป็นขั้นย่อ ไม่ใช่ไฟล์ดิบ
     ③ `imagePath` — ลิงก์ไฟล์ดิบของ ZORT/มาร์เก็ตเพลส (บางใบเกือบ 2 MB · ลิงก์มาร์เก็ตเพลสตายได้)
        ⇒ **หน้ารายละเอียดเท่านั้น** (ส่ง `allowRaw` มาเอง) ห้ามใช้ในตารางยาว
     ④ ไม่มีเลย ⇒ คืน null แล้วให้จอเขียนว่าเป็นกรณีไหน:
        `imagePath === ''` = ZORT ไม่มีรูป (ต้องถ่ายเพิ่ม) · `null/undefined` = ยังไม่รู้
   ⚠️ `imageFile` เป็น null ได้ทั้งที่ ZORT มีรูป — แปลว่า "ยังย่อไม่เสร็จ/ZORT เพิ่งเปลี่ยนรูป"
      ⇒ ตกไปข้อ ③ เองตามลำดับ ไม่ต้องมีใครจำ */

export interface SkuImageFields {
  /** ชื่อไฟล์ในถังเรา (ย่อแล้ว) — ใช้กับทุกจอ */
  imageFile?: string | null
  /** ลิงก์ไฟล์ดิบจาก ZORT — หน้ารายละเอียดเท่านั้น · `''` = ZORT ไม่มีรูป */
  imagePath?: string | null
}

/** ป้ายบอกว่า "ทำไมไม่มีรูป" — สองกรณีนี้พาไปคนละการกระทำ ห้ามรวบเป็นอันเดียว */
export function noImageReason(row: SkuImageFields | null | undefined): 'zort-none' | 'unknown' {
  return row?.imagePath === '' ? 'zort-none' : 'unknown'
}

/** URL รูปตามลำดับข้างบน · คืน null เมื่อไม่มีรูปที่ใช้ได้
 *  @param fromMap ผลของ `useSkuImages(step)` สำหรับ sku นั้น (ข้อ ①)
 *  @param allowRaw อนุญาตให้ตกถึงไฟล์ดิบไหม — **จอที่มีหลายสิบแถวต้องเป็น false** */
export function pickImage(
  fromMap: string | null,
  row: SkuImageFields | null | undefined,
  step: ImgStep = 128,
  allowRaw = false,
): string | null {
  if (fromMap) return fromMap
  const file = typeof row?.imageFile === 'string' ? row.imageFile.trim() : ''
  if (file) return `${IMG_BASE}/${step}/${file}`
  if (allowRaw && typeof row?.imagePath === 'string' && row.imagePath.trim()) return row.imagePath
  return null
}
