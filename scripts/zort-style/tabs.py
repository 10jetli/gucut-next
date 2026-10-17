import json,sys,re
from playwright.sync_api import sync_playwright
JS=r"""()=>{const vis=e=>{const b=e.getBoundingClientRect();return b.height>0&&b.width>0&&!e.closest('nav.topbar,aside,header,ul.side-nav')};
const t=[...document.querySelectorAll('[role=tab],.nav-tabs a,.nav-tabs li a,ul.tabs a')].filter(vis);
const act=t.find(e=>e.getAttribute('aria-selected')==='true'||e.closest('.active')||e.classList.contains('active'));
return {tabs:t.map(e=>(e.innerText||'').replace(/\s+/g,' ').trim()),active:act?(act.innerText||'').replace(/\s+/g,' ').trim():null}}"""
pairs=json.loads(sys.argv[3])
with sync_playwright() as p:
    b=p.chromium.connect_over_cdp(f'http://127.0.0.1:{sys.argv[1]}');pg=b.contexts[0].new_page();pg.set_viewport_size({'width':1280,'height':800})
    out={}
    for k,u in pairs.items():
        try: pg.goto(sys.argv[2]+u,wait_until='networkidle',timeout=90000);pg.wait_for_timeout(2500);out[k]=pg.evaluate(JS)
        except Exception as e: out[k]={'err':str(e)[:60]}
    pg.close();print(json.dumps(out,ensure_ascii=False))
