import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

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

function findFfmpeg() {
  if (ffmpegStatic && existsSync(ffmpegStatic)) {
    return ffmpegStatic;
  }
  const local = path.join(root, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');
  return existsSync(local) ? local : 'ffmpeg';
}

async function writePgmMask(maskPath, width, height) {
  const header = Buffer.from(`P5\n${width} ${height}\n255\n`, 'ascii');
  const pixels = Buffer.alloc(width * height);
  const centerX = width * 0.5;
  const centerY = height * 0.46;
  const radiusX = width * 0.46;
  const radiusY = height * 0.42;
  const feather = 0.34;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      let value = 0;
      if (distance <= 1) {
        value = 255;
      } else if (distance < 1 + feather) {
        value = Math.round(255 * (1 - (distance - 1) / feather));
      }
      pixels[y * width + x] = value;
    }
  }

  await writeFile(maskPath, Buffer.concat([header, pixels]));
}

const week = argValue('week', '2026-W18');
const day = slugify(argValue('day', 'giovedi'));
const width = Number(argValue('width', '1080'));
const height = Number(argValue('height', '1920'));
const blur = Number(argValue('blur', '22'));
const footageDir = path.join(root, 'public', 'footage', week);
const source = path.join(footageDir, `${day}-proxy.mp4`);
const fallbackSource = path.join(footageDir, `${day}.mp4`);
const input = existsSync(source) ? source : fallbackSource;
const output = path.join(footageDir, `${day}-bokeh-proxy.mp4`);
const maskPath = path.join(footageDir, `${day}-bokeh-mask.pgm`);

if (!existsSync(input)) {
  console.error(`Footage not found: ${input}`);
  process.exit(1);
}

await mkdir(footageDir, { recursive: true });
await writePgmMask(maskPath, width, height);

const filter =
  `[0:v]split=2[sharp][blurbase];` +
  `[blurbase]boxblur=luma_radius=${blur}:luma_power=1:chroma_radius=${Math.round(blur / 2)}:chroma_power=1[blurred];` +
  `[1:v]format=gray,scale=${width}:${height}[mask];` +
  `[sharp][mask]alphamerge[sharpalpha];` +
  `[blurred][sharpalpha]overlay=format=auto,format=yuv420p[v]`;

const args = [
  '-y',
  '-i',
  input,
  '-loop',
  '1',
  '-i',
  maskPath,
  '-filter_complex',
  filter,
  '-map',
  '[v]',
  '-map',
  '0:a?',
  '-c:v',
  'libx264',
  '-preset',
  'veryfast',
  '-crf',
  '19',
  '-pix_fmt',
  'yuv420p',
  '-c:a',
  'copy',
  '-shortest',
  output,
];

const ffmpeg = findFfmpeg();
console.log(`Creating bokeh footage: ${output}`);
const result = spawnSync(ffmpeg, args, { stdio: 'inherit' });
if (result.status !== 0) {
  process.exit(result.status || 1);
}
console.log(`Done: ${output}`);
