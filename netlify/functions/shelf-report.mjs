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
const ITEMS_CAP = 25;     // เปิดดูรายการสินค้าได้กี่ใบต่อรอบ (ใบเก่าสุดก่อน) — งบเวลา 26 วินาที
const CONCURRENCY = 5;
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
  const scope = { store: "z1", from, to: today, days: maxAge, minAge };

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

  /* ── เปิดดูรายการสินค้าของใบที่ค้าง (ใบเก่าสุดก่อน) ──
     🔴 ใบที่อ่านไม่ได้ **ห้ามนับเป็น "ไม่มีสินค้า"** — ต้องรายงานว่าอ่านไม่ได้กี่ใบ */
  const take = picked.orders.slice(0, itemsCap);
  const itemsByOrder = {};
  let itemsFailed = 0;
  for (let i = 0; i < take.length; i += CONCURRENCY) {
    await Promise.all(take.slice(i, i + CONCURRENCY).map(async (o) => {
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
    ordersBeyondCap: Math.max(0, picked.orders.length - take.length),
    tooOld: picked.tooOld,
    pick,
    statusUnverified: true,
  });
  return {
    ...built, scope,
    raw: {
      rowsRead: rows.length, rowsTotal, stuckOrders: picked.orders.length,
      tooOld: picked.tooOld, tooNew: picked.tooNew, badDay: picked.badDay,
      itemsRead: take.length, itemsFailed, distinctSkus: groups.length,
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
