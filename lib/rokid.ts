// สะพานเชื่อมแว่นตา Rokid Glasses → Claude (Anthropic API)
//
// Rokid เปิดฟีเจอร์ "Custom Agent / 自定义智能体" ให้ผูกแว่นเข้ากับโมเดลของเราเองได้
// โดยตั้งค่า URL + กุญแจรับรอง (auth key) บนแพลตฟอร์ม Rizon แล้วแว่นจะยิงคำถามมาที่ URL นั้น
// รูปแบบที่แพลตฟอร์มพวกนี้ใช้กันคือ chat completions + สตรีมกลับแบบ SSE
// ไฟล์นี้แปลง request แบบนั้นเป็น Anthropic Messages API แล้วแปลงคำตอบกลับไปให้แว่น
//
// env ที่ต้องตั้ง:
//   ANTHROPIC_API_KEY  — กุญแจ Claude (console.anthropic.com)
//   ROKID_BRIDGE_KEY   — กุญแจที่เรากำหนดเอง ใช้กรอกช่อง auth key ฝั่ง Rokid
//   ROKID_MODEL        — (ไม่บังคับ) รหัสโมเดล ค่าเริ่มต้น claude-opus-5
//   ROKID_EFFORT       — (ไม่บังคับ) low | medium | high | xhigh | max — ค่าเริ่มต้น low (ตอบไว)
//   ROKID_SYSTEM       — (ไม่บังคับ) ทับ system prompt เริ่มต้น

import Anthropic from '@anthropic-ai/sdk'

