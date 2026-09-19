// ตัวจับ "promise ปล่อยลอย" ในโค้ดฝั่งเซิร์ฟเวอร์ — รันทุกครั้งก่อน build
//
// ---------------------------------------------------------------------------
// ทำไมต้องมี (เจ้าของร้านสั่ง "หาทางแก้ไขป้องกันไม่ให้เกิดซ้ำ" + "กันเหนียว" 28 ส.ค. 2569)
//
// Netlify แช่แข็งฟังก์ชันทันทีที่ตอบคำขอเสร็จ — งานที่ยิงทิ้งไว้โดยไม่ await
// จะตายกลางทางแบบ "ไม่มี error ให้เห็น" บักตระกูลนี้กัดเรามาแล้ว 3 ครั้ง:
//   1. รูปสแกนบัตรไม่ถูกเก็บสักใบ (keepScan — 27 ส.ค.)
//   2. แคชสต็อก ZORT ค้าง 5 วัน หน้าสถานะฟ้อง "สต็อกเก่า 8,213 นาที" (28 ส.ค.)
//   3. เกือบพลาดซ้ำตอนทำลิงก์สั้น ลซ.1 (จับได้เพราะจำบทเรียนข้อ 1 ได้)
// จดใน CLAUDE.md แล้วก็ยังหลุด เพราะคนเขียน (AI) ไม่ได้อ่านทุกบรรทัดทุกรอบ
// ⇒ ต้องเป็นเครื่องตรวจที่ "ตกแล้ว build ไม่ผ่าน" เท่านั้นถึงจะกันได้จริง
//
// กติกาที่ตรวจ (เฉพาะ netlify/functions + netlify/lib):
//   คำสั่งลอย ๆ (ExpressionStatement) ที่เป็นการเรียกงานค้างคา ถือว่าผิด:
//   - X.set(...) / X.setJSON(...) / X.delete(...)   ← เขียน Blobs
//   - fetch(...)                                     ← ยิงเครือข่าย
//   - อะไรก็ตามที่จบด้วย .catch(...) เป็น statement   ← ท่าปล่อยลอยคลาสสิก
//   - void อะไรก็ตาม(...)                            ← ปล่อยลอยแบบตั้งใจ ซึ่งบนเซิร์ฟเวอร์ = ตาย
//   ที่ "ไม่ผิด": await แล้ว · ผูกกับตัวแปร (เอาไปฝาก waitUntil ต่อ) · context.waitUntil(...)
//
//   จำเป็นต้องปล่อยลอยจริง ๆ (รู้ว่าเสี่ยงและยอม) ให้เขียนคอมเมนต์
//   "ปล่อยลอย-ตั้งใจ" ไว้บรรทัดเดียวกันหรือบรรทัดบน — ตัวตรวจจะข้ามให้
//
// edge-functions ไม่ตรวจ — นโยบายที่นั่นกลับด้าน (ห้าม await ถ่วงบอต ดู ai-bots.js)
// ---------------------------------------------------------------------------

import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

/* 🔴 **ย้ายมาจากรีโปฝั่งท่อ 19 ก.ย. 2569 — และ ROOTS คือสิ่งแรกที่ต้องแก้**
   ฝั่งท่อกำชับมาพร้อมไฟล์ว่า: *"ก๊อปไปวางแล้วรันตรง ๆ = มันจะไม่เจอไฟล์ไหนเลย
   แล้วขึ้นเขียวตลอดกาล"* เพราะของเดิมสแกนเฉพาะ `netlify/**` ซึ่งรีโปนี้ไม่มี
   ⇒ นั่นคือ "ด่านที่เขียวเพราะไม่ได้ตรวจอะไร" ซึ่งอันตรายกว่าไม่มีด่าน
   ⇒ (และผมเพิ่งเจอรูปนี้ตัวเป็น ๆ ตอน hook รายงาน MODULE_NOT_FOUND ว่าเป็น promise ลอย)
   📌 โค้ดฝั่งเซิร์ฟเวอร์ของรีโปนี้อยู่ที่ `app/api/**` (route handler) กับ `lib/**` */
const ROOTS = ["app/api", "lib"];
const WRITE_METHODS = new Set(["set", "setJSON", "delete"]);
const SKIP_MARK = "ปล่อยลอย-ตั้งใจ";

