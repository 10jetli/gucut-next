// ดึงใบเสร็จ Netlify เข้าคลังบิลอัตโนมัติ — เจ้าของร้านสั่ง 8 ก.ย. 2569 ("มีระบบออโต้ไหม")
//
// 🔴 **ทำไมเจ้านี้ต้องมีตัวเก็บของตัวเอง ไม่ใช้ทางเมลเหมือนอีก 8 เจ้า**
//    ยิงของจริงแล้ว 8 ก.ย. 2569: **Netlify ไม่ส่งใบเสร็จเข้าเมลเลยสักใบ**
//    ค้นทั้งกล่อง `from:netlify.com` ได้ 21 ฉบับ เป็นเตือนโควตา / "Action needed" /
//    "upgraded to Pro" ล้วน ๆ · ค้นนอก netlify.com (เผื่อผ่าน Stripe) ได้ 0
//    ⇒ ตัวเก็บทางเมล (drivesync) จะได้ 0 ตลอดกาลไม่ว่าจะตั้ง query ยังไง
//       และรอบแรกที่ตั้ง query กว้าง มันไปจับเมลเตือนมาทำเป็น "ใบเสร็จ.pdf" ปลอม 14 ใบ
//
// เส้นที่ใช้ (ยิงยืนยันแล้วด้วย personal access token ไม่ใช่คุกกี้เบราว์เซอร์):
//   GET https://api.netlify.com/api/v1/<ทีม>/receipts        → รายการใบเสร็จ (JSON)
//   GET https://api.netlify.com/api/v1/<ทีม>/receipts/<id>   → **ตัว PDF จริง** (content-type: application/pdf)
// ⚠️ เส้นนี้ไม่มีในเอกสาร Netlify (เจอจากการดักดูคำขอที่หน้าแดชบอร์ดยิงเอง)
//    วันไหนมันหาย ตัวนี้จะฟ้อง ไม่ใช่เงียบ — ดูกติกา "ต้องดังตอนพัง" ข้างล่าง
//
// ⚠️ **ต้องตั้ง `NETLIFY_API_TOKEN` เองที่ Netlify** (User settings → Applications →
//    Personal access tokens) ไม่ตั้ง = ข้ามแบบ **บอกเหตุผล** ไม่ใช่เงียบ
//    ไม่ใช้ token ของ CLI ในเครื่องใครคนหนึ่ง เพราะงานตามเวลารันบนเซิร์ฟเวอร์ ไม่มีเครื่องนั้น
//
// ⚠️ **กันซ้ำที่ปลายทาง ไม่ใช่ที่นี่** — ชื่อไฟล์คงที่ต่อใบ (`Netlify-<วันที่>-USD<ยอด>.pdf`)
//    แล้ว /api/bills/upload เป็นคนตอบว่า uploaded หรือ skipped
//    (กติกาเดียวกับตัวรับรีวิว/ตัวนับคนเข้าเว็บ: ให้ปลายทางปฏิเสธของซ้ำเอง
//     ตัวเก็บจะได้ยิงซ้ำทุกวันโดยไม่ต้องจำอะไร)

import { notify } from "./lib-notify.mjs";

const API = "https://api.netlify.com/api/v1";
const TEAM = process.env.NETLIFY_TEAM_SLUG || "10jetli";
const SITE = process.env.URL || "https://admin.gucut.com";


/** ชื่อไฟล์ต้องคงที่ต่อใบ — เปลี่ยนสูตรนี้เมื่อไหร่ ของเก่าจะถูกอัปซ้ำเป็นใบใหม่ทั้งหมด */
const fileNameFor = (r) => {
  const day = String(r.created_at || "").slice(0, 10);
  const amt = String(r.display_amount ?? r.amount ?? "").replace(/^\$/, "");
  return `Netlify-${day}-USD${amt}.pdf`;
};

