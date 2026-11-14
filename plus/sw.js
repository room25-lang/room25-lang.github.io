/* どぱたん＋ Service Worker：本体はネット優先、画像・声・曲は保存したものを優先 */
var V="dopaplus-0.1.0";
var CORE=["./",
"index.html",
"manifest.webmanifest",
"data.json",
"icons/maskable-512.png",
"icons/favicon-48.png",
"icons/icon-192.png",
"icons/apple-touch-icon.png",
"icons/icon-512.png"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(V).then(function(c){return c.addAll(CORE)}).then(function(){return self.skipWaiting()}))});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==V&&k.indexOf("dopaplus-")===0}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener("fetch",function(e){var r=e.request;if(r.method!=="GET")return;var u=new URL(r.url);if(u.origin!==location.origin)return;
 var core=r.mode==="navigate"||/\/(index\.html|data\.json)?$/.test(u.pathname)||/data\.json$/.test(u.pathname);
 if(core){e.respondWith(fetch(r,{cache:"no-store"}).then(function(res){if(res.ok){var cp=res.clone();caches.open(V).then(function(c){c.put(r,cp)})}return res}).catch(function(){return caches.match(r).then(function(h){return h||caches.match("index.html")})}));return}
 if(/\.(mp3)$/.test(u.pathname)&&r.headers.get("range"))return;
 e.respondWith(caches.match(r).then(function(hit){return hit||fetch(r).then(function(res){if(res.ok&&res.status===200){var cp=res.clone();caches.open(V).then(function(c){c.put(r,cp)})}return res})}))});
