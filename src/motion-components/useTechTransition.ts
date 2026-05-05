import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type React from 'react';

type Options = {
  sceneDuration: number; // seconds
  entranceDelay?: number; // frames
};

export function useTechTransition({ sceneDuration, entranceDelay = 0 }: Options) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = Math.round(sceneDuration * fps);
  const exitStartFrame = totalFrames - 14;

  // --- ENTRANCE: fast 3D settle (6° max, settles in ~8 frames) ---
  const eFrame = Math.max(0, frame - entranceDelay);
  const eSpring = spring({ frame: eFrame, fps, config: { stiffness: 300, damping: 22, mass: 0.75 } });
  const eOpacity = interpolate(eFrame, [0, 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eRotateX = (1 - eSpring) * 6;
  const eTranslateZ = (1 - eSpring) * -18;
  const eScale = 0.96 + eSpring * 0.04;

  // Intentional camera-focus blur: 5px → 0 in 6 frames, feels like lens focus
  const eBlur = interpolate(eFrame, [0, 6], [5, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // --- EXIT: quick perspective-out ---
  const xProgress = interpolate(frame, [exitStartFrame, totalFrames - 2], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const xEased = xProgress * xProgress;
  const xOpacity = 1 - xEased;
  const xRotateX = xEased * -8;
  const xTranslateZ = xEased * -20;
  const xBlur = interpolate(xProgress, [0.5, 1], [0, 4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const isExiting = frame >= exitStartFrame;

  const opacity = isExiting ? xOpacity : eOpacity;
  const rotateX = isExiting ? xRotateX : eRotateX;
  const translateZ = isExiting ? xTranslateZ : eTranslateZ;
  const scale = isExiting ? 1 - xEased * 0.03 : eScale;
  const blur = isExiting ? xBlur : eBlur;

  // Scan line: sweeps top→bottom in first 12 frames
  const scanY = interpolate(frame, [0, 12], [-2, 104], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scanOpacity = interpolate(frame, [0, 2, 9, 12], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return {
    style: {
      transform: `perspective(700px) rotateX(${rotateX}deg) translateZ(${translateZ}px) scale(${scale})`,
      opacity,
      filter: blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : undefined,
    } as React.CSSProperties,
    scanY,
    scanOpacity,
  };
}
