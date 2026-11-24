/* Wiederkehrende Aufgaben: Regeln und Termine. Reine Datumsrechnung, ohne DOM und ohne Zustand.
   Regel: { every: n, unit: 'day' | 'week' | 'month' | 'year', day?: 1–31, from?: 'done' }
   - day: Tag im Monat, an dem Monats- und Jahresregeln festhalten (31. → im Februar der 28./29.)
   - from: 'done' = nächster Termin zählt ab Erledigung statt ab dem festen Termin
   Termine sind lokale Tage im Format JJJJ-MM-TT. */

const pad = n => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parts = key => key.split('-').map(Number);
const fmt = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const asDate = key => { const [y, m, d] = parts(key); return new Date(y, m - 1, d); };

export function addDays(key, n){
  const [y, m, d] = parts(key); const t = new Date(Date.UTC(y, m - 1, d + n));
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
function addMonths(key, n, day){
  const [y, m] = parts(key); const i = m - 1 + n;
  const yy = y + Math.floor(i / 12), mm = ((i % 12) + 12) % 12 + 1;
  return fmt(yy, mm, Math.min(day, daysIn(yy, mm)));
}

const UNITS = ['day', 'week', 'month', 'year'];
/** Prüft eine gespeicherte Regel. Gibt eine bereinigte Regel oder null zurück. */
export function normRepeat(r){
  if (!r || typeof r !== 'object' || !UNITS.includes(r.unit)) return null;
  const every = Math.min(99, Math.max(1, Math.round(+r.every) || 1));
  const out = { every, unit: r.unit };
  if (+r.day >= 1 && +r.day <= 31) out.day = Math.round(+r.day);
  if (r.from === 'done') out.from = 'done';
  return out;
}
export const isDayKey = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Ein Schritt der Regel ab einem Termin */
export function step(rule, key){
  const n = rule.every || 1, day = rule.day || parts(key)[2];
  switch (rule.unit) {
    case 'day': return addDays(key, n);
    case 'week': return addDays(key, 7 * n);
    case 'month': return addMonths(key, n, day);
    default: return addMonths(key, 12 * n, day);
  }
}

/**
 * Nächster Termin, wenn die Aufgabe am Tag `doneDay` erledigt (oder ausgelassen) wird.
 * Fester Termin: der erste Termin im Rhythmus nach dem bisherigen Termin bzw. nach heute –
 * verpasste Termine stapeln sich nicht. Ab Erledigung: ein Schritt ab heute.
 */
export function nextDue(rule, due, doneDay){
  if (rule.from === 'done' || !isDayKey(due)) return step(rule, doneDay);
  const after = due > doneDay ? due : doneDay;
  let d = due;
  for (let i = 0; d <= after && i < 5000; i++) d = step(rule, d);
  return d;
}

/* ---------- Texte ---------- */
const PRESETS = [
  ['day', 1, 'täglich'], ['week', 1, 'wöchentlich'], ['week', 2, 'alle 2 Wochen'], ['month', 1, 'monatlich'],
  ['month', 3, 'vierteljährlich'], ['month', 6, 'halbjährlich'], ['year', 1, 'jährlich']
];
/** Auswahl in der Detailansicht: [Schlüssel, Text] */
export const REPEAT_CHOICES = PRESETS.map(([u, n, t]) => [`${u}:${n}`, t]);
export const choiceKey = r => r ? `${r.unit}:${r.every || 1}` : '';
const PLURAL = { day: 'Tage', week: 'Wochen', month: 'Monate', year: 'Jahre' };
const rhythm = r => (PRESETS.find(([u, n]) => u === r.unit && n === (r.every || 1)) || [])[2] || `alle ${r.every} ${PLURAL[r.unit]}`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/** z. B. „Monatlich am 1.“, „Alle 2 Wochen am Montag“, „Jährlich am 15. März“, „Wöchentlich ab Erledigung“ */
export function describe(rule, due){
  let s = rhythm(rule);
  if (rule.from === 'done') s += ' ab Erledigung';
  else if (isDayKey(due)) {
    const d = asDate(due);
    if (rule.unit === 'week') s += ' am ' + d.toLocaleDateString('de-DE', { weekday: 'long' });
    else if (rule.unit === 'month') s += ` am ${rule.day || d.getDate()}.`;
    else if (rule.unit === 'year') s += ' am ' + d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  }
  return cap(s);
}

/** Termin relativ zu heute: „heute“, „morgen“, „Fr., 5. Dez.“ bzw. mit Jahr, wenn es nicht dieses ist */
export function dueLabel(due, today){
  if (due === today) return 'heute';
  if (due === addDays(today, 1)) return 'morgen';
  const d = asDate(due), sameYear = due.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}
