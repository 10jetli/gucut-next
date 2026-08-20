import { NextRequest, NextResponse } from 'next/server'
import { askClaude, checkBridgeKey, describeError, streamClaude, bridgeModel, type BridgeRequest } from '@/lib/rokid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ปลายทางที่แว่น Rokid ยิงเข้ามา (ตั้งใน Rizon → Custom Agent → URL)
// รับคำขอแบบ chat completions แล้วส่งต่อให้ Claude · ตอบกลับได้ทั้งแบบ SSE และ JSON ก้อนเดียว
// ตัวโค้ดจริงอยู่ใน lib/rokid.ts — ไฟล์นี้ทำหน้าที่รับ request / ตอบ response เท่านั้น

const enc = new TextEncoder()

function chunkId() {
  return `chatcmpl-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

/** หนึ่งบรรทัดของ SSE ตามรูปแบบ chat.completion.chunk */
function sseChunk(id: string, model: string, created: number, delta: Record<string, unknown>, finish: string | null) {
  const payload = {
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{ index: 0, delta, finish_reason: finish }],
  }
  return enc.encode(`data: ${JSON.stringify(payload)}\n\n`)
}

export async function POST(req: NextRequest) {
  const denied = checkBridgeKey(req.headers)
  if (denied) {
    return NextResponse.json({ error: { message: denied, type: 'authentication_error' } }, { status: 401 })
  }

  let body: BridgeRequest
  try {
    body = (await req.json()) as BridgeRequest
  } catch {
    return NextResponse.json({ error: { message: 'อ่าน JSON ของคำขอไม่ได้', type: 'invalid_request_error' } }, { status: 400 })
  }

  const id = chunkId()
  const created = Math.floor(Date.now() / 1000)

  // ---- แบบสตรีม (SSE) — แว่นจะทยอยแสดงข้อความระหว่างที่ Claude ยังพิมพ์อยู่
  if (body.stream) {
    const model = body.model || bridgeModel()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(sseChunk(id, model, created, { role: 'assistant', content: '' }, null))
        try {
          const res = await streamClaude(body, (text) => {
            controller.enqueue(sseChunk(id, model, created, { content: text }, null))
          })
          controller.enqueue(sseChunk(id, res.model, created, {}, 'stop'))
        } catch (err) {
          // สตรีมเริ่มไปแล้ว ส่ง status code ใหม่ไม่ได้ — บอกผู้ใช้ผ่านข้อความแทน
          const { message } = describeError(err)
          controller.enqueue(sseChunk(id, model, created, { content: `ขออภัย เชื่อมต่อ Claude ไม่สำเร็จ: ${message}` }, 'stop'))
        }
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  // ---- แบบตอบก้อนเดียว
  try {
    const res = await askClaude(body)
    return NextResponse.json({
      id,
      object: 'chat.completion',
      created,
      model: res.model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: res.text },
          finish_reason: res.stopReason === 'max_tokens' ? 'length' : 'stop',
        },
      ],
      usage: {
        prompt_tokens: res.usage.input_tokens,
        completion_tokens: res.usage.output_tokens,
        total_tokens: res.usage.input_tokens + res.usage.output_tokens,
      },
    })
  } catch (err) {
    const { status, message } = describeError(err)
    return NextResponse.json({ error: { message, type: 'api_error' } }, { status })
  }
}

// เปิดด้วยเบราว์เซอร์เพื่อเช็คว่าเส้นทางนี้มีชีวิตอยู่ (ไม่เปิดเผยกุญแจใด ๆ)
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'gucut → Rokid Glasses bridge',
    model: bridgeModel(),
    ready: Boolean((process.env.ANTHROPIC_API_KEY || '').trim() && (process.env.ROKID_BRIDGE_KEY || '').trim()),
    hint: 'ยิง POST พร้อมหัวข้อความ Authorization: Bearer <ROKID_BRIDGE_KEY>',
  })
}
