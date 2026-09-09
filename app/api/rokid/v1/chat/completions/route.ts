import { NextRequest, NextResponse } from 'next/server'
import { askClaude, checkBridgeKey, describeError, streamClaude, bridgeModel, type BridgeRequest } from '@/lib/rokid'
import { logTurn } from '@/lib/rokid-log'

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
  const deniedAt = Date.now()
  const denied = checkBridgeKey(req.headers)
  if (denied) {
    /* 🔴 **ต้องบันทึกใบที่ถูกปฏิเสธด้วย** — ถ้าไม่บันทึก "กุญแจผิด" กับ
       "คำขอไม่เคยมาถึงเลย" จะหน้าตาเหมือนกันเป๊ะในบันทึก (ว่างทั้งคู่)
       แล้วเราจะไปไล่หาสาเหตุผิดที่ · เจอช่องโหว่นี้ของตัวเองเมื่อ 9 ก.ย. 2569
       ตอนที่เจ้าของร้านพูดใส่แว่นแล้วบันทึกว่างเปล่า
       ⚠️ **ห้ามบันทึกค่ากุญแจที่ส่งมา** เก็บแค่ "มีคนยิงมาแล้วโดนปฏิเสธ" + เหตุผล */
    await logTurn({
      at: new Date().toISOString(),
      question: '',
      answer: '',
      model: '—',
      ms: Date.now() - deniedAt,
      ok: false,
      error: `ถูกปฏิเสธที่ด่านกุญแจ: ${denied}`,
      stream: false,
    })
    return NextResponse.json({ error: { message: denied, type: 'authentication_error' } }, { status: 401 })
  }

  let body: BridgeRequest
  try {
    body = (await req.json()) as BridgeRequest
  } catch {
    // อ่าน JSON ไม่ได้ก็ต้องบันทึก — ไม่งั้นคำขอที่รูปแบบเพี้ยนจะหายเงียบเหมือนกัน
    await logTurn({
      at: new Date().toISOString(),
      question: '',
      answer: '',
      model: '—',
      ms: Date.now() - deniedAt,
      ok: false,
      error: 'อ่าน JSON ของคำขอไม่ได้',
      stream: false,
    })
    return NextResponse.json({ error: { message: 'อ่าน JSON ของคำขอไม่ได้', type: 'invalid_request_error' } }, { status: 400 })
  }

  const id = chunkId()
  const created = Math.floor(Date.now() / 1000)
  const startedAt = Date.now()

  /* คำถามล่าสุดของผู้ใช้ — ใช้ทั้งบันทึกและไล่ปัญหา "ถอดเสียงได้ยินว่าอะไร"
     ⚠️ content เป็นข้อความล้วนหรือเป็นชิ้นส่วนหลายชิ้น (ข้อความ+ภาพ) ก็ได้
        จับให้ครบทั้งสองแบบ ไม่งั้นบันทึกจะว่างเปล่าเฉพาะตอนมีภาพ ซึ่งจับได้ยากมาก */
  const lastUserText = (() => {
    const msgs = Array.isArray(body.messages) ? body.messages : []
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m?.role && m.role !== 'user') continue
      const c = m?.content
      if (typeof c === 'string') return c
      if (Array.isArray(c)) {
        const t = c
          .map(p => (p && typeof p === 'object' && 'text' in p ? String((p as { text?: unknown }).text ?? '') : ''))
          .filter(Boolean)
          .join(' ')
        if (t) return t
      }
    }
    return ''
  })()

  // ---- แบบสตรีม (SSE) — แว่นจะทยอยแสดงข้อความระหว่างที่ Claude ยังพิมพ์อยู่
  if (body.stream) {
    const model = body.model || bridgeModel()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(sseChunk(id, model, created, { role: 'assistant', content: '' }, null))
        let full = ''
        let failed: string | undefined
        try {
          const res = await streamClaude(body, (text) => {
            full += text
            controller.enqueue(sseChunk(id, model, created, { content: text }, null))
          })
          controller.enqueue(sseChunk(id, res.model, created, {}, 'stop'))
        } catch (err) {
          // สตรีมเริ่มไปแล้ว ส่ง status code ใหม่ไม่ได้ — บอกผู้ใช้ผ่านข้อความแทน
          const { message } = describeError(err)
          failed = message
          controller.enqueue(sseChunk(id, model, created, { content: `ขออภัย เชื่อมต่อ Claude ไม่สำเร็จ: ${message}` }, 'stop'))
        }
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        // ⚠️ ต้อง await ก่อนปิดสตรีม — ปิดแล้ว Netlify แช่แข็งฟังก์ชันทันที
        await logTurn({
          at: new Date().toISOString(),
          question: lastUserText,
          answer: full,
          model,
          ms: Date.now() - startedAt,
          ok: !failed,
          error: failed,
          stream: true,
        })
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
    await logTurn({
      at: new Date().toISOString(),
      question: lastUserText,
      answer: res.text,
      model: res.model,
      ms: Date.now() - startedAt,
      ok: true,
      stream: false,
    })
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
    // บันทึกใบที่ล้มด้วย — **ใบที่ล้มมีค่ากว่าใบที่สำเร็จตอนไล่ปัญหา**
    // ถ้าเก็บเฉพาะใบที่สำเร็จ บันทึกจะสวยตลอดกาลแล้วเราจะสรุปผิดว่าไม่มีปัญหา
    await logTurn({
      at: new Date().toISOString(),
      question: lastUserText,
      answer: '',
      model: bridgeModel(),
      ms: Date.now() - startedAt,
      ok: false,
      error: message,
      stream: false,
    })
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
