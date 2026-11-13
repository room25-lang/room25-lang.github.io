/* どぱたん Service Worker：アプリ本体はネット優先（更新をすぐ反映）、声・アイコンは保存したものを優先 */
var V="dopatan-1.45.0";
var CORE=["./","index.html","manifest.webmanifest","privacy.html","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","icons/apple-touch-icon.png","icons/favicon-48.png","img.json","expp.json","exs.json","voices/vc.mp3","voices/v8.mp3","voices/v46.mp3","voices/v47.mp3"];
self.addEventListener("install",function(e){
  e.waitUntil(caches.open(V).then(function(c){return c.addAll(CORE)}).then(function(){return self.skipWaiting()}));
});
self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==V&&k.indexOf("dopatan-")===0}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}));
});
self.addEventListener("fetch",function(e){
  var r=e.request;if(r.method!=="GET")return;
  var u=new URL(r.url);if(u.origin!==location.origin)return;
  if(/news\.json$/.test(u.pathname)){e.respondWith(fetch(u.href,{cache:"no-store"}).catch(function(){return new Response("{\"news\":[]}",{headers:{"Content-Type":"application/json"}})}));return}
  var page=r.mode==="navigate"||/\/(index\.html)?$/.test(u.pathname);
  if(page){
    /* ネットを優先。ただし1.5秒たっても返ってこない時は、保存してある版ですぐ起動する（裏で新しい版を保存） */
    var net=fetch(r.url,{cache:"no-store",credentials:"same-origin"}).then(function(res){if(res.ok){var cp=res.clone();caches.open(V).then(function(c){c.put("index.html",cp)})}return res});
    e.respondWith(new Promise(function(ok){
      var done=false,fin=function(x){if(!done&&x){done=true;ok(x)}};
      var t=setTimeout(function(){caches.match("index.html").then(fin)},1500);
      net.then(function(res){clearTimeout(t);fin(res)}).catch(function(){clearTimeout(t);caches.match("index.html").then(function(h){fin(h||Response.error())})});
    }));
    e.waitUntil(net.catch(function(){}));
    return;
  }
  e.respondWith(caches.match(r).then(function(hit){
    if(hit)return hit;
    return fetch(r).then(function(res){if(res.ok){var cp=res.clone();caches.open(V).then(function(c){c.put(r,cp)})}return res});
  }));
});
