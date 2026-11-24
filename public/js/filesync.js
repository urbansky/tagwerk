/* Speicherordner: tagwerk.json + tägliche Sicherungen (File System Access API, nur Chromium-Browser) */
import { SCHEMA, migrate } from './state.js';
import { idbGet, idbSet, current, adopt, onSaved } from './store.js';
import { dayKey } from './day.js';
import { decide, backupName, backupsToDelete } from './syncrules.js';

export const supported = 'showDirectoryPicker' in window;
const FILE = 'tagwerk.json', BACKUPS = 'backups', KEEP = 30;

/**
 * state: 'unsupported' | 'none' (kein Ordner gewählt) | 'ok' | 'needs-permission' | 'error'
 */
export const fs = { state: supported ? 'none' : 'unsupported', dir: null, name: null, lastWrite: null, backups: null, error: null, conflict: null };
const listeners = [];
/** fn(event) – event.reloaded = true, wenn Daten aus der Datei übernommen wurden */
export const onFileStatus = fn => listeners.push(fn);
const emit = (ev = {}) => listeners.forEach(fn => fn(fs, ev));

/* ---------- Hilfen ---------- */
let chain = Promise.resolve();
const queue = fn => (chain = chain.catch(() => {}).then(fn));
const stamp = (d = new Date()) => `${dayKey(d)}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
const asText = rec => JSON.stringify({ app: 'tagwerk', schema: rec.schema ?? SCHEMA, savedAt: rec.savedAt, data: rec.data }, null, 2);

async function writeText(dir, name, text){
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();      // Chrome schreibt in eine Zwischendatei und tauscht erst beim close()
  await w.write(text); await w.close();
}
async function readText(dir, name){
  try { return await (await (await dir.getFileHandle(name)).getFile()).text(); }
  catch (e) { if (e.name === 'NotFoundError') return null; throw e; }
}
function fail(e){
  if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) { fs.state = 'needs-permission'; fs.error = null; }
  else if (e && e.name === 'NotFoundError') { fs.state = 'error'; fs.error = `Der Ordner „${fs.name}“ wurde nicht gefunden. Wurde er verschoben oder gelöscht?`; }
  else { fs.state = 'error'; fs.error = (e && e.message) || String(e); }
}

/* ---------- Sicherungen ---------- */
let backupDay = null;
/** Beim ersten Schreiben des Tages: bisherigen Stand als backups/tagwerk-JJJJ-MM-TT.json sichern. */
async function dailyBackup(){
  const today = dayKey();
  if (backupDay === today) return;
  const bdir = await fs.dir.getDirectoryHandle(BACKUPS, { create: true });
  const name = backupName(today);
  if ((await readText(bdir, name)) === null) {
    const prev = await readText(fs.dir, FILE);
    if (prev) await writeText(bdir, name, prev);
  }
  const names = []; for await (const [n] of bdir.entries()) names.push(n);
  for (const n of backupsToDelete(names, KEEP)) await bdir.removeEntry(n);
  fs.backups = Math.min(names.filter(n => n.startsWith('tagwerk-')).length, KEEP);
  backupDay = today;
}

/* ---------- Schreiben & Abgleichen ---------- */
let knownModified = null;   // lastModified der Datei nach unserem letzten Lesen/Schreiben
const fileModified = async () => { try { return (await (await fs.dir.getFileHandle(FILE)).getFile()).lastModified; } catch (e) { if (e.name === 'NotFoundError') return null; throw e; } };

async function writeRec(rec){
  await dailyBackup();
  await writeText(fs.dir, FILE, asText(rec));
  knownModified = await fileModified();
  fs.lastWrite = rec.savedAt;
  await idbSet('sync', { lastSynced: rec.savedAt });
}
async function adoptFile(file){
  const rec = { schema: SCHEMA, savedAt: file.savedAt || Date.now(), data: migrate(file) };
  await adopt(rec);
  knownModified = await fileModified();
  fs.lastWrite = rec.savedAt;
  await idbSet('sync', { lastSynced: rec.savedAt });
}

/** Gleicht Browser und Datei ab (beim Start, nach Ordnerwahl und wenn das Fenster wieder aktiv wird). */
export function sync(){
  return queue(async () => {
    let reloaded = false;
    try {
      const meta = (await idbGet('sync')) || {};
      let file = null;
      const text = await readText(fs.dir, FILE);
      if (text) {
        try { file = JSON.parse(text); migrate(file); }
        catch (e) {                         // unlesbare Datei nicht überschreiben, sondern beiseitelegen
          const bdir = await fs.dir.getDirectoryHandle(BACKUPS, { create: true });
          await writeText(bdir, `tagwerk-unlesbar-${stamp()}.json`, text);
          file = null;
        }
      }
      const d = decide(current, file, meta.lastSynced ?? null);
      if (d === 'read') { await adoptFile(file); reloaded = true; }
      else if (d === 'write') { if (current) await writeRec(current); }
      else if (d === 'same') { fs.lastWrite = file.savedAt; knownModified = await fileModified(); await idbSet('sync', { lastSynced: file.savedAt }); }
      else fs.conflict = { local: current, file };
      fs.state = 'ok'; fs.error = null;
    } catch (e) { fail(e); }
    emit({ reloaded });
  });
}

/** Konflikt auflösen: 'file' = Stand aus dem Ordner, 'local' = Stand aus dem Browser. Der andere wird gesichert. */
export function resolveConflict(choice){
  const c = fs.conflict; if (!c) return Promise.resolve();
  return queue(async () => {
    let reloaded = false;
    try {
      const loser = choice === 'file' ? c.local : c.file;
      const bdir = await fs.dir.getDirectoryHandle(BACKUPS, { create: true });
      await writeText(bdir, `konflikt-${stamp()}-${choice === 'file' ? 'browser' : 'datei'}.json`, asText(loser));
      if (choice === 'file') { await adoptFile(c.file); reloaded = true; }
      else await writeRec(c.local);
      fs.conflict = null;
    } catch (e) { fail(e); }
    emit({ reloaded });
  });
}

// Jeder gespeicherte Stand landet auch in der Datei
onSaved(rec => {
  if (fs.state !== 'ok' || fs.conflict) return;
  queue(async () => {
    try {
      // Wurde die Datei inzwischen von außen geändert (z. B. über iCloud)? Dann nicht überschreiben, sondern abgleichen.
      const mod = await fileModified();
      if (knownModified !== null && mod !== null && mod !== knownModified) { sync(); return; }
      await writeRec(rec);
    } catch (e) { fail(e); }
    emit();
  });
});

/* ---------- Ordner wählen / Zugriff ---------- */
export async function init(){
  if (!supported) { emit(); return; }
  const h = await idbGet('dir').catch(() => null);
  if (!h) { emit(); return; }
  fs.dir = h; fs.name = h.name;
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') await sync();
  else { fs.state = 'needs-permission'; emit(); }
}
/** Öffnet die Ordnerauswahl. Gibt false zurück, wenn abgebrochen wurde. */
export async function chooseFolder(){
  let h;
  try { h = await window.showDirectoryPicker({ id: 'tagwerk', mode: 'readwrite', startIn: 'documents' }); }
  catch (e) { if (e.name === 'AbortError') return false; throw e; }
  fs.dir = h; fs.name = h.name; fs.conflict = null; backupDay = null; fs.backups = null;
  await idbSet('dir', h);
  await idbSet('sync', {});                 // neuer Ordner: noch nichts abgeglichen
  await sync();
  return true;
}
/** Zugriff erneuern – muss aus einem Klick heraus aufgerufen werden. */
export async function renewPermission(){
  if (!fs.dir) return;
  const p = await fs.dir.requestPermission({ mode: 'readwrite' });
  if (p === 'granted') await sync(); else { fs.state = 'needs-permission'; emit(); }
}
/** Ordner nicht mehr verwenden (Daten bleiben im Browser und im Ordner erhalten). */
export async function forgetFolder(){
  await idbSet('dir', null); await idbSet('sync', {});
  Object.assign(fs, { state: 'none', dir: null, name: null, lastWrite: null, backups: null, error: null, conflict: null });
  emit();
}
/** Beim Zurückkehren ins Fenster: Hat sich die Datei geändert (z. B. über iCloud)? */
export function recheck(){ if (fs.state === 'ok' && !fs.conflict) return sync(); }
