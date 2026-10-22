/* 🔐 **ไม่เปิดสาธารณะโดยตั้งใจ:** scheduled function ⇒ Netlify เรียกภายใน ไม่ผ่าน URL สาธารณะ
 * 📥 ตัวดึงชีททะเบียนอัตโนมัติทุก 15 นาที — ท่านประธานสั่ง 22 ต.ค. 2569 ("ทำให้มันออโต้สิ")
 *    งานจริงอยู่ที่ lib/registry-sheet.ts (ผ่านเส้น /api/registry-sheet-run) — ไฟล์นี้แค่กดตามเวลา + เตือน
 * ⚠️ เตือนเมื่อสถานะเปลี่ยนไปเป็นของเสีย (อ่านไม่ได้ · หยุด-*) และเมื่อกลับมาพร้อม — ไม่เตือนซ้ำทุก 15 นาที
 *    แต่ "สำรวจ"/"ยังไม่ได้อนุญาต" ไม่เตือน (เป็นงานที่รอคนอยู่แล้ว เห็นบนจอผังที่ /core/registry) */
import { notify } from "./lib-notify.mjs";
import { getStore } from "@netlify/blobs";

const SITE = process.env.URL || "https://admin.gucut.com";
const เสีย = (s) => s === "อ่านไม่ได้" || String(s).startsWith("หยุด-");

export default async () => {
  const secret = process.env.DRIVESYNC_SECRET;
  let รอบ = null, ผิด = "";
  try {
    const r = await fetch(`${SITE}/api/registry-sheet-run?secret=${encodeURIComponent(secret || "")}`, {
      method: "POST", signal: AbortSignal.timeout(24000),
    });
    const d = await r.json().catch(() => null);
    รอบ = d?.รอบ ?? null;
    if (!r.ok || !รอบ) ผิด = `เส้นตอบ ${r.status} ${d?.error ?? ""}`;
  } catch (e) {
    ผิด = String(e?.message || e);
  }
  const สถานะ = รอบ?.สถานะ ?? "อ่านไม่ได้";
  const store = getStore("registry-sheet");
  const ก่อน = await store.get("last-alert-state", { type: "text" }).catch(() => null);
  if (เสีย(สถานะ) || ผิด) {
    if (ก่อน !== สถานะ) {
      await notify(`🔴 ตัวดึงชีททะเบียน: ${สถานะ}${ผิด ? ` · ${ผิด}` : ""}${รอบ?.เหตุ ? `\n${รอบ.เหตุ}` : ""}${รอบ?.ลดฮวบ?.length ? `\n${รอบ.ลดฮวบ.slice(0, 8).join("\n")}` : ""}\nเป้าเดิมไม่ถูกแทน · ดู /core/registry`);
      await store.set("last-alert-state", สถานะ);
    }
  } else if (สถานะ === "พร้อม" && ก่อน && เสีย(ก่อน)) {
    await notify(`✅ ตัวดึงชีททะเบียนกลับมาปกติ (ก่อนหน้า: ${ก่อน})`);
    await store.set("last-alert-state", สถานะ);
  }
  return new Response(JSON.stringify({ สถานะ, ผิด }), { headers: { "content-type": "application/json" } });
};

export const config = { schedule: "*/15 * * * *" };
