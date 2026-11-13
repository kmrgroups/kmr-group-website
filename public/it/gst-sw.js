// Network first. Business data lives only in the browser's own storage, so nothing private is cached here.
const V='gst-desk-v1';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(k=>k.put(e.request,c)).catch(()=>{});return r}).catch(()=>caches.match(e.request)));
});
