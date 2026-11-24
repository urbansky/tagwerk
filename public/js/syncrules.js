/* Regeln für den Abgleich Browser ⇄ Datei (ohne DOM, damit testbar) */

const isEmpty = rec => !rec || !rec.data || !Array.isArray(rec.data.projects) || !rec.data.projects.length;

/**
 * Welcher Stand gilt?
 * @param local  Stand im Browser { savedAt, data } oder null
 * @param file   Inhalt von tagwerk.json { savedAt, data } oder null
 * @param lastSynced  savedAt des zuletzt abgeglichenen Stands (oder null)
 * @returns 'write' (Browser → Datei) | 'read' (Datei → Browser) | 'same' | 'conflict'
 */
export function decide(local, file, lastSynced){
  if (!file) return 'write';
  if (!local) return 'read';
  if (file.savedAt && file.savedAt === local.savedAt) return 'same';
  if (lastSynced == null && isEmpty(local)) return 'read';   // frischer Browser, vorhandener Ordner
  const fileChanged = !file.savedAt || file.savedAt !== lastSynced;
  const localChanged = local.savedAt !== lastSynced;
  if (fileChanged && !localChanged) return 'read';
  if (!fileChanged && localChanged) return 'write';
  return 'conflict';
}

export const BACKUP_RE = /^tagwerk-\d{4}-\d{2}-\d{2}\.json$/;
export const backupName = day => `tagwerk-${day}.json`;

/** Welche Tagessicherungen sollen weg? (behält die neuesten `keep`) */
export function backupsToDelete(names, keep){
  return names.filter(n => BACKUP_RE.test(n)).sort().reverse().slice(keep);
}

/** Kurze Zusammenfassung eines Stands für den Konflikt-Dialog */
export function summarize(rec){
  let open = 0, projects = 0;
  const count = list => list.forEach(n => {
    if (n.type === 'section') return count(n.children || []);
    if (!n.done) open += 1 + (n.children || []).filter(c => !c.done).length;
  });
  for (const p of (rec && rec.data && rec.data.projects) || []) { projects++; count(p.items || []); }
  return { projects, open, savedAt: rec && rec.savedAt || null };
}
