/* Local + Cloud Persistence Layer (v5: Unified Multi-Deck, Sections, Custom Decks, Cloud Sync) */
import { BUILTIN_DECKS, getAllDecks, getSectionCards, normalizeDeck } from './decks.js';
import { createDeckCards } from './srs.js';
import { fetchCloudState, saveCloudState } from './supabase.js';

const LEGACY_KEY_V3 = 'chinese_srs_state_v3';
const LEGACY_PREFIX_V4 = 'chinese_srs_state_v4_';
const STORAGE_PREFIX_V5 = 'srs_learning_state_v5_';

function storageKeyFor(userId) {
  return STORAGE_PREFIX_V5 + (userId || 'local');
}

export function trackKey(deckId, sectionId, direction) {
  return `${deckId}::${sectionId || 'all'}::${direction === 'reverse' ? 'reverse' : 'forward'}`;
}

function upgradeCard(card) {
  const front = card.front ?? card.pinyin ?? '';
  const back = card.back ?? card.hanzi ?? '';
  const meaning = card.meaning ?? card.english ?? '';
  return {
    uuid: card.uuid || `migrated-${Math.random().toString(36).slice(2, 10)}`,
    id: card.id || null,
    front,
    back,
    meaning,
    speechText: card.speechText ?? back ?? front,
    audio: card.audio || null,
    section: card.section || 'all',
    correct: Number(card.correct) || 0
  };
}

export function buildFreshData() {
  const defaultDeck = BUILTIN_DECKS['chinese-unit-4'];
  const allCards = getSectionCards(defaultDeck, 'all');
  const progress = {};
  progress[trackKey('chinese-unit-4', 'all', 'forward')] = createDeckCards(allCards);
  progress[trackKey('chinese-unit-4', 'all', 'reverse')] = createDeckCards(allCards);

  return {
    version: 5,
    updatedAt: Date.now(),
    activeDeckId: 'chinese-unit-4',
    activeSections: { 'chinese-unit-4': 'all' },
    direction: 'forward',
    studyMode: 'flashcard', // 'flashcard' | 'spelling' | 'speaking'
    multiplier: 2.0,
    customDecks: {},
    progress
  };
}

const V4_DECK_TO_SECTION = {
  whole: 'all',
  set1: 'set1',
  set2: 'set2',
  set3: 'set3',
  set4: 'set4',
  measure: 'measure',
  phrases: 'phrases'
};

export function normalizeState(raw) {
  const fresh = buildFreshData();
  if (!raw || typeof raw !== 'object') return fresh;

  const customDecks = {};
  if (raw.customDecks && typeof raw.customDecks === 'object') {
    Object.keys(raw.customDecks).forEach((id) => {
      try {
        customDecks[id] = normalizeDeck({ ...raw.customDecks[id], id, builtIn: false });
      } catch {
        // Ignore malformed custom deck
      }
    });
  }

  const progress = {};

  // v5 progress map
  if (raw.progress && typeof raw.progress === 'object') {
    Object.keys(raw.progress).forEach((key) => {
      const list = raw.progress[key];
      if (Array.isArray(list) && list.length) {
        progress[key] = list.map(upgradeCard);
      }
    });
  }

  // Migrate v3 / v4 `decks` into v5 `progress` under 'chinese-unit-4'
  if (raw.decks && typeof raw.decks === 'object') {
    Object.keys(raw.decks).forEach((oldDeckId) => {
      const sectionId = V4_DECK_TO_SECTION[oldDeckId];
      if (!sectionId) return;
      const entry = raw.decks[oldDeckId];
      if (Array.isArray(entry) && entry.length) {
        const fk = trackKey('chinese-unit-4', sectionId, 'forward');
        if (!progress[fk]) progress[fk] = entry.map(upgradeCard);
      } else if (entry && typeof entry === 'object') {
        if (Array.isArray(entry.forward) && entry.forward.length) {
          const fk = trackKey('chinese-unit-4', sectionId, 'forward');
          if (!progress[fk]) progress[fk] = entry.forward.map(upgradeCard);
        }
        if (Array.isArray(entry.reverse) && entry.reverse.length) {
          const rk = trackKey('chinese-unit-4', sectionId, 'reverse');
          if (!progress[rk]) progress[rk] = entry.reverse.map(upgradeCard);
        }
      }
    });
  }

  const allDecks = getAllDecks({ customDecks });
  let activeDeckId = raw.activeDeckId;
  const activeSections = { ...(raw.activeSections || {}) };

  if (V4_DECK_TO_SECTION[activeDeckId]) {
    activeSections['chinese-unit-4'] = V4_DECK_TO_SECTION[activeDeckId];
    activeDeckId = 'chinese-unit-4';
  }
  if (!allDecks[activeDeckId]) {
    activeDeckId = 'chinese-unit-4';
  }

  const direction = raw.direction === 'reverse' ? 'reverse' : 'forward';
  const studyMode = ['flashcard', 'spelling', 'speaking'].includes(raw.studyMode)
    ? raw.studyMode
    : 'flashcard';
  const multiplier = Math.min(3.0, Math.max(1.1, Number(raw.multiplier) || 2.0));
  const updatedAt = Number(raw.updatedAt) || 0;

  return {
    version: 5,
    updatedAt,
    activeDeckId,
    activeSections,
    direction,
    studyMode,
    multiplier,
    customDecks,
    progress
  };
}

