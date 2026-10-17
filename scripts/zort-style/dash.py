import json,sys
from playwright.sync_api import sync_playwright
JS=r"""()=>{const vis=e=>{const b=e.getBoundingClientRect();return b.height>0&&b.width>0&&!e.closest('nav,aside,header')};
const S=e=>{if(!e)return null;const c=getComputedStyle(e),b=e.getBoundingClientRect();return {tag:e.tagName,f:c.fontFamily.split(',')[0].replace(/["']/g,''),fs:c.fontSize,fw:c.fontWeight,c:c.color,bg:c.backgroundColor,sh:c.boxShadow.slice(0,45),r:c.borderTopLeftRadius,bd:c.borderTopWidth,h:Math.round(b.height),w:Math.round(b.width)}};
const h=[...document.querySelectorAll('h1')].find(vis);
const cards=[...document.querySelectorAll('div,section')].filter(e=>{if(!vis(e))return false;const c=getComputedStyle(e);const b=e.getBoundingClientRect();return c.backgroundColor==='rgb(255, 255, 255)'&&b.width>150&&b.width<700&&b.height>60&&b.height<400}).slice(0,1);
const nums=[...document.querySelectorAll('*')].filter(e=>vis(e)&&e.children.length===0&&/^[฿\d][\d,\.]{2,}/.test((e.innerText||'').trim())).map(e=>[parseFloat(getComputedStyle(e).fontSize),e]).sort((a,b)=>b[0]-a[0]);
const big=nums[0]?nums[0][1]:null;
const tit=cards[0]?[...cards[0].querySelectorAll('*')].find(e=>vis(e)&&e.children.length===0&&(e.innerText||'').trim()&&!/^[฿\d]/.test(e.innerText.trim())):null;
const canv=document.querySelectorAll('canvas').length,svg=[...document.querySelectorAll('svg')].filter(s=>s.getBoundingClientRect().width>200).length;
const fills=[...new Set([...document.querySelectorAll('svg rect,svg path')].map(e=>getComputedStyle(e).fill).filter(f=>f&&f!=='none'&&f!=='rgb(0, 0, 0)'))].slice(0,8);
return {url:location.pathname,h1:S(h),card:S(cards[0]),cardTitle:S(tit),bigNum:S(big),canvas:canv,svgCharts:svg,svgFills:fills}}"""
with sync_playwright() as p:
    b=p.chromium.connect_over_cdp(f'http://127.0.0.1:{sys.argv[1]}');pg=b.contexts[0].new_page();pg.set_viewport_size({'width':1280,'height':800})
    pg.goto(sys.argv[2],wait_until='networkidle',timeout=90000);pg.wait_for_timeout(4000)
    print(json.dumps(pg.evaluate(JS),ensure_ascii=False));pg.close()
