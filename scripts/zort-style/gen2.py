import json,sys
from playwright.sync_api import sync_playwright
JS=r"""()=>{const S=e=>{if(!e)return null;const c=getComputedStyle(e),b=e.getBoundingClientRect();return {f:c.fontFamily.split(',')[0].replace(/["']/g,''),fs:c.fontSize,fw:c.fontWeight,c:c.color,bg:c.backgroundColor,bd:c.borderTopColor+' '+c.borderTopWidth,r:c.borderTopLeftRadius,h:Math.round(b.height),w:Math.round(b.width)}};
const vis=e=>{const b=e.getBoundingClientRect();return b.height>0&&b.width>0&&!e.closest('nav,aside,header')};
const inp=[...document.querySelectorAll('input[type=text],input[type=search],input:not([type])')].find(vis);
const sel=[...document.querySelectorAll('select')].find(vis);
const tabs=[...document.querySelectorAll('[role=tab],.nav-tabs a,.nav-tabs li a')].filter(vis);
const pg=[...document.querySelectorAll('.pagination a,.pagination li a,nav[aria-label] a,[class*=pagin] a,[class*=pagin] button,[aria-label*=หน้า] button')].filter(vis);
const pgActive=[...document.querySelectorAll('.pagination .active a,.pagination li.active a,[aria-current=page]')].find(vis);
return {input:S(inp),inputPh:inp?inp.placeholder:null,select:S(sel),tab:S(tabs[1]||null),pager:S(pg.find(e=>/^\d+$/.test((e.innerText||'').trim())&&e!==pgActive)||null),pagerActive:S(pgActive)}}"""
pairs=json.loads(sys.argv[3])
with sync_playwright() as p:
    b=p.chromium.connect_over_cdp(f'http://127.0.0.1:{sys.argv[1]}');pg=b.contexts[0].new_page();pg.set_viewport_size({'width':1280,'height':800})
    out={}
    for k,u in pairs.items():
        try: pg.goto(sys.argv[2]+u,wait_until='networkidle',timeout=90000);pg.wait_for_timeout(2500);out[k]=pg.evaluate(JS)
        except Exception as e: out[k]={'err':str(e)[:80]}
    pg.close();print(json.dumps(out,ensure_ascii=False))
