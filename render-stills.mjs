// Fast validation — bundle once, render single still frames of a props file.
import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { bundle } from '@remotion/bundler';
import { getCompositions, renderStill } from '@remotion/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const propsArg = process.argv.find(a => a.startsWith('--props='))?.split('=').slice(1).join('=');
const frames = (process.argv.find(a => a.startsWith('--frames='))?.split('=')[1] ?? '').split(',').map(Number).filter(n => !isNaN(n));

const inputProps = JSON.parse(await readFile(path.resolve(__dirname, propsArg), 'utf-8'));
console.log('Bundling...');
const serveUrl = await bundle({ entryPoint: path.join(__dirname, 'src', 'index.ts') });
const comps = await getCompositions(serveUrl, { inputProps });
const composition = comps.find(c => c.id === 'MotionScript');
await mkdir(path.join(__dirname, '_review_frames'), { recursive: true });

for (const frame of frames) {
  const out = path.join(__dirname, '_review_frames', `still_${frame}.png`);
  await renderStill({ composition, serveUrl, output: out, frame, inputProps });
  console.log(`✓ frame ${frame} → still_${frame}.png`);
}
console.log('STILLS DONE');
