import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env then .env.local (local overrides)
async function loadEnvFile(filename) {
  try {
    const env = await readFile(path.join(__dirname, filename), 'utf-8');
    for (const line of env.split('\n')) {
      const trimmed = line.trim().replace(/^﻿/, '');
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  } catch {}
}
await loadEnvFile('.env');
await loadEnvFile('.env.local');

function arg(name, fallback = null) {
  const a = process.argv.slice(2).find(x => x.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : fallback;
}

function slugify(value) {
  return String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const inputPath = arg('input');
const format    = arg('format', 'vertical');
const title     = arg('title', 'Video');
const imagePath = arg('image');

if (!inputPath) {
  console.error('Uso: node parse-script.mjs --input scripts/copione.txt [--format vertical|horizontal] [--title "Titolo"] [--image img.jpg]');
  process.exit(1);
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey || apiKey.startsWith('sk-or-...')) {
  console.error('Errore: OPENROUTER_API_KEY non configurata.');
  process.exit(1);
}

const PEXELS_KEY      = process.env.PEXELS_API_KEY;
const PIXABAY_KEY     = process.env.PIXABAY_API_KEY;
const APIFY_TOKEN     = process.env.APIFY_API_TOKEN;
const VECTEEZY_ID     = process.env.VECTEEZY_API_ID;
const VECTEEZY_SECRET = process.env.VECTEEZY_API_SECRET;
const MODEL           = 'anthropic/claude-sonnet-4-5';
const BASE_URL     = 'https://openrouter.ai/api/v1/chat/completions';

const scriptText      = await readFile(path.resolve(__dirname, inputPath), 'utf-8');
const wordCount       = scriptText.trim().split(/\s+/).length;
const estimatedDuration = Math.round(wordCount / 2.2);

console.log(`Copione: ${wordCount} parole → durata stimata ~${estimatedDuration}s`);

// ─── System prompt ────────────────────────────────────────────────────────────

const LOTTIE_CONCEPTS = [
  'neural-network','robot','brain','data-flow','chart-growth','globe',
  'code-terminal','warning','rocket','idea','lock-security','settings',
  'check-success','clock','analytics','ai-processing','machine-learning','network-nodes',
];

// Known brand → official interface URL (force screenshot scene)
// Public-facing landing pages (no login required — thum.io can capture them)
const BRAND_URLS = {
  'chatgpt':    { url: 'https://openai.com/chatgpt',       label: 'ChatGPT' },
  'openai':     { url: 'https://openai.com',               label: 'OpenAI' },
  'gpt':        { url: 'https://openai.com/chatgpt',       label: 'ChatGPT' },
  'claude':     { url: 'https://www.anthropic.com/claude', label: 'Claude AI' },
  'anthropic':  { url: 'https://www.anthropic.com',        label: 'Anthropic' },
  'gemini':     { url: 'https://deepmind.google/gemini',   label: 'Google Gemini' },
  'deepseek':   { url: 'https://www.deepseek.com',         label: 'DeepSeek' },
  'llama':      { url: 'https://ai.meta.com/llama',        label: 'Meta LLaMA' },
  'midjourney': { url: 'https://www.midjourney.com',       label: 'Midjourney' },
  'perplexity': { url: 'https://www.perplexity.ai',        label: 'Perplexity' },
  'github':     { url: 'https://github.com',               label: 'GitHub' },
  'huggingface':{ url: 'https://huggingface.co',           label: 'Hugging Face' },
};

const SYSTEM_PROMPT = `Sei un esperto di motion graphics e video marketing. Trasformi copioni testuali in strutture JSON per video animati senza voce, ricchi di contenuto visivo.

FILOSOFIA VISIVA — REGOLA ASSOLUTA:
- NON ESISTE una scena solo testo. Ogni scena DEVE avere un'animazione visiva principale.
- Le immagini e i video REALI comunicano il concetto PRIMA che il testo venga letto — dominano il video
- Il testo è un complemento, non il protagonista — poche parole, GRANDI visual animati
- "highlight" è PROIBITO per testo descrittivo — usalo SOLO per simboli numerici (es. "10x", "87%", "→", "∞")

BRAND NOTI — REGOLA CRITICA:
Quando il copione menziona brand AI noti, usa "brand" per mostrare la loro interfaccia animata:
- ChatGPT / OpenAI / GPT → type: "brand", visual: { "kind": "brand-chat", "brand": "chatgpt", "prompt": "...", "response": "..." }
- Claude / Anthropic → brand: "claude"
- Gemini / Google AI → brand: "gemini"
- DeepSeek → brand: "deepseek"
- Meta AI / LLaMA → brand: "meta"
- Perplexity → brand: "perplexity"
Per "prompt" usa una domanda breve (max 10 parole) dal contesto del copione.
Per "response" usa una risposta breve e pertinente (max 15 parole).
NON usare "image" o "screenshot" per questi brand — "brand" mostra l'interfaccia reale animata.

QUOTA CONTENUTI REALI — REGOLA CRITICA:
- ALMENO il 35% delle scene deve usare "image", "screenshot" o "video"
- Per immagini usa query SPECIFICHE e contestuali, NON generiche:
  ✗ SBAGLIATO: "AI technology computer"
  ✓ GIUSTO: "NVIDIA GPU server farm training deep learning datacenter"
  ✓ GIUSTO: "researchers scientists working machine learning lab Stanford"
  ✓ GIUSTO: "open source developers GitHub collaboration coding remote team"
- "video" è per scene dinamiche: usa clip brevi di persone al lavoro, server, coding, prodotti in azione

REGOLE FONDAMENTALI:
- Restituisci SOLO JSON valido, senza markdown, senza backtick
- 8-12 scene totali
- headline: massimo 4 parole
- subtext: massimo 8 parole, solo se aggiunge valore
- I timing devono essere contigui (end scena N = start scena N+1)
- Durata totale ≈ parole / 2.2 secondi
- OGNI scena deve avere "bgLottie" con il concept lottie più adatto

TIPI SCENA:

1. title — apertura con emoji grande
   visual: { "kind": "icon", "emoji": "🚀" }

2. image — foto reale (persona, luogo, prodotto, hardware, team)
   visual: { "kind": "photo", "wikipedia": "NVIDIA", "query": "NVIDIA GPU A100 server data center training" }
   → wikipedia: slug Wikipedia EN opzionale per soggetti specifici
   → query: descrizione SPECIFICA per Pexels (en, 3-7 parole descrittive del soggetto esatto)

3. screenshot — interfaccia reale di un servizio/sito
   visual: { "kind": "browser", "url": "https://chat.openai.com", "label": "ChatGPT" }
   → OBBLIGATORIO per tutti i brand AI noti (vedi lista sopra)

4. video — clip video breve per scene dinamiche (team, server, coding, prodotto in azione)
   visual: { "kind": "clip", "query": "software developers coding office team collaboration" }
   → query: descrizione in inglese per Pexels Videos (max 5-6 parole, soggetto specifico)
   → usa per 1-3 scene per video, non di più

5. lottie — animazione 3D per concetti astratti
   visual: { "kind": "lottie", "concept": "neural-network" }
   → concept uno di: ${LOTTIE_CONCEPTS.join(', ')}

6. stat — numero animato
   visual: { "kind": "counter", "from": 0, "to": 95, "suffix": "%", "label": "Label breve" }

7. list — elenco con emoji
   visual: { "kind": "list", "items": [{ "icon": "✅", "text": "Breve" }] }

8. comparison — split screen A vs B
   visual: { "kind": "comparison", "left": { "label": "Prima", "icon": "❌" }, "right": { "label": "Dopo", "icon": "✅" }, "verdict": "right" }

9. flow — processo sequenziale
   visual: { "kind": "flow", "steps": [{ "icon": "📝", "label": "Step" }] }

10. highlight — SOLO per numeri/simboli grandi (10x, 87%, →, ∞, #1)
    visual: { "kind": "big-text", "text": "10x" }

11. code — terminale/CLI/snippet
    visual: { "kind": "code", "lines": ["$ comando", "→ output"] }

12. chat — conversazione animata con AI
    visual: { "kind": "chat", "messages": [
      { "role": "user", "text": "Come funziona?" },
      { "role": "ai", "text": "Elabora token uno alla volta." }
    ]}
    → max 2 messaggi, testi corti (max 12 parole)

13. outro — CTA finale
    visual: { "kind": "icon", "emoji": "🎯" }

TIMING:
- title/highlight/outro: 4-6s
- image/screenshot/video/lottie: 6-10s
- stat/comparison: 5-7s
- flow/list/code/chat: 7-10s

EMOJI consigliati: 🤖 ⚙️ 🚀 💻 📊 🐙 🔧 📣 ✅ ❌ 💡 🎯 📈 ⚡ 🎨 🔑 💰 ⏱️ 🧩 🛠️ 📝 🔄 🌐 🎬 👥 💬 📱 🔥 ✨ 🧠 🔬 ⚖️

CAMPO bgLottie (OBBLIGATORIO per title/stat/list/comparison/flow/highlight/code/outro):
Scegli il concept lottie più adatto tra: ${LOTTIE_CONCEPTS.join(', ')}
- AI/machine learning → "ai-processing" o "neural-network"
- dati/crescita → "data-flow" o "chart-growth"
- processo/config → "settings" o "network-nodes"
- successo → "check-success"
- velocità/lancio → "rocket"
- sicurezza → "lock-security"
- tempo → "clock"
- robot/automazione → "robot"
- codice/terminal → "code-terminal"
- idea/innovazione → "idea"
- globale → "globe"
- cervello/pensiero → "brain"
- attenzione → "warning"

SCHEMA OUTPUT:
{
  "title": "string",
  "format": "vertical|horizontal",
  "scenes": [
    {
      "start": 0, "end": 6,
      "type": "lottie",
      "bg": "#colore_opzionale",
      "headline": "Max 4 parole",
      "subtext": "Opzionale max 8 parole",
      "visual": { "kind": "lottie", "concept": "ai-processing" },
      "bgLottie": "neural-network"
    }
  ]
}`;

// ─── AI call ──────────────────────────────────────────────────────────────────

const userContent = [
  {
    type: 'text',
    text: `COPIONE (${wordCount} parole, ~${estimatedDuration}s):
---
${scriptText}
---

Formato: ${format}
Titolo: ${title}
${imagePath ? '\nAnalizza anche l\'immagine allegata. Estrarre concetti, dati e metafore visive per arricchire le scene.' : ''}

Genera il JSON. RICORDA: almeno il 35% delle scene deve essere "image" con foto reali. Distribuisci le immagini durante tutto il video, non solo all'inizio. Usa "image" per ogni fase/concetto importante del copione — non limitarti a emoji e testo.`,
  }
];

if (imagePath) {
  const imgPath = path.resolve(__dirname, imagePath);
  if (existsSync(imgPath)) {
    const imgBuffer = await readFile(imgPath);
    const base64    = imgBuffer.toString('base64');
    const ext       = path.extname(imagePath).toLowerCase().replace('.', '');
    const mimeType  = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp';
    userContent.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } });
    console.log(`Immagine allegata: ${imagePath}`);
  } else {
    console.warn(`Attenzione: immagine non trovata: ${imagePath}`);
  }
}

