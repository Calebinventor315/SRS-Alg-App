/* SRS Learning — Auth, Home, Multi-Deck & Sections, Flashcard/Spelling/Speaking, Accents, Zip Import/Export, Cloud Sync */
import {
  getAllDecks,
  getSectionCards,
  inferAccentSet,
  normalizeDeck,
  slugify
} from './decks.js';
import { WORKING_SET_SIZE, createDeckCards, step } from './srs.js';
import { checkSpellingAnswer } from './pinyin.js';
import { ACCENT_PALETTES, insertCharAtCursor } from './accents.js';
import { exportDeckZip, importDeckFile } from './deckPackage.js';
import { deleteDeckAudio } from './audioStore.js';
import { extractUploadFile } from './fileExtractor.js';
import {
  checkServerAiStatus,
  generateAiDeck,
  getSavedOpenRouterKey,
  saveOpenRouterKey
} from './aiDeck.js';
import {
  isMediaRecorderSupported,
  isSpeechRecognitionSupported,
  playAudioUrl,
  playReferenceAudio,
  startSpeakingSession,
  stopPlayback,
  verifySpokenAnswer
} from './speech.js';
import { isSupabaseConfigured, supabase } from './supabase.js';
import {
  buildFreshData,
  createCloudSyncer,
  ensureTrack,
  loadAndSyncInitialState,
  loadLocal,
  saveLocal,
  trackKey
} from './storage.js';

// App state
let currentUser = null;
let offlineMode = false;
let currentView = 'auth'; // 'auth' | 'home' | 'study'
let authMode = 'signin'; // 'signin' | 'signup'
let userData = buildFreshData();

// Study transient state
let flipped = false;
let lastMovedUuid = null;
let spellingResult = null; // null | { isCorrect, typed, expected, note }
let spellingHintVisible = false;
let selectedAccentPalette = 'pinyin';

// Speaking transient state
let speakingSession = null; // active recorder controller or null
let isRecording = false;
let recordedAudioUrl = null;
let speakingResult = null; // null | { status, score, heard, target, isCorrect, recognitionAvailable }

// Deck builder state
let editingDeckId = null;

// AI Deck Maker state
let aiAttachments = []; // Array<{ id, name, kind, text, images }>
let aiGeneratedDeck = null;

// Undo stacks keyed by `${deckId}::${sectionId}::${direction}`
const undoStacks = {};

// DOM — Views
const authView = document.getElementById('auth-view');
const homeView = document.getElementById('home-view');
const studyView = document.getElementById('study-view');

// DOM — Auth
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const supabaseWarning = document.getElementById('supabase-warning');
const authForm = document.getElementById('auth-form');
const authUsernameWrap = document.getElementById('auth-username-wrap');
const authUsername = document.getElementById('auth-username');
const authIdentifierLabel = document.getElementById('auth-identifier-label');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authConfirmWrap = document.getElementById('auth-confirm-wrap');
const authConfirm = document.getElementById('auth-confirm');
const authError = document.getElementById('auth-error');
const authInfo = document.getElementById('auth-info');
const authSubmit = document.getElementById('auth-submit');
const authToggleMode = document.getElementById('auth-toggle-mode');
const btnOfflineMode = document.getElementById('btn-offline-mode');

// DOM — Home
const homeSyncBadge = document.getElementById('home-sync-badge');
const homeUserEmail = document.getElementById('home-user-email');
const btnHomeAuth = document.getElementById('btn-home-auth');
const btnOpenAi = document.getElementById('btn-open-ai');
const btnOpenBuilder = document.getElementById('btn-open-builder');
const btnImportDeck = document.getElementById('btn-import-deck');
const importFileInput = document.getElementById('import-file-input');
const homeToast = document.getElementById('home-toast');
const deckGrid = document.getElementById('deck-grid');

// DOM — AI Deck Maker Modal
const aiModal = document.getElementById('ai-modal');
const btnCloseAi = document.getElementById('btn-close-ai');
const btnCancelAi = document.getElementById('btn-cancel-ai');
const aiForm = document.getElementById('ai-form');
const aiDropzone = document.getElementById('ai-dropzone');
const aiFileInput = document.getElementById('ai-file-input');
const aiFileList = document.getElementById('ai-file-list');
const aiPrompt = document.getElementById('ai-prompt');
const aiLanguage = document.getElementById('ai-language');
const aiModelFamily = document.getElementById('ai-model-family');
const aiOptFlashcard = document.getElementById('ai-opt-flashcard');
const aiOptSpelling = document.getElementById('ai-opt-spelling');
const aiOptSpeaking = document.getElementById('ai-opt-speaking');
const aiOptReverse = document.getElementById('ai-opt-reverse');
const aiServerStatus = document.getElementById('ai-server-status');
const aiKeyDetails = document.getElementById('ai-key-details');
const aiOpenRouterKey = document.getElementById('ai-openrouter-key');
const aiError = document.getElementById('ai-error');
const aiProgress = document.getElementById('ai-progress');
const aiPreview = document.getElementById('ai-preview');
const aiPreviewTitle = document.getElementById('ai-preview-title');
const aiPreviewMeta = document.getElementById('ai-preview-meta');
const aiPreviewModel = document.getElementById('ai-preview-model');
const aiPreviewCards = document.getElementById('ai-preview-cards');
const btnAiExport = document.getElementById('btn-ai-export');
const btnAiEdit = document.getElementById('btn-ai-edit');
const btnAiSaveStudy = document.getElementById('btn-ai-save-study');
const btnAiGenerate = document.getElementById('btn-ai-generate');

// DOM — Study Topbar
const btnBackHome = document.getElementById('btn-back-home');
const deckSelect = document.getElementById('deck-select');
const sectionSelect = document.getElementById('section-select');
const btnResetDeck = document.getElementById('btn-reset-deck');
const studyDirectionGroup = document.getElementById('study-direction-group');
const btnDirForward = document.getElementById('btn-dir-forward');
const btnDirReverse = document.getElementById('btn-dir-reverse');
const btnModeFlashcard = document.getElementById('btn-mode-flashcard');
const btnModeSpelling = document.getElementById('btn-mode-spelling');
const btnModeSpeaking = document.getElementById('btn-mode-speaking');
const studySyncBadge = document.getElementById('study-sync-badge');
const btnStudyAuth = document.getElementById('btn-study-auth');

// DOM — Flashcard
const flashcardEl = document.getElementById('flashcard');
const cardInnerEl = document.getElementById('card-inner');
const frontDirectionPill = document.getElementById('front-direction-pill');
const frontMainEl = document.getElementById('front-main');
const frontSubEl = document.getElementById('front-sub');
const backMainEl = document.getElementById('back-main');
const backSubEl = document.getElementById('back-sub');
const backExtraEl = document.getElementById('back-extra');
const btnFlashcardAudioFront = document.getElementById('btn-flashcard-audio-front');
const btnFlashcardAudioBack = document.getElementById('btn-flashcard-audio-back');

// DOM — Spelling
const spellingPanel = document.getElementById('spelling-panel');
const spellingDirectionPill = document.getElementById('spelling-direction-pill');
const btnSpellingAudio = document.getElementById('btn-spelling-audio');
const btnSpellingHint = document.getElementById('btn-spelling-hint');
const spellingPromptMain = document.getElementById('spelling-prompt-main');
const spellingPromptSub = document.getElementById('spelling-prompt-sub');
const spellingForm = document.getElementById('spelling-form');
const spellingInput = document.getElementById('spelling-input');
const btnSpellingCheck = document.getElementById('btn-spelling-check');
const accentBarWrap = document.getElementById('accent-bar-wrap');
const accentPaletteSelect = document.getElementById('accent-palette-select');
const accentKeys = document.getElementById('accent-keys');
const spellingFeedback = document.getElementById('spelling-feedback');
const spellingVerdict = document.getElementById('spelling-verdict');
const spellingComparison = document.getElementById('spelling-comparison');
const spellingFullCard = document.getElementById('spelling-full-card');
const spellingShortcutHint = document.getElementById('spelling-shortcut-hint');

