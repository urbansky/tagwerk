/* PWA: Service Worker, Installieren, Dock-Badge */

export function registerSW(){
  if (!('serviceWorker' in navigator)) return;
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service Worker:', e)));
}

/* ---------- Installieren ---------- */
let deferred = null;
const listeners = [];
export const onInstallChange = fn => listeners.push(fn);
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; listeners.forEach(fn => fn()); });
addEventListener('appinstalled', () => { deferred = null; listeners.forEach(fn => fn('installed')); });

/** Der Browser bietet einen eigenen Installationsdialog an (nur Chrome, Edge & Co. – nie Safari) */
export const canInstall = () => !!deferred;
export const isApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
/** Für die Anleitung, wenn es keinen Installationsdialog gibt */
export function platform(ua = navigator.userAgent, touch = navigator.maxTouchPoints){
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return 'ios';   // iPadOS meldet sich als Mac
  if (/Android/.test(ua)) return /Firefox/.test(ua) ? 'android-firefox' : 'android';
  if (/Firefox/.test(ua)) return 'firefox';
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'mac-safari';
  return 'chromium';
}
export async function install(){
  if (!deferred) return false;
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null; listeners.forEach(fn => fn());
  return outcome === 'accepted';
}

/* ---------- Zahl am Dock-Icon und im Tab-Titel ---------- */
let lastBadge = null;
export function setBadge(n){
  if (n === lastBadge) return;
  lastBadge = n;
  document.title = n ? `(${n}) Tagwerk` : 'Tagwerk';
  if ('setAppBadge' in navigator) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}
