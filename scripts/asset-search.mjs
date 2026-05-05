import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
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

async function readEnv() {
  const envPath = path.join(rootDir, '.env.local');
  if (!existsSync(envPath)) return {};
  const content = await readFile(envPath, 'utf-8');
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const [key, ...rest] = line.split('=');
        return [key.replace(/^\uFEFF/, '').trim(), rest.join('=').trim()];
      }),
  );
}

function sceneQuery(scene, title) {
  const role = String(scene.role || '').toLowerCase();
  const text = `${scene.onScreenText || ''} ${scene.voiceoverCue || ''} ${title || ''}`.toLowerCase();

  if (role.includes('hook')) {
    return 'business owner leads laptop';
  }
  if (role.includes('problem')) {
    return 'customer service messages laptop office';
  }
  if (role.includes('solution')) {
    return 'artificial intelligence automation dashboard laptop';
  }
  if (role.includes('example')) {
    return 'software dashboard analytics computer';
  }
  if (role.includes('cta')) {
    return 'small business owner shop laptop';
  }
  if (/client|lead|lista/.test(text)) {
    return 'business owner customer leads laptop';
  }
  if (/manual|rispost|monitor/.test(text)) {
    return 'customer service messages laptop office';
  }
  if (/automat|ai|analizza/.test(text)) {
    return 'artificial intelligence automation dashboard laptop';
  }
  if (/software|24/.test(text)) {
    return 'software dashboard analytics computer';
  }
  if (/negozio|efficienza|bio/.test(text)) {
    return 'small business owner shop laptop';
  }
  return 'business technology laptop';
}

function placementForRole(role = '') {
  const normalized = role.toLowerCase();
  if (normalized.includes('hook')) return 'top-right';
  if (normalized.includes('problem')) return 'bottom-right';
  if (normalized.includes('solution')) return 'side-card';
  if (normalized.includes('example')) return 'side-card';
  return 'bottom-left';
}

function scorePexelsVideo(video) {
  const vertical = video.height > video.width ? 25 : 0;
  const hd = video.width >= 1080 || video.height >= 1080 ? 12 : 0;
  const duration = video.duration >= 2 && video.duration <= 18 ? 10 : 0;
  return vertical + hd + duration;
}

function bestPexelsFile(video) {
  const files = [...(video.video_files || [])].sort((a, b) => {
    const aVertical = a.height > a.width ? 1 : 0;
    const bVertical = b.height > b.width ? 1 : 0;
    const aPixels = (a.width || 0) * (a.height || 0);
    const bPixels = (b.width || 0) * (b.height || 0);
    return bVertical - aVertical || bPixels - aPixels;
  });
  return files.find((file) => file.link) || null;
}

async function searchPexelsVideos(query, apiKey) {
  if (!apiKey) return [];
  const url = new URL('https://api.pexels.com/videos/search');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', 'portrait');
  url.searchParams.set('per_page', '4');

  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) {
    throw new Error(`Pexels videos failed ${response.status}: ${await response.text()}`);
  }
  const json = await response.json();
  return (json.videos || []).map((video) => {
    const file = bestPexelsFile(video);
    return {
      provider: 'pexels',
      kind: 'video',
      providerId: String(video.id),
      title: query,
      previewUrl: video.image,
      pageUrl: video.url,
      downloadUrl: file?.link,
      width: file?.width || video.width,
      height: file?.height || video.height,
      duration: video.duration,
      creator: video.user?.name,
      license: 'Pexels License',
      score: scorePexelsVideo(video),
    };
  }).filter((item) => item.downloadUrl);
}

async function searchPexelsPhotos(query, apiKey) {
  if (!apiKey) return [];
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('orientation', 'portrait');
  url.searchParams.set('per_page', '3');

  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) {
    throw new Error(`Pexels photos failed ${response.status}: ${await response.text()}`);
  }
  const json = await response.json();
  return (json.photos || []).map((photo) => ({
    provider: 'pexels',
    kind: 'image',
    providerId: String(photo.id),
    title: photo.alt || query,
    previewUrl: photo.src?.medium,
    pageUrl: photo.url,
    downloadUrl: photo.src?.large2x || photo.src?.original,
    width: photo.width,
    height: photo.height,
    duration: null,
    creator: photo.photographer,
    license: 'Pexels License',
    score: (photo.height > photo.width ? 18 : 0) + 8,
  })).filter((item) => item.downloadUrl);
}

async function searchPixabay(query, apiKey, kind) {
  if (!apiKey) return [];
  const endpoint = kind === 'video' ? 'https://pixabay.com/api/videos/' : 'https://pixabay.com/api/';
  const url = new URL(endpoint);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('per_page', '4');
  url.searchParams.set('safesearch', 'true');
  url.searchParams.set('orientation', 'vertical');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Pixabay ${kind} failed ${response.status}: ${await response.text()}`);
  }
  const json = await response.json();
  return (json.hits || [])
    .filter((hit) => {
      const tags = String(hit.tags || '').toLowerCase();
      if (/(dog|cat|animal|pet|nature|flower|beach|mountain)/.test(tags)) return false;
      return true;
    })
    .map((hit) => {
    const videoFile = hit.videos?.large || hit.videos?.medium || hit.videos?.small;
    return {
      provider: 'pixabay',
      kind,
      providerId: String(hit.id),
      title: hit.tags || query,
      previewUrl: kind === 'video' ? hit.picture_id ? `https://i.vimeocdn.com/video/${hit.picture_id}_640x360.jpg` : null : hit.webformatURL,
      pageUrl: hit.pageURL,
      downloadUrl: kind === 'video' ? videoFile?.url : hit.largeImageURL || hit.webformatURL,
      width: kind === 'video' ? videoFile?.width : hit.imageWidth,
      height: kind === 'video' ? videoFile?.height : hit.imageHeight,
      duration: kind === 'video' ? hit.duration : null,
      creator: hit.user,
      license: 'Pixabay Content License',
      score: ((kind === 'video' && videoFile?.height > videoFile?.width) || (kind === 'image' && hit.imageHeight > hit.imageWidth) ? 18 : 0) + 8,
    };
    }).filter((item) => item.downloadUrl);
}

