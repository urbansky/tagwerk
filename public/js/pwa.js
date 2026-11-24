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

export const canInstall = () => !!deferred;
export const isApp = () => matchMedia('(display-mode: standalone)').matches;
export async function install(){
  if (!deferred) return false;
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null; listeners.forEach(fn => fn());
  return outcome === 'accepted';
}

/* ---------- Zahl am Dock-Icon ---------- */
let lastBadge = null;
export function setBadge(n){
  if (n === lastBadge || !('setAppBadge' in navigator)) return;
  lastBadge = n;
  (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}