console.log(`Chiamata AI (${MODEL})...`);

const response = await fetch(BASE_URL, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/marketizzati',
    'X-Title': 'Marketizzati Motion Script',
  },
  body: JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userContent },
    ],
    temperature: 0.3,
    max_tokens:  4096,
  }),
});

if (!response.ok) {
  console.error(`Errore API (${response.status}):`, await response.text());
  process.exit(1);
}

const data = await response.json();
const raw  = data.choices?.[0]?.message?.content ?? '';

const jsonMatch = raw.match(/\{[\s\S]*\}/);
if (!jsonMatch) { console.error('Risposta AI non contiene JSON:\n', raw); process.exit(1); }

let parsed;
try { parsed = JSON.parse(jsonMatch[0]); }
catch (e) { console.error('JSON non valido:\n', raw); process.exit(1); }

parsed.title  = title;
parsed.format = format;

if (!parsed.scenes?.length) { console.error('Nessuna scena valida.'); process.exit(1); }

// ─── Post-processing: auto-upgrade text-only scenes ──────────────────────────

// Keywords → lottie concept (Italian + English)
const KEYWORD_LOTTIE = [
  [/\b(ai|ia|intelligenz|artificiale|artificial|gpt|llm|chatgpt|claude|openai)\b/i, 'ai-processing'],
  [/\b(neural|rete neurali|deep learn|rete|network)\b/i, 'neural-network'],
  [/\b(machin|apprendim|train|model)\b/i, 'machine-learning'],
  [/\b(dati?|data|analisi|analytic|statistic)\b/i, 'data-flow'],
  [/\b(crescita?|growth|aument|increase|chart)\b/i, 'chart-growth'],
  [/\b(mondo|global|earth|globe|internaz)\b/i, 'globe'],
  [/\b(codice|code|termin|cli|script|program)\b/i, 'code-terminal'],
  [/\b(avvert|alert|rischio|danger|warnin|attenzione)\b/i, 'warning'],
  [/\b(razz|rocket|velocit|fast|rapido|launch)\b/i, 'rocket'],
  [/\b(idea|innov|creativ|light|luce)\b/i, 'idea'],
  [/\b(lock|sicur|privacy|protez|security)\b/i, 'lock-security'],
  [/\b(impost|setting|config|gear|process)\b/i, 'settings'],
  [/\b(check|success|complet|done|fatto)\b/i, 'check-success'],
  [/\b(tempo|time|clock|orologio|conto)\b/i, 'clock'],
  [/\b(robot|automat|bot|macchina)\b/i, 'robot'],
  [/\b(cervell|brain|pens|think|mente)\b/i, 'brain'],
  [/\b(nod|connett|connect|rete)\b/i, 'network-nodes'],
];

