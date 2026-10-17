import json,sys
from playwright.sync_api import sync_playwright
JS=r"""()=>{const vis=e=>{const b=e.getBoundingClientRect();return b.height>0&&b.width>0&&!e.closest('nav,aside,header')};
const S=e=>{if(!e)return null;const c=getComputedStyle(e),b=e.getBoundingClientRect();return {f:c.fontFamily.split(',')[0].replace(/["']/g,''),fs:c.fontSize,fw:c.fontWeight,c:c.color,bg:c.backgroundColor,h:Math.round(b.height),x:Math.round(b.x),y:Math.round(b.y)}};
const h1=[...document.querySelectorAll('h1,h2,h3')].find(vis);
const btns=[...document.querySelectorAll('a.btn,button,a.rounded-full')].filter(e=>vis(e)&&(e.innerText||'').trim()&&e.getBoundingClientRect().y<300).slice(0,4);
let t=null,bn=-1;document.querySelectorAll('table').forEach(x=>{const n=x.querySelectorAll('tbody tr').length;if(vis(x)&&n>bn){bn=n;t=x}});
const th=t?[...t.querySelectorAll('thead th,tr th')].find(e=>vis(e)&&(e.innerText||'').trim()):null;
const td=t?[...t.querySelectorAll('tbody td')].find(e=>vis(e)&&(e.innerText||'').trim()):null;
// label/value pairs: smallest elements with text ending ':' or common label words
const labels=[...document.querySelectorAll('label,dt,span,div,td,th,b,strong')].filter(e=>vis(e)&&e.children.length===0&&/^(เลขที่|วันที่|ช่องทาง|สถานะ|ลูกค้า|ชื่อ|ที่อยู่|เบอร์|อ้างอิง|คลัง)/.test((e.innerText||'').trim())).slice(0,3);
const cards=[...document.querySelectorAll('div')].filter(e=>{if(!vis(e))return false;const c=getComputedStyle(e);return c.backgroundColor==='rgb(255, 255, 255)'&&e.getBoundingClientRect().width>300}).slice(0,1);
const cs=cards[0]?getComputedStyle(cards[0]):null;
return {h:S(h1),btn:btns.map(S),th:S(th),td:S(td),label:labels.map(S),card:cs?{shadow:cs.boxShadow.slice(0,50),radius:cs.borderTopLeftRadius,border:cs.borderTopColor+' '+cs.borderTopWidth,pad:cs.padding}:null}}"""
with sync_playwright() as p:
    b=p.chromium.connect_over_cdp(f'http://127.0.0.1:{sys.argv[1]}');pg=b.contexts[0].new_page();pg.set_viewport_size({'width':1280,'height':800})
    pg.goto(sys.argv[2],wait_until='networkidle',timeout=90000);pg.wait_for_timeout(2500)
    href=pg.evaluate("(sel)=>{const a=[...document.querySelectorAll(sel)].find(a=>a.getBoundingClientRect().height>0);return a?a.href:null}",sys.argv[3])
    if not href: print('no link');sys.exit()
    pg.goto(href,wait_until='networkidle',timeout=90000);pg.wait_for_timeout(3000)
    print(json.dumps(pg.evaluate(JS),ensure_ascii=False));pg.close()
