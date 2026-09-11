// ทดสอบตัวเลือกคำถาม "ของหมดบนชั้นหรือเปล่า" — รันด้วย `node scripts/tests/shelf.test.mjs`
//
// ⚠️ ทุกข้อในนี้ถูกเขียนให้ **แดงได้จริง** ถ้าพฤติกรรมกลับด้าน
//    (พิสูจน์แล้วด้วยการทำให้พังทีละข้อแล้วดูว่าแดง — 12 ก.ย. 2569)
//    ข้อที่ไม่เคยถูกพิสูจน์ว่าแยกแยะได้ ให้ผลเขียวที่แปลว่า "ยังไม่เจอ" ไม่ใช่ "ไม่มี"
//
// 🔴 ข้อที่มีค่าที่สุดคือข้อที่ผูกกับ **คำสั่งของคน** ไม่ใช่ผูกกับโค้ด:
//    ชื่อสินค้าต้องอยู่ในข้อความ · ปุ่มต้องมีสองปุ่ม · เพดานคำถามต่อวันต้องมีจริง
//    ถ้าวันหนึ่งมีคน "ทำให้เรียบง่ายขึ้น" แล้วข้อพวกนี้แดง — นั่นคือหน้าที่ของมัน
import {
  pickStuckOrders, groupBySku, filterAskable, askText, askButtons, ageDays,
} from "../../netlify/functions/lib-shelf.mjs";

let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) console.log(`  ✅ ${name}`);
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};

const TODAY = "2026-09-12";
const rows = [
  { id: "a", number: "A1", channel: "Lazada", order_date: "2026-09-12", g: "waiting_ship" }, // วันนี้ — ใหม่เกิน
  { id: "b", number: "B2", channel: "Lazada", order_date: "2026-09-09", g: "waiting_ship" }, // 3 วัน ✓
  { id: "c", number: "C3", channel: "Shopee", order_date: "2026-08-20", g: "waiting_ship" }, // 23 วัน ✓
  { id: "d", number: "D4", channel: "Lazada", order_date: "2023-07-06", g: "waiting_ship" }, // เก่าเกิน
  { id: "e", number: "E5", channel: "Shopee", order_date: "2026-09-05", g: "done" },         // ส่งแล้ว ไม่ใช่ของเรา
  { id: "f", number: "F6", channel: "TikTok", order_date: "ไม่ใช่วันที่", g: "waiting_ship" },// วันเสีย
];
const isStuck = (o) => o.g === "waiting_ship";

console.log("① เลือกใบ — ช่วงอายุ และของที่ตกขอบต้องถูกนับ ไม่ใช่หายเงียบ");
const picked = pickStuckOrders(rows, { today: TODAY, isStuck });
ok("ได้เฉพาะใบในช่วง 2-30 วัน", picked.orders.map((o) => o.number).join(",") === "C3,B2",
   `ได้ ${picked.orders.map((o) => o.number).join(",")}`);
ok("เรียงใบเก่าสุดก่อน", picked.orders[0].age > picked.orders[1].age);
ok("ใบเกิน 30 วันถูกนับไว้ (ห้ามทิ้งเงียบ)", picked.tooOld === 1, `tooOld=${picked.tooOld}`);
ok("ใบใหม่เกินถูกนับไว้", picked.tooNew === 1, `tooNew=${picked.tooNew}`);
ok("ใบที่วันที่อ่านไม่ได้ถูกนับไว้", picked.badDay === 1, `badDay=${picked.badDay}`);
ok("ใบที่ส่งแล้วไม่หลุดเข้ามา", !picked.orders.some((o) => o.number === "E5"));

console.log("② ห้ามฝังคำตอบว่ากองไหนคือ 'ยังไม่ได้ส่ง' ลงในไฟล์");
let threw = false;
try { pickStuckOrders(rows, { today: TODAY }); } catch { threw = true; }
ok("ไม่ส่ง isStuck มา ต้องโยน error", threw);

