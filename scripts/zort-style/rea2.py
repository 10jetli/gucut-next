# -*- coding: utf-8 -*-
"""ตรวจทุกหน้าด้วย REA: ถ่ายภาพ ZORT ↔ ของเรา แล้วให้ REA เทียบพิกเซล
⚠️ ใช้แท็บเดิม ไม่เปิดแท็บใหม่ · viewport 1600x900 เท่ากันสองฝั่ง
"""
import json, subprocess, os, sys
from playwright.sync_api import sync_playwright

ENV = dict(os.environ, PATH=os.path.expanduser("~/.nvm/versions/node/v22.23.2/bin") + ":" + os.environ["PATH"])
REA = ["npx", "-y", "rea-agents@latest"]

def rea(args, timeout=180):
    r = subprocess.run(REA + args, capture_output=True, text=True, env=ENV, timeout=timeout)
    try: return json.loads(r.stdout or r.stderr)
    except Exception: return {"_ดิบ": (r.stdout or r.stderr)[:200]}

def target(port, host):
    d = rea(["list-browser-targets", f"http://127.0.0.1:{port}", "--format", "json"])
    hit = [t["target_id"] for t in (d.get("normalized_result") or {}).get("targets", []) if host in t.get("url", "")]
    return hit[0] if hit else None

