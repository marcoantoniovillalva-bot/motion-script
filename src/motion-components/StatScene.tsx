import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import { getTextColor, getSubtextColor, getTextShadow } from '../colorUtils';
import type { MotionScriptScene } from '../motion-script-types';
import { TechBackground } from './TechBackground';
import { useTechTransition } from './useTechTransition';

export const StatScene: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;
  const p = cfg.palette;

  const { style: techStyle, scanY, scanOpacity } = useTechTransition({ sceneDuration: scene.end - scene.start });

  const sceneDuration = (scene.end - scene.start) * fps;
  const countDuration = sceneDuration * 0.72;

  const visual = scene.visual as { kind: 'counter'; from: number; to: number; suffix?: string; prefix?: string; label: string };
  const from = visual.kind === 'counter' ? visual.from : 0;
  const to = visual.kind === 'counter' ? visual.to : 100;
  const currentVal = Math.round(interpolate(frame, [0, countDuration], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));

  const badgeScale = spring({ frame, fps, config: { stiffness: 180, damping: 16, mass: 0.9 } });
  const labelOpacity = spring({ frame: Math.max(0, frame - 10), fps, config: { stiffness: 120, damping: 18 } });

  // HUD ring rotation
  const ringRotation = interpolate(frame, [0, sceneDuration], [0, 90], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const isVertical = height > width;
  const numSize = isVertical ? 200 : 160;
  const suffixSize = isVertical ? 80 : 64;
  const labelSize = isVertical ? 40 : 32;
  const headlineSize = isVertical ? 38 : 30;
  const ringSize = isVertical ? 700 : 560;

  const tickInterval = Math.max(2, Math.round(countDuration / Math.max(1, Math.abs(to - from))));
  const tickCount = Math.floor(countDuration / tickInterval);
  const ticks = Array.from({ length: Math.min(tickCount, 40) }, (_, i) => i * tickInterval);

  return (
    <AbsoluteFill>
      <TechBackground bg={scene.bg} scanY={scanY} scanOpacity={scanOpacity} />

      {/* HUD rings */}
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{
          width: ringSize, height: ringSize,
          borderRadius: '50%',
          border: `2px solid ${p.primary}30`,
          transform: `rotate(${ringRotation}deg)`,
          position: 'relative',
        }}>
          {/* Ring tick marks */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <div key={deg} style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: 8, height: 2,
              backgroundColor: `${p.primary}66`,
              transformOrigin: `${-ringSize / 2 + 4}px 0`,
              transform: `rotate(${deg}deg) translateX(${-ringSize / 2 + 4}px)`,
            }} />
          ))}
        </div>
        <div style={{
          position: 'absolute',
          width: ringSize * 0.76, height: ringSize * 0.76,
          borderRadius: '50%',
          border: `1px solid ${p.coral}22`,
          transform: `rotate(${-ringRotation * 0.6}deg)`,
        }} />
        <div style={{
          position: 'absolute',
          width: ringSize * 0.55, height: ringSize * 0.55,
          borderRadius: '50%',
          border: `1px dashed ${p.primary}18`,
        }} />
      </AbsoluteFill>

      <AbsoluteFill style={{
        ...techStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isVertical ? '80px 60px' : '60px 80px',
        gap: isVertical ? 16 : 12,
      }}>
        {scene.headline && (
          <div style={{
            color: getSubtextColor(scene.bg),
            fontFamily: cfg.fonts.code,
            fontSize: headlineSize,
            fontWeight: 400,
            textTransform: 'uppercase',
            letterSpacing: '5px',
            opacity: labelOpacity,
            textShadow: getTextShadow(scene.bg),
          }}>
            {scene.headline}
          </div>
        )}

        {/* Counter */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          transform: `scale(${badgeScale})`,
          transformOrigin: 'center',
          filter: `drop-shadow(0 0 30px ${p.primary}66)`,
        }}>
          {visual.kind === 'counter' && visual.prefix && (
            <span style={{ fontSize: suffixSize, fontFamily: cfg.fonts.headline, color: p.coral, fontWeight: 900 }}>
              {visual.prefix}
            </span>
          )}
          <span style={{
            fontSize: numSize,
            fontFamily: cfg.fonts.headline,
            color: getTextColor(scene.bg),
            fontWeight: 900,
            lineHeight: 1,
            textShadow: getTextShadow(scene.bg),
          }}>
            {currentVal}
          </span>
          {visual.kind === 'counter' && visual.suffix && (
            <span style={{ fontSize: suffixSize, fontFamily: cfg.fonts.headline, color: p.primary, fontWeight: 900 }}>
              {visual.suffix}
            </span>
          )}
        </div>

        {visual.kind === 'counter' && (
          <div style={{
            color: getSubtextColor(scene.bg),
            fontFamily: cfg.fonts.body,
            fontSize: labelSize,
            fontWeight: 600,
            textAlign: 'center',
            opacity: labelOpacity,
            letterSpacing: '1px',
            textShadow: getTextShadow(scene.bg),
          }}>
            {visual.label}
          </div>
        )}

        {scene.subtext && (
          <div style={{
            color: 'rgba(255,255,255,0.35)',
            fontFamily: cfg.fonts.body,
            fontSize: isVertical ? 30 : 24,
            textAlign: 'center',
            opacity: labelOpacity,
            marginTop: 8,
          }}>
            {scene.subtext}
          </div>
        )}
      </AbsoluteFill>

      {cfg.sounds.enabled && (
        <Sequence from={0} durationInFrames={6}>
          <Audio src={staticFile(`sounds/${cfg.sounds.perSceneType.stat}`)} volume={cfg.sounds.volume} />
        </Sequence>
      )}
      {cfg.sounds.enabled && ticks.map((f, i) => (
        <Sequence key={i} from={f} durationInFrames={3}>
          <Audio src={staticFile('sounds/tick.wav')} volume={cfg.sounds.volume * 0.55} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
