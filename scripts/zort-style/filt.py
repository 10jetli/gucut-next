import json,sys
from playwright.sync_api import sync_playwright
JS=r"""()=>{const vis=e=>{const b=e.getBoundingClientRect();return b.height>0&&b.width>0&&!e.closest('nav,aside,header,ul.side-nav,table')};
const h=[...document.querySelectorAll('h1')].find(vis);let t=null,bn=-1;document.querySelectorAll('table').forEach(x=>{const n=x.querySelectorAll('tbody tr').length;if(x.getBoundingClientRect().height>0&&n>bn){bn=n;t=x}});
if(!h||!t)return null;const y0=h.getBoundingClientRect().bottom+30,y1=t.getBoundingClientRect().top;
const inside=e=>{const r=e.getBoundingClientRect();return r.top>=y0-5&&r.top<y1};
const inputs=[...document.querySelectorAll('input[type=text],input[type=search],input:not([type])')].filter(e=>vis(e)&&inside(e)).map(e=>'ช่อง:'+(e.placeholder||'').trim());
const sels=[...document.querySelectorAll('select')].filter(e=>vis(e)&&inside(e)).map(e=>'เลือก:'+[...e.options].map(o=>o.text.trim()).slice(0,6).join('/'));
const btns=[...document.querySelectorAll('button,a')].filter(e=>vis(e)&&inside(e)&&(e.innerText||'').trim()&&!e.closest('[role=tablist],.nav-tabs')).map(e=>'ปุ่ม:'+(e.innerText||'').replace(/\s+/g,' ').trim().slice(0,24));
return [...inputs,...sels,...new Set(btns)]}"""
pairs=json.loads(sys.argv[3])
with sync_playwright() as p:
    br=p.chromium.connect_over_cdp(f'http://127.0.0.1:{sys.argv[1]}');pg=br.contexts[0].new_page();pg.set_viewport_size({'width':1600,'height':900})
    out={}
    for k,u in pairs.items():
        try: pg.goto(sys.argv[2]+u,wait_until='networkidle',timeout=90000);pg.wait_for_timeout(2500);out[k]=pg.evaluate(JS)
        except Exception as e: out[k]=str(e)[:60]
    pg.close();print(json.dumps(out,ensure_ascii=False))
