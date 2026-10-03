#!/usr/bin/env node
/* ด่าน: ห้ามยุบสี่สถานะของ `upstreamOk` / `retryable` เหลือสองด้วย truthiness
 *
 * 🔴 ที่มา: สัญญาร่วมกับฝั่งท่อ ใบ `t_mu1bkrdw` (4 ต.ค. 2569)
 *    ท่อส่ง `upstreamOk` มาครบทุกทางออก และมันมี **สี่สถานะ** (วัดจริง 3 ทาง + ท่อรุ่นเก่า):
 *      true = ถาม ZORT สำเร็จ · false = ถามแล้ว ZORT ล้ม
 *      null = **ยังไม่ได้ถาม ZORT** (คำขอเราถูกตีกลับก่อน) · undefined = ท่อรุ่นเก่าไม่ส่งช่องนี้
 *    ⇒ `!upstreamOk` เป็นจริงกับ **สามในสี่** ⇒ ยุบเหลือสอง ⇒ จอจะโทษ ZORT ตอนที่
 *      ZORT ไม่เคยถูกถาม และจะแนะนำให้รีเฟรชในทางที่รีเฟรชไม่ช่วย
 *    🔑 คลาสเดียวกับที่ปิดไปทั้งคืน 3-4 ต.ค. (B10 · B18 · B19 · B26): "ไม่รู้" ถูกยุบเป็นคำยืนยัน
 *
 * ⚠️ ด่านนี้ตรวจ **รูปแบบการเขียน** ไม่ใช่พฤติกรรม — เพราะพฤติกรรมของการยุบสถานะ
 *    วัดจากข้างนอกไม่ได้ (มันไม่ error มันแค่พูดผิด) ⇒ ต้องดักตอนพิมพ์
 *    ⇒ จึงยอมรับว่าผิดได้สองทิศ: อาจมีท่าที่ถูกแต่ถูกจับ (แก้ด้วยการเขียนให้ชัดขึ้น)
 *      และอาจมีท่าที่ผิดแต่หลุด (เช่นผ่านตัวแปรกลาง) ⇒ ไม่ใช่ตาข่ายสมบูรณ์ แต่ปิดท่าที่พิมพ์ง่ายที่สุด
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ราก = ['app', 'components', 'lib'];
const ช่อง = ['upstreamOk', 'retryable'];

function ไล่ไฟล์(ที่) {
  const out = [];
  for (const ชื่อ of readdirSync(ที่)) {
    const เต็ม = join(ที่, ชื่อ);
    const st = statSync(เต็ม);
    if (st.isDirectory()) out.push(...ไล่ไฟล์(เต็ม));
    else if (/\.(ts|tsx)$/.test(ชื่อ)) out.push(เต็ม);
  }
  return out;
}

/* ตัดคอมเมนต์ออกก่อนตรวจ — ไม่งั้นคำอธิบายของด่านนี้เองจะถูกจับ
   (คลาส "เครื่องมือที่กวาดไฟล์จะเจอตัวเอง" · และ "ตัวเตรียมข้อความที่ด่านใช้ร่วมกัน") */
const ถอดคอมเมนต์ = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/* 🔴 **ด่านย่อยที่ปิดรูที่การปลูกเปิดให้เห็น** (4 ต.ค. 2569)
   ด่านหลักมองหา "ชื่อช่อง" ในบรรทัด ⇒ ถ้าใครดึงค่าไปใส่ตัวแปรชื่อสั้น (`const ok4 = d.upstreamOk`)
   แล้วเขียน `!ok4` **ด่านหลักตาบอดสนิท** — ปลูกพิสูจน์แล้วว่าปล่อยผ่าน
   ⇒ จึงห้าม alias ไปชื่อที่ **ไม่มีคำว่า upstreamOk/retryable อยู่ในชื่อ**
   🔑 เป็นการ **บังคับรูปร่างเพื่อให้ตาข่ายมองเห็น** — ไม่ใช่เพราะชื่อสั้นผิดในตัวเอง
      ⇒ เขียนเหตุไว้ตรง ๆ เพราะกฎที่ดูไม่มีเหตุผลจะถูกคนรอบหน้าลบ */
const aliasพบ = [];
const หาAlias = (เนื้อ, f) => {
  เนื้อ.split('\n').forEach((บรรทัด, i) => {
    for (const k of ช่อง) {
      const m = บรรทัด.match(new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=[^=][^;]*\\b${k}\\b`));
      if (m && !new RegExp(k, 'i').test(m[1])) {
        aliasพบ.push(`${f}:${i + 1}  ตั้งชื่อ \`${m[1]}\` ให้ค่าของ \`${k}\` ⇒ ด่านมองไม่เห็น`);
      }
    }
  });
};

