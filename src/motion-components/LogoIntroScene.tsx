import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import { TechBackground } from './TechBackground';

export const LOGO_INTRO_FRAMES = 90; // 3s at 30fps

export const LogoIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;
  const p = cfg.palette;
  const isVertical = height > width;

  // Logo 3D flip entrance
  const flipSpring = spring({ frame, fps, config: { stiffness: 180, damping: 16, mass: 0.85 } });

  // Breathing pulse after settle
  const breathe = 1 + Math.sin(frame * 0.09) * 0.018;

  // Glow intensity: flares on entry, then pulses gently
  const glowIntensity = interpolate(
    frame,
    [0, 10, 22, 50, LOGO_INTRO_FRAMES],
    [0, 0.9, 0.45, 0.6, 0.25],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Scan line (fast sweep on entry)
  const scanY = interpolate(frame, [0, 14], [-2, 106], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scanOpacity = interpolate(frame, [0, 2, 10, 14], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Fade out at end (transition to first scene)
  const exitOpacity = interpolate(
    frame,
    [LOGO_INTRO_FRAMES - 14, LOGO_INTRO_FRAMES - 2],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const logoH = isVertical ? 190 : 140;
  const glowSize = isVertical ? 640 : 480;
  const ringMaxSize = isVertical ? 680 : 520;

  const glowHex = Math.round(glowIntensity * 60).toString(16).padStart(2, '0');

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <TechBackground bg={p.dark} scanY={scanY} scanOpacity={scanOpacity} />

      {/* Expanding rings — 3 waves at different delays */}
      {[0, 16, 32].map((delay, i) => {
        if (frame < delay) return null;
        const progress = Math.min(1, (frame - delay) / 58);
        const size = progress * ringMaxSize;
        const ringOpacity = Math.pow(1 - progress, 1.4) * 0.55;
        return (
          <div key={i} style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: size, height: size,
            borderRadius: '50%',
            border: `1.5px solid ${p.primary}`,
            opacity: ringOpacity,
            pointerEvents: 'none',
          }} />
        );
      })}

      {/* Center radial glow */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: glowSize, height: glowSize,
        background: `radial-gradient(circle, ${p.primary}${glowHex} 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      {/* Accent corner lines — top-left and bottom-right */}
      <div style={{
        position: 'absolute',
        top: isVertical ? 60 : 40,
        left: isVertical ? 60 : 80,
        width: interpolate(frame, [4, 20], [0, isVertical ? 80 : 60], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        height: 2,
        background: `linear-gradient(to right, ${p.primary}, transparent)`,
      }} />
      <div style={{
        position: 'absolute',
        top: isVertical ? 60 : 40,
        left: isVertical ? 60 : 80,
        width: 2,
        height: interpolate(frame, [4, 20], [0, isVertical ? 80 : 60], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        background: `linear-gradient(to bottom, ${p.primary}, transparent)`,
      }} />
      <div style={{
        position: 'absolute',
        bottom: isVertical ? 60 : 40,
        right: isVertical ? 60 : 80,
        width: interpolate(frame, [8, 24], [0, isVertical ? 80 : 60], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        height: 2,
        background: `linear-gradient(to left, ${p.primary}, transparent)`,
      }} />
      <div style={{
        position: 'absolute',
        bottom: isVertical ? 60 : 40,
        right: isVertical ? 60 : 80,
        width: 2,
        height: interpolate(frame, [8, 24], [0, isVertical ? 80 : 60], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        background: `linear-gradient(to top, ${p.primary}, transparent)`,
      }} />

      {/* Logo — 3D flip reveal + breathing */}
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          transform: `perspective(700px) rotateY(${(1 - flipSpring) * 85}deg) scale(${(0.82 + flipSpring * 0.18) * breathe})`,
          transformOrigin: 'center center',
          opacity: interpolate(frame, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          filter: `drop-shadow(0 0 ${Math.round(glowIntensity * 28)}px ${p.primary}cc)`,
        }}>
          {cfg.brand.logoSrc ? (
            <Img
              src={staticFile(cfg.brand.logoSrc)}
              style={{ height: logoH, width: 'auto', objectFit: 'contain' }}
            />
          ) : (
            <div style={{
              color: '#FFFFFF',
              fontFamily: cfg.fonts.headline,
              fontSize: logoH * 0.35,
              fontWeight: 900,
              letterSpacing: '4px',
              textTransform: 'uppercase',
            }}>
              {cfg.brand.name}
            </div>
          )}
        </div>
      </AbsoluteFill>

      {/* Tagline fades in at the bottom */}
      {cfg.brand.tagline && (
        <div style={{
          position: 'absolute',
          bottom: isVertical ? 100 : 70,
          left: 0, right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: interpolate(frame, [18, 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          <div style={{
            color: 'rgba(255,255,255,0.35)',
            fontFamily: cfg.fonts.code,
            fontSize: isVertical ? 24 : 18,
            letterSpacing: '3px',
            textTransform: 'uppercase',
          }}>
            {cfg.brand.tagline}
          </div>
        </div>
      )}

      {/* Intro music */}
      {cfg.sounds.enabled && (
        <Sequence from={0} durationInFrames={LOGO_INTRO_FRAMES}>
          <Audio src={staticFile('sounds/intro-jingle.wav')} volume={cfg.sounds.volume * 3.5} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
