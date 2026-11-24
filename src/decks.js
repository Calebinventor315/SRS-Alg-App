/* Built-in Decks & Universal Deck Schema */

const SET_1 = [
  { front: 'jiātíng', back: '家庭', meaning: 'family', section: 'set1' },
  { front: 'kǒu', back: '口', meaning: '[measure word for people]', sections: ['set1', 'measure'] },
  { front: 'bàba', back: '爸爸', meaning: 'dad', section: 'set1' },
  { front: 'māma', back: '妈妈', meaning: 'mom', section: 'set1' },
  { front: 'gēge', back: '哥哥', meaning: 'older brother', section: 'set1' },
  { front: 'dìdi', back: '弟弟', meaning: 'younger brother', section: 'set1' },
  { front: 'jiějie', back: '姐姐', meaning: 'older sister', section: 'set1' },
  { front: 'mèimei', back: '妹妹', meaning: 'younger sister', section: 'set1' }
];

const SET_2 = [
  { front: 'āyí', back: '阿姨', meaning: 'aunt (maternal, younger than mom)', section: 'set2' },
  { front: 'shūshu', back: '叔叔', meaning: 'paternal uncle (younger than dad)', section: 'set2' },
  { front: 'biǎodì', back: '表弟', meaning: 'maternal male cousin (younger)', section: 'set2' },
  { front: 'biǎomèi', back: '表妹', meaning: 'maternal female cousin (younger)', section: 'set2' },
  { front: 'yéye', back: '爷爷', meaning: 'grandpa (paternal)', section: 'set2' },
  { front: 'nǎinai', back: '奶奶', meaning: 'grandma (paternal)', section: 'set2' },
  { front: 'sūnzi', back: '孙子', meaning: 'grandson (paternal)', section: 'set2' },
  { front: 'sūnnǚ', back: '孙女', meaning: 'granddaughter (paternal)', section: 'set2' }
];

const SET_3 = [
  { front: 'zhàngfu', back: '丈夫', meaning: 'husband', section: 'set3' },
  { front: 'qīzi', back: '妻子', meaning: 'wife', section: 'set3' },
  { front: 'érzi', back: '儿子', meaning: 'son', section: 'set3' },
  { front: "nǚ'ér", back: '女儿', meaning: 'daughter', section: 'set3' },
  { front: "yīng'ér", back: '婴儿', meaning: 'baby', section: 'set3' },
  { front: 'jiéhūn', back: '结婚', meaning: 'get married', section: 'set3' }
];

const SET_4 = [
  { front: 'péngyǒu', back: '朋友', meaning: 'friend', section: 'set4' },
  { front: 'nánhái', back: '男孩', meaning: 'boy', section: 'set4' },
  { front: 'nǚhái', back: '女孩', meaning: 'girl', section: 'set4' },
  { front: 'háizi', back: '孩子', meaning: 'child', section: 'set4' },
  { front: 'xiānsheng', back: '先生', meaning: 'Mr.', section: 'set4' },
  { front: 'nǚshì', back: '女士', meaning: 'Mrs.', section: 'set4' },
  { front: 'nánrén', back: '男人', meaning: 'man', section: 'set4' },
  { front: 'nǚrén', back: '女人', meaning: 'woman', section: 'set4' }
];

const MEASURE_GRAMMAR = [
  { front: 'ge', back: '个', meaning: 'general measure word for people', section: 'measure' },
  { front: 'wèi', back: '位', meaning: 'polite measure word for people', section: 'measure' },
  { front: 'ma', back: '吗', meaning: 'yes/no question particle', section: 'measure' }
];

