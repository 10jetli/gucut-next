# -*- coding: utf-8 -*-
"""เทียบหน้าจอ ZORT ↔ ของเรา ด้วย Playwright + เทียบพิกเซลเอง (ต่อยอดจาก /tmp/วัดพิกเซล.py ของ CEO 19 ต.ค. 2569)
ใช้:  python3 scripts/zort-style/วัดพิกเซล.py [โฮสต์เรา] [ไฟล์คู่] [ไฟล์ผล] [เฉพาะเลขคู่,คั่นจุลภาค]
      โฮสต์เริ่มต้น 1.gucut.com · วัดงานที่ยังไม่ขึ้นจริงให้ใส่ preview--gucut-admin.netlify.app

เกณฑ์เดียวกับตัวต้นฉบับ (ต่างเกิน 8 ระดับสี = ต่าง) ⇒ เลขเทียบกับฐาน 37.1% ได้ **เฉพาะหลังแก้สามข้อนี้**:
🔴 1. ป๊อปอัปของ ZORT (เช่น "อัปโหลดใบหักภาษี ณ ที่จ่าย" — เด้งทุกหน้าตั้งแต่เช้า 19 ต.ค.) บังจอฝั่ง ZORT
      ⇒ ซ่อนด้วย style ค้างในแท็บเรา **ไม่กดปุ่มใด ๆ บนป๊อปอัป** (กฎ ZORT อ่านได้ ห้ามกด)
      ⚠️ ซ่อนครั้งเดียวไม่พอ — ป๊อปอัปเด้งช้ากว่าโหลดหน้า
🔴 2. แท็บ ZORT ซูม 125% (innerWidth 1280 · dpr 1.25) ส่วนของเรา 1600 · dpr 1 ⇒ ภาพสองฝั่งคนละมาตราส่วนทั้งจอ
      ⇒ ซูมเนื้อหาฝั่งเราด้วย CSS ให้กว้าง 1280 เท่ากัน (ท่าเดียวกับ rea2.py) · ไม่ไปแก้ซูมของ ZORT (เบราว์เซอร์ร่วม)
🔴 3. ช่อง "เรา" มีหลายหน้าคั่นด้วย " + " หรือมีคำอธิบายต่อท้าย ⇒ ใช้คำแรกเท่านั้น (เดิมเปิดเป็น URL ทั้งก้อน = หน้าไม่มีจริง)
🔴 4. คู่ที่มีช่อง "เมนู" ต้องอ่านลิงก์จากเมนูซ้ายของ ZORT ตอนวัด (ท่าเดียวกับ rea2.py)
      เช่น ภาพรวม = /Dashboard/Main + โทเคนรายร้าน — ไม่มีโทเคนได้ **หน้าแรกของ ZORT คนละหน้า** (เจอ 19 ต.ค. 2569: 49.4 คือเทียบผิดหน้า)
      ⚠️ ห้ามจดโทเคนนั้นลงไฟล์ (รีโปสาธารณะ) — อ่านสดทุกครั้ง
🚫 ฝั่ง ZORT เป็นหน้า error ⇒ จด "วัดไม่ได้" ห้ามออกเป็น %
🔴 ปิดแท็บเสมอแม้ error
"""
import json, sys, io
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

HOST = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else '1.gucut.com'
คู่ = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else '/tmp/คู่จอ.json'
ผล = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else '/tmp/ผลพิกเซล.json'
เฉพาะ = set(sys.argv[4].split(',')) if len(sys.argv) > 4 and sys.argv[4] else None
# เก็บภาพสองฝั่งไว้ดูด้วยตา: ตั้ง env เก็บภาพ=<โฟลเดอร์> ⇒ ได้ z<เลขคู่>.png / o<เลขคู่>.png (ไม่ตั้ง = ไม่เก็บ)
import os
เก็บภาพ = os.environ.get('เก็บภาพ') or os.environ.get('SAVE_DIR') or ''
# 🔴 โฟลเดอร์ยังไม่มี ⇒ save พังเงียบ (ภาพหายทั้งรอบ 21 ต.ค. 2569) ⇒ สร้างให้ก่อน
if เก็บภาพ: os.makedirs(เก็บภาพ, exist_ok=True)
ซ่อนป๊อปอัป = ".modal,.modal-backdrop,.swal2-container{display:none!important} body.modal-open{overflow:auto!important}"

