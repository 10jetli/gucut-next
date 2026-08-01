// GUCUT catalog — sync ค่าโรงงาน/การแก้ไข/หมวดหมู่ ระหว่างเครื่อง (แทนที่จะเก็บแค่ localStorage เครื่องเดียว)
// โหลดไฟล์นี้ก่อน index.html จะได้ patch localStorage.setItem ทันเวลา
(function(){
  var LS_OVR="gucut_overrides_v1", LS_CAT="gucut_catmap_v1", LS_CATNEW="gucut_catnew_v1", LS_FAC="gucut_factories_v1";
  var SHARED_KEYS=[LS_OVR,LS_CAT,LS_CATNEW,LS_FAC];
  var origSetItem=localStorage.setItem.bind(localStorage);
  var timer=null;
  function getAll(){
    return {
      ovr: JSON.parse(localStorage.getItem(LS_OVR)||"{}"),
      catMap: JSON.parse(localStorage.getItem(LS_CAT)||"{}"),
      catNew: JSON.parse(localStorage.getItem(LS_CATNEW)||"[]"),
      facs: JSON.parse(localStorage.getItem(LS_FAC)||"[]")
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
  fetch("/api/catalog/state",{cache:"no-store"}).then(function(r){return r.ok?r.json():null;}).then(function(j){
    if(j&&j.exists){
      var newOvr=JSON.stringify(j.ovr||{});
      var newCat=JSON.stringify(j.catMap||{});
      var newCatNew=JSON.stringify(j.catNew||[]);
      var newFac=JSON.stringify(j.facs||[]);
      var changed = newOvr!==(localStorage.getItem(LS_OVR)||"{}") ||
                    newCat!==(localStorage.getItem(LS_CAT)||"{}") ||
                    newCatNew!==(localStorage.getItem(LS_CATNEW)||"[]") ||
                    newFac!==(localStorage.getItem(LS_FAC)||"[]");
      origSetItem(LS_OVR,newOvr);
      origSetItem(LS_CAT,newCat);
      origSetItem(LS_CATNEW,newCatNew);
      origSetItem(LS_FAC,newFac);
      if(changed) location.reload();
    }else{
      var cur=getAll();
      var hasLocal=(cur.facs&&cur.facs.length)||Object.keys(cur.ovr||{}).length||Object.keys(cur.catMap||{}).length||(cur.catNew&&cur.catNew.length);
      if(hasLocal)queueSync();
    }
  }).catch(function(){});
})();
