// ตัวส่ง Telegram ร่วมของงานตามเวลาฝั่งหลังร้าน — **บอกได้ว่าส่งออกจริงไหม**
//
// 🔴 **บั๊กที่ไฟล์นี้เกิดมาแก้** (เจอ 8 ก.ย. 2569)
//    ทุกงานตามเวลาในโปรเจกต์นี้เขียนตัวส่งของตัวเองแบบนี้:
//        if (!token || !chat) return;      // ← เงียบสนิท
//    และ Netlify project **gucut-admin ไม่มี TELEGRAM_BOT_TOKEN/CHAT_ID สักตัว**
//    (ตรวจ env ทั้ง 25 ตัวแล้ว ไม่มีจริง · ของอยู่ที่ gucut-storefront เท่านั้น)
//    ⇒ ข้อความ "เด้ง Telegram" ที่เขียนไว้ในเอกสารและในจอ **ไม่เคยออกเลยสักครั้ง**
//       และไม่มีอะไรฟ้อง เพราะโค้ดถูกเขียนให้เงียบตอนขาดคีย์
//
// ⚠️ **ห้ามให้ฟังก์ชันนี้กลืนความล้มเหลว** — คืน `{sent, via, error}` เสมอ
//    ผู้เรียกต้องเอาไปใส่ในคำตอบของตัวเอง คนอ่านผลจะได้แยก
//    "ไม่มีอะไรต้องเตือน" ออกจาก "มีเรื่องต้องเตือนแต่ส่งไม่ออก" ได้
//
// ลำดับการส่ง:
//   1. มี TELEGRAM_* ในโปรเจกต์นี้ → ส่งตรง (เผื่ออนาคตมีคนตั้งไว้)
//   2. ไม่มี → ยิงผ่าน `POST https://gucut.com/api/notify` ด้วย `x-admin-key`
//      (คีย์ `GUCUT_WEB_ADMIN_KEY` มีอยู่แล้วในโปรเจกต์นี้ ใช้กับท่อ /api/web/* อยู่)
//      ⇒ คีย์ Telegram มีเจ้าของที่เดียวคือ gucut-storefront **ห้ามก๊อปมาวางที่นี่**
//         ก๊อปแล้ววันเปลี่ยนคีย์ต้องแก้สองที่ ซึ่งจะลืมแน่นอน

const WEB = process.env.GUCUT_WEB_BASE || "https://gucut.com";

/** @returns {Promise<{sent:boolean, via:string, error?:string}>} */
export async function notify(text, parseMode = "HTML") {
  const msg = String(text ?? "").trim();
  if (!msg) return { sent: false, via: "none", error: "ข้อความว่าง" };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (token && chat) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text: msg, parse_mode: parseMode, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(12000),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.ok) return { sent: true, via: "direct" };
      return { sent: false, via: "direct", error: d?.description || `HTTP ${r.status}` };
    } catch (e) {
      return { sent: false, via: "direct", error: String(e?.message ?? e) };
    }
  }

  const key = process.env.GUCUT_WEB_ADMIN_KEY;
  if (!key) {
    return { sent: false, via: "none", error: "ไม่มีทั้ง TELEGRAM_* และ GUCUT_WEB_ADMIN_KEY — ส่งไม่ได้เลย" };
  }
  try {
    const r = await fetch(`${WEB}/api/notify`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ text: msg, parseMode }),
      signal: AbortSignal.timeout(15000),
    });
    const d = await r.json().catch(() => null);
    if (r.ok && d?.ok) return { sent: true, via: "gucut.com" };
    return { sent: false, via: "gucut.com", error: d?.error || `HTTP ${r.status}` };
  } catch (e) {
    return { sent: false, via: "gucut.com", error: String(e?.message ?? e) };
  }
}
