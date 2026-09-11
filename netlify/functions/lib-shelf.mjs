// ── ถามคนแพ็กว่า "ของหมดบนชั้นหรือเปล่า" — ตัวเลือกคำถาม + ที่เก็บคำตอบ ──────────
//
// เจ้าของร้าน (ท่านประธาน) สั่ง 12 ก.ย. 2569: ถ้าพนักงานแพ็กของแล้วส่งไม่ได้
// แปลว่าของชนิดนั้นหมดจริง · CEO เลือกทาง "ยิงคำถามไปหาคน ไม่รอคนมาหาจอ"
// เพราะพนักงานแพ็กใช้ **ระบบ ZORT** ไม่ใช่จอเรา (ท่านประธานยืนยันเอง 12 ก.ย.)
// ⇒ ของที่ต้องให้คนเปลี่ยนวิธีทำงาน สุดท้ายไม่มีใครใช้
//
// 🔑 **ค่าของสัญญาณนี้อยู่ที่มันมาจากมือคนที่จับของจริง** — เลขอื่นทั้งหมดของเรา
//    มาจากฐานข้อมูลเดียวกัน ⇒ ตรงกันได้โดยผิดพร้อมกัน ([[metrics-need-outside-leg]])
//
// ⚠️ **ทางนี้รู้ได้เร็วสุดคือ "วันที่ 2" ไม่ใช่วันที่ 0** — เพราะมันรอให้มีใบค้างก่อน
//    (ของเดิมรู้ตอนวันที่ 6 และรู้โดยบังเอิญ) · วันที่ 0 ต้องรอวันที่งานแพ็กย้ายมาอยู่จอเรา
//    เขียนไว้ให้คนอ่านรอบหน้าไม่เข้าใจผิดว่าครอบคลุมทุกกรณี
//
// ⚠️ **ต้องมีขอบบนของอายุใบ ไม่ใช่แค่ "เกิน 2 วัน"** (วัดของจริง 12 ก.ย. 2569)
//    กอง "ต้องส่งของ" มี 44 ใบ · ค้างเกิน 2 วัน 28 ใบ แต่ **23 ใบเป็นของปี 2023-2025**
//    = ใบที่ไม่เคยถูกปิด ไม่ใช่งานแพ็กวันนี้ · ถามไปก็ไม่มีใครตอบได้
//    แล้วช่องทางจะถูกเมินตั้งแต่ใบแรก
//
// 🛑 **ยังไม่ตัดสินว่าจะยึด "กองไหน" เป็นตัวจุดชนวน — ไฟล์นี้จึงไม่ฝังคำตอบไว้**
//    (ค้างรอ CEO ตรวจ Lazada Seller Center ด้วยตา 12 ก.ย. 2569)
//    สองกองที่มีให้เลือกและ **ไม่ใช่กองเดียวกัน**:
//      `?pending=1` กอง "ต้องส่งของ" = จ่ายแล้ว + ZORT ยังไม่ Success  ⇒ วันนี้ได้ 28 ใบ
//         แต่ **ไม่มีใบที่ CEO เห็นว่าค้างจริงสักใบ** (ZORT ปิดใบเป็น Success ไปแล้ว)
//      `list=orders` แถวที่ `shipStatusGroup==="waiting_ship"` (จาก integration_status ของแพลตฟอร์ม)
//         ⇒ ได้ 64 ใบ **เป็น Lazada ล้วน 64/64** · จะกลายเป็นคำถาม 53 รหัสในวันเดียว
//    ⚠️ และ 64 ใบนั้น **มีเลขพัสดุครบ + วันจัดส่งครบทุกใบ** — แต่พิสูจน์อะไรไม่ได้
//       เพราะ Lazada กอง shipping/done ก็มีครบเหมือนกัน (ออกเลขพัสดุตั้งแต่ตอนยืนยัน)
//       ⇒ "confirmed" ค้างอยู่ อาจแปลว่า (ก) ยังไม่ส่งจริง หรือ (ข) กระจกไม่อัปเดตหลังส่ง
//       ข้อมูลฝั่งเราเข้าได้กับทั้งสองทาง ⇒ **ต้องถามของนอกระบบก่อน ห้ามเดาแล้วเขียนลงโค้ด**
//       ([[guessed-cause-written-as-fact]])
//    ⇒ `pickStuckOrders` จึงรับ **ตัวตัดสินว่าใบไหนคือ "ยังไม่ได้ส่ง"** มาจากผู้เรียก
//
// ⚠️ **ปุ่ม "มีของ ยังไม่ได้ส่ง" ไม่ใช่ปุ่มรอง** (CEO ย้ำ) — ถ้าคนตอบว่ามีของ
//    แปลว่าปัญหาอยู่ที่อื่น ไม่ใช่สต็อก ซึ่งมีค่าเท่ากับคำตอบอีกด้าน
import { getStore } from "@netlify/blobs";

