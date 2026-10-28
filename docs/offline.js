let registration, ready=false, failed=false, installPrompt;
const labels=()=>document.querySelectorAll('[data-offline-status]');
export function refreshOfflineStatus() {
  const text=ready ? navigator.onLine ? '짧은 공부를 이 기기에 저장했어요. 다음에는 오프라인에서도 열 수 있어요.' : '오프라인이에요. 저장된 짧은 공부를 계속할 수 있어요.' : failed ? '지금은 온라인으로 이용해 주세요. 이 기기의 오프라인 준비를 마치지 못했어요.' : '인터넷 연결 없이도 볼 수 있도록 준비하고 있어요.';
  labels().forEach(el=>el.textContent=text);
  document.querySelectorAll('[data-install]').forEach(button=>button.hidden=!installPrompt);
}
function updateNotice() {
  const bar=document.getElementById('app-update');if (!bar) return;
  bar.hidden=!registration?.waiting;
}
export async function startOffline() {
  window.addEventListener('online',refreshOfflineStatus);window.addEventListener('offline',refreshOfflineStatus);
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;refreshOfflineStatus();});
  window.addEventListener('appinstalled',()=>{installPrompt=null;refreshOfflineStatus();});
  document.addEventListener('click',async event=>{
    if (event.target.closest('[data-install]') && installPrompt) {
      const prompt=installPrompt;installPrompt=null;await prompt.prompt();refreshOfflineStatus();
    }
    if (event.target.closest('[data-app-update]') && registration?.waiting) {
      navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
      registration.waiting.postMessage({type:'SKIP_WAITING'});
    }
  });
  if (!('serviceWorker' in navigator)) {failed=true;refreshOfflineStatus();return;}
  try {
    registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
    updateNotice();
    const watchInstall=worker=>{
      if (!worker) return;
      const changed=()=>{
        if (worker.state==='installed') updateNotice();
        if (worker.state==='redundant' && !registration.active) {failed=true;refreshOfflineStatus();}
      };
      worker.addEventListener('statechange',changed);changed();
    };
    watchInstall(registration.installing);
    registration.addEventListener('updatefound',()=>watchInstall(registration.installing));
    await navigator.serviceWorker.ready;ready=true;refreshOfflineStatus();updateNotice();
  } catch {failed=true;refreshOfflineStatus();}
}
