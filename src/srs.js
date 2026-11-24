/* Queue-Based SRS Engine */

export const WORKING_SET_SIZE = 10;

function makeUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createDeckCards(rawCards) {
  return rawCards.map((item) => ({
    uuid: makeUuid(),
    id: item.id || null,
    front: item.front ?? item.pinyin ?? '',
    back: item.back ?? item.hanzi ?? '',
    meaning: item.meaning ?? item.english ?? '',
    speechText: item.speechText ?? item.back ?? item.hanzi ?? item.front ?? '',
    audio: item.audio || null,
    section: item.section || 'all',
    correct: 0
  }));
}

export function step(cards, isRight, multiplier) {
  if (!cards.length) return { cards, movedUuid: null };
  const next = cards.map((c) => ({ ...c }));
  const card = next.shift();
  const workingEndIdx = Math.min(WORKING_SET_SIZE - 1, next.length);
  let targetIdx = workingEndIdx;

  if (isRight) {
    card.correct += 1;
    if (card.correct % 3 === 0) {
      const jump = Math.max(1, Math.round(card.correct * multiplier));
      targetIdx = Math.min(next.length, workingEndIdx + jump);
    }
  } else {
    card.correct = 0;
  }

  next.splice(targetIdx, 0, card);
  return { cards: next, movedUuid: card.uuid };
}
