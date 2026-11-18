/* どぱたん Service Worker：アプリ本体はネット優先（更新をすぐ反映）、声・アイコンは保存したものを優先 */
var V="dopatan-2.1.0";
var CORE=["./","index.html","manifest.webmanifest","privacy.html","terms.html","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","icons/apple-touch-icon.png","icons/favicon-48.png","img.json","expp.json","exs.json","voices/v8.mp3","voices/v46.mp3","voices/v47.mp3"];
self.addEventListener("install",function(e){
  e.waitUntil(caches.open(V).then(function(c){return c.addAll(CORE)}).then(function(){return self.skipWaiting()}));
});
self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==V&&k.indexOf("dopatan-")===0}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}));
});
self.addEventListener("fetch",function(e){
  var r=e.request;if(r.method!=="GET")return;
  var u=new URL(r.url);if(u.origin!==location.origin)return;
  /* 同じサイトに置いた別アプリ（しぼるん）には関わらない */
  if(u.pathname.indexOf("/shiborun/")===0||u.pathname==="/shiborun")return;
  /* 提出版（/dopatan/）には関わらない */
  if(u.pathname.indexOf("/dopatan/")===0||u.pathname==="/dopatan")return;
  if(u.pathname.indexOf("/gck2026/")===0||u.pathname==="/gck2026")return;
  if(/news\.json$/.test(u.pathname)){e.respondWith(fetch(u.href,{cache:"no-store"}).catch(function(){return new Response("{\"news\":[]}",{headers:{"Content-Type":"application/json"}})}));return}
  var page=r.mode==="navigate"||/\/(index\.html)?$/.test(u.pathname);
  if(page){
    /* ネットを優先。ただし1.5秒たっても全部届かない時は、保存してある版ですぐ起動する（裏で新しい版を保存） */
    /* 本文を最後まで受け取ってから使う（回線が遅い時に、途中までしか届いていない画面で止まらないように） */
    var net=fetch(r.url,{cache:"no-store",credentials:"same-origin"}).then(function(res){
      if(!res.ok)return res;
      var h=new Headers(res.headers);
      return res.blob().then(function(bl){caches.open(V).then(function(c){c.put("index.html",new Response(bl,{headers:h}))});return new Response(bl,{status:200,headers:h})});
    });
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
