#!/usr/bin/env node
/* ดึง "สารบัญของท่อ" มาเก็บเป็นไฟล์ในเรโปนี้ — เพื่อให้ด่านเทียบจอกับท่อ **วิ่งได้ทุกเครื่อง**
 *
 * 🔴 **ที่มา 19 ก.ย. 2569** — ด่านสามตัว (`check-pipe-keys` · `check-pipe-params` · `check-cron-table`)
 *    อ่านซอร์สจาก `../gucut-web` โดยตรง ⇒ **บนเครื่อง build ของ Netlify ไม่มีเรโปนั้น**
 *    ⇒ ทั้งสามตัว **ข้ามตัวเองทุกครั้งที่ build จริง** · มันประกาศออกมาว่า "ยังไม่ได้ตรวจ"
 *      แต่พูดใน log ที่ไม่มีใครอ่าน ⇒ **เท่ากับไม่มีด่าน**
 *    🔑 กฎที่ได้: **ด่านที่ต้องพึ่งเรโปอีกฝั่ง จะกลายเป็นด่านของเครื่องคนเดียวโดยอัตโนมัติ**
 *
 * ⚠️⚠️ **เงื่อนไขสามข้อที่ CEO ตั้งไว้ก่อนอนุญาตให้ใช้ snapshot** (ห้ามลบข้อไหน)
 *   ① snapshot **ไม่ใช่แหล่งความจริง** เป็น "ค่าที่เคยเห็นเมื่อวันที่ …"
 *      ⇒ ด่านต้องบอกทุกครั้งที่รันว่าเทียบกับ snapshot **ของวันไหน** ไม่ใช่เฉพาะตอนแดง
 *   ② เก่าเกินเกณฑ์ ⇒ **เตือน ไม่ใช่ fail** (ด่านที่ fail เพราะ snapshot เก่า จะถูกปิดทิ้งในวันที่คนรีบ)
 *      ⇒ เลขเกณฑ์อยู่ **ในไฟล์ snapshot เอง** (`เตือนเมื่อเกินวัน`) ไม่ใช่ในตัวด่าน
 *        (เกณฑ์เดียวกันต้องมีแหล่งเดียว — อยู่ในด่านเมื่อไหร่ วันหนึ่งจะมีสองเลข)
 *   ③ 🔴 **ห้ามให้ snapshot เป็นหลักฐานว่า "จอใช้ของท่อครบแล้ว"**
 *      มันบอกได้แค่ว่า *ตอนนั้น* ท่อมีอะไร ⇒ ท่อเพิ่มของใหม่แล้ว snapshot เก่า ⇒ ด่านเขียวทั้งที่มีของใหม่
 *      ⇒ ด่านต้องเขียนว่า **"ตรวจเท่าที่ snapshot รู้"** ไม่ใช่ "ครบ"
 *
 * 🔑 เก็บ **สองเวลา** ไว้ด้วยกันเสมอ เพราะเป็นคนละปัญหาและคนละคนแก้:
 *    · `ดึงเมื่อ`     = เราไม่ได้ดึงนานแค่ไหน  (ฝั่งจอแก้: รันสคริปต์นี้)
 *    · `ท่อสร้างเมื่อ` = ท่อเองไม่ได้ deploy นานแค่ไหน (ฝั่งท่อแก้)
 *
 * วิธีใช้:  node scripts/ดึงสารบัญท่อ.mjs      (ต้องมี GUCUT_WEB_ADMIN_KEY ใน .env.local)
 * 🚫 **ไม่อยู่ใน prebuild** — ต้องยิงเน็ต · build ที่ล้มเพราะเน็ตไม่ใช่ build ที่บอกอะไรเรื่องโค้ด
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "lib/pipe-snapshot.json");

/** อ่านคีย์จาก .env.local แบบไม่พึ่งไลบรารี (ไฟล์นี้ไม่เข้าเรโป) */
function คีย์() {
  if (process.env.GUCUT_WEB_ADMIN_KEY) return process.env.GUCUT_WEB_ADMIN_KEY;
  const f = join(ROOT, ".env.local");
  if (!existsSync(f)) return null;
  const m = readFileSync(f, "utf8").match(/^GUCUT_WEB_ADMIN_KEY=(.*)$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

const key = คีย์();
if (!key) {
  console.error("🛑 ไม่มี GUCUT_WEB_ADMIN_KEY ⇒ ดึงสารบัญไม่ได้ · **ไม่เขียนไฟล์ทับของเดิม**");
  process.exit(1);
}

/** เส้นที่ดึงมาเก็บ — เพิ่มได้ แต่ **ห้ามเงียบเมื่อดึงไม่ได้** (ดูด้านล่าง) */
const เส้น = [
  ["endpoints", "https://gucut.com/api/core?endpoints=1"],
  ["crontable", "https://gucut.com/api/core?crontable=1"],
];

const ผล = {};
for (const [ชื่อ, url] of เส้น) {
  const r = await fetch(url, { headers: { "x-admin-key": key } });
  const j = await r.json().catch(() => null);
  /* 🔴 ดึงไม่ได้แม้เส้นเดียว ⇒ **ออกโดยไม่เขียนไฟล์** — snapshot ที่ขาดบางเส้น
     จะทำให้ด่านที่อ่านมัน "ผ่านเพราะไม่มีของให้เทียบ" ซึ่งคือคลาสที่เรากำลังแก้อยู่พอดี */
  if (!r.ok || !j || j.error || j.fallthrough === true) {
    console.error(`🛑 ดึง ${ชื่อ} ไม่สำเร็จ (HTTP ${r.status}${j?.fallthrough ? " · fallthrough = ท่อยังไม่มีเส้นนี้" : ""})`);
    console.error("   ⇒ ไม่เขียนไฟล์ทับของเดิม (snapshot ที่ขาดเส้น = ด่านผ่านเพราะไม่มีของให้เทียบ)");
    process.exit(1);
  }
  ผล[ชื่อ] = j;
}

const เดิม = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const ไฟล์ = {
  หมายเหตุ: "สำเนาสารบัญของท่อ — **ไม่ใช่แหล่งความจริง** เป็นค่าที่เคยเห็นเมื่อวันที่ระบุ · สร้างด้วย scripts/ดึงสารบัญท่อ.mjs",
  ดึงเมื่อ: new Date().toISOString(),
  ท่อสร้างเมื่อ: ผล.endpoints?.generatedAt ?? null,
  /* เกณฑ์อยู่ในไฟล์นี้ที่เดียว — ด่านอ่านจากตรงนี้ ห้ามพิมพ์เลขซ้ำในด่าน */
  เตือนเมื่อเกินวัน: เดิม?.เตือนเมื่อเกินวัน ?? 7,
  ...ผล,
};
writeFileSync(OUT, JSON.stringify(ไฟล์, null, 2) + "\n");

console.log(
  `เก็บสารบัญท่อแล้ว → lib/pipe-snapshot.json\n` +
    `   ดึงเมื่อ ${ไฟล์.ดึงเมื่อ} · ท่อสร้างเมื่อ ${ไฟล์.ท่อสร้างเมื่อ ?? "(ท่อไม่ได้บอก)"}\n` +
    `   เส้นที่เก็บ: ${Object.keys(ผล).join(" · ")} · เตือนเมื่อเกิน ${ไฟล์.เตือนเมื่อเกินวัน} วัน`
);