def พร้อม(pg):
    for _ in range(6):
        pg.wait_for_timeout(2500)
        try:
            if pg.evaluate("document.querySelectorAll('tbody tr').length") > 0: return True
        except Exception: pass
    return False

def ยังโหลด(pg):
    # ZORT ขึ้น "Loading..." ในการ์ดแดชบอร์ดระหว่างโหลด (ภาพ 19 ต.ค. 2569) ⇒ รอทั้งสองคำ
    try:
        t = pg.evaluate('document.body.innerText') or ''
        # ZORT รายงานสินค้า: ไอคอนหมุน .fa-spin ข้างหัวการ์ดระหว่างโหลด (ไม่มีข้อความ) — หายภายใน ~8 วิ (19 ต.ค. 2569)
        หมุน = pg.evaluate("()=>[...document.querySelectorAll('.fa-spin')].some(e=>e.offsetParent)")
        # 🔴 ม่านโปร่งแสงคลุมทั้งจอ (ZORT /Marketplace/List 21 ต.ค. 2569: จอซีด + จุดสามจุด ไม่มีคำ ไม่มี .fa-spin)
        #    ⇒ เดิมตรวจไม่เจอ แล้วออกเลข 56.9/69.1 จากภาพจอโหลด · ตรวจที่ "ของคลุมจอ" ไม่ใช่ที่ชื่อคลาส (คลาสเปลี่ยนได้)
        ม่าน = pg.evaluate("""()=>{const W=innerWidth,H=innerHeight;return [...document.querySelectorAll('body *')].some(e=>{
          const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden')return false;
          if(s.position!=='fixed'&&s.position!=='absolute')return false;
          const r=e.getBoundingClientRect();if(r.width<W*0.5||r.height<H*0.5)return false; /* ม่าน ZORT กว้าง 1280×720 เท่าหน้าต่างตอนโหลด ไม่ใช่เท่าจอที่ขยายภายหลัง ⇒ 0.8 ตกขอบพอดี (วัด 21 ต.ค.) */
          if(e.matches('.modal,.modal-backdrop,.swal2-container'))return false;
          const m=s.backgroundColor.match(/rgba?\\(([^)]+)\\)/);if(!m)return false;const a=m[1].split(',').map(Number);
          const bg=a.length>3?a[3]:1;if(bg<=0)return false;
          const eff=bg*Number(s.opacity);return eff>0.05&&eff<0.95})}""")
        # 🔴 จอเราหลายจอเขียน "กำลังถาม ZORT…" / "กำลังถาม…" ระหว่างรอท่อ (ไม่ใช่ "กำลังโหลด") ⇒ เดิมถ่ายภาพจอเราตอนยังว่าง
        #    (คืนสินค้า 18.4 จากภาพ "กำลังถาม ZORT…" 21 ต.ค. 2569)
        return 'กำลังโหลด' in t or 'กำลังถาม' in t or 'Loading...' in t or bool(หมุน) or bool(ม่าน)
    except Exception: return False

def ไป(pg, url):
    pg.goto(url, wait_until='domcontentloaded', timeout=60000)
    พร้อม(pg)
    # 🔴 จอที่ไม่มีตาราง (แดชบอร์ด) ผ่าน พร้อม() ได้ทั้งที่ยังขึ้น "กำลังโหลด…" ⇒ ถ่ายภาพจอโหลด (เจอ 19 ต.ค. 2569 Marketplace Dashboard)
    #    ⇒ รอให้คำนั้นหายอีกไม่เกิน 20 วิ · ยังไม่หาย = จดไว้ในผล ไม่ใช่เงียบ
    for _ in range(10):
        if not ยังโหลด(pg): return True
        pg.wait_for_timeout(2000)
    return not ยังโหลด(pg)

