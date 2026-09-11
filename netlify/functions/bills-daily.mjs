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
// 🔴 **กลับกติกา "วันปกติต้องเงียบ" แล้ว (12 ก.ย. 2569 — CEO สั่ง)**
//    ของเดิมเงียบเมื่อ uploaded=0 และไม่มีเจ้าพัง ⇒ "สแกนครบแต่ไม่มีของใหม่" กับ
//    "งานตามเวลาไม่เคยรัน" หน้าตาเหมือนกันเป๊ะ = เงียบทั้งคู่ ([[nothing-triggers-it]])
//    บิลคือเอกสารบัญชี หายเงียบจะรู้ตอนยื่นภาษี ⇒ ยอมจ่ายวันละหนึ่งบรรทัด
//    **ข้อความวันปกติต้องสั้นบรรทัดเดียว** ยาวเมื่อไหร่คนจะเลิกอ่านตามเหตุผลเดิม
// ⚠️ **เจ้าที่พังต้องมีชื่อโผล่ในข้อความเสมอ** — สรุปแบบ "7/8 สำเร็จ" โดยไม่บอกว่า
//    ตัวไหนหาย = ไม่มีใครรู้ว่าต้องไปดูอะไร (absence must have a row and an owner)

// รายชื่อเจ้าตรงกับ lib/vendors.ts — จงใจไม่ import ไฟล์ .ts (ฟังก์ชัน .mjs import ไม่ได้)
// เจ้าใหม่ต้องเพิ่มสองที่: vendors.ts และที่นี่ · ตัวกันลืมคือแจ้งเตือน "ไม่รู้จัก vendor"
const VENDOR_IDS = ["tiktok", "meta", "google", "shopify", "line", "adobe", "apple", "omise", "netlify", "cloudflare", "anthropic", "lazada"];

import { notify } from "./lib-notify.mjs";

const SITE = process.env.URL || "https://admin.gucut.com";


export default async function handler() {
  const secret = process.env.DRIVESYNC_SECRET;
  const qs = secret ? `&secret=${encodeURIComponent(secret)}` : "";

  // ② ช่วงวันที่ — งานรายวันมองย้อนแค่ 14 วัน (ของเดิมค้นย้อน 1 ปีทุกเช้า ⇒ ชนเพดาน Gmail)
  //    14 วันเผื่องานตายติดกันได้สองสัปดาห์แล้วยังตามเก็บย้อนหลังได้ครบ
  //    วันที่ 1 ของเดือนกวาดลึก 400 วันหนึ่งรอบ = ตาข่ายรับของที่หลุดไปนานกว่านั้น
  //    (วันนั้นคำขอเยอะ แต่ ① ทำให้ใบที่มีอยู่แล้วไม่ต้องโหลดซ้ำ จึงไม่ชนเพดาน)
  const deepDay = new Date(Date.now() + 7 * 3600e3).getUTCDate() === 1;   // วันที่ตามเวลาไทย
  const days = deepDay ? 400 : 14;

  const results = await Promise.allSettled(
    VENDOR_IDS.map(async (v) => {
      const r = await fetch(`${SITE}/api/bills/drivesync?vendor=${v}&days=${days}${qs}`, {
        signal: AbortSignal.timeout(22000),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d || d.error) throw new Error(`${v}: ${d?.error ?? `HTTP ${r.status}`}`);
      return d; // { vendor, name, total, uploaded, skipped, failed, errors }
    })
  );

  let tgResult = null;
  const ok = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const dead = results
    // ⚠️ ตัดที่ 80 ตัวอักษรเคยตัดชื่อเพดานทิ้ง — ข้อความจริงคือ
    //    "Quota exceeded for quota metric 'Total Query Cost' and limit 'Units per minute per user'"
    //    แต่ในกลุ่มเห็นแค่ "Quota exceeded for qu" ⇒ ตามต่อไม่ได้ว่าเพดานตัวไหน
    //    **ข้อความที่ตัดจนไม่รู้สาเหตุ = ไม่ได้แจ้งเตือน** ⇒ ให้พื้นที่พอเห็นชื่อเพดานเสมอ
    .map((r, i) => (r.status === "rejected" ? `${VENDOR_IDS[i]} (${String(r.reason?.message ?? r.reason).slice(0, 220)})` : null))
    .filter(Boolean);
  const uploaded = ok.reduce((n, d) => n + (d.uploaded || 0), 0);
  const failedFiles = ok.reduce((n, d) => n + (d.failed || 0), 0);

  const scanned = ok.length;           // เจ้าที่สแกนจบจริง
  const quiet = uploaded === 0 && failedFiles === 0 && dead.length === 0;

  // สามสถานะ ต้องแยกออกจากกันบนจอเสมอ:
  //   ① สแกนครบ ไม่มีของใหม่  ② ได้บิลใหม่  ③ สแกนไม่ได้ / ไฟล์ดึงไม่สำเร็จ
  if (quiet) {
    tgResult = await notify(
      `🧾 เก็บบิลประจำวัน: สแกนสำเร็จครบ ${scanned}/${VENDOR_IDS.length} เจ้า · ไม่มีบิลใหม่${deepDay ? " (กวาดลึกรายเดือน)" : ""}`
    );
  } else {
    const lines = [`🧾 <b>เก็บบิลประจำวัน</b> — ใหม่ ${uploaded} ไฟล์ · สแกนจบ ${scanned}/${VENDOR_IDS.length} เจ้า`];
    for (const d of ok.filter((x) => x.uploaded > 0)) lines.push(`  ✅ ${d.name}: +${d.uploaded}`);
    if (failedFiles > 0)
      lines.push(`  ⚠️ ไฟล์ที่ดึงไม่สำเร็จ ${failedFiles} ใบ: ${ok.filter((x) => x.failed > 0).map((x) => x.name).join(", ")}`);
    if (dead.length) lines.push(`  🔴 เจ้าที่สแกนไม่ได้เลย: ${dead.join(" · ")}`);
    lines.push(`ดูที่ ${SITE}/bills`);
    tgResult = await notify(lines.join("\n"));
  }

  return new Response(
    JSON.stringify({
      ok: dead.length === 0,
      days, deepDay, uploaded, failedFiles,
      alreadyHave: ok.reduce((n, d) => n + (d.alreadyHave || 0), 0),   // ใบที่ไม่ต้องโหลดซ้ำ = คำขอที่ประหยัดได้
      fetched: ok.reduce((n, d) => n + (d.fetched || 0), 0),          // ใบที่โหลดจริงรอบนี้
      vendors: ok.length, dead, telegram: tgResult,
    }),
    { headers: { "content-type": "application/json" } }
  );
}

// ตี 5 ไทยทุกวัน (22:00 UTC) — ก่อนร้านเปิด บิลเมื่อวานเข้าครบพอดี
export const config = { schedule: "0 22 * * *" };
