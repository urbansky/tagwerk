/* Tagwerk – Oberfläche: Rendering, Overlays, Maus & Tastatur */
import { S, snapshot, migrate, applyData } from './state.js';
import {
  find, path, isLeaf, openCount, getList, todayCounts, newProject, newSection, insertAfter, appendTask,
  firstInSection, markDone, undone, applyTitle, indent, outdent, moveItem, reorder, deleteNode,
  removeWithUndo, restoreDeleted, lastDeleted, newTask, renameProject,
  isResting, leafIds, canRestore, setRepeat, setDue, skipOccurrence
} from './model.js';
import { parseNotes, looksLikeSection, toModel } from './parser.js';
import { htmlToNotes, looksStructured } from './htmlimport.js';
import { dateStr, rollover, shouldPromptPlan, msToMidnight, dueTasks, dayKey } from './day.js';
import { describe, dueLabel, REPEAT_CHOICES, choiceKey, isDayKey } from './repeat.js';
import { status, onStatus, load, scheduleSave, flush, requestPersist, acquireLock, takeOver, current } from './store.js';
import { fs, supported as fsSupported, onFileStatus, init as fsInit, chooseFolder, renewPermission, forgetFolder, resolveConflict, recheck } from './filesync.js';
import { summarize } from './syncrules.js';
import { canInstall, install, isApp, platform, onInstallChange, setBadge } from './pwa.js';

/* ---------- Icons ---------- */
const RAYS = 'M12 2.4v2.3M12 19.3v2.3M2.4 12h2.3M19.3 12h2.3M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6';
const I = {
  sun:`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="${RAYS}"/></svg>`,
  sunFill:`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.6" fill="currentColor"/><path d="${RAYS}"/></svg>`,
  sunSm:`<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4.6" fill="currentColor"/><path d="${RAYS}"/></svg>`,
  sunBig:`<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.6" fill="currentColor"/><path d="${RAYS}"/></svg>`,
  check:`<svg viewBox="0 0 12 12"><path d="M2.5 6.3l2.4 2.4 4.6-5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  checkS:`<svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.3l2.4 2.4 4.6-5"/></svg>`,
  chev:`<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>`,
  grip:`<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><circle cx="5.5" cy="3.5" r="1.3"/><circle cx="10.5" cy="3.5" r="1.3"/><circle cx="5.5" cy="8" r="1.3"/><circle cx="10.5" cy="8" r="1.3"/><circle cx="5.5" cy="12.5" r="1.3"/><circle cx="10.5" cy="12.5" r="1.3"/></svg>`,
  plus:`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>`,
  star:`<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 1.5l1.9 4 4.4.5-3.3 3 .9 4.3L8 11.1 4.1 13.3l.9-4.3-3.3-3 4.4-.5z"/></svg>`,
  note:`<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 4h10M3 8h10M3 12h6"/></svg>`,
  more:`<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><circle cx="3.5" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="12.5" cy="8" r="1.4"/></svg>`,
  clock:`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.4 1.5"/></svg>`,
  x:`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>`,
  info:`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 7.3v3.9M8 4.9v.1"/></svg>`,
  link:`<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 014 4l-1 1M9 11.5l-1 1a2.8 2.8 0 01-4-4l1-1"/></svg>`,
  undo:`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 3.5L2.5 6.5l3 3"/><path d="M2.5 6.5h7a3.5 3.5 0 010 7H7"/></svg>`,
  paste:`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="3" width="10" height="11" rx="2"/><path d="M6 3V2h4v1M5.5 7h5M5.5 10h3.5" stroke-linecap="round"/></svg>`,
  down:`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/></svg>`,
  up:`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10.5v-8M4.5 6L8 2.5 11.5 6M3 13.5h10"/></svg>`,
  folder:`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M2 4.5A1.5 1.5 0 013.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5z"/></svg>`,
  trash:`<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5h11M6.5 4.5V3a1 1 0 011-1h1a1 1 0 011 1v1.5M4 4.5l.7 8.6a1 1 0 001 .9h4.6a1 1 0 001-.9l.7-8.6M6.7 7v4.5M9.3 7v4.5"/></svg>`,
  rep:`<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 7.2A5.4 5.4 0 0 1 12.2 4.4L13.4 5.6M13.4 2.4v3.2h-3.2M13.4 8.8A5.4 5.4 0 0 1 3.8 11.6L2.6 10.4M2.6 13.6v-3.2h3.2"/></svg>`,
  keyb:`<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="4" width="13" height="8.5" rx="1.8"/><path d="M4.5 7h.01M7 7h.01M9.5 7h.01M12 7h.01M5 10h6"/></svg>`,
};
const sunArt = () => `<div class="sunart"><div class="rays">${[0,1,2,3,4,5,6,7].map(i=>`<i style="transform:rotate(${i*45}deg)"></i>`).join('')}</div><div class="core"></div></div>`;

/* ---------- Helpers ---------- */
const $ = (s, el=document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today = () => S.day || dayKey();
/** „morgen“ bzw. „am Do., 24. Dez.“ */
const onDay = due => { const l = dueLabel(due, today()); return l === 'heute' || l === 'morgen' ? l : 'am ' + l; };
/** Hinweis an wiederkehrenden Aufgaben: nächster Termin (ruhend/erledigt) oder „fällig“ */
function repChip(n){
  if (!n.repeat) return '';
  const tip = esc(describe(n.repeat, n.due));
  if (n.done || isResting(n)) return `<span class="chip rep" title="${tip}">${I.rep}${esc(dueLabel(n.due, today()))}</span>`;
  return `<span class="chip rep due" title="${tip}">${I.rep}fällig</span>`;
}


function fmtTitle(s){
  s = String(s).replace(/\(\s*(https?:\/\/[^\s)]+)\s*\)/g, ' $1');
  let out = '', last = 0, m; const re = /https?:\/\/[^\s)]+/g;
  while ((m = re.exec(s))) {
    out += esc(s.slice(last, m.index));
    let host; try { host = new URL(m[0]).hostname.replace(/^www\./,''); } catch(e){ host = 'Link'; }
    out += `<a class="link" href="${esc(m[0])}" target="_blank" rel="noopener">${I.link}${esc(host)}</a>`;
    last = m.index + m[0].length;
  }
  return out + esc(s.slice(last));
}


/* ---------- Render: main ---------- */
let rendering = false, renderCount = 0;
function render(){
  rendering = true; renderCount++;
  $('#app').innerHTML = renderTop() + `<main class="wrap">${storageBanner()}${renderToday()}${renderProjects()}<p class="foot"><span id="saveState">${saveStateText()}</span><span class="kb-only"> · <kbd>?</kbd> zeigt alle Tastenkürzel</span></p></main>`;
  rendering = false;
  afterRender();
  scheduleSave();
  const { done, total } = todayCounts(); setBadge(total - done);
}
onInstallChange(ev => { if (ev === 'installed') toast('☀️ Tagwerk ist jetzt als App installiert'); render(); });
const hhmm = ts => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const when = ts => { const d = new Date(ts), t = new Date(); return d.toDateString() === t.toDateString() ? `heute ${hhmm(ts)} Uhr` : `${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} ${hhmm(ts)} Uhr`; };
function saveStateText(){
  if (status.error) return `<span style="color:var(--danger)">⚠︎ Speichern fehlgeschlagen: ${esc(status.error)}</span>`;
  if (!status.savedAt) return 'Wird in diesem Browser gespeichert';
  const where = fs.state === 'ok' ? `im Browser und im Ordner „${esc(fs.name)}“` : 'nur in diesem Browser';
  return `✓ Gespeichert ${hhmm(status.savedAt)} Uhr – ${where}`;
}
onStatus(() => { const el = $('#saveState'); if (el) el.innerHTML = saveStateText(); renderLockScreen(); });

