// B-roll plan generator — reads the timestamped captions and asks an LLM to direct
// where/when/how to insert b-roll (glass cards, split-screen windows, fullscreen
// takeovers) into the talking-head edit, mirroring how the zoom plan is decided.
// Output: raw-edits/<slug>/broll-plan.json consumed by BrollLayer.tsx via render-edit.mjs.
// Same OpenRouter call pattern as zoom-plan.mjs / correct-captions.mjs.

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

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
const slug = argValue('slug', 'video');

if (!captionsPath || !outputPath) {
  console.error('Uso: node scripts/broll-plan.mjs --captions=raw-edits/<slug>/captions-trimmed.json --output=raw-edits/<slug>/broll-plan.json [--slug=<slug>]');
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

const SYSTEM_PROMPT = `Sei il regista dei b-roll per video talking-head verticali (reel) su marketing/business/IA — palette bianco caldo/arancione, estetica premium "glass Apple".

Leggi una trascrizione con timestamp e decidi DOVE inserire elementi visivi di supporto (b-roll), QUALE template usare e COSA mostrare. Il b-roll deve illustrare ciò che viene DETTO in quel momento, mai distrarre.

TEMPLATE disponibili:
- "card": card glass compatta sotto i sottotitoli, la persona resta ben visibile. Per: numeri/statistiche, mini-liste, concetti chiave. Il default.
- "split": finestra mock stile macOS nella metà superiore, persona nella metà inferiore. Per: contenuti che meritano spazio (esempi di interfacce, confronti, schemi) mantenendo il contatto visivo.
- "takeover": immagine fotorealistica a schermo intero, 2-4 secondi MAX. Per: momenti a forte impatto visivo. Usalo con molta parsimonia.

ASSET disponibili (campo "asset"):
- { "kind": "stat", "value": "H24", "label": "assistenza sempre attiva" } — motion graphic: numero/dato grande arancione + etichetta
- { "kind": "list", "title": "...", "items": ["...", "..."] } — motion graphic: max 3 voci brevi
- { "kind": "text", "text": "frase breve d'impatto", "emphasis": "parola chiave" } — motion graphic: la parola emphasis va in arancione script
- { "kind": "image", "src": "broll/${slug}/icon-NN.png", "source": "fluent", "emoji": "<nome emoji Fluent in INGLESE, es. Rocket, Robot, Money bag, Fire, Light bulb, Gear, Locked, Chart increasing>" } — emoji 3D Microsoft (trasparente, premium). LA SCELTA DI DEFAULT per icone 3D nelle card.
- { "kind": "image", "src": "broll/${slug}/logo-NN.svg", "source": "svgl", "brand": "<nome brand, es. anthropic, claude, openai, n8n>" } — logo UFFICIALE trasparente del brand, per quando si nomina un'azienda/prodotto tech.
- { "kind": "image", "src": "broll/${slug}/icon-NN.svg", "source": "vecteezy", "stockQuery": "<es. '3d icon rocket'>" } — icona vettoriale Vecteezy: SOLO come fallback se il concetto non esiste come emoji Fluent né come logo.
- { "kind": "image", "src": "broll/${slug}/img-NN.png", "source": "stock", "stockQuery": "<3-5 parole in INGLESE per foto stock>" } — foto stock REALE (Pexels, gratis). Per soggetti generici (uffici, laptop, persone al lavoro) in split/takeover.
- { "kind": "image", "src": "broll/${slug}/img-NN.png", "source": "ai", "prompt": "<prompt fotografico in INGLESE: soggetto, lente (es. 85mm f/1.8), luce, mood — stile editoriale premium, MAI illustrazioni cartoon>" } — immagine generata: SOLO quando serve qualcosa di troppo specifico per lo stock (es. un testo preciso sullo schermo).
- { "kind": "video", "src": "broll/${slug}/vid-NN.mp4", "source": "stock", "stockQuery": "<3-5 parole in INGLESE>" } — VIDEO stock realistico breve (Pexels, gratis), per split e takeover. USANE 2-4 per video: il movimento reale vale più di una foto (persone che lavorano, mani su tastiera, uffici, schermi).
- { "kind": "mockui", "variant": "tasks", "title": "Automazioni attive", "items": ["Gestione dati", "Email promemoria", "Report clienti"] } — SCHERMATA DESKTOP SIMULATA ANIMATA: checklist di compiti che si completano da soli uno dopo l'altro. LA SCELTA GIUSTA per le parti tecniche/noiose: mostra il processo di cui si sta parlando come un'app reale. Da usare in split. Max 4 items brevissimi.
- { "kind": "mockui", "variant": "chat", "title": "Agente IA", "items": ["Ho trovato 3 nuovi lead", "Fissiamo una call?", "Proposta inviata ✓"] } — chat animata con l'agente IA che scrive (bolle alternate agente/utente). Per i momenti su assistenti/agenti che rispondono e conversano. Da usare in split. Max 4 messaggi brevissimi.

REGOLA ICONE: dentro le card usa SOLO fonti trasparenti (fluent/svgl/vecteezy) — mai foto con sfondo dentro una card. Le foto e i video (stock/ai) vanno solo in split o takeover, dove riempiono la cornice. Una card può anche combinare concetto+icona: in quel caso preferisci l'icona da sola (kind image) o il testo da solo (kind text/stat/list), non entrambi.

BUSSOLA DEI CONTENUTI — parole chiave da imprenditore: quando il parlato tocca clienti, vendite, fatturato, costi, tempo risparmiato, errori, automazione, sicurezza dei dati → lì DEVE esserci un b-roll che visualizza quel beneficio concreto. E le parti TECNICHE/noiose (configurazioni, API, infrastruttura) non vanno mai lasciate scoperte: coprile con mockui o video, sono i momenti in cui l'attenzione crolla.

DINAMISMO: ogni b-roll deve essere VIVO. Le icone/emoji fluttuano da sole (automatico), le mockui si animano da sole, ma per i momenti chiave preferisci video e mockui alle foto statiche. Nei PRIMI 10 SECONDI usa solo asset dinamici: mockui, video, o icone — mai foto statiche o solo testo.

REGOLE FERREE (aggiornate 2026-07-15 su feedback cliente — "il video deve essere sempre in movimento"):
- DENSITÀ ALTA: 12-18 segmenti per un video di ~2 minuti. La maggior parte del video deve avere qualcosa a schermo, con pause di respiro brevi (1.5-3s) tra un segmento e l'altro.
- PRIMI 10 SECONDI = HOOK VISIVO: obbligatori ALMENO 2 elementi b-roll nei primi 10 secondi (qui si decide se lo spettatore resta). Solo gli ultimi ~6 secondi (chiusura CTA) restano puliti per il contatto visivo.
- VARIETÀ OBBLIGATORIA: mai due segmenti consecutivi con lo stesso template O lo stesso tipo di asset. Alterna: split con schermata → card emoji → card testo/stat → split con video → card lista… Il ritmo visivo è parte del contenuto.
- ABBINAMENTO CONTENUTO-ASSET: processi/prodotti/schermate concrete ("gestire i dati", "automatizzare", "dashboard") → split con foto/video stock che MOSTRA quella schermata o quel processo; momenti emotivi/punchline → card emoji 3D; numeri → card stat; elenchi → card list; brand nominati → logo svgl.
- Durata segmenti: card 2.5-5s, split 3-6s, takeover 2-4s. Mai sovrapposti, minimo ~1.5s di pausa tra segmenti.
- Massimo 1 takeover ogni 4+ segmenti.
- Testi delle card in ITALIANO, brevissimi (da leggere in 2 secondi). Query/prompt delle immagini in INGLESE.
- I contenuti devono riprendere le parole ESATTE pronunciate in quel range temporale.
- Rispondi SOLO con un oggetto JSON valido.

Formato risposta:
{ "segments": [ { "start": 12.4, "end": 16.8, "template": "card", "asset": { "kind": "stat", "value": "...", "label": "..." }, "reason": "breve motivazione" } ] }`;

const userContent = `TRASCRIZIONE (durata totale ${duration.toFixed(2)}s):\n---\n${transcriptLines}\n---\n\nGenera il piano b-roll completo.`;

console.log(`Chiamata AI (${MODEL}) per il piano b-roll...`);

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
} catch {
  console.error('JSON non valido:\n', raw);
  process.exit(1);
}

let segments = Array.isArray(parsed.segments) ? parsed.segments : [];
if (!segments.length) {
  console.error('Nessun segmento generato.');
  process.exit(1);
}

// Sanitize: sort, clamp to the allowed window, enforce the 2.5s minimum useful duration
// (clamping can shave a segment down to a pointless flash), drop overlaps (keep earlier).
segments.sort((a, b) => a.start - b.start);
const sanitized = [];
for (const seg of segments) {
  const start = Math.max(0.8, Number(seg.start));
  const end = Math.min(duration - 6, Number(seg.end));
  if (!(end > start + 2)) continue;
  const prev = sanitized[sanitized.length - 1];
  if (prev && start < prev.end + 1.2) continue;
  sanitized.push({ ...seg, start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100 });
}

await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await writeFile(path.resolve(outputPath), JSON.stringify({ segments: sanitized }, null, 2) + '\n', 'utf-8');

console.log(`Piano b-roll scritto: ${outputPath} (${sanitized.length} segmenti)`);
for (const s of sanitized) {
  console.log(`  ${s.start}s-${s.end}s [${s.template}/${s.asset?.kind}] ${s.reason || ''}`);
}
