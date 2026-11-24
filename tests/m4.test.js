import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, migrate, snapshot } from '../public/js/state.js';
import { find, markDone, undone, purgeDone, renameProject, removeWithUndo, restoreDeleted, KEEP_DONE_DAYS } from '../public/js/model.js';
import { rollover } from '../public/js/day.js';
import { reset, byTitle } from './helpers.js';

beforeEach(reset);
const DAY = 864e5;

test('Projekt umbenennen; leerer Name ändert nichts', () => {
  const p = S.projects[0];
  renameProject(p.id, '  Büro  ');
  assert.equal(p.name, 'Büro');
  renameProject(p.id, '   ');
  assert.equal(p.name, 'Büro');
});

test('Projekt löschen mit Rückgängig inkl. Heute und Reste', () => {
  const [arbeit, privat] = S.projects;
  const a = byTitle('Bericht schreiben'), e = byTitle('Einkaufen'), cl = byTitle('Changelog');
  S.today = [e.id, a.id, cl.id]; S.leftovers = [a.id];
  const info = removeWithUndo(arbeit.id);
  assert.equal(info.kind, 'project');
  assert.equal(info.open, 7);
  assert.deepEqual(S.projects, [privat]);
  assert.deepEqual(S.today, [e.id]);
  assert.deepEqual(S.leftovers, []);
  restoreDeleted();
  assert.deepEqual(S.projects.map(p => p.name), ['Arbeit', 'Privat']);
  assert.deepEqual(S.today, [e.id, a.id, cl.id]);
  assert.deepEqual(S.leftovers, [a.id]);
});

test('markDone merkt den Zeitpunkt, undone entfernt ihn', () => {
  const a = byTitle('Bericht schreiben');
  markDone(a.id, 123);
  assert.equal(a.doneAt, 123);
  undone(a.id);
  assert.equal('doneAt' in a, false);
});

test('Alte erledigte Aufgaben werden aufgeräumt, frische bleiben', () => {
  const now = Date.UTC(2026, 10, 24);
  const old = now - (KEEP_DONE_DAYS + 1) * DAY, fresh = now - DAY;
  markDone(byTitle('Bericht schreiben').id, old);
  markDone(byTitle('Angebot prüfen').id, fresh);
  markDone(byTitle('Changelog').id, old);         // Unteraufgabe, Elternaufgabe bleibt offen
  markDone(byTitle('Backups testen').id, old);    // in einem Abschnitt
  assert.equal(purgeDone(now), 3);
  assert.equal(byTitle('Bericht schreiben'), null);
  assert.ok(byTitle('Angebot prüfen'));
  assert.equal(byTitle('Changelog'), null);
  assert.ok(byTitle('Release vorbereiten'));
  assert.equal(byTitle('Backups testen'), null);
  assert.equal(S.history.length, 4, 'Verlauf bleibt vollständig');
});

test('Erledigte Aufgaben ohne Zeitstempel (alte Daten) bekommen einen und bleiben erst einmal', () => {
  const a = byTitle('Einkaufen'); a.done = true;
  const now = Date.now();
  assert.equal(purgeDone(now), 0);
  assert.equal(a.doneAt, now);
});

test('Tageswechsel räumt auf', () => {
  const a = byTitle('Einkaufen');
  markDone(a.id, Date.now() - 30 * DAY);
  S.day = '2026-01-01';
  rollover('2026-11-24');
  assert.equal(find(a.id), null);
});

test('doneAt überlebt Speichern und Laden', () => {
  markDone(byTitle('Einkaufen').id, 4242);
  const d = migrate(JSON.parse(JSON.stringify(snapshot())));
  const t = d.projects[1].items.find(i => i.title === 'Einkaufen');
  assert.equal(t.doneAt, 4242);
});
