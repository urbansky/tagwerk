import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../public/js/state.js';
import { markDone } from '../public/js/model.js';
import { rollover, shouldPromptPlan, dayKey, msToMidnight } from '../public/js/day.js';
import { reset, byTitle } from './helpers.js';

beforeEach(reset);

test('dayKey formatiert lokales Datum', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('Erster Start setzt nur das Datum', () => {
  S.today = [byTitle('Einkaufen').id];
  assert.equal(rollover('2026-11-24'), true);
  assert.equal(S.day, '2026-11-24');
  assert.equal(S.today.length, 1);
  assert.equal(rollover('2026-11-24'), false);
});

test('Tageswechsel: Offenes wird zu Resten, Erledigtes nicht', () => {
  const a = byTitle('Einkaufen'), b = byTitle('Bericht schreiben'), c = byTitle('Changelog');
  S.day = '2026-11-23'; S.planned = true;
  S.today = [a.id, b.id, 'geloescht'];
  S.leftovers = [c.id];
  markDone(b.id);
  rollover('2026-11-24');
  assert.deepEqual(S.today, []);
  assert.deepEqual(S.leftovers, [c.id, a.id]);
  assert.equal(S.planned, false);
  assert.equal(S.day, '2026-11-24');
});

test('Reste bleiben ohne Doppelte über mehrere Tage', () => {
  const a = byTitle('Einkaufen');
  S.day = '2026-11-22'; S.today = [a.id]; S.leftovers = [a.id];
  rollover('2026-11-24');
  assert.deepEqual(S.leftovers, [a.id]);
});

test('„Tag planen“ öffnet sich einmal pro Tag automatisch', () => {
  rollover('2026-11-24');
  assert.equal(shouldPromptPlan(), true);
  S.prompted = S.day;
  assert.equal(shouldPromptPlan(), false);
  rollover('2026-11-25');
  assert.equal(shouldPromptPlan(), true);
  S.planned = true;
  assert.equal(shouldPromptPlan(), false);
});

test('Ohne offene Aufgaben kein automatisches Planen', () => {
  S.projects = [];
  rollover('2026-11-24');
  assert.equal(shouldPromptPlan(), false);
});

test('msToMidnight', () => {
  const ms = msToMidnight(new Date(2026, 10, 24, 23, 59, 0));
  assert.ok(ms > 60_000 && ms < 70_000);
});
