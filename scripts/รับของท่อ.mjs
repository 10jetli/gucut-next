#!/usr/bin/env node
/* ยิงรับของจากท่อตาม **เกณฑ์ที่ตกลงกันไว้ล่วงหน้า** — ไม่ใช่ดูแล้วค่อยตัดสินว่าพอใจไหม
 *
 * 🔴 **ที่มา 19 ก.ย. 2569** — ฝั่งท่อแก้สามเรื่องที่ฝั่งจอรออยู่ แต่ยังไม่ deploy
 *    เราตกลง **เกณฑ์รับของ** กันไว้ก่อน แล้วค่อยยิงเมื่อขึ้น
 *    🔑 เขียนเกณฑ์ก่อนเห็นผล = กันตัวเองไม่ให้ "ปรับเกณฑ์ให้เข้ากับผลที่ได้"
 *       (ซึ่งเป็นสิ่งที่เกิดเองโดยไม่รู้ตัวเมื่ออ่านผลก่อนตั้งเกณฑ์)
 *
 * ⚠️ **ข้อที่ต้องระวังตอนอ่านผล** (ฝั่งท่อกำชับมาก่อนยิง):
 *    · `byStatus` **เท่ากันทุกคำขอ = ถูกต้องแล้ว** เพราะมันคือ "ทั้งร้าน" (ใช้ทำรายชื่อแท็บ)
 *    · ตัวที่ต้อง **ต่างเมื่อ total ต่าง** คือ `byStatusFiltered` (ใช้ทำตัวนับบนแท็บ)
 *    ⇒ เทียบผิดตัวจะสรุปว่าฝั่งท่อทำไม่ครบ ทั้งที่ทำถูก
 *    · `statusesAll` **ไม่มีในเส้นใบคืน และตั้งใจไม่ทำ** (byStatus ทำหน้าที่นั้นอยู่แล้ว
 *      ⇒ เพิ่มชื่อซ้ำ = สองชื่อหนึ่งความหมาย ซึ่งเป็นคลาสที่เราเพิ่งเจอ)
 *
 * วิธีใช้: node scripts/รับของท่อ.mjs      (อ่านคีย์จาก .env.local เหมือน ดึงสารบัญท่อ.mjs)
 * 🚫 ไม่อยู่ใน prebuild — ยิงเน็ต และใช้ครั้งเดียวตอนรับของ
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const key = process.env.GUCUT_WEB_ADMIN_KEY
  || (existsSync(join(ROOT, ".env.local"))
    ? (readFileSync(join(ROOT, ".env.local"), "utf8").match(/^GUCUT_WEB_ADMIN_KEY=(.*)$/m)?.[1] ?? "").trim().replace(/^["']|["']$/g, "")
    : "");
if (!key) { console.error("🛑 ไม่มี GUCUT_WEB_ADMIN_KEY"); process.exit(1); }

const ยิง = async (qs) => {
  const r = await fetch(`https://gucut.com/api/core?${qs}`, { headers: { "x-admin-key": key } });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, build: r.headers.get("x-core-build"), j };
};

let ตก = 0;
const บอก = (ผ่าน, ข้อความ) => { if (!ผ่าน) ตก += 1; console.log(`${ผ่าน ? "✅" : "🔴"} ${ข้อความ}`); };

const หัว = await ยิง("list=orders&limit=1");
console.log(`รุ่นท่อที่ตอบตอนนี้: ${หัว.build}\n`);

/* ── ① `applied.q` ใน list=orders และ list=stock ── */
for (const เส้น of ["orders", "stock"]) {
  const { j } = await ยิง(`list=${เส้น}&limit=1&q=zzzzไม่มีคำนี้`);
  const มี = j && typeof j === "object" && "applied" in j;
  บอก(มี, `① ${เส้น}: มีคีย์ \`applied\` ${มี ? `· q=${JSON.stringify(j.applied?.q)}` : "— ยังไม่มี (ท่อยังไม่ deploy หรือชื่อไม่ตรง)"}`);
  /* 🔑 มีคีย์อย่างเดียวไม่พอ — ต้องสะท้อนคำที่เราส่งไปจริง ไม่งั้นจอจะเขียนกำกับผิดคำ */
  if (มี) บอก(j.applied?.q === "zzzzไม่มีคำนี้", `①.1 ${เส้น}: \`applied.q\` สะท้อนคำที่ส่งไปตรงตัว`);
}

/* ── ② ?dupsku=1 ── */
{
  const { j } = await ยิง("dupsku=1");
  const เป็นเส้นจริง = j && j.fallthrough !== true;
  บอก(เป็นเส้นจริง, `② dupsku: เส้นมีจริง (ไม่ใช่คำตอบหน้าแรก)`);
  if (เป็นเส้นจริง) {
    const ช่อง = "ที่มีคู่ยาวกว่าขึ้นต้นเหมือนกัน";
    บอก(ช่อง in j, `②.1 dupsku: มีช่อง "${ช่อง}" ${ช่อง in j ? `= ${j[ช่อง]}` : "— ชื่อช่องไม่ตรงกับที่จออ่าน"}`);
  }
}

/* ── ③ mirrorTotals / byStatus / byStatusFiltered ของเส้นใบคืน ── */
{
  const เปล่า = await ยิง("list=returnorders&limit=5");
  const ค้น = await ยิง("list=returnorders&limit=5&q=CN");
  const ช่วง = await ยิง("list=returnorders&limit=5&from=2026-09-01&to=2026-09-19");
  for (const [ชื่อ, ผล] of [["ไม่กรอง", เปล่า], ["q=CN", ค้น], ["ช่วงวัน", ช่วง]]) {
    const mt = ผล.j?.mirrorTotals;
    บอก(!!mt, `③ ${ชื่อ}: มี \`mirrorTotals\``);
    if (mt) บอก("byStatus" in mt, `③.1 ${ชื่อ}: มี \`byStatus\` (ทั้งร้าน — เท่ากันทุกคำขอ = ถูกต้อง)`);
  }
  /* ④ byStatusFiltered ต้อง **ต่าง** เมื่อ total ต่าง — ตัวนี้คือหัวใจของเกณฑ์ */
  const a = เปล่า.j?.mirrorTotals?.byStatusFiltered;
  const b = ช่วง.j?.mirrorTotals?.byStatusFiltered;
  const totalต่าง = เปล่า.j?.total !== ช่วง.j?.total;
  if (a && b && totalต่าง) {
    บอก(JSON.stringify(a) !== JSON.stringify(b),
      `④ \`byStatusFiltered\` ต่างกันเมื่อ total ต่าง (${เปล่า.j?.total} vs ${ช่วง.j?.total})`);
  } else {
    console.log(`⚠️ ④ ตัดสินไม่ได้ — ${!a || !b ? "ยังไม่มี `byStatusFiltered`" : "total เท่ากันสองคำขอ"} · **ไม่ใช่ว่าผ่าน**`);
  }
}

console.log(ตก ? `\n🛑 ไม่ผ่าน ${ตก} ข้อ` : "\n✅ ผ่านทุกข้อที่ตัดสินได้");
process.exit(ตก ? 1 : 0);
