/* Main Application Controller — Auth, Home, Flashcard/Spelling, Forward/Reverse, Cloud Sync */
import { SRS_DECKS } from './decks.js';
import { WORKING_SET_SIZE, createDeckCards, step } from './srs.js';
import { checkSpellingAnswer } from './pinyin.js';
import { isSupabaseConfigured, supabase } from './supabase.js';
import {
  buildFreshData,
  createCloudSyncer,
  loadAndSyncInitialState,
  loadLocal,
  saveLocal
} from './storage.js';

// App state
let currentUser = null; // Supabase user object or null
let offlineMode = false;
let currentView = 'auth'; // 'auth' | 'home' | 'study'
let authMode = 'signin'; // 'signin' | 'signup'
let userData = buildFreshData();

// Study session state
let flipped = false;
let lastMovedUuid = null;
let spellingResult = null; // null | { isCorrect, typed, expected, note }
let spellingHintVisible = false;
const undoStacks = {}; // keyed by `${deckId}:${direction}`

// DOM references — Views
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
const deckGrid = document.getElementById('deck-grid');

// DOM — Study
const btnBackHome = document.getElementById('btn-back-home');
const deckSelect = document.getElementById('deck-select');
const btnResetDeck = document.getElementById('btn-reset-deck');
const studySyncBadge = document.getElementById('study-sync-badge');
const btnStudyAuth = document.getElementById('btn-study-auth');

const flashcardEl = document.getElementById('flashcard');
const cardInnerEl = document.getElementById('card-inner');
const frontDirectionPill = document.getElementById('front-direction-pill');
const frontMainEl = document.getElementById('front-main');
const frontSubEl = document.getElementById('front-sub');
const backMainEl = document.getElementById('back-main');
const backSubEl = document.getElementById('back-sub');
const backExtraEl = document.getElementById('back-extra');

const spellingPanel = document.getElementById('spelling-panel');
const spellingDirectionPill = document.getElementById('spelling-direction-pill');
const btnSpellingHint = document.getElementById('btn-spelling-hint');
const spellingPromptMain = document.getElementById('spelling-prompt-main');
const spellingPromptSub = document.getElementById('spelling-prompt-sub');
const spellingForm = document.getElementById('spelling-form');
const spellingInput = document.getElementById('spelling-input');
const btnSpellingCheck = document.getElementById('btn-spelling-check');
const spellingFeedback = document.getElementById('spelling-feedback');
const spellingVerdict = document.getElementById('spelling-verdict');
const spellingComparison = document.getElementById('spelling-comparison');
const spellingFullCard = document.getElementById('spelling-full-card');
const spellingShortcutHint = document.getElementById('spelling-shortcut-hint');

const btnRight = document.getElementById('btn-right');
const btnWrong = document.getElementById('btn-wrong');
const btnRightLabel = document.getElementById('btn-right-label');
const btnWrongLabel = document.getElementById('btn-wrong-label');
const btnUndo = document.getElementById('btn-undo');
const multiplierSlider = document.getElementById('multiplier-slider');
const multiplierValue = document.getElementById('multiplier-value');
const queueGrid = document.getElementById('queue-grid');

// Sync status management
let syncStatus = 'offline'; // 'offline' | 'synced' | 'syncing' | 'error'
const cloudSyncer = createCloudSyncer((status) => {
  setSyncStatus(status);
});

function setSyncStatus(status) {
  syncStatus = status;
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
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getActiveDeckTrack() {
  const deck = userData.decks[userData.activeDeckId];
  if (!deck) return [];
  return deck[userData.direction] || [];
}

function setActiveDeckTrack(cards) {
  if (!userData.decks[userData.activeDeckId]) {
    userData.decks[userData.activeDeckId] = {
      forward: createDeckCards(SRS_DECKS[userData.activeDeckId].cards),
      reverse: createDeckCards(SRS_DECKS[userData.activeDeckId].cards)
    };
  }
  userData.decks[userData.activeDeckId][userData.direction] = cards;
}

function getUndoStack() {
  const key = `${userData.activeDeckId}:${userData.direction}`;
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

function showView(view) {
  currentView = view;
  authView.classList.toggle('hidden', view !== 'auth');
  homeView.classList.toggle('hidden', view !== 'home');
  studyView.classList.toggle('hidden', view !== 'study');

  if (view === 'home') {
    renderHome();
  } else if (view === 'study') {
    renderStudy();
    focusSpellingIfNeeded();
  }
}

function updateSegmentedControls() {
  document.querySelectorAll('[data-direction]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.direction === userData.direction);
  });
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mode === userData.studyMode);
  });
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

function populateDeckDropdown() {
  deckSelect.innerHTML = Object.keys(SRS_DECKS)
    .map((id) => `<option value="${id}">${escapeHtml(SRS_DECKS[id].label)}</option>`)
    .join('');
}

/* ==================== AUTH ==================== */