const PHRASES = [
  { front: 'nǚpéngyǒu', back: '女朋友', meaning: 'girlfriend', section: 'phrases' },
  { front: 'huí jiā', back: '回家', meaning: 'to go back home', section: 'phrases' },
  { front: 'wèishénme', back: '为什么', meaning: 'why?', section: 'phrases' },
  { front: 'yīnggāi huì', back: '应该会', meaning: 'should be', section: 'phrases' },
  { front: 'shùxué bǐsài', back: '数学比赛', meaning: 'math competition', section: 'phrases' },
  { front: 'dé le', back: '得了', meaning: 'got / won', section: 'phrases' },
  { front: 'dì èr míng', back: '第二名', meaning: 'second place', section: 'phrases' },
  { front: 'liù gè yuè', back: '六个月', meaning: 'six months', section: 'phrases' },
  { front: 'xìngfú', back: '幸福', meaning: 'happy', section: 'phrases' },
  { front: 'qǐng wèn', back: '请问', meaning: 'excuse me / may I ask', section: 'phrases' },
  { front: 'dìtiě', back: '地铁', meaning: 'subway', section: 'phrases' },
  { front: 'zěnme zǒu', back: '怎么走', meaning: 'how to get to', section: 'phrases' },
  { front: 'hěn máng', back: '很忙', meaning: 'very busy', section: 'phrases' },
  { front: 'shēngrì', back: '生日', meaning: 'birthday', section: 'phrases' },
  { front: 'duōdà', back: '多大', meaning: 'how old', section: 'phrases' },
  { front: 'shēntǐ', back: '身体', meaning: 'body / health', section: 'phrases' },
  { front: 'jiànkāng', back: '健康', meaning: 'healthy', section: 'phrases' },
  { front: 'quán jiā zhào', back: '全家照', meaning: 'family photo', section: 'phrases' },
  { front: 'shuài', back: '帅', meaning: 'handsome', section: 'phrases' },
  { front: 'wēnróu', back: '温柔', meaning: 'gentle', section: 'phrases' },
  { front: 'fēnshǒu', back: '分手', meaning: 'break up', section: 'phrases' },
  { front: 'zhōumò', back: '周末', meaning: 'weekend', section: 'phrases' },
  { front: 'kàn diànyǐng', back: '看电影', meaning: 'watch a movie', section: 'phrases' },
  { front: 'jiārén', back: '家人', meaning: 'family members', section: 'phrases' },
  { front: 'běn', back: '本', meaning: 'measure word for books', section: 'phrases' },
  { front: 'zhāng', back: '张', meaning: 'measure word for flat objects', section: 'phrases' },
  { front: 'zhī', back: '支', meaning: 'measure word for stick-like objects', section: 'phrases' },
  { front: 'yǐjīng', back: '已经', meaning: 'already', section: 'phrases' },
  { front: 'shēng bìng', back: '生病', meaning: 'get sick', section: 'phrases' },
  { front: 'cānjiā', back: '参加', meaning: 'attend / participate in', section: 'phrases' },
  { front: 'hūnlǐ', back: '婚礼', meaning: 'wedding', section: 'phrases' },
  { front: 'guò shēngrì', back: '过生日', meaning: 'celebrate a birthday', section: 'phrases' }
];

const UNIT_4_CARDS = [...SET_1, ...SET_2, ...SET_3, ...SET_4, ...MEASURE_GRAMMAR, ...PHRASES].map(
  (card, i) => ({
    id: `u4-${i + 1}`,
    front: card.front,
    back: card.back,
    meaning: card.meaning,
    speechText: card.back,
    section: card.section || 'set1',
    sections: card.sections || [card.section || 'set1'],
    audio: null
  })
);

export const BUILTIN_DECKS = {
  'chinese-unit-4': {
    id: 'chinese-unit-4',
    title: 'Chinese — Unit 4',
    subtitle: 'Family, People, Measure Words & Dialogue Phrases',
    language: 'zh-CN',
    frontLabel: 'Pinyin',
    backLabel: 'Hanzi',
    accentSet: 'pinyin',
    builtIn: true,
    enabledModes: {
      flashcard: true,
      spelling: true,
      speaking: true,
      reverse: true
    },
    sections: [
      { id: 'all', label: 'All Cards' },
      { id: 'set1', label: 'Set 1 · Immediate Family' },
      { id: 'set2', label: 'Set 2 · Extended Family' },
      { id: 'set3', label: 'Set 3 · Marriage & Children' },
      { id: 'set4', label: 'Set 4 · People & Friends' },
      { id: 'measure', label: 'Measure Words & Grammar' },
      { id: 'phrases', label: 'Glossed & Dialogue Phrases' }
    ],
    cards: UNIT_4_CARDS
  }
};

export function inferAccentSet(language) {
  const lang = String(language || '').toLowerCase();
  if (lang.startsWith('zh')) return 'pinyin';
  if (lang.startsWith('es')) return 'spanish';
  if (lang.startsWith('fr')) return 'french';
  if (lang.startsWith('de')) return 'german';
  if (lang.startsWith('pt') || lang.startsWith('it')) return 'portuguese';
  return 'european';
}

export function slugify(text) {
  return (
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'deck'
  );
}

/**
 * Normalize a raw deck definition (from Deck Builder or .zip/.json import)
 * into the canonical internal format.
 */
