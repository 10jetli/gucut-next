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
// ⚠️ ห้ามทำให้ build ตก — อ่านอะไรไม่ได้ให้ใส่ค่าว่าง แล้วปล่อยให้หน้าจอบอกว่าอ่านไม่ได้
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => {
  try {
    return readFileSync(join(root, p), "utf8");
  } catch {
    return "";
  }
};
const list = (p) => {
  try {
    return readdirSync(join(root, p), { withFileTypes: true });
  } catch {
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
  pages: { count: pages.length, core: corePages.length, coreNames: corePages },
  blobs,
  pipe: { allow: pipeAllow, count: pipeAllow.length },
  integrations,
  unlabelled,
};

const out = join(root, "lib/arch-admin.ts");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `// สร้างอัตโนมัติโดย scripts/gen-arch.mjs ตอน build — **ห้ามแก้ด้วยมือ**\n` +
    `// แก้ที่นี่จะถูกเขียนทับรอบหน้า และทำให้ผังในหน้า /core/arch โกหกจนกว่าจะมีคนสังเกต\n` +
    `export const ARCH_ADMIN = ${JSON.stringify(data, null, 2)} as const;\n`
);

console.log(
  `gen-arch(หลังร้าน): API ${apiRoutes.length} เส้นทาง · หน้า ${pages.length} (core ${corePages.length}) · ` +
    `ถัง ${blobs.length} · ท่อกลางอนุญาต ${pipeAllow.length} · ` +
    `ของนอกบ้าน ${integrations.filter((i) => i.inCode).length}/${integrations.length}` +
    (unlabelled.length ? ` · ⚠️ ตัวแปรยังไม่จัดหมวด ${unlabelled.length}` : "")
);
