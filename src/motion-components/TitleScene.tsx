import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import type { MotionScriptScene } from '../motion-script-types';
import { Emoji3D } from './Emoji3D';
import { TechBackground } from './TechBackground';
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
  const emojiSize = isVertical ? 380 : 300;
  const headlineSize = isVertical ? 88 : 72;
  const subtextSize = isVertical ? 40 : 32;

  const visual = scene.visual as { kind: 'icon'; emoji: string; label?: string } | { kind: 'big-text'; text: string };

  return (
    <AbsoluteFill>
      <TechBackground bg={scene.bg} scanY={scanY} scanOpacity={scanOpacity} />

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
            textShadow: `0 0 40px ${p.primary}88`,
          }}>
            {visual.text}
          </div>
        )}

        {scene.headline && (
          <div style={{
            color: '#FFFFFF',
            fontFamily: cfg.fonts.headline,
            fontSize: headlineSize,
            fontWeight: 900,
            textAlign: 'center',
            lineHeight: 1.05,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            transform: `translateY(${(1 - headlineY) * 60}px)`,
            opacity: headlineY,
            textShadow: '0 2px 20px rgba(0,0,0,0.6)',
          }}>
            {scene.headline}
          </div>
        )}

        {/* Glowing accent line */}
        <div style={{
          height: 3,
          width: `${lineWidth * 60}%`,
          background: `linear-gradient(to right, transparent, ${p.primary}, ${p.coral}, transparent)`,
          boxShadow: `0 0 14px 2px ${p.primary}88`,
          borderRadius: 2,
        }} />

        {scene.subtext && (
          <div style={{
            color: 'rgba(255,255,255,0.55)',
            fontFamily: cfg.fonts.body,
            fontSize: subtextSize,
            textAlign: 'center',
            opacity: subtextOpacity,
            letterSpacing: '0.5px',
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
