// เก็บบิลจาก Gmail อัตโนมัติทุกวัน — เจ้าของร้านสั่ง 8 ก.ย. 2569
// "เราจะให้มันเข้าไปเก็บบิลทุกวันทำไง"
//
// เดิมบิลจะเข้าระบบก็ต่อเมื่อมีคนเปิดหน้า /bills เท่านั้น (สแกนตอนโหลดหน้า)
// ⇒ ตัวนี้กดเส้น /api/bills/drivesync ให้ครบทุกเจ้า วันละครั้ง ตี 5 ไทย
//    (เส้นนั้นมีอยู่แล้วและอยู่นอกด่านล็อกอินโดยตั้งใจ มีรหัส DRIVESYNC_SECRET ของตัวเอง)
//
// ⚠️ **ยิงทุกเจ้าพร้อมกัน ห้ามเรียงคิว** — Netlify ให้ฟังก์ชันรอผลได้ ~26 วินาที
//    เรียงทีละเจ้า 8 เจ้า = วันที่ Gmail ช้าจะชนเพดานแล้วเจ้าท้าย ๆ ไม่ถูกสแกนเงียบ ๆ
//    ([[time-budget-is-shared]] — งบเวลาเป็นของใช้ร่วมกัน)
// ⚠️ **แจ้ง Telegram เฉพาะเมื่อมีบิลใหม่หรือมีเจ้าที่พัง** — วันปกติต้องเงียบ
//    เตือนทุกวันทั้งที่ไม่มีอะไร = คนเลิกอ่าน แล้ววันที่พังจริงจะไม่มีใครเห็น
// ⚠️ **เจ้าที่พังต้องมีชื่อโผล่ในข้อความเสมอ** — สรุปแบบ "7/8 สำเร็จ" โดยไม่บอกว่า
//    ตัวไหนหาย = ไม่มีใครรู้ว่าต้องไปดูอะไร (absence must have a row and an owner)

// รายชื่อเจ้าตรงกับ lib/vendors.ts — จงใจไม่ import ไฟล์ .ts (ฟังก์ชัน .mjs import ไม่ได้)
// เจ้าใหม่ต้องเพิ่มสองที่: vendors.ts และที่นี่ · ตัวกันลืมคือแจ้งเตือน "ไม่รู้จัก vendor"
const VENDOR_IDS = ["tiktok", "meta", "google", "shopify", "line", "adobe", "apple", "omise"];

const SITE = process.env.URL || "https://admin.gucut.com";

async function tg(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return; // ไม่ได้ตั้ง = ข้ามเงียบ (งานหลักคือเก็บบิล ไม่ใช่แจ้งเตือน)
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

export default async function handler() {
  const secret = process.env.DRIVESYNC_SECRET;
  const qs = secret ? `&secret=${encodeURIComponent(secret)}` : "";

  const results = await Promise.allSettled(
    VENDOR_IDS.map(async (v) => {
      const r = await fetch(`${SITE}/api/bills/drivesync?vendor=${v}${qs}`, {
        signal: AbortSignal.timeout(22000),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || d.error) throw new Error(`${v}: ${d?.error ?? `HTTP ${r.status}`}`);
      return d; // { vendor, name, total, uploaded, skipped, failed, errors }
    })
  );

  const ok = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const dead = results
    .map((r, i) => (r.status === "rejected" ? `${VENDOR_IDS[i]} (${String(r.reason?.message ?? r.reason).slice(0, 80)})` : null))
    .filter(Boolean);
  const uploaded = ok.reduce((n, d) => n + (d.uploaded || 0), 0);
  const failedFiles = ok.reduce((n, d) => n + (d.failed || 0), 0);

  // วันปกติ (ไม่มีบิลใหม่ ไม่มีอะไรพัง) = เงียบ
  if (uploaded > 0 || failedFiles > 0 || dead.length > 0) {
    const lines = [`🧾 <b>เก็บบิลประจำวัน</b> — ใหม่ ${uploaded} ไฟล์`];
    for (const d of ok.filter((x) => x.uploaded > 0)) lines.push(`  ✅ ${d.name}: +${d.uploaded}`);
    if (failedFiles > 0)
      lines.push(`  ⚠️ ไฟล์ที่ดึงไม่สำเร็จ ${failedFiles} ใบ: ${ok.filter((x) => x.failed > 0).map((x) => x.name).join(", ")}`);
    if (dead.length) lines.push(`  🔴 เจ้าที่สแกนไม่ได้เลย: ${dead.join(" · ")}`);
    lines.push(`ดูที่ ${SITE}/bills`);
    await tg(lines.join("\n"));
  }

  return new Response(
    JSON.stringify({ ok: dead.length === 0, uploaded, failedFiles, vendors: ok.length, dead }),
    { headers: { "content-type": "application/json" } }
  );
}

// ตี 5 ไทยทุกวัน (22:00 UTC) — ก่อนร้านเปิด บิลเมื่อวานเข้าครบพอดี
export const config = { schedule: "0 22 * * *" };
