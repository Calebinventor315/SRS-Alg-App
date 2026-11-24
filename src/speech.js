/* Voice Recording, Reference Audio Playback (Bundled or TTS), & Pronunciation Verification */
import { getAudioBlob } from './audioStore.js';
import { parsePinyin } from './pinyin.js';

const SpeechRecognitionCtor =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition || null
    : null;

export const isSpeechRecognitionSupported = Boolean(SpeechRecognitionCtor);
export const isMediaRecorderSupported =
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
  typeof MediaRecorder !== 'undefined';

let activeAudioEl = null;

export function stopPlayback() {
  if (activeAudioEl) {
    activeAudioEl.pause();
    activeAudioEl.currentTime = 0;
    activeAudioEl = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Play reference pronunciation:
 * 1) If the card has a bundled audio file in IndexedDB (from a .zip deck), play it.
 * 2) Otherwise speak card.speechText (or card.back) using browser SpeechSynthesis in deck.language.
 */
export async function playReferenceAudio(card, deck, { slow = false } = {}) {
  stopPlayback();

  if (card && card.audio && deck && deck.id) {
    const blob = await getAudioBlob(deck.id, card.audio);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = slow ? 0.75 : 1.0;
      activeAudioEl = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => URL.revokeObjectURL(url);
      await audio.play();
      return { source: 'bundled' };
    }
  }

  if (typeof window === 'undefined' || !window.speechSynthesis) {
    throw new Error('Speech playback is not supported in this browser.');
  }

  const text = (card && (card.speechText || card.back || card.front)) || '';
  if (!text) return { source: 'none' };

  const lang = (deck && deck.language) || 'zh-CN';
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = slow ? 0.68 : 0.92;

  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length) {
    const langPrefix = lang.toLowerCase().split('-')[0];
    const exactVoice =
      voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
    if (exactVoice) utterance.voice = exactVoice;
  }

  window.speechSynthesis.speak(utterance);
  return { source: 'tts' };
}

export function playAudioUrl(url) {
  if (!url) return;
  stopPlayback();
  const audio = new Audio(url);
  activeAudioEl = audio;
  audio.play().catch(() => {});
}

/* ==================== Speech Verification Engine ==================== */

