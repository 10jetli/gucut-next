import json,sys
from playwright.sync_api import sync_playwright
JS=r"""()=>{const vis=e=>{const b=e.getBoundingClientRect();return b.height>0&&b.width>0&&!e.closest('nav,aside,header,ul.side-nav')};
const S=e=>{if(!e)return null;const c=getComputedStyle(e),b=e.getBoundingClientRect();return {tag:e.tagName,f:c.fontFamily.split(',')[0].replace(/["']/g,''),fs:c.fontSize,fw:c.fontWeight,c:c.color,bg:c.backgroundColor,sh:c.boxShadow==='none'?'none':'มีเงา',r:c.borderTopLeftRadius,bd:c.borderTopWidth,h:Math.round(b.height)}};
const h=[...document.querySelectorAll('h1')].find(vis);
const card=[...document.querySelectorAll('div,section')].filter(e=>{if(!vis(e))return false;const c=getComputedStyle(e);const b=e.getBoundingClientRect();return c.backgroundColor==='rgb(255, 255, 255)'&&b.width>150&&b.height>60}).slice(0,1)[0];
const tit=[...document.querySelectorAll('h2,h3,h4,h5')].find(e=>vis(e)&&(e.innerText||'').trim());
const nums=[...document.querySelectorAll('*')].filter(e=>vis(e)&&e.children.length===0&&/^[฿\d][\d,\.]{2,}/.test((e.innerText||'').trim())).map(e=>[parseFloat(getComputedStyle(e).fontSize),e]).sort((a,b)=>b[0]-a[0]);
const btn=[...document.querySelectorAll('button,a.btn,a.button')].find(e=>vis(e)&&(e.innerText||'').trim()&&e.getBoundingClientRect().y<350);
let t=null,bn=-1;document.querySelectorAll('table').forEach(x=>{const n=x.querySelectorAll('tbody tr').length;if(vis(x)&&n>bn){bn=n;t=x}});
const th=t?[...t.querySelectorAll('th')].find(e=>vis(e)&&(e.innerText||'').trim()):null;
const td=t?[...t.querySelectorAll('tbody td')].find(e=>vis(e)&&(e.innerText||'').trim()&&!e.querySelector('a')):null;
const chart=[...document.querySelectorAll('canvas,svg')].filter(e=>e.getBoundingClientRect().width>250).length;
return {h1:S(h),card:S(card),title:S(tit),bigNum:S(nums[0]&&nums[0][1]),btn:S(btn),th:S(th),td:S(td),charts:chart}}"""
with sync_playwright() as p:
    b=p.chromium.connect_over_cdp(f'http://127.0.0.1:{sys.argv[1]}');pg=b.contexts[0].new_page();pg.set_viewport_size({'width':1280,'height':800})
    pg.goto(sys.argv[2],wait_until='networkidle',timeout=90000);pg.wait_for_timeout(4000)
    print(json.dumps(pg.evaluate(JS),ensure_ascii=False));pg.close()