/* 🔴 **`lib/` ของรีโปนี้ปนโค้ดเบราว์เซอร์กับโค้ดเซิร์ฟเวอร์** (พบ 19 ก.ย. 2569 รันครั้งแรก)
   ของจริง: `lib/product-menu.ts` เรียก `navigator.clipboard.writeText(...).catch(...)`
   ⇒ ด่านฟ้องว่าเป็น promise ปล่อยลอยบนเซิร์ฟเวอร์ **ซึ่งไม่จริง** — มันทำงานในเบราว์เซอร์
   ⇒ Netlify ไม่ได้แช่แข็งอะไรตรงนั้น กฎทั้งข้อไม่เกี่ยวเลย
   🚫 **ไม่ใช้คอมเมนต์ `ปล่อยลอย-ตั้งใจ` กับกรณีนี้** เพราะนั่นแปลว่า "รู้ว่าเสี่ยงและยอม"
      ซึ่งเป็นคำที่ผิด — มันไม่เสี่ยงตั้งแต่ต้น ⇒ ใช้คำที่ตรงกับความจริงแทน
   ⚠️ แคบโดยตั้งใจ: ข้ามเฉพาะบรรทัดที่แตะ API ที่ **มีแต่ในเบราว์เซอร์**
      ถ้ามีคนเขียน `window` ในโค้ดเซิร์ฟเวอร์จริง มันพังตั้งแต่รันอยู่แล้ว ไม่ใช่เรื่องของด่านนี้ */
const เฉพาะเบราว์เซอร์ = /\b(navigator|window|document|localStorage|sessionStorage)\b/;

/* ⚠️ รีโปนี้เขียนเซิร์ฟเวอร์เป็น `.ts` ไม่ใช่ `.mjs` ⇒ รับทั้งสองนามสกุล
   (ของเดิมรับเฉพาะ `.mjs` ⇒ ต่อให้แก้ ROOTS ถูก ก็ยังไม่เจอไฟล์อยู่ดี) */
function* mjsFiles(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== "node_modules") yield* mjsFiles(p); }
    else if (/\.(mjs|ts|tsx)$/.test(f.name)) yield p;
  }
}

/** ชื่อเมธอดท้ายสุดของสายเรียก a.b.c(...) — คืน "" ถ้าไม่ใช่ member call */
function tailMethod(call) {
  return ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : "";
}
/** ตัวรับของเมธอด เช่น s.setJSON → "s" · u.searchParams.set → "searchParams" */
function receiverName(call) {
  if (!ts.isPropertyAccessExpression(call.expression)) return "";
  const r = call.expression.expression;
  if (ts.isIdentifier(r)) return r.text;
  if (ts.isPropertyAccessExpression(r)) return r.name.text;
  return "";
}
// .set/.delete เฉย ๆ เจอทั้งใน Map และ URLSearchParams (ซึ่งเป็นงาน sync ไม่ผิด)
// จึงตีความว่าเป็น Blobs เฉพาะเมื่อตัวรับหน้าตาเป็น store (s, s2, store, xxStore ฯลฯ)
// ส่วน .setJSON มีแต่ Blobs เท่านั้น — จับทุกกรณี
const STORE_LIKE = /^(s\d?|us|store)$|store$/i;
/** ชื่อฟังก์ชันต้นสาย เช่น fetch(...) */
function rootName(call) {
  let e = call.expression;
  while (ts.isPropertyAccessExpression(e)) e = e.expression;
  while (ts.isCallExpression(e)) {
    let inner = e.expression;
    while (ts.isPropertyAccessExpression(inner)) inner = inner.expression;
    e = inner;
  }
  return ts.isIdentifier(e) ? e.text : "";
}

const problems = [];

/* 🔴 **นับไฟล์ที่สแกนได้ และ 0 ต้องเป็นตก ไม่ใช่เขียว** (เงื่อนไข (ข) ที่ฝั่งท่อกำชับ)
   ด่านที่ไม่เจอไฟล์จะพิมพ์ "ไม่มี promise ปล่อยลอย ✓" ซึ่งอ่านว่าปลอดภัย
   ทั้งที่ความจริงคือ **มันไม่ได้ดูอะไรเลย** — เป็นรูปเดียวกับที่รีโปนี้เจอมาแล้วสามตัววันนี้
   (check-ready-badge ตรวจ 0 จอ · check-nav พิมพ์แดงแล้วผ่าน · ด่านรวมไฟล์ใต้เส้นทาง) */
