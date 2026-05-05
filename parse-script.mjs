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

const PEXELS_KEY   = process.env.PEXELS_API_KEY;
const PIXABAY_KEY  = process.env.PIXABAY_API_KEY;
const APIFY_TOKEN  = process.env.APIFY_API_TOKEN;
const MODEL        = 'anthropic/claude-sonnet-4-5';
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

const SYSTEM_PROMPT = `Sei un esperto di motion graphics e video marketing. Trasformi copioni testuali in strutture JSON per video animati senza voce, ricchi di contenuto visivo.

FILOSOFIA VISIVA — REGOLA ASSOLUTA:
- NON ESISTE una scena solo testo. Ogni scena DEVE avere un'animazione visiva principale.
- Le immagini e le animazioni comunicano il concetto PRIMA che il testo venga letto
- Il testo è un complemento, non il protagonista — poche parole, GRANDI visual animati
- Quando il copione menziona una persona reale, un prodotto, un luogo → usa sempre "image"
- Quando si mostra un sito, documentazione, repository → usa "screenshot"
- Per TUTTI i concetti astratti (AI, dati, velocità, successo, crescita) → usa "lottie"
- "highlight" è PROIBITO per testo descrittivo — usalo SOLO per simboli numerici (es. "10x", "87%", "→", "∞")

REGOLE FONDAMENTALI:
- Restituisci SOLO JSON valido, senza markdown, senza backtick
- 5-10 scene totali
- headline: massimo 4 parole
- subtext: massimo 8 parole, solo se aggiunge valore
- I timing devono essere contigui (end scena N = start scena N+1)
- Durata totale ≈ parole / 2.2 secondi
- OGNI scena deve avere il campo "bgLottie" con il concept lottie più adatto (anche se ha già un visual lottie/image/screenshot — skippato automaticamente per quelle)

TIPI SCENA:

1. title — apertura con emoji grande
   visual: { "kind": "icon", "emoji": "🚀" }

2. image — foto reale a schermo pieno (persona storica, prodotto, luogo)
   visual: { "kind": "photo", "wikipedia": "Alan_Turing", "query": "Alan Turing mathematician portrait" }
   → wikipedia: slug della pagina Wikipedia EN (es. "Artificial_intelligence", "Elon_Musk", "ChatGPT")
   → query: fallback search per Pexels/Pixabay se Wikipedia non ha foto

3. screenshot — schermata di un sito reale (Wikipedia, GitHub, prodotto ufficiale)
   visual: { "kind": "browser", "url": "https://en.wikipedia.org/wiki/Turing_test", "label": "Wikipedia" }
   → url: URL completo e pubblicamente accessibile

4. lottie — animazione 3D per concetti astratti
   visual: { "kind": "lottie", "concept": "neural-network" }
   → concept uno di: ${LOTTIE_CONCEPTS.join(', ')}

5. stat — numero animato
   visual: { "kind": "counter", "from": 0, "to": 95, "suffix": "%", "label": "Label breve" }

6. list — elenco con emoji
   visual: { "kind": "list", "items": [{ "icon": "✅", "text": "Breve" }] }

7. comparison — split screen A vs B
   visual: { "kind": "comparison", "left": { "label": "Prima", "icon": "❌" }, "right": { "label": "Dopo", "icon": "✅" }, "verdict": "right" }

8. flow — processo sequenziale
   visual: { "kind": "flow", "steps": [{ "icon": "📝", "label": "Step" }] }

9. highlight — SOLO per numeri/simboli grandi (10x, 87%, →, ∞, #1)
   visual: { "kind": "big-text", "text": "10x" }
   ⚠️ NON usare highlight per testo descrittivo! Usa lottie con headline invece.

10. code — terminale/CLI/snippet
    visual: { "kind": "code", "lines": ["$ comando", "→ output"] }

11. chat — conversazione animata con AI (usa quando si mostra una domanda/risposta, un dialogo, un esempio di AI in azione)
    visual: { "kind": "chat", "messages": [
      { "role": "user", "text": "Come funziona questa tecnologia?" },
      { "role": "ai", "text": "Analizza i dati in tempo reale e risponde in millisecondi." }
    ]}
    → max 2 messaggi per scena, testi corti (max 12 parole per messaggio)
    → usa per dimostrare l'utilità di un AI, mostrare un workflow, rispondere a una domanda del target

12. outro — CTA finale
    visual: { "kind": "icon", "emoji": "🎯" }

TIMING:
- title/highlight/outro: 4-6s
- image/screenshot/lottie: 6-10s (richiedono più tempo per essere fruiti)
- stat/comparison: 5-7s
- flow/list/code: 7-10s
- chat: 7-10s (il testo deve avere tempo di "scriversi")

EMOJI consigliati: 🤖 ⚙️ 🚀 💻 📊 🐙 🔧 📣 ✅ ❌ 💡 🎯 📈 ⚡ 🎨 🔑 💰 ⏱️ 🧩 🛠️ 📝 🔄 🌐 🎬 👥 💬 📱 🔥 ✨ 🧠 🔬 ⚖️

CAMPO bgLottie (OBBLIGATORIO per title/stat/list/comparison/flow/highlight/code/outro):
Scegli il concept lottie più adatto al contenuto della scena tra: ${LOTTIE_CONCEPTS.join(', ')}
- scene AI/machine learning → "ai-processing" o "neural-network" o "machine-learning"
- scene dati/crescita → "data-flow" o "chart-growth" o "analytics"
- scene processo/configurazione → "settings" o "network-nodes"
- scene successo/check → "check-success"
- scene velocità/lancio → "rocket"
- scene sicurezza → "lock-security"
- scene tempo → "clock"
- scene robot/automazione → "robot"
- scene codice/terminal → "code-terminal"
- scene idea/innovazione → "idea"
- scene mondo/globale → "globe"
- scene cervello/pensiero → "brain"
- scene attenzione/problema → "warning"

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

Genera il JSON. Usa liberamente i tipi "image", "screenshot" e "lottie" dove il contenuto del copione li giustifica — non limitarti a emoji e testo.`,
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
