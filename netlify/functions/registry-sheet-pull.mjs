/* 🔐 **ไม่เปิดสาธารณะโดยตั้งใจ:** scheduled function ⇒ Netlify เรียกภายใน ไม่ผ่าน URL สาธารณะ
 * 📥 ตัวเฝ้าความเงียบของขาชีททะเบียน — ข้อมูลจริงมาจาก Apps Script ที่ POST /api/registry-sheet-push ทุก 15 นาที
 *    (เปลี่ยนวิธี 22 ต.ค. 13:39: เลิก OAuth-ดึงเอง · ไฟล์นี้เลยเหลือหน้าที่เดียว = จับว่าสคริปต์หยุดส่ง)
 * กติกา: เคยส่งแล้วแต่เงียบเกิน 35 นาที (รอบ 15 × 2 + เผื่อ) ⇒ จดรอบ 'อ่านไม่ได้' ลง log เดียวกัน (จอแดงเอง) + เด้ง Telegram
 *        ไม่เคยส่งเลย ⇒ ไม่เตือน (ยังไม่ติดตั้ง — ผังขึ้น "ยังไม่เคยส่ง" อยู่แล้ว) · เตือนเฉพาะตอนสถานะเปลี่ยน */
import { notify } from "./lib-notify.mjs";
import { getStore } from "@netlify/blobs";

const เพดานนาที = 35;
const เงียบ = "ไม่มีการส่งจากสคริปต์เกิน " + เพดานนาที + " นาที — Apps Script ในบัญชีท่านอาจหยุด/ล้ม ดู execution log ฝั่ง Google";

export default async () => {
  const s = getStore("registry-sheet");
  const log = (await s.get("log", { type: "json" }).catch(() => null)) ?? [];
  if (!Array.isArray(log) || log.length === 0) {
    return new Response(JSON.stringify({ สถานะ: "ยังไม่เคยส่ง" }), { headers: { "content-type": "application/json" } });
  }
  const ล่าสุด = log[0];
  const จริงล่าสุด = log.find((x) => x?.เหตุ !== เงียบ); // รอบจริงจากสคริปต์ (ข้ามรอบที่ตัวเฝ้าจดเอง)
  const ms = Date.parse(String(จริงล่าสุด?.เมื่อ ?? ""));
  const เงียบอยู่ = !Number.isFinite(ms) || Date.now() - ms > เพดานนาที * 60_000;
  const ก่อน = await s.get("last-alert-state", { type: "text" }).catch(() => null);
  if (เงียบอยู่) {
    if (ล่าสุด?.เหตุ !== เงียบ) {
      const เดิม = (await s.get("log", { type: "json" }).catch(() => null)) ?? [];
      await s.setJSON("log", [{ เมื่อ: new Date().toISOString(), สถานะ: "อ่านไม่ได้", เหตุ: เงียบ }, ...เดิม].slice(0, 200));
    }
    if (ก่อน !== "เงียบ") {
      await notify(`🔴 ขาชีททะเบียน: ${เงียบ}\nเป้าเดิมไม่ถูกแทน · ดู /core/registry`);
      await s.set("last-alert-state", "เงียบ");
    }
  } else if (ก่อน === "เงียบ") {
    await notify(`✅ ขาชีททะเบียนกลับมาส่งแล้ว (รอบล่าสุด ${จริงล่าสุด?.สถานะ})`);
    await s.set("last-alert-state", "ปกติ");
  } else if (["หยุด-ลดฮวบ", "หยุด-หัวเปลี่ยน"].includes(ล่าสุด?.สถานะ) && ก่อน !== ล่าสุด.สถานะ) {
    // ตาข่าย pipeline สะดุด — เตือนครั้งเดียวต่อสถานะ (ของจริงรออยู่ให้คนดู)
    await notify(`🔴 ขาชีททะเบียน: ${ล่าสุด.สถานะ} · ${ล่าสุด.เหตุ ?? ""}${ล่าสุด.ลดฮวบ?.length ? "\n" + ล่าสุด.ลดฮวบ.slice(0, 8).join("\n") : ""}`);
    await s.set("last-alert-state", ล่าสุด.สถานะ);
  }
  return new Response(JSON.stringify({ เงียบอยู่, รอบล่าสุด: จริงล่าสุด?.สถานะ ?? null }), { headers: { "content-type": "application/json" } });
};

export const config = { schedule: "*/15 * * * *" };