let ไฟล์ที่สแกน = 0;
const ข้ามเบราว์เซอร์ = [];
for (const root of ROOTS) {
  for (const file of mjsFiles(root)) {
    ไฟล์ที่สแกน++;
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split("\n");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);

    const flag = (node, why) => {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
      // คอมเมนต์ยกเว้น — บรรทัดเดียวกันหรือบรรทัดบน
      const cur = lines[line] || "";
      const above = lines[line - 1] || "";
      if (cur.includes(SKIP_MARK) || above.includes(SKIP_MARK)) return;
      /* โค้ดเบราว์เซอร์ไม่อยู่ใต้กฎนี้ — ดูเหตุผลที่ `เฉพาะเบราว์เซอร์` ข้างบน
         นับแยกไว้ด้วย เพื่อให้เห็นว่าข้ามไปกี่จุด **ไม่ใช่ข้ามเงียบ ๆ** */
      if (เฉพาะเบราว์เซอร์.test(cur)) { ข้ามเบราว์เซอร์.push(`${file}:${line + 1}`); return; }
      problems.push(`${file}:${line + 1} — ${why}\n    ${cur.trim().slice(0, 90)}`);
    };

    const visit = (node) => {
      if (ts.isExpressionStatement(node)) {
        let expr = node.expression;
        let isVoid = false;
        if (ts.isVoidExpression(expr)) { isVoid = true; expr = expr.expression; }
        if (ts.isCallExpression(expr)) {
          const tail = tailMethod(expr);
          const rootFn = rootName(expr);
          const recv = receiverName(expr);
          const blobsWrite = tail === "setJSON" || (WRITE_METHODS.has(tail) && STORE_LIKE.test(recv));
          if (tail === "waitUntil") { /* ฝากถูกวิธีแล้ว */ }
          else if (blobsWrite) flag(node, `เขียน Blobs (.${tail}) โดยไม่ await — Netlify ฆ่าทิ้งก่อนเสร็จ`);
          else if (rootFn === "fetch") flag(node, "fetch โดยไม่ await — ตายกลางทางแบบเงียบ");
          else if (tail === "catch") flag(node, "ปล่อย promise ลอยจบด้วย .catch — ต้อง await หรือฝาก waitUntil");
          else if (isVoid) flag(node, "void ปล่อยลอยบนเซิร์ฟเวอร์ — ต้อง await หรือฝาก waitUntil");
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
}

console.log(`check-floating: สแกน ${ไฟล์ที่สแกน} ไฟล์ใน ${ROOTS.join(" · ")}`);
if (ข้ามเบราว์เซอร์.length) {
  console.log(`   ข้าม ${ข้ามเบราว์เซอร์.length} จุดที่เป็นโค้ดเบราว์เซอร์ (navigator/window/…) — กฎนี้ไม่เกี่ยวกับที่นั่น`);
  for (const x of ข้ามเบราว์เซอร์) console.log(`     · ${x}`);
}
if (ไฟล์ที่สแกน === 0) {
  console.error("🛑 สแกนได้ 0 ไฟล์ — **ตัวอ่านพัง หรือ ROOTS ผิด** ไม่ใช่ว่าโค้ดสะอาด");
  console.error(`   ROOTS ที่ตั้งไว้: ${ROOTS.join(" · ")} · ถ้าย้ายโฟลเดอร์แล้วต้องแก้ที่หัวไฟล์นี้`);
  process.exit(1);
}
if (problems.length) {
  console.error("✗ พบ promise ปล่อยลอยในโค้ดเซิร์ฟเวอร์ — Netlify จะฆ่างานพวกนี้ทิ้งกลางทาง:\n");
  for (const p of problems) console.error("  " + p + "\n");
  console.error(`รวม ${problems.length} จุด · แก้ด้วยการ await หรือฝาก context.waitUntil`);
  console.error(`ถ้าจำเป็นต้องปล่อยลอยจริง ๆ ให้คอมเมนต์ "${SKIP_MARK}" กำกับบรรทัดนั้น`);
  process.exit(1);
}
console.log("check-floating: โค้ดเซิร์ฟเวอร์ไม่มี promise ปล่อยลอย ✓");
