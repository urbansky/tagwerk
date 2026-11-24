import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, snapshot, migrate } from '../public/js/state.js';
import {
  markDone, undone, setRepeat, setDue, skipOccurrence, isResting, isDue, openCount, canRestore, purgeDone, leafIds
} from '../public/js/model.js';
import { rollover, dueTasks, shouldPromptPlan } from '../public/js/day.js';
import { reset, byTitle } from './helpers.js';

beforeEach(() => { reset(); S.day = '2026-11-24'; });
const at = (day, h = 10) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`).getTime();
const monthly = id => { setRepeat(id, { unit: 'month', every: 1 }); setDue(id, '2026-12-01'); };

test('setRepeat: erster Termin heute, Monatsregel merkt sich den Tag', () => {
  const t = byTitle('Bericht schreiben');
  setRepeat(t.id, { unit: 'month', every: 1 });
  assert.equal(t.due, '2026-11-24');
  assert.deepEqual(t.repeat, { every: 1, unit: 'month', day: 24 });
  setDue(t.id, '2026-12-01');
  assert.equal(t.repeat.day, 1);
  setRepeat(t.id, null);
  assert.equal(t.repeat, undefined);
  assert.equal(t.due, undefined);
});

test('Ruhend bis zum Termin: gedimmt und nicht offen gezählt', () => {
  const t = byTitle('Bericht schreiben'); monthly(t.id);
  const before = openCount(S.projects[0].items);
  assert.equal(isResting(t), true);
  assert.equal(isDue(t), false);
  S.day = '2026-12-01';
  assert.equal(isResting(t), false);
  assert.equal(isDue(t), true);
  assert.equal(openCount(S.projects[0].items), before + 1);
});

test('Erledigen: Verlauf, nächster Termin, wieder offen erst am nächsten Tag', () => {
  const t = byTitle('Bericht schreiben'); monthly(t.id);
  S.day = '2026-12-01';
  markDone(t.id, at('2026-12-01'));
  assert.equal(t.done, true);
  assert.equal(t.due, '2027-01-01');
  assert.equal(S.history.length, 1);
  rollover('2026-12-02');
  assert.equal(t.done, false);
  assert.equal(isResting(t), true);
});

test('Unteraufgaben sind nach dem Tageswechsel wieder offen und werden nie aufgeräumt', () => {
  const t = byTitle('Release vorbereiten'); monthly(t.id);
  S.day = '2026-12-01';
  markDone(byTitle('Changelog').id, at('2026-12-01', 9));
  purgeDone(at('2027-02-01'));
  assert.equal(t.children.length, 2, 'Checkliste bleibt, auch wenn ein Punkt lange erledigt ist');
  markDone(t.id, at('2026-12-01'));
  rollover('2026-12-02');
  assert.deepEqual(t.children.map(c => c.done), [false, false]);
});

test('Rückgängig stellt den alten Termin wieder her und lässt frühere Einträge stehen', () => {
  const t = byTitle('Bericht schreiben'); monthly(t.id);
  S.day = '2026-12-01'; markDone(t.id, at('2026-12-01')); rollover('2026-12-02');
  S.day = '2027-01-01'; markDone(t.id, at('2027-01-01'));
  assert.equal(S.history.length, 2);
  assert.equal(canRestore(S.history[0]), false);
  assert.equal(canRestore(S.history[1]), true);
  undone(t.id);
  assert.equal(t.done, false);
  assert.equal(t.due, '2027-01-01');
  assert.equal(S.history.length, 1);
});

test('Fällig: Vorschlag beim Planen, außer schon in Heute oder bei den Resten', () => {
  const a = byTitle('Bericht schreiben'), b = byTitle('Einkaufen'), r = byTitle('Release vorbereiten');
  [a, b, r].forEach(t => setRepeat(t.id, { unit: 'week', every: 1 }));
  assert.deepEqual(dueTasks(), [a.id, r.id, b.id]);
  S.today = [a.id]; S.leftovers = [byTitle('Changelog').id];
  assert.deepEqual(dueTasks(), [b.id], 'Release steckt über die Unteraufgabe schon in den Resten');
  assert.deepEqual(leafIds(r), [byTitle('Changelog').id, byTitle('Tag setzen').id]);
});

test('Diesmal auslassen springt zum nächsten Termin', () => {
  const t = byTitle('Bericht schreiben');
  setRepeat(t.id, { unit: 'week', every: 1 });   // fällig heute (Di)
  skipOccurrence(t.id);
  assert.equal(t.due, '2026-12-01');
  assert.equal(S.history.length, 0);
});

test('Nur ruhende Aufgaben: kein automatisches Planen', () => {
  S.projects = [S.projects[0]];
  const items = S.projects[0].items;
  items.splice(1);   // nur „Bericht schreiben“
  monthly(items[0].id);
  S.prompted = null; S.planned = false;
  assert.equal(shouldPromptPlan(), false);
});

test('Regel und Termin überstehen Speichern und Laden', () => {
  const t = byTitle('Bericht schreiben'); monthly(t.id);
  markDone(t.id, at('2026-11-24'));
  const back = migrate(JSON.parse(JSON.stringify(snapshot())));
  const n = back.projects[0].items[0];
  assert.deepEqual(n.repeat, { every: 1, unit: 'month', day: 1 });
  assert.equal(n.due, '2027-01-01', 'vor dem Termin erledigt zählt für den 1.12.');
  assert.equal(back.history[0].due, '2026-12-01', 'für Rückgängig gemerkt');
});