// DOM — Speaking
const speakingPanel = document.getElementById('speaking-panel');
const speakingPromptBack = document.getElementById('speaking-prompt-back');
const speakingPromptFront = document.getElementById('speaking-prompt-front');
const speakingPromptMeaning = document.getElementById('speaking-prompt-meaning');
const btnRecordVoice = document.getElementById('btn-record-voice');
const btnRecordLabel = document.getElementById('btn-record-label');
const btnPlayReference = document.getElementById('btn-play-reference');
const btnPlayReferenceSlow = document.getElementById('btn-play-reference-slow');
const btnPlayRecording = document.getElementById('btn-play-recording');
const speakingLiveBox = document.getElementById('speaking-live-box');
const speakingLiveText = document.getElementById('speaking-live-text');
const speakingError = document.getElementById('speaking-error');
const speakingFeedback = document.getElementById('speaking-feedback');
const speakingVerdict = document.getElementById('speaking-verdict');
const speakingComparison = document.getElementById('speaking-comparison');
const speakingShortcutHint = document.getElementById('speaking-shortcut-hint');

// DOM — Controls & Queue
const btnRight = document.getElementById('btn-right');
const btnWrong = document.getElementById('btn-wrong');
const btnRightLabel = document.getElementById('btn-right-label');
const btnWrongLabel = document.getElementById('btn-wrong-label');
const btnUndo = document.getElementById('btn-undo');
const multiplierSlider = document.getElementById('multiplier-slider');
const multiplierValue = document.getElementById('multiplier-value');
const queueGrid = document.getElementById('queue-grid');

// DOM — Deck Builder Modal
const builderModal = document.getElementById('builder-modal');
const builderModalTitle = document.getElementById('builder-modal-title');
const btnCloseBuilder = document.getElementById('btn-close-builder');
const btnCancelBuilder = document.getElementById('btn-cancel-builder');
const builderForm = document.getElementById('builder-form');
const builderTitle = document.getElementById('builder-title');
const builderSubtitle = document.getElementById('builder-subtitle');
const builderLanguage = document.getElementById('builder-language');
const builderFrontLabel = document.getElementById('builder-front-label');
const builderBackLabel = document.getElementById('builder-back-label');
const builderAccentSet = document.getElementById('builder-accent-set');
const optFlashcard = document.getElementById('opt-flashcard');
const optSpelling = document.getElementById('opt-spelling');
const optSpeaking = document.getElementById('opt-speaking');
const optReverse = document.getElementById('opt-reverse');
const btnToggleBulk = document.getElementById('btn-toggle-bulk');
const bulkPasteBox = document.getElementById('bulk-paste-box');
const bulkPasteText = document.getElementById('bulk-paste-text');
const btnApplyBulk = document.getElementById('btn-apply-bulk');
const btnAddCardRow = document.getElementById('btn-add-card-row');
const builderCardRows = document.getElementById('builder-card-rows');
const builderError = document.getElementById('builder-error');

// Sync status
const cloudSyncer = createCloudSyncer((status) => {
  setSyncStatus(status);
});

function setSyncStatus(status) {
  const labelMap = {
    synced: 'Synced',
    syncing: 'Syncing…',
    error: 'Sync error',
    offline: 'Offline'
  };
  const text = labelMap[status] || 'Offline';
  [homeSyncBadge, studySyncBadge].forEach((badge) => {
    badge.textContent = text;
    badge.className = 'sync-badge sync-' + status;
  });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer = null;
function showHomeToast(message, isError = false) {
  homeToast.textContent = message;
  homeToast.classList.remove('hidden', 'is-error');
  if (isError) homeToast.classList.add('is-error');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    homeToast.classList.add('hidden');
  }, 5000);
}

/* ==================== HELPERS ==================== */

function getDecksMap() {
  return getAllDecks(userData);
}

function getActiveDeck() {
  const all = getDecksMap();
  if (!all[userData.activeDeckId]) {
    userData.activeDeckId = Object.keys(all)[0];
  }
  return all[userData.activeDeckId];
}

function getActiveSectionId(deck) {
  const sec = (userData.activeSections && userData.activeSections[deck.id]) || 'all';
  const valid = (deck.sections || []).some((s) => s.id === sec);
  return valid ? sec : 'all';
}

function setActiveSectionId(deckId, sectionId) {
  if (!userData.activeSections) userData.activeSections = {};
  userData.activeSections[deckId] = sectionId || 'all';
}

function enforceDeckConstraints(deck) {
  const modes = deck.enabledModes || {
    flashcard: true,
    spelling: true,
    speaking: true,
    reverse: true
  };
  if (!modes.reverse && userData.direction === 'reverse') {
    userData.direction = 'forward';
  }
  if (!modes[userData.studyMode]) {
    if (modes.flashcard) userData.studyMode = 'flashcard';
    else if (modes.spelling) userData.studyMode = 'spelling';
    else if (modes.speaking) userData.studyMode = 'speaking';
    else userData.studyMode = 'flashcard';
  }
}

function getActiveTrack() {
  const deck = getActiveDeck();
  const sec = getActiveSectionId(deck);
  return ensureTrack(userData, deck, sec, userData.direction);
}

function setActiveTrack(cards) {
  const deck = getActiveDeck();
  const sec = getActiveSectionId(deck);
  const key = trackKey(deck.id, sec, userData.direction);
  userData.progress[key] = cards;
}

function getUndoStack() {
  const deck = getActiveDeck();
  const sec = getActiveSectionId(deck);
  const key = trackKey(deck.id, sec, userData.direction);
  if (!undoStacks[key]) undoStacks[key] = [];
  return undoStacks[key];
}

function persist() {
  userData.updatedAt = Date.now();
  const uid = currentUser ? currentUser.id : null;
  saveLocal(uid, userData);
  if (uid) {
    cloudSyncer.schedule(uid, userData);
  } else {
    setSyncStatus('offline');
  }
}

function stopActiveRecordingAndAudio() {
  stopPlayback();
  if (speakingSession) {
    try {
      speakingSession.stop();
    } catch {
      // Ignore
    }
    speakingSession = null;
  }
  isRecording = false;
}

function resetCardTransientState() {
  stopActiveRecordingAndAudio();
  flipped = false;
  lastMovedUuid = null;
  spellingResult = null;
  spellingHintVisible = false;
  spellingInput.value = '';
  spellingInput.disabled = false;
  speakingResult = null;
  speakingError.textContent = '';
  speakingLiveBox.classList.add('hidden');
  if (recordedAudioUrl) {
    URL.revokeObjectURL(recordedAudioUrl);
    recordedAudioUrl = null;
  }
}

function showView(view) {
  stopActiveRecordingAndAudio();
  currentView = view;
  authView.classList.toggle('hidden', view !== 'auth');
  homeView.classList.toggle('hidden', view !== 'home');
  studyView.classList.toggle('hidden', view !== 'study');

  if (view === 'home') {
    renderHome();
  } else if (view === 'study') {
    const deck = getActiveDeck();
    enforceDeckConstraints(deck);
    selectedAccentPalette =
      deck.accentSet && ACCENT_PALETTES[deck.accentSet]
        ? deck.accentSet
        : inferAccentSet(deck.language);
    populateStudyDropdowns();
    renderAccentBar();
    renderStudy();
    focusSpellingIfNeeded();
  }
}

function updateUserChrome() {
  const isLoggedIn = Boolean(currentUser);
  const displayName = isLoggedIn
    ? currentUser.user_metadata?.username || currentUser.email
    : 'Local mode';
  homeUserEmail.textContent = displayName;
  btnHomeAuth.textContent = isLoggedIn ? 'Sign Out' : 'Sign In';
  btnStudyAuth.textContent = isLoggedIn ? 'Sign Out' : 'Sign In';
}

function updateSegmentedControls() {
  document.querySelectorAll('[data-direction]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.direction === userData.direction);
  });
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mode === userData.studyMode);
  });
}

/* ==================== AUTH ==================== */

function renderAuthForm() {
  const isSignUp = authMode === 'signup';
  authTitle.textContent = isSignUp ? 'Create your account' : 'Sign in to SRS Learning';
  authSubtitle.textContent = isSignUp
    ? 'Sign up with your email, username, and password.'
    : 'Sign in with your email or username, or use a provider below.';
  authSubmit.textContent = isSignUp ? 'Create Account' : 'Sign In';
  authToggleMode.textContent = isSignUp
    ? 'Already have an account? Sign in'
    : 'Need an account? Create one';

  authUsernameWrap.classList.toggle('hidden', !isSignUp);
  authUsername.required = isSignUp;
  authIdentifierLabel.textContent = isSignUp ? 'Email' : 'Email or Username';
  authEmail.type = isSignUp ? 'email' : 'text';
  authEmail.placeholder = isSignUp ? 'you@example.com' : 'you@example.com or username';
  authEmail.autocomplete = isSignUp ? 'email' : 'username';

  authConfirmWrap.classList.toggle('hidden', !isSignUp);
  authConfirm.required = isSignUp;
  authPassword.autocomplete = isSignUp ? 'new-password' : 'current-password';
  authError.textContent = '';
  authInfo.classList.add('hidden');
  authInfo.textContent = '';

  supabaseWarning.classList.toggle('hidden', isSupabaseConfigured);
  authUsername.disabled = !isSupabaseConfigured;
  authEmail.disabled = !isSupabaseConfigured;
  authPassword.disabled = !isSupabaseConfigured;
  authConfirm.disabled = !isSupabaseConfigured;
  authSubmit.disabled = !isSupabaseConfigured;
  document.querySelectorAll('[data-oauth]').forEach((btn) => {
    btn.disabled = !isSupabaseConfigured;
  });
}

