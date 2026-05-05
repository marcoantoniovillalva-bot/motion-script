import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(__dirname, 'public', 'sounds');

function clamp(value) {
  return Math.max(-1, Math.min(1, value));
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

  // Short keyboard tap burst — band-pass noise with fast decay
  const typing = synth(0.12, (t, d, i) => {
    const e = Math.exp(-t * 38);
    const n = noise(i + 7) * 0.5 + noise(i * 0.5 + 3) * 0.3;
    const tone = Math.sin(2 * Math.PI * 520 * t) * 0.2 + Math.sin(2 * Math.PI * 840 * t) * 0.1;
    return (n * 0.22 + tone) * e;
  });

  // Tight click for counter increments — very short sine burst
  const tick = synth(0.08, (t) => {
    const e = Math.exp(-t * 60);
    const tone = Math.sin(2 * Math.PI * 1100 * t);
    return tone * e * 0.2;
  });

  await writeFile(path.join(OUT_DIR, 'typing.wav'), typing);
  await writeFile(path.join(OUT_DIR, 'tick.wav'), tick);

  console.log(`Generated motion sounds in: ${OUT_DIR}`);
  console.log('  typing.wav — keyboard tap for code scenes');
  console.log('  tick.wav   — counter tick for stat scenes');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
