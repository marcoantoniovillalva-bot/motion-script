# Marketizzati Video Renderer

**AI-automated vertical video factory built on [Remotion](https://remotion.dev): turn a raw talking-head recording into a fully edited, captioned, b-roll-enriched reel — and generate motion-graphics videos from a plain text script.**

Two production pipelines in one repo:

1. **Talking-head editor** (`edit_pipeline.py` + `render-edit.mjs`) — from raw camera footage to a finished reel: speech-to-text, AI caption correction, real background segmentation with depth blur, cinematic color grade, AI-directed editorial zooms, chin-anchored two-tone captions, an AI-directed **b-roll layer** (glass cards, macOS-style windows, animated product mockups, stock photos/videos, 3D emoji), synthesized UI sound effects, and a social-ready export.
2. **Motion script videos** (`parse-script.mjs` + `render-motion.mjs`) — standalone motion-graphics videos generated from a written script: real photos (Wikipedia/Pexels/Pixabay), animated browser screenshots, Lottie animations, animated chats, counters, lists and flows, with a brand logo intro.

Everything is orchestrated by LLM "directors" (zoom plan, b-roll plan, caption correction, scene parsing) via [OpenRouter](https://openrouter.ai), and the repo ships with **[Claude Code](https://claude.com/product/claude-code) skills** (`.claude/skills/`) so an AI agent can drive the whole workflow conversationally.

## Features

- 🎬 **End-to-end talking-head pipeline**: transcribe (faster-whisper large-v3 with domain glossary) → trim → AI contextual caption fixing (phonetic-similarity constrained) → subject matting (RobustVideoMatting, hi-res per-frame alpha with eroded/feathered masks — no edge halo) → masked background blur (no blur-bleed) → deband + film-grain dither → AI zoom plan → face-tracked captions → Remotion render
- 🧩 **B-roll director**: an LLM reads the timestamped captions and plans 12–18 visual segments (what, when, which template) synced to the spoken words; assets are fetched free (Microsoft Fluent 3D emoji, SVGL brand logos, Pexels photos/videos, Vecteezy vectors) with automatic transparency & watermark checks
- 🪟 **Template catalog** (all vector-rendered, single brand palette): glass cards with floating 3D icons, macOS-window splits (optional progressive 3D tilt), visual compare cards, iPhone notification mock, animated checklists & agent chats, count-up stats, logo orbit, typed product consoles, doc/lead-magnet previews
- 🔊 **Synthesized SFX** (pop/whoosh/tick/reveal — zero licensing) wired to template entrances
- 📤 **Triple output + social export**: full video, clean (no b-roll), transparent ProRes 4444 b-roll layer for manual editing, and an upload-optimized MP4 (~12 Mbps, `loudnorm` −14 LUFS)
- 🤖 **Claude Code skills**: `talking-head-editor` and `broll-director` encode the full workflow, quality rules, and the approved template guidelines

## Requirements

- **Windows** with [Node.js](https://nodejs.org) ≥ 22, [Python](https://python.org) 3.11+, [FFmpeg](https://ffmpeg.org) ≥ 6 on PATH (the pipelines also run from WSL by calling the Windows binaries: `node.exe`, `ffmpeg.exe`, `.venv/Scripts/python.exe` — on Linux/macOS adapt the executable names)
- An [OpenRouter](https://openrouter.ai) API key (required — powers the AI directors; ~$0.05/video)
- Optional free API keys: [Pexels](https://www.pexels.com/api/) (stock photos/videos), [Vecteezy Partner API](https://www.vecteezy.com/api) (vector icons), [Pixabay](https://pixabay.com/api/docs/), [Apify](https://apify.com) (browser screenshots)

## Installation

```bash
git clone https://github.com/marcoantoniovillalva-bot/motion-script.git
cd motion-script

# JS dependencies
npm install

# Python environment (transcription, matting, face tracking)
python -m venv .venv
.venv/Scripts/pip install faster-whisper onnxruntime opencv-python pillow numpy

# API keys
cp .env.example .env.local   # then edit .env.local with your keys
```

**Fonts note:** captions use *Montra* (Surplus Type Co, free for personal use — **not redistributable**, so it is not included in this repo). Download it yourself (or substitute any bold sans) into `public/fonts/Montra.otf`, then regenerate the embedded font module:

```bash
node scripts/generate-font-data.mjs
```

The other caption fonts (Lobster, Lobster Two, Pacifico, Freehand) are OFL-licensed and included.

## Usage

### 1. Edit a raw talking-head video

```bash
python edit_pipeline.py --input "path/to/raw.mp4" --slug myvideo
```

Produces `renders/talking-head/myvideo.mp4` plus per-stage intermediates in `raw-edits/myvideo/` (each stage is mtime-cached, so an interrupted run resumes where it stopped). Pass `--script copione.txt` if you have the exact spoken script (ground-truth caption correction); without it, an LLM pass fixes ASR errors contextually.

### 2. Add the AI-directed b-roll layer

```bash
node scripts/broll-plan.mjs   --captions=raw-edits/myvideo/captions-trimmed.json --output=raw-edits/myvideo/broll-plan.json --slug=myvideo
node scripts/broll-assets.mjs --plan=raw-edits/myvideo/broll-plan.json
node render-edit.mjs --slug=myvideo                     # full video (auto-picks broll-plan.json)
node render-edit.mjs --slug=myvideo --no-broll --output=renders/talking-head/myvideo-clean.mp4
node render-edit.mjs --slug=myvideo --broll-only        # transparent ProRes 4444 b-roll layer
```

Tip: render a quick hook preview before committing to the full render — retention is decided in the first seconds:

```bash
node render-edit.mjs --slug=myvideo --frames=0-400 --output=raw-edits/myvideo/preview-hook.mp4
```

### 3. Export for Instagram/TikTok

```bash
node scripts/export-social.mjs --input=renders/talking-head/myvideo.mp4
```

Upload the resulting `*-social.mp4` (bitrate tuned to survive platform re-encoding, loudness normalized to −14 LUFS). Keep the 45 Mbps master as archive.

### 4. Motion-graphics video from a text script

```bash
node parse-script.mjs --script=copione.txt --title="My video"   # LLM → scene JSON + assets
node render-motion.mjs --props=props/my-video.json              # render
```

### With Claude Code

Open this folder in [Claude Code](https://claude.com/product/claude-code) and invoke:

- `/talking-head-editor` — drives the raw-footage pipeline
- `/broll-director` — plans b-roll, fetches assets, renders approval previews (always the first-10-seconds hook first), then runs the final triple render + social export

## Project structure

```
edit_pipeline.py          # orchestrator: raw video → edited video (resumable stages)
render-edit.mjs           # Remotion renderer for TalkingHeadEdit (+ broll/alpha/social flags)
parse-script.mjs          # motion-graphics: script → scenes + assets (LLM)
render-motion.mjs         # motion-graphics renderer
scripts/
  transcribe.py           # faster-whisper w/ word timestamps + domain glossary
  correct-captions.mjs    # LLM contextual ASR fixing (phonetic-similarity constrained)
  matte-footage.py        # RVM segmentation + masked blur + color grade (halo-free)
  zoom-plan.mjs           # LLM editorial zoom director
  broll-plan.mjs          # LLM b-roll director (density/variety/keyword rules)
  broll-assets.mjs        # multi-source asset fetcher w/ alpha & watermark checks
  vecteezy-client.ts      # typed Vecteezy V2 API client (verified endpoints)
  export-social.mjs       # delivery encode + loudnorm
src/
  TalkingHeadEdit.tsx     # main composition (footage + b-roll layer + captions + SFX)
  BrollLayer.tsx          # template catalog implementation
  ReelCaptions.tsx        # two-tone chin-anchored captions
  motion-components/      # motion-graphics scene library (glass UI, charts, chats…)
.claude/skills/           # Claude Code skills encoding the full workflow
```

## License

Code is [MIT](LICENSE). Fonts, stock assets and third-party brand logos keep their own licenses — check before redistributing.
