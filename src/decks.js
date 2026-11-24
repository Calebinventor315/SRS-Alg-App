/* Unit 4 Vocabulary Decks — Edit or add decks here */

const SET_1 = [
  { pinyin: 'jiātíng', hanzi: '家庭', english: 'family' },
  { pinyin: 'kǒu', hanzi: '口', english: '[measure word for people]' },
  { pinyin: 'bàba', hanzi: '爸爸', english: 'dad' },
  { pinyin: 'māma', hanzi: '妈妈', english: 'mom' },
  { pinyin: 'gēge', hanzi: '哥哥', english: 'older brother' },
  { pinyin: 'dìdi', hanzi: '弟弟', english: 'younger brother' },
  { pinyin: 'jiějie', hanzi: '姐姐', english: 'older sister' },
  { pinyin: 'mèimei', hanzi: '妹妹', english: 'younger sister' }
];

const SET_2 = [
  { pinyin: 'āyí', hanzi: '阿姨', english: 'aunt (maternal, younger than mom)' },
  { pinyin: 'shūshu', hanzi: '叔叔', english: 'paternal uncle (younger than dad)' },
  { pinyin: 'biǎodì', hanzi: '表弟', english: 'maternal male cousin (younger)' },
  { pinyin: 'biǎomèi', hanzi: '表妹', english: 'maternal female cousin (younger)' },
  { pinyin: 'yéye', hanzi: '爷爷', english: 'grandpa (paternal)' },
  { pinyin: 'nǎinai', hanzi: '奶奶', english: 'grandma (paternal)' },
  { pinyin: 'sūnzi', hanzi: '孙子', english: 'grandson (paternal)' },
  { pinyin: 'sūnnǚ', hanzi: '孙女', english: 'granddaughter (paternal)' }
];

const SET_3 = [
  { pinyin: 'zhàngfu', hanzi: '丈夫', english: 'husband' },
  { pinyin: 'qīzi', hanzi: '妻子', english: 'wife' },
  { pinyin: 'érzi', hanzi: '儿子', english: 'son' },
  { pinyin: "nǚ'ér", hanzi: '女儿', english: 'daughter' },
  { pinyin: "yīng'ér", hanzi: '婴儿', english: 'baby' },
  { pinyin: 'jiéhūn', hanzi: '结婚', english: 'get married' }
];

const SET_4 = [
  { pinyin: 'péngyǒu', hanzi: '朋友', english: 'friend' },
  { pinyin: 'nánhái', hanzi: '男孩', english: 'boy' },
  { pinyin: 'nǚhái', hanzi: '女孩', english: 'girl' },
  { pinyin: 'háizi', hanzi: '孩子', english: 'child' },
  { pinyin: 'xiānsheng', hanzi: '先生', english: 'Mr.' },
  { pinyin: 'nǚshì', hanzi: '女士', english: 'Mrs.' },
  { pinyin: 'nánrén', hanzi: '男人', english: 'man' },
  { pinyin: 'nǚrén', hanzi: '女人', english: 'woman' }
];

const MEASURE_GRAMMAR = [
  { pinyin: 'ge', hanzi: '个', english: 'general measure word for people' },
  { pinyin: 'wèi', hanzi: '位', english: 'polite measure word for people' },
  { pinyin: 'kǒu', hanzi: '口', english: 'measure word for family members' },
  { pinyin: 'ma', hanzi: '吗', english: 'yes/no question particle' }
];

