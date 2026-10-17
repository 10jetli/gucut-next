import json,sys
from playwright.sync_api import sync_playwright
JS=r"""()=>{const vis=e=>{const b=e.getBoundingClientRect();return b.height>0&&b.width>0&&!e.closest('nav,aside,header')};
const S=e=>{if(!e)return null;const c=getComputedStyle(e),b=e.getBoundingClientRect();return {tag:e.tagName,f:c.fontFamily.split(',')[0].replace(/["']/g,''),fs:c.fontSize,fw:c.fontWeight,c:c.color,bg:c.backgroundColor,bd:c.borderTopColor+' '+c.borderTopWidth,r:c.borderTopLeftRadius,h:Math.round(b.height)}};
const inp=[...document.querySelectorAll('input[type=text],input:not([type]),input[type=number]')].filter(e=>vis(e)&&!/ค้นหา|search/i.test(e.placeholder||''));
const lab=[...document.querySelectorAll('label')].find(e=>vis(e)&&(e.innerText||'').trim());
const sel=[...document.querySelectorAll('select')].find(vis);
const ta=[...document.querySelectorAll('textarea')].find(vis);
const h=[...document.querySelectorAll('h1')].find(vis);
const sec=[...document.querySelectorAll('h2,h3,h4,h5,legend')].find(e=>vis(e)&&(e.innerText||'').trim());
return {url:location.pathname,h1:S(h),section:S(sec),label:S(lab),input:S(inp[0]),input2:S(inp[1]),select:S(sel),textarea:S(ta)}}"""
with sync_playwright() as p:
    b=p.chromium.connect_over_cdp(f'http://127.0.0.1:{sys.argv[1]}');pg=b.contexts[0].new_page();pg.set_viewport_size({'width':1280,'height':800})
    pg.goto(sys.argv[2],wait_until='networkidle',timeout=90000);pg.wait_for_timeout(3000)
    print(json.dumps(pg.evaluate(JS),ensure_ascii=False));pg.close()
