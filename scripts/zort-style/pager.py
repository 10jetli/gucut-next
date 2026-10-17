import json,sys
from playwright.sync_api import sync_playwright
JS=r"""()=>{const vis=e=>{const b=e.getBoundingClientRect();return b.height>0&&b.width>0&&!e.closest('nav.topbar,aside,header,ul.side-nav')};
const S=e=>{if(!e)return null;const c=getComputedStyle(e),b=e.getBoundingClientRect();return {tag:e.tagName,cls:(e.className+'').slice(0,40),t:(e.innerText||'').trim().slice(0,6),f:c.fontFamily.split(',')[0].replace(/["']/g,''),fs:c.fontSize,fw:c.fontWeight,c:c.color,bg:c.backgroundColor,bd:c.borderTopColor+' '+c.borderTopWidth,r:c.borderTopLeftRadius,h:Math.round(b.height),w:Math.round(b.width)}};
const nums=[...document.querySelectorAll('a,button,span,li')].filter(e=>vis(e)&&/^[1-9]$/.test((e.innerText||'').trim())&&e.children.length===0);
// group by y, pick the row with most siblings
const byY={};nums.forEach(e=>{const y=Math.round(e.getBoundingClientRect().y/5);(byY[y]=byY[y]||[]).push(e)});
const row=Object.values(byY).sort((a,b)=>b.length-a.length)[0]||[];
const items=row.slice(0,4).map(S);
const act=row.find(e=>{const c=getComputedStyle(e);return c.backgroundColor!=='rgba(0, 0, 0, 0)'&&c.backgroundColor!=='rgb(255, 255, 255)'})||row.find(e=>e.closest('.active')||e.getAttribute('aria-current'));
return {n:row.length,items,active:S(act)}}"""
with sync_playwright() as p:
    b=p.chromium.connect_over_cdp(f'http://127.0.0.1:{sys.argv[1]}');pg=b.contexts[0].new_page();pg.set_viewport_size({'width':1280,'height':800})
    pg.goto(sys.argv[2],wait_until='networkidle',timeout=90000);pg.wait_for_timeout(2500)
    pg.evaluate("window.scrollTo(0,document.body.scrollHeight)");pg.wait_for_timeout(1000)
    print(json.dumps(pg.evaluate(JS),ensure_ascii=False));pg.close()