function guessLottieConcept(text) {
  if (!text) return null;
  for (const [regex, concept] of KEYWORD_LOTTIE) {
    if (regex.test(text)) return concept;
  }
  return 'ai-processing'; // safe default for AI-themed content
}

const IS_NUMERIC = /^[\d\s%xX+\-→∞#.,:]+$/;

let upgraded = 0;
for (const scene of parsed.scenes) {
  const v = scene.visual;

  // Convert text-only highlight → lottie (unless it's a pure number/symbol)
  if (scene.type === 'highlight' && v?.kind === 'big-text' && !IS_NUMERIC.test(v.text)) {
    const concept = guessLottieConcept(`${scene.headline ?? ''} ${scene.subtext ?? ''} ${v.text}`);
    if (existsSync(path.join(__dirname, 'public', 'lottie', `${concept}.json`))) {
      scene.type = 'lottie';
      scene.visual = { kind: 'lottie', src: `lottie/${concept}.json`, concept };
      upgraded++;
      console.log(`  ↑ upgrade: highlight "${v.text}" → lottie "${concept}"`);
    }
  }

  // Validate and resolve bgLottie — clear if file doesn't exist
  if (scene.bgLottie) {
    const bgPath = path.join(__dirname, 'public', 'lottie', `${scene.bgLottie}.json`);
    if (!existsSync(bgPath)) {
      const fallback = guessLottieConcept(`${scene.headline ?? ''} ${scene.subtext ?? ''}`);
      const fallbackPath = path.join(__dirname, 'public', 'lottie', `${fallback}.json`);
      scene.bgLottie = existsSync(fallbackPath) ? fallback : undefined;
    }
  } else if (!['image', 'screenshot', 'lottie', 'chat'].includes(scene.type)) {
    // Auto-assign bgLottie if AI forgot
    const concept = guessLottieConcept(`${scene.headline ?? ''} ${scene.subtext ?? ''}`);
    const conceptPath = path.join(__dirname, 'public', 'lottie', `${concept}.json`);
    if (existsSync(conceptPath)) scene.bgLottie = concept;
  }
}

if (upgraded > 0) console.log(`\n  ✓ ${upgraded} scene text-only convertite in lottie`);

// Strip light backgrounds (would hide white text)
function isLightHex(hex) {
  if (!hex?.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
  return (0.299*r + 0.587*g + 0.114*b) > 145;
}
let bgFixed = 0;
for (const scene of parsed.scenes) {
  if (scene.bg && isLightHex(scene.bg)) {
    console.log(`  ⚠ bg "${scene.bg}" troppo chiaro → rimosso (${scene.headline ?? scene.type})`);
    delete scene.bg;
    bgFixed++;
  }
}
if (bgFixed > 0) console.log(`  ✓ ${bgFixed} sfondi chiari corretti`);

// Auto-upgrade: if an image/screenshot scene mentions a known brand → brand mock UI
const BRAND_CHAT_MAP = {
  'chatgpt': 'chatgpt', 'openai': 'chatgpt', 'gpt': 'chatgpt',
  'claude': 'claude', 'anthropic': 'claude',
  'gemini': 'gemini', 'google ai': 'gemini',
  'deepseek': 'deepseek',
  'llama': 'meta', 'meta ai': 'meta',
  'perplexity': 'perplexity',
};
let brandUpgraded = 0;
for (const scene of parsed.scenes) {
  if (scene.type !== 'image' && scene.type !== 'screenshot') continue;
  const text = `${scene.headline ?? ''} ${scene.subtext ?? ''}`.toLowerCase();
  for (const [key, brandId] of Object.entries(BRAND_CHAT_MAP)) {
    if (text.includes(key)) {
      scene.type = 'brand';
      scene.visual = { kind: 'brand-chat', brand: brandId, prompt: 'Come posso usarti al meglio?', response: 'Scrivi prompt chiari e specifici per ottenere risultati ottimali.' };
      brandUpgraded++;
      console.log(`  ↑ brand: "${scene.headline}" → mock UI ${brandId}`);
      break;
    }
  }
};

// ─── Asset fetching ───────────────────────────────────────────────────────────

const slug      = slugify(title);
const assetBase = path.join(__dirname, 'public', 'assets', slug);
await mkdir(assetBase, { recursive: true });

async function safeFetch(url, opts = {}) {
  try {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) });
    return r.ok ? r : null;
  } catch { return null; }
}