const พบ = [];
for (const ที่ of ราก) {
  let ไฟล์ = [];
  try { ไฟล์ = ไล่ไฟล์(ที่); } catch { continue; }
  for (const f of ไฟล์) {
    const เนื้อ = ถอดคอมเมนต์(readFileSync(f, 'utf8'));
    หาAlias(เนื้อ, f);
    เนื้อ.split('\n').forEach((บรรทัด, i) => {
      for (const k of ช่อง) {
        // ท่าที่ยุบสถานะ: !x · !x.y · x ? a : b ที่ไม่ได้เทียบค่า · x || ... · x && ... (เป็นเงื่อนไขล้วน)
        const รูป = [
          new RegExp(`!\\s*[\\w.?]*\\b${k}\\b`),                       // !upstreamOk · !d.upstreamOk
          /* ⚠️ `\\?(?!:)` — ห้ามตรงกับ optional property ของ TS (`upstreamOk?: boolean`)
             📏 บวกลวงจริง 4 ต.ค. 2569: ด่านจับไฟล์ประกาศชนิดของตัวเอง */
          new RegExp(`\\\\b${k}\\\\b\\\\s*\\\\?(?!:)`),                        // upstreamOk ? a : b
          new RegExp(`\\b${k}\\b\\s*(\\|\\||&&)`),                     // upstreamOk || · upstreamOk &&
          new RegExp(`(\\|\\||&&)\\s*[\\w.?]*\\b${k}\\b\\s*[),}]`),    // ... && d.upstreamOk)
        ];
        if (รูป.some((r) => r.test(บรรทัด))) {
          พบ.push(`${f}:${i + 1}  ${บรรทัด.trim().slice(0, 110)}`);
        }
      }
    });
  }
}

/* ตัวควบคุมของด่าน — รันทุกรอบ ไม่ซ่อนหลัง --self-test
   (บทเรียน: ตัวควบคุมที่ต้องสั่งแยกคือตัวควบคุมที่ไม่มีใครรัน) */
const ตัวอย่างที่ต้องจับ = [
  'if (!upstreamOk) บอกว่าพัง()',
  'const x = d.upstreamOk ? 1 : 2',
  'if (retryable || อะไร) {}',
];
const ตัวอย่างที่ต้องไม่จับ = [
  'if (upstreamOk === false) โทษZORT()',
  'if (d.upstreamOk === null) ยังไม่ได้ถาม()',
  'setZRetryable(typeof d?.retryable === "boolean" ? d.retryable : undefined)',
  'zRetryable === true',
  /* 📏 รูปที่ด่านนี้เคยบวกลวงจริง (4 ต.ค. 2569) — ประกาศชนิดของ TS
     ⇒ ใส่ไว้เป็นตัวควบคุมถาวร ไม่ใช่แก้แล้วจบ */
  '  upstreamOk?: boolean | null',
  '  retryable?: boolean',
  'export interface คำตอบของท่อ { upstreamOk?: boolean | null }',
];
const จับได้ = (บรรทัด) => ช่อง.some((k) => [
  new RegExp(`!\\s*[\\w.?]*\\b${k}\\b`),
  new RegExp(`\\b${k}\\b\\s*\\?(?!:)`),
  new RegExp(`\\b${k}\\b\\s*(\\|\\||&&)`),
  new RegExp(`(\\|\\||&&)\\s*[\\w.?]*\\b${k}\\b\\s*[),}]`),
].some((r) => r.test(บรรทัด)));

const ควบคุมพลาด = [];
for (const t of ตัวอย่างที่ต้องจับ) if (!จับได้(t)) ควบคุมพลาด.push(`ต้องจับแต่ไม่จับ: ${t}`);
for (const t of ตัวอย่างที่ต้องไม่จับ) if (จับได้(t)) ควบคุมพลาด.push(`ต้องไม่จับแต่จับ: ${t}`);

if (ควบคุมพลาด.length) {
  console.error('🔴 ตัวควบคุมของด่านนี้เองพลาด ⇒ ผลของด่านเชื่อไม่ได้');
  for (const x of ควบคุมพลาด) console.error('   ' + x);
  process.exit(1);
}

if (aliasพบ.length) {
  console.error(`🔴 เจอการ alias ค่าสี่สถานะไปชื่อที่ด่านมองไม่เห็น ${aliasพบ.length} จุด`);
  console.error('   ⇒ ตั้งชื่อตัวแปรให้มีคำว่า upstreamOk/retryable อยู่ในชื่อ (เช่น upstreamOkValue)');
  for (const x of aliasพบ) console.error('   ' + x);
  process.exit(1);
}

if (พบ.length) {
  console.error(`🔴 เจอการยุบสี่สถานะเหลือสอง ${พบ.length} จุด — \`upstreamOk\`/\`retryable\` มีสี่สถานะ`);
  console.error('   true=สำเร็จ · false=ถามแล้วล้ม · null=ยังไม่ได้ถาม ZORT · undefined=ท่อรุ่นเก่า');
  console.error('   ⇒ ให้เทียบค่าตรง ๆ (=== false · === null · === true) ไม่ใช่ truthiness');
  for (const x of พบ) console.error('   ' + x);
  process.exit(1);
}
console.log(`✅ ไม่มีการยุบสถานะและไม่มี alias ที่ด่านมองไม่เห็น (${ช่อง.join('/')} · ตัวควบคุม ${ตัวอย่างที่ต้องจับ.length}+${ตัวอย่างที่ต้องไม่จับ.length} ผ่าน)`);