authToggleMode.addEventListener('click', () => {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  renderAuthForm();
});

btnOfflineMode.addEventListener('click', () => {
  offlineMode = true;
  currentUser = null;
  userData = loadLocal(null);
  setSyncStatus('offline');
  updateUserChrome();
  showView('home');
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!isSupabaseConfigured || !supabase) return;

  const email = authEmail.value.trim();
  const password = authPassword.value;
  authError.textContent = '';
  authInfo.classList.add('hidden');

  if (authMode === 'signup') {
    if (password.length < 6) {
      authError.textContent = 'Password must be at least 6 characters.';
      return;
    }
    if (password !== authConfirm.value) {
      authError.textContent = 'Passwords do not match.';
      return;
    }
  }

  authSubmit.disabled = true;
  authSubmit.textContent = authMode === 'signup' ? 'Creating account…' : 'Signing in…';

  try {
    if (authMode === 'signup') {
      const username = authUsername.value.trim();
      if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) {
        authError.textContent = 'Username must be 3–24 characters (letters, numbers, _, ., -).';
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } }
      });
      if (error) {
        authError.textContent = error.message;
      } else if (data.session && data.user) {
        await handleAuthenticatedUser(data.user);
      } else {
        authMode = 'signin';
        renderAuthForm();
        authInfo.textContent = 'Account created! Check your email to confirm, then sign in.';
        authInfo.classList.remove('hidden');
      }
    } else {
      let loginEmail = email;
      if (!email.includes('@')) {
        const { data: resolvedEmail, error: rpcError } = await supabase.rpc('resolve_login_email', {
          p_identifier: email
        });
        if (rpcError || !resolvedEmail) {
          authError.textContent = 'No account found with that username.';
          return;
        }
        loginEmail = resolvedEmail;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password
      });
      if (error) {
        authError.textContent = error.message;
      } else if (data.user) {
        await handleAuthenticatedUser(data.user);
      }
    }
  } catch (err) {
    authError.textContent = err?.message || 'Authentication failed. Please try again.';
  } finally {
    authSubmit.disabled = !isSupabaseConfigured;
    authSubmit.textContent = authMode === 'signup' ? 'Create Account' : 'Sign In';
  }
});

document.querySelectorAll('[data-oauth]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (!isSupabaseConfigured || !supabase) return;
    authError.textContent = '';
    const provider = btn.dataset.oauth;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    });
    if (error) authError.textContent = error.message;
  });
});

async function handleAuthenticatedUser(user) {
  currentUser = user;
  offlineMode = false;
  updateUserChrome();
  setSyncStatus('syncing');

  const { data, synced } = await loadAndSyncInitialState(user.id);
  userData = data;
  setSyncStatus(synced ? 'synced' : 'error');
  showView('home');
}

async function handleSignOutOrAuthClick() {
  stopActiveRecordingAndAudio();
  if (currentUser && supabase) {
    await cloudSyncer.flush();
    await supabase.auth.signOut();
    currentUser = null;
  }
  offlineMode = false;
  setSyncStatus('offline');
  authPassword.value = '';
  authConfirm.value = '';
  renderAuthForm();
  showView('auth');
}

btnHomeAuth.addEventListener('click', handleSignOutOrAuthClick);
btnStudyAuth.addEventListener('click', handleSignOutOrAuthClick);

/* ==================== HOME VIEW ==================== */

function computeTrackStats(cards) {
  const total = cards.length;
  let learned = 0;
  let strong = 0;
  cards.forEach((c) => {
    if (c.correct >= 3) learned += 1;
    if (c.correct >= 6) strong += 1;
  });
  return {
    total,
    learned,
    strong,
    learnedPct: total ? Math.round((learned / total) * 100) : 0,
    strongPct: total ? Math.round((strong / total) * 100) : 0
  };
}

