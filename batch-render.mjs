// Batch renderer — bundles ONCE, renders all videos sequentially.
// Resumable: skips output files that already exist. Safe to re-run after an interruption.
import { existsSync, statSync, readdirSync } from 'fs';
import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// slug (in props/) → final numbered output filename
const JOBS = [
  { props: 'props/agenti-autonomi-lo-strumento-giusto.json', out: 'renders/motion/26 Agenti Autonomi.mp4' },
  { props: 'props/risparmia-token-su-claude-code.json',       out: 'renders/motion/27 Risparmia Token.mp4' },
  { props: 'props/claude-chat-cowork-o-code.json',            out: 'renders/motion/28 Claude Chat Cowork Code.mp4' },
  { props: 'props/eric-schmidt-l-era-degli-agenti.json',      out: 'renders/motion/29 Era degli Agenti.mp4' },
  { props: 'props/147-agenti-ia-gratis.json',                 out: 'renders/motion/30 147 Agenti IA.mp4' },
  { props: 'props/claude-for-small-business.json',            out: 'renders/motion/31 Claude Small Business.mp4' },
];

const MAX_CLIP_MB = 10;

function downgradeBigClips(inputProps) {
  for (const scene of (inputProps.scenes ?? [])) {
    if (scene.type !== 'video' || scene.visual?.kind !== 'clip' || !scene.visual?.src) continue;
    const clipPath = path.join(__dirname, 'public', scene.visual.src);
    if (!existsSync(clipPath)) continue;
    const sizeMB = statSync(clipPath).size / 1_048_576;
    if (sizeMB <= MAX_CLIP_MB) continue;
    const assetDir = path.join(__dirname, 'public', path.dirname(scene.visual.src));
    const photos = existsSync(assetDir)
      ? readdirSync(assetDir).filter(f => f.endsWith('.jpg')).slice(0, 3).map(f => `${path.dirname(scene.visual.src)}/${f}`)
      : [];
    scene.type = 'image';
    scene.visual = photos.length > 0
      ? { kind: 'photo', src: photos[0], srcs: photos, attribution: 'Pexels' }
      : { kind: 'photo', src: '' };
    console.log(`    ⚠ clip "${path.basename(clipPath)}" (${sizeMB.toFixed(1)}MB) → image`);
  }
}

console.log('Bundling once...');
const serveUrl = await bundle({ entryPoint: path.join(__dirname, 'src', 'index.ts') });
console.log('Bundle pronto.\n');

const results = [];
for (const job of JOBS) {
  const outPath = path.resolve(__dirname, job.out);
  const label = path.basename(job.out);
  if (existsSync(outPath) && statSync(outPath).size > 100000) {
    console.log(`⏭  SKIP (già presente): ${label}`);
    results.push({ label, status: 'skip' });
    continue;
  }
  const propsPath = path.resolve(__dirname, job.props);
  if (!existsSync(propsPath)) {
    console.log(`✗  props mancanti: ${job.props}`);
    results.push({ label, status: 'no-props' });
    continue;
  }
  const inputProps = JSON.parse(await readFile(propsPath, 'utf-8'));
  downgradeBigClips(inputProps);
  await mkdir(path.dirname(outPath), { recursive: true });

  const comps = await getCompositions(serveUrl, { inputProps });
  const composition = comps.find(c => c.id === 'MotionScript');
  if (!composition) { console.log(`✗  MotionScript non trovata per ${label}`); results.push({ label, status: 'no-comp' }); continue; }

  const dur = inputProps.scenes[inputProps.scenes.length - 1].end;
  console.log(`▶  RENDER: ${label}  (${inputProps.scenes.length} scene, ${dur}s)`);
  const t0 = process.hrtime.bigint();
  let lastPct = -1;
  try {
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outPath,
      inputProps,
      onProgress: ({ progress }) => {
        const pct = Math.floor(progress * 100 / 10) * 10;
        if (pct !== lastPct) { lastPct = pct; process.stdout.write(`   ${label}: ${pct}%\n`); }
      },
    });
    const secs = Number(process.hrtime.bigint() - t0) / 1e9;
    console.log(`✓  FATTO: ${label}  (${secs.toFixed(0)}s)\n`);
    results.push({ label, status: 'ok' });
  } catch (e) {
    console.log(`✗  ERRORE ${label}: ${e.message}\n`);
    results.push({ label, status: 'error', error: e.message });
  }
}

console.log('===== RIEPILOGO =====');
for (const r of results) console.log(`  ${r.status.toUpperCase().padEnd(6)} ${r.label}${r.error ? ' — ' + r.error : ''}`);
console.log('===== BATCH FINITO =====');