function cleanTextForCompare(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[\s.,!?¿¡，。！？、;；:：'’‘"“”\-_()（）\[\]【】]/g, '');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = levenshtein(a, b);
  return Math.max(0, 1 - dist / Math.max(a.length, b.length));
}

/**
 * Verify spoken transcripts (from SpeechRecognition alternatives) against the target card.
 * @param {string[]} transcripts
 * @param {{ front?: string, back?: string, speechText?: string }} card
 * @param {{ language?: string } | null} deck
 * @returns {{ status: 'match' | 'close' | 'mismatch' | 'no-speech', score: number, heard: string, target: string, isCorrect: boolean }}
 */
export function verifySpokenAnswer(transcripts, card, deck = null) {
  const target = String(card.speechText || card.back || card.front || '').trim();
  const cleanTarget = cleanTextForCompare(target);
  const cleanFront = cleanTextForCompare(card.front || '');
  const frontPinyinPlain = parsePinyin(card.front || '').plain;

  const validTranscripts = (transcripts || []).map((t) => String(t || '').trim()).filter(Boolean);
  if (!validTranscripts.length) {
    return {
      status: 'no-speech',
      score: 0,
      heard: '',
      target,
      isCorrect: false
    };
  }

  let bestScore = 0;
  let bestHeard = validTranscripts[0];

  for (const raw of validTranscripts) {
    const cleaned = cleanTextForCompare(raw);
    if (!cleaned) continue;

    // 1. Direct exact or substring match against target
    let score = 0;
    if (cleaned === cleanTarget || (cleanTarget && cleaned.includes(cleanTarget))) {
      score = 1;
    } else {
      score = similarity(cleaned, cleanTarget);
    }

    // 2. Also compare against front (useful for non-Chinese decks or pinyin transcripts)
    if (cleanFront) {
      const frontScore =
        cleaned === cleanFront ? 1 : similarity(cleaned, cleanFront);
      if (frontScore > score) score = frontScore;
    }

    // 3. If speech recognition returned Latin/pinyin letters for a Chinese deck
    if (deck && String(deck.language || '').toLowerCase().startsWith('zh') && frontPinyinPlain) {
      const heardPinyin = parsePinyin(raw).plain;
      if (heardPinyin) {
        const pScore = similarity(heardPinyin, frontPinyinPlain);
        if (pScore > score) score = pScore;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestHeard = raw;
    }
  }

  const pct = Math.round(bestScore * 100);
  if (pct >= 80) {
    return { status: 'match', score: pct, heard: bestHeard, target, isCorrect: true };
  }
  if (pct >= 50) {
    return { status: 'close', score: pct, heard: bestHeard, target, isCorrect: false };
  }
  return { status: 'mismatch', score: pct, heard: bestHeard, target, isCorrect: false };
}

/* ==================== Live Recorder Session ==================== */

/**
 * Starts simultaneous voice recording (MediaRecorder) + SpeechRecognition.
 * Returns a controller with `.stop()`.
 */
export async function startSpeakingSession({ lang = 'zh-CN', onInterim, onComplete, onError }) {
  stopPlayback();

  let mediaStream = null;
  let mediaRecorder = null;
  let recognition = null;
  const audioChunks = [];
  const finalTranscripts = new Set();
  let lastInterim = '';
  let stopped = false;
  let recorderStopped = !isMediaRecorderSupported;
  let recognitionStopped = !isSpeechRecognitionSupported;
  let recordedUrl = null;

  function maybeFinish() {
    if (!stopped) return;
    if (!recorderStopped || !recognitionStopped) return;

    const list = Array.from(finalTranscripts);
    if (!list.length && lastInterim.trim()) {
      list.push(lastInterim.trim());
    }
    if (onComplete) {
      onComplete({
        audioUrl: recordedUrl,
        transcripts: list,
        recognitionAvailable: isSpeechRecognitionSupported
      });
    }
  }

  // 1. Start MediaRecorder for user playback
  if (isMediaRecorderSupported) {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(mediaStream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        if (audioChunks.length) {
          const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          recordedUrl = URL.createObjectURL(blob);
        }
        if (mediaStream) {
          mediaStream.getTracks().forEach((t) => t.stop());
          mediaStream = null;
        }
        recorderStopped = true;
        maybeFinish();
      };
      mediaRecorder.start();
    } catch (err) {
      if (onError) {
        onError(
          err?.name === 'NotAllowedError'
            ? 'Microphone permission denied. Allow microphone access to record.'
            : 'Could not access microphone.'
        );
      }
      return null;
    }
  }

  // 2. Start Web Speech Recognition for automatic verification
  if (isSpeechRecognitionSupported) {
    try {
      recognition = new SpeechRecognitionCtor();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            for (let k = 0; k < res.length; k++) {
              const t = res[k]?.transcript?.trim();
              if (t) finalTranscripts.add(t);
            }
          } else {
            interim += res[0]?.transcript || '';
          }
        }
        if (interim.trim()) {
          lastInterim = interim.trim();
          if (onInterim) onInterim(lastInterim);
        } else if (finalTranscripts.size && onInterim) {
          onInterim(Array.from(finalTranscripts)[0]);
        }
      };

      recognition.onerror = () => {
        // Don't fail the whole recording if speech recognition had no-speech or network hiccup
      };

      recognition.onend = () => {
        recognitionStopped = true;
        if (!stopped) {
          // Speech recognition naturally ended after user finished speaking -> stop recorder too
          stop();
        } else {
          maybeFinish();
        }
      };

      recognition.start();
    } catch {
      recognitionStopped = true;
    }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    if (recognition && !recognitionStopped) {
      try {
        recognition.stop();
      } catch {
        recognitionStopped = true;
      }
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch {
        recorderStopped = true;
      }
    } else {
      recorderStopped = true;
    }
    maybeFinish();
  }

  return { stop };
}
