// อ่านสถาปัตยกรรม "ฝั่งหลังร้าน" (admin.gucut.com) จากซอร์สจริง แล้วเขียนลง lib/arch-admin.ts
// รันตอน prebuild ⇒ กล่องขวาในหน้า /core/arch อัปเดตเองทุกครั้งที่ deploy
//
// เป็นฝาแฝดของ scripts/gen-arch.mjs ใน repo gucut-web (ฝั่งหน้าร้าน)
// ฝั่งโน้นส่งข้อมูลผ่าน API เพราะเป็นคนละโดเมน · ฝั่งนี้อยู่ repo เดียวกับหน้าจอ
// จึงไม่ต้องมี API — หน้าจอ import ไฟล์ที่สร้างไว้ตอน build ได้ตรง ๆ
//
// ⚠️ **ห้ามพิมพ์ตัวเลขลงหน้าเว็บด้วยมือ** — ตัวเลขที่ไม่มีใครตรวจคือตัวเลขที่จะผิด
//    โดยไม่มีใครรู้ · หน้านี้มีไว้กำจัดปัญหานั้น อย่าสร้างปัญหาเดิมขึ้นมาใหม่ในหน้าเดียวกัน
//
// ⚠️ ห้ามทำให้ build ตก **เพราะอ่านไฟล์ย่อยไม่ได้** — ใส่ค่าว่างแล้วให้หน้าจอบอกว่า "ไม่ทราบ"
//    (จอ /core/arch เขียน "ไม่ทราบ" เมื่อรายการว่างจริง — ตรวจแล้ว 20 ก.ย. 2569)
//
// 🔑 **แต่ "ตัวสร้าง" กับ "ตัวตรวจ" รับมือข้อมูลไม่ครบคนละแบบ** (20 ก.ย. 2569 · ยกมาจากฝั่งท่อ)
//    ตัวตรวจไม่ครบ ⇒ เตือนแล้วไปต่อได้ · **ตัวสร้างไม่ครบ ⇒ อาจต้องหยุด**
//    เพราะปลายทางจะอ่านผลลัพธ์ที่ขาดไปนั้น **เป็นความจริง**
//    ⚠️ เกณฑ์ตัดสินว่าอันไหน (ฝั่งท่อเพิ่มให้ และผมรับ): **"ถ้าไฟล์นี้ขาดของไป ใครจะรู้"**
//       · มีคนรู้ทันที ⇒ เตือนพอ — ตัวเลขบนจอ /core/arch (จอมีทางถอยของตัวเอง: "ไม่ทราบ")
//       · **ไม่มีใครรู้ ⇒ หยุด** — `window.ALL_ROUTES` ในตัวกวาด: ว่างแล้ว `sweep()` จะกวาด
//         **0 จอ แล้วรายงานว่าไม่พบปัญหา** ⇒ ผลว่างอ่านเหมือนผลสำเร็จ (ดูด่านพื้นข้างล่าง)
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from 'node:url'
import { join, dirname } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));

/* 🔑 **`catch` ที่คืน "ไม่รู้" ต้องแนบเหตุ** (กติการ่วม 20 ก.ย. 2569 · ฝั่งท่อเสนอ ผมรับ)
   ของจริงฝั่งท่อ: เขาลืม `import { readFileSync }` ⇒ `catch` กลืนเป็น "อ่าน package.json ไม่ได้"
   ซึ่ง **หน้าตาเหมือนสถานะที่ถูกต้อง** (ไฟล์อาจไม่มีจริงก็ได้) ⇒ บั๊กซ่อนใต้ทางถอยได้ตลอดไป
   ⇒ ที่นี่เก็บเหตุทุกครั้งแล้วพิมพ์ท้ายรอบ: "ไม่รู้เพราะไม่มีของ" ต้องอ่านไม่เหมือน
     "ไม่รู้เพราะโค้ดเราพัง" */
const อ่านไม่ได้ = [];
const read = (p) => {
  try {
    return readFileSync(join(root, p), "utf8");
  } catch (e) {
    อ่านไม่ได้.push(`read(${p}) → ${String(e?.code ?? e?.message ?? e).slice(0, 60)}`);
    return "";
  }
};
const list = (p) => {
  try {
    return readdirSync(join(root, p), { withFileTypes: true });
  } catch (e) {
    อ่านไม่ได้.push(`list(${p}) → ${String(e?.code ?? e?.message ?? e).slice(0, 60)}`);
    return [];
  }
};

