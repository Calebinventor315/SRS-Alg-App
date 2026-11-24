/* Local + Cloud Persistence Layer (v4 with Forward & Reverse tracks) */
import { SRS_DECKS } from './decks.js';
import { createDeckCards } from './srs.js';
import { fetchCloudState, saveCloudState } from './supabase.js';

const LEGACY_KEY_V3 = 'chinese_srs_state_v3';
const STORAGE_PREFIX_V4 = 'chinese_srs_state_v4_';

function storageKeyFor(userId) {
  return STORAGE_PREFIX_V4 + (userId || 'local');
}

export function buildFreshData() {
  const decks = {};
  Object.keys(SRS_DECKS).forEach((id) => {
    decks[id] = {
      forward: createDeckCards(SRS_DECKS[id].cards),
      reverse: createDeckCards(SRS_DECKS[id].cards)
    };
  });
  return {
    version: 4,
    updatedAt: Date.now(),
    activeDeckId: 'whole',
    direction: 'forward',
    studyMode: 'flashcard',
    multiplier: 2.0,
    decks
  };
}

export function normalizeState(raw) {
  const fresh = buildFreshData();
  if (!raw || typeof raw !== 'object') return fresh;

  const decks = {};
  Object.keys(SRS_DECKS).forEach((id) => {
    const existing = raw.decks && raw.decks[id];
    if (Array.isArray(existing) && existing.length) {
      // Migrate v3 flat array into forward track
      decks[id] = {
        forward: existing,
        reverse: createDeckCards(SRS_DECKS[id].cards)
      };
    } else if (existing && typeof existing === 'object') {
      decks[id] = {
        forward:
          Array.isArray(existing.forward) && existing.forward.length
            ? existing.forward
            : createDeckCards(SRS_DECKS[id].cards),
        reverse:
          Array.isArray(existing.reverse) && existing.reverse.length
            ? existing.reverse
            : createDeckCards(SRS_DECKS[id].cards)
      };
    } else {
      decks[id] = {
        forward: createDeckCards(SRS_DECKS[id].cards),
        reverse: createDeckCards(SRS_DECKS[id].cards)
      };
    }
  });

  const activeDeckId = SRS_DECKS[raw.activeDeckId] ? raw.activeDeckId : 'whole';
  const direction = raw.direction === 'reverse' ? 'reverse' : 'forward';
  const studyMode = raw.studyMode === 'spelling' ? 'spelling' : 'flashcard';
  const multiplier = Math.min(3.0, Math.max(1.1, Number(raw.multiplier) || 2.0));
  const updatedAt = Number(raw.updatedAt) || 0;

  return {
    version: 4,
    updatedAt,
    activeDeckId,
    direction,
    studyMode,
    multiplier,
    decks
  };
}

export function loadLocal(userId) {
  try {
    const raw = localStorage.getItem(storageKeyFor(userId));
    if (raw) {
      return normalizeState(JSON.parse(raw));
    }
    // Try migrating legacy v3 state if present
    const legacy = localStorage.getItem(LEGACY_KEY_V3);
    if (legacy) {
      const migrated = normalizeState(JSON.parse(legacy));
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
    // Ignore storage quota or sandbox restrictions
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

  if (!cloudRaw || !cloudRaw.decks) {
    // No cloud state yet — seed cloud with local state
    local.updatedAt = local.updatedAt || Date.now();
    saveLocal(userId, local);
    const saveRes = await saveCloudState(userId, local);
    return { data: local, synced: !saveRes.error, error: saveRes.error };
  }

  const cloud = normalizeState(cloudRaw);
  // Use whichever was updated more recently (prefer cloud on tie)
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
