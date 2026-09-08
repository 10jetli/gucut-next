// ตัวเฝ้า "บิลเดือนที่แล้วขาดไหม" — เจ้าของร้านสั่งหาทางแก้ 8 ก.ย. 2569
//
// 🔴 **ปัญหาที่ตัวนี้แก้: ความเงียบสองแบบที่หน้าตาเหมือนกัน**
//    ① เดือนนี้ยังไม่มีบิล (ปกติ)
//    ② ตัวเก็บบิลตายไปแล้ว (ไม่ปกติ)
//    ตัวเก็บบิลของ LINE/Adobe พึ่ง **เบราว์เซอร์ที่ล็อกอินไว้บนเครื่องเจ้าของร้าน**
//    (LINE ไม่มี API สำหรับใบกำกับภาษี และไม่ส่งใบเข้าอีเมลด้วย — ตรวจแล้ว 8 ก.ย. 2569)
//    พอ session หมดอายุ งานจะข้ามแบบสุภาพแล้วเงียบ ⇒ แยกจากข้อ ① ไม่ได้เลย
//    วันที่เขียนไฟล์นี้ session ของ LINE **หมดอายุอยู่จริง** — ถ้าไม่มีตัวนี้จะรู้ตัวตอนสิ้นปี
//
// ⚠️ **ยิงวันที่ 10 · 17 · 24 ไม่ใช่ทุกวัน** — ทุกวันคือการบ่น คนจะเลิกอ่าน
//    และมันเด้งเฉพาะตอนมีของขาดจริง ⇒ เด้งซ้ำ = ยังไม่มีใครแก้ ซึ่งควรดังขึ้นไม่ใช่เงียบลง
// ⚠️ **ห้ามเขียนว่า "ไม่ได้ถูกเรียกเก็บ"** — เรารู้แค่ว่า "ยังไม่มีในคลัง"
//    คนละคำถามกัน ข้อความต้องสั่งให้ไป **ตรวจ** ไม่ใช่สรุปแทน

import { notify } from "./lib-notify.mjs";

const SITE = process.env.URL || "https://admin.gucut.com";

const json = (b, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

/** ที่ให้ไปแก้เป็นราย ๆ — เขียนไว้ตรงนี้เพราะเป็น "ทางเดินของคน" ไม่ใช่ข้อมูลของระบบ */
const FIX_HINT = {
  line: "เปิด manager.line.biz ล็อกอิน @gucut1 (session หมดอายุบ่อย — เป็นสาเหตุอันดับ 1)",
  adobe: "เปิด account.adobe.com ล็อกอิน แล้วรอตัวเก็บรอบถัดไป",
  netlify: "ยังไม่ได้ตั้ง NETLIFY_API_TOKEN หรือ token หมดอายุ — ดู /core/settings-jobs",
  apple: "ใบมาทางอีเมล — เช็คว่าเมลเข้ากล่อง gucut@icloud.com ไหม",
};

export default async function handler() {
  const secret = process.env.DRIVESYNC_SECRET;
  /* ยังตั้งค่าไม่ครบ = skip พร้อมเหตุผล **ห้ามตอบ ok** (สัญญากับฝั่งจอ) */
  if (!secret) return json({ skip: "ยังไม่ได้ตั้ง DRIVESYNC_SECRET — ตัวเฝ้าบิลยังทำงานไม่ได้" });

  let d;
  try {
    const r = await fetch(`${SITE}/api/bills/watch?secret=${encodeURIComponent(secret)}`, {
      signal: AbortSignal.timeout(25000),
    });
    d = await r.json();
    if (!r.ok || d?.error) throw new Error(d?.error || `HTTP ${r.status}`);
  } catch (e) {
    /* ตัวเฝ้าพังเองก็ต้องดัง ไม่งั้นเราจะได้ "ตัวเฝ้าที่เงียบ" ซึ่งแย่กว่าไม่มีตัวเฝ้า
       เพราะทุกคนจะเชื่อว่ามีคนเฝ้าอยู่ */
    const n = await notify(`🔴 <b>ตัวเฝ้าบิลทำงานไม่ได้</b>\n${e.message}\nไปดูที่ ${SITE}/bills`);
    return json({ ok: false, error: e.message, telegram: n }, 502);
  }

  const { month, missing = [], unreadable = [], found = [] } = d;
  if (!missing.length && !unreadable.length) {
    return json({ ok: true, month, quiet: true, found: found.length });
  }

  const lines = [`🧾 <b>บิลเดือน ${month} ยังขาด</b>`];
  for (const m of missing) {
    lines.push(`  ⚠️ <b>${m.name}</b> — ${FIX_HINT[m.id] || "ไปดูที่หน้าบิลของเจ้านี้"}`);
  }
  /* กองที่สาม: อ่านคลังไม่ได้ ≠ ไม่มีบิล — ต้องแยกให้เห็น ไม่ยัดรวมกับข้างบน */
  for (const u of unreadable) {
    lines.push(`  ❓ <b>${u.id}</b> — อ่านคลังไม่ได้ ยังไม่รู้ว่ามีบิลหรือเปล่า (${u.why})`);
  }
  lines.push("");
  lines.push("<i>แปลว่า “ยังไม่มีในคลัง” เท่านั้น ไม่ได้แปลว่าไม่ถูกเรียกเก็บ — ให้ไปตรวจ</i>");
  lines.push(`${SITE}/bills`);
  const n = await notify(lines.join("\n"));

  /* 🔴 ส่งไม่ออก = ต้องเห็นในคำตอบ ห้ามกลืน — ไม่งั้นได้ "ตัวเฝ้าที่ไม่มีใครได้ยิน"
     ซึ่งแย่กว่าไม่มีตัวเฝ้า เพราะทุกคนเชื่อว่ามีคนเฝ้าอยู่ */
  return json({ ok: false, month, missing, unreadable, telegram: n });
}

// วันที่ 10 · 17 · 24 ของทุกเดือน เวลา 08:00 ไทย (01:00 UTC)
// วันที่ 10 เพราะบิลรอบเดือนก่อนควรเข้าครบแล้ว · 17/24 คือการทวงซ้ำถ้ายังไม่มีใครแก้
export const config = { schedule: "0 1 10,17,24 * *" };
