/* Speicherung im Browser (IndexedDB) + Schreibsperre, damit nur ein Fenster speichert */
import { snapshot, applyData, migrate } from './state.js';

const DB = 'tagwerk', STORE = 'kv', KEY = 'state', LOCK = 'tagwerk-writer';

export const status = { savedAt: null, error: null, readOnly: false, persisted: null };
const listeners = [];
export const onStatus = fn => listeners.push(fn);
const emit = () => listeners.forEach(fn => fn(status));

/* ---------- IndexedDB ---------- */
let dbp = null;
function db(){
  return dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key){
  const d = await db();
  return new Promise((res, rej) => { const r = d.transaction(STORE).objectStore(STORE).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function idbSet(key, val){
  const d = await db();
  return new Promise((res, rej) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(val, key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
}

/* ---------- Laden & Speichern ---------- */
let last = null, timer = null;

/** Lädt den gespeicherten Stand. Gibt false zurück, wenn noch nichts gespeichert ist. */
export async function load(){
  const rec = await idbGet(KEY);
  if (!rec) return false;
  applyData(migrate(rec));
  last = JSON.stringify(rec.data); status.savedAt = rec.savedAt || null; emit();
  return true;
}

/** Nach jeder Änderung aufrufen – speichert gebündelt. */
export function scheduleSave(){
  if (status.readOnly) return;
  clearTimeout(timer); timer = setTimeout(flush, 300);
}

export async function flush(){
  clearTimeout(timer); timer = null;
  if (status.readOnly) return;
  const snap = snapshot(), json = JSON.stringify(snap.data);
  if (json === last) return;
  last = json;
  const rec = { schema: snap.schema, savedAt: Date.now(), data: JSON.parse(json) };
  try { await idbSet(KEY, rec); status.savedAt = rec.savedAt; status.error = null; }
  catch (e) { status.error = e && e.message || 'Speichern fehlgeschlagen'; last = null; }
  emit();
}

addEventListener('pagehide', () => flush());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

/** Bittet den Browser, die Daten nicht von selbst zu löschen. */
export async function requestPersist(){
  if (!navigator.storage || !navigator.storage.persist) return;
  try { status.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist()); } catch (e) { /* egal */ }
  emit();
}

/* ---------- Nur ein Fenster schreibt ---------- */
function hold(opts, onLost){
  return new Promise(resolve => {
    navigator.locks.request(LOCK, opts, lock => {
      if (!lock) { resolve(false); return; }
      resolve(true);
      return new Promise(() => {});           // Sperre halten, solange das Fenster offen ist
    }).catch(async () => {                    // ein anderes Fenster hat übernommen
      await flush();                          // letzten Stand noch schnell sichern
      status.readOnly = true; clearTimeout(timer); emit(); onLost && onLost();
    });
  });
}
/** true, wenn dieses Fenster schreiben darf */
export async function acquireLock(onLost){
  if (!navigator.locks) return true;
  const ok = await hold({ ifAvailable: true }, onLost);
  status.readOnly = !ok; emit();
  return ok;
}
/** Übernimmt das Schreiben von einem anderen Fenster und lädt dessen letzten Stand. */
export async function takeOver(onLost){
  await hold({ steal: true }, onLost);
  status.readOnly = false;
  await new Promise(r => setTimeout(r, 400));  // dem anderen Fenster Zeit für sein letztes Speichern geben
  await load();
  emit();
}
