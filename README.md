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
| `public/js/ui.js` | Oberfläche, Overlays, Tastatur |
| `tests/` | Tests für Parser, Modell, Tageswechsel, Migration |

## Speicherung

- **Jetzt:** IndexedDB im Browser (`navigator.storage.persist()` wird angefragt). Es schreibt immer nur ein Fenster, dafür sorgt die Web Locks API.
- **Geplant:** Automatisches Schreiben in einen gewählten Ordner (File System Access API), mit täglichen Sicherungen.

## Fahrplan

- [x] **M1** – Module, IndexedDB, echter Tageswechsel, Tests
- [ ] **M2** – Speicherordner mit `tagwerk.json` und täglichen Sicherungen
- [ ] **M3** – PWA (Manifest, Service Worker, Dock-Badge, Dock-Menü) und Deployment auf Netlify
- [ ] **M4** – Import mit echter Zwischenablage aus Notizen, Feinschliff