function renderHome() {
  updateSegmentedControls();
  updateUserChrome();

  const decksMap = getDecksMap();
  const deckIds = Object.keys(decksMap);

  deckGrid.innerHTML = deckIds
    .map((id) => {
      const deck = decksMap[id];
      const activeSec = getActiveSectionId(deck);
      const effectiveDir = deck.enabledModes.reverse ? userData.direction : 'forward';
      const track = ensureTrack(userData, deck, activeSec, effectiveDir);
      const stats = computeTrackStats(track);
      const nextCard = track[0];
      const previewText = nextCard
        ? effectiveDir === 'reverse'
          ? nextCard.back
          : nextCard.front
        : '';

      const modeBadges = [];
      if (deck.enabledModes.flashcard) modeBadges.push('Flashcards');
      if (deck.enabledModes.spelling) modeBadges.push('Spelling');
      if (deck.enabledModes.speaking) modeBadges.push('Speaking');
      if (deck.enabledModes.reverse) modeBadges.push('Reverse');

      const hasSections = deck.sections && deck.sections.length > 1;
      const sectionDropdownHtml = hasSections
        ? `
          <div class="deck-section-picker">
            <label class="deck-section-label" for="home-sec-${escapeHtml(id)}">Practice part:</label>
            <select id="home-sec-${escapeHtml(id)}" class="deck-select deck-select-sm" data-deck-section="${escapeHtml(id)}">
              ${deck.sections
                .map((s) => {
                  const count = getSectionCards(deck, s.id).length;
                  return `<option value="${escapeHtml(s.id)}" ${s.id === activeSec ? 'selected' : ''}>${escapeHtml(s.label)} (${count})</option>`;
                })
                .join('')}
            </select>
          </div>
        `
        : '';

      const studyModeLabel =
        deck.enabledModes[userData.studyMode]
          ? userData.studyMode.charAt(0).toUpperCase() + userData.studyMode.slice(1)
          : deck.enabledModes.flashcard
            ? 'Flashcards'
            : deck.enabledModes.spelling
              ? 'Spelling'
              : 'Speaking';

      return `
        <article class="deck-card deck-card-rich">
          <div class="deck-card-top">
            <div class="deck-card-heading">
              <div class="deck-title-row">
                <h2 class="deck-card-title">${escapeHtml(deck.title)}</h2>
                <span class="lang-pill">${escapeHtml(deck.language)}</span>
              </div>
              ${deck.subtitle ? `<p class="deck-card-sub">${escapeHtml(deck.subtitle)}</p>` : ''}
            </div>
            <span class="deck-count-pill">${stats.total} cards</span>
          </div>

          <div class="deck-mode-pills">
            ${modeBadges.map((m) => `<span class="mode-pill">${m}</span>`).join('')}
          </div>

          ${sectionDropdownHtml}

          <div class="deck-progress">
            <div class="deck-progress-bar">
              <div class="deck-progress-fill" style="width: ${stats.learnedPct}%"></div>
              <div class="deck-progress-fill-strong" style="width: ${stats.strongPct}%"></div>
            </div>
            <div class="deck-progress-meta">
              <span>${stats.learned}/${stats.total} mastered (3+)</span>
              <span>${stats.strong} strong (6+)</span>
            </div>
          </div>

          <div class="deck-card-footer">
            <span class="deck-next-preview">Up next: <strong>${escapeHtml(previewText)}</strong></span>
            <div class="deck-card-actions">
              <button type="button" class="btn btn-ghost btn-xs" data-export-deck="${escapeHtml(id)}" title="Export as .srsl">Export .srsl</button>
              ${
                !deck.builtIn
                  ? `<button type="button" class="btn btn-ghost btn-xs" data-edit-deck="${escapeHtml(id)}">Edit</button>
                     <button type="button" class="btn btn-ghost btn-xs btn-danger-text" data-delete-deck="${escapeHtml(id)}">Delete</button>`
                  : ''
              }
              <button type="button" class="btn btn-primary btn-sm" data-open-deck="${escapeHtml(id)}">Study ${studyModeLabel} →</button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  // Bind section dropdowns on Home cards
  deckGrid.querySelectorAll('[data-deck-section]').forEach((sel) => {
    sel.addEventListener('change', () => {
      setActiveSectionId(sel.dataset.deckSection, sel.value);
      persist();
      renderHome();
    });
  });

  // Open deck
  deckGrid.querySelectorAll('[data-open-deck]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openDeck(btn.dataset.openDeck);
    });
  });

  // Export deck as .zip
  deckGrid.querySelectorAll('[data-export-deck]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const deck = getDecksMap()[btn.dataset.exportDeck];
      if (!deck) return;
      try {
        await exportDeckZip(deck);
        showHomeToast(`Exported "${deck.title}" as ${deck.id}.srsl`);
      } catch (err) {
        showHomeToast(err?.message || 'Failed to export deck.', true);
      }
    });
  });

  // Edit custom deck
  deckGrid.querySelectorAll('[data-edit-deck]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const deck = getDecksMap()[btn.dataset.editDeck];
      if (deck && !deck.builtIn) openDeckBuilder(deck);
    });
  });

  // Delete custom deck
  deckGrid.querySelectorAll('[data-delete-deck]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteDeck;
      const deck = getDecksMap()[id];
      if (!deck || deck.builtIn) return;
      if (!confirm(`Delete "${deck.title}" and its saved progress?`)) return;

      delete userData.customDecks[id];
      Object.keys(userData.progress || {}).forEach((k) => {
        if (k.startsWith(`${id}::`)) delete userData.progress[k];
      });
      await deleteDeckAudio(id);
      if (userData.activeDeckId === id) {
        userData.activeDeckId = 'chinese-unit-4';
      }
      persist();
      renderHome();
      showHomeToast(`Deleted "${deck.title}".`);
    });
  });
}

function openDeck(deckId) {
  const decks = getDecksMap();
  if (!decks[deckId]) return;
  userData.activeDeckId = deckId;
  enforceDeckConstraints(decks[deckId]);
  resetCardTransientState();
  persist();
  showView('study');
}

/* ==================== IMPORT .ZIP / .JSON DECK ==================== */

btnImportDeck.addEventListener('click', () => {
  importFileInput.value = '';
  importFileInput.click();
});

importFileInput.addEventListener('change', async () => {
  const file = importFileInput.files && importFileInput.files[0];
  if (!file) return;
  try {
    const { deck, audioCount } = await importDeckFile(file);
    if (!userData.customDecks) userData.customDecks = {};
    // Avoid colliding with built-in deck ID
    if (deck.id === 'chinese-unit-4') {
      deck.id = `${deck.id}-${Date.now().toString(36)}`;
    }
    userData.customDecks[deck.id] = deck;
    setActiveSectionId(deck.id, 'all');
    persist();
    renderHome();
    const audioNote = audioCount > 0 ? ` with ${audioCount} audio file${audioCount === 1 ? '' : 's'}` : '';
    showHomeToast(`Imported "${deck.title}" (${deck.cards.length} cards${audioNote})!`);
  } catch (err) {
    showHomeToast(err?.message || 'Could not import deck file.', true);
  }
});

/* ==================== AI DECK MAKER ==================== */

function renderAiAttachments() {
  if (!aiAttachments.length) {
    aiFileList.classList.add('hidden');
    aiFileList.innerHTML = '';
    return;
  }
  aiFileList.classList.remove('hidden');
  aiFileList.innerHTML = aiAttachments
    .map((item) => {
      const thumb = item.images && item.images[0]
        ? `<img src="${item.images[0].dataUrl}" alt="" class="ai-file-thumb" />`
        : `<span class="ai-file-kind">${escapeHtml(item.kind.toUpperCase())}</span>`;
      const detail = item.images?.length
        ? `${item.images.length} image${item.images.length > 1 ? 's' : ''}`
        : `${item.text.length.toLocaleString()} chars`;
      return `
        <div class="ai-file-chip">
          ${thumb}
          <div class="ai-file-info">
            <span class="ai-file-name">${escapeHtml(item.name)}</span>
            <span class="ai-file-meta">${detail}</span>
          </div>
          <button type="button" class="btn btn-ghost btn-xs" data-remove-att="${escapeHtml(item.id)}" title="Remove">✕</button>
        </div>
      `;
    })
    .join('');

  aiFileList.querySelectorAll('[data-remove-att]').forEach((btn) => {
    btn.addEventListener('click', () => {
      aiAttachments = aiAttachments.filter((a) => a.id !== btn.dataset.removeAtt);
      renderAiAttachments();
    });
  });
}

async function handleAiFilesAdded(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  aiError.textContent = '';
  aiProgress.textContent = `Reading ${files.length} file${files.length > 1 ? 's' : ''}…`;
  aiProgress.classList.remove('hidden');

  try {
    for (const file of files) {
      const extracted = await extractUploadFile(file);
      aiAttachments.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...extracted
      });
    }
    renderAiAttachments();
  } catch (err) {
    aiError.textContent = err?.message || 'Could not read one of the uploaded files.';
  } finally {
    aiProgress.classList.add('hidden');
  }
}

async function openAiModal() {
  aiError.textContent = '';
  aiProgress.classList.add('hidden');
  aiPreview.classList.add('hidden');
  aiGeneratedDeck = null;
  aiOpenRouterKey.value = getSavedOpenRouterKey();
  aiModal.classList.remove('hidden');
  renderAiAttachments();

  const status = await checkServerAiStatus();
  if (status.serverKeyConfigured) {
    aiServerStatus.textContent = '✓ Server AI ready — free Chinese models (Qwen / DeepSeek / GLM) active';
    aiServerStatus.classList.remove('hidden');
    aiKeyDetails.open = false;
  } else {
    aiServerStatus.classList.add('hidden');
    if (!aiOpenRouterKey.value) aiKeyDetails.open = true;
  }
}

function closeAiModal() {
  aiModal.classList.add('hidden');
}

btnOpenAi.addEventListener('click', openAiModal);
btnCloseAi.addEventListener('click', closeAiModal);
btnCancelAi.addEventListener('click', closeAiModal);

aiDropzone.addEventListener('click', () => {
  aiFileInput.value = '';
  aiFileInput.click();
});
aiDropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    aiFileInput.value = '';
    aiFileInput.click();
  }
});
aiFileInput.addEventListener('change', () => handleAiFilesAdded(aiFileInput.files));

aiDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  aiDropzone.classList.add('is-dragover');
});
aiDropzone.addEventListener('dragleave', () => {
  aiDropzone.classList.remove('is-dragover');
});
aiDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  aiDropzone.classList.remove('is-dragover');
  handleAiFilesAdded(e.dataTransfer?.files);
});

aiOpenRouterKey.addEventListener('change', () => {
  saveOpenRouterKey(aiOpenRouterKey.value);
});

aiForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  aiError.textContent = '';
  aiPreview.classList.add('hidden');
  aiGeneratedDeck = null;

  const prompt = aiPrompt.value.trim();
  const extractedText = aiAttachments
    .filter((a) => a.text)
    .map((a) => `=== File: ${a.name} ===\n${a.text}`)
    .join('\n\n');
  const images = aiAttachments.flatMap((a) => a.images || []);

  if (!prompt && !extractedText && !images.length) {
    aiError.textContent = 'Enter a topic/instructions or upload at least one file.';
    return;
  }

  const clientApiKey = aiOpenRouterKey.value.trim();
  if (clientApiKey) saveOpenRouterKey(clientApiKey);

  const enabledModes = {
    flashcard: aiOptFlashcard.checked,
    spelling: aiOptSpelling.checked,
    speaking: aiOptSpeaking.checked,
    reverse: aiOptReverse.checked
  };

  btnAiGenerate.disabled = true;
  btnAiGenerate.textContent = 'Generating…';
  aiProgress.textContent = images.length
    ? 'Analyzing uploaded images & content with free Chinese AI…'
    : 'Generating deck with free Chinese AI (Qwen / DeepSeek / GLM)…';
  aiProgress.classList.remove('hidden');

  try {
    const { deck, modelUsed } = await generateAiDeck({
      prompt,
      language: aiLanguage.value,
      enabledModes,
      preferredFamily: aiModelFamily.value,
      extractedText,
      images,
      clientApiKey
    });

    // Avoid colliding with built-in deck ID
    if (deck.id === 'chinese-unit-4') {
      deck.id = `${deck.id}-${Date.now().toString(36)}`;
    }
    aiGeneratedDeck = deck;

    aiPreviewTitle.textContent = deck.title;
    const secCount = Math.max(0, (deck.sections?.length || 1) - 1);
    aiPreviewMeta.textContent = `${deck.cards.length} cards · ${deck.language}${
      secCount ? ` · ${secCount} sections` : ''
    }`;
    aiPreviewModel.textContent = modelUsed;
    aiPreviewCards.innerHTML = deck.cards
      .slice(0, 12)
      .map(
        (c) => `
          <div class="ai-preview-row">
            <strong>${escapeHtml(c.front)}</strong>
            <span>${escapeHtml(c.back)}</span>
            ${c.meaning ? `<span class="ai-preview-meaning">${escapeHtml(c.meaning)}</span>` : ''}
          </div>
        `
      )
      .join('') +
      (deck.cards.length > 12
        ? `<div class="ai-preview-more">+ ${deck.cards.length - 12} more cards…</div>`
        : '');

    aiPreview.classList.remove('hidden');
  } catch (err) {
    aiError.textContent = err?.message || 'AI deck generation failed.';
  } finally {
    btnAiGenerate.disabled = false;
    btnAiGenerate.textContent = '✨ Generate Deck';
    aiProgress.classList.add('hidden');
  }
});

btnAiSaveStudy.addEventListener('click', () => {
  if (!aiGeneratedDeck) return;
  if (!userData.customDecks) userData.customDecks = {};
  userData.customDecks[aiGeneratedDeck.id] = aiGeneratedDeck;
  setActiveSectionId(aiGeneratedDeck.id, 'all');
  const idToOpen = aiGeneratedDeck.id;
  aiAttachments = [];
  aiPrompt.value = '';
  aiGeneratedDeck = null;
  persist();
  closeAiModal();
  openDeck(idToOpen);
});

btnAiEdit.addEventListener('click', () => {
  if (!aiGeneratedDeck) return;
  const draft = aiGeneratedDeck;
  closeAiModal();
  openDeckBuilder(draft);
  editingDeckId = null; // Treat as new deck on save
});

btnAiExport.addEventListener('click', async () => {
  if (!aiGeneratedDeck) return;
  await exportDeckZip(aiGeneratedDeck);
  showHomeToast(`Exported "${aiGeneratedDeck.title}" as ${aiGeneratedDeck.id}.srsl`);
});

/* ==================== CREATE / EDIT DECK BUILDER ==================== */

function createBuilderRowHtml(card = {}) {
  const secVal = card.section && card.section !== 'all' ? card.section : '';
  return `
    <div class="builder-card-row">
      <input type="text" class="row-front" placeholder="Front" value="${escapeHtml(card.front || '')}" />
      <input type="text" class="row-back" placeholder="Back" value="${escapeHtml(card.back || '')}" />
      <input type="text" class="row-meaning" placeholder="Meaning / hint" value="${escapeHtml(card.meaning || '')}" />
      <input type="text" class="row-section" placeholder="Section (opt.)" value="${escapeHtml(secVal)}" />
      <button type="button" class="btn btn-ghost btn-xs btn-remove-row" title="Remove card">✕</button>
    </div>
  `;
}

function appendBuilderCardRow(card = {}) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = createBuilderRowHtml(card).trim();
  const row = wrapper.firstElementChild;
  row.querySelector('.btn-remove-row').addEventListener('click', () => {
    if (builderCardRows.children.length > 1) row.remove();
  });
  builderCardRows.appendChild(row);
}

function openDeckBuilder(existingDeck = null) {
  editingDeckId = existingDeck ? existingDeck.id : null;
  builderModalTitle.textContent = existingDeck ? `Edit "${existingDeck.title}"` : 'Create New Deck';
  builderError.textContent = '';
  bulkPasteBox.classList.add('hidden');
  bulkPasteText.value = '';

  if (existingDeck) {
    builderTitle.value = existingDeck.title;
    builderSubtitle.value = existingDeck.subtitle || '';
    builderLanguage.value = existingDeck.language || 'en-US';
    builderFrontLabel.value = existingDeck.frontLabel || 'Front';
    builderBackLabel.value = existingDeck.backLabel || 'Back';
    builderAccentSet.value = existingDeck.accentSet || 'european';
    optFlashcard.checked = existingDeck.enabledModes.flashcard !== false;
    optSpelling.checked = existingDeck.enabledModes.spelling !== false;
    optSpeaking.checked = existingDeck.enabledModes.speaking !== false;
    optReverse.checked = existingDeck.enabledModes.reverse !== false;
    builderCardRows.innerHTML = '';
    existingDeck.cards.forEach((c) => appendBuilderCardRow(c));
  } else {
    builderTitle.value = '';
    builderSubtitle.value = '';
    builderLanguage.value = 'es-ES';
    builderFrontLabel.value = 'Spanish';
    builderBackLabel.value = 'English';
    builderAccentSet.value = 'spanish';
    optFlashcard.checked = true;
    optSpelling.checked = true;
    optSpeaking.checked = true;
    optReverse.checked = true;
    builderCardRows.innerHTML = '';
    appendBuilderCardRow();
    appendBuilderCardRow();
    appendBuilderCardRow();
  }

  builderModal.classList.remove('hidden');
  builderTitle.focus();
}

function closeDeckBuilder() {
  builderModal.classList.add('hidden');
  editingDeckId = null;
}

builderLanguage.addEventListener('change', () => {
  const lang = builderLanguage.value;
  builderAccentSet.value = inferAccentSet(lang);
  if (lang.startsWith('zh')) {
    builderFrontLabel.value = 'Pinyin';
    builderBackLabel.value = 'Hanzi';
  } else if (lang.startsWith('es')) {
    builderFrontLabel.value = 'Spanish';
    builderBackLabel.value = 'English';
  } else if (lang.startsWith('fr')) {
    builderFrontLabel.value = 'French';
    builderBackLabel.value = 'English';
  } else if (lang.startsWith('de')) {
    builderFrontLabel.value = 'German';
    builderBackLabel.value = 'English';
  } else if (lang.startsWith('ja')) {
    builderFrontLabel.value = 'Reading';
    builderBackLabel.value = 'Japanese';
  } else if (lang.startsWith('ko')) {
    builderFrontLabel.value = 'Korean';
    builderBackLabel.value = 'English';
  } else {
    builderFrontLabel.value = 'Front';
    builderBackLabel.value = 'Back';
  }
});

btnOpenBuilder.addEventListener('click', () => openDeckBuilder(null));
btnCloseBuilder.addEventListener('click', closeDeckBuilder);
btnCancelBuilder.addEventListener('click', closeDeckBuilder);
btnAddCardRow.addEventListener('click', () => appendBuilderCardRow());
btnToggleBulk.addEventListener('click', () => {
  bulkPasteBox.classList.toggle('hidden');
});

btnApplyBulk.addEventListener('click', () => {
  const lines = bulkPasteText.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return;

  // Remove empty starter rows before appending bulk lines
  Array.from(builderCardRows.children).forEach((row) => {
    const f = row.querySelector('.row-front').value.trim();
    const b = row.querySelector('.row-back').value.trim();
    if (!f && !b) row.remove();
  });

  lines.forEach((line) => {
    const parts = line.split('|').map((p) => p.trim());
    appendBuilderCardRow({
      front: parts[0] || '',
      back: parts[1] || '',
      meaning: parts[2] || '',
      section: parts[3] || ''
    });
  });
  bulkPasteText.value = '';
  bulkPasteBox.classList.add('hidden');
});

builderForm.addEventListener('submit', (e) => {
  e.preventDefault();
  builderError.textContent = '';

  const title = builderTitle.value.trim();
  if (!title) {
    builderError.textContent = 'Please enter a deck title.';
    return;
  }

  const enabledModes = {
    flashcard: optFlashcard.checked,
    spelling: optSpelling.checked,
    speaking: optSpeaking.checked,
    reverse: optReverse.checked
  };
  if (!enabledModes.flashcard && !enabledModes.spelling && !enabledModes.speaking) {
    builderError.textContent = 'Enable at least one study mode (Flashcards, Spelling, or Speaking).';
    return;
  }

  const cards = [];
  Array.from(builderCardRows.children).forEach((row, idx) => {
    const front = row.querySelector('.row-front').value.trim();
    const back = row.querySelector('.row-back').value.trim();
    const meaning = row.querySelector('.row-meaning').value.trim();
    const section = row.querySelector('.row-section').value.trim();
    if (!front && !back) return;
    cards.push({
      id: `c-${idx + 1}`,
      front: front || back,
      back: back || front,
      meaning,
      section: section || undefined
    });
  });

  if (!cards.length) {
    builderError.textContent = 'Add at least one card before saving.';
    return;
  }

  const deckId = editingDeckId || `${slugify(title)}-${Date.now().toString(36)}`;
  const rawDeck = {
    id: deckId,
    title,
    subtitle: builderSubtitle.value.trim(),
    language: builderLanguage.value,
    frontLabel: builderFrontLabel.value.trim() || 'Front',
    backLabel: builderBackLabel.value.trim() || 'Back',
    accentSet: builderAccentSet.value,
    enabledModes,
    cards,
    builtIn: false
  };

  try {
    const normalized = normalizeDeck(rawDeck);
    if (!userData.customDecks) userData.customDecks = {};
    userData.customDecks[normalized.id] = normalized;
    // Reset stale progress tracks for edited deck so new/edited cards appear
    if (editingDeckId) {
      Object.keys(userData.progress || {}).forEach((k) => {
        if (k.startsWith(`${normalized.id}::`)) delete userData.progress[k];
      });
    }
    setActiveSectionId(normalized.id, 'all');
    persist();
    closeDeckBuilder();
    renderHome();
    showHomeToast(`Saved "${normalized.title}" (${normalized.cards.length} cards).`);
  } catch (err) {
    builderError.textContent = err?.message || 'Could not save deck.';
  }
});

/* ==================== ACCENT BAR (SPELLING MODE) ==================== */

function renderAccentBar() {
  const deck = getActiveDeck();
  if (deck.accentSet === 'none') {
    accentBarWrap.classList.add('hidden');
    return;
  }
  accentBarWrap.classList.remove('hidden');

  if (!accentPaletteSelect.options.length) {
    accentPaletteSelect.innerHTML = Object.keys(ACCENT_PALETTES)
      .map((key) => `<option value="${key}">${escapeHtml(ACCENT_PALETTES[key].label)}</option>`)
      .join('');
  }
  if (!ACCENT_PALETTES[selectedAccentPalette]) {
    selectedAccentPalette = 'pinyin';
  }
  accentPaletteSelect.value = selectedAccentPalette;

  const palette = ACCENT_PALETTES[selectedAccentPalette];
  accentKeys.innerHTML = palette.chars
    .map((ch) => `<button type="button" class="accent-key" data-accent-char="${escapeHtml(ch)}">${escapeHtml(ch)}</button>`)
    .join('');

  accentKeys.querySelectorAll('[data-accent-char]').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      // Keep focus in the spelling input
      e.preventDefault();
    });
    btn.addEventListener('click', () => {
      insertCharAtCursor(spellingInput, btn.dataset.accentChar);
    });
  });
}

accentPaletteSelect.addEventListener('change', () => {
  selectedAccentPalette = accentPaletteSelect.value;
  renderAccentBar();
  focusSpellingIfNeeded();
});

/* ==================== STUDY VIEW ==================== */

function populateStudyDropdowns() {
  const decksMap = getDecksMap();
  deckSelect.innerHTML = Object.keys(decksMap)
    .map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(decksMap[id].title)}</option>`)
    .join('');
  deckSelect.value = userData.activeDeckId;

  const deck = getActiveDeck();
  const hasSections = deck.sections && deck.sections.length > 1;
  sectionSelect.classList.toggle('hidden', !hasSections);
  if (hasSections) {
    const activeSec = getActiveSectionId(deck);
    sectionSelect.innerHTML = deck.sections
      .map((s) => {
        const count = getSectionCards(deck, s.id).length;
        return `<option value="${escapeHtml(s.id)}">${escapeHtml(s.label)} (${count})</option>`;
      })
      .join('');
    sectionSelect.value = activeSec;
  }
}

function focusSpellingIfNeeded() {
  if (currentView === 'study' && userData.studyMode === 'spelling' && !spellingResult) {
    requestAnimationFrame(() => {
      spellingInput.focus();
    });
  }
}

function renderStudy() {
  const deck = getActiveDeck();
  enforceDeckConstraints(deck);
  updateSegmentedControls();
  updateUserChrome();

  // Dynamic labels & visibility for deck-specific enabled modes
  const modes = deck.enabledModes;
  studyDirectionGroup.classList.toggle('hidden', !modes.reverse || userData.studyMode === 'speaking');
  btnDirForward.textContent = `${deck.frontLabel} → ${deck.backLabel}`;
  btnDirReverse.textContent = `${deck.backLabel} → ${deck.frontLabel}`;

  btnModeFlashcard.classList.toggle('hidden', !modes.flashcard);
  btnModeSpelling.classList.toggle('hidden', !modes.spelling);
  btnModeSpeaking.classList.toggle('hidden', !modes.speaking);

  deckSelect.value = deck.id;
  if (deck.sections && deck.sections.length > 1) {
    sectionSelect.value = getActiveSectionId(deck);
  }

  userData.multiplier = Math.min(3.0, Math.max(1.1, Number(userData.multiplier) || 2.0));
  multiplierSlider.value = String(userData.multiplier);
  multiplierValue.textContent = userData.multiplier.toFixed(1) + '×';

  const cards = getActiveTrack();
  const current = cards[0];
  const isReverse = userData.direction === 'reverse';
  const mode = userData.studyMode;

  flashcardEl.classList.toggle('hidden', mode !== 'flashcard');
  spellingPanel.classList.toggle('hidden', mode !== 'spelling');
  speakingPanel.classList.toggle('hidden', mode !== 'speaking');

  if (current) {
    if (mode === 'flashcard') {
      frontDirectionPill.textContent = isReverse
        ? `${deck.backLabel} → ${deck.frontLabel}`
        : `${deck.frontLabel} → ${deck.backLabel}`;

      if (isReverse) {
        frontMainEl.textContent = current.back;
        frontMainEl.className = 'card-hanzi card-hanzi-front';
        frontSubEl.textContent = current.meaning;
        frontSubEl.classList.toggle('hidden', !current.meaning);

        backMainEl.textContent = current.front;
        backMainEl.className = 'card-pinyin';
        backSubEl.textContent = current.back;
        backExtraEl.textContent = current.meaning;
        backExtraEl.classList.toggle('hidden', !current.meaning);
      } else {
        frontMainEl.textContent = current.front;
        frontMainEl.className = 'card-pinyin';
        frontSubEl.textContent = '';
        frontSubEl.classList.add('hidden');

        backMainEl.textContent = current.back;
        backMainEl.className = 'card-hanzi';
        backSubEl.textContent = current.meaning;
        backExtraEl.textContent = '';
        backExtraEl.classList.add('hidden');
      }
      cardInnerEl.classList.toggle('is-flipped', flipped);
    } else if (mode === 'spelling') {
      const targetLabel = isReverse ? deck.frontLabel : deck.backLabel;
      spellingDirectionPill.textContent = `Type ${targetLabel}`;
      spellingInput.placeholder = isReverse
        ? `Type ${deck.frontLabel}…`
        : `Type ${deck.backLabel}…`;

      if (isReverse) {
        spellingPromptMain.textContent = current.back;
        spellingPromptMain.className = 'spelling-prompt-main is-hanzi';
        spellingPromptSub.textContent = current.meaning;
        spellingPromptSub.classList.toggle('hidden', !current.meaning);
        btnSpellingHint.classList.add('hidden');
      } else {
        spellingPromptMain.textContent = current.front;
        spellingPromptMain.className = 'spelling-prompt-main is-pinyin';
        btnSpellingHint.classList.toggle('hidden', !current.meaning || Boolean(spellingResult));
        btnSpellingHint.textContent = spellingHintVisible ? 'Hide hint' : 'Show hint';
        spellingPromptSub.textContent = current.meaning;
        spellingPromptSub.classList.toggle('hidden', !current.meaning || (!spellingHintVisible && !spellingResult));
      }

      if (spellingResult) {
        spellingInput.disabled = true;
        btnSpellingCheck.disabled = true;
        spellingFeedback.classList.remove('hidden');
        spellingFeedback.classList.toggle('is-correct', spellingResult.isCorrect);
        spellingFeedback.classList.toggle('is-wrong', !spellingResult.isCorrect);

        if (spellingResult.isCorrect) {
          spellingVerdict.textContent = 'Correct!';
          spellingComparison.innerHTML = spellingResult.note
            ? `<span class="spelling-note">${escapeHtml(spellingResult.note)}</span>`
            : '';
          spellingShortcutHint.innerHTML =
            'Press <kbd class="keycap">Enter</kbd> or <kbd class="keycap">J</kbd> for Right · <kbd class="keycap">K</kbd> for Wrong';
        } else {
          spellingVerdict.textContent = 'Not quite';
          const typedDisplay = spellingResult.typed
            ? `<strong>${escapeHtml(spellingResult.typed)}</strong>`
            : '<em>(blank)</em>';
          spellingComparison.innerHTML = `
            <div class="comp-row"><span class="comp-label">You typed:</span> ${typedDisplay}</div>
            <div class="comp-row"><span class="comp-label">Expected:</span> <strong>${escapeHtml(spellingResult.expected)}</strong></div>
            ${spellingResult.note ? `<div class="spelling-note">${escapeHtml(spellingResult.note)}</div>` : ''}
          `;
          spellingShortcutHint.innerHTML =
            'Press <kbd class="keycap">Enter</kbd> or <kbd class="keycap">K</kbd> for Wrong · Actually right? Press <kbd class="keycap">J</kbd>';
        }

        spellingFullCard.innerHTML = `
          <span class="full-hanzi">${escapeHtml(current.back)}</span>
          <span class="full-sep">·</span>
          <span class="full-pinyin">${escapeHtml(current.front)}</span>
          ${current.meaning ? `<span class="full-sep">·</span><span class="full-english">${escapeHtml(current.meaning)}</span>` : ''}
        `;
      } else {
        spellingInput.disabled = false;
        btnSpellingCheck.disabled = false;
        spellingFeedback.classList.add('hidden');
        spellingFeedback.classList.remove('is-correct', 'is-wrong');
      }
    } else if (mode === 'speaking') {
      // Show BOTH Hanzi (back) and Pinyin (front) + English meaning!
      speakingPromptBack.textContent = current.back;
      speakingPromptFront.textContent = current.front !== current.back ? current.front : '';
      speakingPromptMeaning.textContent = current.meaning || '';

      btnRecordVoice.classList.toggle('is-recording', isRecording);
      btnRecordLabel.textContent = isRecording ? 'Stop Recording' : 'Record & Verify';
      btnPlayRecording.disabled = !recordedAudioUrl || isRecording;

      if (speakingResult) {
        speakingFeedback.classList.remove('hidden', 'is-correct', 'is-wrong', 'is-close');
        if (speakingResult.status === 'match') {
          speakingFeedback.classList.add('is-correct');
          speakingVerdict.textContent = `Verified Match (${speakingResult.score}%)`;
          speakingComparison.innerHTML = `
            <div class="comp-row"><span class="comp-label">Heard:</span> <strong>${escapeHtml(speakingResult.heard)}</strong></div>
          `;
          speakingShortcutHint.innerHTML =
            'Press <kbd class="keycap">Enter</kbd> or <kbd class="keycap">J</kbd> for Right · <kbd class="keycap">K</kbd> for Wrong';
        } else if (speakingResult.status === 'close') {
          speakingFeedback.classList.add('is-close');
          speakingVerdict.textContent = `Close (${speakingResult.score}%) — Listen & Decide`;
          speakingComparison.innerHTML = `
            <div class="comp-row"><span class="comp-label">Heard:</span> <strong>${escapeHtml(speakingResult.heard)}</strong></div>
            <div class="comp-row"><span class="comp-label">Target:</span> <strong>${escapeHtml(speakingResult.target)}</strong></div>
          `;
          speakingShortcutHint.innerHTML =
            'Listen to Reference vs Your Recording · Press <kbd class="keycap">J</kbd> if you got it right, or <kbd class="keycap">K</kbd> for Wrong';
        } else if (speakingResult.status === 'mismatch') {
          speakingFeedback.classList.add('is-wrong');
          speakingVerdict.textContent = `Not a match (${speakingResult.score}%)`;
          speakingComparison.innerHTML = `
            <div class="comp-row"><span class="comp-label">Heard:</span> <strong>${escapeHtml(speakingResult.heard)}</strong></div>
            <div class="comp-row"><span class="comp-label">Target:</span> <strong>${escapeHtml(speakingResult.target)}</strong></div>
          `;
          speakingShortcutHint.innerHTML =
            'Press <kbd class="keycap">K</kbd> for Wrong · Actually said it right? Press <kbd class="keycap">J</kbd>';
        } else {
          speakingFeedback.classList.add('is-close');
          speakingVerdict.textContent = speakingResult.recognitionAvailable
            ? 'Recording saved (no speech text detected)'
            : 'Recording saved (manual comparison)';
          speakingComparison.innerHTML = `
            <div class="spelling-note">Play Reference and Play My Recording above to compare your pronunciation, then grade yourself with J or K.</div>
          `;
          speakingShortcutHint.innerHTML =
            'Press <kbd class="keycap">J</kbd> if you got it right · <kbd class="keycap">K</kbd> for Wrong';
        }
      } else {
        speakingFeedback.classList.add('hidden');
      }
    }
  }

  // Highlight "I got it right [J]" override when spelling or speaking didn't auto-pass
  const isOverride =
    (mode === 'spelling' && spellingResult && !spellingResult.isCorrect) ||
    (mode === 'speaking' && speakingResult && !speakingResult.isCorrect);
  btnRightLabel.textContent = isOverride ? 'I got it right' : 'Right';
  btnWrongLabel.textContent = 'Wrong';
  btnRight.classList.toggle('btn-override', Boolean(isOverride));

  btnUndo.disabled = getUndoStack().length === 0;

  // Render linear queue
  queueGrid.innerHTML = cards
    .map((card, idx) => {
      const pos = idx + 1;
      const classes = ['slot'];
      if (pos === 1) classes.push('is-current');
      else if (pos <= WORKING_SET_SIZE) classes.push('is-working');
      if (card.correct >= 9) classes.push('streak-9');
      else if (card.correct >= 6) classes.push('streak-6');
      else if (card.correct >= 3) classes.push('streak-3');
      else if (card.correct >= 1) classes.push('streak-1');
      if (card.uuid === lastMovedUuid) classes.push('is-moved');

      const word = isReverse || mode === 'speaking' ? card.back : card.front;
      return (
        `<div class="${classes.join(' ')}">` +
        `<div class="slot-num">#${pos}</div>` +
        `<div class="slot-word">${escapeHtml(word)}</div>` +
        `</div>`
      );
    })
    .join('');
}

function flipCard() {
  if (userData.studyMode !== 'flashcard') return;
  flipped = !flipped;
  renderStudy();
}

function checkCurrentSpelling() {
  const deck = getActiveDeck();
  const current = getActiveTrack()[0];
  if (!current) return;

  const typed = spellingInput.value.trim();
  const res = checkSpellingAnswer(typed, current, userData.direction, deck);
  spellingResult = {
    isCorrect: res.isCorrect,
    typed,
    expected: res.expected,
    note: res.note
  };
  spellingInput.blur();
  renderStudy();
}

async function toggleVoiceRecording() {
  const deck = getActiveDeck();
  const current = getActiveTrack()[0];
  if (!current) return;

  if (isRecording && speakingSession) {
    speakingSession.stop();
    return;
  }

  if (!isMediaRecorderSupported && !isSpeechRecognitionSupported) {
    speakingError.textContent = 'Voice recording is not supported in this browser. Try Chrome, Edge, or Safari.';
    return;
  }

  speakingError.textContent = '';
  speakingResult = null;
  if (recordedAudioUrl) {
    URL.revokeObjectURL(recordedAudioUrl);
    recordedAudioUrl = null;
  }

  isRecording = true;
  speakingLiveBox.classList.remove('hidden');
  speakingLiveText.textContent = 'Listening… speak clearly now.';
  renderStudy();

  const session = await startSpeakingSession({
    lang: deck.language || 'zh-CN',
    onInterim: (text) => {
      speakingLiveText.textContent = `Hearing: "${text}"`;
    },
    onComplete: ({ audioUrl, transcripts, recognitionAvailable }) => {
      isRecording = false;
      speakingSession = null;
      speakingLiveBox.classList.add('hidden');
      recordedAudioUrl = audioUrl || null;
      const verified = verifySpokenAnswer(transcripts, current, deck);
      speakingResult = { ...verified, recognitionAvailable };
      renderStudy();
    },
    onError: (msg) => {
      isRecording = false;
      speakingSession = null;
      speakingLiveBox.classList.add('hidden');
      speakingError.textContent = msg;
      renderStudy();
    }
  });

  if (session) {
    speakingSession = session;
  }
}

async function handlePlayReference(slow = false) {
  const deck = getActiveDeck();
  const current = getActiveTrack()[0];
  if (!current) return;
  try {
    await playReferenceAudio(current, deck, { slow });
  } catch (err) {
    speakingError.textContent = err?.message || 'Unable to play reference audio.';
  }
}

function answer(isRight) {
  const cards = getActiveTrack();
  if (!cards.length) return;

  stopActiveRecordingAndAudio();

  const stack = getUndoStack();
  stack.push({
    cards: cards.map((c) => ({ ...c })),
    flipped,
    lastMovedUuid
  });
  if (stack.length > 200) stack.shift();

  const result = step(cards, isRight, userData.multiplier);
  setActiveTrack(result.cards);
  resetCardTransientState();
  lastMovedUuid = result.movedUuid;

  persist();
  renderStudy();
  focusSpellingIfNeeded();
}

function undo() {
  const stack = getUndoStack();
  if (!stack.length) return;
  stopActiveRecordingAndAudio();
  const prev = stack.pop();
  setActiveTrack(prev.cards);
  resetCardTransientState();
  flipped = prev.flipped;
  lastMovedUuid = prev.lastMovedUuid;

  persist();
  renderStudy();
  focusSpellingIfNeeded();
}

function resetCurrentDeck() {
  const deck = getActiveDeck();
  const sec = getActiveSectionId(deck);
  const cards = getActiveTrack();
  const stack = getUndoStack();
  stack.push({
    cards: cards.map((c) => ({ ...c })),
    flipped,
    lastMovedUuid
  });
  setActiveTrack(createDeckCards(getSectionCards(deck, sec)));
  resetCardTransientState();
  persist();
  renderStudy();
  focusSpellingIfNeeded();
}

/* ==================== EVENT LISTENERS ==================== */

document.querySelectorAll('[data-direction]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const nextDir = btn.dataset.direction;
    if (nextDir === userData.direction) return;
    userData.direction = nextDir;
    resetCardTransientState();
    persist();
    if (currentView === 'home') renderHome();
    else if (currentView === 'study') {
      renderStudy();
      focusSpellingIfNeeded();
    }
  });
});

