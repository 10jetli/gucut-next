import json,sys
from playwright.sync_api import sync_playwright
JS=r"""()=>{const vis=e=>{const b=e.getBoundingClientRect();return b.height>0&&b.width>0&&!e.closest('nav,aside,header,ul.side-nav')};
const h=[...document.querySelectorAll('h1')].find(vis);if(!h)return null;const hb=h.getBoundingClientRect();
const b=[...document.querySelectorAll('a,button')].filter(e=>vis(e)&&(e.innerText||'').trim()&&Math.abs(e.getBoundingClientRect().y-hb.y)<70&&e.getBoundingClientRect().height>25&&!h.contains(e));
return [...new Set(b.map(e=>(e.innerText||'').replace(/\s+/g,' ').trim().slice(0,30)))]}"""
pairs=json.loads(sys.argv[3])
with sync_playwright() as p:
    br=p.chromium.connect_over_cdp(f'http://127.0.0.1:{sys.argv[1]}');pg=br.contexts[0].new_page();pg.set_viewport_size({'width':1600,'height':900})
    out={}
    for k,u in pairs.items():
        try: pg.goto(sys.argv[2]+u,wait_until='networkidle',timeout=90000);pg.wait_for_timeout(2500);out[k]=pg.evaluate(JS)
        except Exception as e: out[k]=str(e)[:60]
    pg.close();print(json.dumps(out,ensure_ascii=False))