async function downloadFile(url, dest) {
  const r = await safeFetch(url);
  if (!r) return false;
  const buf = await r.arrayBuffer();
  if (buf.byteLength < 2000) return false; // too small = error page
  await writeFile(dest, Buffer.from(buf));
  return true;
}

// ─── Vecteezy API ────────────────────────────────────────────────────────────

// Queries per brand AI → icone 3D logo
const BRAND_VECTEEZY_QUERIES = {
  chatgpt:    'ChatGPT OpenAI logo icon 3d',
  claude:     'Anthropic Claude AI logo 3d icon',
  gemini:     'Google Gemini AI logo icon 3d colorful',
  deepseek:   'DeepSeek AI logo icon technology',
  meta:       'Meta AI Llama logo icon 3d blue',
  perplexity: 'Perplexity AI search logo icon',
};

let _vecteezyToken  = null;
let _vecteezyExpiry = 0;

async function getVecteezyToken() {
  if (!VECTEEZY_ID || !VECTEEZY_SECRET) return null;
  if (_vecteezyToken && Date.now() < _vecteezyExpiry) return _vecteezyToken;
  // Vecteezy API key is used directly as "Token {secret}" — no OAuth needed
  _vecteezyToken  = VECTEEZY_SECRET;
  _vecteezyExpiry = Date.now() + 86400 * 1000; // treat as permanent
  return _vecteezyToken;
}

