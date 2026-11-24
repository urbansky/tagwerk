import { test } from 'node:test';
import assert from 'node:assert/strict';
import { step, nextDue, normRepeat, describe, dueLabel, addDays } from '../public/js/repeat.js';

const monthly = { every: 1, unit: 'month', day: 31 };

test('addDays über Monats- und Jahresgrenzen', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-03-28', 7), '2026-04-04');   // Zeitumstellung spielt keine Rolle
});

test('Monatlich am 31. landet am Monatsende und springt wieder zurück', () => {
  assert.equal(step(monthly, '2026-01-31'), '2026-02-28');
  assert.equal(step(monthly, '2026-02-28'), '2026-03-31');
  assert.equal(step(monthly, '2026-03-31'), '2026-04-30');
  assert.equal(step({ every: 1, unit: 'month', day: 31 }, '2028-01-31'), '2028-02-29');
});

test('Vierteljährlich, jährlich, wöchentlich, alle 2 Wochen', () => {
  assert.equal(step({ every: 3, unit: 'month', day: 15 }, '2026-11-15'), '2027-02-15');
  assert.equal(step({ every: 1, unit: 'year', day: 29 }, '2028-02-29'), '2029-02-28');
  assert.equal(step({ every: 1, unit: 'year', day: 29 }, '2029-02-28'), '2030-02-28');
  assert.equal(step({ every: 1, unit: 'week' }, '2026-11-24'), '2026-12-01');
  assert.equal(step({ every: 2, unit: 'week' }, '2026-11-24'), '2026-12-08');
  assert.equal(step({ every: 1, unit: 'day' }, '2026-11-30'), '2026-12-01');
});

test('Fester Termin: pünktlich erledigt → nächster Termin', () => {
  const r = { every: 1, unit: 'month', day: 1 };
  assert.equal(nextDue(r, '2026-12-01', '2026-12-01'), '2027-01-01');
});

test('Fester Termin: früher erledigt zählt für den anstehenden Termin', () => {
  const r = { every: 1, unit: 'month', day: 1 };
  assert.equal(nextDue(r, '2026-12-01', '2026-11-28'), '2027-01-01');
});

test('Fester Termin: verpasste Termine stapeln sich nicht', () => {
  const r = { every: 1, unit: 'month', day: 1 };
  assert.equal(nextDue(r, '2026-09-01', '2026-11-24'), '2026-12-01');
  const w = { every: 1, unit: 'week' };
  assert.equal(nextDue(w, '2026-11-02', '2026-11-24'), '2026-11-30');   // bleibt montags
});

test('Ab Erledigung: ein Schritt ab dem Tag des Erledigens', () => {
  const r = { every: 2, unit: 'week', from: 'done' };
  assert.equal(nextDue(r, '2026-11-10', '2026-11-24'), '2026-12-08');
});

test('normRepeat bereinigt und lehnt Unbekanntes ab', () => {
  assert.equal(normRepeat(null), null);
  assert.equal(normRepeat({ unit: 'fortnight' }), null);
  assert.deepEqual(normRepeat({ unit: 'month', every: '3', day: 15, from: 'x' }), { every: 3, unit: 'month', day: 15 });
  assert.deepEqual(normRepeat({ unit: 'week', every: 0, from: 'done' }), { every: 1, unit: 'week', from: 'done' });
});

test('describe formuliert die Regel', () => {
  assert.equal(describe({ every: 1, unit: 'month', day: 1 }, '2026-12-01'), 'Monatlich am 1.');
  assert.equal(describe({ every: 3, unit: 'month', day: 31 }, '2027-02-28'), 'Vierteljährlich am 31.');
  assert.equal(describe({ every: 2, unit: 'week' }, '2026-11-23'), 'Alle 2 Wochen am Montag');
  assert.equal(describe({ every: 1, unit: 'year', day: 15 }, '2027-03-15'), 'Jährlich am 15. März');
  assert.equal(describe({ every: 4, unit: 'month', from: 'done' }, '2027-03-15'), 'Alle 4 Monate ab Erledigung');
});

test('dueLabel relativ zu heute', () => {
  assert.equal(dueLabel('2026-11-24', '2026-11-24'), 'heute');
  assert.equal(dueLabel('2026-11-25', '2026-11-24'), 'morgen');
  assert.match(dueLabel('2026-12-01', '2026-11-24'), /1\. Dez/);
  assert.match(dueLabel('2027-01-01', '2026-11-24'), /2027/);
});