console.log("③ รวมเป็นหนึ่งรหัส = หนึ่งคำถาม");
const items = {
  b: [{ sku: "00313", name: "หัวเทียน NEWWAVE", qty: 1 }, { sku: "", name: "ไม่มีรหัส", qty: 9 }],
  c: [{ sku: "00313", name: "หัวเทียน NEWWAVE", qty: 2 }, { sku: "00627", name: "สปริงเล็ก", qty: 1 }],
};
const groups = groupBySku(picked.orders, items);
const g313 = groups.find((g) => g.sku === "00313");
ok("รหัสเดียวกันจากหลายใบรวมเป็นคำถามเดียว", g313 && g313.orders.length === 2);
ok("จำนวนชิ้นรวมถูก", g313 && g313.qty === 3, `qty=${g313?.qty}`);
ok("อายุที่โชว์คือใบที่เก่าที่สุดของรหัสนั้น", g313 && g313.maxAge === ageDays("2026-08-20", TODAY));
ok("บรรทัดที่ไม่มีรหัสถูกข้าม (ไม่ถามแบบเดา)", !groups.some((g) => g.name === "ไม่มีรหัส"));
ok("เรียงรหัสที่ค้างนานสุดขึ้นก่อน", groups[0].sku === "00313");

console.log("④ กันถามซ้ำ + เพดานต่อวัน");
const many = ["s1", "s2", "s3", "s4", "s5"].map((sku, i) => ({ sku, name: `ของ ${sku}`, qty: 1, maxAge: 30 - i, orders: [{ number: "X", channel: "Lazada", age: 30 - i }] }));
const r1 = filterAskable(many, { today: TODAY, answeredDays: new Map(), askedToday: new Set(), maxPerDay: 3 });
ok("ถามไม่เกินเพดานต่อวัน", r1.ask.length === 3, `ถาม ${r1.ask.length}`);
ok("ที่เกินเพดานไม่หาย — ถูกส่งกลับมาใน overflow", r1.overflow.join(",") === "s4,s5", r1.overflow.join(","));
ok("ที่ถามคือรหัสที่ค้างนานสุดก่อน", r1.ask[0].sku === "s1");
const r2 = filterAskable(many, {
  today: TODAY,
  answeredDays: new Map([["s1", "2026-09-10"]]),   // ตอบไปแล้ว 2 วันก่อน
  askedToday: new Set(["s2"]),
  maxPerDay: 3,
});
ok("ตอบแล้วภายใน 7 วัน ต้องเงียบ", !r2.ask.some((g) => g.sku === "s1"));
ok("ถามไปแล้ววันนี้ ต้องไม่ถามซ้ำ", !r2.ask.some((g) => g.sku === "s2"));
const r3 = filterAskable(many, {
  today: TODAY,
  answeredDays: new Map([["s1", "2026-08-01"]]),   // ตอบไว้นานแล้ว
  askedToday: new Set(),
  maxPerDay: 3,
});
ok("ตอบไว้นานเกิน 7 วัน กลับมาถามได้อีก", r3.ask.some((g) => g.sku === "s1"));

console.log("⑤ ข้อความและปุ่ม — ผูกกับคำสั่งของคน ไม่ใช่กับโค้ด");
const text = askText(g313);
ok("มีชื่อสินค้าในข้อความ (คนแพ็กจำรหัสไม่ได้)", text.includes("หัวเทียน NEWWAVE"));
ok("มีรหัสด้วย", text.includes("00313"));
ok("บอกว่าค้างกี่วัน", /ค้างนานสุด \d+ วัน/.test(text));
ok("สั้นพอสำหรับมือถือ (ไม่เกิน 3 บรรทัด)", text.split("\n").length <= 3, `${text.split("\n").length} บรรทัด`);
ok("ไม่มียอดเงินหรือชื่อลูกค้าหลุดเข้ามา", !/บาท|฿/.test(text));
const btn = askButtons(g313, TODAY);
const flat = btn.inline_keyboard.flat();
ok("ต้องมีสองปุ่มเสมอ — 'มีของ' ไม่ใช่ปุ่มรอง", flat.length === 2, `มี ${flat.length} ปุ่ม`);
ok("ปุ่มพกวันและรหัสไปด้วย (ตัวรับต้องรู้ว่าตอบเรื่องใบไหน)",
   flat.every((b) => b.callback_data.includes(TODAY) && b.callback_data.includes("00313")));
ok("แยกสองคำตอบออกจากกันได้", flat.some((b) => b.callback_data.endsWith(":none")) && flat.some((b) => b.callback_data.endsWith(":have")));

console.log(fail === 0 ? "\n✅ ผ่านทุกข้อ" : `\n❌ ตก ${fail} ข้อ`);
process.exit(fail === 0 ? 0 : 1);
