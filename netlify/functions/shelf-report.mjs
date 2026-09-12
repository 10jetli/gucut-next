// ── รายงาน "ใบที่ยังไม่ได้ส่ง" ทุกเช้า → กลุ่ม Telegram เดิมของร้าน ───────────────
//
// ท่านประธานสั่งเอง (ผ่าน CEO 12 ก.ย. 2569) — "สำคัญมาก" · ท่านจะเอาไปสั่งพนักงานนับสต็อก
//
// 🚫 **ยังไม่เปิดส่งอัตโนมัติ** — ไม่มี config.schedule และต้องใส่ `?send=1` เองถึงจะยิง
//    เหตุผลจาก CEO: ข้อความที่เข้ากลุ่มแล้ว **เอาคืนไม่ได้** และท่านประธานอ่านทุกใบ
//    ⇒ ต้องให้ CEO อ่านถ้อยคำจากโหมดซ้อมก่อน แล้วค่อยเปิด
//    วันเปิดใช้: เพิ่ม `export const config = { schedule: "0 0 * * *" }` (ตี 7 ไทย) + ใส่ send
//
// ⚠️ เรียกที่ `/.netlify/functions/shelf-report?secret=…` (ไม่ประกาศ path เพราะ middleware
//    ของ Next คุมล็อกอินทุกเส้น /api/ ที่ไม่อยู่ใน allowlist — เหตุผลเดียวกับ shelf-ask)
import { MIN_AGE, MAX_AGE, thaiToday, pickStuckOrders, groupBySku } from "./lib-shelf.mjs";
import { buildShelfReport, PICK } from "./lib-shelf-report.mjs";
import { notify } from "./lib-notify.mjs";

const PIPE = "https://gucut.com/api/core";
/* 🔴 **เพดานนี้เคยทำให้ "อันดับ" ผิด — วัดของจริง 12 ก.ย. 2569**
   เดิมตั้งไว้ 25 ใบ แล้ววันนั้นมีใบค้าง 65 ใบ ⇒ อ่านได้ 25 ใบ จัดอันดับจาก 25 ใบนั้น
   ผลที่ออกมา: สามอันดับแรกเป็น 00449 / 00040 / 00540 และ **รหัส 00313 ที่ค้างมากที่สุด
   (10 ใบ · เก่าสุด 28 วัน) หลุดออกจากรายการไปเลย** — ซึ่งเป็นรหัสเดียวกับที่ท่านประธานห่วง
   ⇒ เลขที่ตั้งไว้ "เพื่อไม่ให้เกินเวลา" ถูกเอาไปใช้ **ตัดสินว่าจะสั่งใครไปนับของ**
   (กฎ display-limits-cant-decide) ⇒ ต้องครอบให้ครบ ไม่ใช่สุ่มมาจัดอันดับ
   วัดจริง: 65 ใบ ใช้เวลา 9.6–11.3 วินาที (concurrency 5) ⇒ ยังอยู่ในงบ 26 วินาทีของ Netlify */
const ITEMS_CAP = 120;
/* วัดจริง 12 ก.ย.: 65 ใบที่ concurrency 5 ใช้ 13.8 วินาที (รวมทั้งรอบ 17.7 วิ) ซึ่งชิดงบ 26 วิเกินไป
   ⇒ เพิ่มเป็น 8 · ปลายทางเป็นท่อของเราเอง ไม่ใช่ของนอกที่มีเพดานต่อวินาที */
const CONCURRENCY = 8;
/* ⏱️ **งบเวลาเป็นของใช้ร่วมกัน** — หยุดเปิดใบเพิ่มเมื่อใช้เวลาเกินนี้ แล้ว **รายงานว่าเหลืออีกกี่ใบ**
   ดีกว่าปล่อยให้ฟังก์ชันตายกลางทางแล้วไม่มีรายงานเลย ([[time-budget-is-shared]]) */
const TIME_BUDGET_MS = 15_000;
const PAGE = 200;         // เพดานแถวต่อคำขอของท่อ
const MAX_PAGES = 8;

const json = (o, s = 200) =>
  new Response(JSON.stringify(o, null, 2), { status: s, headers: { "content-type": "application/json" } });

/** ยิงท่อกลาง — แยกออกมาเพื่อ **แทนที่ได้เฉพาะขอบเครือข่าย** ตอนทดสอบ
 *  (ตัวไล่หน้า · ตัวคัดใบ · ตัวจัดกลุ่ม · ตัวประกอบข้อความ เดินของจริงทั้งหมด) */
