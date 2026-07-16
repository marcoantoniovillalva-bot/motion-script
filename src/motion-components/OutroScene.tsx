import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import { isLightColor } from '../colorUtils';
import type { MotionScriptScene } from '../motion-script-types';
import { Emoji3D } from './Emoji3D';
import { TechBackground } from './TechBackground';
import { LightBackground } from './LightBackground';
import { useTechTransition } from './useTechTransition';

export const OutroScene: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;
  const p = cfg.palette;

  const { style: techStyle, scanY, scanOpacity } = useTechTransition({ sceneDuration: scene.end - scene.start });

  const visual = scene.visual as { kind: 'big-text'; text: string } | { kind: 'icon'; emoji: string };

  const ctaScale = spring({ frame, fps, config: { stiffness: 200, damping: 14, mass: 0.85 } });
  const brandOpacity = spring({ frame: Math.max(0, frame - 6), fps, config: { stiffness: 120, damping: 18 } });
  const subtextOpacity = spring({ frame: Math.max(0, frame - 12), fps, config: { stiffness: 110, damping: 20 } });
  const lineScale = spring({ frame: Math.max(0, frame - 8), fps, config: { stiffness: 100, damping: 18 } });

  // Use primary red as default bg for outro — override via scene.bg
  const bgColor = scene.bg ?? p.primary;
  const isLight = isLightColor(bgColor);
  const isDarkBg = !isLight;

  const isVertical = height > width;
  const ctaSize = isVertical ? 110 : 90;
  const brandSize = isVertical ? 28 : 22;
  const subtextSize = isVertical ? 38 : 30;
  const emojiSize = isVertical ? 300 : 240;

  return (
    <AbsoluteFill>
      {isLight
        ? <LightBackground scanY={scanY} scanOpacity={scanOpacity} />
        : <TechBackground bg={bgColor} accentColor={p.primary} scanY={scanY} scanOpacity={scanOpacity} />
      }

      {/* Brand logo top */}
      <div style={{
        position: 'absolute',
        top: isVertical ? 60 : 40,
        left: 0, right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        opacity: brandOpacity,
      }}>
        {cfg.brand.logoSrc ? (
          <div style={{
            background: isLight ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.35)',
            borderRadius: 16,
            padding: isVertical ? '14px 28px' : '10px 22px',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: isLight ? '1px solid rgba(255,255,255,0.85)' : '1px solid rgba(255,255,255,0.10)',
            boxShadow: isLight ? '0 4px 16px rgba(0,0,0,0.06)' : 'none',
          }}>
            <Img
              src={staticFile(cfg.brand.logoSrc)}
              style={{
                height: isVertical ? 72 : 54,
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        ) : (
          <div style={{
            color: isDarkBg ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.75)',
            fontFamily: cfg.fonts.code,
            fontSize: brandSize,
            letterSpacing: '6px',
            textTransform: 'uppercase',
          }}>
            {cfg.brand.name}
          </div>
        )}
      </div>

      <AbsoluteFill style={{
        ...techStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isVertical ? '100px 60px' : '80px 80px',
        gap: isVertical ? 24 : 18,
      }}>
        {visual.kind === 'icon' && (
          <div style={{ transform: `scale(${ctaScale})` }}>
            <Emoji3D
              emoji={visual.emoji}
              size={emojiSize}
              playSound={cfg.sounds.enabled}
              sceneDurationFrames={Math.round((scene.end - scene.start) * fps)}
            />
          </div>
        )}

        {visual.kind === 'big-text' && (
          <div style={{
            color: '#FFFFFF',
            fontFamily: cfg.fonts.headline,
            fontSize: ctaSize,
            fontWeight: 900,
            textAlign: 'center',
            lineHeight: 1.05,
            transform: `scale(${ctaScale})`,
            textShadow: isDarkBg ? `0 0 40px ${p.primary}88` : '0 4px 24px rgba(0,0,0,0.25)',
            letterSpacing: '-1px',
          }}>
            {visual.text}
          </div>
        )}

        {/* Divider */}
        <div style={{
          height: 2,
          width: `${lineScale * 48}%`,
          background: isLight
            ? `linear-gradient(to right, transparent, ${p.primary}88, transparent)`
            : `linear-gradient(to right, transparent, ${p.primary}, transparent)`,
          boxShadow: isLight ? 'none' : `0 0 12px 2px ${p.primary}66`,
          borderRadius: 2,
        }} />

        {scene.headline && (
          <div style={{
            color: isLight ? '#1C1C1E' : 'rgba(255,255,255,0.92)',
            fontFamily: cfg.fonts.headline,
            fontSize: isVertical ? 56 : 44,
            fontWeight: 900,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '3px',
            opacity: subtextOpacity,
            textShadow: isLight ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
          }}>
            {scene.headline}
          </div>
        )}

        {scene.subtext && (
          <div style={{
            color: isLight ? 'rgba(28,28,30,0.6)' : 'rgba(255,255,255,0.45)',
            fontFamily: cfg.fonts.code,
            fontSize: subtextSize,
            textAlign: 'center',
            opacity: subtextOpacity,
            letterSpacing: '1px',
          }}>
            {scene.subtext}
          </div>
        )}
      </AbsoluteFill>

      {/* Tagline bottom */}
      <div style={{
        position: 'absolute',
        bottom: isVertical ? 56 : 36,
        left: 0, right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: subtextOpacity,
      }}>
        <div style={{
          color: isLight ? 'rgba(28,28,30,0.35)' : 'rgba(255,255,255,0.28)',
          fontFamily: cfg.fonts.code,
          fontSize: isVertical ? 22 : 17,
          letterSpacing: '3px',
          textTransform: 'uppercase',
        }}>
          {cfg.brand.tagline}
        </div>
      </div>

      {cfg.sounds.enabled && (
        <Sequence from={0} durationInFrames={12}>
          <Audio src={staticFile(`sounds/${cfg.sounds.perSceneType.outro}`)} volume={cfg.sounds.volume} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
