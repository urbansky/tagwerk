import { test } from 'node:test';
import assert from 'node:assert/strict';
import { S, migrate, snapshot, applyData, SCHEMA } from '../public/js/state.js';
import { reset } from './helpers.js';

test('snapshot → migrate ergibt dieselben Daten', () => {
  reset(); S.today = [S.projects[0].items[0].id]; S.day = '2026-11-24';
  const snap = JSON.parse(JSON.stringify(snapshot()));
  assert.equal(snap.schema, SCHEMA);
  assert.deepEqual(migrate(snap), snap.data);
});

test('snapshot enthält keinen UI-Zustand', () => {
  reset(); S.focus = 'p:x';
  const keys = Object.keys(snapshot().data).sort();
  assert.deepEqual(keys, ['day', 'history', 'leftovers', 'planned', 'projects', 'prompted', 'today']);
});

test('Export aus dem UI-Entwurf wird übernommen', () => {
  const legacy = { app: 'tagwerk', version: 1, projects: [{ id: 'p1', name: 'A', color: '#000', items: [{ type: 'task', id: 'n1', title: 'X', children: [] }] }], today: ['n1'], history: [], leftovers: [] };
  const d = migrate(legacy);
  assert.equal(d.projects[0].items[0].title, 'X');
  assert.equal(d.projects[0].items[0].done, false);
  assert.deepEqual(d.today, ['n1']);
  assert.equal(d.day, null);
});

test('Unbekanntes oder neueres Format wird abgelehnt', () => {
  assert.throws(() => migrate({ foo: 1 }), /Keine Tagwerk-Daten/);
  assert.throws(() => migrate({ schema: SCHEMA + 1, data: { projects: [] } }), /neueren/);
});

test('applyData setzt fehlende Felder auf Standardwerte', () => {
  applyData({ projects: [] });
  assert.deepEqual(S.today, []);
  assert.equal(S.day, null);
});
