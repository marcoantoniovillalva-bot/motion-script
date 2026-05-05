import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(__dirname, 'public', 'sounds');

function clamp(value) {
  return Math.max(-1, Math.min(1, value));
}

function envelope(t, duration, attack = 0.012, release = 0.12) {
  if (t < attack) return t / attack;
  const remaining = duration - t;
  if (remaining < release) return Math.max(0, remaining / release);
  return 1;
}

function writeWav(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(Math.round(clamp(samples[i]) * 32767), 44 + i * 2);
  }
  return buffer;
}

function synth(duration, fn) {
  const length = Math.floor(duration * SAMPLE_RATE);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    samples[i] = fn(t, duration, i);
  }
  return writeWav(samples);
}

function noise(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const pop = synth(0.13, (t, d) => {
    const e = envelope(t, d, 0.004, 0.08);
    const tone = Math.sin(2 * Math.PI * (720 - t * 1800) * t);
    return tone * e * 0.28;
  });

  const blip = synth(0.18, (t, d) => {
    const e = envelope(t, d, 0.006, 0.1);
    const a = Math.sin(2 * Math.PI * 940 * t);
    const b = Math.sin(2 * Math.PI * 1410 * t) * 0.28;
    return (a + b) * e * 0.18;
  });

  const hit = synth(0.34, (t, d) => {
    const e = Math.exp(-t * 11);
    const sub = Math.sin(2 * Math.PI * (86 - t * 80) * t);
    const click = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 28);
    return (sub * 0.34 + click * 0.12) * e;
  });

  const whoosh = synth(0.42, (t, d, i) => {
    const rise = Math.sin((t / d) * Math.PI);
    const n = noise(i + 11) * 0.55 + noise(i * 0.37 + 9) * 0.45;
    const tone = Math.sin(2 * Math.PI * (280 + t * 900) * t) * 0.18;
    return (n * 0.18 + tone) * rise * envelope(t, d, 0.02, 0.16);
  });

  await writeFile(path.join(OUT_DIR, 'pop-soft.wav'), pop);
  await writeFile(path.join(OUT_DIR, 'ui-blip.wav'), blip);
  await writeFile(path.join(OUT_DIR, 'bass-hit-soft.wav'), hit);
  await writeFile(path.join(OUT_DIR, 'whoosh-soft.wav'), whoosh);

  console.log(`Generated sounds in: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
