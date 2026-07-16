import React, { useEffect, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Lottie } from '@remotion/lottie';
import type { LottieAnimationData } from '@remotion/lottie';
import { motionConfig } from '../motion-config';
import { isLightColor } from '../colorUtils';
import type { MotionScriptScene } from '../motion-script-types';
import { TechBackground } from './TechBackground';
import { LightBackground } from './LightBackground';
import { GlassCard } from './GlassCard';
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
  const isLight      = isLightColor(scene.bg ?? '#090909');
  const lottieSizePx = isVertical ? Math.min(width * 0.82, 780) : Math.min(height * 0.68, 540);

  const textBlock = (
    <>
      {scene.headline && (
        <div style={{
          color: isLight ? '#1C1C1E' : '#FFFFFF',
          fontFamily: cfg.fonts.headline,
          fontSize: isVertical ? 64 : 62,
          fontWeight: 900,
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '3px',
          opacity: headlineEntry,
          transform: `translateY(${(1 - headlineEntry) * 30}px)`,
          maxWidth: isVertical ? undefined : 860,
        }}>
          {scene.headline}
        </div>
      )}
      {scene.subtext && (
        <div style={{
          color: isLight ? 'rgba(28,28,30,0.6)' : 'rgba(255,255,255,0.5)',
          fontFamily: cfg.fonts.code,
          fontSize: isVertical ? 30 : 28,
          textAlign: 'center',
          letterSpacing: '1.5px',
          opacity: subtextEntry,
          maxWidth: isVertical ? undefined : 800,
        }}>
          {scene.subtext}
        </div>
      )}
    </>
  );

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

        {isLight ? (
          <GlassCard style={{
            padding: isVertical ? '28px 36px' : '22px 44px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            maxWidth: isVertical ? undefined : 860,
          }}>
            {textBlock}
          </GlassCard>
        ) : textBlock}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
