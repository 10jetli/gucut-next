import json,sys
from playwright.sync_api import sync_playwright
JS=r"""()=>{const vis=e=>{const b=e.getBoundingClientRect();return b.height>0&&b.width>0};
let t=null,bn=-1;document.querySelectorAll('table').forEach(x=>{const n=x.querySelectorAll('tbody tr').length;if(vis(x)&&n>bn){bn=n;t=x}});if(!t)return null;
const c=e=>e?getComputedStyle(e):null;
const thead=t.querySelector('thead'),thr=t.querySelector('thead tr'),th=t.querySelector('thead th');
const rows=[...t.querySelectorAll('tbody tr')].filter(vis);const r1=rows[0],td=r1&&r1.querySelector('td');
let box=t.parentElement;for(let i=0;i<5&&box;i++){const s=c(box);if(s.backgroundColor!=='rgba(0, 0, 0, 0)'||s.boxShadow!=='none'||s.borderTopWidth!=='0px')break;box=box.parentElement}
const bs=c(box);
return {theadBg:[c(thead).backgroundColor,c(thr).backgroundColor,c(th).backgroundColor],thBorderB:c(th).borderBottomColor+' '+c(th).borderBottomWidth,
thH:Math.round(th.getBoundingClientRect().height),rowH:rows.slice(0,3).map(r=>Math.round(r.getBoundingClientRect().height)),
tdBorder:[c(td).borderTopColor+' '+c(td).borderTopWidth,c(td).borderBottomColor+' '+c(td).borderBottomWidth,c(r1).borderBottomColor+' '+c(r1).borderBottomWidth],
tdPad:c(td).padding,rowBg:[c(r1).backgroundColor,rows[1]?c(rows[1]).backgroundColor:null],tblBg:c(t).backgroundColor,
box:{bg:bs.backgroundColor,shadow:bs.boxShadow.slice(0,60),border:bs.borderTopColor+' '+bs.borderTopWidth,radius:bs.borderTopLeftRadius,pad:bs.padding}}}"""
pairs=json.loads(sys.argv[3])
with sync_playwright() as p:
    b=p.chromium.connect_over_cdp(f'http://127.0.0.1:{sys.argv[1]}');pg=b.contexts[0].new_page();pg.set_viewport_size({'width':1280,'height':800})
    out={}
    for k,u in pairs.items():
        try: pg.goto(sys.argv[2]+u,wait_until='networkidle',timeout=90000);pg.wait_for_timeout(2500);out[k]=pg.evaluate(JS)
        except Exception as e: out[k]={'err':str(e)[:80]}
    pg.close();print(json.dumps(out,ensure_ascii=False))
