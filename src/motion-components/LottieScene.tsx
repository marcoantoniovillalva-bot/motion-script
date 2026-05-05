import React, { useEffect, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Lottie } from '@remotion/lottie';
import type { LottieAnimationData } from '@remotion/lottie';
import { motionConfig } from '../motion-config';
import type { MotionScriptScene } from '../motion-script-types';
import { TechBackground } from './TechBackground';
import { useTechTransition } from './useTechTransition';

const LottiePlayer: React.FC<{ src: string; loop?: boolean; speed?: number; size: number }> = ({
  src, loop = true, speed = 1, size,
}) => {
  const [animationData, setAnimationData] = useState<LottieAnimationData | null>(null);
  const [handle] = useState(() => delayRender(`Loading Lottie ${src}`));

  useEffect(() => {
    fetch(src)
      .then(r => r.json())
      .then(data => {
        setAnimationData(data);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [src, handle]);

  if (!animationData) {
    return <div style={{ width: size, height: size }} />;
  }

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      playbackRate={speed}
      style={{ width: size, height: size }}
    />
  );
};

export const LottieScene: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;

  const { style: techStyle, scanY, scanOpacity } = useTechTransition({ sceneDuration: scene.end - scene.start });

  const visual = scene.visual as { kind: 'lottie'; src: string; loop?: boolean; speed?: number };

  const headlineEntry = spring({ frame: Math.max(0, frame - 6), fps, config: { stiffness: 130, damping: 18 } });
  const subtextEntry  = spring({ frame: Math.max(0, frame - 16), fps, config: { stiffness: 110, damping: 20 } });

  const isVertical   = height > width;
  const lottieSizePx = isVertical ? Math.min(width * 0.75, 620) : Math.min(height * 0.6, 480);

  return (
    <AbsoluteFill>
      <TechBackground bg={scene.bg} scanY={scanY} scanOpacity={scanOpacity} />

      <AbsoluteFill style={{
        ...techStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isVertical ? '80px 48px' : '60px 80px',
        gap: isVertical ? 28 : 20,
      }}>
        {visual.src && (
          <LottiePlayer
            src={staticFile(visual.src)}
            loop={visual.loop ?? true}
            speed={visual.speed ?? 1}
            size={lottieSizePx}
          />
        )}

        {scene.headline && (
          <div style={{
            color: '#FFFFFF',
            fontFamily: cfg.fonts.headline,
            fontSize: isVertical ? 64 : 52,
            fontWeight: 900,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '3px',
            opacity: headlineEntry,
            transform: `translateY(${(1 - headlineEntry) * 30}px)`,
          }}>
            {scene.headline}
          </div>
        )}

        {scene.subtext && (
          <div style={{
            color: 'rgba(255,255,255,0.5)',
            fontFamily: cfg.fonts.code,
            fontSize: isVertical ? 30 : 24,
            textAlign: 'center',
            letterSpacing: '1.5px',
            opacity: subtextEntry,
          }}>
            {scene.subtext}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
