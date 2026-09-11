// ── งาน "ถามคนแพ็กว่าของหมดบนชั้นหรือเปล่า" — ตัวเดินงาน ───────────────────────
//
// 🔴 **ตอนนี้เป็นโหมดซ้อมเท่านั้น ยังไม่ส่งข้อความออกไปหาใครสักใบ**
//    CEO สั่งชัด 12 ก.ย. 2569: ห้ามส่งคำถามจริงจนกว่าจะยืนยันว่า **ตัวรับปุ่มตอบกลับได้**
//    ปุ่มที่กดแล้วค้างหมุน แย่กว่าไม่มีปุ่ม — คนกดแล้วไม่เกิดอะไร จะเลิกเชื่อทั้งช่องทาง
//    ⇒ ไฟล์นี้ **ไม่มี config.schedule โดยตั้งใจ** เรียกด้วยมือเท่านั้น
//       วันที่จะเปิดใช้จริง: ใส่ schedule + เปิด send (ดูท้ายไฟล์)
//
// 🛑 **ยังไม่ตัดสินว่ายึดกองไหนเป็นตัวจุดชนวน** ⇒ โหมดซ้อมคิดให้ **ทั้งสองกอง**
//    แล้ววางผลเทียบกัน เพื่อให้คนตัดสินจากของจริง ไม่ใช่จากคำอธิบาย
//      `pending`      = `?pending=1` กอง "ต้องส่งของ" (จ่ายแล้ว + ZORT ยังไม่ Success)
//      `waiting_ship` = `list=orders` แถวที่ shipStatusGroup === "waiting_ship"
//                       (มาจาก integration_status ที่ ZORT บอก — **ยังไม่มีใครพิสูจน์ว่า
//                        ZORT ตรงกับ Lazada** · ข้อนี้ค้างอยู่ รอยิง /api/lazada/order)
//
// ⚠️ **งบเวลาเป็นของใช้ร่วมกัน** — Netlify ให้รอผลราว 26 วินาที และการดึงบรรทัดสินค้า
//    คือ 1 คำขอต่อใบ ⇒ จำกัดจำนวนใบที่ดึงของ แล้ว **รายงานว่าตัดไปเท่าไหร่**
//    ห้ามเงียบ ไม่งั้นผลบางส่วนจะหน้าตาเหมือนผลเต็ม ([[partial-coverage-reported-as-full]])
import {
  thaiToday, pickStuckOrders, groupBySku, filterAskable, askText, askButtons,
  answeredDaysMap, askedTodaySet, MIN_AGE, MAX_AGE,
} from "./lib-shelf.mjs";

const PIPE = "https://gucut.com/api/core";
const ITEMS_CAP = 25;        // ดึงบรรทัดสินค้าได้กี่ใบต่อรอบ (ใบเก่าสุดก่อน)
const CONCURRENCY = 5;
const MAX_PER_DAY = 3;       // CEO สั่งล่วงหน้า: วันละไม่เกิน 3 รหัส เอาอายุมากสุดก่อน

const json = (o, s = 200) =>
  new Response(JSON.stringify(o, null, 2), { status: s, headers: { "content-type": "application/json" } });

