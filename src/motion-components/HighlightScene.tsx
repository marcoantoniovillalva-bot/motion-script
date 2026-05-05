import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import type { MotionScriptScene } from '../motion-script-types';
import { Emoji3D } from './Emoji3D';
import { TechBackground } from './TechBackground';
import { useTechTransition } from './useTechTransition';

export const HighlightScene: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;
  const p = cfg.palette;

  const { style: techStyle, scanY, scanOpacity } = useTechTransition({ sceneDuration: scene.end - scene.start });

  const visual = scene.visual as { kind: 'icon'; emoji: string } | { kind: 'big-text'; text: string; color?: string };

  const textScale = spring({ frame, fps, config: { stiffness: 260, damping: 14, mass: 0.7 } });
  const subtextOpacity = spring({ frame: Math.max(0, frame - 10), fps, config: { stiffness: 120, damping: 18 } });
  const breathe = interpolate(frame, [0, 30, 60, 90], [0, 0, 0.012, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Glow pulse
  const glowPulse = interpolate(frame % 60, [0, 30, 60], [0.6, 1, 0.6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const isVertical = height > width;
  const mainSize = isVertical ? 380 : 300;
  const subtextSize = isVertical ? 40 : 32;
  const headlineSize = isVertical ? 68 : 56;

  const textColor = visual.kind === 'big-text' ? (visual.color ?? '#FFFFFF') : '#FFFFFF';
  // Default bg: dark, override if scene.bg is set
  const bgColor = scene.bg ?? p.dark;

  return (
    <AbsoluteFill>
      <TechBackground bg={bgColor} scanY={scanY} scanOpacity={scanOpacity} />

      {/* Center radial glow */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: isVertical ? 600 : 500,
          height: isVertical ? 600 : 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${p.primary}${Math.round(glowPulse * 30).toString(16).padStart(2, '0')} 0%, transparent 65%)`,
        }} />
      </AbsoluteFill>

      <AbsoluteFill style={{
        ...techStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isVertical ? '80px 60px' : '60px 80px',
        gap: isVertical ? 24 : 18,
      }}>
        <div style={{
          transform: `scale(${textScale + breathe})`,
          transformOrigin: 'center',
          filter: visual.kind === 'big-text'
            ? `drop-shadow(0 0 ${30 * glowPulse}px ${p.primary}AA)`
            : undefined,
        }}>
          {visual.kind === 'icon' && (
            <Emoji3D
              emoji={visual.emoji}
              size={mainSize}
              playSound={cfg.sounds.enabled}
              sceneDurationFrames={Math.round((scene.end - scene.start) * fps)}
            />
          )}
          {visual.kind === 'big-text' && (
            <div style={{
              color: textColor,
              fontFamily: cfg.fonts.headline,
              fontSize: mainSize,
              fontWeight: 900,
              textAlign: 'center',
              lineHeight: 1,
              letterSpacing: '-2px',
            }}>
              {visual.text}
            </div>
          )}
        </div>

        {scene.headline && (
          <div style={{
            color: 'rgba(255,255,255,0.8)',
            fontFamily: cfg.fonts.headline,
            fontSize: headlineSize,
            fontWeight: 900,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '3px',
            opacity: subtextOpacity,
          }}>
            {scene.headline}
          </div>
        )}

        {scene.subtext && (
          <div style={{
            color: 'rgba(255,255,255,0.4)',
            fontFamily: cfg.fonts.code,
            fontSize: subtextSize,
            textAlign: 'center',
            opacity: subtextOpacity,
            letterSpacing: '2px',
          }}>
            {scene.subtext}
          </div>
        )}
      </AbsoluteFill>

      {cfg.sounds.enabled && (
        <Sequence from={0} durationInFrames={12}>
          <Audio src={staticFile(`sounds/${cfg.sounds.perSceneType.highlight}`)} volume={cfg.sounds.volume} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
