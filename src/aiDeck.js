/* Frontend AI Deck Generator Client (Vercel /api/generate-deck + Local OpenRouter Fallback) */
import { normalizeDeck } from './decks.js';

const LOCAL_KEY_STORAGE = 'srs_learning_openrouter_key';

export function getSavedOpenRouterKey() {
  try {
    return localStorage.getItem(LOCAL_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function saveOpenRouterKey(key) {
  try {
    const trimmed = String(key || '').trim();
    if (trimmed) localStorage.setItem(LOCAL_KEY_STORAGE, trimmed);
    else localStorage.removeItem(LOCAL_KEY_STORAGE);
  } catch {
    // Ignore
  }
}

export async function checkServerAiStatus() {
  try {
    const res = await fetch('/api/generate-deck', { method: 'GET' });
    if (!res.ok) return { endpointAvailable: false, serverKeyConfigured: false };
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return { endpointAvailable: false, serverKeyConfigured: false };
    }
    const json = await res.json();
    return {
      endpointAvailable: true,
      serverKeyConfigured: Boolean(json.serverKeyConfigured)
    };
  } catch {
    return { endpointAvailable: false, serverKeyConfigured: false };
  }
}

async function generateDirectViaOpenRouter({
  apiKey,
  prompt,
  language,
  enabledModes,
  extractedText,
  images
}) {
  const userParts = [];
  let textPayload = '';
  if (prompt) textPayload += `USER REQUEST:\n${prompt}\n\n`;
  if (extractedText) textPayload += `UPLOADED FILE CONTENT:\n${extractedText.slice(0, 35000)}\n\n`;
  if (!prompt && (extractedText || images.length)) {
    textPayload += 'Extract the key study terms/concepts from the uploaded material and turn them into a clean SRS deck.\n';
  }
  userParts.push({ type: 'text', text: textPayload.trim() });
  for (const img of images.slice(0, 6)) {
    userParts.push({ type: 'image_url', image_url: { url: img.dataUrl } });
  }

  const systemPrompt = `Return ONLY a single valid JSON object (no markdown fences) for an SRS deck:
{
  "title": "Deck Title",
  "subtitle": "Short description",
  "language": "${language && language !== 'auto' ? language : 'zh-CN or detected BCP-47'}",
  "frontLabel": "Pinyin / Front",
  "backLabel": "Hanzi / Back",
  "accentSet": "pinyin | spanish | french | german | portuguese | european | none",
  "enabledModes": ${JSON.stringify(enabledModes)},
  "sections": [{ "id": "sec-1", "label": "Section 1" }],
  "cards": [{ "id": "c-1", "front": "...", "back": "...", "meaning": "...", "speechText": "...", "section": "sec-1" }]
}
For Chinese: front = tone-marked pinyin, back = simplified hanzi, meaning = English, speechText = hanzi, accentSet = "pinyin".`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'SRS Learning'
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: images.length ? userParts : textPayload.trim() }
      ]
    })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || `OpenRouter error (${res.status})`);
  }

  let content = String(json?.choices?.[0]?.message?.content || '').trim();
  content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) content = fence[1].trim();
  const s = content.indexOf('{');
  const e = content.lastIndexOf('}');
  if (s === -1 || e <= s) throw new Error('AI response did not contain valid JSON.');

  const rawDeck = JSON.parse(content.slice(s, e + 1));
  return {
    deck: normalizeDeck({ ...rawDeck, builtIn: false }),
    modelUsed: json.model || 'openrouter/free'
  };
}

/**
 * Generate a normalized SRS deck using our Vercel endpoint (or direct OpenRouter in local dev).
 */
export async function generateAiDeck({
  prompt,
  language,
  enabledModes,
  preferredFamily,
  extractedText,
  images,
  clientApiKey
}) {
  const payload = {
    prompt,
    language,
    enabledModes,
    preferredFamily,
    extractedText,
    images,
    clientApiKey
  };

  try {
    const res = await fetch('/api/generate-deck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `AI request failed (${res.status})`);
      }
      return {
        deck: normalizeDeck({ ...json.deck, builtIn: false }),
        modelUsed: json.modelUsed || 'openrouter/free'
      };
    }
  } catch (err) {
    // If the server explicitly returned an API error, rethrow it
    if (err && err.message && !err.message.includes('Failed to fetch')) {
      // Only fall back to direct OpenRouter when /api/generate-deck is unavailable (local vite dev)
      const status = await checkServerAiStatus();
      if (status.endpointAvailable) throw err;
    }
  }

  // Fallback for local `npm run dev` (Vite doesn't execute Vercel /api routes)
  if (!clientApiKey) {
    throw new Error(
      'In local dev mode, paste a free OpenRouter API key (openrouter.ai/keys) under API Key Settings, or deploy to Vercel with OPENROUTER_API_KEY set.'
    );
  }

  return generateDirectViaOpenRouter({
    apiKey: clientApiKey,
    prompt,
    language,
    enabledModes,
    extractedText,
    images
  });
}
