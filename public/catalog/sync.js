// GUCUT catalog — sync ค่าโรงงาน/การแก้ไข/หมวดหมู่ ระหว่างเครื่อง (แทนที่จะเก็บแค่ localStorage เครื่องเดียว)
// โหลดไฟล์นี้ก่อน index.html จะได้ patch localStorage.setItem ทันเวลา
(function(){
  var LS_OVR="gucut_overrides_v1", LS_CAT="gucut_catmap_v1", LS_CATNEW="gucut_catnew_v1", LS_FAC="gucut_factories_v1",LS_CATDONE="gucut_catdone_v1";
  var SHARED_KEYS=[LS_OVR,LS_CAT,LS_CATNEW,LS_FAC,LS_CATDONE];
  var origSetItem=localStorage.setItem.bind(localStorage);
  var timer=null;
  function getAll(){
    return {
      ovr: JSON.parse(localStorage.getItem(LS_OVR)||"{}"),
      catMap: JSON.parse(localStorage.getItem(LS_CAT)||"{}"),
      catNew: JSON.parse(localStorage.getItem(LS_CATNEW)||"[]"),
      facs: JSON.parse(localStorage.getItem(LS_FAC)||"[]"),
      catDone: JSON.parse(localStorage.getItem(LS_CATDONE)||"[]")
    };
  }
  function queueSync(){
    clearTimeout(timer);
    timer=setTimeout(function(){
      fetch("/api/catalog/state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(getAll())}).catch(function(){});
    },600);
  }
  localStorage.setItem=function(k,v){
    origSetItem(k,v);
    if(SHARED_KEYS.indexOf(k)>=0)queueSync();
  };

  // ═══════════════════════════════════════════════════════════════════════
  // งานครั้งเดียว: เติม OEM + HH SKU จากชีตของเจ้าของร้าน (1 ก.ย. 2569)
  //   MS440 — OEM 59 · HH 59   (แถว 05756 → 05822)
  //   MS660 — OEM  9 · HH 10   (04421 ไม่มี OEM ในชีต จึงใส่แต่ HH)
  //
  // ⚠️ SKU ในคลังบางตัวมีหางต่อท้าย ไม่ตรงกับชีตเป๊ะ ๆ
  //    เช่น ชีตเขียน 05428 แต่ในคลังคือ "05428 set เสื้อสูบ"
  //    แม็ปให้ตรงตั้งแต่ตอนสร้างไฟล์แล้ว — ไม่แม็ป = เขียน override
  //    ให้ SKU ที่ไม่มีอยู่จริง ค่าไม่ขึ้นหน้าจอและไม่มีอะไรฟ้อง
  //
  // ของเดิมในคลังบางแถวมีขยะ เช่น 05774 เป็น "PB440S003A1128 790 9150"
  // (HH SKU ต่อกับ OEM ติดเป็นพืด) ⇒ เขียนทับด้วยค่าสะอาดจากชีต
  //
  // 🗑️ ลบทิ้งได้เมื่อ: ยืนยันแล้วว่าค่าขึ้นครบใน /catalog และเซฟลงเซิร์ฟเวอร์แล้ว
  //    (ลบทั้งบล็อกนี้ + ไฟล์ oem-ms440.json + hh-ms440.json)
  //
  // ⚠️ แยกเป็นสองไฟล์โดยตั้งใจ ห้ามยุบรวมเป็นไฟล์เดียวรูปแบบใหม่
  //    เบราว์เซอร์ที่ยังแคช sync.js ตัวเก่าไว้จะอ่านไฟล์รูปแบบใหม่ไม่เป็น
  //    แล้วยัด object ทั้งก้อนลงช่อง oem — ขยะเข้าเซิร์ฟเวอร์ทันที
  //    เพิ่มไฟล์ใหม่ = ตัวเก่าไม่รู้จักแล้วข้ามไปเฉย ๆ ปลอดภัยกว่า
  // ⚠️ เขียนเฉพาะช่องที่ระบุ — รูป หมวด โรงงาน ของเดิมต้องไม่หาย
  // ⚠️ ต้องทำงาน "หลัง" ดึงค่าจากเซิร์ฟเวอร์มาทับ localStorage แล้วเท่านั้น
  //    ทำก่อน = ค่าที่เพิ่งเติมจะโดนของเซิร์ฟเวอร์ทับหายทันที
  // ⚠️ ห้าม reload เกินหนึ่งครั้งต่อแท็บ — ถ้าเซิร์ฟเวอร์เซฟไม่ติด
  //    รอบถัดไปจะเติมใหม่แล้ว reload อีก วนไม่รู้จบ (กันด้วย sessionStorage)
  var SEED_FLAG="gucut_oem_ms440_v1";
  // เพิ่มรุ่นใหม่ = เพิ่มไฟล์ + เพิ่มบรรทัดที่นี่ ห้ามแก้รูปแบบไฟล์เดิม
  var SEEDS=[["oem-ms440.json","oem"],["hh-ms440.json","hh"],
             ["oem-ms660.json","oem"],["hh-ms660.json","hh"]];
  function applySeed(file,field){
    return fetch(file,{cache:"no-store"})
      .then(function(r){return r.ok?r.json():null;})
      .then(function(map){
        if(!map||typeof map!=="object")return false;
        var ovr=JSON.parse(localStorage.getItem(LS_OVR)||"{}"),n=0;
        Object.keys(map).forEach(function(sku){
          if(typeof map[sku]!=="string"||!map[sku])return;   // กันค่าที่ไม่ใช่ข้อความ
          var cur=ovr[sku]||{};
          if((cur[field]||"")===map[sku])return;             // ตรงอยู่แล้ว ไม่ต้องเขียนซ้ำ
          cur[field]=map[sku];ovr[sku]=cur;n++;
        });
        if(!n)return false;
        origSetItem(LS_OVR,JSON.stringify(ovr));
        return true;
      })
      .catch(function(){return false;});       // โหลดไม่ได้ = ข้ามไปเงียบ ๆ ห้ามทำหน้าพัง
  }
  // ทีละไฟล์ตามลำดับ ห้ามยิงพร้อมกัน — ต่างคนต่างอ่าน localStorage ก้อนเดิม
  // แล้วเขียนทับกันเอง ของที่เขียนก่อนหายทันที
  function applyOemSeed(){
    return SEEDS.reduce(function(chain,s){
      return chain.then(function(any){
        return applySeed(s[0],s[1]).then(function(hit){return any||hit;});
      });
    },Promise.resolve(false));
  }
  function pushNow(){
    return fetch("/api/catalog/state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(getAll())}).catch(function(){});
  }
  // ═══════════════════════════════════════════════════════════════════════

  fetch("/api/catalog/state",{cache:"no-store"}).then(function(r){return r.ok?r.json():null;}).then(function(j){
    if(j&&j.exists){
      var newOvr=JSON.stringify(j.ovr||{});
      var newCat=JSON.stringify(j.catMap||{});
      var newCatNew=JSON.stringify(j.catNew||[]);
      var newFac=JSON.stringify(j.facs||[]);
      var newDone=JSON.stringify(j.catDone||[]);
      var changed = newOvr!==(localStorage.getItem(LS_OVR)||"{}") ||
                    newCat!==(localStorage.getItem(LS_CAT)||"{}") ||
                    newCatNew!==(localStorage.getItem(LS_CATNEW)||"[]") ||
                    newFac!==(localStorage.getItem(LS_FAC)||"[]") ||
                    newDone!==(localStorage.getItem(LS_CATDONE)||"[]");
      origSetItem(LS_OVR,newOvr);
      origSetItem(LS_CAT,newCat);
      origSetItem(LS_CATNEW,newCatNew);
      origSetItem(LS_FAC,newFac);
      origSetItem(LS_CATDONE,newDone);
      return applyOemSeed().then(function(seeded){
        if(seeded)return pushNow().then(function(){
          if(sessionStorage.getItem(SEED_FLAG))return;   // เติมไปแล้วรอบนึง ไม่ reload ซ้ำ
          sessionStorage.setItem(SEED_FLAG,"1");
          location.reload();
        });
        if(changed)location.reload();
      });
    }else{
      var cur=getAll();
      var hasLocal=(cur.facs&&cur.facs.length)||Object.keys(cur.ovr||{}).length||Object.keys(cur.catMap||{}).length||(cur.catNew&&cur.catNew.length)||(cur.catDone&&cur.catDone.length);
      return applyOemSeed().then(function(seeded){
        if(seeded)return pushNow();
        if(hasLocal)queueSync();
      });
    }
  }).catch(function(){});
})();