export const STORE = "gucut-shelf";
export const MIN_AGE = 2;    // ค้างกี่วันถึงเริ่มถาม
export const MAX_AGE = 30;   // เกินนี้ถือเป็นใบค้างเก่า ไม่ใช่งานแพ็ก — ไม่ถาม
export const QUIET_DAYS = 7; // ตอบแล้วเงียบกี่วันก่อนถามรหัสเดิมอีกครั้ง

/* คีย์: หนึ่งรหัส–หนึ่งวัน = หนึ่งคีย์ (กติกาเดียวกับตัวนับคนเข้าเว็บ/ลงเวลา)
   ห้ามเก็บรวมก้อนเดียวแล้วอ่านมาแก้เขียนกลับ — คนตอบพร้อมกันจะทับกันเงียบ ๆ */
export const askKey = (day, sku) => `q/${day}/${sku}`;
export const ansKey = (day, sku) => `a/${day}/${sku}`;

/** วันไทยวันนี้ (YYYY-MM-DD) — เซิร์ฟเวอร์รัน UTC ร้านอยู่ไทย */
export function thaiToday(now = Date.now()) {
  return new Date(now + 7 * 3600e3).toISOString().slice(0, 10);
}

/** ใบนี้ค้างมากี่วัน (นับเป็นวันไทย) — คืน null ถ้าวันที่อ่านไม่ได้ */
export function ageDays(day, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day ?? ""))) return null;
  const a = Date.parse(`${day}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 864e5);
}

/** ใบที่เข้าข่ายถาม — อยู่ในช่วงอายุที่กำหนดเท่านั้น
 *  🔴 คืนเฉพาะเลขที่ใบ/ช่องทาง/วัน **ห้ามพกชื่อหรือที่อยู่ลูกค้าเข้ามาในสายนี้**
 *     ข้อความนี้ไปโผล่ในกลุ่มแชท ไม่ใช่จอที่ล็อกอินแล้ว */
export function pickStuckOrders(rows, { today, minAge = MIN_AGE, maxAge = MAX_AGE, isStuck, dayOf } = {}) {
  if (typeof isStuck !== "function") throw new Error("ต้องส่ง isStuck มาด้วย — ไฟล์นี้ไม่ตัดสินเองว่ากองไหนคือยังไม่ได้ส่ง");
  const day = dayOf || ((o) => o?.day ?? o?.order_date);
  const out = [];
  let tooOld = 0, tooNew = 0, badDay = 0;
  for (const o of Array.isArray(rows) ? rows : []) {
    if (!isStuck(o)) continue;
    const age = ageDays(day(o), today);
    if (age === null) { badDay++; continue; }
    if (age > maxAge) { tooOld++; continue; }     // 🔴 ต้องนับ ห้ามทิ้งเงียบ — CEO สั่งให้รายงานเดือนละครั้ง
    if (age < minAge) { tooNew++; continue; }
    out.push({ id: o.id, number: o.number, channel: o.channel, day: day(o), age });
  }
  out.sort((a, b) => b.age - a.age);
  return { orders: out, tooOld, tooNew, badDay };
}

/** รวมบรรทัดสินค้าของใบที่ค้าง ให้เป็น "หนึ่งรหัส = หนึ่งคำถาม"
 *  itemsByOrder: { [orderId]: [{sku, name, qty}] } */
export function groupBySku(orders, itemsByOrder) {
  const m = new Map();
  for (const o of orders) {
    for (const it of itemsByOrder?.[o.id] ?? []) {
      const sku = String(it?.sku ?? "").trim();
      if (!sku) continue;                       // ไม่มีรหัส = ถามไม่ได้ ไม่ใช่ถามแบบเดา
      const g = m.get(sku) || { sku, name: "", qty: 0, orders: [] };
      // ชื่อสินค้าจำเป็น (CEO สั่ง: คนแพ็กจำรหัสไม่ได้ เขาจำหน้าตาของ)
      if (!g.name && it?.name) g.name = String(it.name);
      g.qty += Number(it?.qty) || 0;
      g.orders.push({ number: o.number, channel: o.channel, age: o.age });
      m.set(sku, g);
    }
  }
  return [...m.values()]
    .map((g) => ({ ...g, maxAge: Math.max(...g.orders.map((x) => x.age)) }))
    .sort((a, b) => b.maxAge - a.maxAge);
}

/** กันถามซ้ำ — ตอบแล้วเงียบ · ยังไม่ตอบถามได้วันละครั้ง (CEO สั่งข้อ ข)
 *  answeredDays: Map<sku, วันที่ตอบล่าสุด> · askedToday: Set<sku>
 *  ⚠️ **ต้องมีเพดานจำนวนคำถามต่อวันเสมอ** — วัดจริง 12 ก.ย. 2569: กอง waiting_ship
 *     ให้คำถาม 53 รหัสในวันเดียว · ส่งไปทั้งหมด = ช่องทางตายตั้งแต่วันแรก
 *     ที่เกินเพดานไม่ได้หายไป มันแค่ยังไม่ถูกถาม — พรุ่งนี้ยังอยู่ (เรียงใบเก่าสุดก่อน) */
export function filterAskable(groups, { today, answeredDays, askedToday, quietDays = QUIET_DAYS, maxPerDay = 5 }) {
  const keep = [];
  const held = [];
  for (const g of groups) {
    if (askedToday?.has(g.sku)) { held.push({ sku: g.sku, why: "ถามไปแล้ววันนี้" }); continue; }
    const ans = answeredDays?.get(g.sku);
    const since = ans ? ageDays(ans, today) : null;
    if (since !== null && since < quietDays) { held.push({ sku: g.sku, why: `ตอบแล้วเมื่อ ${ans}` }); continue; }
    keep.push(g);
  }
  const ask = keep.slice(0, Math.max(1, maxPerDay));
  const overflow = keep.slice(ask.length).map((g) => g.sku);
  return { ask, held, overflow };
}

/** ข้อความที่คนแพ็กอ่านบนมือถือ — ต้องรู้เรื่องใน 3 วินาที (CEO สั่งข้อ ก)
 *  ชื่อสินค้ามาก่อนรหัสโดยตั้งใจ · ไม่ใส่ยอดเงิน ไม่ใส่ชื่อลูกค้า */
export function askText(g) {
  const where = g.orders.length === 1
    ? `ใบ ${g.orders[0].number} (${g.orders[0].channel})`
    : `${g.orders.length} ใบ`;
  return [
    `🧰 <b>ของหมดบนชั้นหรือเปล่า</b>`,
    g.name || "(ไม่มีชื่อสินค้าในระบบ)",
    `รหัส ${g.sku} · ${where} · ค้างนานสุด ${g.maxAge} วัน`,
  ].join("\n");
}

/** ปุ่มสองปุ่ม — น้ำหนักเท่ากันโดยตั้งใจ (CEO ย้ำข้อ ค) */
export function askButtons(g, day) {
  return {
    inline_keyboard: [[
      { text: "❌ ไม่มีของบนชั้น", callback_data: `shelf:${day}:${g.sku}:none` },
      { text: "✅ มีของ ยังไม่ได้ส่ง", callback_data: `shelf:${day}:${g.sku}:have` },
    ]],
  };
}

// ── ที่เก็บ ────────────────────────────────────────────────────────────────
const store = () => getStore({ name: STORE, consistency: "strong" });

export async function markAsked(day, g) {
  await store().setJSON(askKey(day, g.sku), {
    sku: g.sku, name: g.name, at: new Date().toISOString(),
    orders: g.orders.map((o) => o.number), maxAge: g.maxAge,
  });
}

/** คำตอบล่าสุดของแต่ละรหัส (อ่านจากคีย์รายวัน) — คืน Map<sku, วันที่ตอบล่าสุด> */
export async function answeredDaysMap() {
  const { blobs } = await store().list({ prefix: "a/" }).catch(() => ({ blobs: [] }));
  const m = new Map();
  for (const b of blobs || []) {
    const [, day, ...rest] = String(b.key).split("/");
    const sku = rest.join("/");
    if (!day || !sku) continue;
    if (!m.has(sku) || m.get(sku) < day) m.set(sku, day);
  }
  return m;
}

export async function askedTodaySet(day) {
  const { blobs } = await store().list({ prefix: `q/${day}/` }).catch(() => ({ blobs: [] }));
  return new Set((blobs || []).map((b) => String(b.key).slice(`q/${day}/`.length)));
}

/** บันทึกคำตอบ — คืน `{saved:true}` หรือ `{saved:false, already}` ให้ผู้เรียกบอกคนกดตรง ๆ
 *  ⚠️ ห้ามตอบสำเร็จลอย ๆ ตอนมีคำตอบอยู่แล้ว — คนกดคนที่สองต้องรู้ว่าใครตอบไปก่อน */
export async function saveAnswer(day, sku, answer, by) {
  if (answer !== "none" && answer !== "have") return { saved: false, error: "คำตอบต้องเป็น none หรือ have" };
  const s = store();
  const k = ansKey(day, sku);
  const cur = await s.get(k, { type: "json" }).catch(() => null);
  if (cur) return { saved: false, already: cur };
  const rec = { sku, answer, by: by || "(ไม่ทราบชื่อ)", at: new Date().toISOString() };
  await s.setJSON(k, rec);
  return { saved: true, rec };
}
