---
name: talking-head-editor
description: Automatizza il passaggio da video grezzo (ripresa a camera fissa) a video editato — taglio intro/outro, sfondo sfocato in profondità (segmentazione reale del soggetto), zoom in/out editoriale deciso da un'IA, color grade, sottotitoli a due toni ancorati al mento.
metadata:
  tags: video-editing, remotion, whisper, matting, talking-head
---

Sei l'assistente per l'editing automatico di video "talking-head" (persona a camera fissa) nel progetto:
`C:\Users\Villalva\Desktop\Marketizzati definitifo\marketizzati-video-renderer\`

**Non è la stessa cosa della skill `remotion_marketizzati`** (motion graphics generati da copione, senza footage). Questa skill parte da una ripresa video reale e produce l'edit finito — sono due prodotti diversi con due pipeline separate, non fonderli.

## Cosa fa (equivalente automatico dell'editing manuale su CapCut)

1. Taglia l'inizio e la fine morta (prima che l'utente inizi a parlare, dopo che finisce)
2. Segmenta il soggetto dallo sfondo e ricrea l'effetto "duplica + sfoca dietro" (profondità), sostituendo il vecchio bokeh finto
3. Applica un color grade fisso (preset "warm-punch" calibrato una volta, riusato sempre)
4. Fa decidere a un'IA dove fare zoom-in rapido (frasi clou), zoom-in lento e progressivo (parti tecniche lunghe), o restare statico
5. Traccia il volto per centrare lo zoom sulla faccia e ancorare i sottotitoli sotto il mento (si muovono con lo zoom, non restano fissi)
6. Genera sottotitoli automatici a due toni (bianco standard, arancione per le parole chiave) — stesso stile già usato in `src/ReelCaptions.tsx`
7. Renderizza il video finale con Remotion

## Comando end-to-end

```bash
python edit_pipeline.py --input "path/al/video grezzo.mp4" --slug nome-progetto
```

Output: `renders/talking-head/nome-progetto.mp4`

Ogni stage viene saltato se il suo output esiste già ed è più recente dei suoi input (cache su mtime) — se il comando viene interrotto (es. per il tempo lungo dello stage di matting su CPU, ~20-30 min per un video di 2 minuti), rilancia lo stesso comando: riparte dallo stage non ancora completato. Usa `--force` per rieseguire tutto ignorando la cache.

## Stage singoli (per debug o rilancio mirato)

Tutti i file di lavoro intermedi vivono in `raw-edits/<slug>/` (non in `public/` — solo il video compositato finale viene copiato in `public/raw-edits/<slug>/composited.mp4` da `render-edit.mjs`, perché Remotion legge asset solo da `public/`).

| Stage | Comando | Output |
|---|---|---|
| 1. Trascrizione | `python scripts/transcribe.py --input <grezzo.mp4> --output raw-edits/<slug>/transcript-raw.json --model small --language it` | timestamp parola-per-parola + chunk 2-4 parole con highlight/importance |
| 2. Trim | `python scripts/trim-footage.py --input <grezzo.mp4> --captions raw-edits/<slug>/transcript-raw.json --output raw-edits/<slug>/trimmed.mp4 --output-captions raw-edits/<slug>/captions-trimmed.json` | video tagliato + caption ritemporizzate |
| 3. Matting + blur + color grade | `python scripts/matte-footage.py --input raw-edits/<slug>/trimmed.mp4 --output raw-edits/<slug>/composited.mp4` | video finale a schermo intero (il più lento: ~20-30 min su CPU per 2 min di video) |
| 4. Piano di zoom (IA) | `node scripts/zoom-plan.mjs --captions=raw-edits/<slug>/captions-trimmed.json --output=raw-edits/<slug>/zoom-plan.json` | beat `static` / `fast-in-out` / `slow-push` con timestamp e scala target |
| 5. Face tracking | `python scripts/face-track.py --input raw-edits/<slug>/trimmed.mp4 --output raw-edits/<slug>/face-track.json` | centro volto + Y del mento normalizzati, campionati a 6fps |
| 6. Render | `node render-edit.mjs --slug=<slug> [--output=percorso.mp4]` | copia il composited.mp4 in public/, assembla i props, renderizza la composizione `TalkingHeadEdit` |

## File chiave

- `src/TalkingHeadEdit.tsx` — composizione Remotion: video full-bleed con zoom/pan (transform-origin sul volto tracciato) + `ReelCaptions` con `chinY` dinamico
- `src/talking-head-motion.ts` — `faceAt()` (interpolazione del face-track) e `zoomScaleAt()` (converte i beat del piano di zoom in una curva di scala continua; ogni beat torna sempre a scala 1.0 al proprio termine, quindi non ci sono scatti ai confini tra beat)
- `src/talking-head-types.ts` — tipi `FaceSample`, `ZoomBeat`, `ZoomPlan`, `TalkingHeadEditProps`
- `src/ReelCaptions.tsx` — riusato dal sistema reel esistente; esteso con la prop `chinY` per l'ancoraggio dinamico (in precedenza Y fissa)
- `scripts/transcribe.py` — riusato as-is dal sistema esistente (faster-whisper)
- `public/models/rvm_mobilenetv3_fp32.onnx` — modello RobustVideoMatting (segmentazione persona)
- `public/models/face_detection_yunet_2023mar.onnx` — modello YuNet (face detection leggero via `cv2.FaceDetectorYN`)

## Note importanti

- Il preset color grade in `scripts/matte-footage.py` (`COLOR_GRADE`) è fisso e calibrato una volta confrontando frame di un video grezzo/editato di riferimento — non va ricalcolato per ogni nuovo video, così lo stile resta coerente tra i contenuti.
- Il matting gira su CPU (nessuna GPU disponibile) a risoluzione proxy ridotta (224px di default) con frame-stride=2 per stare in tempi ragionevoli — è il tradeoff di velocità accettato a fronte di una segmentazione reale (non più il finto bokeh ellittico di `create-bokeh-footage.mjs`, che resta per il sistema reel esistente).
- Se il modello di matting sbaglia qualche frame isolato, la sfocatura dietro nasconde comunque piccoli artefatti sui bordi — non serve una maschera perfetta.
- Per correggere un sottotitolo senza rifare il render: modifica il testo/highlight direttamente in `raw-edits/<slug>/captions-trimmed.json`, poi lancia `npm run studio` per un'anteprima immediata in locale, e solo alla fine rilancia `node render-edit.mjs --slug=<slug>` per il render definitivo.
- Target di fedeltà per il primo test end-to-end: il video di esempio in `Video da editare di esempio/` (grezzo + editato di riferimento) — confronta durata, frame chiave e sottotitoli campione prima di considerare l'output definitivo.
- Revisione umana sempre prima di qualunque pubblicazione — questa skill produce solo il video pronto per il feedback, non pubblica nulla automaticamente.
