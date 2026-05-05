import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { motionConfig } from '../motion-config';

type Props = {
  bg?: string;
  accentColor?: string;
  scanY: number;
  scanOpacity: number;
};

export const TechBackground: React.FC<Props> = ({ bg, accentColor, scanY, scanOpacity }) => {
  const p = motionConfig.palette;
  const baseBg = bg ?? p.dark;
  const accent = accentColor ?? p.primary;

  return (
    <AbsoluteFill style={{ backgroundColor: baseBg, overflow: 'hidden' }}>
      {/* Dot grid */}
      <AbsoluteFill style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* Top-left corner glow */}
      <div style={{
        position: 'absolute',
        top: -80, left: -80,
        width: 400, height: 400,
        background: `radial-gradient(circle at top left, ${accent}28 0%, transparent 55%)`,
        pointerEvents: 'none',
      }} />

      {/* Bottom-right corner glow */}
      <div style={{
        position: 'absolute',
        bottom: -80, right: -80,
        width: 400, height: 400,
        background: `radial-gradient(circle at bottom right, ${p.coral}20 0%, transparent 55%)`,
        pointerEvents: 'none',
      }} />

      {/* Subtle top border line */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 2,
        background: `linear-gradient(to right, transparent, ${accent}88, transparent)`,
      }} />

      {/* Scan line sweep on entry */}
      {scanOpacity > 0.01 && (
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          top: `${scanY}%`,
          height: 3,
          background: `linear-gradient(to right, transparent, ${accent}CC, #ffffff, ${accent}CC, transparent)`,
          boxShadow: `0 0 18px 4px ${accent}88`,
          opacity: scanOpacity,
          pointerEvents: 'none',
        }} />
      )}
    </AbsoluteFill>
  );
};
