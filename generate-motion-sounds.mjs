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

  // 3-second energetic intro jingle: bass punch → sweep → arpeggio → chord → fade
  const introJingle = synth(3.0, (t) => {
    let s = 0;

    // Bass punch at t=0
    const bEnv = Math.exp(-t * 9) * (t < 0.65 ? 1 : 0);
    s += Math.sin(2 * Math.PI * 62 * t) * 0.5 * bEnv;
    s += Math.sin(2 * Math.PI * 124 * t) * 0.2 * bEnv;

    // Rising synth sweep 0.08s→0.62s (120→600Hz)
    if (t >= 0.08 && t < 0.63) {
      const st = (t - 0.08) / 0.55;
      const freq = 120 + st * 480;
      const env = Math.min(1, st * 10) * Math.exp(-st * 2.2);
      s += Math.sin(2 * Math.PI * freq * t) * 0.28 * env;
    }

    // Arpeggio: A4 → C#5 → E5
    const NOTES = [[0.62, 440], [0.82, 554.4], [1.02, 659.3]];
    for (const [ns, freq] of NOTES) {
      if (t >= ns && t < ns + 0.22) {
        const nt = t - ns;
        const env = (Math.exp(-nt * 7) * 0.85 + Math.exp(-nt * 1.5) * 0.15);
        s += Math.sin(2 * Math.PI * freq * t) * 0.34 * env;
        s += Math.sin(2 * Math.PI * freq * 2 * t) * 0.10 * env;
      }
    }

    // Chord bloom: A major triad from t=1.22
    if (t >= 1.22 && t < 2.75) {
      const ct = t - 1.22;
      const cEnv = (1 - Math.exp(-ct * 18)) * Math.exp(-ct * 0.65);
      s += Math.sin(2 * Math.PI * 440 * t) * 0.13 * cEnv;
      s += Math.sin(2 * Math.PI * 554 * t) * 0.11 * cEnv;
      s += Math.sin(2 * Math.PI * 659 * t) * 0.09 * cEnv;
      s += Math.sin(2 * Math.PI * 880 * t) * 0.06 * cEnv;
    }

    // Global fade out last 0.5s
    const fade = t > 2.5 ? Math.max(0, 1 - (t - 2.5) / 0.5) : 1;
    return clamp(s * 0.8 * fade);
  });

  await writeFile(path.join(OUT_DIR, 'typing.wav'), typing);
  await writeFile(path.join(OUT_DIR, 'tick.wav'), tick);
  await writeFile(path.join(OUT_DIR, 'intro-jingle.wav'), introJingle);

  console.log(`Generated motion sounds in: ${OUT_DIR}`);
  console.log('  typing.wav      — keyboard tap for code scenes');
  console.log('  tick.wav        — counter tick for stat scenes');
  console.log('  intro-jingle.wav — 3s energetic logo intro music');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
