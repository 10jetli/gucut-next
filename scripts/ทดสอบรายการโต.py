#!/usr/bin/env python3
"""ทดสอบว่า **จอรับได้ทุกจำนวน** เมื่อรายการที่ท่อส่งมาโตขึ้น — โดย **ปลูกสมาชิกปลอมเพิ่ม**

🔴 **ที่มา 19 ก.ย. 2569 (ใบ t_mu7adtvs)** — แถบแท็บจอขายล้นออกนอกจอมือถือ 79px
   เพราะแท็บเพิ่มจาก 5 เป็น 6 ตัว (ท่อส่ง `statusesAll` ⇒ แท็บ Returned โผล่เอง)
   ⇒ ฝั่งท่อไล่ทั้งคลาสแล้วพบว่าท่อส่ง **"รายการที่โตเองได้" 15 ตัว** ไม่ใช่แค่ตัวนั้น
     ตัวยาวสุดคือ `logistics.byChannel`/`carrierGroups` = **19 สมาชิก**
     (ร้านเพิ่มเจ้าขนส่งใหม่ได้ตลอด ⇒ ยาวกว่าแท็บที่ทำจอล้นถึง 3 เท่า)

🔑 **กับดักที่ต้องหลีกให้ได้: จำนวนที่วัดวันนี้ไม่ใช่เพดาน**
   "19 ตัวแล้วยังไม่ล้น" **ไม่พอ** เพราะพรุ่งนี้อาจเป็น 25
   ⇒ ต้อง **ปลูกสมาชิกปลอมเพิ่มเป็น N เท่า แล้วดูว่าล้นไหม**
     (ท่าเดียวกับปลูกปุ่มท้ายจอเพื่อพิสูจน์ว่าตัวตรวจไม่ตาบอด)

วิธี: ดักคำตอบของท่อระหว่างทาง (`page.route`) แล้วคูณสมาชิกของรายการที่รู้จัก
⚠️ **ไม่แตะข้อมูลจริง** — แก้เฉพาะคำตอบที่ส่งเข้าเบราว์เซอร์ในรอบทดสอบนี้เท่านั้น
⚠️ วัดที่ความกว้างมือถือ 390px เพราะที่นั่นคือที่ที่ล้นก่อน

วิธีใช้:  SITE_PASSWORD=… npx next dev -p 3111
          python3 scripts/ทดสอบรายการโต.py [เท่าตัว] [พอร์ตCDP]
"""
import json
import sys

from playwright.sync_api import sync_playwright

เท่าตัว = int(sys.argv[1]) if len(sys.argv) > 1 else 2
พอร์ต = sys.argv[2] if len(sys.argv) > 2 else "9222"
ฐาน = "http://localhost:3111"

# ชื่อช่องที่เป็น "รายการปลายเปิด" — โตเองได้โดยไม่มีใครแก้โค้ด
รายการปลายเปิด = [
    "statusesAll", "channels", "byChannel", "byStatus", "carrierGroups",
    "shipStatusGroups", "stores", "warehouses", "byKind", "categories",
]

จอ = ["/core/logistics", "/core/sales", "/core/stock", "/core/transfers",
      "/core/purchases", "/core/marketplace-products", "/core/return-orders"]


def ขยาย(ของ):
    """คูณสมาชิกของทุกรายการที่รู้จัก — ชื่อสมาชิกเติมท้ายให้ไม่ซ้ำ"""
    if isinstance(ของ, dict):
        out = {}
        for k, v in ของ.items():
            if k in รายการปลายเปิด and isinstance(v, list) and v:
                ใหม่ = list(v)
                for รอบ in range(1, เท่าตัว):
                    for m in v:
                        if isinstance(m, str):
                            ใหม่.append(f"{m}-ปลอม{รอบ}")
                        elif isinstance(m, dict):
                            ก = dict(m)
                            for ช in ("status", "channel", "carrier", "code", "name", "store"):
                                if isinstance(ก.get(ช), str):
                                    ก[ช] = f"{ก[ช]}-ปลอม{รอบ}"
                            ใหม่.append(ก)
                out[k] = ใหม่
            else:
                out[k] = ขยาย(v)
        return out
    if isinstance(ของ, list):
        return [ขยาย(x) for x in ของ]
    return ของ


with sync_playwright() as p:
    b = p.chromium.connect_over_cdp(f"http://127.0.0.1:{พอร์ต}")
    page = b.contexts[0].new_page()
    page.set_viewport_size({"width": 390, "height": 780})

    def แทรก(route):
        try:
            r = route.fetch()
            j = r.json()
        except Exception:
            route.continue_()
            return
        route.fulfill(response=r, body=json.dumps(ขยาย(j), ensure_ascii=False),
                      headers={**r.headers, "content-type": "application/json"})

    page.route("**/api/web/core**", แทรก)

    print(f"ปลูกสมาชิกเพิ่มเป็น {เท่าตัว} เท่า แล้ววัดที่ความกว้าง 390px\n")
    for path in จอ:
        try:
            page.goto(ฐาน + path, wait_until="domcontentloaded", timeout=60000)
            พร้อม = False
            for _ in range(30):
                page.wait_for_timeout(1000)
                t = page.locator("main").inner_text()
                if len(t) > 220 and "กำลังโหลด" not in t[:120]:
                    พร้อม = True
                    break
            page.wait_for_timeout(1200)
            if not พร้อม:
                print(f"{path:30s} ⚠️ ตัดสินไม่ได้ใน 30 วิ — **ไม่ใช่ว่าไม่ล้น**")
                continue
            r = page.evaluate("""() => {
              const เกิน = [...document.querySelectorAll('main *')]
                .filter(e => e.getBoundingClientRect().width > window.innerWidth + 4 && !e.closest('.overflow-x-auto'))
              return { doc: document.documentElement.scrollWidth, จอ: window.innerWidth,
                       ตัวการ: เกิน.slice(0, 2).map(e => e.tagName + '.' + (e.className || '').toString().slice(0, 45)) }
            }""")
            ล้น = r["doc"] - r["จอ"]
            ผล = "✅ ไม่ล้น" if ล้น <= 4 else f"🔴 ล้น {ล้น}px · {r['ตัวการ']}"
            print(f"{path:30s} {ผล}")
        except Exception as e:
            print(f"{path:30s} 🔴 {type(e).__name__}: {str(e)[:60]}")
    page.close()
print("\n⚠️ ผ่านที่ N เท่า **ไม่ได้แปลว่าไม่มีเพดาน** — แปลว่ายังไม่เจอเพดานที่จำนวนนี้")
