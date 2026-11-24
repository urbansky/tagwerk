/* Tageswechsel: offene Heute-Aufgaben werden zu Resten von gestern */
import { S } from './state.js';
import { find, walk, purgeDone } from './model.js';

const pad = n => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dateStr = (d = new Date()) => d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

const alive = id => { const f = find(id); return !!f && f.n.type === 'task' && !f.n.done; };

/** Wechselt auf einen neuen Tag, falls nötig. Gibt true zurück, wenn sich der Tag geändert hat. */
export function rollover(today = dayKey()){
  if (S.day === today) return false;
  if (S.day !== null) {
    const open = S.today.filter(alive);
    S.leftovers = [...new Set([...S.leftovers.filter(alive), ...open])];
    S.today = [];
    S.planned = false;
    purgeDone();
  }
  S.day = today;
  return true;
}

/** Soll „Tag planen“ heute automatisch geöffnet werden? (einmal pro Tag) */
export function shouldPromptPlan(){
  if (S.planned || S.prompted === S.day) return false;
  let open = false; walk(n => { if (n.type === 'task' && !n.done) open = true; });
  return open;
}

/** Millisekunden bis kurz nach der nächsten Mitternacht */
export function msToMidnight(now = new Date()){
  const m = new Date(now); m.setHours(24, 0, 5, 0); return m - now;
}
