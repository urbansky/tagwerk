import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, backupsToDelete, summarize } from '../public/js/syncrules.js';

const rec = (savedAt, n = 1) => ({ savedAt, data: { projects: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, items: [{ type: 'task', done: false, children: [] }] })) } });

test('Keine Datei → Browser schreibt', () => {
  assert.equal(decide(rec(1), null, null), 'write');
});

test('Noch nichts im Browser → Datei wird übernommen', () => {
  assert.equal(decide(null, rec(5), null), 'read');
  assert.equal(decide(rec(1, 0), rec(5), null), 'read', 'leerer Browser, neu gewählter Ordner');
});

test('Gleicher Stand', () => {
  assert.equal(decide(rec(5), rec(5), 3), 'same');
});

test('Nur die Datei hat sich geändert (z. B. iCloud) → lesen', () => {
  assert.equal(decide(rec(5), rec(9), 5), 'read');
});

test('Nur der Browser hat sich geändert → schreiben', () => {
  assert.equal(decide(rec(9), rec(5), 5), 'write');
});

test('Beide geändert → Konflikt', () => {
  assert.equal(decide(rec(9), rec(8), 5), 'conflict');
  assert.equal(decide(rec(9), rec(8), null), 'conflict', 'neuer Ordner mit anderem Stand');
});

test('Absichtlich geleerter Browser überschreibt nicht mit alten Daten', () => {
  assert.equal(decide(rec(9, 0), rec(5), 5), 'write');
});

test('Datei ohne Zeitstempel gilt als geändert', () => {
  assert.equal(decide(rec(5), { data: { projects: [] } }, 5), 'read');
});

test('Sicherungen: die neuesten bleiben, fremde Dateien werden nicht angefasst', () => {
  const names = ['tagwerk-2026-11-01.json', 'tagwerk-2026-11-03.json', 'tagwerk-2026-11-02.json', 'konflikt-x.json', 'notiz.txt'];
  assert.deepEqual(backupsToDelete(names, 2), ['tagwerk-2026-11-01.json']);
  assert.deepEqual(backupsToDelete(names, 30), []);
});

test('Zusammenfassung zählt offene Aufgaben inkl. Abschnitte', () => {
  const r = { savedAt: 7, data: { projects: [{ items: [
    { type: 'task', done: false, children: [{ done: false }, { done: true }] },
    { type: 'section', children: [{ type: 'task', done: true, children: [] }, { type: 'task', done: false, children: [] }] }
  ] }] } };
  assert.deepEqual(summarize(r), { projects: 1, open: 3, savedAt: 7 });
});
