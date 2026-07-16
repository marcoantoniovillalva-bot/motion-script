// Render script for the TalkingHeadEdit composition — assembles props from the
// per-stage JSON outputs (captions, zoom-plan, face-track) produced by the
// raw-edit pipeline (trim-footage.py, matte-footage.py, zoom-plan.mjs, face-track.py)
// and renders the final talking-head edit. Mirrors render.mjs/render-motion.mjs.

import { existsSync } from 'fs';
import { mkdir, readFile, copyFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = null) {
  const arg = process.argv.slice(2).find((item) => item.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : fallback;
}

const slug = argValue('slug');
if (!slug) {
  console.error('Uso: node render-edit.mjs --slug=esempio [--output=...] [--broll=path.json | --no-broll] [--broll-only]');
  process.exit(1);
}

const hasFlag = (name) => process.argv.slice(2).includes(`--${name}`);
const noBroll = hasFlag('no-broll');
const brollOnly = hasFlag('broll-only');

const workDir = path.join(__dirname, 'raw-edits', slug);
const captionsPath = path.join(workDir, 'captions-trimmed.json');
const zoomPlanPath = path.join(workDir, 'zoom-plan.json');
const faceTrackPath = path.join(workDir, 'face-track.json');
const compositedPath = path.join(workDir, 'composited.mp4');

for (const p of [captionsPath, zoomPlanPath, faceTrackPath, compositedPath]) {
  if (!existsSync(p)) {
    console.error(`File mancante: ${p}`);
    process.exit(1);
  }
}

// OffthreadVideo/staticFile can only read from public/ — copy the final composited
// footage there (intermediates stay out of public/).
const publicFootageDir = path.join(__dirname, 'public', 'raw-edits', slug);
await mkdir(publicFootageDir, { recursive: true });
const publicCompositedPath = path.join(publicFootageDir, 'composited.mp4');
await copyFile(compositedPath, publicCompositedPath);
const footageSrc = `raw-edits/${slug}/composited.mp4`;

const captionsData = JSON.parse(await readFile(captionsPath, 'utf-8'));
const zoomPlan = JSON.parse(await readFile(zoomPlanPath, 'utf-8'));
const faceTrack = JSON.parse(await readFile(faceTrackPath, 'utf-8'));

// B-roll plan: --broll=<path> to override, --no-broll to force clean; by default the
// per-slug plan is picked up automatically when it exists.
let brollPlan;
if (!noBroll) {
  const brollPath = argValue('broll', path.join(workDir, 'broll-plan.json'));
  if (existsSync(brollPath)) {
    brollPlan = JSON.parse(await readFile(brollPath, 'utf-8'));
    console.log(`B-roll plan: ${brollPath} (${brollPlan.segments?.length ?? 0} segmenti)`);
  }
}

const inputProps = {
  footageSrc,
  durationSeconds: captionsData.duration,
  captions: captionsData.chunks || [],
  zoomPlan,
  faceTrack,
  brollPlan,
  // b-roll-only: transparent base (no footage, no captions) for the alpha overlay export
  transparentBase: brollOnly,
};

const entry = path.join(__dirname, 'src', 'index.ts');
const serveUrl = await bundle({ entryPoint: entry });
const compositions = await getCompositions(serveUrl, { inputProps });
const composition = compositions.find((item) => item.id === 'TalkingHeadEdit');
if (!composition) {
  console.error('Composition TalkingHeadEdit non trovata');
  process.exit(1);
}

const outputArg = argValue('output');
const defaultName = brollOnly ? `${slug}-broll.mov` : `${slug}.mp4`;
const outPath = outputArg
  ? path.resolve(__dirname, outputArg)
  : path.join(__dirname, 'renders', 'talking-head', defaultName);
await mkdir(path.dirname(outPath), { recursive: true });

const framesArg = argValue('frames'); // e.g. --frames=200-260, for quick spot-check renders
const frameRange = framesArg
  ? framesArg.split('-').map(Number)
  : undefined;

console.log(`Rendering ${composition.id} -> ${outPath}${frameRange ? ` (frames ${frameRange})` : ''}`);
await renderMedia({
  composition,
  serveUrl,
  // b-roll-only: ProRes 4444 with alpha so the layer can be overlaid manually in any
  // editor during the trial phase; otherwise the usual high-bitrate h264.
  ...(brollOnly
    ? // The option is `proResProfile` (capital R) — the lowercase spelling is silently
      // ignored and the encode falls back to an alpha-less profile; pixelFormat
      // yuva444p10le is also required or the alpha plane is dropped anyway.
      { codec: 'prores', proResProfile: '4444', imageFormat: 'png', pixelFormat: 'yuva444p10le' }
    : {
        codec: 'h264',
        // Explicit high bitrate (matches the ~50Mbps 1080p/30fps CapCut export target) instead of
        // crf — this is the last of several encode generations (trim -> composite -> render), so
        // compression needs headroom to avoid compounding artifacts from the earlier passes.
        videoBitrate: '45M',
        encodingMaxRate: '55M',
        encodingBufferSize: '90M',
      }),
  outputLocation: outPath,
  inputProps,
  frameRange,
  concurrency: 2, // fewer parallel browser tabs on this 4-core box — avoids font/static-file fetch stalls under load
  timeoutInMilliseconds: 60000,
  onProgress: ({ progress }) => {
    const pct = Math.round(progress * 100);
    if (pct % 10 === 0) {
      console.log(`Progress: ${pct}%`);
    }
  },
});
console.log(`Done: ${outPath}`);
