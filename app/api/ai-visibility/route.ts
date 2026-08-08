import { NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'
import { PROMPTS, analyseAnswer, askClaude, summarise } from '@/lib/ai-visibility'
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

// GET /api/ai-visibility → ประวัติการตรวจ + สรุปผล
export async function GET() {
  try {
    const runs = await readRuns()
    return NextResponse.json({
      ok: true,
      hasKey: !!process.env.ANTHROPIC_API_KEY,
      runs,
      summary: summarise(runs),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

// POST /api/ai-visibility → ตรวจรอบใหม่ (ยิงทุกคำถามเข้า Claude)
export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ใน Netlify → Site configuration → Environment variables' },
      { status: 400 },
    )
  }

  try {
    const results: PromptResult[] = []
    for (const prompt of PROMPTS) {
      try {
        const answer = await askClaude(prompt, apiKey)
        results.push({ prompt, answer, hits: analyseAnswer(answer) })
      } catch (e: any) {
        results.push({ prompt, answer: '', hits: [], error: e?.message ?? String(e) })
      }
    }

    const record: RunRecord = {
      runAt: new Date().toISOString(),
      engine: 'claude',
      results,
    }

    const runs = await readRuns()
    runs.unshift(record)
    await writeRuns(runs)

    return NextResponse.json({
      ok: true,
      run: record,
      summary: summarise(runs),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
