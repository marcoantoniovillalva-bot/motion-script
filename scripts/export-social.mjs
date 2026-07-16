// Social delivery export — takes the archive-quality master (45 Mbps) and produces the
// file to actually UPLOAD to Instagram/TikTok. Rationale: platforms always re-encode;
// uploading an oversized file makes the app/server transcode more aggressively (and the
// mobile app may pre-compress before upload). The sweet spot that survives best:
// H.264 High profile, ~10-14 Mbps for 1080x1920@30, faststart, AAC 256k.
// Audio is loudness-normalized to -14 LUFS (the IG/TikTok playback target) in the same
// pass — quieter voices get penalized by both the algorithm and the viewer's thumb.
//
// Uso: node scripts/export-social.mjs --input=renders/talking-head/esempio.mp4 [--output=...]

import { existsSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function argValue(name, fallback = null) {
  const arg = process.argv.slice(2).find((item) => item.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : fallback;
}

const input = argValue('input');
if (!input || !existsSync(path.resolve(rootDir, input))) {
  console.error('Uso: node scripts/export-social.mjs --input=renders/talking-head/<slug>.mp4 [--output=...]');
  process.exit(1);
}
const inputPath = path.resolve(rootDir, input);
const outputPath = path.resolve(
  rootDir,
  argValue('output', input.replace(/\.mp4$/, '-social.mp4')),
);

const args = [
  '-y', '-v', 'warning',
  '-i', inputPath,
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '18',
  '-maxrate', '14M',
  '-bufsize', '28M',
  '-profile:v', 'high',
  '-level', '4.2',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
  '-c:a', 'aac',
  '-b:a', '256k',
  '-ar', '48000',
  outputPath,
];

console.log(`Export social: ${input} -> ${path.relative(rootDir, outputPath)}`);
execFileSync('ffmpeg.exe', args, { stdio: 'inherit' });
console.log('Fatto. Carica QUESTO file sui social (il master resta come archivio).');