function renderAuthForm() {
  const isSignUp = authMode === 'signup';
  authTitle.textContent = isSignUp ? 'Create your account' : 'Sign in to Chinese SRS';
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
        authInfo.textContent = 'Account created! Check your email to confirm, then sign in.';
        authInfo.classList.remove('hidden');
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

// OAuth sign-in (Google, Apple, Microsoft)
document.querySelectorAll('[data-oauth]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (!isSupabaseConfigured || !supabase) return;
    authError.textContent = '';
    const provider = btn.dataset.oauth;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) {
      authError.textContent = error.message;
    }
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
  let started = 0;
  let learned = 0;
  let strong = 0;
  cards.forEach((c) => {
    if (c.correct >= 1) started += 1;
    if (c.correct >= 3) learned += 1;
    if (c.correct >= 6) strong += 1;
  });
  return {
    total,
    started,
    learned,
    strong,
    learnedPct: total ? Math.round((learned / total) * 100) : 0,
    strongPct: total ? Math.round((strong / total) * 100) : 0
  };
}

function renderHome() {
  updateSegmentedControls();
  updateUserChrome();

  const dir = userData.direction;
  const otherDir = dir === 'forward' ? 'reverse' : 'forward';
  const modeLabel = userData.studyMode === 'spelling' ? 'Spelling' : 'Flashcards';

  deckGrid.innerHTML = Object.keys(SRS_DECKS)
    .map((id) => {
      const meta = SRS_DECKS[id];
      const track = (userData.decks[id] && userData.decks[id][dir]) || [];
      const otherTrack = (userData.decks[id] && userData.decks[id][otherDir]) || [];
      const stats = computeTrackStats(track);
      const otherStats = computeTrackStats(otherTrack);
      const nextCard = track[0];
      const previewText = nextCard
        ? dir === 'forward'
          ? nextCard.pinyin
          : nextCard.hanzi
        : '';

      return `
        <button type="button" class="deck-card" data-open-deck="${id}">
          <div class="deck-card-top">
            <div class="deck-card-heading">
              <h2 class="deck-card-title">${escapeHtml(meta.title)}</h2>
              <p class="deck-card-sub">${escapeHtml(meta.subtitle)}</p>
            </div>
            <span class="deck-count-pill">${stats.total} cards</span>
          </div>

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
            <span class="deck-next-preview">Up next: <strong>${escapeHtml(previewText)}</strong>${
              otherStats.learned > 0
                ? ` · ${otherDir === 'reverse' ? 'Reverse' : 'Forward'}: ${otherStats.learned}/${otherStats.total}`
                : ''
            }</span>
            <span class="deck-card-cta">Study ${modeLabel} →</span>
          </div>
        </button>
      `;
    })
    .join('');

  deckGrid.querySelectorAll('[data-open-deck]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openDeck(btn.dataset.openDeck);
    });
  });
}

function openDeck(deckId) {
  if (!SRS_DECKS[deckId]) return;
  userData.activeDeckId = deckId;
  resetCardTransientState();
  persist();
  showView('study');
}

/* ==================== STUDY VIEW ==================== */

function resetCardTransientState() {
  flipped = false;
  lastMovedUuid = null;
  spellingResult = null;
  spellingHintVisible = false;
  spellingInput.value = '';
  spellingInput.disabled = false;
}

function focusSpellingIfNeeded() {
  if (currentView === 'study' && userData.studyMode === 'spelling' && !spellingResult) {
    requestAnimationFrame(() => {
      spellingInput.focus();
    });
  }
}

