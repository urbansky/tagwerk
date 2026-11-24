/* Formatierte Zwischenablage (HTML, z. B. aus der Notizen-App) → Text im Format von parseNotes:
   Überschriften → „## Name“, Listen → „- Punkt“ mit 4 Leerzeichen pro Ebene, fett → **…**.
   Abgehakte Punkte aus Checklisten werden übersprungen. */

const BLOCK = /^(DIV|P|SECTION|ARTICLE|BODY|MAIN|BLOCKQUOTE|TABLE|TBODY|TR|TD)$/;
const LIST = /^(UL|OL)$/;
const HEAD = /^H[1-6]$/;

const isBold = el => /^(B|STRONG)$/.test(el.tagName) || /font-weight:\s*(bold|[6-9]00)/i.test(el.getAttribute('style') || '');
const isChecked = li => {
  const cls = (li.getAttribute('class') || '').toLowerCase();
  if (/(^|\s)(checked|done|completed)(\s|$)/.test(cls) || li.getAttribute('aria-checked') === 'true' || li.hasAttribute('data-checked') && li.getAttribute('data-checked') !== 'false') return true;
  const box = li.querySelector(':scope > input[type=checkbox]');
  return !!(box && box.hasAttribute('checked'));
};

/** Inline-Text eines Elements; verschachtelte Listen werden ausgelassen. */
function inline(el){
  let s = '';
  for (const c of el.childNodes) {
    if (c.nodeType === 3) { s += c.nodeValue; continue; }
    if (c.nodeType !== 1 || LIST.test(c.tagName) || c.tagName === 'STYLE' || c.tagName === 'SCRIPT') continue;
    if (c.tagName === 'BR') { s += ' '; continue; }
    if (c.tagName === 'A') {
      const t = inline(c).trim(), h = c.getAttribute('href') || '';
      s += /^https?:/.test(h) && !t.includes(h) ? (t ? `${t} (${h})` : h) : t;
      continue;
    }
    const t = inline(c);
    s += isBold(c) && t.trim() ? ` **${t.trim()}** ` : t;
  }
  return s;
}
const clean = s => s.replace(/ /g, ' ').replace(/\s+/g, ' ').replace(/\*\*\s*\*\*/g, '').trim();
const hasBlocks = el => [...el.children].some(c => BLOCK.test(c.tagName) || LIST.test(c.tagName) || HEAD.test(c.tagName) || c.tagName === 'LI');

export function htmlToNotes(html){
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  const push = (depth, text) => { if (text) out.push(depth ? `${'    '.repeat(depth - 1)}- ${text}` : text); };

  function walk(el, depth){
    for (const c of el.children) {
      const t = c.tagName;
      if (HEAD.test(t)) { const x = clean(inline(c)); if (x) out.push(`${t === 'H1' ? '#' : '##'} ${x.replace(/\*\*/g, '')}`); }
      else if (LIST.test(t)) walk(c, depth + 1);
      else if (t === 'LI') {
        if (isChecked(c)) continue;
        push(Math.max(depth, 1), clean(inline(c)));
        for (const sub of c.children) if (LIST.test(sub.tagName)) walk(sub, Math.max(depth, 1) + 1);
      }
      else if (BLOCK.test(t) || t === 'SPAN' || t === 'FONT') {
        if (hasBlocks(c)) walk(c, depth);
        else push(depth, clean(inline(c)));
      }
    }
  }
  walk(doc.body, 0);
  return out.join('\n');
}

/** Lohnt sich die HTML-Variante? (enthält Listen oder Überschriften) */
export const looksStructured = html => /<(ul|ol|li|h[1-6])[\s>]/i.test(html || '');
