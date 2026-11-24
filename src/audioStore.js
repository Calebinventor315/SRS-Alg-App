/* IndexedDB Audio Blob Store for Bundled Deck Audio (.zip imports) */

const DB_NAME = 'srs_learning_audio_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_files';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function audioKey(deckId, relativePath) {
  const clean = String(relativePath || '').replace(/^\/+/, '');
  return `${deckId}::${clean}`;
}

export async function saveAudioBlob(deckId, relativePath, blob) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, audioKey(deckId, relativePath));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore IndexedDB errors in restricted contexts
  }
}

export async function getAudioBlob(deckId, relativePath) {
  if (!deckId || !relativePath) return null;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(audioKey(deckId, relativePath));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteDeckAudio(deckId) {
  try {
    const db = await openDb();
    const prefix = `${deckId}::`;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) return;
        if (String(cursor.key).startsWith(prefix)) {
          cursor.delete();
        }
        cursor.continue();
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}
