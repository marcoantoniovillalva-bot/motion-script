import { existsSync } from 'fs';
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

const propsArg = arg('props');

if (!propsArg) {
  console.error('Uso: npm run render:motion -- --props=props/titolo.json');
  process.exit(1);
}

const propsPath = path.resolve(__dirname, propsArg);
if (!existsSync(propsPath)) {
  console.error(`Props non trovate: ${propsPath}`);
  process.exit(1);
}

const inputProps = JSON.parse(await readFile(propsPath, 'utf-8'));

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
const outDir = path.join(__dirname, 'renders', 'motion');
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, `${videoSlug}.mp4`);

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
