import json,sys
from playwright.sync_api import sync_playwright
PORT,URL=sys.argv[1],sys.argv[2]
JS=r"""()=>{const r=e=>{if(!e)return null;const b=e.getBoundingClientRect(),c=getComputedStyle(e);return {tag:e.tagName,cls:(e.className+'').slice(0,50),x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),bg:c.backgroundColor,pad:c.padding}};
const h1=document.querySelector('h1');let anc=[];let e=h1;while(e&&e!==document.body){anc.push(r(e));e=e.parentElement}
const big=[...document.querySelectorAll('nav,aside,header,[class*=sidebar],[class*=navbar],[class*=topbar]')].map(r).filter(x=>x&&x.h>30&&x.w>30).slice(0,8);
return {h1:anc.slice(0,6),frame:big,vw:innerWidth}}"""
with sync_playwright() as p:
    b=p.chromium.connect_over_cdp(f'http://127.0.0.1:{PORT}');ctx=b.contexts[0];pg=ctx.new_page()
    pg.set_viewport_size({'width':int(sys.argv[3]) if len(sys.argv)>3 else 1600,'height':900});pg.goto(URL,wait_until='networkidle',timeout=60000);pg.wait_for_timeout(2500)
    print(json.dumps(pg.evaluate(JS),ensure_ascii=False,indent=1));pg.close()