HOST = sys.argv[1] if len(sys.argv) > 1 else "1.gucut.com"
ONLY = set(sys.argv[2].split(",")) if len(sys.argv) > 2 and sys.argv[2] else None
OUT = sys.argv[3] if len(sys.argv) > 3 else "rea-out.json"
pairs = [p for p in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "rea-pairs.json"))) if not ONLY or p["no"] in ONLY]
out = []
with sync_playwright() as pw:
    bz = pw.chromium.connect_over_cdp("http://127.0.0.1:9223", timeout=20000)
    bo = pw.chromium.connect_over_cdp("http://127.0.0.1:9224", timeout=20000)
    def หน้า(b, host):
        # เปิดแท็บของเราเองเสมอ — แท็บเดิมที่โฮสต์ตรงอาจถูกปิดไปแล้ว (เจอ 18 ต.ค. 2569: ทุกคู่ล้ม "Target page closed")
        pg = b.contexts[0].new_page()
        pg.set_viewport_size({"width": 1600, "height": 900}); return pg
    pz, po = หน้า(bz, "zortout.com"), หน้า(bo, HOST)
    # 📐 ให้สองฝั่งผังเดียวกัน: แท็บ ZORT ในเบราว์เซอร์ 9223 ซูม 125% (innerWidth 1280 · dpr 1.25 · ภาพออก 1600x900)
    #    ของเราต้องจำลองแบบเดียวกัน ไม่งั้นเทียบภาพที่ขนาดตัวอักษร/ความกว้างเมนูต่างกันทั้งจอ (วัด 18 ต.ค. 2569)
    #    ⚠️ ไม่ไปแก้ซูมของ ZORT — เบราว์เซอร์นั้นคนอื่นใช้ด้วย
    zinfo = pz.evaluate("()=>({w:innerWidth,h:innerHeight,d:devicePixelRatio})") if pz.url.startswith("http") else None
    def ตั้งซูมเรา(w, h, d):
        # REA ถ่ายภาพตามพิกเซลหน้าต่างจริง ไม่สน deviceScaleFactor ที่จำลอง (ลองแล้วได้ 1280x720 เทียบกับ 1600x900 ไม่ได้)
        # ⇒ คงหน้าต่าง 1600x900 แล้วซูมเนื้อหาด้วย CSS เท่าที่ ZORT ซูม = ผังกว้าง 1280 ในภาพ 1600 เท่ากัน
        po.evaluate(f"()=>{{document.documentElement.style.zoom='{d}'}}")
    # 🔑 ลิงก์ที่มีโทเคนของบัญชี (เช่น ภาพรวม ?zId=…) ไม่เก็บในรีโป (รีโปเป็น public) ⇒ อ่านจากเมนูซ้าย ZORT ตอนรัน
    pz.goto("https://secure.zortout.com/Sell/list", wait_until="domcontentloaded", timeout=45000); pz.wait_for_timeout(2000)
    เมนูZORT = dict(pz.evaluate("()=>[...document.querySelectorAll('ul.side-nav a')].map(a=>[a.innerText.trim(),a.getAttribute('href')||''])"))
    for p in pairs:
        if p.get("เมนู") and เมนูZORT.get(p["เมนู"]): p["zort"] = เมนูZORT[p["เมนู"]]
        row = {"no": p["no"], "ชื่อ": p["ชื่อ"]}
        try:
            for pg, url in ((pz, "https://secure.zortout.com" + p["zort"].split(" ")[0]),
                            (po, "https://" + HOST + p["เรา"])):
                pg.goto(url, wait_until="domcontentloaded", timeout=45000)
                for _ in range(5):
                    pg.wait_for_timeout(3000)
                    try:
                        if pg.evaluate("document.querySelectorAll('tbody tr').length") > 0: break
                    except Exception: pass
            # 🎯 ส่ง target ของ "แท็บที่เราเปิดเอง" ให้ REA ตรง ๆ — ถ้าหาจากชื่อโฮสต์ มันหยิบแท็บเก่าที่อยู่เบื้องหลัง
            #    แล้วค้างตอนถ่ายภาพ (เจอ 18 ต.ค. 2569: ค้าง 10 นาทีที่ capture ฝั่ง ZORT)
            def tid_of(pg):
                pg.bring_to_front()
                return pg.context.new_cdp_session(pg).send("Target.getTargetInfo")["targetInfo"]["targetId"]
            # 🙈 ซ่อนป๊อปอัปบนจอ ZORT (เช่น "อัปโหลดใบหักภาษี ณ ที่จ่าย") ด้วยการซ่อนใน DOM เครื่องเรา — ไม่กดปุ่ม ไม่ส่งอะไรไป ZORT
            pz.evaluate("""()=>{document.querySelectorAll('.modal,.modal-backdrop,.swal2-container,[class*=chat-widget],#launcher,iframe[title*=chat i]').forEach(e=>e.style.setProperty('display','none','important'));document.body.classList.remove('modal-open');document.body.style.overflow=''}""")
            zi = pz.evaluate("()=>({w:innerWidth,h:innerHeight,d:devicePixelRatio})")
            ตั้งซูมเรา(zi["w"], zi["h"], zi["d"]); po.wait_for_timeout(1500)
            row["ซูม"] = f'{zi["w"]}x{zi["h"]}@{zi["d"]}'
            # 🚫 ฝั่ง ZORT เป็นหน้า error = คู่นี้วัดไม่ได้ ห้ามออกเป็น % (เจอ 18 ต.ค. 2569: หลายคู่เทียบกับหน้า "มีปัญหาบางประการ")
            if "ZortError" in pz.url or "มีปัญหาบางประการ" in (pz.evaluate("document.body.innerText") or "")[:400]:
                raise RuntimeError("ฝั่ง ZORT เป็นหน้า error — URL ในคู่ผิด: " + pz.url.split("?")[0])
            tz, to = tid_of(pz), tid_of(po)
            for side, port, tid in (("z", 9223, tz), ("o", 9224, to)):
                d = rea(["capture-web-screenshot", f"http://127.0.0.1:{port}", tid, "--format", "json"])
                art = (d.get("normalized_result") or {}).get("artifact")
                if not art:
                    raise RuntimeError(f"ถ่ายภาพฝั่ง {side} ไม่ได้: " + json.dumps(d, ensure_ascii=False)[:160])
                open(f"ra-{side}.json", "w").write(json.dumps(art))
            r = rea(["compare-web-screenshots", "ra-z.json", "ra-o.json", "--format", "json"])
            nr = r.get("normalized_result") or {}
            cr = nr.get("changed_ratio")
            if cr is None:
                raise RuntimeError("REA เทียบไม่ออก: " + json.dumps(r, ensure_ascii=False)[:200])
            row["ต่าง%"] = round(cr * 100, 1)
            row["สถานะ"] = nr.get("status", "?")
        except Exception as e:
            row["ผิดพลาด"] = str(e)[:70]
        out.append(row); print(f"  {row['no']:>3} {row['ชื่อ'][:22]:<22} {row.get('ต่าง%', row.get('ผิดพลาด'))}", flush=True)
    pz.close() if False else None
json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)
print("เสร็จ", len(out), "หน้า")