async function pipe(qs) {
  const key = process.env.GUCUT_WEB_ADMIN_KEY;
  if (!key) throw new Error("ยังไม่ได้ตั้ง GUCUT_WEB_ADMIN_KEY");
  const r = await fetch(`${PIPE}?${qs}`, {
    headers: { "x-admin-key": key },
    signal: AbortSignal.timeout(20000),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d || d.error) throw new Error(`ท่อตอบ ${r.status}: ${d?.error ?? "อ่าน body ไม่ได้"}`);
  return d;
}

/** ดึงบรรทัดสินค้าทีละชุด — คืน { itemsByOrder, asked, missed } */
async function fetchItems(orders) {
  const take = orders.slice(0, ITEMS_CAP);
  const itemsByOrder = {};
  const missed = [];
  for (let i = 0; i < take.length; i += CONCURRENCY) {
    const part = take.slice(i, i + CONCURRENCY);
    await Promise.all(part.map(async (o) => {
      try {
        const d = await pipe(`order=${encodeURIComponent(o.id)}`);
        itemsByOrder[o.id] = Array.isArray(d.items) ? d.items : [];
      } catch (e) {
        /* สามสถานะ: ได้ของ · ดึงไม่สำเร็จ · ใบไม่มีบรรทัดสินค้าจริง — ห้ามยุบให้เหมือนกัน
           ใบที่ดึงไม่สำเร็จ **ห้ามนับเป็น "ไม่มีสินค้า"** ไม่งั้นคำถามจะหายไปเงียบ ๆ */
        missed.push({ id: o.id, error: String(e?.message || e) });
      }
    }));
  }
  return { itemsByOrder, asked: take.length, missed, skippedOverCap: orders.length - take.length };
}

async function planFor(sourceName, rows, isStuck, today, memory) {
  const picked = pickStuckOrders(rows, { today, isStuck });
  const { itemsByOrder, asked, missed, skippedOverCap } = await fetchItems(picked.orders);
  const groups = groupBySku(picked.orders, itemsByOrder);
  const { ask, held, overflow } = filterAskable(groups, {
    today,
    answeredDays: memory.answeredDays,
    askedToday: memory.askedToday,
    maxPerDay: MAX_PER_DAY,
  });
  return {
    source: sourceName,
    window: `${MIN_AGE}-${MAX_AGE} วัน`,
    stuckOrders: picked.orders.length,
    tooOld: picked.tooOld,          // 🔴 CEO สั่ง: ใบเกิน 30 วันห้ามหายเงียบ ต้องรายงานเดือนละครั้ง
    tooNew: picked.tooNew,
    badDay: picked.badDay,
    itemsFetched: asked,
    itemsFailed: missed.length,
    ...(missed.length ? { itemsFailedDetail: missed.slice(0, 5) } : {}),
    ...(skippedOverCap > 0 ? { ordersBeyondCap: skippedOverCap } : {}),   // ตัดเพราะงบเวลา ไม่ใช่เพราะไม่มี
    distinctSkus: groups.length,
    wouldAsk: ask.map((g) => ({
      sku: g.sku, name: g.name, orders: g.orders.length, maxAge: g.maxAge,
      text: askText(g), buttons: askButtons(g, today),
    })),
    heldBack: held.slice(0, 10),
    overflow: overflow.length,      // เกินเพดานวันนี้ — ไม่หาย พรุ่งนี้ยังอยู่
  };
}

export default async function handler(req) {
  const url = new URL(req.url);
  const secret = process.env.DRIVESYNC_SECRET;
  /* รหัสตัวเดียวกับงานตามเวลาอื่นฝั่งนี้ (คนเรียกคือเครื่อง ไม่ใช่เบราว์เซอร์ที่ล็อกอิน)
     ⚠️ ไม่ได้ตั้งรหัสไว้ = ปิดเส้นนี้ไปเลย **ห้ามเปิดโล่ง** */
  if (!secret) return json({ error: "ยังไม่ได้ตั้ง DRIVESYNC_SECRET — ปิดเส้นนี้ไว้" }, 503);
  if (url.searchParams.get("secret") !== secret) return json({ error: "unauthorized" }, 401);

  /* 🚫 **สวิตช์ส่งจริงยังไม่มีในไฟล์นี้โดยตั้งใจ** — ไม่ใช่ "มีแต่ปิดไว้"
     วันที่จะเปิด ต้องเพิ่มสามอย่างพร้อมกัน ไม่ใช่อย่างเดียว:
       ① ยืนยันว่าตัวรับ callback ตอบกลับได้จริง (CEO กำลังเช็ค)
       ② ตัดสินว่ายึดกองไหน แล้วเอาอีกกองออกจากสายการทำงาน
       ③ ต่อ /api/notify พร้อม replyMarkup + เรียก markAsked ทุกใบที่ส่งออกสำเร็จ
          ⚠️ markAsked ต้องเกิด **หลัง** ส่งสำเร็จเท่านั้น — จดว่าถามแล้วทั้งที่ส่งไม่ออก
             = รหัสนั้นจะเงียบไปตลอดโดยไม่มีใครเคยเห็นคำถาม */
  const today = thaiToday();
  const memory = {
    answeredDays: await answeredDaysMap().catch(() => new Map()),
    askedToday: await askedTodaySet(today).catch(() => new Set()),
  };

  const out = { ok: true, dryRun: true, sentNothing: true, today, maxPerDay: MAX_PER_DAY, plans: [] };

  try {
    const p = await pipe("pending=1");
    out.plans.push(await planFor(
      "pending (ต้องส่งของ)",
      p["ต้องส่งของ"] ?? [],
      () => true,                      // ท่อคัดกองมาให้แล้ว — ทุกแถวในกองนี้คือ "ยังไม่ได้ส่ง"
      today, memory,
    ));
  } catch (e) {
    out.plans.push({ source: "pending (ต้องส่งของ)", error: String(e?.message || e) });
  }

  try {
    const from = new Date(Date.now() + 7 * 3600e3 - (MAX_AGE + 1) * 864e5).toISOString().slice(0, 10);
    /* ท่อไม่มีตัวกรอง shipStatusGroup ⇒ ต้องดึงมาแล้วกรองเอง · ไล่หน้าให้ครบ
       ⚠️ ดึงไม่ครบห้ามเงียบ — ใบที่ยังไม่ถูกดึงคือคำถามที่หายไป */
    let rows = [], offset = 0, total = null;
    for (let page = 0; page < 8; page++) {
      const d = await pipe(`list=orders&from=${from}&to=${today}&limit=200&offset=${offset}`);
      const part = Array.isArray(d.rows) ? d.rows : [];
      total = Number(d.total ?? total ?? 0);
      rows = rows.concat(part);
      offset += 200;
      if (part.length < 200 || rows.length >= total) break;
    }
    const plan = await planFor(
      "waiting_ship (สถานะจากแพลตฟอร์ม)",
      rows,
      (o) => o?.shipStatusGroup === "waiting_ship",
      today, memory,
    );
    plan.rowsRead = rows.length;
    plan.rowsTotal = total;
    plan.rowsComplete = total !== null && rows.length >= total;   // ไม่ครบ = ผลนี้ใช้ตัดสินไม่ได้
    out.plans.push(plan);
  } catch (e) {
    out.plans.push({ source: "waiting_ship (สถานะจากแพลตฟอร์ม)", error: String(e?.message || e) });
  }

  return json(out);
}

// 🚫 **ไม่ใส่ config.schedule จนกว่าจะเปิดใช้จริง** — ของที่รันเองทุกวันโดยยังไม่มีใคร
//    ตัดสินว่ามันควรถามอะไร คือของที่ไม่มีใครดูแล้วเชื่อว่าถูก
//
// ⚠️ **ไม่ประกาศ config.path โดยตั้งใจ** — โปรเจกต์นี้เป็น Next.js และ middleware.ts
//    คุมล็อกอินทุกเส้นทางที่ไม่อยู่ใน PUBLIC_PATHS ⇒ เส้น `/api/…` ที่ฟังก์ชันจองเอง
//    อาจถูกด่านล็อกอินขวางหรือชนกับ app router แบบที่ดูไม่ออกจากข้างนอก
//    เรียกที่ `/.netlify/functions/shelf-ask?secret=…` (ทางเดียวกับ bills-daily ที่ใช้ได้จริงอยู่)