export function normalizeDeck(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Deck JSON must be an object.');
  }

  const title = String(raw.title || raw.name || 'Untitled Deck').trim();
  const id = String(raw.id || `${slugify(title)}-${Date.now().toString(36)}`).trim();
  const language = String(raw.language || 'en-US').trim();
  const accentSet = raw.accentSet || inferAccentSet(language);
  const frontLabel = String(raw.frontLabel || (language.toLowerCase().startsWith('zh') ? 'Pinyin' : 'Front')).trim();
  const backLabel = String(raw.backLabel || (language.toLowerCase().startsWith('zh') ? 'Hanzi' : 'Back')).trim();

  const rawModes = raw.enabledModes || raw.modes || {};
  const enabledModes = {
    flashcard: rawModes.flashcard !== false,
    spelling: rawModes.spelling !== false,
    speaking: rawModes.speaking !== false,
    reverse: rawModes.reverse !== false
  };
  // Ensure at least one primary study mode is enabled
  if (!enabledModes.flashcard && !enabledModes.spelling && !enabledModes.speaking) {
    enabledModes.flashcard = true;
  }

  const rawCards = Array.isArray(raw.cards) ? raw.cards : [];
  if (!rawCards.length) {
    throw new Error('Deck must contain at least one card.');
  }

  const discoveredSections = new Map();
  if (Array.isArray(raw.sections)) {
    raw.sections.forEach((sec) => {
      if (typeof sec === 'string') {
        const sid = slugify(sec);
        if (sid !== 'all') discoveredSections.set(sid, sec.trim());
      } else if (sec && typeof sec === 'object' && sec.id && sec.id !== 'all') {
        discoveredSections.set(String(sec.id), String(sec.label || sec.name || sec.id));
      }
    });
  }

  const cards = rawCards
    .map((c, idx) => {
      const front = String(c.front ?? c.pinyin ?? c.prompt ?? c.term ?? '').trim();
      const back = String(c.back ?? c.hanzi ?? c.answer ?? c.definition ?? '').trim();
      const meaning = String(c.meaning ?? c.english ?? c.notes ?? c.hint ?? '').trim();
      if (!front && !back) return null;

      let secList = [];
      if (Array.isArray(c.sections) && c.sections.length) {
        secList = c.sections.map((s) => {
          const sid = slugify(s);
          if (sid !== 'all' && !discoveredSections.has(sid)) {
            discoveredSections.set(sid, String(s).trim());
          }
          return sid;
        });
      } else if (c.section) {
        const rawSec = String(c.section).trim();
        const sid = discoveredSections.has(rawSec) ? rawSec : slugify(rawSec);
        if (sid !== 'all' && !discoveredSections.has(sid)) {
          discoveredSections.set(sid, rawSec);
        }
        secList = [sid];
      }

      const speechText = String(
        c.speechText ??
          c.speech ??
          (language.toLowerCase().startsWith('zh') ? back || front : front || back)
      ).trim();

      return {
        id: String(c.id || `card-${idx + 1}`),
        front: front || back,
        back: back || front,
        meaning,
        speechText,
        section: secList[0] || 'all',
        sections: secList.length ? secList : ['all'],
        audio: c.audio ? String(c.audio).trim() : null
      };
    })
    .filter(Boolean);

  if (!cards.length) {
    throw new Error('No valid cards found in deck.');
  }

  const sections = [{ id: 'all', label: 'All Cards' }];
  discoveredSections.forEach((label, secId) => {
    sections.push({ id: secId, label });
  });

  return {
    id,
    title,
    subtitle: String(raw.subtitle || raw.description || '').trim(),
    language,
    frontLabel,
    backLabel,
    accentSet,
    builtIn: Boolean(raw.builtIn),
    enabledModes,
    sections,
    cards
  };
}

export function getSectionCards(deck, sectionId) {
  if (!deck || !Array.isArray(deck.cards)) return [];
  if (!sectionId || sectionId === 'all') return deck.cards;
  return deck.cards.filter((card) => {
    if (Array.isArray(card.sections) && card.sections.includes(sectionId)) return true;
    return card.section === sectionId;
  });
}

export function getAllDecks(userData) {
  const result = {};
  Object.keys(BUILTIN_DECKS).forEach((id) => {
    result[id] = BUILTIN_DECKS[id];
  });
  if (userData && userData.customDecks) {
    Object.keys(userData.customDecks).forEach((id) => {
      try {
        result[id] = normalizeDeck({ ...userData.customDecks[id], id, builtIn: false });
      } catch {
        // Skip invalid custom deck
      }
    });
  }
  return result;
}
