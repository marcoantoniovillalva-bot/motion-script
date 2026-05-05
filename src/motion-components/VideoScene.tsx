import React from 'react';
import { AbsoluteFill, Video, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import type { MotionScriptScene } from '../motion-script-types';

export const VideoScene: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;
  const p = cfg.palette;
  const isVertical = height > width;

  const visual = scene.visual as { kind: 'clip'; src: string; query?: string };

  const headlineOpacity = spring({ frame: Math.max(0, frame - 8), fps, config: { stiffness: 100, damping: 20 } });
  const subtextOpacity  = spring({ frame: Math.max(0, frame - 18), fps, config: { stiffness: 90, damping: 22 } });
  const sceneDuration   = scene.end - scene.start;

  // Fade in/out for the whole scene
  const fadeIn  = interpolate(frame, [0, 8],  [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [Math.round(sceneDuration * fps) - 10, Math.round(sceneDuration * fps)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sceneOpacity = Math.min(fadeIn, fadeOut);

  const headlineSize = isVertical ? 72 : 56;
  const subtextSize  = isVertical ? 36 : 28;

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity }}>
      {/* Full-screen video */}
      {visual.src ? (
        <AbsoluteFill>
          <Video
            src={staticFile(visual.src)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            muted
            loop
          />
          {/* Dark gradient overlay for text legibility */}
          <AbsoluteFill style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.35) 100%)',
          }} />
          {/* Primary color tint */}
          <AbsoluteFill style={{
            background: `${p.primary}18`,
            mixBlendMode: 'multiply',
          }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ backgroundColor: p.dark }} />
      )}

      {/* Text overlay — pinned to bottom */}
      <AbsoluteFill style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: isVertical ? '0 60px 100px' : '0 80px 70px',
        gap: 16,
      }}>
        {/* Accent line */}
        <div style={{
          width: interpolate(frame, [6, 22], [0, isVertical ? 80 : 60], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          height: 3,
          background: p.primary,
          borderRadius: 2,
          marginBottom: 4,
        }} />

        {scene.headline && (
          <div style={{
            color: '#FFFFFF',
            fontFamily: cfg.fonts.headline,
            fontSize: headlineSize,
            fontWeight: 900,
            lineHeight: 1.1,
            textTransform: 'uppercase',
            letterSpacing: '-0.5px',
            opacity: headlineOpacity,
            textShadow: '0 2px 20px rgba(0,0,0,0.6)',
          }}>
            {scene.headline}
          </div>
        )}

        {scene.subtext && (
          <div style={{
            color: 'rgba(255,255,255,0.85)',
            fontFamily: cfg.fonts.body,
            fontSize: subtextSize,
            fontWeight: 400,
            opacity: subtextOpacity,
            textShadow: '0 1px 10px rgba(0,0,0,0.5)',
          }}>
            {scene.subtext}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
