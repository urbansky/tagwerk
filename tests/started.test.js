import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, migrate, snapshot } from '../public/js/state.js';
import { toggleStarted, markDone, undone, find } from '../public/js/model.js';
import { reset, byTitle } from './helpers.js';

beforeEach(reset);

test('Aufgabe starten und wieder zurücknehmen', () => {
  const a = byTitle('Bericht schreiben');
  assert.equal(toggleStarted(a.id), true);
  assert.equal(a.started, true);
  assert.equal(toggleStarted(a.id), false);
  assert.equal('started' in a, false);
});

test('Abschnitte und erledigte Aufgaben lassen sich nicht starten', () => {
  const sec = byTitle('Server'), a = byTitle('Bericht schreiben');
  assert.equal(sec.type, 'section');
  assert.equal(toggleStarted(sec.id), false);
  assert.equal('started' in sec, false);
  markDone(a.id);
  assert.equal(toggleStarted(a.id), false);
  assert.equal('started' in a, false);
});

test('Erledigen nimmt die Markierung weg – auch bei Unteraufgaben; Rückgängig startet nicht wieder', () => {
  const r = byTitle('Release vorbereiten'), cl = byTitle('Changelog');
  toggleStarted(r.id); toggleStarted(cl.id);
  markDone(r.id);
  assert.equal('started' in r, false);
  assert.equal('started' in cl, false);
  undone(r.id);
  assert.equal(find(r.id).n.started, undefined);
});

test('Gestartet überlebt Speichern und Laden, erledigte Aufgaben verlieren es', () => {
  const a = byTitle('Bericht schreiben'), e = byTitle('Einkaufen');
  toggleStarted(a.id);
  e.started = true; e.done = true;   // ungültige Kombination aus alten oder fremden Daten
  const d = migrate(JSON.parse(JSON.stringify(snapshot())));
  const all = []; const walkT = l => l.forEach(n => { all.push(n); walkT(n.children || []); });
  d.projects.forEach(p => walkT(p.items));
  assert.equal(all.find(n => n.id === a.id).started, true);
  assert.equal('started' in all.find(n => n.id === e.id), false);
  assert.equal(all.filter(n => 'started' in n).length, 1);
  assert.equal(S.projects.length, 2);
});
