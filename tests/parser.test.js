import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotes, toModel, cleanText, looksLikeSection } from '../public/js/parser.js';
import { SAMPLE } from './helpers.js';

test('Überschriften werden zu Projekten, H1 wird ignoriert', () => {
  const p = parseNotes(SAMPLE);
  assert.deepEqual(p.map(x => x.name), ['Arbeit', 'Privat']);
});

test('Fett markiert = wichtig, Markdown-Links werden aufgelöst', () => {
  assert.deepEqual(cleanText('**Angebot prüfen**'), { text: 'Angebot prüfen', important: true });
  assert.equal(cleanText('Doku ([https://a.de](https://a.de))').text, 'Doku (https://a.de)');
  assert.equal(cleanText('[Seite](https://a.de)').text, 'Seite https://a.de');
});

test('Einrückung wird zur Hierarchie', () => {
  const [arbeit] = parseNotes(SAMPLE);
  const server = arbeit.raw.find(n => n.text === 'Server:');
  assert.deepEqual(server.children.map(c => c.text), ['Updates einspielen', 'Backups testen']);
});

test('Abschnitts-Heuristik: Doppelpunkt, Enkel oder ein einzelnes Wort', () => {
  const [arbeit, privat] = parseNotes(SAMPLE);
  const t = s => [...arbeit.raw, ...privat.raw].find(n => n.text === s);
  assert.equal(looksLikeSection(t('Server:')), true);
  assert.equal(looksLikeSection(t('Garten')), true);
  assert.equal(looksLikeSection(t('Release vorbereiten')), false);
  assert.equal(looksLikeSection(t('Einkaufen')), false);
});

test('toModel: Abschnitte, Aufgaben, Unteraufgaben; tiefere Ebenen landen in der Notiz', () => {
  const [arbeit, privat] = toModel(parseNotes(SAMPLE));
  const kinds = arbeit.items.map(i => i.type + ':' + i.title);
  assert.deepEqual(kinds, ['task:Bericht schreiben', 'task:Angebot prüfen', 'section:Server', 'task:Release vorbereiten']);
  assert.equal(arbeit.items[1].important, true);
  assert.deepEqual(arbeit.items[3].children.map(c => c.title), ['Changelog', 'Tag setzen']);
  const garten = privat.items[1];
  assert.equal(garten.type, 'section');
  const rasen = garten.children.find(c => c.title === 'Rasen mähen');
  assert.equal(rasen.children.length, 1);
  assert.equal(rasen.children[0].note, '');
  assert.equal(rasen.children[0].title, 'Benzin kaufen');
});

test('toModel: Überschreiben der Heuristik per Index', () => {
  const parsed = parseNotes(SAMPLE);
  const [arbeit] = toModel(parsed, { '0/2': false });
  assert.equal(arbeit.items[2].type, 'task');
});

test('IDs sind eindeutig', () => {
  const ids = new Set(); let n = 0;
  const visit = x => { ids.add(x.id); n++; (x.items || x.children || []).forEach(visit); };
  toModel(parseNotes(SAMPLE)).forEach(visit);
  assert.equal(ids.size, n);
});
