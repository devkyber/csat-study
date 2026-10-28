const CACHE='csat-study-bites-45e13b9239de1ed0';
const FILES=["./", "index.html", "app.js", "ui.js", "archive.js", "examples.js", "practice.js", "bites.js", "bite-engine.mjs", "offline.js", "style.css", "bites.css", "manifest.webmanifest", "favicon.svg", "icons/app-192.png", "icons/app-512.png", "fonts/Pretendard.woff2", "vendor/marked.esm.js", "vendor/purify.min.js", "vendor/katex.min.js", "vendor/katex.min.css", "vendor/auto-render.min.js", "math-labs.js", "math-geometry.mjs", "math-labs.css", "vendor/fonts/KaTeX_AMS-Regular.woff2", "vendor/fonts/KaTeX_Caligraphic-Bold.woff2", "vendor/fonts/KaTeX_Caligraphic-Regular.woff2", "vendor/fonts/KaTeX_Fraktur-Bold.woff2", "vendor/fonts/KaTeX_Fraktur-Regular.woff2", "vendor/fonts/KaTeX_Main-Bold.woff2", "vendor/fonts/KaTeX_Main-BoldItalic.woff2", "vendor/fonts/KaTeX_Main-Italic.woff2", "vendor/fonts/KaTeX_Main-Regular.woff2", "vendor/fonts/KaTeX_Math-BoldItalic.woff2", "vendor/fonts/KaTeX_Math-Italic.woff2", "vendor/fonts/KaTeX_SansSerif-Bold.woff2", "vendor/fonts/KaTeX_SansSerif-Italic.woff2", "vendor/fonts/KaTeX_SansSerif-Regular.woff2", "vendor/fonts/KaTeX_Script-Regular.woff2", "vendor/fonts/KaTeX_Size1-Regular.woff2", "vendor/fonts/KaTeX_Size2-Regular.woff2", "vendor/fonts/KaTeX_Size3-Regular.woff2", "vendor/fonts/KaTeX_Size4-Regular.woff2", "vendor/fonts/KaTeX_Typewriter-Regular.woff2", "data/articles.json", "data/exams.json", "data/manifest.json", "data/references.json", "data/exam-pdfs.json", "data/examples.json", "data/practice-index.json", "data/bites.json"];
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
