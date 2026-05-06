import React from 'react';
import { AbsoluteFill, Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import { getTextColor, getSubtextColor, getTextShadow } from '../colorUtils';
import type { MotionScriptScene } from '../motion-script-types';
import { Emoji3D } from './Emoji3D';
import { TechBackground } from './TechBackground';
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
  const headlineSize = isVertical ? 44 : 36;
  const iconSize = isVertical ? 48 : 38;
  const textSize = isVertical ? 36 : 28;
  const cardGap = isVertical ? 16 : 12;

  return (
    <AbsoluteFill>
      <TechBackground bg={scene.bg} scanY={scanY} scanOpacity={scanOpacity} />

      <AbsoluteFill style={{
        ...techStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: isVertical ? '80px 56px' : '60px 100px',
        gap: isVertical ? 32 : 24,
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
          }}>
            {scene.headline}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: cardGap, width: '100%' }}>
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
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: isVertical ? '18px 24px' : '14px 20px',
                  borderLeft: `4px solid ${p.primary}`,
                  border: `1px solid rgba(255,255,255,0.08)`,
                  borderLeftColor: p.primary,
                  borderLeftWidth: 4,
                  boxShadow: `inset 0 0 0 0 transparent, 0 4px 24px rgba(0,0,0,0.3)`,
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
