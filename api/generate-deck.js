/* Vercel Serverless Function: Generate SRS Learning Decks using Free Chinese AI Models via OpenRouter */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const CHINESE_PREFIXES = [
  'qwen/',
  'deepseek/',
  'z-ai/',
  'thudm/',
  'moonshotai/',
  'minimax/',
  'stepfun/',
  'baichuan/',
  '01-ai/',
  'internlm/'
];

let cachedModels = null;
let cachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchFreeModels() {
  if (cachedModels && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedModels;
  }
  try {
    const res = await fetch(`${OPENROUTER_BASE}/models`, {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return cachedModels || [];
    const json = await res.json();
    const list = Array.isArray(json.data) ? json.data : [];
    const free = list.filter((m) => {
      const id = String(m.id || '');
      const promptPrice = Number(m.pricing?.prompt ?? 1);
      const compPrice = Number(m.pricing?.completion ?? 1);
      return id.endsWith(':free') || (promptPrice === 0 && compPrice === 0);
    });
    cachedModels = free;
    cachedAt = Date.now();
    return free;
  } catch {
    return cachedModels || [];
  }
}

function supportsVision(model) {
  const mods = model?.architecture?.input_modalities;
  if (Array.isArray(mods) && mods.includes('image')) return true;
  const id = String(model?.id || '').toLowerCase();
  return id.includes('vl') || id.includes('vision') || id.includes('omni');
}

function isChineseModel(modelId) {
  const lower = String(modelId || '').toLowerCase();
  return CHINESE_PREFIXES.some((p) => lower.startsWith(p));
}

function scoreModel(model, preferredFamily, needVision) {
  const id = String(model.id || '').toLowerCase();
  let score = 0;

  if (isChineseModel(id)) score += 1000;
  if (needVision && supportsVision(model)) score += 500;

  if (preferredFamily && preferredFamily !== 'auto') {
    if (preferredFamily === 'qwen' && id.startsWith('qwen/')) score += 400;
    if (preferredFamily === 'deepseek' && id.startsWith('deepseek/')) score += 400;
    if (preferredFamily === 'glm' && (id.startsWith('z-ai/') || id.startsWith('thudm/'))) score += 400;
  } else {
    // Default priority: Qwen3 / DeepSeek / GLM / Kimi
    if (id.startsWith('qwen/')) score += 260;
    else if (id.startsWith('deepseek/')) score += 250;
    else if (id.startsWith('z-ai/') || id.startsWith('thudm/')) score += 220;
    else if (id.startsWith('moonshotai/')) score += 200;
  }

  // Prefer newer/larger models
  if (id.includes('qwen3') || id.includes('r1') || id.includes('v3')) score += 80;
  if (id.includes('235b') || id.includes('72b') || id.includes('32b') || id.includes('70b')) score += 60;
  if (id.includes('coder')) score -= 40; // Prefer general/language models for study decks

  const ctx = Number(model.context_length || 0);
  score += Math.min(50, Math.floor(ctx / 8000));
  return score;
}

async function pickCandidateModels(preferredFamily, needVision) {
  const free = await fetchFreeModels();
  let pool = free.filter((m) => m.id && m.id !== 'openrouter/free');

  if (needVision) {
    const visionChinese = pool.filter((m) => isChineseModel(m.id) && supportsVision(m));
    const visionAny = pool.filter((m) => supportsVision(m));
    pool = visionChinese.length ? visionChinese : visionAny;
  } else {
    const chinesePool = pool.filter((m) => isChineseModel(m.id));
    if (chinesePool.length) pool = chinesePool;
  }

  pool.sort((a, b) => scoreModel(b, preferredFamily, needVision) - scoreModel(a, preferredFamily, needVision));

  const picks = pool.slice(0, 3).map((m) => m.id);
  picks.push('openrouter/free');
  return [...new Set(picks)];
}

function buildSystemPrompt({ language, enabledModes }) {
  const langHint =
    language && language !== 'auto'
      ? `The target study language is "${language}".`
      : 'Auto-detect the best BCP-47 language code (e.g. "zh-CN", "es-ES", "fr-FR", "de-DE", "ja-JP", "ko-KR", "en-US") from the user prompt and uploaded content.';

  return `You are an expert flashcard & spaced-repetition (SRS) curriculum designer for the "SRS Learning" app.
Your job is to create a high-quality, accurate study deck from the user's request and any uploaded files (text, PDFs, slides, docs, or photos/screenshots of notes/textbooks).

${langHint}

CRITICAL OUTPUT RULES:
1. Return ONLY a single valid JSON object (no markdown fences, no commentary before or after).
2. Follow this exact JSON schema:
{
  "title": "Short descriptive deck title",
  "subtitle": "Brief 1-line description of what this deck covers",
  "language": "BCP-47 code such as zh-CN, es-ES, fr-FR, de-DE, ja-JP, ko-KR, en-US",
  "frontLabel": "Short label for front (e.g. Pinyin, Spanish, Term, Question)",
  "backLabel": "Short label for back (e.g. Hanzi, English, Definition, Answer)",
  "accentSet": "One of: pinyin, spanish, french, german, portuguese, european, none",
  "enabledModes": {
    "flashcard": ${enabledModes?.flashcard !== false},
    "spelling": ${enabledModes?.spelling !== false},
    "speaking": ${enabledModes?.speaking !== false},
    "reverse": ${enabledModes?.reverse !== false}
  },
  "sections": [
    { "id": "section-slug", "label": "Section Display Name" }
  ],
  "cards": [
    {
      "id": "card-1",
      "front": "Prompt side",
      "back": "Answer side",
      "meaning": "English translation, context, or helpful note (empty string if not needed)",
      "speechText": "Exact text to pronounce out loud in the target language",
      "section": "section-slug"
    }
  ]
}

LANGUAGE-SPECIFIC QUALITY RULES:
- For Chinese (zh-CN):
  - "frontLabel": "Pinyin", "backLabel": "Hanzi", "accentSet": "pinyin".
  - "front" MUST be accurate tone-marked pinyin (e.g. "jiātíng", "nǚ'ér", "xuéxí").
  - "back" MUST be simplified Chinese Hanzi (e.g. "家庭", "女儿", "学习").
  - "meaning" MUST be clear English meaning.
  - "speechText" MUST be the Hanzi.
- For other languages (Spanish, French, German, Japanese, etc.):
  - Include accurate accent marks / scripts and set "speechText" to the target language word/phrase.
- For general subjects (Biology, History, Math, etc.):
  - "front" = concise term/question, "back" = concise answer/definition, "meaning" = brief extra memory hint if helpful.
- Group cards into 2–5 clean sections when there are 10+ cards, or 1 section if small.
- Extract ALL relevant vocabulary/items from uploaded materials without inventing fake facts. If the user only gave a topic (no files), create 15–25 well-structured, practical cards unless they asked for a specific number.`;
}

function extractJsonObject(rawText) {
  let cleaned = String(rawText || '').trim();
  // Strip <think>...</think> blocks from reasoning models (DeepSeek R1, Qwen3)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Strip markdown code fences if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  // Extract outermost JSON object
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('AI response did not contain valid JSON.');
  }
  const slice = cleaned.slice(firstBrace, lastBrace + 1);
  return JSON.parse(slice);
}

export default async function handler(req, res) {
  // CORS / health check
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      serverKeyConfigured: Boolean(process.env.OPENROUTER_API_KEY)
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const apiKey = (process.env.OPENROUTER_API_KEY || body.clientApiKey || '').trim();

  if (!apiKey) {
    return res.status(400).json({
      error:
        'No OpenRouter API key configured. Add OPENROUTER_API_KEY in Vercel Environment Variables (free at openrouter.ai/keys) or paste a personal key below.'
    });
  }

  const prompt = String(body.prompt || '').trim();
  const extractedText = String(body.extractedText || '').trim().slice(0, 40000);
  const images = Array.isArray(body.images) ? body.images.slice(0, 6) : [];
  const language = String(body.language || 'auto');
  const enabledModes = body.enabledModes || {
    flashcard: true,
    spelling: true,
    speaking: true,
    reverse: true
  };
  const preferredFamily = String(body.preferredFamily || 'auto');

  if (!prompt && !extractedText && !images.length) {
    return res.status(400).json({
      error: 'Please enter a topic/instructions or upload at least one file.'
    });
  }

  const userParts = [];
  let textPayload = '';
  if (prompt) textPayload += `USER REQUEST:\n${prompt}\n\n`;
  if (extractedText) textPayload += `UPLOADED FILE CONTENT:\n${extractedText}\n\n`;
  if (!prompt && (extractedText || images.length)) {
    textPayload += 'Extract the key study terms/concepts from the uploaded material and turn them into a clean SRS deck.\n';
  }
  userParts.push({ type: 'text', text: textPayload.trim() });

  for (const img of images) {
    if (img && typeof img.dataUrl === 'string' && img.dataUrl.startsWith('data:image/')) {
      userParts.push({
        type: 'image_url',
        image_url: { url: img.dataUrl }
      });
    }
  }

  const candidates = await pickCandidateModels(preferredFamily, images.length > 0);
  const systemPrompt = buildSystemPrompt({ language, enabledModes });

  let lastError = 'All free AI models were temporarily busy. Please try again in a moment.';

  for (const modelId of candidates) {
    try {
      const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': req.headers?.origin || 'https://srs-learning-app.vercel.app',
          'X-Title': 'SRS Learning'
        },
        body: JSON.stringify({
          model: modelId,
          temperature: 0.3,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: images.length > 0 ? userParts : textPayload.trim() }
          ]
        })
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        lastError = json?.error?.message || `Provider error (${response.status})`;
        // If auth failed (401/403), don't retry other models
        if (response.status === 401 || response.status === 403) {
          return res.status(response.status).json({ error: lastError });
        }
        continue;
      }

      const content = json?.choices?.[0]?.message?.content;
      if (!content) {
        lastError = 'Model returned an empty response.';
        continue;
      }

      const deck = extractJsonObject(content);
      if (!deck || !Array.isArray(deck.cards) || !deck.cards.length) {
        lastError = 'Model returned JSON without cards.';
        continue;
      }

      return res.status(200).json({
        deck,
        modelUsed: json.model || modelId
      });
    } catch (err) {
      lastError = err?.message || 'Failed to parse AI deck output.';
    }
  }

  return res.status(502).json({ error: lastError });
}
