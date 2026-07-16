import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';

type Props = {
  scanY?: number;
  scanOpacity?: number;
};

export const LightBackground: React.FC<Props> = ({ scanY = 0, scanOpacity = 0 }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const p = motionConfig.palette;

  // Slow organic drift for bokeh orbs (Remotion frame-based, no CSS animation)
  const t = frame * 0.015;
  const o1x = 8  + Math.sin(t * 0.7)  * 6;
  const o1y = 5  + Math.cos(t * 0.5)  * 7;
  const o2x = 68 + Math.cos(t * 0.6)  * 8;
  const o2y = 60 + Math.sin(t * 0.4)  * 9;
  const o3x = 55 + Math.sin(t * 0.9)  * 7;
  const o3y = 8  + Math.cos(t * 0.8)  * 5;
  const o4x = 15 + Math.cos(t * 0.55) * 5;
  const o4y = 72 + Math.sin(t * 0.65) * 6;

  const orbSize = width * 0.7;

  return (
    <AbsoluteFill style={{ backgroundColor: '#FBFAF8', overflow: 'hidden' }}>

      {/* Subtle dot grid — dark dots on light bg */}
      <AbsoluteFill style={{
        backgroundImage: 'radial-gradient(rgba(0,0,0,0.055) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* Bokeh orb 1 — top-left, coral warm */}
      <div style={{
        position: 'absolute',
        left: `${o1x}%`, top: `${o1y}%`,
        width: orbSize, height: orbSize,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${p.coral}28 0%, transparent 68%)`,
        filter: 'blur(48px)',
        transform: 'translate(-30%,-30%)',
        pointerEvents: 'none',
      }} />

      {/* Bokeh orb 2 — bottom-right, primary red very soft */}
      <div style={{
        position: 'absolute',
        left: `${o2x}%`, top: `${o2y}%`,
        width: orbSize * 1.1, height: orbSize * 1.1,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${p.primary}14 0%, transparent 65%)`,
        filter: 'blur(60px)',
        transform: 'translate(-30%,-30%)',
        pointerEvents: 'none',
      }} />

      {/* Bokeh orb 3 — top-right, pink */}
      <div style={{
        position: 'absolute',
        left: `${o3x}%`, top: `${o3y}%`,
        width: orbSize * 0.8, height: orbSize * 0.8,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${p.pink}55 0%, transparent 68%)`,
        filter: 'blur(40px)',
        transform: 'translate(-30%,-30%)',
        pointerEvents: 'none',
      }} />

      {/* Bokeh orb 4 — bottom-left, warm gold accent */}
      <div style={{
        position: 'absolute',
        left: `${o4x}%`, top: `${o4y}%`,
        width: orbSize * 0.6, height: orbSize * 0.6,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(255,200,100,0.18) 0%, transparent 65%)`,
        filter: 'blur(36px)',
        transform: 'translate(-30%,-30%)',
        pointerEvents: 'none',
      }} />

      {/* Bottom accent line */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 2,
        background: `linear-gradient(to right, transparent, ${p.primary}44, transparent)`,
      }} />

      {/* Entry scan line — lighter/darker version */}
      {scanOpacity > 0.01 && (
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          top: `${scanY}%`,
          height: 2,
          background: `linear-gradient(to right, transparent, ${p.coral}88, rgba(255,255,255,0.9), ${p.coral}88, transparent)`,
          opacity: scanOpacity * 0.6,
          pointerEvents: 'none',
        }} />
      )}
    </AbsoluteFill>
  );
};