document.querySelectorAll('[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const nextMode = btn.dataset.mode;
    if (nextMode === userData.studyMode) return;
    userData.studyMode = nextMode;
    resetCardTransientState();
    persist();
    if (currentView === 'home') renderHome();
    else if (currentView === 'study') {
      renderStudy();
      focusSpellingIfNeeded();
    }
  });
});

btnBackHome.addEventListener('click', () => showView('home'));

deckSelect.addEventListener('change', () => {
  userData.activeDeckId = deckSelect.value;
  const deck = getActiveDeck();
  enforceDeckConstraints(deck);
  selectedAccentPalette =
    deck.accentSet && ACCENT_PALETTES[deck.accentSet]
      ? deck.accentSet
      : inferAccentSet(deck.language);
  resetCardTransientState();
  populateStudyDropdowns();
  renderAccentBar();
  persist();
  renderStudy();
  focusSpellingIfNeeded();
});

sectionSelect.addEventListener('change', () => {
  const deck = getActiveDeck();
  setActiveSectionId(deck.id, sectionSelect.value);
  resetCardTransientState();
  persist();
  renderStudy();
  focusSpellingIfNeeded();
});

btnResetDeck.addEventListener('click', resetCurrentDeck);
btnRight.addEventListener('click', () => answer(true));
btnWrong.addEventListener('click', () => answer(false));
btnUndo.addEventListener('click', undo);