/**
 * Ensures the SRS queue exists for (deck, sectionId, direction) and returns it.
 */
export function ensureTrack(userData, deck, sectionId, direction) {
  const sec = sectionId || 'all';
  const dir = direction === 'reverse' ? 'reverse' : 'forward';
  const key = trackKey(deck.id, sec, dir);
  if (!userData.progress) userData.progress = {};
  if (!Array.isArray(userData.progress[key]) || !userData.progress[key].length) {
    const cards = getSectionCards(deck, sec);
    userData.progress[key] = createDeckCards(cards);
  }
  return userData.progress[key];
}

export function loadLocal(userId) {
  try {
    const raw = localStorage.getItem(storageKeyFor(userId));
    if (raw) return normalizeState(JSON.parse(raw));

    // Migrate v4 local data for this user or local
    const v4Key = LEGACY_PREFIX_V4 + (userId || 'local');
    const v4Raw = localStorage.getItem(v4Key);
    if (v4Raw) {
      const migrated = normalizeState(JSON.parse(v4Raw));
      migrated.updatedAt = Date.now();
      return migrated;
    }

    // Migrate legacy v3 data
    const v3Raw = localStorage.getItem(LEGACY_KEY_V3);
    if (v3Raw) {
      const migrated = normalizeState(JSON.parse(v3Raw));
      migrated.updatedAt = Date.now();
      return migrated;
    }

    return buildFreshData();
  } catch {
    return buildFreshData();
  }
}

export function saveLocal(userId, data) {
  try {
    localStorage.setItem(storageKeyFor(userId), JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export async function loadAndSyncInitialState(userId) {
  const local = loadLocal(userId);
  if (!userId) {
    return { data: local, synced: false, error: null };
  }

  const { data: cloudRaw, error } = await fetchCloudState(userId);
  if (error) {
    return { data: local, synced: false, error };
  }

  if (!cloudRaw || (!cloudRaw.progress && !cloudRaw.decks)) {
    local.updatedAt = local.updatedAt || Date.now();
    saveLocal(userId, local);
    const saveRes = await saveCloudState(userId, local);
    return { data: local, synced: !saveRes.error, error: saveRes.error };
  }

  const cloud = normalizeState(cloudRaw);
  if ((local.updatedAt || 0) > (cloud.updatedAt || 0)) {
    saveLocal(userId, local);
    const saveRes = await saveCloudState(userId, local);
    return { data: local, synced: !saveRes.error, error: saveRes.error };
  }

  saveLocal(userId, cloud);
  return { data: cloud, synced: true, error: null };
}

export function createCloudSyncer(onStatusChange) {
  let timer = null;
  let pendingUserId = null;
  let pendingData = null;

  async function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pendingUserId || !pendingData) return;
    const uid = pendingUserId;
    const payload = pendingData;
    pendingUserId = null;
    pendingData = null;

    if (onStatusChange) onStatusChange('syncing');
    const { error } = await saveCloudState(uid, payload);
    if (onStatusChange) {
      onStatusChange(error ? 'error' : 'synced', error);
    }
  }

  function schedule(userId, data) {
    if (!userId) {
      if (onStatusChange) onStatusChange('offline');
      return;
    }
    pendingUserId = userId;
    pendingData = data;
    if (onStatusChange) onStatusChange('syncing');
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 600);
  }

  return { schedule, flush };
}
