import React from 'react';
import { AbsoluteFill, Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import { getTextColor, getSubtextColor, getTextShadow, isLightColor } from '../colorUtils';
import type { MotionScriptScene } from '../motion-script-types';
import { Emoji3D } from './Emoji3D';
import { TechBackground } from './TechBackground';
import { LightBackground } from './LightBackground';
import { GlassCard } from './GlassCard';
import { useTechTransition } from './useTechTransition';

export const ListScene: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;
  const p = cfg.palette;

  const { style: techStyle, scanY, scanOpacity } = useTechTransition({ sceneDuration: scene.end - scene.start });

  const visual = scene.visual as { kind: 'list'; items: { icon: string; text: string }[] };
  const items = visual.kind === 'list' ? visual.items : [];

  const headlineOpacity = spring({ frame, fps, config: { stiffness: 140, damping: 16 } });
  const staggerFrames = Math.max(8, Math.round(((scene.end - scene.start) * fps * 0.7) / Math.max(items.length, 1)));

  const isVertical = height > width;
  const isLight = isLightColor(scene.bg ?? '#090909');
  const headlineSize = isVertical ? 52 : 50;
  const iconSize = isVertical ? 74 : 60;
  const textSize = isVertical ? 46 : 40;
  const cardGap = isVertical ? 28 : 14;

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
        padding: isVertical ? '80px 56px' : '60px 80px',
        gap: isVertical ? 44 : 24,
      }}>
        {scene.headline && (
          <div style={{
            color: getSubtextColor(scene.bg),
            fontFamily: cfg.fonts.code,
            fontSize: headlineSize,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            opacity: headlineOpacity,
            borderLeft: `3px solid ${p.primary}`,
            paddingLeft: 20,
            textShadow: getTextShadow(scene.bg),
            width: '100%',
            maxWidth: isVertical ? undefined : 920,
          }}>
            {scene.headline}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: cardGap, width: '100%', maxWidth: isVertical ? undefined : 920 }}>
          {items.map((item, i) => {
            const itemFrame = Math.max(0, frame - i * staggerFrames);
            const itemSpring = spring({ frame: itemFrame, fps, config: { stiffness: 200, damping: 16, mass: 0.8 } });
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isVertical ? 20 : 16,
                  ...(isLight ? {
                    background: 'rgba(255,255,255,0.58)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: `1px solid rgba(255,255,255,0.82)`,
                    borderLeft: `4px solid ${p.primary}`,
                    boxShadow: `0 4px 20px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)`,
                  } : {
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid rgba(255,255,255,0.08)`,
                    borderLeft: `4px solid ${p.primary}`,
                    boxShadow: `0 4px 24px rgba(0,0,0,0.3)`,
                  }),
                  borderRadius: 16,
                  padding: isVertical ? '28px 32px' : '14px 20px',
                  transform: `translateX(${(1 - itemSpring) * -60}px)`,
                  opacity: itemSpring,
                }}
              >
                <Emoji3D emoji={item.icon} size={iconSize} />
                <span style={{
                  color: getTextColor(scene.bg),
                  fontFamily: cfg.fonts.body,
                  fontSize: textSize,
                  fontWeight: 600,
                  letterSpacing: '0.3px',
                  textShadow: getTextShadow(scene.bg),
                }}>
                  {item.text}
                </span>
                {/* Right indicator */}
                <div style={{
                  marginLeft: 'auto',
                  width: 6, height: 6,
                  borderRadius: '50%',
                  backgroundColor: p.primary,
                  boxShadow: `0 0 8px 2px ${p.primary}88`,
                  opacity: itemSpring,
                }} />
              </div>
            );
          })}
        </div>

        {scene.subtext && (
          <div style={{
            color: 'rgba(255,255,255,0.3)',
            fontFamily: cfg.fonts.body,
            fontSize: isVertical ? 28 : 22,
          }}>
            {scene.subtext}
          </div>
        )}
      </AbsoluteFill>

      {cfg.sounds.enabled && items.map((_, i) => (
        <Sequence key={i} from={i * staggerFrames} durationInFrames={4}>
          <Audio src={staticFile(`sounds/${cfg.sounds.perSceneType.list}`)} volume={cfg.sounds.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
