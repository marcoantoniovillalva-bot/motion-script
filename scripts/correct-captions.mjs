// Contextual AI caption correction — reads the caption chunks (captions-trimmed.json)
// and asks an LLM to spot and fix words that Whisper plausibly mis-heard given the
// context of the whole transcript (e.g. "la gente" instead of "l'agente" in a video
// about AI agents). Runs when no exact script is available for align-script.py (with a
// script, ground-truth alignment beats any guess). Only chunk TEXT is touched — start/end
// timestamps and chunking are preserved so downstream stages (zoom plan, render) are
// unaffected. Reuses the OpenRouter call pattern from zoom-plan.mjs/parse-script.mjs.
//
// Every applied correction is printed and saved to a JSON log next to the captions (the
// log also acts as the pipeline's cache marker for this stage), so corrections can always
// be reviewed after the fact.

import { readFile, writeFile } from 'fs/promises';
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
if (!captionsPath) {
  console.error('Uso: node scripts/correct-captions.mjs --captions=raw-edits/<slug>/captions-trimmed.json [--output=...] [--log=...]');
  process.exit(1);
}
const outputPath = argValue('output', captionsPath);
const logPath = argValue(
  'log',
  path.join(path.dirname(path.resolve(captionsPath)), 'captions-corrections.json'),
);

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
  console.error('Nessun chunk di sottotitoli trovato.');
  process.exit(1);
}

const numberedLines = chunks.map((c, i) => `#${i}: ${c.text}`).join('\n');
const flowingText = chunks.map((c) => c.text).join(' ');

const SYSTEM_PROMPT = `Sei un correttore di trascrizioni automatiche (ASR/Whisper) in italiano per video talking-head su marketing, business e IA.

Ricevi i sottotitoli di un video: prima il discorso completo come testo scorrevole (per capire il contesto), poi gli stessi sottotitoli come lista numerata di chunk brevi (2-3 parole l'uno, in ordine). Sono il risultato GREZZO del riconoscimento vocale: contengono quasi sempre qualche parola fraintesa che nel contesto del discorso non ha senso.

Il tuo compito: trovare SOLO le parole plausibilmente fraintese dall'ASR e ricostruire ciò che l'oratore ha REALMENTE DETTO.

VINCOLO FONDAMENTALE — somiglianza fonetica: l'ASR sbaglia trascrivendo suoni simili, quindi la correzione deve SUONARE quasi identica al testo sbagliato pronunciato ad alta voce. "della gente" → "dell'agente" è una correzione valida (stesso suono); "della gente" → "dell'azienda" NON lo è MAI, anche se "azienda" avrebbe più senso nel contesto: l'oratore non può aver detto una cosa che suona così diversa. Prima di proporre una correzione, pronuncia mentalmente il testo sbagliato e il testo corretto: se non suonano quasi uguali, la correzione è vietata. Se nessuna parola foneticamente vicina funziona nel contesto, lascia il chunk com'è.

Esempi tipici di errori ASR:
- omofoni e segmentazioni sbagliate: "la gente" ↔ "l'agente", "ha detto" ↔ "adetto", "c'è l'ha" ↔ "ce l'ha"
- nomi di prodotti/brand tech storpiati: "clod"/"cloud" → "Claude", "gpt" → "GPT", "ciat gpt" → "ChatGPT"
- refusi/parole in altre lingue vicine: "construire" → "costruire"

GLOSSARIO DEL CANALE (l'oratore parla di questi nomi in quasi ogni video — se un suono ci si avvicina, è quasi certamente uno di questi): Claude, Anthropic, ChatGPT, OpenAI, Make, N8N, API, IDE, agenti IA, chiavi di accesso, infrastruttura cloud. In particolare: "Lo ha/cloude/clod" a inizio frase su un annuncio è quasi sempre "Claude"; "antropic/entropic" è "Anthropic".

CTA RICORRENTE: quando l'oratore invita a commentare una parola ("commenta la parola X"), la parola da commentare va scritta in MAIUSCOLO (es. "AGENTE").

PUNTEGGIATURA: se una frase è chiaramente una domanda diretta ("Ci stai", "Il costo reale"), assicurati che il chunk finale termini con "?" — proponi la correzione anche solo per la punteggiatura in questi casi.

Regole ferree:
- NON riformulare, NON migliorare lo stile, NON correggere il parlato colloquiale o le ripetizioni: correggi solo ciò che l'ASR ha quasi certamente sbagliato.
- Ogni correzione sostituisce l'INTERO testo di un chunk con un nuovo testo di lunghezza simile (stesso numero di parole o quasi): i timestamp restano quelli del chunk.
- Se una parola fraintesa è spezzata su due chunk adiacenti, correggi entrambi i chunk (una correzione per chunk).
- Nel dubbio, NON correggere: un falso positivo è peggio di un errore lasciato.
- Rispondi SOLO con un oggetto JSON valido, nessun testo fuori dal JSON.

Formato risposta (corrections può essere vuoto):
{
  "corrections": [
    { "index": 12, "old": "testo attuale esatto del chunk", "new": "testo corretto", "reason": "breve motivazione" }
  ]
}`;

const userContent = `DISCORSO COMPLETO (contesto):\n---\n${flowingText}\n---\n\nSOTTOTITOLI (${chunks.length} chunk):\n---\n${numberedLines}\n---\n\nTrova e correggi gli errori di trascrizione contestuali.`;

console.log(`Chiamata AI (${MODEL}) per la correzione contestuale dei sottotitoli...`);

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
    temperature: 0.2,
    max_tokens: 4096,
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
} catch {
  console.error('JSON non valido:\n', raw);
  process.exit(1);
}

const corrections = Array.isArray(parsed.corrections) ? parsed.corrections : [];
const applied = [];
const skipped = [];

for (const corr of corrections) {
  const chunk = chunks[corr.index];
  // The old text must match the chunk exactly — protects against the model
  // hallucinating indices or the captions having changed since the AI saw them.
  if (!chunk || chunk.text !== corr.old) {
    skipped.push(corr);
    console.warn(`  SALTATA (mismatch) #${corr.index}: "${corr.old}" -> "${corr.new}"`);
    continue;
  }
  chunk.text = corr.new;
  // Keep the keyword-highlight consistent if it referenced the corrected text.
  if (chunk.highlight && !corr.new.toLowerCase().includes(chunk.highlight.toLowerCase())) {
    chunk.highlight = corr.old === chunk.highlight ? corr.new : chunk.highlight;
  }
  applied.push(corr);
  console.log(`  #${corr.index} [${chunk.start.toFixed(2)}s]: "${corr.old}" -> "${corr.new}" (${corr.reason || 'n/d'})`);
}

// Captions first, log last: the log is the stage's cache marker in edit_pipeline.py, so
// it must end up newer than the captions file it describes.
if (applied.length > 0) {
  await writeFile(path.resolve(outputPath), JSON.stringify(captionsData, null, 1) + '\n', 'utf-8');
}
await writeFile(
  path.resolve(logPath),
  JSON.stringify({ model: MODEL, checkedAt: new Date().toISOString(), applied, skipped }, null, 2) + '\n',
  'utf-8',
);

console.log(
  applied.length > 0
    ? `Applicate ${applied.length} correzioni (${skipped.length} saltate). Log: ${logPath}`
    : `Nessuna correzione necessaria (${skipped.length} proposte saltate). Log: ${logPath}`,
);