/* ---------- Speicherort ---------- */
function storageChip(){
  const s = fs.state;
  if (s === 'ok' && !fs.conflict) return `<button class="btn st ok" data-act="storage" title="Gespeichert im Ordner „${esc(fs.name)}“">${I.folder}<span class="lbl-t">${esc(fs.name)}</span></button>`;
  if (s === 'needs-permission') return `<button class="btn st warn" data-act="fs-renew" title="Tagwerk darf gerade nicht in den Ordner schreiben">${I.folder}<span class="lbl-t">Zugriff erneuern</span></button>`;
  if (s === 'error' || fs.conflict) return `<button class="btn st err" data-act="storage">${I.folder}<span class="lbl-t">${fs.conflict ? 'Konflikt' : 'Ordner-Problem'}</span></button>`;
  return `<button class="btn st ${s === 'none' ? 'warn' : ''}" data-act="storage" title="Speicherort">${I.folder}<span class="lbl-t">Nur im Browser</span></button>`;
}
function storageBanner(){
  if (status.readOnly) return '';
  if (fs.conflict) return `<div class="banner err">${I.folder}<div><b>Ordner und Browser haben unterschiedliche Stände.</b> Entscheide, welcher gelten soll – der andere wird gesichert.</div><button class="btn sm primary" data-act="fs-conflict">Ansehen</button></div>`;
  if (fs.state === 'needs-permission') return `<div class="banner warn">${I.folder}<div><b>Tagwerk darf gerade nicht in deinen Ordner „${esc(fs.name)}“ schreiben.</b> Der Browser fragt nach einem Neustart manchmal erneut. Bis dahin wird nur im Browser gespeichert.</div><button class="btn sm primary" data-act="fs-renew">Zugriff erneuern</button></div>`;
  if (fs.state === 'error') return `<div class="banner err">${I.folder}<div><b>Speichern im Ordner klappt gerade nicht.</b> ${esc(fs.error || '')}</div><button class="btn sm" data-act="storage">Speicherort …</button></div>`;
  if (fs.state === 'none' && S.projects.length) return `<div class="banner warn">${I.folder}<div><b>Deine Aufgaben liegen bisher nur in diesem Browser.</b> Wähle einen Ordner (z. B. in iCloud Drive) – Tagwerk speichert dort automatisch mit täglichen Sicherungen.</div><button class="btn sm primary" data-act="fs-choose">Ordner wählen</button></div>`;
  return '';
}
function renderStorage(){
  const s = fs.state;
  const row = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  let body;
  if (s === 'unsupported') body = `<p>Dieser Browser kann keine Dateien in einen Ordner schreiben. Das geht nur in Chrome, Edge, Brave oder Arc.</p><p class="muted">Deine Daten liegen in diesem Browser. Sichere sie regelmäßig über <b>Backup exportieren</b>.</p>`;
  else if (s === 'none') body = `<p>Deine Aufgaben liegen bisher nur in diesem Browser. Wenn du einen Ordner wählst, schreibt Tagwerk jede Änderung automatisch in <code>tagwerk.json</code> und legt täglich eine Sicherung an.</p>
      <p class="muted">Tipp: Ein Ordner in iCloud Drive oder Dropbox ist zusätzlich in der Cloud gesichert. Wählst du einen Ordner, in dem schon eine <code>tagwerk.json</code> liegt, wird sie übernommen.</p>
      <button class="btn primary" data-act="fs-choose">${I.folder} Ordner wählen …</button>`;
  else body = `${row('Ordner', esc(fs.name || '–'))}
      ${row('Status', s === 'ok' ? (fs.conflict ? '⚠︎ Konflikt' : '✓ Speichert automatisch') : s === 'needs-permission' ? '⚠︎ Zugriff erneuern' : '⚠︎ Fehler')}
      ${row('Zuletzt in Datei geschrieben', fs.lastWrite ? when(fs.lastWrite) : '–')}
      ${row('Tägliche Sicherungen', fs.backups != null ? `${fs.backups} (die letzten 30 bleiben)` : 'im Unterordner „backups“')}
      ${fs.error ? `<p style="color:var(--danger)">${esc(fs.error)}</p>` : ''}
      <div class="st-acts">${s === 'needs-permission' ? `<button class="btn primary" data-act="fs-renew">Zugriff erneuern</button>` : ''}
        <button class="btn" data-act="fs-choose">Anderen Ordner wählen …</button>
        <button class="btn danger" data-act="fs-forget">Ordner nicht mehr verwenden</button></div>
      <p class="muted small">Im Ordner: <code>tagwerk.json</code> (immer der aktuelle Stand) und <code>backups/</code> mit dem Stand zu Beginn jedes Tages.</p>`;
  return `<div class="scrim" data-act="close-ov"></div><aside class="drawer" aria-label="Speicherort">
    <div class="d-head"><h2>${I.folder} Speicherort</h2><span class="spacer"></span><button class="ibtn" data-act="close-ov">${I.x}</button></div>
    <div class="d-body storage">${body}
      <hr><p class="muted small">Unabhängig davon kannst du jederzeit ein Backup als Datei exportieren.</p><button class="btn sm" data-act="export">${I.down} Backup exportieren</button></div>
  </aside>`;
}
function renderConflict(){
  const c = fs.conflict; if (!c) return '';
  const a = summarize(c.file), b = summarize(c.local);
  const card = (t, s, act, lbl) => `<div class="cf-card"><h3>${t}</h3><p>${s.savedAt ? `Stand: ${new Date(s.savedAt).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'ohne Zeitstempel'}</p><p class="muted">${s.projects} Projekte · ${s.open} offene Aufgaben</p><button class="btn primary" data-act="${act}">${lbl}</button></div>`;
  return `<div class="scrim"></div><div class="modal small"><div class="m-head"><div><h2>Welcher Stand soll gelten?</h2><p class="muted">Die Datei im Ordner „${esc(fs.name)}“ und dieser Browser wurden unabhängig voneinander geändert – z. B. auf einem anderen Mac. Der Stand, den du nicht wählst, wird im Ordner unter <code>backups/</code> gesichert.</p></div></div>
    <div class="cf">${card('Im Ordner', a, 'fs-use-file', 'Ordner-Stand verwenden')}${card('In diesem Browser', b, 'fs-use-local', 'Browser-Stand behalten')}</div></div>`;
}
onFileStatus((_, ev) => {
  if (ev.reloaded) { rollover(); S.focus = S.editing = null; }
  if (fs.conflict && !S.ui.ov) { openOv('conflict'); return; }
  if (S.ui.ov === 'storage' || (S.ui.ov === 'conflict' && !fs.conflict)) { if (S.ui.ov === 'conflict') { closeOv(); return; } renderOv(); }
  render();
});
async function fsAction(fn){
  try { await fn(); } catch (e) { toast(esc((e && e.message) || String(e))); }
}
function renderTop(){
  return `<header class="top"><div class="top-in">
    <div class="brand"><span class="logo">${I.sunSm}</span>Tagwerk</div><span class="spacer"></span>
    ${storageChip()}
    <button class="btn" data-act="history" title="Verlauf (H)">${I.clock}<span class="lbl-t">Verlauf</span></button>
    <button class="btn sun" data-act="plan" title="Tag planen (P)">${I.sun}<span class="lbl-t">Tag planen</span></button>
    <div class="menu"><button class="btn icon" data-act="menu" title="Mehr">${I.more}</button>${S.ui.menu ? `
      <div class="dropdown" data-act="noop">
        <button data-act="import">${I.paste} Aus Notizen importieren …</button>
        <button data-act="newproject">${I.folder} Neues Projekt</button><hr>
        <button data-act="export">${I.down} Backup exportieren (JSON)</button>
        <button data-act="importjson">${I.up} Backup einspielen (JSON) …</button><hr>
        <button data-act="storage">${I.folder} Speicherort …</button>
        ${isApp() ? '' : `<button data-act="install">${I.down} Als App installieren …</button>`}<hr>
        <button data-act="help">${I.keyb} Tastenkürzel &amp; Hilfe</button>
      </div>` : ''}</div>
  </div></header>`;
}
function mood(done, total){
  if (!total) return '';
  if (done === total) return 'Alles geschafft! 🎉';
  const left = total - done;
  if (left === 1) return 'Nur noch eine – gleich hast du es!';
  if (done === 0) return `${total} Aufgaben für heute. Eins nach dem anderen.`;
  if (done / total >= .5) return `Mehr als die Hälfte geschafft – noch ${left}. 💪`;
  return `Guter Start! Noch ${left} offen.`;
}
function ring(done, total){
  const r = 25, c = 2 * Math.PI * r, pct = total ? done / total : 0;
  return `<div class="ring"><svg width="60" height="60"><circle class="bgc" cx="30" cy="30" r="${r}" fill="none" stroke-width="6"/><circle class="fg" cx="30" cy="30" r="${r}" fill="none" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - S.lastPct)}" data-c="${c}" data-pct="${pct}"/></svg><div class="lbl">${done === total ? I.checkS.replace('width="12" height="12"','width="20" height="20"').replace('currentColor','#2fb15a') : `${done}/${total}`}</div></div>`;
}
function renderToday(){
  const { done, total } = todayCounts();
  let body;
  if (!total && !S.projects.length) {
    body = `<div class="empty">${sunArt()}
      <h3>Willkommen bei Tagwerk!</h3>
      <p>Hol dir deine Aufgaben aus der Notizen-App – oder leg direkt ein erstes Projekt an. Danach suchst du dir jeden Morgen aus, was heute dran ist.</p>
      <button class="btn sun lg" data-act="import">${I.paste} Aus Notizen importieren</button> <button class="btn lg" data-act="newproject">${I.plus} Neues Projekt</button>
      ${fsSupported && fs.state === 'none' ? `<p class="small muted" style="margin-top:18px">Schon einen Tagwerk-Ordner? <button class="linkbtn" data-act="fs-choose">Ordner öffnen …</button></p>` : ''}</div>`;
  } else if (!total) {
    const lo = S.leftovers.length, due = dueTasks().length;
    body = `<div class="empty">${sunArt()}
      <h3>${S.planned ? 'Heute ist noch nichts geplant.' : 'Guten Morgen! Was nimmst du dir heute vor?'}</h3>
      <p>${lo ? `<b>${lo} Aufgaben von gestern</b> warten auf deine Entscheidung. ` : ''}${due ? `<b>${due} wiederkehrende ${due === 1 ? 'Aufgabe ist' : 'Aufgaben sind'} fällig.</b> ` : ''}Such dir aus deinen Projekten die Aufgaben für heute heraus.</p>
      <button class="btn sun lg" data-act="plan">${I.sun} Tag planen <kbd>P</kbd></button></div>`;
  } else {
    body = `<div class="t-list" id="todayList">${S.today.map(todayRow).join('')}</div>`
      + (done === total ? `<div class="alldone"><span class="em">🎉</span><div><b>Alles geschafft!</b><br><span>${total} von ${total} Aufgaben erledigt – Feierabend verdient.</span></div></div>` : '')
      + `<div class="t-foot"><button class="addrow" data-act="plan2">${I.plus} Weitere Aufgaben für heute auswählen</button></div>`;
  }
  return `<section class="today ${total && done === total ? 'complete' : ''} ${S.celebrate ? 'celebrate' : ''}">
    <div class="t-head"><div><div class="eyebrow">${dateStr()}</div><h1>${I.sunBig} Heute</h1><div class="mood">${mood(done, total)}</div></div>
    <span class="spacer"></span>${total ? ring(done, total) : ''}</div>${body}</section>`;
}
function titleHTML(n, key){
  if (S.editing === key) return `<input class="edit" data-edit="${key}" value="${esc(n.title)}" placeholder="Neue Aufgabe">`;
  return `${n.important ? `<span class="star">${I.star}</span>` : ''}<span class="t">${n.title ? fmtTitle(n.title) : '<span class="ph">Neue Aufgabe</span>'}</span>`;
}
function todayRow(id){
  const f = find(id); if (!f) return '';
  const n = f.n, key = 't:' + id;
  return `<div class="row today-row ${n.done ? 'done' : ''} ${n.important ? 'imp' : ''} ${S.focus === key ? 'focus' : ''} ${S.flash.has(id) ? 'flash' : ''}" data-row="${key}" data-id="${id}">
    <span class="handle" data-h="today">${I.grip}</span>
    <button class="check" data-act="toggle" data-id="${id}" title="Erledigt (Leertaste)">${I.check}</button>
    <div class="title" data-act="edit" data-key="${key}">${titleHTML(n, key)}
      <div class="meta"><span class="ctx">${esc(path(f).join(' › '))}</span>${n.repeat ? `<span class="rep-ic" title="${esc(describe(n.repeat, n.due))}">${I.rep}</span>` : ''}${n.note ? `<span class="note-prev">${I.note}Notiz</span>` : ''}</div></div>
    <div class="acts"><button class="ibtn" data-act="detail" data-id="${id}" title="Details (O)">${I.info}</button></div>
    <button class="ibtn sunbtn on" data-act="today" data-id="${id}" title="Aus Heute entfernen (T)">${I.sunFill}</button>
  </div>`;
}
function renderProjects(){
  return `<div class="p-title"><h2>Projekte</h2><button class="btn sm" data-act="newproject">${I.plus} Projekt</button></div>
    <div id="projects">${S.projects.map(projectBlock).join('') || '<p class="muted small" style="margin:0 4px">Noch keine Projekte.</p>'}</div>`;
}
function projectBlock(p){
  const open = openCount(p.items);
  const tc = S.today.filter(id => { const f = find(id); return f && f.p === p && !f.n.done; }).length;
  const items = p.items.map(it => it.type === 'section' ? sectionBlock(it) : taskBlock(it)).join('');
  return `<div class="project ${p.collapsed ? 'collapsed' : ''}" data-id="${p.id}">
    <div class="p-head" data-act="collapse" data-id="${p.id}">
      <span class="handle" data-h="project">${I.grip}</span>
      <span class="chev">${I.chev}</span>
      ${S.ui.pedit === p.id
        ? `<input class="edit pedit p-name" data-pedit="${p.id}" data-act="noop" value="${esc(p.name)}" placeholder="Projektname">`
        : `<span class="p-name" data-act="p-edit" data-id="${p.id}" title="Umbenennen">${esc(p.name)}</span>`}
      <span class="chip">${open} offen</span>
      ${tc ? `<span class="chip sun">${I.sunSm} ${tc} heute</span>` : ''}
      <span class="spacer"></span>
      <button class="ibtn p-del" data-act="p-del" data-id="${p.id}" title="Projekt löschen">${I.trash}</button>
      <button class="ibtn" data-act="add" data-pid="${p.id}" title="Neue Aufgabe">${I.plus}</button>
    </div>
    ${p.collapsed ? '' : `<div class="p-body ${S.opening === p.id ? 'opening' : ''}"><div class="tasks" data-list="${p.id}">${items}</div>
      <div class="addrows"><button class="addrow" data-act="add" data-pid="${p.id}">${I.plus} Aufgabe hinzufügen</button><button class="addrow sec" data-act="add-sec" data-pid="${p.id}" title="Oder eine Aufgabe mit „:“ am Ende eingeben">${I.plus} Abschnitt</button></div></div>`}
  </div>`;
}
function sectionBlock(s){
  const key = 'p:' + s.id;
  const title = S.editing === key
    ? `<input class="edit" data-edit="${key}" data-sec="1" value="${esc(s.title)}:" placeholder="Abschnitt:">`
    : `<span class="s-title" data-act="edit" data-key="${key}" title="Umbenennen">${s.title ? esc(s.title) : '<span class="ph">Abschnitt</span>'}</span>`;
  return `<div class="item section ${s.collapsed ? 'collapsed' : ''}" data-id="${s.id}">
    <div class="s-head ${S.focus === key ? 'focus' : ''} ${S.flash.has(s.id) ? 'flash' : ''}" data-act="collapse-s" data-id="${s.id}" data-row="${key}"><span class="handle" data-h="item">${I.grip}</span><span class="chev">${I.chev}</span>${title}<span class="s-count">${openCount(s.children)}</span><span class="spacer"></span><button class="ibtn" data-act="add" data-sid="${s.id}" title="Aufgabe im Abschnitt">${I.plus}</button></div>
    ${s.collapsed ? '' : `<div class="s-body" data-list="${s.id}">${s.children.map(taskBlock).join('')}</div>`}
  </div>`;
}
function taskBlock(t){
  if (t.done && !t.repeat) return '';   // erledigte wiederkehrende bleiben gedimmt mit dem nächsten Termin stehen
  const subs = t.children.filter(c => !c.done);
  return `<div class="item ${isResting(t) ? 'resting' : ''}" data-id="${t.id}">${row(t)}${subs.length ? `<div class="subs" data-list="${t.id}">${subs.map(s => `<div class="item sub" data-id="${s.id}">${row(s)}</div>`).join('')}</div>` : ''}</div>`;
}
function row(n){
  const key = 'p:' + n.id, leaf = isLeaf(n), inT = S.today.includes(n.id);
  const subDone = n.children.filter(c => c.done).length;
  const noteLine = n.note ? n.note.split('\n')[0].replace(/^•\s*/, '') : '';
  const rest = n.repeat && (n.done || isResting(n));
  const meta = repChip(n) + (n.children.length && !n.done ? `<span class="chip">${subDone}/${n.children.length}</span>` : '') + (noteLine ? `<span class="note-prev">${I.note}${esc(noteLine)}${n.note.includes('\n') ? ' …' : ''}</span>` : '');
  return `<div class="row ${n.important ? 'imp' : ''} ${inT ? 'in-today' : ''} ${rest ? 'resting' : ''} ${n.done ? 'done' : ''} ${S.focus === key ? 'focus' : ''} ${S.flash.has(n.id) ? 'flash' : ''}" data-row="${key}" data-id="${n.id}">
    <span class="handle" data-h="item">${I.grip}</span>
    <button class="check" data-act="toggle" data-id="${n.id}" title="Erledigt (Leertaste)">${I.check}</button>
    <div class="title" data-act="edit" data-key="${key}">${titleHTML(n, key)}${meta ? `<div class="meta">${meta}</div>` : ''}</div>
    <div class="acts"><button class="ibtn" data-act="detail" data-id="${n.id}" title="Details (O)">${I.info}</button></div>
    ${leaf ? `<button class="ibtn sunbtn ${inT ? 'on' : ''} ${S.pulse === n.id ? 'pulse' : ''}" data-act="today" data-id="${n.id}" title="${inT ? 'Aus Heute entfernen' : 'Für heute einplanen'} (T)">${inT ? I.sunFill : I.sun}</button>` : `<span class="ibtn ghost"></span>`}
  </div>`;
}
function afterRender(){
  const fg = $('.ring .fg');
  if (fg) { const pct = +fg.dataset.pct, c = +fg.dataset.c; requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = c * (1 - pct); })); S.lastPct = pct; }
  else S.lastPct = 0;
  S.flash.clear(); S.pulse = null; S.celebrate = false; S.opening = null;
  const tl = $('#todayList'); if (tl) sortable(tl, '.row', 'today', ids => { S.today = ids; render(); });
  const pl = $('#projects'); if (pl) sortable(pl, '.project', 'project', ids => { S.projects = ids.map(id => S.projects.find(p => p.id === id)); render(); });
  document.querySelectorAll('#app [data-list]').forEach(c => sortable(c, '.item', 'item', ids => reorderList(c.dataset.list, ids)));
  const inp = $('#app input.edit');
  if (inp) { inp.focus(); const l = inp.value.length - (inp.dataset.sec && inp.value.endsWith(':') ? 1 : 0); inp.setSelectionRange(l, l); }
  else if (S.focus) { const el = document.querySelector(`[data-row="${S.focus}"]`); if (el) el.scrollIntoView({ block: 'nearest' }); }
}

