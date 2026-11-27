import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../public/js/state.js';
import { todayOrder, markDone, undone, moveItem } from '../public/js/model.js';
import { reset, byTitle } from './helpers.js';

beforeEach(reset);
const ids = (...titles) => titles.map(t => byTitle(t).id);

test('Erledigte stehen in Heute unten, sonst bleibt die geplante Reihenfolge', () => {
  const [a, b, c, d] = ids('Bericht schreiben', 'Einkaufen', 'Changelog', 'Tag setzen');
  S.today = [a, b, c, d];
  assert.deepEqual(todayOrder(), [a, b, c, d]);
  markDone(b); markDone(a);
  assert.deepEqual(todayOrder(), [c, d, a, b]);
  assert.deepEqual(S.today, [a, b, c, d]);   // gespeicherte Reihenfolge bleibt unverändert
});

test('Wieder offen: Aufgabe kehrt an ihren geplanten Platz zurück', () => {
  const [a, b, c] = ids('Bericht schreiben', 'Einkaufen', 'Changelog');
  S.today = [a, b, c];
  markDone(a);
  assert.deepEqual(todayOrder(), [b, c, a]);
  undone(a);
  assert.deepEqual(todayOrder(), [a, b, c]);
});

test('⌥↑/↓ in Heute verschiebt nur innerhalb der offenen bzw. erledigten', () => {
  const [a, b, c, d] = ids('Bericht schreiben', 'Einkaufen', 'Changelog', 'Tag setzen');
  S.today = [a, b, c, d];
  markDone(b);                                   // Anzeige: a c d | b
  moveItem('t:' + d, 1);                         // letzte offene bleibt über den erledigten
  assert.deepEqual(todayOrder(), [a, c, d, b]);
  moveItem('t:' + b, -1);                        // erledigte rutscht nicht zwischen die offenen
  assert.deepEqual(todayOrder(), [a, c, d, b]);
  moveItem('t:' + a, 1);                         // springt über die erledigte b hinweg zu c
  assert.deepEqual(todayOrder(), [c, a, d, b]);
  moveItem('t:' + d, -1);
  assert.deepEqual(todayOrder(), [c, d, a, b]);
});