multiplierSlider.addEventListener('input', () => {
  userData.multiplier = parseFloat(multiplierSlider.value);
  multiplierValue.textContent = userData.multiplier.toFixed(1) + '×';
  persist();
});

// Audio & Speaking buttons
btnFlashcardAudioFront.addEventListener('click', (e) => {
  e.stopPropagation();
  handlePlayReference(false);
});
btnFlashcardAudioBack.addEventListener('click', (e) => {
  e.stopPropagation();
  handlePlayReference(false);
});
btnSpellingAudio.addEventListener('click', () => handlePlayReference(false));
btnRecordVoice.addEventListener('click', toggleVoiceRecording);
btnPlayReference.addEventListener('click', () => handlePlayReference(false));
btnPlayReferenceSlow.addEventListener('click', () => handlePlayReference(true));
btnPlayRecording.addEventListener('click', () => playAudioUrl(recordedAudioUrl));

// Spelling form & hint
spellingForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!spellingResult) checkCurrentSpelling();
});

btnSpellingHint.addEventListener('click', () => {
  spellingHintVisible = !spellingHintVisible;
  renderStudy();
  focusSpellingIfNeeded();
});

// Tap / Click & Touch Swipe on Flashcard
let touchStartX = 0;
let touchStartY = 0;
let touchDeltaX = 0;
let isSwiping = false;
let suppressNextClick = false;

