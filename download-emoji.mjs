import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'public', 'emoji');
const BASE = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets';

// [emoji, folder, filebase, subpath?]
// subpath defaults to "3D" — skin-tone emojis use "Default/3D" and have "_default" suffix
const EMOJI_ASSETS = [
  // Standard emojis (folder/3D/base_3d.png)
  ['🚀', 'Rocket', 'rocket'],
  ['🤖', 'Robot', 'robot'],
  ['💻', 'Laptop', 'laptop'],
  ['⚙️', 'Gear', 'gear'],
  ['🔧', 'Wrench', 'wrench'],
  ['🛠️', 'Hammer and wrench', 'hammer_and_wrench'],
  ['🐙', 'Octopus', 'octopus'],
  ['🔗', 'Link', 'link'],
  ['📱', 'Mobile phone', 'mobile_phone'],
  ['🌐', 'Globe with meridians', 'globe_with_meridians'],
  ['🔄', 'Counterclockwise arrows button', 'counterclockwise_arrows_button'],
  ['📦', 'Package', 'package'],
  ['📊', 'Bar chart', 'bar_chart'],
  ['📈', 'Chart increasing', 'chart_increasing'],
  ['💰', 'Money bag', 'money_bag'],
  ['💎', 'Gem stone', 'gem_stone'],
  ['🎯', 'Bullseye', 'bullseye'],
  ['📣', 'Megaphone', 'megaphone'],
  ['🎨', 'Artist palette', 'artist_palette'],
  ['🔑', 'Key', 'key'],
  ['⭐', 'Star', 'star'],
  ['🏆', 'Trophy', 'trophy'],
  ['👥', 'Busts in silhouette', 'busts_in_silhouette'],
  ['💬', 'Speech balloon', 'speech_balloon'],
  ['💡', 'Light bulb', 'light_bulb'],
  ['📝', 'Memo', 'memo'],
  ['📋', 'Clipboard', 'clipboard'],
  ['🎓', 'Graduation cap', 'graduation_cap'],
  ['🧩', 'Puzzle piece', 'puzzle_piece'],
  ['📚', 'Books', 'books'],
  ['⚡', 'High voltage', 'high_voltage'],
  ['⏱️', 'Stopwatch', 'stopwatch'],
  ['🔥', 'Fire', 'fire'],
  ['✨', 'Sparkles', 'sparkles'],
  ['🎬', 'Clapper board', 'clapper_board'],
  ['🎉', 'Party popper', 'party_popper'],
  ['✅', 'Check mark button', 'check_mark_button'],
  ['❌', 'Cross mark', 'cross_mark'],
  ['⚠️', 'Warning', 'warning'],
  ['😓', 'Downcast face with sweat', 'downcast_face_with_sweat'],
  ['😊', 'Smiling face with smiling eyes', 'smiling_face_with_smiling_eyes'],
  ['🧠', 'Brain', 'brain'],
  ['🔍', 'Magnifying glass tilted right', 'magnifying_glass_tilted_right'],
  ['⚖️', 'Balance scale', 'balance_scale'],
  ['🧮', 'Abacus', 'abacus'],
  ['🖼️', 'Framed picture', 'framed_picture'],
  ['🎵', 'Musical note', 'musical_note'],
  ['👤', 'Bust in silhouette', 'bust_in_silhouette'],
  ['❓', 'Red question mark', 'red_question_mark'],
  ['🌍', 'Globe showing europe-africa', 'globe_showing_europe-africa'],
  ['🔒', 'Locked', 'locked'],
  ['💼', 'Briefcase', 'briefcase'],
  ['🎙️', 'Studio microphone', 'studio_microphone'],
  ['🚗', 'Automobile', 'automobile'],
  ['🔬', 'Microscope', 'microscope'],
  ['🎤', 'Microphone', 'microphone'],
  ['📡', 'Satellite antenna', 'satellite_antenna'],
  ['🏗️', 'Building construction', 'building_construction'],
  ['🧬', 'DNA double helix', 'dna_double_helix'],
  // Skin-tone emojis — use Default/3D subfolder, filename has _default suffix
  ['💪', 'Flexed biceps', 'flexed_biceps', 'Default/3D', '_default'],
  ['👋', 'Waving hand', 'waving_hand', 'Default/3D', '_default'],
  ['👨‍💻', 'Man technologist', 'man_technologist', 'Default/3D', '_default'],
];

async function downloadEmoji(emoji, folder, base, subpath = '3D', suffix = '') {
  const filename = `${base}_3d${suffix}.png`;
  const localName = `${base}_3d.png`; // always save without suffix for simplicity
  const outPath = path.join(OUT, localName);
  if (existsSync(outPath)) {
    process.stdout.write(`  ✓ skip: ${localName}\n`);
    return { emoji, localName, ok: true };
  }
  const url = `${BASE}/${encodeURIComponent(folder)}/${subpath}/${filename}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      process.stdout.write(`  ✗ ${localName}: HTTP ${res.status} (${url})\n`);
      return { emoji, localName, ok: false };
    }
    const buf = await res.arrayBuffer();
    await writeFile(outPath, Buffer.from(buf));
    process.stdout.write(`  ↓ ${localName} (${Math.round(buf.byteLength / 1024)}KB)\n`);
    return { emoji, localName, ok: true };
  } catch (e) {
    process.stdout.write(`  ✗ ${localName}: ${e.message}\n`);
    return { emoji, localName, ok: false };
  }
}

await mkdir(OUT, { recursive: true });
console.log(`Downloading Fluent Emoji 3D → ${OUT}\n`);

const results = [];
for (const entry of EMOJI_ASSETS) {
  const r = await downloadEmoji(...entry);
  results.push(r);
}

const ok = results.filter(r => r.ok);
const fail = results.filter(r => !r.ok);
console.log(`\n✓ ${ok.length} downloaded/cached, ✗ ${fail.length} failed`);
if (fail.length > 0) console.log('Failed:', fail.map(r => r.localName).join(', '));
