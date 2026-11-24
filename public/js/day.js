/* Tageswechsel: offene Heute-Aufgaben werden zu Resten von gestern, erledigte wiederkehrende Aufgaben wieder offen */
import { S } from './state.js';
import { find, walk, purgeDone, renewRecurring, isDue, isResting } from './model.js';
import { dayKey } from './repeat.js';

export { dayKey };
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
    renewRecurring();
    purgeDone();
  }
  S.day = today;
  return true;
}

/** Fällige wiederkehrende Aufgaben, über die beim Planen noch zu entscheiden ist (nicht schon in Heute oder bei den Resten) */
export function dueTasks(today = S.day || dayKey()){
  const out = [], taken = new Set([...S.today, ...S.leftovers]);
  walk((n, ctx) => {
    if (n.type !== 'task' || ctx.parent || !isDue(n, today)) return;
    const ids = [n.id, ...n.children.map(c => c.id)];
    if (!ids.some(id => taken.has(id))) out.push(n.id);
  });
  return out;
}

/** Soll „Tag planen“ heute automatisch geöffnet werden? (einmal pro Tag) */
export function shouldPromptPlan(){
  if (S.planned || S.prompted === S.day) return false;
  let open = false; walk(n => { if (n.type === 'task' && !n.done && !isResting(n)) open = true; });
  return open;
}

/** Millisekunden bis kurz nach der nächsten Mitternacht */
export function msToMidnight(now = new Date()){
  const m = new Date(now); m.setHours(24, 0, 5, 0); return m - now;
}
