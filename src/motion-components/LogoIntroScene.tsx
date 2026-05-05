import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import { TechBackground } from './TechBackground';

export const LOGO_INTRO_FRAMES = 90; // 3s at 30fps

// ─── flip-3d ─────────────────────────────────────────────────────────────────
// Best for: square icons, compact logos
const Flip3D: React.FC<{ frame: number; fps: number; logoH: number; glowIntensity: number; ringMaxSize: number; glowSize: number }> = ({
  frame, fps, logoH, glowIntensity, ringMaxSize, glowSize,
}) => {
  const cfg = motionConfig;
  const p = cfg.palette;
  const flipSpring = spring({ frame, fps, config: { stiffness: 180, damping: 16, mass: 0.85 } });
  const breathe = 1 + Math.sin(frame * 0.09) * 0.018;
  const glowHex = Math.round(glowIntensity * 55).toString(16).padStart(2, '0');

  return (
    <>
      {[0, 16, 32].map((delay, i) => {
        if (frame < delay) return null;
        const progress = Math.min(1, (frame - delay) / 58);
        const size = progress * ringMaxSize;
        const ringOpacity = Math.pow(1 - progress, 1.4) * 0.45;
        return (
          <div key={i} style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: size, height: size, borderRadius: '50%',
            border: `2px solid rgba(255,255,255,0.7)`, opacity: ringOpacity, pointerEvents: 'none',
          }} />
        );
      })}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: glowSize, height: glowSize,
        background: `radial-gradient(circle, rgba(255,255,255,${glowHex}) 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          transform: `perspective(700px) rotateY(${(1 - flipSpring) * 85}deg) scale(${(0.82 + flipSpring * 0.18) * breathe})`,
          transformOrigin: 'center center',
          opacity: interpolate(frame, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          filter: `drop-shadow(0 0 ${Math.round(glowIntensity * 32)}px rgba(255,255,255,0.8))`,
        }}>
          <LogoOrText logoH={logoH} />
        </div>
      </AbsoluteFill>
    </>
  );
};

// ─── zoom-fade ────────────────────────────────────────────────────────────────
// Best for: wide logos, horizontal layouts, medium-ratio logos
const ZoomFade: React.FC<{ frame: number; fps: number; logoH: number; glowIntensity: number; isVertical: boolean }> = ({
  frame, fps, logoH, glowIntensity, isVertical,
}) => {
  const cfg = motionConfig;
  const p = cfg.palette;
  const zoomSpring = spring({ frame, fps, config: { stiffness: 120, damping: 18, mass: 1.1 } });
  const scale = 0.76 + zoomSpring * 0.24;
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glowW = isVertical ? 800 : 1100;
  const glowH = isVertical ? 220 : 180;
  const glowHex = Math.round(glowIntensity * 55).toString(16).padStart(2, '0');
  const lineW = interpolate(frame, [8, 28], [0, isVertical ? 340 : 480], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <>
      {/* Horizontal glow bar */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: glowW, height: glowH,
        background: `radial-gradient(ellipse, ${p.primary}${glowHex} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      {/* Underline that draws in */}
      <div style={{
        position: 'absolute', top: `calc(50% + ${logoH / 2 + 18}px)`, left: '50%',
        transform: 'translateX(-50%)',
        width: lineW, height: 2,
        background: `linear-gradient(to right, transparent, ${p.primary}, transparent)`,
        boxShadow: `0 0 10px 2px ${p.primary}66`,
      }} />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          transform: `scale(${scale})`,
          opacity,
          filter: `drop-shadow(0 0 ${Math.round(glowIntensity * 22)}px ${p.primary}99)`,
        }}>
          <LogoOrText logoH={logoH} />
        </div>
      </AbsoluteFill>
    </>
  );
};

