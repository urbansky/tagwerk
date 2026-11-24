import { S, applyData, emptyData } from '../public/js/state.js';
import { parseNotes, toModel } from '../public/js/parser.js';
import { walk } from '../public/js/model.js';

export const SAMPLE = `# Meine Aufgaben

## Arbeit
- Bericht schreiben
- **Angebot prüfen**
- Server:
    - Updates einspielen
    - Backups testen
- Release vorbereiten
    - Changelog
    - Tag setzen

## Privat
- Einkaufen
- Garten
    - Rasen mähen
        - Benzin kaufen
    - Hecke schneiden
`;

/** Setzt den Zustand auf die Beispieldaten zurück. */
export function reset(){
  applyData({ ...emptyData(), projects: toModel(parseNotes(SAMPLE)) });
  S.flash.clear();
}

export function byTitle(title){
  let r = null; walk(n => { if (!r && n.title === title) r = n; }); return r;
}
