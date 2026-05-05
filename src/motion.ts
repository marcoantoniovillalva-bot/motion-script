import type { CaptionChunk, Scene } from './types';

export function activeCaption(captions: CaptionChunk[] | undefined, second: number) {
  return captions?.find((caption) => second >= caption.start && second < caption.end);
}

export function sceneProgress(scene: Scene | undefined, second: number) {
  if (!scene) return 0;
  const duration = Math.max(scene.end - scene.start, 1);
  return Math.min(Math.max((second - scene.start) / duration, 0), 1);
}

export function emphasisLevel(scene: Scene | undefined, caption: CaptionChunk | undefined) {
  if (caption?.importance === 'high') return 2;
  if (caption?.importance === 'medium') return 1;
  const role = String(scene?.role || '').toLowerCase();
  if (['hook', 'solution', 'cta', 'intro'].some((item) => role.includes(item))) return 1;
  return 0;
}

export function microZoom(scene: Scene | undefined, second: number, level: number) {
  const progress = sceneProgress(scene, second);
  const breath = Math.sin(progress * Math.PI);
  const base = 1 + progress * 0.012;
  const emphasis = level === 2 ? breath * 0.034 : level === 1 ? breath * 0.02 : breath * 0.008;
  return base + emphasis;
}

export function microPan(scene: Scene | undefined, second: number, level: number) {
  const progress = sceneProgress(scene, second);
  const direction = String(scene?.role || '').length % 2 === 0 ? 1 : -1;
  const amount = level === 2 ? 16 : level === 1 ? 9 : 4;
  return {
    x: Math.sin(progress * Math.PI) * amount * direction,
    y: Math.cos(progress * Math.PI * 0.7) * amount * 0.35,
  };
}