// ─── slide-up ─────────────────────────────────────────────────────────────────
// Best for: wordmarks, text-heavy or very wide logos
const SlideUp: React.FC<{ frame: number; fps: number; logoH: number; glowIntensity: number; isVertical: boolean }> = ({
  frame, fps, logoH, glowIntensity, isVertical,
}) => {
  const cfg = motionConfig;
  const p = cfg.palette;
  const slideSpring = spring({ frame, fps, config: { stiffness: 140, damping: 20, mass: 0.9 } });
  const translateY = (1 - slideSpring) * 70;
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glowHex = Math.round(glowIntensity * 50).toString(16).padStart(2, '0');
  const lineW = interpolate(frame, [14, 36], [0, isVertical ? 300 : 420], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // Particles floating up
  const particles = [0, 20, 40, 60, 80];

  return (
    <>
      {/* Bottom glow */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: isVertical ? 700 : 900, height: 300,
        background: `radial-gradient(ellipse at bottom, ${p.primary}${glowHex} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      {/* Rising particles */}
      {particles.map((delay, i) => {
        if (frame < delay) return null;
        const t = Math.min(1, (frame - delay) / 50);
        const px = [-120, -60, 20, 80, 150][i];
        const py = interpolate(t, [0, 1], [40, -60]);
        const pOpacity = t < 0.5 ? t * 2 : (1 - t) * 2;
        return (
          <div key={i} style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
            width: 4, height: 4, borderRadius: '50%',
            background: p.primary, opacity: pOpacity * 0.6,
          }} />
        );
      })}
      {/* Glowing line above logo */}
      <div style={{
        position: 'absolute', top: `calc(50% - ${logoH / 2 + 20}px)`, left: '50%',
        transform: 'translateX(-50%)',
        width: lineW, height: 2,
        background: `linear-gradient(to right, transparent, ${p.primary}, transparent)`,
        boxShadow: `0 0 10px 2px ${p.primary}66`,
      }} />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          transform: `translateY(${translateY}px)`,
          opacity,
          filter: `drop-shadow(0 0 ${Math.round(glowIntensity * 20)}px ${p.primary}88)`,
        }}>
          <LogoOrText logoH={logoH} />
        </div>
      </AbsoluteFill>
    </>
  );
};

// ─── Shared logo/text renderer ─────────────────────────────────────────────────
const LogoOrText: React.FC<{ logoH: number }> = ({ logoH }) => {
  const cfg = motionConfig;
  if (cfg.brand.logoSrc) {
    return <Img src={staticFile(cfg.brand.logoSrc)} style={{ height: logoH, width: 'auto', objectFit: 'contain' }} />;
  }
  return (
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
  );
};

// ─── Main component ────────────────────────────────────────────────────────────
export const LogoIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;
  const p = cfg.palette;
  const isVertical = height > width;

  const glowIntensity = interpolate(
    frame,
    [0, 10, 22, 50, LOGO_INTRO_FRAMES],
    [0, 0.9, 0.45, 0.6, 0.25],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const scanY = interpolate(frame, [0, 14], [-2, 106], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scanOpacity = interpolate(frame, [0, 2, 10, 14], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const exitOpacity = interpolate(
    frame, [LOGO_INTRO_FRAMES - 14, LOGO_INTRO_FRAMES - 2], [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const logoH = isVertical ? 300 : 240;
  const glowSize = isVertical ? 700 : 560;
  const ringMaxSize = isVertical ? 750 : 580;
  const anim = cfg.brand.logoAnimation ?? 'flip-3d';

  // Use primary color as intro background — on-brand, not all-black
  const introBg = p.primary;

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <TechBackground bg={introBg} accentColor='#ffffff' scanY={scanY} scanOpacity={scanOpacity} />

      {/* Corner accent lines — common to all styles */}
      {[
        { pos: { top: isVertical ? 60 : 40, left: isVertical ? 60 : 80 }, dir: 'right' as const },
        { pos: { top: isVertical ? 60 : 40, left: isVertical ? 60 : 80 }, dir: 'down' as const },
        { pos: { bottom: isVertical ? 60 : 40, right: isVertical ? 60 : 80 }, dir: 'left' as const },
        { pos: { bottom: isVertical ? 60 : 40, right: isVertical ? 60 : 80 }, dir: 'up' as const },
      ].map(({ pos, dir }, i) => {
        const delay = i < 2 ? 4 : 8;
        const len = interpolate(frame, [delay, delay + 16], [0, isVertical ? 80 : 60], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const isH = dir === 'right' || dir === 'left';
        const grad = dir === 'right' ? 'to right' : dir === 'left' ? 'to left' : dir === 'down' ? 'to bottom' : 'to top';
        return (
          <div key={i} style={{
            position: 'absolute', ...pos,
            width: isH ? len : 2,
            height: isH ? 2 : len,
            background: `linear-gradient(${grad}, ${p.primary}, transparent)`,
          }} />
        );
      })}

      {anim === 'flip-3d' && (
        <Flip3D frame={frame} fps={fps} logoH={logoH} glowIntensity={glowIntensity} ringMaxSize={ringMaxSize} glowSize={glowSize} />
      )}
      {anim === 'zoom-fade' && (
        <ZoomFade frame={frame} fps={fps} logoH={logoH} glowIntensity={glowIntensity} isVertical={isVertical} />
      )}
      {anim === 'slide-up' && (
        <SlideUp frame={frame} fps={fps} logoH={logoH} glowIntensity={glowIntensity} isVertical={isVertical} />
      )}

      {cfg.brand.tagline && (
        <div style={{
          position: 'absolute',
          bottom: isVertical ? 100 : 70,
          left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
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

      {cfg.sounds.enabled && (
        <Sequence from={0} durationInFrames={LOGO_INTRO_FRAMES}>
          <Audio src={staticFile('sounds/intro-jingle.wav')} volume={cfg.sounds.volume * 3.5} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
