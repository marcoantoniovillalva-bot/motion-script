import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import { getTextColor, getSubtextColor, getTextShadow, isLightColor } from '../colorUtils';
import type { MotionScriptScene } from '../motion-script-types';
import { Emoji3D } from './Emoji3D';
import { TechBackground } from './TechBackground';
import { LightBackground } from './LightBackground';
import { useTechTransition } from './useTechTransition';

export const FlowScene: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;
  const p = cfg.palette;

  const { style: techStyle, scanY, scanOpacity } = useTechTransition({ sceneDuration: scene.end - scene.start });

  const visual = scene.visual as { kind: 'flow'; steps: { icon: string; label: string; color?: string }[] };
  const steps = visual.kind === 'flow' ? visual.steps : [];

  const staggerFrames = Math.max(10, Math.round(((scene.end - scene.start) * fps * 0.75) / Math.max(steps.length, 1)));
  const headlineOpacity = spring({ frame, fps, config: { stiffness: 140, damping: 16 } });

  const isVertical = height > width;
  const isLight = isLightColor(scene.bg ?? '#090909');
  const iconSize = isVertical ? 80 : 68;
  const labelSize = isVertical ? 46 : 40;
  const headlineSize = isVertical ? 50 : 48;
  const connectorH = isVertical ? 72 : 30;
  const circleSize = isVertical ? 108 : 88;

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
        padding: isVertical ? '60px 56px' : '50px 80px',
        gap: isVertical ? 20 : 14,
      }}>
        {scene.headline && (
          <div style={{
            color: getSubtextColor(scene.bg),
            fontFamily: cfg.fonts.code,
            fontSize: headlineSize,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            opacity: headlineOpacity,
            marginBottom: 8,
            textShadow: getTextShadow(scene.bg),
            textAlign: 'center',
          }}>
            {scene.headline}
          </div>
        )}

        {steps.map((step, i) => {
          const stepFrame = Math.max(0, frame - i * staggerFrames);
          const stepIn = spring({ frame: stepFrame, fps, config: { stiffness: 220, damping: 16, mass: 0.8 } });
          const connectorProgress = i < steps.length - 1
            ? interpolate(
                Math.max(0, frame - (i + 0.7) * staggerFrames),
                [0, staggerFrames * 0.7],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              )
            : 0;

          const stepColor = step.color ?? p.primary;
          const stepIndex = i + 1;

          return (
            <React.Fragment key={i}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: isVertical ? 18 : 22,
                width: '100%',
                maxWidth: isVertical ? undefined : 860,
                transform: `translateX(${(1 - stepIn) * -40}px)`,
                opacity: stepIn,
              }}>
                {/* Step circle with number */}
                <div style={{
                  width: circleSize, height: circleSize,
                  minWidth: circleSize,
                  borderRadius: '50%',
                  background: isLight
                    ? `rgba(255,255,255,0.65)`
                    : `radial-gradient(circle at 35% 35%, ${stepColor}EE, ${stepColor}88)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isLight
                    ? `0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.95), 0 0 0 2px ${p.primary}22`
                    : `0 0 20px ${stepColor}55, 0 4px 16px rgba(0,0,0,0.4)`,
                  border: isLight ? `1px solid rgba(255,255,255,0.85)` : `1px solid ${stepColor}AA`,
                  backdropFilter: isLight ? 'blur(12px)' : undefined,
                  WebkitBackdropFilter: isLight ? 'blur(12px)' : undefined,
                  position: 'relative',
                }}>
                  <Emoji3D emoji={step.icon} size={Math.round(iconSize * 0.72)} />
                </div>

                {/* Step label */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: getTextColor(scene.bg),
                    fontFamily: cfg.fonts.body,
                    fontSize: labelSize,
                    fontWeight: 700,
                    letterSpacing: '0.3px',
                    textShadow: getTextShadow(scene.bg),
                  }}>
                    {step.label}
                  </div>
                </div>

                {/* Step number */}
                <div style={{
                  fontFamily: cfg.fonts.code,
                  fontSize: isVertical ? 24 : 18,
                  color: `${stepColor}66`,
                  letterSpacing: '1px',
                }}>
                  {String(stepIndex).padStart(2, '0')}
                </div>
              </div>

              {/* Connector */}
              {i < steps.length - 1 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  width: '100%',
                  maxWidth: isVertical ? undefined : 860,
                  paddingLeft: circleSize / 2 - 1,
                }}>
                  <div style={{
                    width: 2,
                    height: connectorH,
                    background: `linear-gradient(to bottom, ${stepColor}AA, ${p.coral}66)`,
                    transform: `scaleY(${connectorProgress})`,
                    transformOrigin: 'top',
                    opacity: connectorProgress,
                    boxShadow: `0 0 8px 1px ${stepColor}44`,
                  }} />
                </div>
              )}
            </React.Fragment>
          );
        })}

        {scene.subtext && (
          <div style={{
            color: getSubtextColor(scene.bg),
            fontFamily: cfg.fonts.body,
            fontSize: isVertical ? 28 : 22,
            textAlign: 'center',
            opacity: headlineOpacity * 0.6,
            marginTop: 8,
            textShadow: getTextShadow(scene.bg),
          }}>
            {scene.subtext}
          </div>
        )}
      </AbsoluteFill>

      {cfg.sounds.enabled && steps.map((_, i) => (
        <Sequence key={i} from={i * staggerFrames} durationInFrames={6}>
          <Audio src={staticFile(`sounds/${cfg.sounds.perSceneType.flow}`)} volume={cfg.sounds.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