async function vecteezySearch(query, contentType = 'photo') {
  const token = await getVecteezyToken();
  if (!token) return [];
  // V1 requires "Token {key}" auth; V2 paths are 404 — wait for Vecteezy docs
  const authHeader = `Token ${token}`;
  try {
    const r = await safeFetch(
      `https://api.vecteezy.com/v1/resources?term=${encodeURIComponent(query)}&content_type=${contentType}&page=1&per_page=5&license_type=free`,
      { headers: { Authorization: authHeader, Accept: 'application/json' } }
    );
    if (!r) return [];
    const d = await r.json();
    if (d.errors) { console.warn(`  Vecteezy: ${d.errors[0]?.message}`); return []; }
    return d.resources ?? d.data ?? d.photos ?? d.videos ?? d.results ?? [];
  } catch { return []; }
}

function extractVecteezyUrl(item) {
  if (!item) return null;
  // Prefer highest-quality URL available
  return item.download_url ?? item.preview_url ?? item.thumbnail_url
    ?? item.image_url ?? item.video_url ?? item.file_url ?? null;
}

async function fetchVecteezyPNG(query) {
  const items = await vecteezySearch(query, 'photo');
  return extractVecteezyUrl(items[0]);
}

async function fetchVecteezyVideo(query) {
  const items = await vecteezySearch(query, 'video');
  return extractVecteezyUrl(items[0]);
}

// ─────────────────────────────────────────────────────────────────────────────

async function fetchWikipediaPhoto(wikipediaSlug) {
  const r = await safeFetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikipediaSlug)}`
  );
  if (!r) return null;
  const d = await r.json();
  return d.originalimage?.source || d.thumbnail?.source || null;
}

async function fetchPexelsMany(query, count = 3) {
  if (!PEXELS_KEY) return [];
  const r = await safeFetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
    { headers: { Authorization: PEXELS_KEY } }
  );
  if (!r) return [];
  const d = await r.json();
  return (d.photos ?? []).map(p => p.src?.original || p.src?.large2x).filter(Boolean);
}

async function fetchPexelsVideo(query, maxDuration = 12) {
  if (!PEXELS_KEY) return null;
  const r = await safeFetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&size=medium`,
    { headers: { Authorization: PEXELS_KEY } }
  );
  if (!r) return null;
  const d = await r.json();
  const videos = (d.videos ?? []).filter(v => v.duration <= maxDuration);
  if (!videos.length) return null;
  // Pick best: prefer HD (1280+) file
  const video = videos[0];
  const files = (video.video_files ?? []).sort((a, b) => b.width - a.width);
  const hd = files.find(f => f.width >= 1280 && f.file_type === 'video/mp4') ?? files.find(f => f.file_type === 'video/mp4');
  return hd?.link ?? null;
}

