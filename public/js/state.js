/* Zentraler Zustand: gespeicherte Daten + flüchtiger UI-Zustand */
import { normRepeat, isDayKey } from './repeat.js';

// 2: Aufgaben können wiederkehren (repeat, due). Ältere Versionen lehnen solche Daten ab, statt die Regeln stillschweigend zu verlieren.
export const SCHEMA = 2;

// Diese Felder werden gespeichert, alles andere in S ist nur UI-Zustand.
const DATA_KEYS = ['projects', 'today', 'leftovers', 'history', 'planned', 'day', 'prompted'];

export const S = {
  // Daten
  projects: [], today: [], leftovers: [], history: [],
  planned: false,   // wurde der Tag schon geplant?
  day: null,        // Datum (JJJJ-MM-TT), zu dem today/leftovers gehören
  prompted: null,   // Datum, an dem „Tag planen“ automatisch geöffnet wurde
  // UI
  focus: null, editing: null, flash: new Set(), pulse: null, lastPct: 0, celebrate: false, opening: null,
  ui: { ov: null, menu: false, plan: null, imp: null, detail: null }
};

export function emptyData(){
  return { projects: [], today: [], leftovers: [], history: [], planned: false, day: null, prompted: null };
}

export function snapshot(){
  return { schema: SCHEMA, data: Object.fromEntries(DATA_KEYS.map(k => [k, S[k]])) };
}

/** Wandelt gespeicherte Daten (auch ältere Formate) ins aktuelle Format. Wirft bei Unbekanntem. */
export function migrate(raw){
  if (!raw || typeof raw !== 'object') throw new Error('Keine Tagwerk-Daten');
  if (typeof raw.schema === 'number') {
    if (raw.schema > SCHEMA) throw new Error('Die Daten stammen aus einer neueren Tagwerk-Version.');
    if (!raw.data || !Array.isArray(raw.data.projects)) throw new Error('Keine Tagwerk-Daten');
    return normalize(raw.data);
  }
  // Export aus dem UI-Entwurf: { app: 'tagwerk', version: 1, projects, today, … }
  if (raw.app === 'tagwerk' && Array.isArray(raw.projects)) return normalize({ ...raw, planned: false, day: null });
  throw new Error('Keine Tagwerk-Daten');
}

const arr = v => Array.isArray(v) ? v : [];
function normTask(t){
  const repeat = normRepeat(t.repeat);
  return {
    type: 'task', id: String(t.id), title: String(t.title ?? ''), important: !!t.important, note: String(t.note ?? ''), done: !!t.done,
    ...(t.doneAt ? { doneAt: +t.doneAt } : {}),
    ...(t.started && !t.done ? { started: true } : {}),
    ...(repeat ? { repeat, ...(isDayKey(t.due) ? { due: t.due } : {}) } : {}),
    children: arr(t.children).map(normTask)
  };
}
function normalize(d){
  const projects = arr(d.projects).map(p => ({
    id: String(p.id), name: String(p.name ?? ''), color: p.color || '#8e8e93', collapsed: !!p.collapsed,
    items: arr(p.items).map(it => it.type === 'section'
      ? { type: 'section', id: String(it.id), title: String(it.title ?? ''), collapsed: !!it.collapsed, children: arr(it.children).map(normTask) }
      : normTask(it))
  }));
  return {
    projects, today: arr(d.today).map(String), leftovers: arr(d.leftovers).map(String),
    history: arr(d.history).filter(h => h && h.id && h.at).map(h => { const { due, ...rest } = h; return isDayKey(due) ? h : rest; }),
    planned: !!d.planned, day: d.day || null, prompted: d.prompted || null
  };
}

export function applyData(d){
  Object.assign(S, emptyData(), d);
  S.focus = S.editing = null;
}