def ภาพ(pg):
    return Image.open(io.BytesIO(pg.screenshot(timeout=60000))).convert('RGB')

def ต่างกี่เปอร์เซ็นต์(a, b):
    if a.size != b.size:
        b = b.resize(a.size)
    x, y = np.asarray(a, dtype=np.int16), np.asarray(b, dtype=np.int16)
    ต่าง = (np.abs(x - y).max(axis=2) > 8)          # เกิน 8 ระดับสี = ต่างจริง ไม่ใช่ noise
    return round(float(ต่าง.mean()) * 100, 1)

pairs = [p for p in json.load(open(คู่)) if not เฉพาะ or str(p['no']) in เฉพาะ]
out = []
with sync_playwright() as pw:
    bz = pw.chromium.connect_over_cdp('http://127.0.0.1:9223', timeout=20000)
    # 🔁 ฝั่งเรา: ค่าตั้งต้นใช้เบราว์เซอร์ร่วม 9224 · ตั้ง env OURS_STATE=<ไฟล์คุกกี้ storage_state> ⇒ เปิด Chromium หัวเงียบของตัวเองแทน
    #    (20 ต.ค. 2569: 9224 มีคนอื่นใช้อยู่ — หน้า reCAPTCHA ทำให้ connect_over_cdp ค้างทุกรอบ 10+ ครั้ง)
    #    ชื่อ env เป็นอังกฤษโดยตั้งใจ — bash ตั้งชื่อตัวแปรภาษาไทยไม่ได้ (เงียบแล้วเดินต่อด้วยค่าว่าง)
    #    ⚠️ ไฟล์คุกกี้ต้องคัดเฉพาะโดเมนของเรา และอยู่ในที่ส่วนตัว ห้าม commit
    สถานะเรา = os.environ.get('OURS_STATE') or ''
    if สถานะเรา:
        bo = pw.chromium.launch(headless=True)
        po = bo.new_context(storage_state=สถานะเรา).new_page()
    else:
        bo = pw.chromium.connect_over_cdp('http://127.0.0.1:9224', timeout=20000)
        po = bo.contexts[0].new_page()
    pz = bz.contexts[0].new_page()
    try:
        for p in (pz, po): p.set_viewport_size({'width': 1600, 'height': 900})
        เมนูZORT = {}
        if any(p.get('เมนู') for p in pairs):
            pz.goto('https://secure.zortout.com/Product/list?', wait_until='domcontentloaded', timeout=60000); pz.wait_for_timeout(3000)
            เมนูZORT = dict(pz.evaluate("()=>[...document.querySelectorAll('ul.side-nav a')].map(a=>[a.innerText.trim(),a.getAttribute('href')||''])"))
        for p in pairs:
            แถว = {'no': p['no'], 'ชื่อ': p['ชื่อ']}
            try:
                zurl = เมนูZORT.get(p.get('เมนู') or '') or p['zort'].split(' ')[0]
                if p.get('เมนู') and not เมนูZORT.get(p['เมนู']):
                    raise RuntimeError(f"วัดไม่ได้ — หาเมนู {p['เมนู']} ในเมนูซ้ายของ ZORT ไม่เจอ")
                zโหลดทัน = ไป(pz, 'https://secure.zortout.com' + zurl)
                pz.add_style_tag(content=ซ่อนป๊อปอัป); pz.wait_for_timeout(2500)
                # 🔴 ฝั่ง ZORT ยังโหลดไม่เสร็จตอนถ่าย ⇒ เลขที่ได้คือ "ภาพจอโหลด เทียบ จอเรา" ไม่ใช่ความต่างของผัง ⇒ ห้ามออกเป็น %
                #    (เดิมผลของ ไป() ฝั่ง ZORT ถูกทิ้ง — เจอ 21 ต.ค. 2569 สินค้าบน Marketplace ได้ 56.9 แล้ว 69.1 จากภาพจอซีด)
                # ป๊อปอัปถูกซ่อนแล้ว ⇒ ให้เวลาโหลดอีก ~20 วิ ก่อนตัดสิน (ม่าน .loading-bg ของ ZORT ทึบ 0.4 · DOM 21 ต.ค. 2569)
                for _ in range(10):
                    if not ยังโหลด(pz): break
                    pz.wait_for_timeout(2000)
                if ยังโหลด(pz):
                    raise RuntimeError('วัดไม่ได้ — ฝั่ง ZORT ยังโหลดไม่เสร็จตอนถ่าย (ม่าน/วงหมุน/คำว่ากำลังโหลด ค้างเกิน ~35 วิ): ' + zurl.split('?')[0])
                if 'ZortError' in pz.url or 'มีปัญหาบางประการ' in (pz.evaluate('document.body.innerText') or '')[:400]:
                    raise RuntimeError('วัดไม่ได้ — ฝั่ง ZORT เป็นหน้า error: ' + pz.url.split('?')[0])
                zw = pz.evaluate('innerWidth')
                z = ภาพ(pz)
                # 🔴 ม่านโหลดของ ZORT **กะพริบ** — จอที่ดึงข้อมูลไม่สำเร็จจะลองใหม่เรื่อย ๆ (/Marketplace/List 21 ต.ค. 2569:
                #    ตอนตัดสินไม่มีม่าน แต่ภาพที่ถ่ายต่อมาซีดทั้งจอ) ⇒ ตรวจ **หลังถ่าย** ซ้ำ — ภาพที่ได้ต้องไม่ใช่ภาพจอโหลด
                if ยังโหลด(pz):
                    raise RuntimeError('วัดไม่ได้ — ฝั่ง ZORT ขึ้นม่านโหลดตอนถ่ายภาพ (จอ ZORT ลองโหลดซ้ำ — มักแปลว่าดึงข้อมูลไม่สำเร็จ): ' + zurl.split('?')[0])
                โหลดทัน = ไป(po, 'https://' + HOST + p['เรา'].split(' ')[0])
                if not โหลดทัน: แถว['หมายเหตุ'] = "ฝั่งเรายังขึ้น กำลังโหลด ตอนถ่าย"
                if zw and zw != 1600:
                    po.evaluate(f"()=>document.documentElement.style.zoom='{1600 / zw}'")
                po.wait_for_timeout(1500)
                o = ภาพ(po)
                แถว['ต่าง%'] = ต่างกี่เปอร์เซ็นต์(z, o)
                if เก็บภาพ:
                    z.save(os.path.join(เก็บภาพ, f"z{p['no']}.png")); o.save(os.path.join(เก็บภาพ, f"o{p['no']}.png"))
                แถว['ซูม'] = f'ZORT กว้าง {zw}'
            except Exception as e:
                แถว['ผิดพลาด'] = str(e)[:120]
            out.append(แถว)
            print(f"  {แถว['no']:>3} {แถว['ชื่อ'][:22]:<22} {แถว.get('ต่าง%', แถว.get('ผิดพลาด'))}", flush=True)
    finally:
        for p in (pz, po):
            try: p.close()
            except Exception: pass
        if สถานะเรา:
            try: bo.close()
            except Exception: pass
json.dump(out, open(ผล, 'w'), ensure_ascii=False, indent=1)
ได้ = sorted(r['ต่าง%'] for r in out if 'ต่าง%' in r)
กลาง = (ได้[len(ได้) // 2] if len(ได้) % 2 else (ได้[len(ได้) // 2 - 1] + ได้[len(ได้) // 2]) / 2) if ได้ else None
print(f'เสร็จ {len(out)} คู่ · วัดได้ {len(ได้)} · ค่ากลาง {กลาง}')