const cleanEnv = (v?: string) => (v ?? '').replace(/[\r\n\t]/g, '').trim().replace(/^["']+|["']+$/g, '').trim()

export const DEFAULT_MODEL = 'claude-opus-5'

/** ระดับความพยายามที่ Claude ใช้คิด — แว่นต้องการคำตอบไว จึงตั้ง low เป็นค่าเริ่มต้น */
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

// คำสั่งระบบเริ่มต้น — ปรับให้เหมาะกับการอ่านบนจอแว่น (สั้น ฟังรู้เรื่องเมื่ออ่านออกเสียง)
const DEFAULT_SYSTEM = [
  'คุณคือผู้ช่วยที่อยู่ในแว่นตา Rokid ของผู้ใช้ ผู้ใช้พูดคุยด้วยเสียงและอ่านคำตอบบนจอเล็ก ๆ ในแว่น',
  'ตอบเป็นภาษาไทยเสมอ เว้นแต่ผู้ใช้ถามเป็นภาษาอื่น',
  'ตอบสั้น กระชับ ตรงคำถาม ปกติไม่เกิน 2-3 ประโยค ไม่ต้องเกริ่นนำหรือสรุปซ้ำ',
  'ห้ามใช้ตาราง หัวข้อย่อย หรือ markdown — ใช้ข้อความธรรมดาที่อ่านออกเสียงได้ทันที',
  'ถ้าคำถามกว้างเกินไป ให้เดาเจตนาที่น่าจะเป็นแล้วตอบไปเลย อย่าถามกลับหลายรอบ',
  'ถ้าผู้ใช้ส่งภาพจากกล้องแว่นมาด้วย ให้ดูภาพประกอบการตอบ',
].join('\n')

export function bridgeModel() {
  return cleanEnv(process.env.ROKID_MODEL) || DEFAULT_MODEL
}

function bridgeEffort(): Effort {
  const v = cleanEnv(process.env.ROKID_EFFORT).toLowerCase() as Effort
  return EFFORTS.includes(v) ? v : 'low'
}

function bridgeSystem() {
  return cleanEnv(process.env.ROKID_SYSTEM) || DEFAULT_SYSTEM
}

/** เทียบสตริงแบบใช้เวลาคงที่ — กันการเดากุญแจทีละตัวอักษรจากเวลาที่ตอบกลับ */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * ตรวจกุญแจที่ฝั่ง Rokid ส่งมา — รับได้ทั้ง `Authorization: Bearer xxx` และ `x-api-key: xxx`
 * (แต่ละแพลตฟอร์มส่งไม่เหมือนกัน) คืน null ถ้าผ่าน หรือคืนข้อความเหตุผลถ้าไม่ผ่าน
 */
export function checkBridgeKey(headers: Headers): string | null {
  const expected = cleanEnv(process.env.ROKID_BRIDGE_KEY)
  if (!expected) return 'ยังไม่ได้ตั้ง ROKID_BRIDGE_KEY บนเซิร์ฟเวอร์'

  const bearer = (headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const apiKey = (headers.get('x-api-key') || '').trim()
  const got = bearer || apiKey
  if (!got) return 'ไม่มีกุญแจในหัวข้อความ (Authorization: Bearer ...)'
  if (!safeEqual(got, expected)) return 'กุญแจไม่ถูกต้อง'
  return null
}

// ---------- แปลงข้อความขาเข้า ----------

/** ข้อความหนึ่งชิ้นจากฝั่งแว่น — content เป็นข้อความล้วนหรือเป็นชิ้นส่วนหลายชิ้น (ข้อความ + ภาพ) ก็ได้ */
export interface IncomingMessage {
  role?: string
  content?: unknown
}

export interface BridgeRequest {
  model?: string
  messages?: IncomingMessage[]
  stream?: boolean
  max_tokens?: number
  /** บางแพลตฟอร์มส่งคำถามมาเป็นข้อความเดี่ยว ๆ แทน messages */
  input?: string
  query?: string
  text?: string
  prompt?: string
}

const IMAGE_MEDIA = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type ImageMedia = (typeof IMAGE_MEDIA)[number]

function imageBlockFromUrl(url: string): Anthropic.ImageBlockParam | null {
  const dataUrl = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(url)
  if (dataUrl) {
    const media = dataUrl[1].toLowerCase()
    if (!IMAGE_MEDIA.includes(media as ImageMedia)) return null
    return { type: 'image', source: { type: 'base64', media_type: media as ImageMedia, data: dataUrl[2] } }
  }
  if (/^https?:\/\//i.test(url)) {
    return { type: 'image', source: { type: 'url', url } }
  }
  return null
}

/** แปลง content หนึ่งข้อความให้เป็น block ของ Anthropic (รองรับข้อความ + ภาพจากกล้องแว่น) */
function toContentBlocks(content: unknown): Anthropic.ContentBlockParam[] {
  if (typeof content === 'string') {
    return content.trim() ? [{ type: 'text', text: content }] : []
  }
  if (!Array.isArray(content)) return []

  const blocks: Anthropic.ContentBlockParam[] = []
  for (const part of content) {
    if (typeof part === 'string') {
      if (part.trim()) blocks.push({ type: 'text', text: part })
      continue
    }
    if (!part || typeof part !== 'object') continue
    const p = part as Record<string, any>

    if (typeof p.text === 'string' && p.text.trim()) {
      blocks.push({ type: 'text', text: p.text })
      continue
    }
    // รูปแบบ image_url (แบบที่แพลตฟอร์ม chat ส่วนใหญ่ส่งมา) หรือ url/image ตรง ๆ
    const url =
      (typeof p.image_url === 'string' && p.image_url) ||
      (p.image_url && typeof p.image_url.url === 'string' && p.image_url.url) ||
      (typeof p.image === 'string' && p.image) ||
      (p.type === 'image' && typeof p.url === 'string' && p.url) ||
      ''
    if (url) {
      const block = imageBlockFromUrl(url)
      if (block) blocks.push(block)
    }
  }
  return blocks
}

export interface ParsedRequest {
  system: string
  messages: Anthropic.MessageParam[]
}

/**
 * แปลง body ที่แว่นส่งมาให้อยู่ในรูปที่ Anthropic รับได้
 * - role `system` ถูกดึงไปรวมกับ system prompt (Anthropic แยก system ออกจาก messages)
 * - ข้อความว่างถูกตัดทิ้ง และบังคับให้เริ่มด้วย role `user` เสมอ
 */
export function parseRequest(body: BridgeRequest): ParsedRequest {
  const extraSystem: string[] = []
  const messages: Anthropic.MessageParam[] = []

  for (const m of body.messages ?? []) {
    const role = (m.role || 'user').toLowerCase()
    const blocks = toContentBlocks(m.content)
    if (!blocks.length) continue

    if (role === 'system' || role === 'developer') {
      extraSystem.push(blocks.filter(b => b.type === 'text').map(b => (b as Anthropic.TextBlockParam).text).join('\n'))
      continue
    }
    messages.push({ role: role === 'assistant' ? 'assistant' : 'user', content: blocks })
  }

  // บางแพลตฟอร์มส่งคำถามมาเป็นข้อความเดี่ยว ไม่ได้ส่ง messages
  if (!messages.length) {
    const single = [body.input, body.query, body.text, body.prompt].find(v => typeof v === 'string' && v.trim())
    if (single) messages.push({ role: 'user', content: [{ type: 'text', text: single as string }] })
  }

  // Anthropic ต้องเริ่มด้วย user เสมอ — ตัดคำตอบผู้ช่วยที่ค้างอยู่หัวแถวออก
  while (messages.length && messages[0].role !== 'user') messages.shift()
  if (!messages.length) messages.push({ role: 'user', content: [{ type: 'text', text: 'สวัสดี' }] })

  const system = [bridgeSystem(), ...extraSystem.filter(Boolean)].join('\n\n')
  return { system, messages }
}

// ---------- เรียก Claude ----------

function client() {
  const apiKey = cleanEnv(process.env.ANTHROPIC_API_KEY)
  if (!apiKey) throw new Error('ยังไม่ได้ตั้ง ANTHROPIC_API_KEY บนเซิร์ฟเวอร์')
  return new Anthropic({ apiKey })
}

function requestParams(body: BridgeRequest) {
  const { system, messages } = parseRequest(body)
  return {
    model: cleanEnv(body.model) || bridgeModel(),
    max_tokens: Math.min(Math.max(body.max_tokens ?? 1024, 256), 8192),
    system,
    messages,
    // แว่นแสดงผลจอเล็กและต้องการคำตอบไว — คิดแบบ adaptive แต่ใช้ effort ต่ำ
    thinking: { type: 'adaptive' as const },
    output_config: { effort: bridgeEffort() },
  }
}

/** ถามครั้งเดียวจบ (ไม่สตรีม) — คืนข้อความที่ Claude ตอบ */
export async function askClaude(body: BridgeRequest) {
  const params = requestParams(body)
  const res = await client().messages.create(params)
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
  return { text, model: res.model, usage: res.usage, stopReason: res.stop_reason }
}

/** ถามแบบสตรีม — ส่ง callback ทีละชิ้นข้อความ */
export async function streamClaude(
  body: BridgeRequest,
  onDelta: (text: string) => void,
): Promise<{ model: string; usage: Anthropic.Usage }> {
  const params = requestParams(body)
  const stream = client().messages.stream(params)
  stream.on('text', (t) => onDelta(t))
  const final = await stream.finalMessage()
  return { model: final.model, usage: final.usage }
}

/** แปลง error จาก SDK เป็นข้อความไทยที่อ่านรู้เรื่องบนจอแว่น */
export function describeError(err: unknown): { status: number; message: string } {
  if (err instanceof Anthropic.AuthenticationError) return { status: 502, message: 'กุญแจ ANTHROPIC_API_KEY ไม่ถูกต้อง' }
  if (err instanceof Anthropic.RateLimitError) return { status: 429, message: 'ถูกจำกัดจำนวนคำขอ ลองใหม่อีกครั้ง' }
  if (err instanceof Anthropic.BadRequestError) return { status: 400, message: `คำขอไม่ถูกต้อง: ${err.message}` }
  if (err instanceof Anthropic.NotFoundError) return { status: 502, message: `ไม่พบโมเดลนี้: ${err.message}` }
  if (err instanceof Anthropic.APIConnectionError) return { status: 504, message: 'ต่อกับ Claude ไม่ได้ (เครือข่ายมีปัญหา หรือใช้เวลานานเกินไป)' }
  if (err instanceof Anthropic.APIError) return { status: 502, message: `Claude ตอบกลับผิดพลาด${err.status ? ` (${err.status})` : ''}: ${err.message}` }
  return { status: 500, message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่รู้จัก' }
}
