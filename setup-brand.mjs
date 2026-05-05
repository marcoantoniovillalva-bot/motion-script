/**
 * setup-brand.mjs — Configura brand e animazione logo per il tuo video.
 *
 * Uso:
 *   node setup-brand.mjs --logo=percorso/logo.png --name="MioBrand" [--tagline="Slogan"] [--primary="#FF0000"]
 *
 * Il script:
 *  1. Legge le dimensioni del logo (PNG/JPG/WebP)
 *  2. Calcola l'aspect ratio e sceglie lo stile animazione ottimale
 *  3. Copia il logo in public/brand/logo.png
 *  4. Aggiorna src/motion-config.ts con i nuovi valori
 */

import { copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = null) {
  const a = process.argv.slice(2).find(x => x.startsWith(`--${name}=`));
  return a ? a.split('=').slice(1).join('=') : fallback;
}

// ─── Logo dimension readers ───────────────────────────────────────────────────

function readPngDimensions(buf) {
  // PNG signature: 8 bytes, then IHDR chunk: 4 len + 4 "IHDR" + 4 width + 4 height
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  return {
    width:  buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function readJpegDimensions(buf) {
  // Scan for SOF0 (FF C0), SOF1 (FF C1), SOF2 (FF C2) markers
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
      return {
        height: buf.readUInt16BE(i + 5),
        width:  buf.readUInt16BE(i + 7),
      };
    }
    // Skip this marker segment (length at i+2)
    const segLen = buf.readUInt16BE(i + 2);
    i += 2 + segLen;
  }
  return null;
}

function readWebpDimensions(buf) {
  // RIFF....WEBPVP8 or RIFF....WEBPVP8L
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const fmt = buf.toString('ascii', 12, 16);
  if (fmt === 'VP8 ') {
    // Lossy: width and height at specific offsets
    const w = (buf.readUInt16LE(26) & 0x3FFF);
    const h = (buf.readUInt16LE(28) & 0x3FFF);
    return { width: w, height: h };
  }
  if (fmt === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    const w = (bits & 0x3FFF) + 1;
    const h = ((bits >> 14) & 0x3FFF) + 1;
    return { width: w, height: h };
  }
  return null;
}

function getImageDimensions(buf) {
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50) return readPngDimensions(buf);
  // JPEG
  if (buf[0] === 0xFF && buf[1] === 0xD8) return readJpegDimensions(buf);
  // WebP
  if (buf.length > 16 && buf.toString('ascii', 0, 4) === 'RIFF') return readWebpDimensions(buf);
  return null;
}

// ─── Animation style selector ─────────────────────────────────────────────────

function chooseAnimation(width, height) {
  const ratio = width / height;

  if (ratio <= 1.6) {
    // Square or slightly-wide: icon, shield, badge, circle → 3D flip
    return { anim: 'flip-3d', reason: `aspect ratio ${ratio.toFixed(2)} (square/icon)` };
  }
  if (ratio <= 2.8) {
    // Moderate horizontal: typical wordmark+icon combos → zoom-fade
    return { anim: 'zoom-fade', reason: `aspect ratio ${ratio.toFixed(2)} (wide logo)` };
  }
  // Very wide: pure wordmarks, banners → slide-up
  return { anim: 'slide-up', reason: `aspect ratio ${ratio.toFixed(2)} (wordmark/banner)` };
}

// ─── motion-config.ts patcher ─────────────────────────────────────────────────

