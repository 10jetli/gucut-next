import json,sys
from playwright.sync_api import sync_playwright
JS=r"""()=>{const S=e=>{if(!e)return null;const c=getComputedStyle(e),b=e.getBoundingClientRect();return {f:c.fontFamily.split(',')[0].replace(/["']/g,''),fs:c.fontSize,fw:c.fontWeight,c:c.color,bg:c.backgroundColor,h:Math.round(b.height)}};
const vis=e=>{const b=e.getBoundingClientRect();return b.height>0&&b.width>0};
const h1=[...document.querySelectorAll('h1')].find(vis);
const hb=h1?h1.getBoundingClientRect():null;
const btns=hb?[...document.querySelectorAll('a,button')].filter(e=>vis(e)&&!e.closest('nav,aside,header')&&(e.innerText||'').trim()&&Math.abs(e.getBoundingClientRect().y-hb.y)<60&&e!==h1&&e.getBoundingClientRect().x>hb.x+50):[];
let best=null,bn=-1;document.querySelectorAll('table').forEach(t=>{const n=t.querySelectorAll('tbody tr').length;if(vis(t)&&n>bn){bn=n;best=t}});
const th=best?[...best.querySelectorAll('thead th')].find(e=>vis(e)&&(e.innerText||'').trim()):null;
const td=best?[...best.querySelectorAll('tbody tr td')].find(e=>vis(e)&&(e.innerText||'').trim()&&!e.querySelector('a,input,img')):null;
const a=best?[...best.querySelectorAll('tbody a')].find(e=>vis(e)&&(e.innerText||'').trim()):null;
return {h1:S(h1),btn:btns.slice(0,3).map(S),th:S(th),td:S(td),link:S(a),bg:getComputedStyle(document.body).backgroundColor}}"""
pairs=json.loads(sys.argv[3])
with sync_playwright() as p:
    b=p.chromium.connect_over_cdp(f'http://127.0.0.1:{sys.argv[1]}');pg=b.contexts[0].new_page();pg.set_viewport_size({'width':1280,'height':800})
    out={}
    for k,u in pairs.items():
        try:
            pg.goto(sys.argv[2]+u,wait_until='networkidle',timeout=90000);pg.wait_for_timeout(2500);out[k]=pg.evaluate(JS)
        except Exception as e: out[k]={'err':str(e)[:80]}
    pg.close();print(json.dumps(out,ensure_ascii=False))