async function fetchPixabayMany(query, count = 2) {
  if (!PIXABAY_KEY) return [];
  const r = await safeFetch(
    `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=${count}&min_width=1280`
  );
  if (!r) return [];
  const d = await r.json();
  return (d.hits ?? []).map(h => h.largeImageURL).filter(Boolean);
}

async function fetchScreenshot(url) {
  // 1. Try Apify screenshot actor (high quality, real browser)
  if (APIFY_TOKEN) {
    try {
      process.stdout.write('[Apify] ');
      const apifyRes = await fetch(
        `https://api.apify.com/v2/acts/apify~screenshot-url/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=60`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startUrls: [{ url }],
            viewportWidth: 1920,
            viewportHeight: 1080,
            screenshotType: 'jpeg',
            waitUntil: ['networkidle2'],
          }),
          signal: AbortSignal.timeout(90000),
        }
      );
      if (apifyRes.ok) {
        const items = await apifyRes.json();
        const screenshotUrl = items?.[0]?.screenshotUrl || items?.[0]?.screenshot;
        if (screenshotUrl) return { url: screenshotUrl, source: 'Apify' };
      }
    } catch (_) { /* fall through */ }
  }

  // 2. Try thum.io (free, real browser render, no auth)
  const thumUrl = `https://image.thum.io/get/width/1920/noanimate/${url}`;
  return { url: thumUrl, source: 'thum.io' };
}

function lottieConceptPath(concept) {
  const lottieFile = path.join(__dirname, 'public', 'lottie', `${concept}.json`);
  return existsSync(lottieFile) ? `lottie/${concept}.json` : null;
}

console.log(`\nFetch asset per ${parsed.scenes.length} scene...`);

let photoIdx = 0;
let screenshotIdx = 0;

