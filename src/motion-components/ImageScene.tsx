import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import type { MotionScriptScene } from '../motion-script-types';

const CROSSFADE_FRAMES = 18;

const KenBurnsImage: React.FC<{
  src: string;
  localFrame: number;      // frame within this image's window
  durationFrames: number;
  opacity: number;
  panDir: number;          // -1 or 1 for horizontal pan direction
}> = ({ src, localFrame, durationFrames, opacity, panDir }) => {
  const progress = durationFrames > 0 ? localFrame / durationFrames : 0;
  const scale = interpolate(progress, [0, 1], [1.06, 1.16], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const panX = interpolate(progress, [0, 1], [0, panDir * 2.5], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const panY = interpolate(progress, [0, 1], [0, -1.5], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', inset: 0, opacity }}>
      <Img
        src={staticFile(src)}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translate(${panX}%, ${panY}%)`,
          transformOrigin: 'center center',
        }}
      />
    </div>
  );
};

export const ImageScene: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;

  const visual = scene.visual as { kind: 'photo'; src?: string; srcs?: string[]; attribution?: string };

  // Normalise to array — prefer srcs, fall back to src
  const rawSrcs = visual.srcs?.length ? visual.srcs : (visual.src ? [visual.src] : []);
  const srcs = rawSrcs.filter(Boolean);

  const duration = scene.end - scene.start;
  const totalFrames = Math.round(duration * fps);
  const isVertical = height > width;

  // Slide timing — each image gets an equal slice
  const count = srcs.length;
  const sliceDuration = count > 0 ? totalFrames / count : totalFrames;

  // Text animations
  const textEntry = spring({ frame: Math.max(0, frame - 8), fps, config: { stiffness: 120, damping: 18 } });
  const subtextEntry = spring({ frame: Math.max(0, frame - 18), fps, config: { stiffness: 100, damping: 20 } });

  const headlineSize = isVertical ? 78 : 64;
  const subtextSize = isVertical ? 38 : 30;
  const paddingH = isVertical ? 56 : 80;
  const paddingB = isVertical ? 80 : 60;

  // Build per-image opacity with cross-fade
  const imageOpacities = srcs.map((_, i) => {
    const start = i * sliceDuration;
    const end = (i + 1) * sliceDuration;
    const fadeIn = i === 0
      ? 1
      : interpolate(frame, [start - CROSSFADE_FRAMES, start + CROSSFADE_FRAMES], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const fadeOut = i === count - 1
      ? 1
      : interpolate(frame, [end - CROSSFADE_FRAMES, end + CROSSFADE_FRAMES], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return Math.min(fadeIn, fadeOut);
  });

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* Images — stacked, cross-fading */}
      {srcs.length > 0 ? (
        srcs.map((src, i) => {
          if (imageOpacities[i] < 0.01) return null;
          const localFrame = frame - i * sliceDuration;
          return (
            <KenBurnsImage
              key={i}
              src={src}
              localFrame={localFrame}
              durationFrames={sliceDuration}
              opacity={imageOpacities[i]}
              panDir={i % 2 === 0 ? -1 : 1}
            />
          );
        })
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${scene.bg ?? '#1a1a2e'}, #16213e)` }} />
      )}

      {/* Gradient overlays for text legibility */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.0) 35%, rgba(0,0,0,0.88) 100%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to right, rgba(0,0,0,0.45) 0%, transparent 55%)',
      }} />

      {/* Text block — bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        padding: `0 ${paddingH}px ${paddingB}px`,
      }}>
        {scene.headline && (
          <div style={{
            color: '#FFFFFF',
            fontFamily: cfg.fonts.headline,
            fontSize: headlineSize,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: '-1px',
            textShadow: '0 4px 24px rgba(0,0,0,0.85)',
            transform: `translateY(${(1 - textEntry) * 50}px)`,
            opacity: textEntry,
            marginBottom: 16,
          }}>
            {scene.headline}
          </div>
        )}
        {scene.subtext && (
          <div style={{
            color: 'rgba(255,255,255,0.82)',
            fontFamily: cfg.fonts.body,
            fontSize: subtextSize,
            fontWeight: 400,
            textShadow: '0 2px 12px rgba(0,0,0,0.7)',
            transform: `translateY(${(1 - subtextEntry) * 30}px)`,
            opacity: subtextEntry,
          }}>
            {scene.subtext}
          </div>
        )}
      </div>

      {/* Accent bar — left */}
      <div style={{
        position: 'absolute',
        left: paddingH - 20,
        bottom: paddingB,
        top: '60%',
        width: 4,
        background: cfg.palette.primary,
        boxShadow: `0 0 12px 2px ${cfg.palette.primary}88`,
        opacity: textEntry,
        borderRadius: 2,
      }} />

      {/* Slide counter dots — bottom center (only if multiple images) */}
      {count > 1 && (
        <div style={{
          position: 'absolute',
          bottom: isVertical ? 20 : 16,
          left: 0, right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
        }}>
          {srcs.map((_, i) => {
            const activeIdx = Math.min(count - 1, Math.floor(frame / sliceDuration));
            return (
              <div key={i} style={{
                width: i === activeIdx ? 20 : 8,
                height: 4,
                borderRadius: 2,
                background: i === activeIdx ? cfg.palette.primary : 'rgba(255,255,255,0.3)',
                transition: 'all 0.3s',
              }} />
            );
          })}
        </div>
      )}

      {/* Attribution badge */}
      {visual.attribution && (
        <div style={{
          position: 'absolute',
          bottom: isVertical ? 36 : 28,
          right: paddingH,
          color: 'rgba(255,255,255,0.4)',
          fontFamily: cfg.fonts.code,
          fontSize: isVertical ? 18 : 14,
          letterSpacing: '1px',
          opacity: subtextEntry,
        }}>
          © {visual.attribution}
        </div>
      )}
    </AbsoluteFill>
  );
};
