import { createWriteStream, existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

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

function extensionFor(candidate) {
  if (candidate.kind === 'video') return '.mp4';
  const url = String(candidate.downloadUrl || '').split('?')[0].toLowerCase();
  if (url.endsWith('.png')) return '.png';
  if (url.endsWith('.webp')) return '.webp';
  return '.jpg';
}

async function download(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed ${response.status}: ${url}`);
  }
  await pipeline(response.body, createWriteStream(outputPath));
}

async function runProcess(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function optimizeVideo(inputPath, outputPath) {
  const ffmpegPath = path.join(rootDir, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');
  const filter = 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,format=yuv420p';
  await runProcess(ffmpegPath, [
    '-y',
    '-i',
    inputPath,
    '-an',
    '-vf',
    filter,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outputPath,
  ]);
}

async function main() {
  const week = argValue('week');
  const day = argValue('day');
  if (!week || !day) {
    console.error('Usage: npm run assets:download -- --week=2026-W18 --day=giovedi');
    process.exit(1);
  }

  const daySlug = slugify(day);
  const approvedPath = path.join(rootDir, 'public', 'asset-plans', week, `${daySlug}.approved.json`);
  if (!existsSync(approvedPath)) {
    throw new Error(`Approved plan not found: ${approvedPath}`);
  }

  const plan = JSON.parse(await readFile(approvedPath, 'utf-8'));
  const approved = (plan.candidates || plan.assets || []).filter((item) => item.approved);
  if (!approved.length) {
    throw new Error('No assets approved. Set approved=true on at least one candidate.');
  }

  const assetDir = path.join(rootDir, 'public', 'assets', week, daySlug);
  await mkdir(assetDir, { recursive: true });

  const overlays = [];
  for (const candidate of approved) {
    const ext = extensionFor(candidate);
    const filename = `${slugify(candidate.id)}${ext}`;
    const outputPath = path.join(assetDir, filename);
    if (!existsSync(outputPath)) {
      console.log(`Downloading ${candidate.provider}/${candidate.kind}: ${candidate.title}`);
      if (candidate.kind === 'video') {
        const tempPath = path.join(assetDir, `${slugify(candidate.id)}.source${ext}`);
        await download(candidate.downloadUrl, tempPath);
        await optimizeVideo(tempPath, outputPath);
      } else {
        await download(candidate.downloadUrl, outputPath);
      }
    }

    overlays.push({
      id: candidate.id,
      start: candidate.start,
      end: candidate.end,
      kind: candidate.kind,
      src: `assets/${week}/${daySlug}/${filename}`,
      placement: candidate.placement || 'side-card',
      animation: candidate.animation || 'slide',
      sound: candidate.sound || 'whoosh',
      credit: [candidate.provider, candidate.creator].filter(Boolean).join(' / '),
    });
  }

  const renderPlan = {
    format: 'marketizzati-asset-plan-v1',
    week,
    day,
    generatedAt: new Date().toISOString(),
    assets: overlays,
  };
  const renderPlanPath = path.join(rootDir, 'public', 'asset-plans', week, `${daySlug}.json`);
  await writeFile(renderPlanPath, JSON.stringify(renderPlan, null, 2), 'utf-8');
  console.log(`Wrote render asset plan: ${renderPlanPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