/* ---------- Drag & Drop ---------- */
let noClickUntil = 0;
function sortable(container, sel, kind, onOrder){
  let dragEl = null;
  const items = () => [...container.children].filter(c => c.matches(sel));
  const place = y => {
    const els = items().filter(c => c !== dragEl);
    const after = els.find(el => { const b = el.getBoundingClientRect(); return y < b.top + b.height / 2; });
    if (after) { if (after.previousElementSibling !== dragEl) container.insertBefore(dragEl, after); }
    else if (els.length) { const last = els[els.length - 1]; if (last.nextElementSibling !== dragEl) last.after(dragEl); }
  };
  const finish = () => {
    if (!dragEl) return; dragEl.classList.remove('dragging'); dragEl.draggable = false; dragEl = null;
    onOrder(items().map(c => c.dataset.id));
  };
  container.addEventListener('mousedown', e => {
    const h = e.target.closest('.handle'); if (!h || h.dataset.h !== kind) return;
    const it = h.closest(sel); if (it && it.parentElement === container) it.draggable = true;
  });
  container.addEventListener('dragstart', e => {
    const it = e.target.closest && e.target.closest(sel);
    if (!it || it.parentElement !== container || !it.draggable) return;
    e.stopPropagation(); dragEl = it; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => it.classList.add('dragging'));
  });
  container.addEventListener('dragover', e => { if (dragEl) { e.preventDefault(); place(e.clientY); } });
  container.addEventListener('dragend', finish);
  // Finger und Stift: HTML5-Drag-and-Drop gibt es dort nicht – mit Pointer Events nachgebaut
  container.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || dragEl) return;
    const h = e.target.closest('.handle'); if (!h || h.dataset.h !== kind) return;
    const it = h.closest(sel); if (!it || it.parentElement !== container) return;
    e.preventDefault();
    dragEl = it; it.classList.add('dragging');
    let y = e.clientY, raf = 0;
    const scroll = () => {   // am oberen bzw. unteren Rand mitscrollen
      const edge = 70, v = y < edge ? -(edge - y) / 4 : y > innerHeight - edge ? (y - innerHeight + edge) / 4 : 0;
      if (v) { scrollBy(0, v); place(y); }
      raf = requestAnimationFrame(scroll);
    };
    raf = requestAnimationFrame(scroll);
    const move = ev => { if (ev.pointerId === e.pointerId) { y = Math.max(0, Math.min(innerHeight, ev.clientY)); place(y); } };
    const up = ev => {
      if (ev.pointerId !== e.pointerId) return;
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      noClickUntil = Date.now() + 400;   // der Tipp auf den Griff soll nicht noch Projekt auf-/zuklappen
      finish();
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
}
document.addEventListener('mouseup', () => document.querySelectorAll('[draggable="true"]').forEach(el => { if (!el.classList.contains('dragging')) el.draggable = false; }));
document.addEventListener('click', e => { if (Date.now() < noClickUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
function reorderList(listId, ids){ reorder(listId, ids); render(); }

/* ---------- Aktionen ---------- */
const CHEERS = ['Erledigt ✓', 'Stark! 💪', 'Weiter so!', 'Eins weniger ✨', 'Abgehakt!', 'Läuft bei dir 🚀'];
function toggleDone(id, btn){
  const f = find(id); if (!f) return;
  if (f.n.done) { undone(id); render(); return; }
  const rowEl = btn && btn.closest('.row');
  const inToday = rowEl && rowEl.classList.contains('today-row');
  if (rowEl) rowEl.classList.add('checking');
  if (rowEl && !inToday && !f.n.repeat) { const block = rowEl.closest('.item'); if (block) collapseOut(block); }
  const before = todayCounts();
  setTimeout(() => {
    markDone(id);
    const next = f.n.repeat ? ` · ${I.rep} wieder ${esc(onDay(f.n.due))}` : '';
    const after = todayCounts();
    const allDone = after.total && after.done === after.total && before.done < before.total && S.today.includes(id);
    S.celebrate = !!allDone; render();
    if (allDone) {
      const r = $('.ring'); const b = r ? r.getBoundingClientRect() : { left: innerWidth / 2, top: 120, width: 0, height: 0 };
      confetti(b.left + b.width / 2, b.top + b.height / 2);
      toast('🎉 Alles für heute erledigt!', id);
    } else toast(`<span>${CHEERS[Math.floor(Math.random() * CHEERS.length)]} <span style="opacity:.6">– ${esc(f.n.title.slice(0, 48))}${f.n.title.length > 48 ? '…' : ''}${next}</span></span>`, id);
  }, inToday ? 420 : 640);
}
function collapseOut(el){
  el.style.maxHeight = el.offsetHeight + 'px'; el.style.overflow = 'hidden';
  setTimeout(() => { el.style.transition = 'max-height .28s ease, opacity .28s ease, transform .28s ease'; el.style.maxHeight = '0px'; el.style.opacity = '0'; el.style.transform = 'translateX(14px)'; }, 340);
}

function toggleToday(id){
  const f = find(id); if (!f) return;
  if (!isLeaf(f.n)) { toast('Wähle für heute eine einzelne Unteraufgabe aus.'); return; }
  if (S.today.includes(id)) S.today = S.today.filter(x => x !== id);
  else { S.today.push(id); S.flash.add(id); S.pulse = id; S.planned = true; }
  render();
}
function addSection(pid){ const s = newSection(pid); S.editing = S.focus = 'p:' + s.id; render(); }
function addTask(where){ S.editing = S.focus = 'p:' + appendTask(where); render(); }
function deleteWithUndo(id){
  const r = removeWithUndo(id); if (!r) return;
  if (r.kind === 'project') {
    toast(`🗑️ Projekt gelöscht <span style="opacity:.6">– ${esc(r.title.slice(0, 40))}${r.open ? ` · ${r.open} offene ${r.open === 1 ? 'Aufgabe' : 'Aufgaben'}` : ''}</span>`, id, 'undo-del');
  } else if (r.kind === 'dissolve') {
    const t = r.title || 'Abschnitt';
    toast(`🗂️ Abschnitt aufgelöst <span style="opacity:.6">– ${esc(t.slice(0, 40))}${r.open ? ` · ${r.open} ${r.open === 1 ? 'Aufgabe bleibt' : 'Aufgaben bleiben'}` : ''}</span>`, id, 'undo-del');
  } else {
    const t = r.title || 'Neue Aufgabe';
    toast(`🗑️ Gelöscht <span style="opacity:.6">– ${esc(t.slice(0, 48))}${t.length > 48 ? '…' : ''}</span>`, id, 'undo-del');
  }
}
function undoDelete(){
  const id = restoreDeleted(); $('#toast').innerHTML = '';
  if (id) { S.flash.add(id); S.focus = 'p:' + id; }
  render();
}
function commitEdit(inp){
  const { f, change } = applyTitle(inp.dataset.edit.slice(2), inp.value);
  if (change === 'toTask') toast('Abschnitt in Aufgabe umgewandelt');
  else if (change === 'keptSection') toast('Bleibt ein Abschnitt – die Aufgaben darin haben eigene Unteraufgaben.');
  else if (change === 'toSection') S.flash.add(f.n.id);
  return f;
}

/* ---------- Toast & Konfetti ---------- */
let toastT;
function toast(html, undoId, undoAct = 'undo'){
  $('#toast').innerHTML = `<div class="toast"><span>${html}</span>${undoId ? `<button data-act="${undoAct}" data-id="${undoId}">Rückgängig <kbd>⌘Z</kbd></button>` : ''}</div>`;
  clearTimeout(toastT); toastT = setTimeout(() => $('#toast').innerHTML = '', 4200);
}
function confetti(x, y){
  const cols = ['#f5a623','#2fb15a','#0a84ff','#ff4f8b','#8e5cf7','#ffcf5c'];
  for (let i = 0; i < 80; i++) {
    const s = document.createElement('i'); s.className = 'confetti';
    s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.background = cols[i % cols.length];
    const a = Math.random() * Math.PI * 2, d = 100 + Math.random() * 280;
    s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 180 + 'px'); s.style.setProperty('--r', (Math.random() * 900 - 450) + 'deg');
    s.style.animationDelay = Math.random() * 90 + 'ms';
    document.body.appendChild(s); setTimeout(() => s.remove(), 1800);
  }
}

/* ---------- Overlays ---------- */
function openOv(kind){ S.ui.ov = kind; S.ui.menu = false; document.body.style.overflow = 'hidden'; render(); renderOv(); }
function closeOv(){ S.ui.ov = null; S.ui.plan = null; S.ui.imp = null; S.ui.detail = null; document.body.style.overflow = ''; renderOv(); render(); }
let lastOv = null;
function renderOv(){
  const o = $('#ov'), v = S.ui.ov;
  o.classList.toggle('static', !!v && v === lastOv); lastOv = v;   // Einblend-Animation nur beim ersten Öffnen
  if (!v) { o.innerHTML = ''; return; }
  if (v === 'plan') {
    o.innerHTML = renderPlan();
    if (S.ui.plan.step === 2) { renderPick(); renderDay(); sortable($('#dayList'), '.day-item', 'day', ids => { S.ui.plan.picks = ids; renderDay(); }); $('#planq').focus(); }
  }
  else if (v === 'import') { o.innerHTML = renderImport(); renderImpPreview(); $('#impText').focus(); }
  else if (v === 'history') o.innerHTML = renderHistory();
  else if (v === 'detail') o.innerHTML = renderDetail();
  else if (v === 'help') o.innerHTML = renderHelp();
  else if (v === 'install') o.innerHTML = renderInstall();
  else if (v === 'storage') o.innerHTML = renderStorage();
  else if (v === 'conflict') o.innerHTML = renderConflict();
}

/* Tag planen */
function openPlan(step){
  const due = dueTasks();
  S.ui.plan = { step: step || (S.leftovers.length || due.length ? 1 : 2), picks: [...S.today], dec: {}, due, q: '', f: null, newId: null };
  openOv('plan');
}
const hasStep1 = () => S.leftovers.length > 0 || S.ui.plan.due.length > 0;
function step1Name(){
  const lo = S.leftovers.length > 0, due = S.ui.plan.due.length > 0;
  return lo && due ? 'Gestern &amp; fällig' : due ? 'Fällig' : 'Von gestern';
}
function renderPlan(){
  const P = S.ui.plan, hasLo = hasStep1();
  return `<div class="scrim"></div><div class="modal plan" role="dialog" aria-label="Tag planen">
    <div class="plan-head">${sunArt()}
      <div><div class="eyebrow">${dateStr()}</div><h2>Guten Morgen! Lass uns deinen Tag planen.</h2></div>
      <span class="spacer"></span>
      <div class="steps">${hasLo || P.step === 1 ? `<span class="${P.step === 1 ? 'on' : 'ok'}">${P.step === 1 ? '1' : '✓'} · ${step1Name()}</span>` : ''}<span class="${P.step === 2 ? 'on' : ''}">${hasLo ? '2' : '1'} · Aufgaben wählen</span></div>
      <button class="ibtn" data-act="close-ov" title="Schließen (Esc)">${I.x}</button>
    </div>
    <div class="plan-body">${P.step === 1 ? planStep1() : planStep2()}</div></div>`;
}
function planStep1(){
  const P = S.ui.plan, lo = S.leftovers.length > 0, due = P.due.length > 0;
  const btn = (id, v, label, d) => `<button class="${d === v ? (v === 'keep' ? 'on k' : 'on') : ''}" data-act="plan-dec" data-id="${id}" data-v="${v}">${label}</button>`;
  const item = (id, rep) => { const f = find(id); if (!f) return ''; const d = P.dec[id] || '';
    const meta = esc(path(f).join(' › ')) + (rep ? ` · ${I.rep} ${esc(describe(f.n.repeat, f.n.due))}` : '');
    const seg = rep
      ? btn(id, 'skip', 'Diesmal auslassen', d) + btn(id, 'later', 'Später', d) + btn(id, 'keep', `${I.sunSm} Heute`, d)
      : btn(id, 'back', 'Zurücklegen', d) + btn(id, 'keep', `${I.sunSm} Heute`, d);
    return `<div class="lo ${d === 'keep' ? 'keep' : d ? 'back' : ''}">
      <div class="title" style="cursor:default"><div>${fmtTitle(f.n.title)}</div><div class="meta">${meta}</div></div>
      <div class="seg">${seg}</div></div>`; };
  const lead = lo && due ? 'Gestern ist etwas liegen geblieben, und wiederkehrende Aufgaben sind fällig. Was nimmst du mit in den heutigen Tag?'
    : due ? 'Diese wiederkehrenden Aufgaben sind fällig. Nimmst du sie mit in den heutigen Tag?'
    : 'Gestern ist das hier liegen geblieben. Nimmst du es mit in den heutigen Tag – oder legst du es zurück ins Projekt?';
  const hint = lo && due ? 'Nicht Entschiedenes wird zurückgelegt bzw. bleibt fällig' : due ? 'Nicht Entschiedenes bleibt fällig' : 'Nicht Entschiedenes wird zurückgelegt';
  return `<div class="lo-wrap"><div class="lo-in">
      <p class="lead">${lead}</p>
      ${lo && due ? `<h4 class="lo-h">Von gestern</h4>` : ''}${S.leftovers.map(id => item(id, false)).join('')}
      ${due ? `${lo ? `<h4 class="lo-h">${I.rep} Fällig</h4>` : ''}${P.due.map(id => item(id, true)).join('')}` : ''}
    </div></div>
    <div class="plan-foot"><button class="btn" data-act="plan-keepall">${I.sun} Alle übernehmen</button><span class="spacer"></span><span class="muted small plan-hint">${hint}</span><button class="btn primary" data-act="plan-next">Weiter →</button></div>`;
}
function planStep2(){
  return `<div class="plan-grid">
    <div class="pick-col"><div class="search"><input id="planq" placeholder="Aufgaben durchsuchen …   ( / )" autocomplete="off" value="${esc(S.ui.plan.q)}"></div><div class="pick-list" id="pickList"></div></div>
    <div class="day-col"><div class="day-head"><h3>${I.sunFill} Dein Tag</h3><span class="chip sun" id="dayCount"></span></div>
      <div class="day-list" id="dayList"></div>
      <div class="plan-foot">${hasStep1() ? `<button class="btn" data-act="plan-prev">← Zurück</button>` : ''}<span class="spacer"></span><button class="btn sun lg" data-act="plan-start">Tag starten <kbd>⌘↵</kbd></button></div></div>
  </div>`;
}
function renderPick(){
  const P = S.ui.plan, box = $('#pickList'); if (!box) return;
  const st = box.scrollTop, q = (P.q || '').toLowerCase(); let i = 0, html = '';
  const pk = (n, sub) => { const on = P.picks.includes(n.id), idx = i++;
    return `<div class="pick ${sub ? 'sub' : ''} ${on ? 'on' : ''} ${P.f === idx ? 'focus' : ''} ${isResting(n) ? 'resting' : ''}" data-act="plan-pick" data-id="${n.id}" data-prow="${idx}"><span class="pc">${I.checkS}</span><span class="pt">${n.important ? `<span class="star">${I.star}</span>` : ''}${fmtTitle(n.title)}${repChip(n)}</span></div>`; };
  const match = (n, ctx) => !q || (n.title + ' ' + ctx).toLowerCase().includes(q);
  for (const p of S.projects) {
    let ph = '';
    const th = (t, sec) => {
      if (t.done) return '';
      const ctx = p.name + ' ' + (sec || '');
      const open = t.children.filter(c => !c.done);
      if (!open.length) return match(t, ctx) ? pk(t, false) : '';
      const subs = open.filter(c => match(c, ctx + ' ' + t.title));
      if (!subs.length) return '';
      return `<div class="pk-parent">${esc(t.title)}</div>` + subs.map(c => pk(c, true)).join('');
    };
    for (const it of p.items) {
      if (it.type === 'section') { const inner = it.children.map(t => th(t, it.title)).join(''); if (inner) ph += `<div class="pk-sec">${esc(it.title)}</div>` + inner; }
      else ph += th(it);
    }
    if (ph) html += `<div class="pk-proj">${esc(p.name)}</div>` + ph;
  }
  box.innerHTML = html || `<p class="pv-empty">Nichts gefunden.</p>`;
  box.scrollTop = st;
  const fe = box.querySelector('.pick.focus'); if (fe) fe.scrollIntoView({ block: 'nearest' });
}
function renderDay(){
  const P = S.ui.plan, box = $('#dayList'); if (!box) return;
  box.innerHTML = P.picks.length ? P.picks.map((id, i) => { const f = find(id); if (!f) return '';
    return `<div class="day-item ${f.n.done ? 'done' : ''} ${P.newId === id ? 'new' : ''}" data-id="${id}"><span class="handle" data-h="day">${I.grip}</span><span class="num">${i + 1}</span>
      <div class="title"><div>${f.n.important ? `<span class="star">${I.star}</span>` : ''}${fmtTitle(f.n.title)}</div><div class="meta"><span class="ctx">${esc(path(f).join(' › '))}</span></div></div>
      <button class="ibtn" data-act="plan-pick" data-id="${id}" title="Entfernen">${I.x}</button></div>`; }).join('')
    : `<div class="day-empty">${sunArt()}<p>Klicke links auf Aufgaben,<br>um sie in deinen Tag zu holen.</p></div>`;
  $('#dayCount').textContent = P.picks.length ? `${P.picks.length} ${P.picks.length === 1 ? 'Aufgabe' : 'Aufgaben'}` : '';
  $('#dayCount').style.display = P.picks.length ? '' : 'none';
  P.newId = null;
}
function planPick(id){
  const P = S.ui.plan;
  if (P.picks.includes(id)) P.picks = P.picks.filter(x => x !== id); else { P.picks.push(id); P.newId = id; }
  renderPick(); renderDay();
  if (P.newId === null) { const dl = $('#dayList'); dl.scrollTop = dl.scrollHeight; }
}
/** Entscheidung in Schritt 1. „Heute“ bei einer Aufgabe mit offenen Unteraufgaben holt diese in den Tag. */
function planDecide(id, v){
  const P = S.ui.plan, f = find(id); if (!f) return;
  P.dec[id] = v;
  const ids = leafIds(f.n);
  if (v === 'keep') ids.forEach(x => { if (!P.picks.includes(x)) P.picks.push(x); });
  else P.picks = P.picks.filter(x => !ids.includes(x));
}
function planStart(){
  const P = S.ui.plan; const added = P.picks.filter(id => !S.today.includes(id));
  Object.entries(P.dec).forEach(([id, v]) => { if (v === 'skip') skipOccurrence(id); });
  S.today = [...P.picks]; S.leftovers = []; S.planned = true; added.forEach(id => S.flash.add(id));
  const n = S.today.length;
  closeOv();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(n ? `☀️ Dein Tag steht – ${n} ${n === 1 ? 'Aufgabe' : 'Aufgaben'}. Viel Erfolg!` : 'Heute ohne Plan – auch okay.');
}

/* Import */
function renderImport(){
  const m = S.ui.imp.mode;
  return `<div class="scrim"></div><div class="modal imp" role="dialog" aria-label="Aus Notizen importieren">
    <div class="m-head"><div><h2>Aus Notizen importieren</h2><p class="muted"><span class="kb-only">Notiz öffnen, alles markieren (⌘A) und kopieren (⌘C), dann links einfügen.</span><span class="touch-only">Notiz öffnen, alles markieren und kopieren, dann ins Textfeld einfügen.</span> Überschriften werden zu <b>Projekten</b>, Punkte zu <b>Aufgaben</b>, eingerückte Punkte zu <b>Unteraufgaben</b>. Fett markierte Punkte werden als <b>wichtig</b> markiert.</p></div><span class="spacer"></span><button class="ibtn" data-act="close-ov">${I.x}</button></div>
    <div class="imp-grid">
      <div class="imp-left"><textarea id="impText" placeholder="Hier einfügen …" spellcheck="false"></textarea></div>
      <div class="imp-prev" id="impPrev"></div>
    </div>
    <div class="m-foot"><span class="muted small"><span class="kb-only">Klick</span><span class="touch-only">Tipp</span> auf <span class="badge sec">Abschnitt</span> / <span class="badge task">Aufgabe</span> wechselt die Art.</span><span class="spacer"></span>
      <div class="seg"><button class="${m === 'replace' ? 'on' : ''}" data-act="imp-mode" data-v="replace">Ersetzen</button><button class="${m === 'append' ? 'on' : ''}" data-act="imp-mode" data-v="append">Hinzufügen</button></div>
      <button class="btn primary" data-act="imp-do" id="impBtn" disabled>Importieren</button></div>
  </div>`;
}
function renderImpPreview(){
  const box = $('#impPrev'); if (!box) return;
  const { parsed, over } = S.ui.imp; let count = 0;
  if (!parsed.length) { box.innerHTML = `<div class="pv-empty">${I.paste}<br>Die Vorschau erscheint hier, sobald du Text einfügst.</div>`; }
  else box.innerHTML = parsed.map((p, pi) => `<div class="pv-proj">${esc(p.name)}</div>` + p.raw.map((n, ii) => {
    const k = pi + '/' + ii, sec = k in over ? over[k] : looksLikeSection(n);
    const sub = (c, cls) => { count++; return `<div class="pv-row ${cls}"><span class="mini"></span>${c.important ? `<span class="star">${I.star}</span>` : ''}${esc(c.text)}</div>` + (c.children.length ? `<div class="pv-row note">${I.note} Notiz: ${c.children.length} Zeile${c.children.length > 1 ? 'n' : ''}</div>` : ''); };
    if (sec) return `<div class="pv-sec"><button class="badge sec" data-act="imp-toggle" data-k="${k}" title="In Aufgabe umwandeln">Abschnitt</button>${esc(n.text.replace(/:$/, ''))}</div><div class="pv-in">` + n.children.map(t => { count++; return `<div class="pv-row"><span class="mini"></span>${t.important ? `<span class="star">${I.star}</span>` : ''}${esc(t.text)}</div>` + t.children.map(c => sub(c, 'sub')).join(''); }).join('') + `</div>`;
    count++;
    return `<div class="pv-row"><span class="mini"></span>${n.important ? `<span class="star">${I.star}</span>` : ''}${esc(n.text)}${n.children.length ? ` <button class="badge task" data-act="imp-toggle" data-k="${k}" title="In Abschnitt umwandeln">Aufgabe</button>` : ''}</div>` + n.children.map(c => sub(c, 'sub')).join('');
  }).join('')).join('');
  const b = $('#impBtn'); b.disabled = !count; b.textContent = count ? `${count} ${count === 1 ? 'Aufgabe' : 'Aufgaben'} in ${parsed.length} ${parsed.length === 1 ? 'Projekt' : 'Projekte'} importieren` : 'Importieren';
}
function doImport(){
  const { parsed, over, mode } = S.ui.imp;
  const model = toModel(parsed, over, mode === 'append' ? S.projects.length : 0);
  let n = 0; const cnt = it => it.type === 'section' ? it.children.forEach(cnt) : (n += 1 + it.children.length);
  model.forEach(p => p.items.forEach(cnt));
  if (mode === 'replace') { S.projects = model; S.today = []; S.leftovers = []; }
  else model.forEach(p => { const ex = S.projects.find(x => x.name.toLowerCase() === p.name.toLowerCase()); if (ex) ex.items.push(...p.items); else S.projects.push(p); });
  closeOv(); toast(`${n} Aufgaben importiert 🎉`);
}

/* Verlauf */
function dayLabel(ts){
  const d = new Date(ts), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Heute';
  if (d.toDateString() === y.toDateString()) return 'Gestern';
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}
function streak(){
  const days = new Set(S.history.map(h => new Date(h.at).toDateString()));
  const d = new Date(); if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  let n = 0; while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); } return n;
}
function renderHistory(){
  const groups = new Map();
  [...S.history].sort((a, b) => b.at - a.at).forEach(h => { const l = dayLabel(h.at); if (!groups.has(l)) groups.set(l, []); groups.get(l).push(h); });
  const cnt = l => (groups.get(l) || []).length;
  return `<div class="scrim" data-act="close-ov"></div><aside class="drawer" aria-label="Verlauf">
    <div class="d-head"><h2>${I.clock} Verlauf</h2><span class="spacer"></span><button class="ibtn" data-act="close-ov">${I.x}</button></div>
    <div class="stats"><div class="stat"><b>${cnt('Heute')}</b><span>heute erledigt</span></div><div class="stat"><b>${cnt('Gestern')}</b><span>gestern</span></div><div class="stat"><b>🔥 ${streak()}</b><span>Tage in Folge</span></div></div>
    <div class="d-body">${[...groups].map(([l, hs]) => `<div class="h-lbl">${l}</div>` + hs.map(h => `<div class="h-row"><span class="hc">${I.checkS}</span>
      <div class="title" style="cursor:default"><div>${fmtTitle(h.title)}</div><div class="meta"><span class="ctx">${esc(h.path.join(' › '))}</span><span>${new Date(h.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span></div></div>
      ${canRestore(h) ? `<button class="ibtn" data-act="hist-restore" data-id="${h.id}" title="Wiederherstellen">${I.undo}</button>` : ''}</div>`).join('')).join('') || '<p class="muted">Noch nichts erledigt.</p>'}</div>
  </aside>`;
}

/* Details */
function renderDetail(){
  const f = find(S.ui.detail); if (!f) return '';
  const n = f.n, leaf = isLeaf(n), inT = S.today.includes(n.id);
  const links = (n.title + ' ' + (n.note || '')).match(/https?:\/\/[^\s)]+/g) || [];
  return `<div class="scrim" data-act="close-ov"></div><aside class="drawer" aria-label="Details">
    <div class="d-head"><span class="ctx muted small">${esc(path(f).join(' › '))}</span><span class="spacer"></span><button class="ibtn" data-act="close-ov">${I.x}</button></div>
    <div class="d-body">
      <textarea class="d-title" data-f="title" rows="2">${esc(n.title)}</textarea>
      <div class="d-toggles"><button class="tg ${n.important ? 'on imp' : ''}" data-act="d-imp">${I.star} Wichtig</button>${leaf ? `<button class="tg ${inT ? 'on sun' : ''}" data-act="d-today">${I.sun} Für heute</button>` : ''}</div>
      ${arrangeBlock(f)}
      <label class="lbl">Notiz &amp; Links</label>
      <textarea class="d-note" data-f="note" rows="7" placeholder="Notizen, Links, Gedanken …">${esc(n.note || '')}</textarea>
      ${links.length ? `<div class="d-links">${[...new Set(links)].map(l => fmtTitle(l)).join('')}</div>` : '<div style="height:18px"></div>'}
      ${f.parent ? '' : repeatBlock(n)}
      ${n.children.length ? `<label class="lbl">Unteraufgaben</label>${n.children.map(c => `<div class="d-sub ${c.done ? 'done' : ''}"><span class="mini"></span>${esc(c.title)}</div>`).join('')}` : ''}
    </div>
    <div class="d-foot"><button class="btn danger" data-act="d-del">Aufgabe löschen</button></div>
  </aside>`;
}
/** Ein- und Ausrücken ohne Tastatur (⇥ / ⇧⇥ beim Bearbeiten) */
function arrangeBlock(f){
  const n = f.n, prev = f.parent ? null : f.list.slice(0, f.list.indexOf(n)).reverse().find(x => !x.done);
  const btns = [];
  if (prev && !n.children.length) btns.push(`<button class="tg" data-act="d-indent" title="Einrücken (⇥ beim Bearbeiten)">${prev.type === 'section' ? `In „${esc(prev.title || 'Abschnitt')}“ einordnen` : `Unteraufgabe von „${esc(prev.title || 'Neue Aufgabe')}“`}</button>`);
  if (f.parent) btns.push(`<button class="tg" data-act="d-outdent" title="Ausrücken (⇧⇥ beim Bearbeiten)">Zur eigenen Aufgabe machen</button>`);
  else if (f.section) btns.push(`<button class="tg" data-act="d-outdent" title="Ausrücken (⇧⇥ beim Bearbeiten)">Aus „${esc(f.section.title || 'Abschnitt')}“ lösen</button>`);
  return btns.length ? `<div class="d-arrange">${btns.join('')}</div>` : '';
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function repSummary(n){
  const state = n.done ? `erledigt, wieder ${onDay(n.due)}` : isResting(n) ? `nächstes Mal ${onDay(n.due)}` : 'jetzt fällig';
  return `${I.rep}<span>${esc(describe(n.repeat, n.due))} · ${esc(state)}</span>`;
}
function repeatBlock(n){
  const r = n.repeat, key = choiceKey(r);
  const opts = [['', 'nie'], ...REPEAT_CHOICES];
  if (r && !opts.some(([k]) => k === key)) opts.push([key, describe({ ...r, from: undefined })]);
  return `<label class="lbl" for="dRep">Wiederholen</label>
    <div class="d-rep">
      <select class="d-sel" id="dRep">${opts.map(([k, t]) => `<option value="${k}" ${k === key ? 'selected' : ''}>${esc(cap(t))}</option>`).join('')}</select>
      ${r ? `<div class="d-rep-row">
        <label class="d-due"><span>Nächster Termin</span><input type="date" id="dDue" value="${esc(n.due || '')}" required></label>
        <div class="seg"><button class="${r.from === 'done' ? '' : 'on'}" data-act="d-from" data-v="due" title="z. B. immer am 1. des Monats">Fester Termin</button><button class="${r.from === 'done' ? 'on' : ''}" data-act="d-from" data-v="done" title="Der nächste Termin zählt ab dem Tag, an dem du sie erledigst">Ab Erledigung</button></div>
      </div>
      <p class="d-rep-sum" id="dRepSum">${repSummary(n)}</p>` : `<p class="d-rep-hint">Erledigt kommt die Aufgabe zum nächsten Termin wieder – mit frischen Unteraufgaben.</p>`}
    </div>`;
}
function renderHelp(){
  const r = (k, t) => `<div><span>${t}</span><span>${k.split(' ').map(x => `<kbd>${x}</kbd>`).join('')}</span></div>`;
  return `<div class="scrim" data-act="close-ov"></div><div class="modal small"><div class="m-head"><h2>Tastenkürzel</h2><span class="spacer"></span><button class="ibtn" data-act="close-ov">${I.x}</button></div><div class="keys">
    <h4>Liste</h4>${r('↑ ↓', 'Aufgabe auswählen (auch J / K)')}${r('Leertaste', 'Erledigt')}${r('T', 'Für heute ☀️ an/aus')}${r('I', 'Wichtig an/aus')}${r('↵', 'Bearbeiten')}${r('O', 'Details öffnen')}${r('N', 'Neue Aufgabe darunter')}${r('⌥ ↑', 'Nach oben verschieben (⌥↓ nach unten)')}${r('⌘ ⌫', 'Löschen (auch Entf) – mit Rückgängig')}${r('⌘ Z', 'Löschen rückgängig machen')}
    <h4>Abschnitte</h4>${r('Titel:', 'Aufgabe mit „:“ am Ende wird zum Abschnitt')}${r('↵', 'Abschnitt umbenennen (Kopf ausgewählt)')}${r('Leertaste', 'Abschnitt auf-/zuklappen')}${r('⌘ ⌫', 'Abschnitt auflösen – Aufgaben bleiben')}
    <h4>Beim Bearbeiten</h4>${r('↵', 'Speichern + neue Aufgabe darunter')}${r('⇥', 'Einrücken → Unteraufgabe')}${r('⇧ ⇥', 'Ausrücken')}${r('⌫', 'In leerer Zeile: löschen')}${r('Esc', 'Fertig')}
    <h4>Allgemein</h4>${r('P', 'Tag planen')}${r('H', 'Verlauf')}${r('?', 'Diese Hilfe')}
    <h4>Tag planen</h4>${r('/', 'Suchen')}${r('↑ ↓', 'Auswählen')}${r('Leertaste', 'Für heute an/aus')}${r('⌘ ↵', 'Tag starten')}
    <h4>Als App</h4>
    ${isApp() ? '<p class="help-p">✓ Tagwerk läuft als installierte App.</p>' : installHow()}
  </div></div>`;
}
/** Anleitung je Gerät – Safari und Firefox haben keinen Installationsdialog, den Tagwerk aufrufen könnte */
function installHow(){
  const steps = s => `<ol class="inst">${s.map(x => `<li>${x}</li>`).join('')}</ol>`;
  switch (platform()) {
    case 'ios': return steps([
        'Tippe in der Leiste unten auf <b>⋯</b> und dann auf <b>Teilen</b> (ältere iOS-Versionen: direkt auf das Teilen-Symbol).',
        'Wähle <b>Zum Home-Bildschirm</b> – eventuell erst unter <b>Mehr</b>.',
        '<b>Als Web-App öffnen</b> eingeschaltet lassen und auf <b>Hinzufügen</b> tippen.'])
      + `<p class="help-p">In Chrome auf dem iPhone geht es genauso über das Teilen-Symbol in der Adressleiste.</p>
        <p class="help-p warn-p"><b>Wichtig:</b> Die App auf dem Home-Bildschirm hat auf iPhone und iPad einen eigenen Speicher. Wenn du hier im Browser schon Aufgaben hast: vorher im Menü <b>Backup exportieren</b> und in der App <b>Backup einspielen</b>.</p>`;
    case 'android': return steps([
        'Tippe oben rechts auf <b>⋮</b>.',
        'Wähle <b>App installieren</b> bzw. <b>Zum Startbildschirm hinzufügen</b>.']);
    case 'android-firefox': return steps([
        'Tippe auf <b>⋮</b>.',
        'Wähle <b>Installieren</b> bzw. <b>Zum Startbildschirm hinzufügen</b>.']);
    case 'mac-safari': return steps([
        'Menü <b>Ablage → Zum Dock hinzufügen …</b> (ab macOS Sonoma).'])
      + '<p class="help-p">Dann startet Tagwerk aus dem Dock in einem eigenen Fenster.</p>';
    case 'firefox': return '<p class="help-p">Firefox kann Webseiten am Computer nicht als App installieren. Öffne Tagwerk dafür in Chrome, Edge oder Safari.</p>';
    default: return steps([
        'Menü <b>⋮ → Streamen, speichern und teilen → Seite als App installieren</b> – oder das Symbol rechts in der Adressleiste.'])
      + `<p class="help-p">Dann hat Tagwerk ein eigenes Fenster, ein Icon im Dock mit der Zahl der heute noch offenen Aufgaben und per Rechtsklick „Tag planen“ und „Neue Aufgabe“.</p>
        <p class="help-p">Damit Tagwerk morgens direkt da ist: <b>chrome://apps</b> öffnen, Rechtsklick auf Tagwerk und „Beim Anmelden öffnen“ bzw. in den App-Einstellungen „Beim Anmelden starten“ aktivieren.</p>`;
  }
}
function renderInstall(){
  return `<div class="scrim" data-act="close-ov"></div><div class="modal small" role="dialog" aria-label="Als App installieren"><div class="m-head"><h2>Als App installieren</h2><span class="spacer"></span><button class="ibtn" data-act="close-ov">${I.x}</button></div>
    <div class="keys"><p class="help-p">Als App startet Tagwerk mit eigenem Symbol und ohne Browserleisten und funktioniert auch offline.</p>${installHow()}</div></div>`;
}

/** Aufruf über das Dock-Menü: ?action=plan bzw. ?action=new */
function handleAction(href = location.href){
  const a = new URL(href).searchParams.get('action');
  if (!a) return;
  if (location.search) history.replaceState(null, '', location.pathname);
  if (status.readOnly) return;
  if (a === 'plan') { if (S.ui.ov) closeOv(); openPlan(); }
  else if (a === 'new') {
    if (S.ui.ov) closeOv();
    const p = S.projects[0];
    if (p) addTask({ pid: p.id }); else openOv('import');
  }
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
  if (e.target.closest('a[href]')) return;
  const a = e.target.closest('[data-act]');
  const rowEl = e.target.closest('#app [data-row]');
  if (rowEl && !(S.editing && S.editing === rowEl.dataset.row)) S.focus = rowEl.dataset.row;
  if (!a) { if (S.ui.menu) { S.ui.menu = false; render(); } else if (rowEl) render(); return; }
  const d = a.dataset, act = d.act;
  if (act !== 'menu' && act !== 'noop' && S.ui.menu) S.ui.menu = false;
  switch (act) {
    case 'noop': return;
    case 'p-edit': S.ui.pedit = d.id; render(); return;
    case 'p-del': { const p = S.projects.find(x => x.id === d.id); const el = a.closest('.project'); if (el) { el.style.transition = 'opacity .18s ease, transform .18s ease'; el.style.opacity = '0'; el.style.transform = 'translateX(-12px)'; } setTimeout(() => { deleteWithUndo(p.id); render(); }, el ? 180 : 0); return; }
    case 'storage': openOv('storage'); return;
    case 'install': if (canInstall()) { S.ui.menu = false; render(); install(); } else openOv('install'); return;
    case 'fs-choose': fsAction(chooseFolder); return;
    case 'fs-renew': fsAction(renewPermission); return;
    case 'fs-forget': if (confirm(`Ordner „${fs.name}“ nicht mehr verwenden? Die Dateien darin bleiben erhalten, Tagwerk schreibt nur nicht mehr hinein.`)) fsAction(forgetFolder); return;
    case 'fs-conflict': openOv('conflict'); return;
    case 'fs-use-file': fsAction(() => resolveConflict('file')); return;
    case 'fs-use-local': fsAction(() => resolveConflict('local')); return;
    case 'takeover': takeOver(() => render()).then(async () => { rollover(); render(); await fsInit().catch(() => {}); maybePromptPlan(); }); return;
    case 'toggle': toggleDone(d.id, a); return;
    case 'today': toggleToday(d.id); return;
    case 'edit': S.editing = d.key; S.focus = d.key; render(); return;
    case 'detail': S.ui.detail = d.id; openOv('detail'); return;
    case 'collapse': { const p = S.projects.find(p => p.id === d.id); p.collapsed = !p.collapsed; if (!p.collapsed) S.opening = p.id; render(); return; }
    case 'collapse-s': { const f = find(d.id); f.n.collapsed = !f.n.collapsed; render(); return; }
    case 'add': addTask({ pid: d.pid, sid: d.sid }); return;
    case 'add-sec': addSection(d.pid); return;
    case 'menu': S.ui.menu = !S.ui.menu; render(); return;
    case 'newproject': { const name = prompt('Name des neuen Projekts'); if (name && name.trim()) { const p = newProject(name.trim()); const t = newTask(); p.items.push(t); S.editing = S.focus = 'p:' + t.id; } S.ui.menu = false; render(); return; }
    case 'export': exportJSON(); S.ui.menu = false; render(); return;
    case 'importjson': S.ui.menu = false; render(); $('#jsonFile').click(); return;
    case 'help': openOv('help'); return;
    case 'history': openOv('history'); return;
    case 'import': S.ui.imp = { parsed: [], over: {}, mode: 'replace' }; openOv('import'); return;
    case 'close-ov': closeOv(); return;
    case 'undo': undone(d.id); $('#toast').innerHTML = ''; render(); return;
    case 'undo-del': undoDelete(); return;
    case 'hist-restore': undone(d.id); renderOv(); render(); toast('Wiederhergestellt'); return;
    // Tag planen
    case 'plan': openPlan(); return;
    case 'plan2': openPlan(2); return;
    case 'plan-dec': { planDecide(d.id, d.v); renderOv(); return; }
    case 'plan-keepall': { [...S.leftovers, ...S.ui.plan.due].forEach(id => planDecide(id, 'keep')); renderOv(); return; }
    case 'plan-next': S.ui.plan.step = 2; renderOv(); return;
    case 'plan-prev': S.ui.plan.step = 1; renderOv(); return;
    case 'plan-pick': planPick(d.id); return;
    case 'plan-start': planStart(); return;
    // Import
    case 'imp-toggle': { const { parsed, over } = S.ui.imp; const [pi, ii] = d.k.split('/').map(Number); const cur = d.k in over ? over[d.k] : looksLikeSection(parsed[pi].raw[ii]); over[d.k] = !cur; renderImpPreview(); return; }
    case 'imp-mode': S.ui.imp.mode = d.v; a.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === a)); return;
    case 'imp-do': doImport(); return;
    // Details
    case 'd-imp': { const f = find(S.ui.detail); f.n.important = !f.n.important; renderOv(); render(); return; }
    case 'd-today': toggleToday(S.ui.detail); renderOv(); return;
    case 'd-from': { const n = find(S.ui.detail)?.n; if (n && n.repeat) { if (d.v === 'done') n.repeat.from = 'done'; else delete n.repeat.from; } renderOv(); render(); return; }
    case 'd-indent': { const msg = indent(S.ui.detail); if (msg) toast(msg); renderOv(); render(); return; }
    case 'd-outdent': outdent(S.ui.detail); renderOv(); render(); return;
    case 'd-del': { const id = S.ui.detail; closeOv(); deleteWithUndo(id); render(); return; }
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'impText') { S.ui.imp.parsed = parseNotes(t.value); S.ui.imp.over = {}; renderImpPreview(); }
  else if (t.id === 'planq') { S.ui.plan.q = t.value; S.ui.plan.f = null; renderPick(); }
  else if (t.dataset.f && S.ui.detail) { const f = find(S.ui.detail); f.n[t.dataset.f] = t.dataset.f === 'title' ? t.value.replace(/\n/g, ' ') : t.value; scheduleSave(); }
});
// Wiederholen in der Detailansicht
document.addEventListener('change', e => {
  const t = e.target, id = S.ui.detail; if (!id || S.ui.ov !== 'detail') return;
  if (t.id === 'dRep') {
    const [unit, every] = t.value.split(':'), from = find(id)?.n.repeat?.from;
    setRepeat(id, t.value ? { unit, every: +every, from } : null);
    renderOv(); render();
  } else if (t.id === 'dDue' && isDayKey(t.value)) {
    // Nicht neu zeichnen – sonst verliert das Datumsfeld beim Tippen den Fokus
    setDue(id, t.value); render();
    const sum = $('#dRepSum'); if (sum) sum.innerHTML = repSummary(find(id).n);
  }
});
// Einfügen im Import: formatierte Zwischenablage (Notizen) bevorzugen – Einrückung und Fett sind dort zuverlässig
document.addEventListener('paste', e => {
  const t = e.target; if (t.id !== 'impText' || !e.clipboardData) return;
  const html = e.clipboardData.getData('text/html');
  if (!looksStructured(html)) return;
  const text = htmlToNotes(html); if (!text.trim()) return;
  e.preventDefault();
  t.setRangeText(text, t.selectionStart, t.selectionEnd, 'end');
  t.dispatchEvent(new Event('input', { bubbles: true }));
  toast('Formatierung aus der Zwischenablage übernommen');
});
function commitProjectName(inp, save = true){
  if (save) renameProject(inp.dataset.pedit, inp.value);
  S.ui.pedit = null; render();
}
document.addEventListener('focusout', e => {
  const t = e.target;
  if (!rendering && t.matches && t.matches('input.pedit') && S.ui.pedit === t.dataset.pedit) { commitProjectName(t); return; }
  if (rendering || !t.matches || !t.matches('input.edit')) return;
  const key = t.dataset.edit; if (S.editing !== key) return;
  const f = commitEdit(t); S.editing = null;
  if (f && !f.n.title) deleteNode(f.n.id);
  const rc = renderCount; setTimeout(() => { if (renderCount === rc) render(); }, 180);
});
$('#jsonFile').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  file.text().then(txt => {
    let d;
    try { d = migrate(JSON.parse(txt)); } catch (err) { toast(esc(err instanceof SyntaxError ? 'Die Datei ist kein gültiges Backup.' : err.message)); return; }
    if (S.projects.length && !confirm('Backup einspielen? Deine aktuellen Aufgaben werden dabei ersetzt.')) return;
    applyData(d); rollover(); render(); toast('Backup eingespielt');
  });
  e.target.value = '';
});
function exportJSON(){
  const blob = new Blob([JSON.stringify({ app: 'tagwerk', exportedAt: new Date().toISOString(), ...snapshot() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `tagwerk-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  toast('Backup exportiert');
}

document.addEventListener('keydown', e => {
  const t = e.target;
  if (status.readOnly) return;
  if (t.matches && t.matches('input.pedit')) {
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commitProjectName(t, e.key === 'Enter'); }
    return;
  }
  if (t.matches && t.matches('input.edit')) return editKey(e);
  if (S.ui.ov === 'plan') return planKey(e);
  if (S.ui.ov) { if (e.key === 'Escape') closeOv(); return; }
  if (t.matches && t.matches('input,textarea')) return;
  const rows = [...document.querySelectorAll('#app [data-row]')];
  const idx = rows.findIndex(r => r.dataset.row === S.focus);
  const key = S.focus, id = key ? key.slice(2) : null;
  const k = e.key;
  // ⌘⌫ / Entf: ausgewählte Aufgabe löschen (mit Rückgängig)
  if (id && ((e.metaKey || e.ctrlKey) && k === 'Backspace' || k === 'Delete')) {
    e.preventDefault();
    const f = find(id), sec = f && f.n.type === 'section';
    const gone = sec ? [id] : [id, ...(f ? f.n.children.map(c => c.id) : [])];
    const next = rows.slice(idx + 1).find(r => !gone.includes(r.dataset.id)) || rows.slice(0, idx).reverse().find(r => !gone.includes(r.dataset.id));
    const rowEl = rows[idx], block = rowEl && (sec || rowEl.classList.contains('today-row') ? rowEl : rowEl.closest('.item'));
    S.focus = next ? next.dataset.row : null;
    if (block) { block.style.transition = 'opacity .18s ease, transform .18s ease'; block.style.opacity = '0'; block.style.transform = 'translateX(-12px)'; }
    setTimeout(() => { deleteWithUndo(id); render(); }, block ? 180 : 0);
    return;
  }
  if ((e.metaKey || e.ctrlKey) && k === 'z' && lastDeleted && $('#toast [data-act="undo-del"]')) { e.preventDefault(); undoDelete(); return; }
  if (e.metaKey || e.ctrlKey) return;
  const go = i => { const r = rows[Math.max(0, Math.min(rows.length - 1, i))]; if (r) { S.focus = r.dataset.row; render(); } };
  const fs = id && find(id);
  if (fs && fs.n.type === 'section') {
    // Abschnittskopf: Leertaste klappt, ↵ benennt um, N legt erste Aufgabe darin an
    if (k === ' ' || k === 'x') { e.preventDefault(); fs.n.collapsed = !fs.n.collapsed; render(); return; }
    if (k === 'n') { e.preventDefault(); S.editing = S.focus = 'p:' + firstInSection(id); render(); return; }
    if (k === 't' || k === 'i' || k === 'o') return;
  }
  if (k === 'ArrowDown' || k === 'j') { e.preventDefault(); if (e.altKey && key) { moveItem(key, 1); render(); } else go(idx + 1); }
  else if (k === 'ArrowUp' || k === 'k') { e.preventDefault(); if (e.altKey && key) { moveItem(key, -1); render(); } else go(idx < 0 ? 0 : idx - 1); }
  else if ((k === ' ' || k === 'x') && id) { e.preventDefault(); const btn = document.querySelector(`[data-row="${key}"] .check`); toggleDone(id, btn); }
  else if (k === 't' && id) toggleToday(id);
  else if (k === 'i' && id) { const f = find(id); if (f) { f.n.important = !f.n.important; render(); } }
  else if (k === 'Enter' && key) { e.preventDefault(); S.editing = key; render(); }
  else if (k === 'o' && id) { S.ui.detail = id; openOv('detail'); }
  else if (k === 'n') { e.preventDefault(); if (key && key[0] === 'p') { const nidv = insertAfter(id); S.editing = S.focus = 'p:' + nidv; render(); } else if (S.projects[0]) addTask({ pid: S.projects[0].id }); }
  else if (k === 'p') openPlan();
  else if (k === 'h') openOv('history');
  else if (k === '?') openOv('help');
  else if (k === 'Escape') { S.focus = null; S.ui.menu = false; render(); }
});
function editKey(e){
  const inp = e.target, key = inp.dataset.edit, id = key.slice(2), ctx = key[0];
  if (e.key === 'Enter') {
    e.preventDefault(); const f = commitEdit(inp);
    if (f && !f.n.title) { deleteNode(id); S.editing = null; S.focus = null; }
    else if (ctx === 'p') { const n2 = f.n.type === 'section' ? firstInSection(id) : insertAfter(id); S.editing = S.focus = 'p:' + n2; }
    else S.editing = null;
    render();
  } else if (e.key === 'Escape') {
    e.preventDefault(); const f = commitEdit(inp); S.editing = null;
    if (f && !f.n.title) { deleteNode(id); S.focus = null; }
    render();
  } else if (e.key === 'Tab' && ctx === 'p') {
    e.preventDefault(); const f = commitEdit(inp); if (f && f.n.type !== 'section') { if (e.shiftKey) outdent(id); else { const msg = indent(id); if (msg) toast(msg); } } render();
  } else if (e.key === 'Backspace' && inp.value === '') {
    const f = find(id); if (f && f.n.type === 'section' && f.n.children.length) return;
    e.preventDefault();
    const rows = [...document.querySelectorAll('#app [data-row]')]; const i = rows.findIndex(r => r.dataset.row === key);
    const prev = rows[i - 1] && rows[i - 1].dataset.row;
    deleteNode(id); S.focus = prev || null; S.editing = prev && prev[0] === 'p' ? prev : null; render();
  }
}
function planKey(e){
  const P = S.ui.plan, t = e.target;
  if (e.key === 'Escape') { if (t.id === 'planq' && t.value) { t.value = ''; P.q = ''; renderPick(); return; } closeOv(); return; }
  if (P.step === 1) { if (e.key === 'Enter') { P.step = 2; renderOv(); } return; }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); planStart(); return; }
  const rows = [...document.querySelectorAll('[data-prow]')];
  if (t.id === 'planq') {
    if (e.key === 'ArrowDown') { e.preventDefault(); P.f = 0; t.blur(); renderPick(); }
    else if (e.key === 'Enter' && rows.length) { e.preventDefault(); planPick(rows[0].dataset.id); }
    return;
  }
  if (e.key === '/') { e.preventDefault(); $('#planq').focus(); return; }
  if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); P.f = Math.min((P.f ?? -1) + 1, rows.length - 1); renderPick(); }
  else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); if (!P.f) { P.f = null; renderPick(); $('#planq').focus(); } else { P.f--; renderPick(); } }
  else if ((e.key === ' ' || e.key === 'Enter') && P.f != null) { e.preventDefault(); const r = rows[P.f]; if (r) planPick(r.dataset.id); }
}

/* ---------- Nur ein Fenster schreibt ---------- */
function renderLockScreen(){
  let el = $('#lock');
  if (!status.readOnly) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'lock'; document.body.appendChild(el); }
  el.innerHTML = status.fatal
    ? `<div class="scrim"></div><div class="modal small lock"><div class="m-head"><h2>Tagwerk konnte deine Daten nicht laden</h2></div>
        <div class="lock-body"><p>${esc(status.fatal)}</p><p class="muted">Damit nichts überschrieben wird, speichert Tagwerk in diesem Zustand nicht.</p></div></div>`
    : `<div class="scrim"></div><div class="modal small lock"><div class="m-head"><h2>Tagwerk ist schon in einem anderen Fenster geöffnet</h2></div>
        <div class="lock-body"><p class="muted">Damit sich nichts gegenseitig überschreibt, speichert immer nur ein Fenster.</p>
        <button class="btn primary" data-act="takeover">Hier weiterarbeiten</button></div></div>`;
}

/* ---------- Tageswechsel ---------- */
function maybePromptPlan(){
  if (S.ui.ov || status.readOnly || !shouldPromptPlan()) return;
  S.prompted = S.day; openPlan();
}
function checkDay(){
  if (status.readOnly) return;
  if (rollover()) { if (S.ui.ov === 'plan') closeOv(); else render(); }
  maybePromptPlan();
}
let midnightT;
function armMidnight(){ clearTimeout(midnightT); midnightT = setTimeout(() => { checkDay(); armMidnight(); }, msToMidnight()); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkDay(); if (!status.readOnly) recheck(); } });
addEventListener('focus', checkDay);

/* ---------- Start ---------- */
export async function start(){
  const writer = await acquireLock(() => render());
  try { await load(); }
  catch (err) { status.readOnly = true; status.fatal = (err && err.message) || String(err); }
  if (writer && !status.fatal) { rollover(); requestPersist(); }
  render(); renderLockScreen();
  if (writer && !status.fatal) await fsInit().catch(e => console.warn('Speicherordner:', e));
  if (new URLSearchParams(location.search).has('action')) { S.prompted = S.day; handleAction(); }
  else maybePromptPlan();
  // Dock-Menü bei schon offener App: Chrome holt das vorhandene Fenster nach vorn (launch_handler) und meldet die URL hier
  if ('launchQueue' in window) window.launchQueue.setConsumer(p => { if (p.targetURL) handleAction(p.targetURL); });
  armMidnight();
}

