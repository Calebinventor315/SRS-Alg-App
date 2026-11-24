/* Clickable Accent & Tone Character Palettes for Any Language */

export const ACCENT_PALETTES = {
  pinyin: {
    label: 'Pinyin Tones',
    chars: [
      'ā', 'á', 'ǎ', 'à',
      'ē', 'é', 'ě', 'è',
      'ī', 'í', 'ǐ', 'ì',
      'ō', 'ó', 'ǒ', 'ò',
      'ū', 'ú', 'ǔ', 'ù',
      'ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'
    ]
  },
  spanish: {
    label: 'Spanish',
    chars: ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡']
  },
  french: {
    label: 'French',
    chars: ['à', 'â', 'æ', 'ç', 'é', 'è', 'ê', 'ë', 'î', 'ï', 'ô', 'œ', 'ù', 'û', 'ü', 'ÿ']
  },
  german: {
    label: 'German',
    chars: ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü']
  },
  portuguese: {
    label: 'Portuguese / Italian',
    chars: ['á', 'à', 'â', 'ã', 'ç', 'é', 'ê', 'è', 'í', 'ì', 'ó', 'ò', 'ô', 'õ', 'ú', 'ù']
  },
  european: {
    label: 'All Accents',
    chars: [
      'á', 'à', 'â', 'ä', 'ã', 'é', 'è', 'ê', 'ë',
      'í', 'ì', 'î', 'ï', 'ó', 'ò', 'ô', 'ö', 'õ',
      'ú', 'ù', 'û', 'ü', 'ñ', 'ç', 'ß', '¿', '¡'
    ]
  }
};

export function insertCharAtCursor(inputEl, char) {
  if (!inputEl || inputEl.disabled) return;
  const start = inputEl.selectionStart ?? inputEl.value.length;
  const end = inputEl.selectionEnd ?? inputEl.value.length;
  const before = inputEl.value.slice(0, start);
  const after = inputEl.value.slice(end);
  inputEl.value = before + char + after;
  const nextPos = start + char.length;
  inputEl.focus();
  inputEl.setSelectionRange(nextPos, nextPos);
  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
}
