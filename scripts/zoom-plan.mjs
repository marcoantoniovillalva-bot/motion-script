// Editorial zoom plan generator — reads a timestamped transcript (captions JSON from
// transcribe.py/trim-footage.py) and asks an LLM to make the same editing decisions
// described manually: alternate a quick zoom-in/zoom-out on punchy key sentences,
// stay static during plain setup lines, and use a slow progressive push-in (zoom-out
// at the end) for long technical/descriptive passages instead of repeatedly cutting
// in and out. Reuses the OpenRouter call pattern from parse-script.mjs.

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Load .env then .env.local (local overrides) — same convention as parse-script.mjs
async function loadEnvFile(filename) {
  try {
    const env = await readFile(path.join(rootDir, filename), 'utf-8');
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

function argValue(name, fallback = null) {
  const arg = process.argv.slice(2).find((item) => item.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : fallback;
}

const captionsPath = argValue('captions');
const outputPath = argValue('output');

if (!captionsPath || !outputPath) {
  console.error('Uso: node scripts/zoom-plan.mjs --captions=raw-edits/<slug>/captions-trimmed.json --output=raw-edits/<slug>/zoom-plan.json');
  process.exit(1);
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey || apiKey.startsWith('sk-or-...')) {
  console.error('Errore: OPENROUTER_API_KEY non configurata.');
  process.exit(1);
}

const MODEL = 'anthropic/claude-sonnet-4-5';
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

const captionsData = JSON.parse(await readFile(path.resolve(captionsPath), 'utf-8'));
const chunks = captionsData.chunks || [];
if (!chunks.length) {
  console.error('Nessun chunk di trascrizione trovato.');
  process.exit(1);
}
const duration = Number(captionsData.duration || chunks[chunks.length - 1].end);

const transcriptLines = chunks
  .map((c) => `[${c.start.toFixed(2)}-${c.end.toFixed(2)}] ${c.text}`)
  .join('\n');

const SYSTEM_PROMPT = `Sei un editor video esperto in contenuti talking-head per social (stile creator singolo davanti alla camera, marketing/business/IA).

Il tuo compito: leggere una trascrizione con timestamp e produrre un "piano di zoom" che replica queste scelte editoriali manuali:

1. STATIC (nessuno zoom, scale 1.0): frasi di setup, transizioni, parti neutre — non ogni frase merita enfasi.
2. FAST-IN-OUT: quando arriva una frase chiave/punchline breve e ad effetto, zoom-in rapido che parte poco prima della frase e culmina alla fine di essa, poi zoom-out subito dopo. Usalo con parsimonia, solo sui veri momenti clou (circa 1 ogni 3-5 beat).
3. SLOW-PUSH: per passaggi lunghi (tipicamente >4-5 secondi, più frasi consecutive) che spiegano dettagli tecnici o elencano caratteristiche — invece di continui zoom in/out, fai un unico zoom-in lento e progressivo che cresce durante tutto il passaggio, con zoom-out solo alla fine del blocco. Serve a non essere ripetitivo su parti "noiose" ma comunque a mantenere attenzione.

Regole:
- I beat devono coprire l'INTERA durata del video in modo contiguo, senza buchi né sovrapposizioni (beat[i].end === beat[i+1].start).
- Ogni beat ha una durata minima di ~1.5s (raggruppa più chunk di trascrizione insieme quando serve).
- targetScale — IMPORTANTE, deve essere MARCATO come nel video di riferimento reale (misurato: il volto arriva a occupare fino a ~1.6x lo spazio del piano normale): 1.0 per static; 1.30-1.48 per fast-in-out (picco, zoom deciso e visibile, non timido); 1.18-1.35 per slow-push (valore raggiunto gradualmente a fine blocco). Non usare valori sotto 1.15 per un beat che non sia static — uno zoom impercettibile non serve a marcare nulla.
- Alterna gli stili in modo naturale, non meccanico — non deve sembrare un pattern regolare.
- Rispondi SOLO con un oggetto JSON valido, nessun testo fuori dal JSON.

Formato risposta:
{
  "beats": [
    { "start": 0.0, "end": 3.2, "style": "static", "targetScale": 1.0, "reason": "breve motivazione" },
    { "start": 3.2, "end": 5.1, "style": "fast-in-out", "targetScale": 1.38, "reason": "..." }
  ]
}`;

const userContent = `TRASCRIZIONE (durata totale ${duration.toFixed(2)}s):\n---\n${transcriptLines}\n---\n\nGenera il piano di zoom completo per l'intera durata.`;

console.log(`Chiamata AI (${MODEL}) per il piano di zoom...`);

const response = await fetch(BASE_URL, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/marketizzati',
    'X-Title': 'Marketizzati Talking Head Editor',
  },
  body: JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    temperature: 0.4,
    max_tokens: 8192,
  }),
});

if (!response.ok) {
  console.error(`Errore API (${response.status}):`, await response.text());
  process.exit(1);
}

const data = await response.json();
const raw = data.choices?.[0]?.message?.content ?? '';
const jsonMatch = raw.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  console.error('Risposta AI non contiene JSON:\n', raw);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(jsonMatch[0]);
} catch (e) {
  console.error('JSON non valido:\n', raw);
  process.exit(1);
}

const beats = parsed.beats || [];
if (!beats.length) {
  console.error('Nessun beat generato.');
  process.exit(1);
}

// Clamp/patch small gaps or overlaps so the plan is always contiguous end-to-end.
beats.sort((a, b) => a.start - b.start);
beats[0].start = 0;
for (let i = 0; i < beats.length - 1; i += 1) {
  beats[i].end = beats[i + 1].start;
}
beats[beats.length - 1].end = duration;

await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await writeFile(
  path.resolve(outputPath),
  JSON.stringify({ duration, beats }, null, 2) + '\n',
  'utf-8',
);

console.log(`Piano di zoom scritto: ${outputPath} (${beats.length} beat)`);
const counts = beats.reduce((acc, b) => { acc[b.style] = (acc[b.style] || 0) + 1; return acc; }, {});
console.log('Distribuzione stili:', counts);
