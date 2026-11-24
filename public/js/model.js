/* Datenmodell: Projekte → (Abschnitte →) Aufgaben → Unteraufgaben. Keine DOM-Zugriffe. */
import { S } from './state.js';
import { dayKey, nextDue, normRepeat } from './repeat.js';

export const COLORS = ['#0a84ff', '#2fb15a', '#8e5cf7', '#ff7a1a', '#d9a200', '#ff4f8b', '#00a3a3', '#8e8e93'];
export const nid = () => crypto.randomUUID();

/* ---------- Suchen & Navigieren ---------- */
export function walk(fn){
  for (const p of S.projects) for (const it of p.items) {
    if (it.type === 'section') {
      fn(it, { p, section: it, list: p.items });
      for (const t of it.children) { fn(t, { p, section: it, list: it.children }); for (const s of t.children) fn(s, { p, section: it, parent: t, list: t.children }); }
    } else { fn(it, { p, list: p.items }); for (const s of it.children) fn(s, { p, parent: it, list: it.children }); }
  }
}
export function find(id){ let r = null; walk((n, ctx) => { if (!r && n.id === id) r = { n, ...ctx }; }); return r; }
export const path = f => [f.p.name, f.section && f.section.title, f.parent && f.parent.title].filter(Boolean);
export const isLeaf = n => n.type === 'task' && !n.children.some(c => !c.done);
const curDay = () => S.day || dayKey();
/** Wiederkehrende Aufgabe, deren nächster Termin noch nicht erreicht ist (wird gedimmt gezeigt, zählt nicht als offen) */
export const isResting = (n, today = curDay()) => !!n.repeat && !n.done && !!n.due && n.due > today;
/** Wiederkehrende Aufgabe, die heute (oder schon früher) fällig ist */
export const isDue = (n, today = curDay()) => !!n.repeat && !n.done && (!n.due || n.due <= today);
export const openCount = list => list.reduce((a, n) => a + (n.type === 'section' ? openCount(n.children) : (n.done || isResting(n) ? 0 : 1 + n.children.filter(c => !c.done).length)), 0);
/** Was kommt in „Heute“, wenn man diese Aufgabe einplant: sie selbst oder ihre offenen Unteraufgaben */
export const leafIds = n => isLeaf(n) ? [n.id] : n.children.filter(c => !c.done).map(c => c.id);
export function getList(listId){ const p = S.projects.find(p => p.id === listId); if (p) return p.items; const f = find(listId); return f ? f.n.children : null; }
export function todayCounts(){ const items = S.today.map(find).filter(Boolean); return { done: items.filter(f => f.n.done).length, total: items.length }; }

/* ---------- Anlegen ---------- */
export function newTask(){ return { type: 'task', id: nid(), title: '', important: false, note: '', done: false, children: [] }; }
export function newProject(name){
  const p = { id: nid(), name, color: COLORS[S.projects.length % COLORS.length], collapsed: false, items: [] };
  S.projects.push(p); return p;
}
export function newSection(pid){
  const p = S.projects.find(p => p.id === pid); p.collapsed = false;
  const s = { type: 'section', id: nid(), title: '', collapsed: false, children: [] };
  p.items.push(s); return s;
}
export function insertAfter(id){
  const f = find(id); const t = newTask();
  f.list.splice(f.list.indexOf(f.n) + 1, 0, t); return t.id;
}
export function appendTask({ pid, sid }){
  const t = newTask();
  if (sid) { const f = find(sid); f.n.collapsed = false; f.p.collapsed = false; f.n.children.push(t); }
  else { const p = S.projects.find(p => p.id === pid); p.collapsed = false; p.items.push(t); }
  return t.id;
}
/** Neue Aufgabe ganz oben im Abschnitt */
export function firstInSection(sid){
  const f = find(sid); const t = newTask(); f.n.collapsed = false; f.n.children.unshift(t); return t.id;
}

/* ---------- Erledigen ---------- */
export function markDone(id, at = Date.now()){
  const f = find(id); const n = f.n;
  n.done = true; n.doneAt = at;
  n.children.forEach(c => { if (!c.done) { c.done = true; c.doneAt = at; } });
  const h = { id, title: n.title, path: path(f), color: f.p.color, at };
  // Wiederkehrend: Der nächste Termin steht sofort fest; wieder offen wird die Aufgabe beim Tageswechsel (renewRecurring)
  if (n.repeat) { if (n.due) h.due = n.due; n.due = nextDue(n.repeat, n.due, dayKey(new Date(at))); }
  S.history.push(h);
}
/** Macht das letzte Erledigen rückgängig. Frühere Einträge (z. B. vergangene Monate) bleiben im Verlauf. */
export function undone(id){
  const f = find(id); if (!f) return;
  f.n.done = false; delete f.n.doneAt;
  let i = -1; S.history.forEach((h, j) => { if (h.id === id) i = j; });
  if (i < 0) return;
  const [h] = S.history.splice(i, 1);
  if (f.n.repeat && h.due) f.n.due = h.due;
}
/** Ist das der Verlaufseintrag, der sich gerade rückgängig machen lässt? */
export function canRestore(h){
  const f = find(h.id); if (!f || !f.n.done) return false;
  for (let j = S.history.length - 1; j >= 0; j--) if (S.history[j].id === h.id) return S.history[j] === h;
  return false;
}

