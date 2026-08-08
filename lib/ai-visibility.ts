// ตรวจ AI Visibility — ยิงคำถามที่ลูกค้าน่าจะถามผู้ช่วย AI แล้วดูว่าคำตอบเอ่ยถึงร้านเราหรือคู่แข่ง
// แก้รายชื่อแบรนด์/คำถามที่ไฟล์นี้ที่เดียว

export interface Brand {
  id: string
  name: string
  isUs?: boolean
  keywords: string[]
}

// แบรนด์ที่ติดตาม — GUCUT คือเรา ที่เหลือคือคู่แข่ง
export const TRACKED_BRANDS: Brand[] = [
  { id: 'gucut', name: 'GUCUT', isUs: true, keywords: ['gucut', 'กูคัท', 'กูคัต', 'gucut.com'] },
  { id: 'fujiyama', name: 'Fujiyama Supply', keywords: ['fujiyama', 'ฟูจิยาม่า', 'ฟูจิยามะ'] },
  { id: 'lumberjack888', name: 'Lumberjack888', keywords: ['lumberjack888', 'lumberjack 888'] },
]

// คำถามที่ใช้ทดสอบ — เพิ่ม/แก้ได้ตามต้องการ
export const PROMPTS: string[] = [
  'ร้านขายเลื่อยยนต์ออนไลน์ในไทยที่ไหนดี น่าเชื่อถือ แนะนำหน่อย',
  'อยากซื้อเลื่อยยนต์ ร้านไหนแนะนำบ้าง',
  'หาอะไหล่เลื่อยยนต์ ร้านไหนมีของครบ ส่งไว',
  'เลื่อยยนต์ NEWWAVE ซื้อที่ไหนดี',
  'โซ่เลื่อยยนต์ KINGKONG ซื้อที่ไหน ราคาเท่าไหร่',
  'ร้านเลื่อยยนต์ที่มีใบอนุญาตนำเข้าถูกต้องตามกฎหมาย มีร้านไหนบ้าง',
]

export interface BrandHit {
  brandId: string
  mentioned: boolean
  /** ลำดับที่ถูกเอ่ยถึงในคำตอบ (1 = เอ่ยก่อนใคร) — null ถ้าไม่ถูกเอ่ยเลย */
  position: number | null
}

export interface PromptResult {
  prompt: string
  answer: string
  hits: BrandHit[]
  error?: string
}

export interface RunRecord {
  runAt: string
  engine: string
  results: PromptResult[]
}

/** หาตำแหน่งแรกที่คำสำคัญของแบรนด์โผล่ในข้อความ (index ตัวอักษร) — -1 ถ้าไม่เจอ */
function firstIndexOf(text: string, keywords: string[]): number {
  const lower = text.toLowerCase()
  let best = -1
  for (const k of keywords) {
    const i = lower.indexOf(k.toLowerCase())
    if (i !== -1 && (best === -1 || i < best)) best = i
  }
  return best
}

/** วิเคราะห์คำตอบว่าเอ่ยถึงแบรนด์ไหนบ้าง และใครถูกเอ่ยก่อน */
export function analyseAnswer(answer: string): BrandHit[] {
  const found = TRACKED_BRANDS.map(b => ({
    brandId: b.id,
    index: firstIndexOf(answer, b.keywords),
  }))

  // จัดอันดับตามตำแหน่งที่โผล่ก่อน — เอ่ยก่อน = อันดับดีกว่า
  const ranked = found
    .filter(f => f.index !== -1)
    .sort((a, b) => a.index - b.index)

  return found.map(f => ({
    brandId: f.brandId,
    mentioned: f.index !== -1,
    position: f.index === -1 ? null : ranked.findIndex(r => r.brandId === f.brandId) + 1,
  }))
}

/** ถาม Claude หนึ่งคำถาม แล้วคืนคำตอบดิบ */
export async function askClaude(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 200)}`)
  }
  const data = await res.json()
  return (data.content ?? [])
    .map((b: any) => (b.type === 'text' ? b.text : ''))
    .join('')
}

/** สรุปผลรวมจากประวัติทั้งหมด — ใช้โชว์บนหน้าเว็บ */
export function summarise(runs: RunRecord[]) {
  const totals = TRACKED_BRANDS.map(b => {
    let mentions = 0
    let checks = 0
    let posSum = 0
    let posCount = 0
    for (const run of runs) {
      for (const r of run.results) {
        if (r.error) continue
        checks++
        const hit = r.hits.find(h => h.brandId === b.id)
        if (hit?.mentioned) {
          mentions++
          if (hit.position) {
            posSum += hit.position
            posCount++
          }
        }
      }
    }
    return {
      brandId: b.id,
      name: b.name,
      isUs: !!b.isUs,
      mentions,
      checks,
      sharePct: checks ? Math.round((mentions / checks) * 100) : 0,
      avgPosition: posCount ? +(posSum / posCount).toFixed(1) : null,
    }
  })
  // เรียงตามจำนวนครั้งที่ถูกเอ่ยถึง มากไปน้อย
  return totals.sort((a, b) => b.mentions - a.mentions)
}
