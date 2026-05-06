import { existsSync, statSync, readdirSync } from 'fs';
import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = null) {
  const a = process.argv.slice(2).find(x => x.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : fallback;
}

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const propsArg  = arg('props');
const outputArg = arg('output');

if (!propsArg) {
  console.error('Uso: node render-motion.mjs --props=props/titolo.json [--output=path/video.mp4]');
  process.exit(1);
}

const propsPath = path.resolve(__dirname, propsArg);
if (!existsSync(propsPath)) {
  console.error(`Props non trovate: ${propsPath}`);
  process.exit(1);
}

const inputProps = JSON.parse(await readFile(propsPath, 'utf-8'));

// ─── Pre-render: convert oversized video clips → image to avoid delayRender timeouts ──
const MAX_CLIP_MB = 10;
let clipsFixed = 0;
for (const scene of (inputProps.scenes ?? [])) {
  if (scene.type !== 'video' || scene.visual?.kind !== 'clip' || !scene.visual?.src) continue;
  const clipPath = path.join(__dirname, 'public', scene.visual.src);
  if (!existsSync(clipPath)) continue;
  const sizeMB = statSync(clipPath).size / 1_048_576;
  if (sizeMB <= MAX_CLIP_MB) continue;
  // Downgrade to image — find a sibling photo in the same asset folder
  const assetDir = path.join(__dirname, 'public', path.dirname(scene.visual.src));
  const photos = existsSync(assetDir)
    ? readdirSync(assetDir).filter(f => f.endsWith('.jpg')).slice(0, 3).map(f => `${path.dirname(scene.visual.src)}/${f}`)
    : [];
  scene.type = 'image';
  scene.visual = photos.length > 0
    ? { kind: 'photo', src: photos[0], srcs: photos, attribution: 'Pexels' }
    : { kind: 'photo', src: '' };
  clipsFixed++;
  console.warn(`  ⚠ clip "${path.basename(clipPath)}" (${sizeMB.toFixed(1)}MB > ${MAX_CLIP_MB}MB) → image`);
}
if (clipsFixed > 0) console.log(`  Auto-fixed ${clipsFixed} clip(s) troppo grandi`);

if (!inputProps.scenes || inputProps.scenes.length === 0) {
  console.error('Props non valide: mancano le scene.');
  process.exit(1);
}

const entry = path.join(__dirname, 'src', 'index.ts');
console.log('Bundling...');
const serveUrl = await bundle({ entryPoint: entry });

const compositions = await getCompositions(serveUrl, { inputProps });
const composition = compositions.find(c => c.id === 'MotionScript');
if (!composition) {
  console.error('Composizione MotionScript non trovata.');
  process.exit(1);
}

const videoSlug = slugify(inputProps.title || 'motion-video');
let outPath;
if (outputArg) {
  outPath = path.resolve(__dirname, outputArg);
  await mkdir(path.dirname(outPath), { recursive: true });
} else {
  const outDir = path.join(__dirname, 'renders', 'motion');
  await mkdir(outDir, { recursive: true });
  outPath = path.join(outDir, `${videoSlug}.mp4`);
}

const totalDuration = inputProps.scenes[inputProps.scenes.length - 1].end;
console.log(`Rendering MotionScript: ${inputProps.title}`);
console.log(`  ${inputProps.scenes.length} scene — ${totalDuration}s — formato: ${inputProps.format}`);
console.log(`  Output: ${outPath}`);

await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: outPath,
  inputProps,
  onProgress: ({ progress }) => {
    const pct = Math.round(progress * 100);
    if (pct % 10 === 0) process.stdout.write(`\rProgress: ${pct}%   `);
  },
});

console.log(`\n✓ Completato: ${outPath}`);
