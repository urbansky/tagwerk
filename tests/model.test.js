import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../public/js/state.js';
import {
  find, isLeaf, openCount, markDone, undone, applyTitle, indent, outdent, moveItem,
  removeWithUndo, restoreDeleted, insertAfter, firstInSection, newSection
} from '../public/js/model.js';
import { reset, byTitle } from './helpers.js';

beforeEach(reset);
const arbeit = () => S.projects[0];

test('find liefert Kontext (Projekt, Abschnitt, Eltern)', () => {
  const f = find(byTitle('Backups testen').id);
  assert.equal(f.p.name, 'Arbeit');
  assert.equal(f.section.title, 'Server');
  const g = find(byTitle('Changelog').id);
  assert.equal(g.parent.title, 'Release vorbereiten');
});

test('isLeaf: nur Aufgaben ohne offene Unteraufgaben', () => {
  assert.equal(isLeaf(byTitle('Release vorbereiten')), false);
  assert.equal(isLeaf(byTitle('Changelog')), true);
  markDone(byTitle('Changelog').id); markDone(byTitle('Tag setzen').id);
  assert.equal(isLeaf(byTitle('Release vorbereiten')), true);
});

test('markDone schreibt den Verlauf, undone nimmt ihn zurück', () => {
  const id = byTitle('Bericht schreiben').id;
  markDone(id, 1000);
  assert.equal(S.history.length, 1);
  assert.deepEqual(S.history[0].path, ['Arbeit']);
  undone(id);
  assert.equal(S.history.length, 0);
  assert.equal(byTitle('Bericht schreiben').done, false);
});

test('openCount zählt offene Aufgaben inkl. Abschnitte', () => {
  // Bericht, Angebot, Updates, Backups, Release + 2 Unteraufgaben
  assert.equal(openCount(arbeit().items), 7);
});

test('Aufgabe mit „:“ wird zum Abschnitt, Unteraufgaben werden Aufgaben', () => {
  const t = byTitle('Release vorbereiten');
  S.today = [t.id];
  const { f, change } = applyTitle(t.id, 'Release:');
  assert.equal(change, 'toSection');
  assert.equal(f.n.type, 'section');
  assert.equal(f.n.title, 'Release');
  assert.deepEqual(f.n.children.map(c => c.title), ['Changelog', 'Tag setzen']);
  assert.equal(arbeit().items.indexOf(f.n), 3, 'bleibt an derselben Stelle');
  assert.deepEqual(S.today, [], 'Abschnitte gehören nicht in Heute');
});

test('Aufgabe in einem Abschnitt wird zum Abschnitt dahinter', () => {
  const t = byTitle('Updates einspielen');
  const { f } = applyTitle(t.id, 'Updates:');
  const items = arbeit().items;
  assert.equal(items.indexOf(f.n), items.findIndex(i => i.title === 'Server') + 1);
});

test('Bereits vorhandener Doppelpunkt löst keine Umwandlung aus', () => {
  const t = byTitle('Bericht schreiben'); t.title = 'Notiz:';
  assert.equal(applyTitle(t.id, 'Notiz: neu:').change, null);
});

test('Unteraufgabe mit „:“ bleibt Unteraufgabe', () => {
  assert.equal(applyTitle(byTitle('Changelog').id, 'Changelog:').change, null);
});

test('Abschnitt ohne „:“ wird zur Aufgabe – außer bei Enkeln', () => {
  const server = arbeit().items[2];
  const r = applyTitle(server.id, 'Server');
  assert.equal(r.change, 'toTask');
  assert.equal(r.f.n.type, 'task');
  assert.deepEqual(r.f.n.children.map(c => c.title), ['Updates einspielen', 'Backups testen']);

  const garten = S.projects[1].items[1];
  const r2 = applyTitle(garten.id, 'Garten');
  assert.equal(r2.change, 'keptSection');
  assert.equal(r2.f.n.type, 'section');
});

test('Abschnitt umbenennen; leerer Name bleibt erhalten, wenn er Aufgaben hat', () => {
  const server = arbeit().items[2];
  applyTitle(server.id, 'Infrastruktur:');
  assert.equal(server.title, 'Infrastruktur');
  applyTitle(server.id, ':');
  assert.equal(server.title, 'Infrastruktur');
});

test('Einrücken: in vorherige Aufgabe bzw. Abschnitt; max. zwei Ebenen', () => {
  const angebot = byTitle('Angebot prüfen');
  indent(angebot.id);
  assert.equal(find(angebot.id).parent.title, 'Bericht schreiben');
  const server = arbeit().items.find(i => i.title === 'Server');
  const neu = insertAfter(server.id);
  indent(neu);
  assert.equal(find(neu).section.title, 'Server');
  const release = byTitle('Release vorbereiten');
  assert.match(indent(release.id) || '', /zwei Ebenen/);
});

test('Ausrücken aus Abschnitt und aus Aufgabe', () => {
  const backups = byTitle('Backups testen');
  outdent(backups.id);
  assert.equal(find(backups.id).section, undefined);
  const cl = byTitle('Changelog');
  outdent(cl.id);
  assert.equal(find(cl.id).parent, undefined);
});

test('Verschieben mit ⌥↑/↓', () => {
  const b = byTitle('Bericht schreiben');
  moveItem('p:' + b.id, 1);
  assert.equal(arbeit().items[1], b);
  moveItem('p:' + b.id, -1);
  moveItem('p:' + b.id, -1);
  assert.equal(arbeit().items[0], b);
});

test('Löschen mit Rückgängig stellt Position, Heute und Reste wieder her', () => {
  const r = byTitle('Release vorbereiten');
  const cl = byTitle('Changelog');
  S.today = ['x', cl.id]; S.leftovers = [cl.id];
  removeWithUndo(r.id);
  assert.equal(find(r.id), null);
  assert.deepEqual(S.today, ['x']);
  assert.deepEqual(S.leftovers, []);
  assert.equal(restoreDeleted(), r.id);
  assert.equal(arbeit().items[3], r);
  assert.deepEqual(S.today, ['x', cl.id]);
  assert.deepEqual(S.leftovers, [cl.id]);
});

test('Abschnitt auflösen: Aufgaben bleiben, Rückgängig stellt ihn wieder her', () => {
  const server = arbeit().items[2];
  const info = removeWithUndo(server.id);
  assert.equal(info.kind, 'dissolve');
  assert.equal(info.open, 2);
  assert.deepEqual(arbeit().items.map(i => i.title), ['Bericht schreiben', 'Angebot prüfen', 'Updates einspielen', 'Backups testen', 'Release vorbereiten']);
  restoreDeleted();
  assert.deepEqual(arbeit().items.map(i => i.title), ['Bericht schreiben', 'Angebot prüfen', 'Server', 'Release vorbereiten']);
  assert.equal(server.children.length, 2);
});

test('Neue Aufgaben: darunter, oben im Abschnitt, neuer Abschnitt am Ende', () => {
  const b = byTitle('Bericht schreiben');
  const id = insertAfter(b.id);
  assert.equal(arbeit().items[1].id, id);
  const server = arbeit().items.find(i => i.title === 'Server');
  const first = firstInSection(server.id);
  assert.equal(server.children[0].id, first);
  const s = newSection(arbeit().id);
  assert.equal(arbeit().items.at(-1), s);
});
