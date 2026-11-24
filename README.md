# Tagwerk

Aufgaben nach Projekten – und jeden Morgen der Plan für heute.

Tagwerk läuft komplett im Browser. Es gibt keinen Server und keine Konten. Deine Daten verlassen den Rechner nicht.

## Entwickeln

Kein Build-Schritt. Native ES-Module, keine Abhängigkeiten.

```bash
npm run dev     # http://localhost:8765
npm test        # node --test
```

## Aufbau

| Datei | Inhalt |
|---|---|
| `public/index.html`, `public/app.css` | Seite und Styles |
| `public/js/state.js` | Zustand, Speicherformat (Schema-Version) und Migrationen |
| `public/js/model.js` | Datenmodell: Projekte → Abschnitte → Aufgaben → Unteraufgaben |
| `public/js/parser.js` | Import aus der Notizen-App bzw. Markdown |
| `public/js/day.js` | Tageswechsel, Reste von gestern, automatisches „Tag planen“ |
| `public/js/store.js` | Speicherung in IndexedDB, Schreibsperre für mehrere Fenster |
| `public/js/filesync.js` | Speicherordner: `tagwerk.json`, Tagessicherungen, Abgleich |
| `public/js/syncrules.js` | Regeln für den Abgleich Browser ⇄ Datei (testbar ohne DOM) |
| `public/js/pwa.js` | Service Worker, Installieren, Dock-Badge |
| `public/js/ui.js` | Oberfläche, Overlays, Tastatur |
| `public/sw.js`, `public/manifest.webmanifest` | PWA |
| `tests/` | Tests für Parser, Modell, Tageswechsel, Migration, Abgleich |

## Speicherung

1. **IndexedDB im Browser:** schnelle Arbeitskopie, `navigator.storage.persist()` wird angefragt. Es schreibt immer nur ein Fenster, dafür sorgt die Web Locks API.
2. **Speicherordner** (Chrome, Edge, Brave, Arc), z. B. in iCloud Drive:
   - `tagwerk.json` enthält immer den aktuellen Stand.
   - `backups/tagwerk-JJJJ-MM-TT.json` enthält den Stand zu Beginn jedes Tages. Die letzten 30 bleiben erhalten.
   - Beim Start und beim Zurückkehren ins Fenster wird abgeglichen. Hat sich nur eine Seite geändert, gewinnt sie. Haben sich beide geändert, fragt Tagwerk nach, und der andere Stand landet als `backups/konflikt-….json`.

## Deployment

Netlify ist mit diesem Repository verbunden, `netlify.toml` setzt `publish = "public"` ohne Build. Jeder Push auf `main` geht live unter https://mein-tagwerk.netlify.app. Der Service Worker lädt immer zuerst aus dem Netz und fällt nur offline auf den Cache zurück. Deshalb gibt es keine Versionsnummer, die man pflegen müsste.

## Fahrplan

- [x] **M1** – Module, IndexedDB, echter Tageswechsel, Tests
- [x] **M2** – Speicherordner mit `tagwerk.json` und täglichen Sicherungen
- [x] **M3** – PWA (Manifest, Service Worker, Dock-Badge, Dock-Menü), `netlify.toml`
- [x] **M4** – Import aus formatierter Zwischenablage (HTML aus Notizen), Projekte umbenennen und löschen, erledigte Aufgaben nach 14 Tagen aus den Projekten räumen (im Verlauf bleiben sie)

## Lizenz

[MIT](LICENSE)
