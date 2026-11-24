/* Smart Multilingual Spelling Matcher (Pinyin, Hanzi, and General Languages) */

const TONE_MAP = {
  'ā': ['a', '1'], 'á': ['a', '2'], 'ǎ': ['a', '3'], 'à': ['a', '4'],
  'ē': ['e', '1'], 'é': ['e', '2'], 'ě': ['e', '3'], 'è': ['e', '4'],
  'ī': ['i', '1'], 'í': ['i', '2'], 'ǐ': ['i', '3'], 'ì': ['i', '4'],
  'ō': ['o', '1'], 'ó': ['o', '2'], 'ǒ': ['o', '3'], 'ò': ['o', '4'],
  'ū': ['u', '1'], 'ú': ['u', '2'], 'ǔ': ['u', '3'], 'ù': ['u', '4'],
  'ǖ': ['v', '1'], 'ǘ': ['v', '2'], 'ǚ': ['v', '3'], 'ǜ': ['v', '4'],
  'ü': ['v', '']
};

function stripPunctuationAndSpaces(str) {
  return String(str || '')
    .trim()
    .replace(/[\s'’‘·.,!?，。！？\-_]/g, '');
}

function normalizeGeneralText(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[.,!?¿¡，。！？'’‘"]/g, '')
    .replace(/\s+/g, ' ');
}

function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function parsePinyin(raw) {
  const lowered = String(raw || '').toLowerCase().trim();
  let hasToneMark = false;
  let hasToneDigit = /[1-5]/.test(lowered);

  let withTones = '';
  let plain = '';

  for (const ch of lowered) {
    if (TONE_MAP[ch]) {
      const [base, tone] = TONE_MAP[ch];
      plain += base;
      withTones += base + tone;
      if (tone) hasToneMark = true;
    } else if (/[a-z]/.test(ch)) {
      plain += ch;
      withTones += ch;
    } else if (/[1-5]/.test(ch)) {
      if (ch !== '5') withTones += ch;
    }
  }

  const toneSeq = (withTones.match(/[1-4]/g) || []).join('');

  return {
    plain,
    toneSeq,
    hasTones: hasToneMark || hasToneDigit
  };
}

function isPinyinTarget(deck, direction) {
  if (!deck) return direction === 'reverse';
  const isChinese = String(deck.language || '').toLowerCase().startsWith('zh') || deck.accentSet === 'pinyin';
  if (!isChinese) return false;
  // For Chinese decks: front is Pinyin, back is Hanzi.
  // In reverse mode, user types front (Pinyin).
  return direction === 'reverse';
}

function isHanziTarget(deck, direction) {
  if (!deck) return direction === 'forward';
  const isChinese = String(deck.language || '').toLowerCase().startsWith('zh') || deck.accentSet === 'pinyin';
  return isChinese && direction === 'forward';
}

/**
 * Check a user's typed spelling answer against a card.
 * @param {string} userInput
 * @param {{ front?: string, back?: string, pinyin?: string, hanzi?: string }} card
 * @param {'forward' | 'reverse'} direction
 * @param {{ language?: string, accentSet?: string } | null} deck
 * @returns {{ isCorrect: boolean, expected: string, note: string }}
 */
export function checkSpellingAnswer(userInput, card, direction, deck = null) {
  const raw = String(userInput || '').trim();
  const frontVal = card.front ?? card.pinyin ?? '';
  const backVal = card.back ?? card.hanzi ?? '';
  const expected = direction === 'forward' ? backVal : frontVal;

  if (!raw) {
    return { isCorrect: false, expected, note: '' };
  }

  // Case 1: Chinese Hanzi target
  if (isHanziTarget(deck, direction)) {
    const cleanedUser = stripPunctuationAndSpaces(raw);
    const cleanedExpected = stripPunctuationAndSpaces(expected);
    const isCorrect = cleanedUser.length > 0 && cleanedUser === cleanedExpected;
    return { isCorrect, expected, note: '' };
  }

  // Case 2: Chinese Pinyin target
  if (isPinyinTarget(deck, direction)) {
    const user = parsePinyin(raw);
    const exp = parsePinyin(expected);
    const plainMatch =
      user.plain.length > 0 &&
      (user.plain === exp.plain ||
        user.plain.replace(/v/g, 'u') === exp.plain.replace(/v/g, 'u'));

    if (!plainMatch) {
      return { isCorrect: false, expected, note: '' };
    }

    if (user.hasTones) {
      const toneMatch = user.toneSeq === exp.toneSeq;
      return {
        isCorrect: toneMatch,
        expected,
        note: toneMatch ? '' : 'Spelling matched, but check the tones.'
      };
    }

    return {
      isCorrect: true,
      expected,
      note: `Tones: ${expected}`
    };
  }

  // Case 3: Any other language (Spanish, French, German, English, etc.)
  const normUser = normalizeGeneralText(raw);
  const normExpected = normalizeGeneralText(expected);
  if (normUser === normExpected) {
    return { isCorrect: true, expected, note: '' };
  }

  // If letters match ignoring accents, tell them about the accent
  if (stripDiacritics(normUser) === stripDiacritics(normExpected)) {
    return {
      isCorrect: true,
      expected,
      note: `Watch accents: ${expected}`
    };
  }

  return { isCorrect: false, expected, note: '' };
}
