import json,sys
from playwright.sync_api import sync_playwright
JS=r"""()=>{let t=null,bn=-1;document.querySelectorAll('table').forEach(x=>{const n=x.querySelectorAll('tbody tr').length;if(x.getBoundingClientRect().height>0&&n>bn){bn=n;t=x}});if(!t)return null;
return [...t.querySelectorAll('thead th')].filter(e=>e.getBoundingClientRect().width>0).map(e=>(e.innerText||'').replace(/\s+/g,' ').trim().slice(0,30))}"""
pairs=json.loads(sys.argv[3])
with sync_playwright() as p:
    b=p.chromium.connect_over_cdp(f'http://127.0.0.1:{sys.argv[1]}');pg=b.contexts[0].new_page();pg.set_viewport_size({'width':1280,'height':800})
    out={}
    for k,u in pairs.items():
        try: pg.goto(sys.argv[2]+u,wait_until='networkidle',timeout=90000);pg.wait_for_timeout(2500);out[k]=pg.evaluate(JS)
        except Exception as e: out[k]=str(e)[:60]
    pg.close();print(json.dumps(out,ensure_ascii=False))
