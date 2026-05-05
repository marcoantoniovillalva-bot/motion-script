/**
 * Downloads a curated set of Lottie animations to public/lottie/
 * Source: LottieFiles GraphQL API (public search, no auth required)
 * Run once: npm run download-lottie
 */
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'public', 'lottie');
const GQL = 'https://graphql.lottiefiles.com/2022-08/';

// concept → search query
const CONCEPTS = {
  'neural-network':  'neural network AI deep learning',
  'robot':           'robot artificial intelligence machine',
  'brain':           'brain thinking mind intelligence',
  'data-flow':       'data flow stream analytics',
  'chart-growth':    'chart growth increase success',
  'globe':           'globe earth world network connected',
  'code-terminal':   'code programming terminal developer',
  'warning':         'warning alert danger caution',
  'rocket':          'rocket launch fast speed',
  'idea':            'idea lightbulb innovation creative',
  'lock-security':   'security lock protection privacy',
  'settings':        'settings gear configuration process',
  'check-success':   'success check done complete',
  'clock':           'time clock countdown loading',
  'analytics':       'analytics dashboard statistics data',
  'ai-processing':   'artificial intelligence processing thinking',
  'machine-learning':'machine learning training model',
  'network-nodes':   'network nodes connected graph',
};

async function searchLottie(query) {
  try {
    const res = await fetch(GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query {
          searchPublicAnimations(query: ${JSON.stringify(query)}, first: 5) {
            edges { node { id name jsonUrl } }
          }
        }`,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const edges = data?.data?.searchPublicAnimations?.edges ?? [];
    for (const { node } of edges) {
      if (node.jsonUrl) return { url: node.jsonUrl, name: node.name };
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function downloadLottie(concept, url) {
  const outPath = path.join(OUT, `${concept}.json`);
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const text = await res.text();
    // Validate it's JSON
    JSON.parse(text);
    await writeFile(outPath, text, 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

await mkdir(OUT, { recursive: true });
console.log(`Downloading Lottie animations → ${OUT}\n`);

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const [concept, query] of Object.entries(CONCEPTS)) {
  const outPath = path.join(OUT, `${concept}.json`);
  if (existsSync(outPath)) {
    console.log(`  ✓ skip: ${concept}.json`);
    skipped++;
    continue;
  }

  process.stdout.write(`  Searching "${query}"... `);
  const result = await searchLottie(query);

  if (!result) {
    console.log(`✗ not found`);
    failed++;
    continue;
  }

  const ok = await downloadLottie(concept, result.url);
  if (ok) {
    console.log(`↓ ${concept}.json ("${result.name}")`);
    downloaded++;
  } else {
    console.log(`✗ download failed`);
    failed++;
  }

  // Rate limit respect
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\n✓ ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed concepts will show a fallback emoji in the video.');
  console.log('You can add Lottie JSON files manually to public/lottie/<concept>.json');
}
console.log('\nAvailable concepts for use in scenes:');
console.log(Object.keys(CONCEPTS).map(c => `  "${c}"`).join('\n'));