/* ---------- Wiederkehrende Aufgaben ---------- */
/** Setzt die Regel (oder entfernt sie mit null). Der erste Termin ist ohne Angabe heute. */
export function setRepeat(id, rule){
  const n = find(id)?.n; if (!n || n.type !== 'task') return;
  const r = normRepeat(rule);
  if (!r) { delete n.repeat; delete n.due; return; }
  const due = n.due || curDay();
  if (r.unit === 'month' || r.unit === 'year') r.day = +due.slice(8);
  else delete r.day;
  n.repeat = r; n.due = due;
}
/** Neuer nächster Termin; Monats- und Jahresregeln halten sich danach an diesen Tag im Monat */
export function setDue(id, due){
  const n = find(id)?.n; if (!n || !n.repeat) return;
  n.due = due;
  if (n.repeat.unit === 'month' || n.repeat.unit === 'year') n.repeat.day = +due.slice(8);
}
/** „Diesmal auslassen“: springt zum nächsten Termin, ohne Eintrag im Verlauf */
export function skipOccurrence(id, today = curDay()){
  const n = find(id)?.n; if (!n || !n.repeat) return;
  n.due = nextDue(n.repeat, n.due, today);
}
/** Beim Tageswechsel: erledigte wiederkehrende Aufgaben werden wieder offen, mit frischen Unteraufgaben */
export function renewRecurring(){
  let n = 0;
  walk(t => {
    if (t.type !== 'task' || !t.repeat || !t.done) return;
    t.done = false; delete t.doneAt;
    t.children.forEach(c => { c.done = false; delete c.doneAt; });
    n++;
  });
  return n;
}
export const KEEP_DONE_DAYS = 14;
/**
 * Entfernt Aufgaben, die vor mehr als KEEP_DONE_DAYS Tagen erledigt wurden, aus den Projekten.
 * Im Verlauf bleiben sie stehen. Gibt die Anzahl entfernter Einträge zurück.
 */
export function purgeDone(now = Date.now()){
  const cutoff = now - KEEP_DONE_DAYS * 864e5; let n = 0;
  const old = t => { if (t.done && !t.doneAt) t.doneAt = now; return t.done && t.doneAt < cutoff; };
  const prune = list => {
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if (it.type === 'section') { prune(it.children); continue; }
      if (it.repeat) continue;   // wiederkehrend: Aufgabe und Checkliste bleiben
      if (old(it) && !it.children.some(c => !c.done)) { list.splice(i, 1); n++; continue; }
      it.children = it.children.filter(c => { const o = old(c); if (o) n++; return !o; });
    }
  };
  S.projects.forEach(p => prune(p.items));
  return n;
}

/* ---------- Projekte ---------- */
export function renameProject(pid, name){
  const p = S.projects.find(p => p.id === pid); const v = String(name).trim();
  if (p && v) p.name = v;
}

/* ---------- Umwandeln: Aufgabe ⇄ Abschnitt ---------- */
/** Aufgabe mit „:“ am Ende → Abschnitt (Unteraufgaben werden zu Aufgaben darin) */
export function taskToSection(f){
  const n = f.n;
  const s = { type: 'section', id: n.id, title: n.title.replace(/:+$/, '').trim(), collapsed: false, children: n.children.map(c => ({ ...c, children: c.children || [] })) };
  const items = f.p.items;
  if (f.section) { f.list.splice(f.list.indexOf(n), 1); items.splice(items.indexOf(f.section) + 1, 0, s); }
  else items.splice(items.indexOf(n), 1, s);
  S.today = S.today.filter(x => x !== n.id); S.leftovers = S.leftovers.filter(x => x !== n.id);
  return s;
}
/** Abschnitt → Aufgabe. Geht nur, wenn die Aufgaben darin keine eigenen Unteraufgaben haben. */
export function sectionToTask(f, title){
  const s = f.n;
  if (s.children.some(c => c.children.length)) return false;
  const t = { ...newTask(), id: s.id, title, children: s.children };
  f.list.splice(f.list.indexOf(s), 1, t); return true;
}
/**
 * Übernimmt einen bearbeiteten Titel. Ergebnis: { f, change } mit change =
 * 'toSection' | 'toTask' | 'keptSection' (Umwandeln nicht möglich) | null
 */
export function applyTitle(id, value){
  const f = find(id); if (!f) return { f: null, change: null };
  const raw = value.trim();
  if (f.n.type === 'section') {
    if (raw && !raw.endsWith(':')) {
      if (sectionToTask(f, raw)) return { f: find(id), change: 'toTask' };
      f.n.title = raw; return { f, change: 'keptSection' };
    }
    const t = raw.replace(/:+$/, '').trim();
    if (t || !f.n.children.length) f.n.title = t;
    return { f, change: null };
  }
  const wasColon = /:\s*$/.test(f.n.title);
  f.n.title = raw;
  if (!f.parent && !wasColon && raw.length > 1 && raw.endsWith(':')) { taskToSection(f); return { f: find(id), change: 'toSection' }; }
  return { f, change: null };
}