function renderStudy() {
  updateSegmentedControls();
  updateUserChrome();

  deckSelect.value = userData.activeDeckId;
  userData.multiplier = Math.min(3.0, Math.max(1.1, Number(userData.multiplier) || 2.0));
  multiplierSlider.value = String(userData.multiplier);
  multiplierValue.textContent = userData.multiplier.toFixed(1) + '×';

  const cards = getActiveDeckTrack();
  const current = cards[0];
  const isReverse = userData.direction === 'reverse';
  const isSpelling = userData.studyMode === 'spelling';

  // Toggle Flashcard vs Spelling panels
  flashcardEl.classList.toggle('hidden', isSpelling);
  spellingPanel.classList.toggle('hidden', !isSpelling);

  if (current) {
    if (!isSpelling) {
      // Flashcard Mode
      frontDirectionPill.textContent = isReverse ? 'Hanzi → Pinyin' : 'Pinyin → Hanzi';
      if (isReverse) {
        frontMainEl.textContent = current.hanzi;
        frontMainEl.className = 'card-hanzi card-hanzi-front';
        frontSubEl.textContent = current.english;
        frontSubEl.classList.remove('hidden');

        backMainEl.textContent = current.pinyin;
        backMainEl.className = 'card-pinyin';
        backSubEl.textContent = current.hanzi;
        backExtraEl.textContent = current.english;
        backExtraEl.classList.remove('hidden');
      } else {
        frontMainEl.textContent = current.pinyin;
        frontMainEl.className = 'card-pinyin';
        frontSubEl.textContent = '';
        frontSubEl.classList.add('hidden');

        backMainEl.textContent = current.hanzi;
        backMainEl.className = 'card-hanzi';
        backSubEl.textContent = current.english;
        backExtraEl.textContent = '';
        backExtraEl.classList.add('hidden');
      }
      cardInnerEl.classList.toggle('is-flipped', flipped);
    } else {
      // Spelling Mode
      spellingDirectionPill.textContent = isReverse ? 'Type Pinyin' : 'Type Hanzi';
      spellingInput.placeholder = isReverse
        ? 'Type pinyin (e.g. jiating or jiātíng)…'
        : 'Type hanzi (e.g. 家庭)…';

      if (isReverse) {
        spellingPromptMain.textContent = current.hanzi;
        spellingPromptMain.className = 'spelling-prompt-main is-hanzi';
        spellingPromptSub.textContent = current.english;
        spellingPromptSub.classList.remove('hidden');
        btnSpellingHint.classList.add('hidden');
      } else {
        spellingPromptMain.textContent = current.pinyin;
        spellingPromptMain.className = 'spelling-prompt-main is-pinyin';
        btnSpellingHint.classList.toggle('hidden', Boolean(spellingResult));
        btnSpellingHint.textContent = spellingHintVisible ? 'Hide hint' : 'Show English hint';
        spellingPromptSub.textContent = current.english;
        spellingPromptSub.classList.toggle('hidden', !spellingHintVisible && !spellingResult);
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
          <span class="full-hanzi">${escapeHtml(current.hanzi)}</span>
          <span class="full-sep">·</span>
          <span class="full-pinyin">${escapeHtml(current.pinyin)}</span>
          <span class="full-sep">·</span>
          <span class="full-english">${escapeHtml(current.english)}</span>
        `;
      } else {
        spellingInput.disabled = false;
        btnSpellingCheck.disabled = false;
        spellingFeedback.classList.add('hidden');
        spellingFeedback.classList.remove('is-correct', 'is-wrong');
      }
    }
  }

  // Update Right / Wrong button labels (highlight override when spelling missed)
  const isSpellingOverride = isSpelling && spellingResult && !spellingResult.isCorrect;
  btnRightLabel.textContent = isSpellingOverride ? 'I got it right' : 'Right';
  btnWrongLabel.textContent = 'Wrong';
  btnRight.classList.toggle('btn-override', Boolean(isSpellingOverride));

  btnUndo.disabled = getUndoStack().length === 0;

  // Render linear queue (shows prompt side so reverse mode doesn't spoil pinyin)
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

      const word = isReverse ? card.hanzi : card.pinyin;
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
  const cards = getActiveDeckTrack();
  const current = cards[0];
  if (!current) return;

  const typed = spellingInput.value.trim();
  const res = checkSpellingAnswer(typed, current, userData.direction);
  spellingResult = {
    isCorrect: res.isCorrect,
    typed,
    expected: res.expected,
    note: res.note
  };
  spellingInput.blur();
  renderStudy();
}

function answer(isRight) {
  const cards = getActiveDeckTrack();
  if (!cards.length) return;

  const stack = getUndoStack();
  stack.push({
    cards: cards.map((c) => ({ ...c })),
    flipped,
    lastMovedUuid
  });
  if (stack.length > 200) stack.shift();

  const result = step(cards, isRight, userData.multiplier);
  setActiveDeckTrack(result.cards);
  lastMovedUuid = result.movedUuid;
  flipped = false;
  spellingResult = null;
  spellingHintVisible = false;
  spellingInput.value = '';
  spellingInput.disabled = false;

  persist();
  renderStudy();
  focusSpellingIfNeeded();
}

function undo() {
  const stack = getUndoStack();
  if (!stack.length) return;
  const prev = stack.pop();
  setActiveDeckTrack(prev.cards);
  flipped = prev.flipped;
  lastMovedUuid = prev.lastMovedUuid;
  spellingResult = null;
  spellingHintVisible = false;
  spellingInput.value = '';
  spellingInput.disabled = false;

  persist();
  renderStudy();
  focusSpellingIfNeeded();
}

function resetCurrentDeck() {
  const cards = getActiveDeckTrack();
  const stack = getUndoStack();
  stack.push({
    cards: cards.map((c) => ({ ...c })),
    flipped,
    lastMovedUuid
  });
  setActiveDeckTrack(createDeckCards(SRS_DECKS[userData.activeDeckId].cards));
  resetCardTransientState();
  persist();
  renderStudy();
  focusSpellingIfNeeded();
}

/* ==================== EVENT LISTENERS ==================== */

// Direction & Mode segmented controls (synced across Home and Study views)
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

btnBackHome.addEventListener('click', () => {
  showView('home');
});

deckSelect.addEventListener('change', () => {
  userData.activeDeckId = deckSelect.value;
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

// Spelling form & hint
spellingForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!spellingResult) {
    checkCurrentSpelling();
  }
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

// Keyboard shortcuts (Study view only)
document.addEventListener('keydown', (e) => {
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

  // Flashcard mode shortcuts
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
  if (document.visibilityState === 'hidden') {
    cloudSyncer.flush();
  }
});
window.addEventListener('beforeunload', () => {
  cloudSyncer.flush();
});

/* ==================== BOOTSTRAP ==================== */

async function init() {
  populateDeckDropdown();
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