function markdownReport(output) {
  const grouped = new Map();
  for (const candidate of output.candidates) {
    const group = grouped.get(candidate.sceneRole) || [];
    group.push(candidate);
    grouped.set(candidate.sceneRole, group);
  }

  const lines = [
    `# Asset Candidates - ${output.week} ${output.day}`,
    '',
    'Apri i link, scegli gli asset migliori e poi imposta `approved: true` nel JSON dei candidati.',
    '',
    `JSON: public/asset-candidates/${output.week}/${slugify(output.day)}.candidates.json`,
    '',
  ];

  if (output.providerErrors.length) {
    lines.push('## Provider Notes', '');
    for (const error of output.providerErrors) {
      lines.push(`- ${error.provider}: ${error.message}`);
    }
    lines.push('');
  }

  for (const [role, candidates] of grouped.entries()) {
    lines.push(`## ${role}`, '');
    for (const candidate of candidates.slice(0, 6)) {
      lines.push(`- ID: \`${candidate.id}\``);
      lines.push(`  Provider: ${candidate.provider} / ${candidate.kind}`);
      lines.push(`  Query: ${candidate.query}`);
      lines.push(`  Timing: ${candidate.start}s - ${candidate.end}s`);
      lines.push(`  Link: ${candidate.pageUrl}`);
      if (candidate.previewUrl) lines.push(`  Preview: ${candidate.previewUrl}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

async function main() {
  const week = argValue('week');
  const day = argValue('day');
  if (!week || !day) {
    console.error('Usage: npm run assets:search -- --week=2026-W18 --day=giovedi');
    process.exit(1);
  }

  const daySlug = slugify(day);
  const propsPath = path.join(rootDir, 'props', week, `${daySlug}.json`);
  const captionsPath = path.join(rootDir, 'public', 'captions', week, `${daySlug}.json`);
  if (!existsSync(propsPath)) throw new Error(`Props not found: ${propsPath}`);

  const env = await readEnv();
  const props = JSON.parse(await readFile(propsPath, 'utf-8'));
  const captions = existsSync(captionsPath)
    ? JSON.parse(await readFile(captionsPath, 'utf-8')).chunks || []
    : [];

  const candidates = [];
  const providerErrors = [];
  async function safeSearch(label, searcher) {
    try {
      return await searcher();
    } catch (error) {
      providerErrors.push({
        provider: label,
        message: error.message || String(error),
      });
      console.warn(`Skipping ${label}: ${error.message || error}`);
      return [];
    }
  }

  for (const [sceneIndex, scene] of (props.scenes || []).entries()) {
    const query = sceneQuery(scene, props.title);
    const start = Math.max(scene.start + 0.2, scene.start);
    const end = Math.min(scene.end, scene.start + (scene.role === 'hook' ? 3.8 : 4.5));
    const placement = placementForRole(scene.role);
    const sound = scene.role === 'hook' ? 'pop' : scene.role === 'solution' ? 'ui-blip' : 'whoosh';

    const results = [
      ...(await safeSearch('pexels-videos', () => searchPexelsVideos(query, env.PEXELS_API_KEY))),
      ...(await safeSearch('pixabay-videos', () => searchPixabay(query, env.PIXABAY_API_KEY, 'video'))),
      ...(await safeSearch('pexels-photos', () => searchPexelsPhotos(query, env.PEXELS_API_KEY))),
      ...(await safeSearch('pixabay-images', () => searchPixabay(query, env.PIXABAY_API_KEY, 'image'))),
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((asset, assetIndex) => ({
        id: `${slugify(scene.role)}-${sceneIndex}-${asset.provider}-${asset.kind}-${asset.providerId}`,
        approved: false,
        sceneRole: scene.role,
        sceneText: scene.onScreenText,
        query,
        start,
        end,
        placement,
        animation: asset.kind === 'video' ? 'slide' : 'pop',
        sound,
        ...asset,
        rank: assetIndex + 1,
      }));

    candidates.push(...results);
  }

  const output = {
    format: 'marketizzati-asset-candidates-v1',
    week,
    day,
    generatedAt: new Date().toISOString(),
    approvalInstructions: 'Set approved=true on the assets you want, save as public/asset-plans/<week>/<day>.approved.json, then run npm run assets:download -- --week=<week> --day=<day>.',
    sources: {
      pexels: Boolean(env.PEXELS_API_KEY),
      pixabay: Boolean(env.PIXABAY_API_KEY),
    },
    providerErrors,
    captionsPreview: captions.slice(0, 6).map((caption) => ({
      start: caption.start,
      end: caption.end,
      text: caption.text,
    })),
    candidates,
  };

  const outDir = path.join(rootDir, 'public', 'asset-candidates', week);
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${daySlug}.candidates.json`);
  await writeFile(outPath, JSON.stringify(output, null, 2), 'utf-8');
  const reportPath = path.join(outDir, `${daySlug}.candidates.md`);
  await writeFile(reportPath, markdownReport(output), 'utf-8');

  console.log(`Wrote ${candidates.length} candidates: ${outPath}`);
  console.log(`Wrote review report: ${reportPath}`);
  for (const candidate of candidates.slice(0, 12)) {
    console.log(`${candidate.rank}. [${candidate.sceneRole}] ${candidate.provider}/${candidate.kind} ${candidate.title} -> ${candidate.pageUrl}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
