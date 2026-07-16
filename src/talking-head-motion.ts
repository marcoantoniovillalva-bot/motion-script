import { interpolate } from 'remotion';
import type { FaceSample, FaceTrack, ZoomBeat } from './talking-head-types';

/** Linearly interpolate the sparse face-track samples at a given time (seconds). */
export function faceAt(track: FaceTrack | undefined, t: number): FaceSample {
  const fallback: FaceSample = { t, cx: 0.5, cy: 0.35, faceW: 0.25, faceH: 0.2, chinY: 0.45 };
  const samples = track?.samples;
  if (!samples || samples.length === 0) return fallback;
  if (t <= samples[0].t) return samples[0];
  if (t >= samples[samples.length - 1].t) return samples[samples.length - 1];

  // samples are evenly spaced (1/sampleFps) — index directly instead of scanning.
  const fps = track!.sampleFps;
  const idx = Math.min(samples.length - 2, Math.floor(t * fps));
  const a = samples[idx];
  const b = samples[idx + 1] ?? a;
  const span = b.t - a.t || 1;
  const ratio = Math.min(1, Math.max(0, (t - a.t) / span));
  return {
    t,
    cx: a.cx + (b.cx - a.cx) * ratio,
    cy: a.cy + (b.cy - a.cy) * ratio,
    faceW: a.faceW + (b.faceW - a.faceW) * ratio,
    faceH: a.faceH + (b.faceH - a.faceH) * ratio,
    chinY: a.chinY + (b.chinY - a.chinY) * ratio,
  };
}

function findBeat(beats: ZoomBeat[], t: number): ZoomBeat | undefined {
  return beats.find((b) => t >= b.start && t < b.end) ?? beats[beats.length - 1];
}

/** Each beat is self-contained: it always returns to scale 1.0 by its own end, so
 *  adjacent beats never produce a visible jump at the boundary. */
export function zoomScaleAt(beats: ZoomBeat[] | undefined, t: number): number {
  if (!beats || beats.length === 0) return 1;
  const beat = findBeat(beats, t);
  if (!beat) return 1;
  const { start, end, style, targetScale } = beat;

  if (style === 'static') return 1;

  if (style === 'fast-in-out') {
    const dur = Math.max(end - start, 0.01);
    return interpolate(
      t,
      [start, start + dur * 0.3, start + dur * 0.7, end],
      [1, targetScale, targetScale, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
  }

  // slow-push: gradual push-in across most of the block, quick release at the very end.
  const dur = Math.max(end - start, 0.01);
  return interpolate(
    t,
    [start, start + dur * 0.85, end],
    [1, targetScale, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
}

/** Time-smoothed face sample: triangular-weighted average of the sparse face-track
 *  samples in a window around `t`. Raw per-sample chin positions jitter by ~±0.02
 *  (≈±38px at 1080x1920), which made chin-anchored captions visibly tremble — the old
 *  workaround was a fixed rest line (REST_CHIN_Y 0.524), but that parked captions ~120px
 *  below the actual chin, down on the chest. Smoothing the face signal instead lets the
 *  caption hug the chin while staying calm; zoom reactivity is NOT smoothed away because
 *  the (already-smooth) `scale` is applied after this, in captionAnchorY. Triangular
 *  weights (not a boxcar) so the result moves continuously as the window slides across
 *  the discrete 6fps samples. */
export function smoothedFaceAt(track: FaceTrack | undefined, t: number, windowSeconds = 0.8): FaceSample {
  const samples = track?.samples;
  if (!samples || samples.length === 0) return faceAt(track, t);
  const fps = track!.sampleFps;
  const half = windowSeconds / 2;
  const i0 = Math.max(0, Math.floor((t - half) * fps));
  const i1 = Math.min(samples.length - 1, Math.ceil((t + half) * fps));
  let cx = 0, cy = 0, faceW = 0, faceH = 0, chinY = 0, total = 0;
  for (let i = i0; i <= i1; i++) {
    const s = samples[i];
    const w = Math.max(0, 1 - Math.abs(s.t - t) / half);
    if (w <= 0) continue;
    cx += s.cx * w;
    cy += s.cy * w;
    faceW += s.faceW * w;
    faceH += s.faceH * w;
    chinY += s.chinY * w;
    total += w;
  }
  if (total === 0) return faceAt(track, t);
  return { t, cx: cx / total, cy: cy / total, faceW: faceW / total, faceH: faceH / total, chinY: chinY / total };
}

/** On-screen chin position for a (smoothed) face sample under the current zoom.
 *  The video is transformed with `scale(scale)` around `transformOrigin: face.cx% face.cy%`,
 *  so the chin's ON-SCREEN position after that transform is `cy + (chinY - cy) * scale` —
 *  not the raw tracked chinY. Captions anchor here directly (just below the chin at every
 *  zoom level — the band below them stays free for future b-roll overlays); the clamp only
 *  guards against tracker glitches sending them off to unusable positions. */
export function captionAnchorY(face: FaceSample, scale: number): number {
  const screenChinY = face.cy + (face.chinY - face.cy) * scale;
  return Math.min(0.6, Math.max(0.3, screenChinY));
}
