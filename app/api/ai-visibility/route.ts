import { NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'
import { PROMPTS, analyseAnswer, askGemini, summarise } from '@/lib/ai-visibility'
import type { PromptResult, RunRecord } from '@/lib/ai-visibility'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STORE = 'ai-visibility'
const KEY = 'runs'
const MAX_RUNS = 60 // เก็บย้อนหลังพอดูเทรนด์ ไม่ให้ blob โตไม่จำกัด

async function readRuns(): Promise<RunRecord[]> {
  const store = getStore(STORE)
  const raw = await store.get(KEY, { type: 'json' })
  return Array.isArray(raw) ? (raw as RunRecord[]) : []
}

async function writeRuns(runs: RunRecord[]) {
  const store = getStore(STORE)
  await store.setJSON(KEY, runs.slice(0, MAX_RUNS))
}

/* 🔢 **ตัวนับรอบสะสม — แยกจากประวัติโดยตั้งใจ** (เพิ่ม 12 ก.ย. 2569)
   ประวัติถูกตัดไว้ที่ MAX_RUNS เพื่อไม่ให้ blob โตไม่จำกัด ⇒ `runs.length` ไม่ใช่
   "ตรวจไปแล้วกี่รอบ" แต่คือ "เก็บประวัติไว้กี่รอบ" · พอครบ 60 การ์ดบนจอจะค้างที่ 60
   **ตลอดกาล** ทั้งที่ตรวจไปหลายร้อยรอบ — เลขที่หยุดโตโดยไม่มีอะไรบอก
   ⇒ นับสะสมไว้ต่างหาก แล้วให้จอโชว์เลขนี้แทน
   ⚠️ อ่านไม่ได้/ยังไม่เคยมี = `null` **ห้ามแทนด้วย runs.length** (นั่นคือการกลับไปโกหกแบบเดิม)
      จอจะได้เขียนว่า "อย่างน้อย N รอบ" แทนการยืนยันเลขที่ไม่รู้ */
const TOTAL_KEY = 'ai-visibility/total-runs'
async function readTotalRuns(): Promise<number | null> {
  try {
    const v = await getStore(STORE).get(TOTAL_KEY, { type: 'json' })
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  } catch { return null }
}

// GET /api/ai-visibility → ประวัติการตรวจ + สรุปผล
export async function GET() {
  try {
    const runs = await readRuns()
    return NextResponse.json({
      ok: true,
      hasKey: !!process.env.GEMINI_API_KEY,
      runs,
      /* จำนวนรอบที่ตรวจไปจริงทั้งหมด (ไม่ใช่จำนวนที่เก็บประวัติไว้)
         null = ยังไม่มีตัวนับ (ของเก่าก่อนวันที่เพิ่ม) ⇒ จอต้องเขียนว่า "อย่างน้อย" */
      totalRuns: await readTotalRuns(),
      keptRuns: runs.length,
      maxKept: MAX_RUNS,
      summary: summarise(runs),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

// POST /api/ai-visibility → ตรวจรอบใหม่ (ยิงทุกคำถามเข้า Gemini)
export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Netlify → Site configuration → Environment variables' },
      { status: 400 },
    )
  }

  try {
    // ยิงทุกคำถามพร้อมกัน (parallel) — ให้จบใน 1 request ทันเพดานเวลา Netlify function
    const results: PromptResult[] = await Promise.all(
      PROMPTS.map(async (prompt): Promise<PromptResult> => {
        try {
          const answer = await askGemini(prompt, apiKey)
          return { prompt, answer, hits: analyseAnswer(answer) }
        } catch (e: any) {
          return { prompt, answer: '', hits: [], error: e?.message ?? String(e) }
        }
      }),
    )

    const record: RunRecord = {
      runAt: new Date().toISOString(),
      engine: 'gemini',
      results,
    }

    const runs = await readRuns()
    runs.unshift(record)
    await writeRuns(runs)
    /* บวกตัวนับสะสม — เริ่มจากจำนวนที่เก็บไว้ตอนนี้ถ้ายังไม่เคยมีตัวนับ
       ⚠️ ต้อง await (Netlify แช่แข็งฟังก์ชันหลังตอบ · ปล่อยลอย = ตัวนับไม่ขยับเงียบ ๆ)
       ⚠️ ล้มเหลวห้ามทำให้การตรวจล้ม — ผลการตรวจสำคัญกว่าตัวนับ */
    try {
      const prev = await readTotalRuns()
      await getStore(STORE).setJSON(TOTAL_KEY, (prev ?? runs.length - 1) + 1)
    } catch { /* ตัวนับพลาดหนึ่งรอบ ดีกว่าการตรวจล้มทั้งรอบ */ }

    return NextResponse.json({
      ok: true,
      run: record,
      summary: summarise(runs),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
