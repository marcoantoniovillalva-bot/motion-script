import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

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
const model = argValue('model', 'small');
const language = argValue('language', 'it');

if (!week || !day) {
  console.error('Usage: npm run prepare-captions -- --week=2026-W18 --day=giovedi');
  process.exit(1);
}

const daySlug = slugify(day);
const input = path.join(__dirname, 'public', 'footage', week, `${daySlug}.mp4`);
const outputDir = path.join(__dirname, 'public', 'captions', week);
const output = path.join(outputDir, `${daySlug}.json`);

if (!existsSync(input)) {
  console.error(`Footage not found: ${input}`);
  console.error(`Put your recording here first: public/footage/${week}/${daySlug}.mp4`);
  process.exit(1);
}

await mkdir(outputDir, { recursive: true });

const script = path.join(__dirname, 'scripts', 'transcribe.py');
const venvPython = path.join(__dirname, '.venv', 'Scripts', 'python.exe');
const pythonBin = existsSync(venvPython) ? venvPython : 'python';
const result = spawnSync(
  pythonBin,
  [script, '--input', input, '--output', output, '--model', model, '--language', language],
  { cwd: __dirname, stdio: 'inherit' },
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}
