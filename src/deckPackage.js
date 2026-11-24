/* Standardized .zip and .json Deck Import / Export */
import JSZip from 'jszip';
import { normalizeDeck } from './decks.js';
import { getAudioBlob, saveAudioBlob } from './audioStore.js';

function guessMimeType(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.webm')) return 'audio/webm';
  return 'application/octet-stream';
}

/**
 * Import a deck from a .zip (containing deck.json + optional audio files) or a .json file.
 * Returns { deck, audioCount }.
 */
export async function importDeckFile(file) {
  if (!file) throw new Error('No file selected.');
  const lowerName = file.name.toLowerCase();

  // Plain JSON deck import
  if (lowerName.endsWith('.json')) {
    const text = await file.text();
    const raw = JSON.parse(text);
    const deck = normalizeDeck({ ...raw, builtIn: false });
    return { deck, audioCount: 0 };
  }

  // ZIP package import
  if (!lowerName.endsWith('.zip')) {
    throw new Error('Please upload a .zip or .json deck file.');
  }

  const zip = await JSZip.loadAsync(file);

  // Locate deck.json (either at root or inside a single top-level folder)
  let jsonEntry = null;
  let basePrefix = '';

  const entries = Object.values(zip.files).filter((f) => !f.dir && !f.name.startsWith('__MACOSX/'));
  jsonEntry =
    entries.find((f) => f.name.toLowerCase() === 'deck.json') ||
    entries.find((f) => f.name.toLowerCase().endsWith('/deck.json')) ||
    entries.find((f) => f.name.toLowerCase().endsWith('.json'));

  if (!jsonEntry) {
    throw new Error('Could not find deck.json inside the .zip file.');
  }

  const slashIdx = jsonEntry.name.lastIndexOf('/');
  if (slashIdx !== -1) {
    basePrefix = jsonEntry.name.slice(0, slashIdx + 1);
  }

  const jsonText = await jsonEntry.async('text');
  const raw = JSON.parse(jsonText);
  const deck = normalizeDeck({ ...raw, builtIn: false });

  // Extract any referenced audio files (or audio/* files) into IndexedDB
  let audioCount = 0;
  const audioExtensions = /\.(mp3|wav|ogg|m4a|webm)$/i;

  for (const entry of entries) {
    if (!audioExtensions.test(entry.name)) continue;
    let relPath = entry.name;
    if (basePrefix && relPath.startsWith(basePrefix)) {
      relPath = relPath.slice(basePrefix.length);
    }
    const arrayBuffer = await entry.async('arraybuffer');
    const blob = new Blob([arrayBuffer], { type: guessMimeType(relPath) });
    await saveAudioBlob(deck.id, relPath, blob);
    audioCount += 1;
  }

  return { deck, audioCount };
}

/**
 * Export any deck (including any stored audio files) as a standard .zip package.
 */
export async function exportDeckZip(deck) {
  const zip = new JSZip();

  const manifest = {
    formatVersion: 1,
    id: deck.id,
    title: deck.title,
    subtitle: deck.subtitle || '',
    language: deck.language || 'en-US',
    frontLabel: deck.frontLabel || 'Front',
    backLabel: deck.backLabel || 'Back',
    accentSet: deck.accentSet || 'european',
    enabledModes: deck.enabledModes || {
      flashcard: true,
      spelling: true,
      speaking: true,
      reverse: true
    },
    sections: (deck.sections || []).filter((s) => s.id !== 'all'),
    cards: (deck.cards || []).map((c) => ({
      id: c.id,
      front: c.front,
      back: c.back,
      meaning: c.meaning || '',
      speechText: c.speechText || c.back || c.front,
      sections: c.sections || (c.section && c.section !== 'all' ? [c.section] : []),
      audio: c.audio || null
    }))
  };

  zip.file('deck.json', JSON.stringify(manifest, null, 2));

  // Include any audio blobs stored in IndexedDB for this deck
  const addedPaths = new Set();
  for (const card of deck.cards || []) {
    if (!card.audio || addedPaths.has(card.audio)) continue;
    const blob = await getAudioBlob(deck.id, card.audio);
    if (blob) {
      zip.file(card.audio.replace(/^\/+/, ''), blob);
      addedPaths.add(card.audio);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${deck.id || 'deck'}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
