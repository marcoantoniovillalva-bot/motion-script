import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import { getTextColor, getSubtextColor, getTextShadow, isLightColor } from '../colorUtils';
import type { MotionScriptScene } from '../motion-script-types';
import { Emoji3D } from './Emoji3D';
import { TechBackground } from './TechBackground';
import { LightBackground } from './LightBackground';
import { useTechTransition } from './useTechTransition';

export const TitleScene: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;
  const p = cfg.palette;

  const { style: techStyle, scanY, scanOpacity } = useTechTransition({ sceneDuration: scene.end - scene.start });

  const emojiScale = spring({ frame, fps, config: { stiffness: 220, damping: 14, mass: 0.8 } });
  const headlineY = spring({ frame: Math.max(0, frame - 6), fps, config: { stiffness: 160, damping: 14, mass: 0.9 } });
  const subtextOpacity = spring({ frame: Math.max(0, frame - 14), fps, config: { stiffness: 120, damping: 16 } });
  const lineWidth = spring({ frame: Math.max(0, frame - 10), fps, config: { stiffness: 100, damping: 18 } });

  const isVertical = height > width;
  const emojiSize = isVertical ? 380 : 340;
  const headlineSize = isVertical ? 88 : 84;
  const subtextSize = isVertical ? 40 : 36;

  const visual = scene.visual as { kind: 'icon'; emoji: string; label?: string } | { kind: 'big-text'; text: string };
  const isLight = isLightColor(scene.bg ?? '#090909');

  return (
    <AbsoluteFill>
      {isLight
        ? <LightBackground scanY={scanY} scanOpacity={scanOpacity} />
        : <TechBackground bg={scene.bg} scanY={scanY} scanOpacity={scanOpacity} />
      }

      <AbsoluteFill style={{
        ...techStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isVertical ? '80px 60px' : '60px 80px',
        gap: isVertical ? 28 : 20,
      }}>
        {visual.kind === 'icon' && (
          <div style={{ transform: `scale(${emojiScale})`, transformOrigin: 'center' }}>
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
            fontSize: emojiSize * 0.8,
            color: p.primary,
            fontFamily: cfg.fonts.headline,
            transform: `scale(${emojiScale})`,
            textShadow: isLight ? 'none' : `0 0 40px ${p.primary}88`,
          }}>
            {visual.text}
          </div>
        )}

        {scene.headline && (
          <div style={{
            color: getTextColor(scene.bg),
            fontFamily: cfg.fonts.headline,
            fontSize: headlineSize,
            fontWeight: 900,
            textAlign: 'center',
            lineHeight: 1.05,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            transform: `translateY(${(1 - headlineY) * 60}px)`,
            opacity: headlineY,
            textShadow: getTextShadow(scene.bg),
            maxWidth: isVertical ? undefined : 900,
          }}>
            {scene.headline}
          </div>
        )}

        {/* Accent line */}
        <div style={{
          height: isLight ? 2 : 3,
          width: `${lineWidth * 60}%`,
          background: isLight
            ? `linear-gradient(to right, transparent, ${p.primary}99, transparent)`
            : `linear-gradient(to right, transparent, ${p.primary}, ${p.coral}, transparent)`,
          boxShadow: isLight ? 'none' : `0 0 14px 2px ${p.primary}88`,
          borderRadius: 2,
        }} />

        {scene.subtext && (
          <div style={{
            color: getSubtextColor(scene.bg),
            fontFamily: cfg.fonts.body,
            fontSize: subtextSize,
            textAlign: 'center',
            opacity: subtextOpacity,
            letterSpacing: '0.5px',
            textShadow: getTextShadow(scene.bg),
          }}>
            {scene.subtext}
          </div>
        )}
      </AbsoluteFill>

      {/* Logo badge — top right */}
      {cfg.brand.logoSrc && (
        <div style={{
          position: 'absolute',
          top: isVertical ? 48 : 32,
          right: isVertical ? 48 : 60,
          opacity: subtextOpacity * 0.7,
        }}>
          <Img
            src={staticFile(cfg.brand.logoSrc)}
            style={{
              height: isVertical ? 44 : 34,
              width: 'auto',
              objectFit: 'contain',
              filter: 'brightness(1)',
            }}
          />
        </div>
      )}

      {cfg.sounds.enabled && (
        <Sequence from={0} durationInFrames={12}>
          <Audio src={staticFile(`sounds/${cfg.sounds.perSceneType.title}`)} volume={cfg.sounds.volume} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
