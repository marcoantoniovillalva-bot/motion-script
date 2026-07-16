import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
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

  // Text animations — interpolate + bezier ease-out (Remotion best practice: prefer interpolate over spring)
  const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
  const textEntry = interpolate(frame, [8, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const subtextEntry = interpolate(frame, [18, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });

  const headlineSize = isVertical ? 78 : 74;
  const subtextSize = isVertical ? 38 : 34;
  const paddingH = isVertical ? 56 : 80;
  const paddingB = isVertical ? 80 : 70;
  const paddingT = isVertical ? 100 : 70; // top offset for vertical description (safe from social top UI)

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

      {/* Gradient overlays for text legibility — vertical darkens the TOP (text on top),
          horizontal darkens the BOTTOM (text on bottom) */}
      <div style={{
        position: 'absolute', inset: 0,
        background: isVertical
          ? 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 30%, rgba(0,0,0,0.0) 55%, rgba(0,0,0,0.45) 100%)'
          : 'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.0) 35%, rgba(0,0,0,0.88) 100%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to right, rgba(0,0,0,0.45) 0%, transparent 55%)',
      }} />
      {/* Vertical: uniform scrim to deepen washed-out / high-key stock photos */}
      {isVertical && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.24)' }} />
      )}

      {/* Text block — vertical: TOP-LEFT (bottom-left is covered by social UI/captions);
          horizontal: bottom, centered in 9:16 safe zone */}
      <div style={{
        position: 'absolute',
        ...(isVertical
          ? { top: paddingT, left: paddingH, right: paddingH, textAlign: 'left' }
          : { bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 860, paddingBottom: paddingB }
        ),
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

      {/* Accent bar — pairs with the description: top-left in vertical, lower-left decorative in horizontal */}
      <div style={{
        position: 'absolute',
        width: 4,
        background: cfg.palette.primary,
        boxShadow: `0 0 12px 2px ${cfg.palette.primary}88`,
        opacity: textEntry,
        borderRadius: 2,
        ...(isVertical
          ? { left: paddingH - 18, top: paddingT, height: 132 }
          : { left: 120, top: '60%', bottom: paddingB }
        ),
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