const PHRASES = [
  { pinyin: 'nǚpéngyǒu', hanzi: '女朋友', english: 'girlfriend' },
  { pinyin: 'huí jiā', hanzi: '回家', english: 'to go back home' },
  { pinyin: 'wèishénme', hanzi: '为什么', english: 'why?' },
  { pinyin: 'yīnggāi huì', hanzi: '应该会', english: 'should be' },
  { pinyin: 'shùxué bǐsài', hanzi: '数学比赛', english: 'math competition' },
  { pinyin: 'dé le', hanzi: '得了', english: 'got / won' },
  { pinyin: 'dì èr míng', hanzi: '第二名', english: 'second place' },
  { pinyin: 'liù gè yuè', hanzi: '六个月', english: 'six months' },
  { pinyin: 'xìngfú', hanzi: '幸福', english: 'happy' },
  { pinyin: 'qǐng wèn', hanzi: '请问', english: 'excuse me / may I ask' },
  { pinyin: 'dìtiě', hanzi: '地铁', english: 'subway' },
  { pinyin: 'zěnme zǒu', hanzi: '怎么走', english: 'how to get to' },
  { pinyin: 'hěn máng', hanzi: '很忙', english: 'very busy' },
  { pinyin: 'shēngrì', hanzi: '生日', english: 'birthday' },
  { pinyin: 'duōdà', hanzi: '多大', english: 'how old' },
  { pinyin: 'shēntǐ', hanzi: '身体', english: 'body / health' },
  { pinyin: 'jiànkāng', hanzi: '健康', english: 'healthy' },
  { pinyin: 'quán jiā zhào', hanzi: '全家照', english: 'family photo' },
  { pinyin: 'shuài', hanzi: '帅', english: 'handsome' },
  { pinyin: 'wēnróu', hanzi: '温柔', english: 'gentle' },
  { pinyin: 'fēnshǒu', hanzi: '分手', english: 'break up' },
  { pinyin: 'zhōumò', hanzi: '周末', english: 'weekend' },
  { pinyin: 'kàn diànyǐng', hanzi: '看电影', english: 'watch a movie' },
  { pinyin: 'jiārén', hanzi: '家人', english: 'family members' },
  { pinyin: 'běn', hanzi: '本', english: 'measure word for books' },
  { pinyin: 'zhāng', hanzi: '张', english: 'measure word for flat objects' },
  { pinyin: 'zhī', hanzi: '支', english: 'measure word for stick-like objects' },
  { pinyin: 'yǐjīng', hanzi: '已经', english: 'already' },
  { pinyin: 'shēng bìng', hanzi: '生病', english: 'get sick' },
  { pinyin: 'cānjiā', hanzi: '参加', english: 'attend / participate in' },
  { pinyin: 'hūnlǐ', hanzi: '婚礼', english: 'wedding' },
  { pinyin: 'guò shēngrì', hanzi: '过生日', english: 'celebrate a birthday' }
];

// Combine without duplicating 口
const WHOLE = SET_1.concat(
  SET_2,
  SET_3,
  SET_4,
  MEASURE_GRAMMAR.filter((item) => item.hanzi !== '口'),
  PHRASES
);

export const SRS_DECKS = {
  whole: {
    id: 'whole',
    title: 'Whole Unit 4',
    subtitle: 'Complete vocabulary & dialogue phrases',
    label: `Whole Unit 4 (${WHOLE.length})`,
    cards: WHOLE
  },
  set1: {
    id: 'set1',
    title: 'Set 1 · Immediate Family',
    subtitle: 'Parents, siblings, and family',
    label: `Set 1 · Immediate Family (${SET_1.length})`,
    cards: SET_1
  },
  set2: {
    id: 'set2',
    title: 'Set 2 · Extended Family',
    subtitle: 'Aunts, uncles, cousins, grandparents',
    label: `Set 2 · Extended Family (${SET_2.length})`,
    cards: SET_2
  },
  set3: {
    id: 'set3',
    title: 'Set 3 · Marriage & Children',
    subtitle: 'Spouses, children, and getting married',
    label: `Set 3 · Marriage & Children (${SET_3.length})`,
    cards: SET_3
  },
  set4: {
    id: 'set4',
    title: 'Set 4 · People & Friends',
    subtitle: 'Friends, boys, girls, and titles',
    label: `Set 4 · People & Friends (${SET_4.length})`,
    cards: SET_4
  },
  measure: {
    id: 'measure',
    title: 'Measure Words & Grammar',
    subtitle: 'Core classifiers and particles',
    label: `Measure Words & Grammar (${MEASURE_GRAMMAR.length})`,
    cards: MEASURE_GRAMMAR
  },
  phrases: {
    id: 'phrases',
    title: 'Glossed & Dialogue Phrases',
    subtitle: 'Everyday expressions and sentences',
    label: `Glossed & Dialogue Phrases (${PHRASES.length})`,
    cards: PHRASES
  }
};