/* ---------- Ein- und Ausrücken, Verschieben ---------- */
/** Gibt einen Hinweistext zurück, wenn es nicht geht. */
export function indent(id){
  const f = find(id); if (!f || f.parent) return null;
  if (f.n.children.length) return 'Es gibt nur zwei Ebenen: Aufgabe und Unteraufgabe.';
  const i = f.list.indexOf(f.n); const prev = f.list.slice(0, i).reverse().find(x => !x.done);
  if (!prev) return null;
  f.list.splice(i, 1);
  prev.children.push(f.n); if (prev.type === 'section') prev.collapsed = false;
  return null;
}
export function outdent(id){
  const f = find(id); if (!f) return;
  if (f.parent) { const pf = find(f.parent.id); f.list.splice(f.list.indexOf(f.n), 1); pf.list.splice(pf.list.indexOf(f.parent) + 1, 0, f.n); }
  else if (f.section) { f.list.splice(f.list.indexOf(f.n), 1); const items = f.p.items; items.splice(items.indexOf(f.section) + 1, 0, f.n); }
}
export function moveItem(key, dir){
  const id = key.slice(2);
  if (key[0] === 't') { const i = S.today.indexOf(id), j = i + dir; if (j < 0 || j >= S.today.length) return; [S.today[i], S.today[j]] = [S.today[j], S.today[i]]; return; }
  const f = find(id); if (!f) return;
  const vis = f.list.filter(x => !x.done); const i = vis.indexOf(f.n), j = i + dir; if (j < 0 || j >= vis.length) return;
  const a = f.list.indexOf(f.n), b = f.list.indexOf(vis[j]); [f.list[a], f.list[b]] = [f.list[b], f.list[a]];
}
export function reorder(listId, ids){
  const arr = getList(listId); if (!arr) return;
  const map = new Map(arr.map(n => [n.id, n]));
  const rest = arr.filter(n => !ids.includes(n.id));
  arr.splice(0, arr.length, ...ids.map(i => map.get(i)).filter(Boolean), ...rest);
}

/* ---------- Löschen mit Rückgängig ---------- */
export function deleteNode(id){
  const f = find(id); if (!f) return;
  f.list.splice(f.list.indexOf(f.n), 1);
  S.today = S.today.filter(x => x !== id);
}
export let lastDeleted = null;
/** Löscht eine Aufgabe bzw. löst einen Abschnitt auf. Gibt eine Beschreibung fürs UI zurück. */
export function removeWithUndo(id){
  const pick = (arr, ids) => ids.map(x => [x, arr.indexOf(x)]).filter(([, i]) => i >= 0);
  const pi = S.projects.findIndex(p => p.id === id);
  if (pi >= 0) {
    const p = S.projects[pi], ids = [];
    walk((n, ctx) => { if (ctx.p === p) ids.push(n.id); });
    lastDeleted = { kind: 'project', n: p, list: S.projects, i: pi, today: pick(S.today, ids), left: pick(S.leftovers, ids) };
    S.projects.splice(pi, 1);
    S.today = S.today.filter(x => !ids.includes(x)); S.leftovers = S.leftovers.filter(x => !ids.includes(x));
    return { kind: 'project', title: p.name, open: openCount(p.items) };
  }
  const f = find(id); if (!f) return null;
  if (f.n.type === 'section') {
    const i = f.list.indexOf(f.n);
    lastDeleted = { kind: 'dissolve', n: f.n, list: f.list, i };
    f.list.splice(i, 1, ...f.n.children);
    return { kind: 'dissolve', title: f.n.title, open: f.n.children.filter(c => !c.done).length };
  }
  const ids = [id, ...f.n.children.map(c => c.id)];
  lastDeleted = { kind: 'delete', n: f.n, list: f.list, i: f.list.indexOf(f.n), today: pick(S.today, ids), left: pick(S.leftovers, ids) };
  f.list.splice(lastDeleted.i, 1);
  S.today = S.today.filter(x => !ids.includes(x)); S.leftovers = S.leftovers.filter(x => !ids.includes(x));
  return { kind: 'delete', title: f.n.title };
}
/** Macht das letzte Löschen rückgängig und gibt die ID zurück. */
export function restoreDeleted(){
  const d = lastDeleted; if (!d) return null;
  lastDeleted = null;
  if (d.kind === 'dissolve') {
    d.n.children.forEach(c => { const j = d.list.indexOf(c); if (j >= 0) d.list.splice(j, 1); });
    d.list.splice(Math.min(d.i, d.list.length), 0, d.n);
    return d.n.id;
  }
  d.list.splice(Math.min(d.i, d.list.length), 0, d.n);
  const put = (arr, entries) => entries.sort((a, b) => a[1] - b[1]).forEach(([x, i]) => arr.splice(Math.min(i, arr.length), 0, x));
  put(S.today, d.today); put(S.leftovers, d.left);
  return d.n.id;
}
