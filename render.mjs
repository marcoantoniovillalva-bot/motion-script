import { existsSync } from 'fs';
import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = null) {
  const arg = process.argv.slice(2).find((item) => item.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : fallback;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const week = argValue('week');
const day = argValue('day');
const propsArg = argValue('props');
const noFootage = process.argv.includes('--no-footage');
const useAssets = process.argv.includes('--use-assets');

if ((!week || !day) && !propsArg) {
  console.error('Usage: npm run render -- --week=2026-W18 --day=giovedi');
  console.error('   or: npm run render -- --props=props/2026-W18/giovedi.json');
  process.exit(1);
}

const propsPath = propsArg
  ? path.resolve(__dirname, propsArg)
  : path.join(__dirname, 'props', week, `${slugify(day)}.json`);

if (!existsSync(propsPath)) {
  console.error(`Props file not found: ${propsPath}`);
  process.exit(1);
}

const inputProps = JSON.parse(await readFile(propsPath, 'utf-8'));
const videoSlug = slugify(day || inputProps.day || 'video');
const footageWeek = week || 'manual';
const proxyFootagePath = path.join(__dirname, 'public', 'footage', footageWeek, `${videoSlug}-proxy.mp4`);
const bokehFootagePath = path.join(__dirname, 'public', 'footage', footageWeek, `${videoSlug}-bokeh-proxy.mp4`);
const originalFootagePath = path.join(__dirname, 'public', 'footage', footageWeek, `${videoSlug}.mp4`);
const footagePath = existsSync(bokehFootagePath)
  ? bokehFootagePath
  : existsSync(proxyFootagePath)
    ? proxyFootagePath
    : originalFootagePath;
const footageFileName = existsSync(bokehFootagePath)
  ? `${videoSlug}-bokeh-proxy.mp4`
  : existsSync(proxyFootagePath)
    ? `${videoSlug}-proxy.mp4`
    : `${videoSlug}.mp4`;
const captionsPath = path.join(__dirname, 'public', 'captions', week || 'manual', `${slugify(day || inputProps.day || 'video')}.json`);
const assetPlanPath = path.join(__dirname, 'public', 'asset-plans', week || 'manual', `${videoSlug}.json`);
if (!noFootage && existsSync(footagePath)) {
  inputProps.footage = {
    src: `footage/${footageWeek}/${footageFileName}`,
    fit: inputProps.format === 'horizontal' ? 'cover' : 'cover',
    opacity: inputProps.format === 'horizontal' ? 0.22 : 0.34,
  };
  console.log(`Using footage: ${footagePath}`);
}
if (existsSync(captionsPath)) {
  const captionsFile = JSON.parse(await readFile(captionsPath, 'utf-8'));
  inputProps.captions = captionsFile.chunks || [];
  console.log(`Using captions: ${captionsPath}`);
}
if (useAssets && existsSync(assetPlanPath)) {
  const assetPlan = JSON.parse(await readFile(assetPlanPath, 'utf-8'));
  inputProps.assetOverlays = assetPlan.assets || [];
  console.log(`Using asset plan: ${assetPlanPath}`);
} else if (existsSync(assetPlanPath)) {
  console.log('Asset plan found but skipped. Add --use-assets to enable overlays.');
}

const entry = path.join(__dirname, 'src', 'index.ts');
const serveUrl = await bundle({ entryPoint: entry });
const compositions = await getCompositions(serveUrl, { inputProps });
const compositionId = inputProps.format === 'horizontal' ? 'HorizontalVideo' : 'VerticalReel';
const composition = compositions.find((item) => item.id === compositionId);
if (!composition) {
  console.error(`Composition ${compositionId} not found`);
  process.exit(1);
}

const outDir = path.join(__dirname, 'renders', week || 'manual');
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, `${slugify(day || inputProps.day || 'video')}.mp4`);

console.log(`Rendering ${composition.id} -> ${outPath}`);
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: outPath,
  inputProps,
  onProgress: ({ progress }) => {
    const pct = Math.round(progress * 100);
    if (pct % 10 === 0) {
      console.log(`Progress: ${pct}%`);
    }
  },
});
console.log(`Done: ${outPath}`);
