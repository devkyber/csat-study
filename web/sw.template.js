const CACHE='csat-study-bites-__VERSION__';
const FILES=__FILES__;
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    // The whole learning shell must be available before this version activates.
    await cache.addAll(FILES.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})));
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for (const key of await caches.keys()) if (key.startsWith('csat-study-bites-') && key!==CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{if (event.data?.type==='SKIP_WAITING') self.skipWaiting();});
self.addEventListener('fetch',event=>{
  if (event.request.method!=='GET') return;
  const url=new URL(event.request.url),scope=new URL(self.registration.scope);
  if (url.origin!==scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    // A version serves its own complete shell. Updates install into a separate
    // cache and are activated only when the learner chooses to refresh.
    const cached=await cache.match(event.request,{ignoreSearch:true});
    if (cached) return cached;
    try {return await fetch(event.request);}
    catch {
      if (event.request.mode==='navigate') return await cache.match(new URL('./index.html',scope).href);
      return new Response('인터넷 연결이 필요한 자료입니다.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
