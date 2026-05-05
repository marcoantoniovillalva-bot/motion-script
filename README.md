# 🎬 Marketizzati Motion Script

Sistema per creare **video di motion graphics professionali** a partire da un semplice copione testuale — senza voce, senza footage, completamente animato con IA.

Basato su [Remotion](https://www.remotion.dev/) + OpenRouter AI.

---

## ✨ Cosa fa

Prendi un copione testuale → l'IA lo trasforma in scene animate → Remotion lo renderizza in MP4.

Il sistema genera automaticamente:
- 📸 **Foto reali** (Wikipedia, Pexels, Pixabay) per persone, luoghi, prodotti
- 🌐 **Screenshot di siti** (browser animato) per documenti, GitHub, piattaforme
- 🎭 **Animazioni Lottie 3D** per concetti astratti (AI, dati, reti neurali...)
- 💬 **Chat animate** user/AI con typing effect
- 📊 **Contatori animati**, liste con stagger, flow con frecce, codice con cursore

---

## 📋 Prerequisiti

- [Node.js](https://nodejs.org/) versione 18 o superiore
- npm (incluso con Node.js)
- Un account su [OpenRouter](https://openrouter.ai) (gratuito, necessario per l'IA)

---

## 🚀 Installazione (5 minuti)

### 1. Clona il repository

```bash
git clone https://github.com/marcoantoniovillalva-bot/motion-script.git
cd motion-script
```

### 2. Installa le dipendenze

```bash
npm install
```

### 3. Configura le API key

```bash
cp .env.example .env.local
```

Apri `.env.local` e aggiungi almeno la tua chiave OpenRouter:

```
OPENROUTER_API_KEY=sk-or-...
```

> Le altre chiavi (Pexels, Pixabay, Apify) sono opzionali ma migliorano la qualità delle foto e degli screenshot.

### 4. Scarica le emoji 3D e le animazioni Lottie

```bash
npm run download-emoji
npm run download-lottie
```

> Questi script scaricano le risorse gratuite dai repository ufficiali. Vengono eseguiti **una sola volta**.

### 5. Genera i suoni

```bash
npm run generate-motion-sounds
```

---

## 🎯 Crea il tuo primo video

### Step 1 — Scrivi il copione

Crea un file di testo nella cartella `scripts/`. Puoi usare `scripts/esempio-copione.txt` come punto di partenza.

```bash
# Usa l'esempio incluso oppure crea il tuo
cp scripts/esempio-copione.txt scripts/il-mio-video.txt
```

### Step 2 — Genera le scene con l'IA

```bash
node parse-script.mjs --input=scripts/il-mio-video.txt --format=vertical --title="Il Mio Video"
```

Parametri disponibili:
| Parametro | Valori | Default | Descrizione |
|-----------|--------|---------|-------------|
| `--input` | percorso file | — | **Obbligatorio.** Il tuo copione |
| `--format` | `vertical` / `horizontal` | `vertical` | Formato video (9:16 o 16:9) |
| `--title` | testo | `Video` | Titolo del video (usato come nome file) |
| `--image` | percorso immagine | — | Immagine opzionale analizzata dall'IA |

L'IA analizzerà il copione e scaricherà automaticamente foto, screenshot e animazioni.

### Step 3 — Renderizza il video

```bash
npm run render:motion -- --props=props/il-mio-video.json
```

Il video verrà salvato in `renders/motion/il-mio-video.mp4`.

---

## ⚙️ Personalizzazione brand

Modifica il file `src/motion-config.ts` per personalizzare il tuo brand:

```typescript
export const motionConfig = {
  brand: {
    name: 'IlTuoBrand',
    tagline: 'Il tuo slogan',
    logoSrc: 'brand/logo.png', // sostituisci con il tuo logo
  },
  palette: {
    primary: '#FC3718', // colore principale (rosso di default)
    dark:    '#090909',
    // ...
  },
  // ...
};
```

Per usare il tuo logo: sostituisci il file `public/brand/logo.png` con il tuo logo (formato PNG con sfondo trasparente consigliato).

---

## 🎨 Tipi di scene disponibili

| Tipo | Descrizione | Quando usarla |
|------|-------------|---------------|
| `title` | Hook di apertura con emoji animata | Inizio video |
| `image` | Foto a schermo pieno con Ken Burns | Persone, luoghi, prodotti |
| `screenshot` | Browser animato con screenshot reale | Siti web, GitHub, piattaforme |
| `lottie` | Animazione 3D per concetti astratti | AI, dati, reti neurali, processi |
| `chat` | Conversazione animata user/AI | Dimostrare un chatbot o prompt |
| `stat` | Contatore animato | Percentuali, numeri chiave |
| `list` | Lista con stagger e emoji | Vantaggi, features, step |
| `comparison` | Split screen A vs B | Prima/dopo, pro/contro |
| `flow` | Processo sequenziale con frecce | Tutorial, workflow |
| `code` | Terminale animato con typing | Comandi CLI, snippet |
| `highlight` | Numero/simbolo enorme | 10x, 87%, → |
| `outro` | CTA finale con logo | Fine video |

---

## 🔑 API Key — Dove ottenerle

| Chiave | Dove | Piano gratuito |
|--------|------|----------------|
| `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai) | ✅ Crediti gratuiti all'iscrizione |
| `PEXELS_API_KEY` | [pexels.com/api](https://www.pexels.com/api/) | ✅ 200 req/ora gratis |
| `PIXABAY_API_KEY` | [pixabay.com/api](https://pixabay.com/api/docs/) | ✅ Gratis |
| `APIFY_API_TOKEN` | [apify.com](https://apify.com) | ✅ $5 crediti gratis/mese |

---

## 📁 Struttura del progetto

```
motion-script/
├── src/
│   ├── motion-config.ts          # ⭐ Config brand (modifica questo)
│   ├── motion-script-types.ts   # Tipi TypeScript
│   ├── MotionScriptVideo.tsx    # Composizione principale
│   └── motion-components/       # Componenti scena
│       ├── TitleScene.tsx
│       ├── ImageScene.tsx
│       ├── LottieScene.tsx
│       ├── ChatScene.tsx
│       └── ...
├── public/
│   ├── brand/logo.png           # Il tuo logo
│   ├── emoji/                   # Emoji 3D (scaricate con download-emoji)
│   ├── lottie/                  # Animazioni (scaricate con download-lottie)
│   └── sounds/                  # Suoni WAV
├── scripts/                     # I tuoi copioni
├── parse-script.mjs             # Parser AI (copione → JSON)
├── render-motion.mjs            # Script di render
├── download-emoji.mjs           # Scarica emoji 3D
├── download-lottie.mjs          # Scarica animazioni Lottie
├── .env.example                 # Template variabili d'ambiente
└── README.md
```

---

## 🎬 Anteprima in Remotion Studio

Per vedere le scene in anteprima senza renderizzare:

```bash
npm run studio
```

Apri il browser su `http://localhost:3000` e seleziona la composizione `MotionScript`.

---

## ❓ Problemi comuni

**"OPENROUTER_API_KEY non configurata"**
→ Hai copiato `.env.example` in `.env.local`? Hai aggiunto la tua chiave?

**Le emoji non appaiono**
→ Esegui `npm run download-emoji`

**Errore Lottie "not found"**
→ Esegui `npm run download-lottie`

**Il render è lento**
→ Normale per video lunghi. Un video di 2 minuti impiega 5-10 minuti.

---

## 🤝 Community Marketizzati

Questo strumento è stato creato per la community di [Marketizzati](https://marketizzati.it) — dove imprenditoria, marketing e intelligenza artificiale si incontrano.

---

*Powered by [Remotion](https://remotion.dev) · [OpenRouter](https://openrouter.ai) · [Fluent Emoji 3D](https://github.com/microsoft/fluentui-emoji) · [LottieFiles](https://lottiefiles.com)*
