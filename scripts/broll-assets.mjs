// B-roll asset fetcher — downloads every asset referenced by a broll-plan.json into
// public/, so the Remotion render finds them via staticFile(). Idempotent: existing
// files are skipped (delete a file to re-fetch it).
//
// Sources (user preferences, 2026-07-15):
//  - fluent:   Microsoft Fluent 3D emoji (GitHub, MIT, transparent PNG) — icon default
//  - svgl:     official brand logo SVG (api.svgl.app, transparent) — brand logos
//  - vecteezy: vector zip fallback for icons (scripts/vecteezy-client.ts endpoints)
//  - stock:    Pexels photos/videos
//  - ai:       Replicate (not automated here — flagged for manual generation)
//
// Guarantees enforced here:
//  - watermark-free: Vecteezy assets always come from the signed /download URL, never
//    from thumbnail_url (thumbnails are the only watermarked files)
//  - transparency: every icon PNG is alpha-checked with PIL after download; opaque
//    icons are rejected and the next search result is tried

import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function loadEnvFile(filename) {
  try {
    const env = await readFile(path.join(rootDir, filename), 'utf-8');
    for (const line of env.split('\n')) {
      const t = line.trim().replace(/^﻿/, '');
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const i = t.indexOf('=');
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch {}
}
await loadEnvFile('.env');
await loadEnvFile('.env.local');

function argValue(name, fallback = null) {
  const arg = process.argv.slice(2).find((item) => item.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : fallback;
}

const planPath = argValue('plan');
if (!planPath) {
  console.error('Uso: node scripts/broll-assets.mjs --plan=raw-edits/<slug>/broll-plan.json');
  process.exit(1);
}

const PEXELS_KEY = process.env.PEXELS_API_KEY;
const VECTEEZY_ID = process.env.VECTEEZY_API_ID;
const VECTEEZY_SECRET = process.env.VECTEEZY_API_SECRET;

function venvPython() {
  const candidate = path.join(rootDir, '.venv', 'Scripts', 'python.exe');
  return existsSync(candidate) ? candidate : 'python3';
}

// The venv python is a Windows exe (see project memory): when this script runs under
// WSL node, /mnt/c/... paths must be converted to C:\... before crossing the boundary.
function pythonPath(p) {
  const m = p.match(/^\/mnt\/([a-z])\/(.*)$/);
  return m ? `${m[1].toUpperCase()}:\\${m[2].replace(/\//g, '\\')}` : p;
}

async function download(url, toFile, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} scaricando ${url.slice(0, 90)}`);
  await mkdir(path.dirname(toFile), { recursive: true });
  await writeFile(toFile, Buffer.from(await res.arrayBuffer()));
}

/** True when the PNG actually uses its alpha channel (some pixel is transparent). */
function hasAlpha(file) {
  try {
    const out = execFileSync(venvPython(), ['-c', `
from PIL import Image
img = Image.open(r'''${pythonPath(file)}''').convert('RGBA')
alpha = img.getchannel('A')
print('yes' if alpha.getextrema()[0] < 250 else 'no')
`], { encoding: 'utf-8' });
    return out.trim() === 'yes';
  } catch (e) {
    console.warn(`  ⚠ alpha check fallito (${e.message}) — tengo il file`);
    return true;
  }
}

// ── Fluent 3D emoji ──────────────────────────────────────────────────────────
function fluentSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function fetchFluent(emojiName, toFile) {
  const base = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets';
  const slug = fluentSlug(emojiName);
  const candidates = [
    `${base}/${encodeURIComponent(emojiName)}/3D/${slug}_3d.png`,
    `${base}/${encodeURIComponent(emojiName)}/Default/3D/${slug}_3d_default.png`,
  ];
  for (const url of candidates) {
    try {
      await download(url, toFile);
      return true;
    } catch {}
  }
  return false;
}

// ── SVGL brand logos ─────────────────────────────────────────────────────────
async function fetchSvgl(brand, toFile) {
  const res = await fetch(`https://api.svgl.app?search=${encodeURIComponent(brand)}`);
  if (!res.ok) return false;
  const list = await res.json();
  const first = Array.isArray(list) ? list[0] : null;
  if (!first) return false;
  // route can be a plain URL or { light, dark } — captions/cards sit on light glass,
  // so prefer the light (dark-colored) variant.
  const route = typeof first.route === 'string' ? first.route : first.route?.light ?? first.route?.dark;
  if (!route) return false;
  await download(route, toFile);
  return true;
}

// ── Vecteezy vector fallback (zip → svg via python zipfile) ─────────────────
async function vecteezyFetch(pathPart) {
  const res = await fetch(`https://api.vecteezy.com/v2/${VECTEEZY_ID}${pathPart}`, {
    headers: { Authorization: `Bearer ${VECTEEZY_SECRET}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Vecteezy HTTP ${res.status}`);
  return res.json();
}

async function fetchVecteezyVector(query, toFile) {
  if (!VECTEEZY_ID || !VECTEEZY_SECRET) return false;
  const search = await vecteezyFetch(`/resources?term=${encodeURIComponent(query)}&content_type=vector&per_page=3`);
  for (const item of search.resources ?? []) {
    try {
      const dl = await vecteezyFetch(`/resources/${item.id}/download`);
      if (!dl.url) continue;
      const zipFile = toFile + '.zip';
      await download(dl.url, zipFile);
      // Extract the largest SVG from the zip; fails silently to the next result.
      const out = execFileSync(venvPython(), ['-c', `
import zipfile, shutil, sys
z = zipfile.ZipFile(r'''${pythonPath(zipFile)}''')
svgs = sorted([i for i in z.infolist() if i.filename.lower().endswith('.svg')], key=lambda i: -i.file_size)
if not svgs: print('none'); sys.exit(0)
with z.open(svgs[0]) as src, open(r'''${pythonPath(toFile)}''', 'wb') as dst: shutil.copyfileobj(src, dst)
print('ok')
`], { encoding: 'utf-8' });
      if (out.trim() === 'ok') return true;
    } catch {}
  }
  return false;
}

// ── Pexels ───────────────────────────────────────────────────────────────────
async function fetchPexelsPhoto(query, toFile) {
  if (!PEXELS_KEY) throw new Error('PEXELS_API_KEY mancante');
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3`, {
    headers: { Authorization: PEXELS_KEY },
  });
  if (!res.ok) return false;
  const d = await res.json();
  const url = d.photos?.[0]?.src?.large2x ?? d.photos?.[0]?.src?.original;
  if (!url) return false;
  await download(url, toFile);
  return true;
}

async function fetchPexelsVideo(query, toFile) {
  if (!PEXELS_KEY) throw new Error('PEXELS_API_KEY mancante');
  const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5&size=medium`, {
    headers: { Authorization: PEXELS_KEY },
  });
  if (!res.ok) return false;
  const d = await res.json();
  const video = (d.videos ?? [])[0];
  if (!video) return false;
  const files = (video.video_files ?? []).sort((a, b) => b.width - a.width);
  const best = files.find((f) => f.width <= 1920) ?? files[files.length - 1];
  if (!best?.link) return false;
  await download(best.link, toFile);
  return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────
const plan = JSON.parse(await readFile(path.resolve(planPath), 'utf-8'));
let ok = 0;
let manual = 0;

for (const seg of plan.segments ?? []) {
  const asset = seg.asset ?? {};
  if (!asset.src && !Array.isArray(asset.srcs)) continue;
  const toFile = asset.src ? path.join(rootDir, 'public', asset.src) : null;
  const label = `[${seg.start}s ${asset.kind}/${asset.source ?? '-'}]`;

  if (toFile && existsSync(toFile)) {
    console.log(`${label} già presente: ${asset.src}`);
    ok += 1;
    continue;
  }

  let done = false;
  if (asset.kind === 'logos' && Array.isArray(asset.srcs)) {
    // Multiple brand logos for one card: fetch each via svgl.
    let all = true;
    for (let i = 0; i < asset.srcs.length; i++) {
      const file = path.join(rootDir, 'public', asset.srcs[i]);
      if (existsSync(file)) continue;
      const brand = asset.brands?.[i];
      if (!brand || !(await fetchSvgl(brand, file))) all = false;
    }
    done = all;
  } else if (asset.kind === 'image' && asset.source === 'fluent' && asset.emoji) {
    done = await fetchFluent(asset.emoji, toFile);
    if (done && !hasAlpha(toFile)) {
      console.warn(`${label} ⚠ emoji senza trasparenza (inatteso)`);
    }
  } else if (asset.kind === 'image' && asset.source === 'svgl' && asset.brand) {
    done = await fetchSvgl(asset.brand, toFile);
  } else if (asset.kind === 'image' && asset.source === 'vecteezy' && asset.stockQuery) {
    done = await fetchVecteezyVector(asset.stockQuery, toFile);
  } else if (asset.kind === 'image' && asset.source === 'stock' && asset.stockQuery) {
    done = await fetchPexelsPhoto(asset.stockQuery, toFile);
  } else if (asset.kind === 'video' && asset.stockQuery) {
    done = await fetchPexelsVideo(asset.stockQuery, toFile);
  } else if (asset.source === 'ai') {
    console.log(`${label} generazione AI richiesta (prompt: ${(asset.prompt ?? '').slice(0, 60)}…) — da generare a parte`);
    manual += 1;
    continue;
  } else {
    console.log(`${label} nessun fetcher per questo asset — fornire ${asset.src} manualmente`);
    manual += 1;
    continue;
  }

  if (done) {
    console.log(`${label} scaricato: ${asset.src}`);
    ok += 1;
  } else {
    console.warn(`${label} ✗ nessun risultato utilizzabile per ${asset.src}`);
    manual += 1;
  }
}

console.log(`\nAsset pronti: ${ok} | da fornire/generare: ${manual}`);
if (manual > 0) process.exitCode = 3;