flashcardEl.addEventListener('click', () => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  flipCard();
});

flashcardEl.addEventListener(
  'touchstart',
  (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchDeltaX = 0;
    isSwiping = false;
  },
  { passive: true }
);

flashcardEl.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (!isSwiping && Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy)) {
      isSwiping = true;
    }
    if (isSwiping) {
      touchDeltaX = dx;
      flashcardEl.style.transform = `translateX(${dx * 0.35}px)`;
      flashcardEl.classList.toggle('swiping-right', dx > 45);
      flashcardEl.classList.toggle('swiping-left', dx < -45);
    }
  },
  { passive: true }
);

flashcardEl.addEventListener('touchend', () => {
  flashcardEl.style.transform = '';
  flashcardEl.classList.remove('swiping-right', 'swiping-left');
  if (isSwiping) {
    suppressNextClick = true;
    if (touchDeltaX > 65) answer(true);
    else if (touchDeltaX < -65) answer(false);
  }
  isSwiping = false;
  touchDeltaX = 0;
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (!aiModal.classList.contains('hidden')) {
    if (e.key === 'Escape') closeAiModal();
    return;
  }
  if (!builderModal.classList.contains('hidden')) {
    if (e.key === 'Escape') closeDeckBuilder();
    return;
  }
  if (currentView !== 'study') return;

  const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

  const key = e.key.toLowerCase();

  if (userData.studyMode === 'spelling') {
    if (spellingResult) {
      if (key === 'j') {
        e.preventDefault();
        answer(true);
      } else if (key === 'k') {
        e.preventDefault();
        answer(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        answer(spellingResult.isCorrect);
      } else if (key === 'u') {
        e.preventDefault();
        undo();
      }
    } else if (key === 'u') {
      e.preventDefault();
      undo();
    }
    return;
  }

  if (userData.studyMode === 'speaking') {
    if (e.key === ' ') {
      e.preventDefault();
      toggleVoiceRecording();
    } else if (key === 'j') {
      e.preventDefault();
      answer(true);
    } else if (key === 'k') {
      e.preventDefault();
      answer(false);
    } else if (e.key === 'Enter' && speakingResult) {
      e.preventDefault();
      answer(speakingResult.isCorrect);
    } else if (key === 'u') {
      e.preventDefault();
      undo();
    }
    return;
  }

  // Flashcard mode
  if (e.key === ' ') {
    e.preventDefault();
    flipCard();
  } else if (key === 'j') {
    e.preventDefault();
    answer(true);
  } else if (key === 'k') {
    e.preventDefault();
    answer(false);
  } else if (key === 'u') {
    e.preventDefault();
    undo();
  }
});

// Flush pending cloud sync when leaving or hiding tab
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') cloudSyncer.flush();
});
window.addEventListener('beforeunload', () => {
  cloudSyncer.flush();
});

/* ==================== BOOTSTRAP ==================== */

async function init() {
  renderAuthForm();

  if (isSupabaseConfigured && supabase) {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        currentUser = null;
        if (!offlineMode) {
          setSyncStatus('offline');
          showView('auth');
        }
      } else if (event === 'TOKEN_REFRESHED' && nextSession?.user) {
        currentUser = nextSession.user;
      }
    });

    if (session && session.user) {
      await handleAuthenticatedUser(session.user);
      return;
    }
  }

  showView('auth');
}

init();