for (let i = 0; i < parsed.scenes.length; i++) {
  const scene  = parsed.scenes[i];
  const visual = scene.visual;
  if (!visual) continue;

  if (visual.kind === 'photo') {
    const photoUrls = [];

    // 1. Wikipedia (single authoritative photo)
    if (visual.wikipedia) {
      process.stdout.write(`  [${i+1}] Wikipedia "${visual.wikipedia}"... `);
      const wikiUrl = await fetchWikipediaPhoto(visual.wikipedia);
      if (wikiUrl) { photoUrls.push(wikiUrl); console.log('✓'); }
      else console.log('✗');
    }

    // 2. Pexels (up to 3 images)
    if (visual.query) {
      process.stdout.write(`  [${i+1}] Pexels "${visual.query}"... `);
      const pexels = await fetchPexelsMany(visual.query, 3);
      photoUrls.push(...pexels);
      console.log(pexels.length > 0 ? `✓ (${pexels.length})` : '✗');
    }

    // 3. Pixabay fallback if we have fewer than 2 images
    if (photoUrls.length < 2 && visual.query) {
      process.stdout.write(`  [${i+1}] Pixabay "${visual.query}"... `);
      const pixabay = await fetchPixabayMany(visual.query, 2);
      photoUrls.push(...pixabay);
      console.log(pixabay.length > 0 ? `✓ (${pixabay.length})` : '✗');
    }

    // 4. Vecteezy — illustrazioni tech/AI di qualità se ancora poche immagini
    if (photoUrls.length < 2 && visual.query) {
      process.stdout.write(`  [${i+1}] Vecteezy "${visual.query}"... `);
      const vUrl = await fetchVecteezyPNG(visual.query);
      if (vUrl) { photoUrls.push(vUrl); console.log('✓ (Vecteezy)'); }
      else console.log('✗');
    }

    // Download all collected URLs (up to 4 images per scene)
    const savedSrcs = [];
    for (const photoUrl of photoUrls.slice(0, 4)) {
      const filename = `photo-${photoIdx++}.jpg`;
      const dest     = path.join(assetBase, filename);
      const src      = `assets/${slug}/${filename}`;
      const ok = await downloadFile(photoUrl, dest);
      if (ok) { savedSrcs.push(src); console.log(`       → ${src}`); }
    }

    if (savedSrcs.length > 0) {
      scene.visual = { ...visual, srcs: savedSrcs, src: savedSrcs[0] };
      console.log(`  [${i+1}] ✓ ${savedSrcs.length} immagine/i salvate`);
    } else {
      console.log(`  [${i+1}] ✗ nessuna foto trovata, sfondo fallback`);
    }
  }

  else if (visual.kind === 'browser') {
    const filename = `screenshot-${screenshotIdx++}.jpg`;
    const dest     = path.join(assetBase, filename);
    const src      = `assets/${slug}/${filename}`;

    process.stdout.write(`  [${i+1}] Screenshot "${visual.url}"... `);
    const result = await fetchScreenshot(visual.url);
    const ok     = await downloadFile(result.url, dest);
    if (ok) {
      scene.visual = { ...visual, src };
      console.log(`✓ (${result.source}) → ${src}`);
    } else {
      console.log(`✗ fallito (il renderer mostra placeholder)`);
    }
  }

  else if (visual.kind === 'brand-chat') {
    const query = BRAND_VECTEEZY_QUERIES[visual.brand] ?? `${visual.brand} AI logo icon 3d`;
    process.stdout.write(`  [${i+1}] Vecteezy icon "${visual.brand}"... `);
    const iconUrl = await fetchVecteezyPNG(query);
    if (iconUrl) {
      const filename = `brand-icon-${i}.jpg`;
      const dest     = path.join(assetBase, filename);
      const src      = `assets/${slug}/${filename}`;
      const ok = await downloadFile(iconUrl, dest);
      if (ok) {
        scene.visual = { ...visual, iconSrc: src };
        console.log(`✓ → ${src}`);
      } else {
        console.log(`✗ download fallito`);
      }
    } else {
      console.log(`✗ non trovato (avatar testo fallback)`);
    }
  }

  else if (visual.kind === 'clip') {
    const filename = `clip-${screenshotIdx++}.mp4`;
    const dest     = path.join(assetBase, filename);
    const src      = `assets/${slug}/${filename}`;

    // 1. Pexels Videos (primary)
    process.stdout.write(`  [${i+1}] Pexels Video "${visual.query}"... `);
    let videoUrl = await fetchPexelsVideo(visual.query ?? 'technology office work');
    if (videoUrl) {
      console.log('✓ (Pexels)');
    } else {
      console.log('✗');
      // 2. Vecteezy Videos (fallback)
      process.stdout.write(`  [${i+1}] Vecteezy Video fallback "${visual.query}"... `);
      videoUrl = await fetchVecteezyVideo(visual.query ?? 'technology office work');
      console.log(videoUrl ? '✓ (Vecteezy)' : '✗');
    }

    if (videoUrl) {
      const ok = await downloadFile(videoUrl, dest);
      if (ok) {
        scene.visual = { ...visual, src };
        console.log(`       → ${src}`);
      } else {
        console.log(`  [${i+1}] ✗ download video fallito`);
      }
    } else {
      console.log(`  [${i+1}] ✗ nessun clip trovato`);
    }
  }

  else if (visual.kind === 'lottie') {
    const concept   = visual.concept;
    const lottieSrc = concept ? lottieConceptPath(concept) : null;
    if (lottieSrc) {
      scene.visual = { ...visual, src: lottieSrc };
      console.log(`  [${i+1}] Lottie "${concept}" → ${lottieSrc} ✓`);
    } else {
      console.log(`  [${i+1}] Lottie "${concept}" ✗ — esegui: npm run download-lottie`);
    }
  }
}

// ─── Save props ───────────────────────────────────────────────────────────────

const outDir  = path.join(__dirname, 'props');
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, `${slug}.json`);
await writeFile(outPath, JSON.stringify(parsed, null, 2), 'utf-8');

const totalDuration = parsed.scenes[parsed.scenes.length - 1].end;
console.log(`\n✓ Props salvate: ${outPath}`);
console.log(`  ${parsed.scenes.length} scene — durata totale: ${totalDuration}s`);
console.log(`\nPer renderizzare:`);
console.log(`  npm run render:motion -- --props=props/${slug}.json`);