/** เดินทั้งต้นไม้ เก็บไฟล์ที่ชื่อตรงกับที่ขอ — คืนเส้นทางแบบสัมพัทธ์ */
function walk(dir, want, out = [], depth = 0) {
  if (depth > 12) return out; // กันเดินวนลึกผิดปกติ
  for (const e of list(dir)) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, want, out, depth + 1);
    else if (e.name === want) out.push(rel);
  }
  return out;
}

/* ── เส้นทาง API ของหลังร้าน ─────────────────────────────────── */
const apiRoutes = walk("app/api", "route.ts")
  .map((p) => p.replace(/^app\/api\//, "").replace(/\/route\.ts$/, ""))
  .sort();

/* ── หน้าจอ ───────────────────────────────────────────────────── */
const pageFiles = walk("app", "page.tsx");
const pages = pageFiles.map((p) => p.replace(/^app/, "").replace(/\/page\.tsx$/, "") || "/").sort();
const corePages = pages.filter((p) => p.startsWith("/core"));
/* เส้นทางที่ "เปิดตรง ๆ ได้" — ตัดหน้าที่มีช่องแปรใน URL ออก (เปิดโดยไม่มีค่าจริงไม่ได้)
   ใช้เป็นรายชื่อให้ตัวกวาดจอ ⇒ ดูหมายเหตุที่ท้ายไฟล์นี้ */
const sweepRoutes = pages.filter((p) => !p.includes("["));

/* ── ปุ่มส่งจริง: จอไหนเปิดแล้ว จอไหนยังปิด ──────────────────────
   🔴 **ที่มา 18 ก.ย. 2569** — เอกสารเทียบเมนูเขียนว่า "ปุ่มส่งจริงยังปิด" อยู่ 3 จุด
      ทั้งที่ท่านประธานสั่งเปิดไปแล้ว 4 จอ · คอมเมนต์ในโค้ดเองก็ค้างอีกจุด
      ⇒ คลาสเดียวกับ "คำกล่าวอ้างหมดอายุ": ไม่มีใครโกหก แค่ไม่มีใครไล่แก้ทุกที่ที่เคยเขียน
   ⇒ ให้ **โค้ดเป็นคนตอบ** ว่าใบไหนเปิด ไม่ใช่ความจำของคนเขียนเอกสาร
   ⚠️ จอที่ไม่มีตัวแปรนี้ = จอที่ไม่ได้เขียนข้อมูลออกนอกระบบ ⇒ ไม่นับ ไม่ใช่ "ปิด"
      (ไม่รู้ ≠ ปิด — ถ้านับเป็นปิด เลข "ยังปิด" จะพองด้วยจอที่ไม่เกี่ยวเลย) */
const realSend = pageFiles
  .map((f) => {
    const m = read(f).match(/const\s+REAL_SEND_ENABLED\s*=\s*(true|false)\b/);
    if (!m) return null;
    return { path: f.replace(/^app/, "").replace(/\/page\.tsx$/, ""), open: m[1] === "true" };
  })
  .filter(Boolean)
  .sort((a, b) => a.path.localeCompare(b.path));

/* ── ถังเก็บข้อมูลของฝั่งนี้ (คนละชุดกับหน้าร้าน) ───────────────── */
const sources = [...walk("app", "route.ts"), ...walk("app", "page.tsx"), ...list("lib").map((e) => `lib/${e.name}`)]
  .filter((p) => p.endsWith(".ts") || p.endsWith(".tsx"))
  .map(read)
  .join("\n");

const blobs = [
  ...new Set(
    [...sources.matchAll(/getStore\(\s*(?:\{\s*name:\s*)?['"]([a-z0-9-]+)['"]/g)].map((m) => m[1])
  ),
].sort();

/* ── ท่อกลางไปหน้าร้าน — รายชื่อเส้นทางที่อนุญาต ────────────────
   ⚠️ ตัวเลขนี้สำคัญกว่าที่คิด: เพิ่มฟีเจอร์ใหม่แล้วลืมเติมชื่อลงรายการนี้
      = จอขึ้น 403 โดยไม่มีอะไรบอกว่าเพราะอะไร ⇒ ต้องเห็นได้จากผัง         */
const pipeSrc = read("app/api/web/[...path]/route.ts");
const allowMatch = pipeSrc.match(/const ALLOW = new Set\(\[([^\]]*)\]/);
const pipeAllow = allowMatch
  ? [...allowMatch[1].matchAll(/['"]([a-z0-9-]+)['"]/g)].map((m) => m[1]).sort()
  : [];

/* ── ของนอกบ้านที่ฝั่งนี้เรียกเอง ────────────────────────────────
   ⚠️ **ต้องจับ env ให้ครบสามท่า** — ฝั่งหน้าร้านเคยพลาดเพราะจับแค่ `process.env.X`
      แล้ว ZORT หายทั้งเจ้า (โค้ดเขียน `const { ZORT_STORENAME } = process.env`)
      ผังขึ้นว่า "ยังไม่ได้ต่อ" ทั้งที่ต่ออยู่ ⇒ อันตรายกว่าไม่มีผัง
      ฝั่งนี้ก็มีท่าเดียวกัน: GOOGLE_CLIENT_SECRET โผล่เฉพาะแบบแยกตัวแปร      */
const envUsed = new Set();
for (const m of sources.matchAll(/process\.env\.([A-Z0-9_]+)/g)) envUsed.add(m[1]);
for (const m of sources.matchAll(/const\s*\{([^}]+)\}\s*=\s*process\.env/g)) {
  for (const part of m[1].split(",")) {
    const name = part.split(":")[0].trim();
    if (/^[A-Z0-9_]+$/.test(name)) envUsed.add(name);
  }
}
for (const m of sources.matchAll(/process\.env\[\s*['"]([A-Z0-9_]+)['"]\s*\]/g)) envUsed.add(m[1]);

const LABELS = [
  { id: "zort1", name: "ZORT ร้านหลัก", what: "ออเดอร์ · สต็อก · สินค้า", envs: ["ZORT_STORENAME_1", "ZORT_APIKEY_1"] },
  { id: "zort2", name: "ZORT ร้านสาขา", what: "บัญชีที่สอง (ceojet)", envs: ["ZORT_STORENAME_2", "ZORT_APIKEY_2"] },
  { id: "pipe", name: "ท่อกลางไปหน้าร้าน", what: "เรียก gucut.com/api/* ด้วยรหัสของตัวเอง", envs: ["GUCUT_WEB_ADMIN_KEY", "GUCUT_SITE_URL"] },
  { id: "telegram", name: "Telegram", what: "แจ้งเตือน + รับปุ่มอนุมัติ (webhook)", envs: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"] },
  { id: "google", name: "Google (Gmail/ไดรฟ์)", what: "เช็คเมลอนุมัติจากมาร์เก็ตเพลส", envs: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  { id: "ai", name: "ผู้ช่วย AI", what: "งานอ่าน/สรุปในหลังร้าน", envs: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY"] },
  { id: "rokid", name: "สะพานแว่น Rokid", what: "ต่อแว่นเข้ากับหลังร้าน", envs: ["ROKID_BRIDGE_KEY"] },
  { id: "shopify", name: "Shopify (ของเก่า)", what: "เหลือค้างจากตอนยังใช้ Shopify", envs: ["SHOPIFY_ADMIN_TOKEN", "SHOPIFY_STORE_DOMAIN"] },
];

const integrations = LABELS.map((l) => ({
  ...l,
  inCode: l.envs.some((e) => envUsed.has(e)),
}));

// ตัวแปรที่ยังไม่ได้จัดหมวด — ต้องโผล่บนหน้าจอ ห้ามซ่อน
// (รหัสผ่านเข้าหลังร้านไม่ใช่ "ของนอกบ้าน" จึงไม่นับ)
const known = new Set(LABELS.flatMap((l) => l.envs));
const familiar = LABELS.map((l) => `^(${l.envs.map((e) => e.split("_")[0]).join("|")})_`);
const IGNORE = /^(NEXT_PUBLIC_|NODE_|VERCEL_|SITE_PASSWORD$|STAFF_PASSWORD$|GUCUT_ADMIN_KEY$|DRIVESYNC_SECRET$)/;
const unlabelled = [...envUsed]
  .filter((e) => !known.has(e) && !IGNORE.test(e) && !familiar.some((p) => new RegExp(p).test(e)))
  .sort();

const data = {
  generatedAt: new Date().toISOString(),
  site: "admin.gucut.com",
  project: "gucut-admin",
  repo: "gucut-next",
  apiRoutes: { count: apiRoutes.length, names: apiRoutes },
  pages: { count: pages.length, core: corePages.length, coreNames: corePages, names: sweepRoutes },
  blobs,
  pipe: { allow: pipeAllow, count: pipeAllow.length },
  realSend: {
    screens: realSend,
    open: realSend.filter((r) => r.open).length,
    closed: realSend.filter((r) => !r.open).length,
  },
  integrations,
  unlabelled,
};

/* ── 🔒 ด่านพื้น: **หยุดก่อนเขียน** ถ้าชุดข้อมูลว่างผิดปกติ ───────────────
   (20 ก.ย. 2569 · เกณฑ์ "ตัวสร้างไม่ครบต้องหยุด" + คำถาม "ถ้าขาดของไป ใครจะรู้")

   🔴 ของที่กลัว: `list()` ล้ม (สิทธิ์ · โฟลเดอร์ถูกย้าย · รันจากที่ผิด) ⇒ `walk` คืน `[]`
      ⇒ `window.ALL_ROUTES = []` ⇒ `await sweep(ALL_ROUTES)` กวาด **0 จอ**
      แล้วพิมพ์ว่าไม่พบปัญหา ⇒ **ผลว่างอ่านเหมือนผลสำเร็จ** และไม่มีใครในสายนี้จะรู้
      (ตัวกวาดไม่มีพื้นของตัวเอง — ตรวจแล้ว 20 ก.ย. 2569)
   🔑 ต่างจากด่านอ่านกลับข้างล่าง: ด่านนั้นถาม "เขียนแล้วอ่านกลับได้ของเดิมไหม"
      ซึ่ง **ผ่านสบายเมื่อของเดิมคือรายการว่าง** ⇒ ต้องมีด่านที่ถามว่า "ของเดิมสมเหตุสมผลไหม"
   ⚠️ เลขพื้นตั้งต่ำกว่าของจริงมาก (**วัดตอนตั้ง 20 ก.ย. 2569: จอ 119 · API 48 · กวาดได้ 113**
      — เลขนี้มาจาก `--self-test` ไม่ใช่จากความจำ · ตอนแรกผมพิมพ์ "API 60+" ลงคอมเมนต์นี้เอง
      ทั้งที่ของจริง 48 ⇒ **คำกล่าวอ้างเท็จเกิดในไฟล์ที่เพิ่งเขียนขึ้นมากันคำกล่าวอ้างเท็จ**)
      — ตั้งไว้จับ "พังจนว่าง"
      ไม่ได้ตั้งไว้จับ "ลดลงหนึ่งจอ" (นั่นเป็นเรื่องปกติของการลบจอ) */
function ตรวจพื้น({ pages: ป, apiRoutes: ส, sweepRoutes: ก }) {
  const ผิด = [];
  if (ป.length < 50) ผิด.push(`นับจอได้ ${ป.length} จอ (พื้น 50) — น่าจะเดินโฟลเดอร์ app ไม่ได้`);
  if (ส.length < 20) ผิด.push(`นับเส้น API ได้ ${ส.length} เส้น (พื้น 20) — น่าจะเดิน app/api ไม่ได้`);
  if (ก.length === 0) ผิด.push("รายชื่อจอให้ตัวกวาดว่างเปล่า — ตัวกวาดจะกวาด 0 จอแล้วรายงานว่าผ่าน");
  return ผิด;
}
if (process.argv.includes("--self-test")) {
  /* 🧪 พิสูจน์ว่าด่านพื้นร้องจริง **โดยไม่เขียนไฟล์ใด ๆ** (ออกก่อนถึง writeFileSync ทุกจุด) */
  const ว่าง = ตรวจพื้น({ pages: [], apiRoutes: [], sweepRoutes: [] });
  const จริง = ตรวจพื้น({ pages, apiRoutes, sweepRoutes });
  console.log(`🧪 ป้อนชุดว่าง ⇒ ร้อง ${ว่าง.length} ข้อ (ต้อง 3) · ป้อนของจริง ⇒ ร้อง ${จริง.length} ข้อ (ต้อง 0)`);
  console.log(`   ของจริงรอบนี้: จอ ${pages.length} · API ${apiRoutes.length} · จอที่กวาดได้ ${sweepRoutes.length}`);
  if (ว่าง.length !== 3 || จริง.length !== 0) {
    console.error("🔴 ด่านพื้นแยกแยะไม่ได้ ⇒ ตะแกรงพัง");
    process.exit(1);
  }
  console.log("✅ ด่านพื้นแยกแยะได้ทั้งสองทาง · **ไม่เขียนไฟล์ใด ๆ ในโหมดนี้**");
  process.exit(0);
}
const พื้นผิด = ตรวจพื้น({ pages, apiRoutes, sweepRoutes });
if (พื้นผิด.length) {
  console.error("🔴 gen-arch: **หยุดก่อนเขียน** — ชุดข้อมูลว่างผิดปกติ ⇒ ของที่เขียนออกไปจะถูกอ่านเป็นความจริง");
  for (const x of พื้นผิด) console.error("   " + x);
  if (อ่านไม่ได้.length) {
    console.error("   เหตุที่อ่านไม่ได้ (เก็บไว้ตอน catch):");
    for (const x of อ่านไม่ได้) console.error("      " + x);
  } else {
    console.error("   ⚠️ ไม่มี catch ตัวไหนล้มเลย ⇒ ว่างเพราะ **ของไม่มีจริง** ไม่ใช่เพราะอ่านไม่ได้");
  }
  process.exit(1);
}

const out = join(root, "lib/arch-admin.ts");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `// สร้างอัตโนมัติโดย scripts/gen-arch.mjs ตอน build — **ห้ามแก้ด้วยมือ**\n` +
    `// แก้ที่นี่จะถูกเขียนทับรอบหน้า และทำให้ผังในหน้า /core/arch โกหกจนกว่าจะมีคนสังเกต\n` +
    `export const ARCH_ADMIN = ${JSON.stringify(data, null, 2)} as const;\n`
);

/* ── รายชื่อจอในตัวกวาด: เขียนทับให้ตอน build ────────────────────
   🔴 **ที่มา 18 ก.ย. 2569** — `scripts/sweep-in-browser.js` มีรายชื่อจอที่คน**พิมพ์มือ**
      วันที่ไปเทียบกับของจริง **ขาดไป 28 จอ** (รวมจอที่มีปุ่มส่งจริง เช่น `/core/sales/new`
      `/core/stock-push` `/core/settings-roles`) ⇒ กวาดแล้วเขียว แต่**ไม่เคยเปิดจอพวกนั้นเลย**
      = ผลว่างของเครื่องมือที่มองไม่เห็นของที่ต้องตรวจ · คลาสเดียวกับด่านที่ตรวจ 0 ไฟล์แล้วบอกว่าผ่าน
   🔑 ตรงกับกฎที่ทีมเขียนเองวันเดียวกัน: **รายชื่อที่คนเติมมือจะล้าสมัยเสมอ**
      ⇒ ให้ตัวสแกนตอน build เป็นคนตอบว่า "จอมีอะไรบ้าง" ไม่ใช่ความจำของคนเขียน
   ⚠️ ห้ามแก้บรรทัด `window.ALL_ROUTES` ในไฟล์นั้นด้วยมือ — จะถูกเขียนทับรอบหน้า */
const sweepFile = join(root, "scripts/sweep-in-browser.js");
const sweepSrc = readFileSync(sweepFile, "utf8");
const sweepLine = `window.ALL_ROUTES = ${JSON.stringify(sweepRoutes)}`;
/* 🕳️ **ให้เครื่องมือประกาศจุดบอดของตัวเอง** — จอที่มีช่องแปรใน URL เปิดเปล่า ๆ ไม่ได้
   ⇒ ไม่อยู่ใน ALL_ROUTES · ถ้าไม่เขียนไว้ คนจะอ่านรายชื่อนั้นว่า "จอทั้งหมด"
   (CEO ตั้งคำถามนี้ 18 ก.ย. 2569: เปลี่ยนเป็นสร้างอัตโนมัติ แก้ "ล้าสมัย" แต่ไม่แก้ "ครอบไม่ครบ") */
const blindRoutes = pages.filter((p) => p.includes("["));
const blindLine = `window.ROUTES_NOT_SWEPT = ${JSON.stringify(blindRoutes)}`;
/* 🔴 ของจริง 19 ก.ย. 2569 — รูปเดิมคือ `\[[^\]]*\]` ซึ่งหยุดที่ `]` **ตัวแรก**
   และ `ROUTES_NOT_SWEPT` คือรายชื่อ **พาธที่มีช่องแปร** ⇒ ข้างในมี `[vendor]` เสมอ
   ⇒ แทนที่ได้แค่ครึ่งบรรทัด ของเก่าค้างท้าย ⇒ **บรรทัดงอกทุกรอบที่ build** จน 21,427 ตัวอักษร
   🔑 ด่านข้างล่างเดิมถาม "หาบรรทัดเจอไหม" ซึ่งเจอทุกรอบ ⇒ **คำถามอ่อนเกินไป**
      ของที่ต้องถามคือ "เขียนแล้วอ่านกลับได้ของเดิมไหม" ⇒ เพิ่มเป็นด่านที่สองด้านล่าง
   ⚠️ พังเงียบสนิท: ไฟล์ยังรันได้ ค่าตัวแปรยังถูก (ประกาศทับกันในบรรทัดเดียว) */
const เป้า = [
  ["window.ALL_ROUTES", /^window\.ALL_ROUTES = .*$/m, sweepLine, sweepRoutes],
  ["window.ROUTES_NOT_SWEPT", /^window\.ROUTES_NOT_SWEPT = .*$/m, blindLine, blindRoutes],
];
for (const [ชื่อ, รูป] of เป้า) {
  if (!รูป.test(sweepSrc)) {
    throw new Error(`gen-arch: หาบรรทัด ${ชื่อ} ในตัวกวาดไม่เจอ ⇒ ไม่เขียนทับ (อย่าปล่อยให้เงียบ)`);
  }
}
let sweepNext = sweepSrc;
for (const [, รูป, บรรทัด] of เป้า) sweepNext = sweepNext.replace(รูป, บรรทัด);
/* ด่านที่สอง: **อ่านของที่เพิ่งเขียนกลับมาแปลงเป็นค่า** แล้วเทียบกับต้นฉบับ
   ⇒ จับได้ทั้ง "แทนที่ไม่ครบ" และ "เขียนทับผิดบรรทัด" ซึ่งด่านแรกมองไม่เห็นทั้งคู่ */
for (const [ชื่อ, รูป, , ของจริง] of เป้า) {
  const ที่เขียน = sweepNext.match(รูป)?.[0] ?? "";
  let อ่านกลับ;
  try {
    อ่านกลับ = JSON.parse(ที่เขียน.slice(ที่เขียน.indexOf("=") + 1).trim());
  } catch {
    throw new Error(`gen-arch: บรรทัด ${ชื่อ} ที่เขียนออกไป **อ่านกลับเป็นค่าไม่ได้** (ยาว ${ที่เขียน.length} ตัวอักษร) ⇒ แทนที่ไม่ครบ`);
  }
  if (JSON.stringify(อ่านกลับ) !== JSON.stringify(ของจริง)) {
    throw new Error(`gen-arch: บรรทัด ${ชื่อ} อ่านกลับได้ ${อ่านกลับ.length} รายการ แต่ของจริงมี ${ของจริง.length} ⇒ ไม่เขียนทับ`);
  }
}
if (sweepNext !== sweepSrc) writeFileSync(sweepFile, sweepNext);

console.log(
  `gen-arch(หลังร้าน): API ${apiRoutes.length} เส้นทาง · หน้า ${pages.length} (core ${corePages.length}) · ` +
    `รายชื่อจอในตัวกวาด ${sweepRoutes.length}${sweepNext !== sweepSrc ? " (อัปเดต)" : ""} · ` +
    `ถัง ${blobs.length} · ท่อกลางอนุญาต ${pipeAllow.length} · ` +
    `ปุ่มส่งจริง เปิด ${realSend.filter((r) => r.open).length}/${realSend.length} · ` +
    `ของนอกบ้าน ${integrations.filter((i) => i.inCode).length}/${integrations.length}` +
    (unlabelled.length ? ` · ⚠️ ตัวแปรยังไม่จัดหมวด ${unlabelled.length}` : "")
);
/* 🔑 ทางถอยต้องประกาศตัว — ผ่านด่านพื้นแล้วก็ยังอาจมีไฟล์ย่อยอ่านไม่ได้
   ⇒ กลุ่มนี้ **เตือนพอ** ตามเกณฑ์ "ใครจะรู้": จอ /core/arch เขียน "ไม่ทราบ" ให้เองเมื่อรายการว่าง */
if (อ่านไม่ได้.length) {
  console.log(`   ⚠️ อ่านไม่ได้ ${อ่านไม่ได้.length} รายการ — จอจะขึ้นว่า "ไม่ทราบ" ในช่องที่เกี่ยว (ไม่ใช่ 0)`);
  for (const x of อ่านไม่ได้) console.log("      " + x);
}
