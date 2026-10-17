import json,sys
from playwright.sync_api import sync_playwright
JS=r"""()=>{const vis=e=>{const b=e.getBoundingClientRect();return b.height>0&&b.width>0&&!e.closest('nav,aside,header')};
const S=e=>{if(!e)return null;const c=getComputedStyle(e),b=e.getBoundingClientRect();return {tag:e.tagName,f:c.fontFamily.split(',')[0].replace(/["']/g,''),fs:c.fontSize,fw:c.fontWeight,c:c.color,bd:c.borderTopColor+' '+c.borderTopWidth,r:c.borderTopLeftRadius,h:Math.round(b.height)}};
const lab=[...document.querySelectorAll('*')].find(e=>vis(e)&&e.children.length===0&&/^วันที่/.test((e.innerText||'').trim()));
let val=null;if(lab){let n=lab.nextElementSibling||lab.parentElement.nextElementSibling;val=n}
const titles=[...document.querySelectorAll('h2,h3,h4,h5,.card-title,.panel-title,.title')].filter(vis).slice(0,3);
const btn=[...document.querySelectorAll('a.btn,button')].find(e=>vis(e)&&(e.innerText||'').trim()&&e.getBoundingClientRect().y<300);
return {label:S(lab),value:S(val),titles:titles.map(S),btn:S(btn)}}"""
with sync_playwright() as p:
    b=p.chromium.connect_over_cdp(f'http://127.0.0.1:{sys.argv[1]}');pg=b.contexts[0].new_page();pg.set_viewport_size({'width':1280,'height':800})
    pg.goto(sys.argv[2],wait_until='networkidle',timeout=90000);pg.wait_for_timeout(2500)
    href=pg.evaluate("(sel)=>{const a=[...document.querySelectorAll(sel)].find(a=>a.getBoundingClientRect().height>0);return a?a.href:null}",sys.argv[3])
    pg.goto(href,wait_until='networkidle',timeout=90000);pg.wait_for_timeout(3000)
    print(json.dumps(pg.evaluate(JS),ensure_ascii=False));pg.close()
