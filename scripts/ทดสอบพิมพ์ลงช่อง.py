#!/usr/bin/env python3
"""ทดสอบว่า **คนพิมพ์ลงช่องได้จริง** บนจอที่เขียนของจริงเข้า ZORT

🔴 **ที่มา 18 ก.ย. 2569** — จอเพิ่มสินค้าและจอแก้ไขสินค้า **พิมพ์ได้ตัวอักษรเดียว**
   (ประกาศ component ไว้ในตัว component ⇒ React สร้าง <input> ใหม่ทุกครั้งที่ state เปลี่ยน)
   บั๊กนี้ผ่าน **ทุกอย่างที่เรามี**: build · tsc · ด่าน 27 ตัว · ตัวกวาดจอ
   เพราะ **ไม่มีเครื่องมือไหนพิมพ์ลงช่อง** — ทุกตัวตรวจแค่ว่า "จอเรนเดอร์ได้ไหม"
   ⇒ CEO สั่งให้มีตัวที่พิมพ์จริง อย่างน้อยกับจอที่เขียนของจริง

🚫 **ไม่อยู่ใน prebuild โดยตั้งใจ** — ต้องมีเบราว์เซอร์ที่ล็อกอินแล้ว (CDP) และเซิร์ฟเวอร์ที่รันอยู่
   ด่านที่ต้องพึ่งของนอกบ้าน ถ้าใส่ใน build จะกลายเป็น build ที่ล้มด้วยเหตุที่ไม่เกี่ยวกับโค้ด

📋 **รายชื่อจออ่านจาก `lib/arch-admin.ts` (สร้างตอน build)** ไม่ได้พิมพ์มือ
   ⇒ เพิ่มจอที่มีปุ่มส่งจริงใหม่ มันมาเองรอบหน้า (บทเรียน hand-typed-catalogue-goes-blind)

วิธีใช้:
    SITE_PASSWORD=xxx npx next dev -p 3111     # หรือชี้ไป production ที่ล็อกอินแล้ว
    python3 scripts/ทดสอบพิมพ์ลงช่อง.py http://localhost:3111 9222
"""
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ฐาน = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3111"
พอร์ต = sys.argv[2] if len(sys.argv) > 2 else "9222"
คำทดสอบ = "ทดสอบABC123"

# ค่าตัวอย่างสำหรับเส้นทางที่มีช่องแปรใน URL — เปิดเปล่า ๆ ไม่ได้
ค่าตัวอย่าง = {"sku": "01209", "id": "1", "key": "stock-count", "vendor": "meta", "slug": "x"}


def รายชื่อจอ():
    """อ่านจอที่มีปุ่มส่งจริงจากผังที่สร้างตอน build — ห้ามพิมพ์รายชื่อเอง"""
    src = Path("lib/arch-admin.ts").read_text(encoding="utf-8")
    m = re.search(r'"realSend":\s*\{\s*"screens":\s*(\[.*?\])\s*,\s*"open"', src, re.S)
    if not m:
        print("🛑 อ่าน realSend จาก lib/arch-admin.ts ไม่ได้ — อย่าเดารายชื่อ หยุดตรงนี้")
        sys.exit(2)
    out = []
    for row in json.loads(m.group(1)):
        p = row["path"]
        for ช่อง, ค่า in ค่าตัวอย่าง.items():
            p = p.replace(f"[{ช่อง}]", ค่า)
        if "[" in p:          # ยังมีช่องแปรที่เราไม่มีค่าตัวอย่างให้
            print(f"⚠️ ข้าม {row['path']} — ไม่มีค่าตัวอย่างสำหรับช่องแปรในเส้นทางนี้")
            continue
        out.append((p, row.get("open", False)))
    return out


def ทดสอบจอ(page, path):
    page.goto(ฐาน + path, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(9000)
    ช่อง = [e for e in page.locator("main input").all()
            if not e.is_disabled() and (e.get_attribute("type") or "text") in ("text", "search", "number", "")]
    if not ช่อง:
        return "ไม่มีช่องกรอกที่พิมพ์ได้ (ข้าม)", None
    el = ช่อง[0]
    เดิม = el.input_value()
    el.click()
    page.keyboard.press("End")
    for ch in คำทดสอบ:
        page.keyboard.type(ch)
        page.wait_for_timeout(60)
    ได้ = el.input_value()
    โฟกัส = page.evaluate("document.activeElement && document.activeElement.tagName")
    ครบ = ได้ == เดิม + คำทดสอบ
    """🔑 เช็คสองอย่าง ไม่ใช่อย่างเดียว:
       ① ตัวอักษรครบไหม  ② โฟกัสยังอยู่ที่ช่องไหม
       ข้อ ② คือตัวที่ฟ้องอาการ "ช่องถูกสร้างใหม่" ได้ตรงที่สุด"""
    return ("✅ พิมพ์ได้ครบ" if ครบ else f"🔴 พิมพ์ไม่ครบ — ได้ {ได้!r} ควรได้ {เดิม + คำทดสอบ!r}"), โฟกัส


def main():
    จอ = รายชื่อจอ()
    print(f"จอที่เขียนของจริงเข้า ZORT: {len(จอ)} จอ (อ่านจากผังที่สร้างตอน build)\n")
    พัง = 0
    with sync_playwright() as p:
        b = p.chromium.connect_over_cdp(f"http://127.0.0.1:{พอร์ต}")
        page = b.contexts[0].new_page()
        for path, เปิดอยู่ in จอ:
            try:
                ผล, โฟกัส = ทดสอบจอ(page, path)
            except Exception as e:
                ผล, โฟกัส = f"🔴 เปิดจอไม่ได้: {type(e).__name__}", None
            ป้าย = "ปุ่มส่งจริงเปิด" if เปิดอยู่ else "ปุ่มส่งจริงปิด"
            print(f"{path:34s} [{ป้าย}] {ผล}" + (f" · โฟกัส={โฟกัส}" if โฟกัส else ""))
            if ผล.startswith("🔴") or (โฟกัส and โฟกัส != "INPUT"):
                พัง += 1
        page.close()
    print()
    if พัง:
        print(f"🛑 มีจอที่พิมพ์ไม่ได้ {พัง} จอ — ดูรายการข้างบน")
        sys.exit(1)
    print("✅ ทุกจอพิมพ์ได้ครบและโฟกัสไม่หลุด")


if __name__ == "__main__":
    main()