async function pipeFetch(qs) {
  const key = process.env.GUCUT_WEB_ADMIN_KEY;
  if (!key) throw new Error("ยังไม่ได้ตั้ง GUCUT_WEB_ADMIN_KEY");
  const r = await fetch(`${PIPE}?${qs}`, { headers: { "x-admin-key": key }, signal: AbortSignal.timeout(20000) });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d || d.error) throw new Error(`ท่อตอบ ${r.status}: ${d?.error ?? "อ่าน body ไม่ได้"}`);
  return d;
}

/** เดินงานจริง — คืนผลของ buildShelfReport พร้อมตัวเลขดิบให้ตรวจได้
 *  @param pipe (qs) => object  ขอบเครือข่าย (แทนที่ได้ตอนทดสอบ) */
export async function runShelfReport({ pipe = pipeFetch, today = thaiToday(), minAge = MIN_AGE, maxAge = MAX_AGE, itemsCap = ITEMS_CAP, pick = PICK } = {}) {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - (maxAge + 1) * 864e5).toISOString().slice(0, 10);
  /* 🔴 **ไม่ส่ง store= ⇒ ข้อมูลเป็นทุกร้าน** — ป้ายต้องพูดตามนั้น (เคยเขียน "ร้าน z1" ไว้ผิด)
     วัดจริง 12 ก.ย. 2569: ช่วงนี้มี z1 607 ใบ · z2 302 ใบ · และ **z2 มีใบรอจัดส่ง 0 ใบ**
     (หน้าร้าน POS ลูกค้าหิ้วกลับ ไม่มีการจัดส่ง) ⇒ ครอบทุกร้านแล้วแยกตัวเลขให้เห็น
     ปลอดภัยกว่ากรองร้านเดียวทิ้ง เพราะวันที่ z2 เริ่มส่งของ เราจะเห็นเองทันที */
  const scope = { from, to: today, days: maxAge, minAge };

  /* ── ดึงใบในช่วง ── ไล่หน้าให้ครบ
     🔴 **หน้าไหนยิงไม่สำเร็จ = ดึงไม่สำเร็จทั้งรอบ ห้ามสรุปจากที่ได้มา**
        (บทเรียนของท่อเอง: หน้าที่ล้มแล้วตีความว่า "หมดแล้ว" ทำให้รายงานผิดทั้งใบ) */
  let rows = [], rowsTotal = null;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const d = await pipe(`list=orders&from=${from}&to=${today}&limit=${PAGE}&offset=${page * PAGE}`);
      const part = Array.isArray(d.rows) ? d.rows : null;
      if (part === null) throw new Error("ท่อไม่ได้ส่งช่อง rows มา — ยังสรุปไม่ได้");
      rowsTotal = Number.isFinite(Number(d.total)) ? Number(d.total) : rowsTotal;
      rows = rows.concat(part);
      if (part.length < PAGE || (rowsTotal !== null && rows.length >= rowsTotal)) break;
    }
  } catch (e) {
    return { ...buildShelfReport({ today, scope, error: String(e?.message ?? e) }), scope, raw: null };
  }

  /* ── คัดใบที่ยังไม่ได้ส่ง ──
     ⚠️ เกณฑ์มาจาก `shipStatusGroup === "waiting_ship"` ซึ่งท่อคิดจาก integration_status ของ ZORT
        **ยังไม่มีใครยืนยันกับแพลตฟอร์มโดยตรง** ⇒ ข้อความต้องติดหมายเหตุนี้ไปด้วยทุกใบ
        (statusUnverified) จนกว่าจะยิง /api/lazada/order ยืนยันได้ */
  const picked = pickStuckOrders(rows, {
    today, minAge, maxAge,
    isStuck: (o) => o?.shipStatusGroup === "waiting_ship",
  });
  /* แยกตามร้านจาก **ทั้งกองที่คัดได้** ไม่ใช่จากแถวที่เอาไปแสดง */
  const byStore = {};
  for (const o of picked.orders) {
    const src = String(rows.find((r) => r.id === o.id)?.source ?? "(ไม่ระบุ)");
    byStore[src] = (byStore[src] ?? 0) + 1;
  }

  /* ① **นับใบที่เก่ากว่าช่วงตรวจ — ห้ามทิ้ง** (CEO ตีกลับ 12 ก.ย. 2569)
     🔑 นับด้วย **คำขอเดียว** ไม่ต้องไล่หน้า: ท่อคำนวณ `shipStatusGroups` จากทั้งช่วงที่กรอง
        ให้มาพร้อมกันอยู่แล้ว ⇒ ขอ limit=1 ก็ได้ยอดของทั้งช่วง (ประหยัด ~50 คำขอ)
     ⚠️ นับไม่ได้ ≠ ไม่มี ⇒ ล้มเหลวให้เป็น null แล้วข้อความจะไม่พูดถึง ไม่ใช่พูดว่าศูนย์ */
  const tailTo = new Date(Date.parse(`${from}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
  const tailFrom = new Date(Date.parse(`${today}T00:00:00Z`) - 365 * 864e5).toISOString().slice(0, 10);
  let olderTail = null;
  try {
    const d = await pipe(`list=orders&from=${tailFrom}&to=${tailTo}&limit=1`);
    const g = Array.isArray(d.shipStatusGroups) ? d.shipStatusGroups.find((x) => x.group === "waiting_ship") : null;
    olderTail = g ? Number(g.count) || 0 : null;
  } catch {
    olderTail = null;
  }

  /* ── เปิดดูรายการสินค้าของใบที่ค้าง (ใบเก่าสุดก่อน) ──
     🔴 ใบที่อ่านไม่ได้ **ห้ามนับเป็น "ไม่มีสินค้า"** — ต้องรายงานว่าอ่านไม่ได้กี่ใบ */
  const take = picked.orders.slice(0, itemsCap);
  const itemsByOrder = {};
  let itemsFailed = 0;
  let opened = 0;
  const startedAt = Date.now();
  for (let i = 0; i < take.length; i += CONCURRENCY) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;   // เหลือเท่าไหร่จะถูกรายงาน ไม่ใช่หายเงียบ
    const part = take.slice(i, i + CONCURRENCY);
    opened += part.length;
    await Promise.all(part.map(async (o) => {
      try {
        const d = await pipe(`order=${encodeURIComponent(o.id)}`);
        if (!Array.isArray(d.items)) throw new Error("ไม่มีช่อง items");
        itemsByOrder[o.id] = d.items;
      } catch {
        itemsFailed++;
      }
    }));
  }

  const groups = groupBySku(picked.orders, itemsByOrder);
  const built = buildShelfReport({
    today, scope, groups,
    stuckOrders: picked.orders.length,
    rowsRead: rows.length, rowsTotal,
    itemsFailed,
    ordersBeyondCap: Math.max(0, picked.orders.length - opened),
    tooOld: picked.tooOld,
    tooNew: picked.tooNew,
    byStore,
    olderTail, olderTailFrom: tailFrom,
    pick,
    statusUnverified: true,
  });
  return {
    ...built, scope,
    raw: {
      rowsRead: rows.length, rowsTotal, stuckOrders: picked.orders.length,
      tooOld: picked.tooOld, tooNew: picked.tooNew, badDay: picked.badDay,
      itemsRead: opened, itemsFailed, distinctSkus: groups.length,
      itemsMs: Date.now() - startedAt,
      byStore, olderTail, olderTailRange: `${tailFrom}..${tailTo}`,
    },
  };
}

export default async function handler(req) {
  const url = new URL(req.url);
  const secret = process.env.DRIVESYNC_SECRET;
  if (!secret) return json({ error: "ยังไม่ได้ตั้ง DRIVESYNC_SECRET — ปิดเส้นนี้ไว้" }, 503);
  if (url.searchParams.get("secret") !== secret) return json({ error: "unauthorized" }, 401);

  const out = await runShelfReport();
  const wantSend = url.searchParams.get("send") === "1";

  /* 🚫 ยังไม่ส่งอัตโนมัติ — ต้องสั่ง send=1 เองเท่านั้น (CEO ขออ่านถ้อยคำก่อน)
     ⚠️ ตอบ `sent` ตามความจริงจาก notify() เสมอ **ห้ามตอบ ok ลอย ๆ ตอนส่งไม่ออก**
        ไม่งั้นวันที่ Telegram ล่ม เราจะคิดว่าท่านประธานได้อ่านแล้ว */
  if (!wantSend) {
    return json({ ok: true, dryRun: true, sentNothing: true, state: out.state, counts: out.counts, raw: out.raw, text: out.text });
  }
  const sent = await notify(out.text);
  return json({ ok: true, dryRun: false, state: out.state, counts: out.counts, raw: out.raw, telegram: sent, text: out.text });
}

// 🚫 ไม่มี config.schedule จนกว่า CEO อ่านถ้อยคำแล้วอนุมัติ