export default async function handler() {
  const token = process.env.NETLIFY_API_TOKEN;
  const secret = process.env.DRIVESYNC_SECRET;

  /* 🔴 สามสถานะ: ยังไม่ได้ตั้งค่า ≠ ดึงไม่สำเร็จ ≠ ไม่มีใบใหม่
     "ยังไม่ได้ตั้ง" ต้องตอบ skip พร้อมเหตุผล **ห้ามตอบ ok** ไม่งั้นจอจะขึ้นเขียว
     ทั้งที่ไม่เคยดึงอะไรเลยสักครั้ง (ดู [[three-states-not-two]]) */
  if (!token) return skip("ยังไม่ได้ตั้ง NETLIFY_API_TOKEN — ตัวเก็บใบเสร็จ Netlify ยังไม่ทำงาน");
  if (!secret) return skip("ยังไม่ได้ตั้ง DRIVESYNC_SECRET — อัปไฟล์เข้าคลังบิลไม่ได้");

  let list;
  try {
    const r = await fetch(`${API}/${TEAM}/receipts`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`รายการใบเสร็จตอบ HTTP ${r.status}`);
    list = await r.json();
    if (!Array.isArray(list)) throw new Error("รายการใบเสร็จไม่ใช่อาร์เรย์ — เส้น API อาจเปลี่ยนรูป");
  } catch (e) {
    return fail(`ดึงรายการใบเสร็จไม่ได้: ${e.message}`);
  }

  let tgResult = null;
  const added = [];
  const dup = [];
  const errs = [];

  /* ยิงทีละใบพร้อมกัน — ใบเดียวราว 30KB จำนวนน้อย (ทั้งชีวิตร้านตอนนี้ 4 ใบ)
     ⚠️ ถ้าวันไหนใบเยอะขึ้นมาก ต้องแบ่งชุด — Netlify ให้ฟังก์ชันรอผลได้ ~26 วินาที */
  await Promise.all(
    list.map(async (rec) => {
      const name = fileNameFor(rec);
      const month = String(rec.created_at || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) { errs.push(`${name}: วันที่อ่านไม่ออก`); return; }
      try {
        const pr = await fetch(`${API}/${TEAM}/receipts/${rec.id}`, {
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(20000),
        });
        if (!pr.ok) throw new Error(`โหลด PDF ตอบ HTTP ${pr.status}`);
        const buf = new Uint8Array(await pr.arrayBuffer());
        /* ⚠️ ตรวจว่าเป็น PDF จริงก่อนส่งต่อ — วันที่ token หมดอายุ Netlify ตอบหน้า HTML
           มาแทน ซึ่งมีขนาดพอ ๆ กัน ปลายทางจะปฏิเสธเองก็จริง แต่เราอยากได้ข้อความที่ตรงเหตุ */
        const head = new TextDecoder("latin1").decode(buf.subarray(0, 5));
        if (head !== "%PDF-") throw new Error(`ที่ได้มาไม่ใช่ PDF (ขึ้นต้นด้วย "${head}")`);

        const form = new FormData();
        form.append("secret", secret);
        form.append("vendor", "netlify");
        form.append("month", month);
        form.append("filename", name);
        form.append("file", new Blob([buf], { type: "application/pdf" }), name);

        const up = await fetch(`${SITE}/api/bills/upload`, {
          method: "POST", body: form, signal: AbortSignal.timeout(20000),
        });
        const d = await up.json().catch(() => null);
        if (!up.ok || !d?.ok) throw new Error(d?.error || `อัปโหลดตอบ HTTP ${up.status}`);
        (d.uploaded ? added : dup).push(name);
      } catch (e) {
        errs.push(`${name}: ${e.message}`);
      }
    })
  );

  /* แจ้ง Telegram เฉพาะมีของใหม่หรือมีอะไรพัง — วันปกติเงียบ
     (เตือนทุกวันทั้งที่ไม่มีอะไร = คนเลิกอ่าน แล้ววันที่พังจริงไม่มีใครเห็น) */
  if (added.length || errs.length) {
    const lines = [`🧾 <b>ใบเสร็จ Netlify</b> — ใหม่ ${added.length} ใบ (ซ้ำ ${dup.length})`];
    for (const n of added) lines.push(`  ✅ ${n}`);
    for (const e of errs) lines.push(`  🔴 ${e}`);
    lines.push(`ดูที่ ${SITE}/bills/netlify`);
    tgResult = await notify(lines.join("\n"));
  }

  return json({
    ok: errs.length === 0,
    total: list.length,
    added: added.length,
    duplicate: dup.length,
    errors: errs,
    /* ส่งเตือนไม่ออกต้องเห็นในคำตอบ ห้ามกลืน */
    telegram: tgResult,
  });
}

const json = (b, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
/* skip = ทำต่อไม่ได้ · ห้ามมีคีย์ ok (ดูสัญญากับฝั่งจอใน CLAUDE.md) */
const skip = (why) => json({ skip: why });
const fail = (why) => json({ ok: false, error: why }, 502);

// ตี 5 ครึ่งไทย (22:30 UTC) — หลังตัวเก็บบิลทางเมล (22:00) ครึ่งชั่วโมง
// ⚠️ จงใจไม่ให้ชนกัน ทั้งคู่ยิง /api/bills/upload กับ Blobs ก้อนเดียวกัน
export const config = { schedule: "30 22 * * *" };
