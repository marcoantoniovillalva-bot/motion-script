import React from 'react';
import { AbsoluteFill, Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import { getTextColor, getSubtextColor, getTextShadow } from '../colorUtils';
import type { MotionScriptScene } from '../motion-script-types';
import { Emoji3D } from './Emoji3D';
import { TechBackground } from './TechBackground';
import { useTechTransition } from './useTechTransition';

export const ComparisonScene: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;
  const p = cfg.palette;

  const { style: techStyle, scanY, scanOpacity } = useTechTransition({ sceneDuration: scene.end - scene.start });

  const visual = scene.visual as {
    kind: 'comparison';
    left: { label: string; icon: string; color?: string };
    right: { label: string; icon: string; color?: string };
    verdict?: 'left' | 'right' | 'both';
  };

  const leftIn = spring({ frame, fps, config: { stiffness: 180, damping: 16, mass: 0.85 } });
  const rightIn = spring({ frame: Math.max(0, frame - 5), fps, config: { stiffness: 180, damping: 16, mass: 0.85 } });
  const vsIn = spring({ frame: Math.max(0, frame - 8), fps, config: { stiffness: 220, damping: 12 } });
  const headlineOpacity = spring({ frame: Math.max(0, frame - 12), fps, config: { stiffness: 120, damping: 18 } });

  const isVertical = height > width;
  const iconSize = isVertical ? 88 : 70;
  const labelSize = isVertical ? 38 : 30;
  const vsSize = isVertical ? 30 : 24;
  const headlineSize = isVertical ? 40 : 32;

  const leftWin = visual.verdict === 'left' || visual.verdict === 'both';
  const rightWin = visual.verdict === 'right' || visual.verdict === 'both';

  // Tech colors for panels
  const leftPanelBg = leftWin
    ? `rgba(252, 55, 24, 0.14)`
    : `rgba(255, 255, 255, 0.04)`;
  const rightPanelBg = rightWin
    ? `rgba(252, 55, 24, 0.14)`
    : `rgba(255, 255, 255, 0.04)`;

  return (
    <AbsoluteFill>
      <TechBackground bg={scene.bg} scanY={scanY} scanOpacity={scanOpacity} />

      <AbsoluteFill style={{
        ...techStyle,
        display: 'flex',
        flexDirection: 'column',
        gap: isVertical ? 28 : 20,
        padding: isVertical ? '60px 44px' : '50px 60px',
      }}>
        {scene.headline && (
          <div style={{
            color: getSubtextColor(scene.bg),
            fontFamily: cfg.fonts.code,
            fontSize: headlineSize,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            textAlign: 'center',
            opacity: headlineOpacity,
            textShadow: getTextShadow(scene.bg),
          }}>
            {scene.headline}
          </div>
        )}

        <div style={{ display: 'flex', flex: 1, gap: 0, position: 'relative' }}>
          {/* Left panel */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: leftPanelBg,
            borderRadius: '16px 0 0 16px',
            padding: isVertical ? '44px 20px' : '36px 16px',
            gap: isVertical ? 18 : 14,
            border: `1px solid ${leftWin ? p.primary + '88' : 'rgba(255,255,255,0.08)'}`,
            borderRight: 'none',
            transform: `translateX(${(1 - leftIn) * -50}px)`,
            opacity: leftIn,
            boxShadow: leftWin ? `inset 0 0 40px ${p.primary}18, 0 0 30px ${p.primary}22` : 'none',
          }}>
            <Emoji3D emoji={visual.left?.icon ?? ''} size={iconSize} />
            <div style={{
              color: leftWin ? getTextColor(scene.bg) : getSubtextColor(scene.bg),
              fontFamily: cfg.fonts.headline,
              fontSize: labelSize,
              fontWeight: 900,
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              textShadow: getTextShadow(scene.bg),
            }}>
              {visual.left?.label}
            </div>
            {leftWin && (
              <div style={{
                fontFamily: cfg.fonts.code,
                fontSize: isVertical ? 22 : 18,
                color: p.primary,
                letterSpacing: '2px',
              }}>
                ▶ VINCITORE
              </div>
            )}
          </div>

          {/* VS badge */}
          <div style={{
            position: 'absolute',
            left: '50%', top: '50%',
            transform: `translate(-50%, -50%) scale(${vsIn})`,
            zIndex: 10,
            background: p.dark,
            borderRadius: '50%',
            width: isVertical ? 68 : 54,
            height: isVertical ? 68 : 54,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${p.primary}88`,
            boxShadow: `0 0 20px ${p.primary}55`,
          }}>
            <span style={{ fontFamily: cfg.fonts.headline, fontSize: vsSize, color: p.primary, fontWeight: 900 }}>VS</span>
          </div>

          {/* Right panel */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: rightPanelBg,
            borderRadius: '0 16px 16px 0',
            padding: isVertical ? '44px 20px' : '36px 16px',
            gap: isVertical ? 18 : 14,
            border: `1px solid ${rightWin ? p.primary + '88' : 'rgba(255,255,255,0.08)'}`,
            borderLeft: 'none',
            transform: `translateX(${(1 - rightIn) * 50}px)`,
            opacity: rightIn,
            boxShadow: rightWin ? `inset 0 0 40px ${p.primary}18, 0 0 30px ${p.primary}22` : 'none',
          }}>
            <Emoji3D emoji={visual.right?.icon ?? ''} size={iconSize} />
            <div style={{
              color: rightWin ? getTextColor(scene.bg) : getSubtextColor(scene.bg),
              fontFamily: cfg.fonts.headline,
              fontSize: labelSize,
              fontWeight: 900,
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              textShadow: getTextShadow(scene.bg),
            }}>
              {visual.right?.label}
            </div>
            {rightWin && (
              <div style={{
                fontFamily: cfg.fonts.code,
                fontSize: isVertical ? 22 : 18,
                color: p.primary,
                letterSpacing: '2px',
              }}>
                ▶ VINCITORE
              </div>
            )}
          </div>
        </div>

        {scene.subtext && (
          <div style={{
            color: getSubtextColor(scene.bg),
            fontFamily: cfg.fonts.body,
            fontSize: isVertical ? 28 : 22,
            textAlign: 'center',
            opacity: headlineOpacity * 0.6,
            textShadow: getTextShadow(scene.bg),
          }}>
            {scene.subtext}
          </div>
        )}
      </AbsoluteFill>

      {cfg.sounds.enabled && (
        <Sequence from={0} durationInFrames={14}>
          <Audio src={staticFile(`sounds/${cfg.sounds.perSceneType.comparison}`)} volume={cfg.sounds.volume} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