function patchConfig(source, { name, tagline, logoSrc, logoAnimation, primary }) {
  let out = source;

  // brand.name
  out = out.replace(/(name:\s*')[^']*(')/,   `$1${name}$2`);
  out = out.replace(/(name:\s*")[^"]*(")/,   `$1${name}$2`);

  // brand.tagline
  if (tagline !== null) {
    out = out.replace(/(tagline:\s*')[^']*(')/,  `$1${tagline}$2`);
    out = out.replace(/(tagline:\s*")[^"]*(")/,  `$1${tagline}$2`);
  }

  // brand.logoSrc
  out = out.replace(/(logoSrc:\s*')[^']*(')/,  `$1${logoSrc}$2`);
  out = out.replace(/(logoSrc:\s*")[^"]*(")/,  `$1${logoSrc}$2`);

  // brand.logoAnimation (the cast expression)
  out = out.replace(
    /logoAnimation:\s*'[^']*'\s*as\s*[^,\n]+/,
    `logoAnimation: '${logoAnimation}' as 'flip-3d' | 'zoom-fade' | 'slide-up'`
  );

  // palette.primary
  if (primary) {
    out = out.replace(/(primary:\s*')[^']*(')/g, `$1${primary}$2`);
    out = out.replace(/(primary:\s*")[^"]*(")/g, `$1${primary}$2`);
  }

  return out;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const logoArg    = arg('logo');
const name       = arg('name');
const tagline    = arg('tagline');        // optional
const primary    = arg('primary');        // optional hex color
const animForce  = arg('animation');      // optional override: flip-3d | zoom-fade | slide-up

if (!name) {
  console.error(`
Uso: node setup-brand.mjs \\
  --logo=percorso/logo.png \\
  --name="MioBrand" \\
  [--tagline="Il tuo slogan"] \\
  [--primary="#FF0000"] \\
  [--animation=flip-3d|zoom-fade|slide-up]
`);
  process.exit(1);
}

let logoAnimation = 'flip-3d';
let logoSrc = '';
let dims = null;

if (logoArg) {
  const logoAbs = path.resolve(__dirname, logoArg);
  if (!existsSync(logoAbs)) {
    console.error(`Errore: logo non trovato: ${logoAbs}`);
    process.exit(1);
  }

  const ext = path.extname(logoArg).toLowerCase();
  const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
  if (!allowed.includes(ext)) {
    console.error(`Formato non supportato: ${ext}. Usa PNG, JPG o WebP.`);
    process.exit(1);
  }

  // Read and analyze
  const buf = await readFile(logoAbs);
  dims = getImageDimensions(buf);

  if (!dims) {
    console.warn('Impossibile leggere le dimensioni del logo — uso zoom-fade come fallback.');
    logoAnimation = 'zoom-fade';
  } else {
    const result = chooseAnimation(dims.width, dims.height);
    logoAnimation = result.anim;
    console.log(`\nAnalisi logo: ${dims.width}×${dims.height}px (${result.reason})`);
    console.log(`  → Stile animazione selezionato: ${logoAnimation}`);
  }

  // Override if user forced it
  if (animForce && ['flip-3d', 'zoom-fade', 'slide-up'].includes(animForce)) {
    logoAnimation = animForce;
    console.log(`  → Override manuale: ${logoAnimation}`);
  }

  // Copy logo to public/brand/
  const brandDir = path.join(__dirname, 'public', 'brand');
  await mkdir(brandDir, { recursive: true });
  const destFileName = `logo${ext}`;
  const destPath = path.join(brandDir, destFileName);
  await copyFile(logoAbs, destPath);
  logoSrc = `brand/${destFileName}`;
  console.log(`  → Logo copiato in: public/${logoSrc}`);
}

// Patch motion-config.ts
const configPath = path.join(__dirname, 'src', 'motion-config.ts');
const configSrc  = await readFile(configPath, 'utf-8');
const patched    = patchConfig(configSrc, { name, tagline, logoSrc, logoAnimation, primary });

if (patched === configSrc) {
  console.warn('\nAttenzione: nessuna modifica rilevata in motion-config.ts. Controlla i pattern.');
} else {
  await writeFile(configPath, patched, 'utf-8');
  console.log('\n✓ motion-config.ts aggiornato:');
  console.log(`  brand.name:          ${name}`);
  if (tagline)       console.log(`  brand.tagline:       ${tagline}`);
  if (logoSrc)       console.log(`  brand.logoSrc:       ${logoSrc}`);
  console.log(`  brand.logoAnimation: ${logoAnimation}`);
  if (primary)       console.log(`  palette.primary:     ${primary}`);
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Brand configurato! Prossimi passi:
  1. npm run studio            → anteprima nel browser
  2. npm run generate-motion-sounds  → genera i suoni (solo prima volta)
  3. node parse-script.mjs --input=... → crea le scene del video
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

console.log('Stili disponibili:');
console.log('  flip-3d   → perfetto per icone e loghi quadrati');
console.log('  zoom-fade → universale, per loghi larghi');
console.log('  slide-up  → wordmark/testo su sfondo trasparente');
console.log('\nPer forzare uno stile: --animation=flip-3d|zoom-fade|slide-up');
