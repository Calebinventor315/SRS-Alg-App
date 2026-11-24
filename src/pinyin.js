/* Smart Hanzi & Pinyin Answer Matcher for Spelling Mode */

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

/**
 * Convert a pinyin string into:
 * - plain: lowercase ASCII without tones, spaces, or apostrophes (ü -> v)
 * - toned: lowercase ASCII with tone digits attached to each syllable-ish group (best effort)
 * - hasTones: whether the input contained any tone marks or tone digits (1-5)
 */
function parsePinyin(raw) {
  const lowered = String(raw || '').toLowerCase().trim();
  let hasToneMark = false;
  let hasToneDigit = /[1-5]/.test(lowered);

  // Convert tone-marked vowels into base + tone digit in-place, and normalize ü -> v
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
      // Ignore neutral tone 5 in toned comparison if desired, keep 1-4
      if (ch !== '5') withTones += ch;
    }
  }

  // Normalize tone digit position: move any tone digit to the end of its letter cluster
  // e.g. "ji1at2ing" -> extract tone sequence and compare both plain + tone sequence
  const toneSeq = (withTones.match(/[1-4]/g) || []).join('');

  return {
    plain,
    toneSeq,
    hasTones: hasToneMark || hasToneDigit
  };
}

/**
 * Check a user's typed spelling answer against a card.
 * @param {string} userInput
 * @param {{ pinyin: string, hanzi: string, english: string }} card
 * @param {'forward' | 'reverse'} direction
 * @returns {{ isCorrect: boolean, expected: string, note: string }}
 */
export function checkSpellingAnswer(userInput, card, direction) {
  const raw = String(userInput || '').trim();
  if (direction === 'forward') {
    // Prompt is Pinyin -> user types Hanzi
    const cleanedUser = stripPunctuationAndSpaces(raw);
    const cleanedExpected = stripPunctuationAndSpaces(card.hanzi);
    const isCorrect = cleanedUser.length > 0 && cleanedUser === cleanedExpected;
    return {
      isCorrect,
      expected: card.hanzi,
      note: isCorrect ? '' : ''
    };
  }

  // direction === 'reverse': Prompt is Hanzi (+ English) -> user types Pinyin
  if (!raw) {
    return { isCorrect: false, expected: card.pinyin, note: '' };
  }

  const user = parsePinyin(raw);
  const expected = parsePinyin(card.pinyin);

  // Also allow 'u' as fallback for 'v'/'ü' when user types e.g. "nuer" for "nǚ'ér"
  const plainMatch =
    user.plain.length > 0 &&
    (user.plain === expected.plain ||
      user.plain.replace(/v/g, 'u') === expected.plain.replace(/v/g, 'u'));

  if (!plainMatch) {
    return { isCorrect: false, expected: card.pinyin, note: '' };
  }

  // If user typed tones (marks or numbers), verify tones match too!
  if (user.hasTones) {
    const toneMatch = user.toneSeq === expected.toneSeq;
    return {
      isCorrect: toneMatch,
      expected: card.pinyin,
      note: toneMatch ? '' : 'Spelling matched, but check the tones.'
    };
  }

  // Plain pinyin matched without tones -> accept and remind them of the exact tones
  return {
    isCorrect: true,
    expected: card.pinyin,
    note: `Tones: ${card.pinyin}`
  };
}
