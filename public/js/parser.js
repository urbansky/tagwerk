/* Import aus der Notizen-App bzw. Markdown: Überschriften → Projekte, Punkte → Aufgaben, Einrückung → Unteraufgaben */
import { COLORS, nid } from './model.js';

export function cleanText(s){
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, a, b) => a === b ? a : a + ' ' + b);
  let important = false;
  if (/\*\*(.+?)\*\*/.test(s)) { important = true; s = s.replace(/\*\*/g, ''); }
  return { text: s.trim(), important };
}

export function parseNotes(text){
  const projects = []; let cur = null; let stack = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,6})\s*(.*)$/);
    if (h) {
      if (h[1].length === 1) continue;                       // H1 = Titel der Notiz
      const t = cleanText(h[2]).text.replace(/:$/, '');
      if (!t) continue;
      cur = { name: t, raw: [] }; projects.push(cur); stack = []; continue;
    }
    const ind = line.match(/^[\t ]*/)[0].replace(/\t/g, '    ').length;
    const bm = line.trim().match(/^([-*•–—]|\d+[.)])\s+(.*)$/);
    if (!bm && ind === 0) {                                  // Zeile ohne Spiegelstrich = Projekt
      cur = { name: cleanText(line).text.replace(/:$/, ''), raw: [] }; projects.push(cur); stack = []; continue;
    }
    if (!cur) { cur = { name: 'Eingang', raw: [] }; projects.push(cur); }
    const c = cleanText(bm ? bm[2] : line.trim());
    const node = { text: c.text, important: c.important, children: [] };
    while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node); else cur.raw.push(node);
    stack.push({ ind, node });
  }
  return projects.filter(p => p.raw.length);
}

/** Heuristik: Punkt mit Unterpunkten wird Abschnitt, wenn er auf „:“ endet, Enkel hat oder nur ein Wort ist. */
export function looksLikeSection(n){
  if (!n.children.length) return false;
  if (/:$/.test(n.text)) return true;
  if (n.children.some(c => c.children.length)) return true;
  return n.text.split(/\s+/).length === 1;
}

const flattenNote = (ch, d = 0) => ch.map(c => '  '.repeat(d) + '• ' + c.text + (c.children.length ? '\n' + flattenNote(c.children, d + 1) : '')).join('\n');
const mkLeaf = c => ({ type: 'task', id: nid(), title: c.text, important: c.important, note: flattenNote(c.children), done: false, children: [] });
const mkTask = n => ({ type: 'task', id: nid(), title: n.text, important: n.important, note: '', done: false, children: n.children.map(mkLeaf) });

/** Ergebnis von parseNotes → Projekte. `over` erzwingt Abschnitt/Aufgabe pro „Projekt/Punkt“-Index. */
export function toModel(parsed, over = {}, colorOffset = 0){
  return parsed.map((p, pi) => ({
    id: nid(), name: p.name, color: COLORS[(pi + colorOffset) % COLORS.length], collapsed: false,
    items: p.raw.map((n, ii) => {
      const k = pi + '/' + ii; const isSec = k in over ? over[k] : looksLikeSection(n);
      return isSec ? { type: 'section', id: nid(), title: n.text.replace(/:$/, ''), collapsed: false, children: n.children.map(mkTask) } : mkTask(n);
    })
  }));
}
