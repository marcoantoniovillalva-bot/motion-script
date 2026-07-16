import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import { isLightColor } from '../colorUtils';
import type { MotionScriptScene } from '../motion-script-types';
import { TechBackground } from './TechBackground';
import { useTechTransition } from './useTechTransition';

type ChatMessage = { role: 'user' | 'ai'; text: string };

const CHARS_PER_SECOND = 18; // typing speed
const THINKING_SECONDS = 0.9;

function buildTimeline(messages: ChatMessage[], fps: number) {
  const frames: { arrivalFrame: number; thinkingEnd: number; typingEnd: number }[] = [];
  let cursor = Math.round(fps * 0.3);

  for (const msg of messages) {
    if (msg.role === 'user') {
      const arrival = cursor;
      frames.push({ arrivalFrame: arrival, thinkingEnd: arrival, typingEnd: arrival + 6 });
      cursor = arrival + Math.round(fps * 1.3);
    } else {
      const arrival = cursor;
      const thinkingEnd = arrival + Math.round(fps * THINKING_SECONDS);
      const typingEnd = thinkingEnd + Math.ceil((msg.text.length / CHARS_PER_SECOND) * fps);
      frames.push({ arrivalFrame: arrival, thinkingEnd, typingEnd });
      cursor = typingEnd + Math.round(fps * 0.6);
    }
  }
  return frames;
}

const ThinkingDots: React.FC<{ frame: number; fps: number; dotSize: number }> = ({ frame, fps, dotSize }) => {
  const t = frame / fps;
  return (
    <div style={{ display: 'flex', gap: dotSize * 0.55, alignItems: 'center', padding: `${dotSize * 0.15}px 0` }}>
      {[0, 1, 2].map(i => {
        const phase = ((t * 2.2 + i * 0.38) % 1 + 1) % 1;
        const opacity = 0.25 + Math.sin(phase * Math.PI) * 0.75;
        return (
          <div key={i} style={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            background: motionConfig.palette.primary,
            opacity,
          }} />
        );
      })}
    </div>
  );
};

export const ChatScene: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;
  const isVertical = height > width;

  const visual = scene.visual as { kind: 'chat'; messages: ChatMessage[] };
  const messages = visual.messages ?? [];
  const timeline = buildTimeline(messages, fps);

  const { style: techStyle, scanY, scanOpacity } = useTechTransition({ sceneDuration: scene.end - scene.start });

  // Chat UI is dark-mode only — ignore any light bg assigned by the parser
  const chatBg = isLightColor(scene.bg ?? '') ? '#0A0A14' : (scene.bg ?? '#070710');

  const fontSize = isVertical ? 36 : 27;
  const labelSize = isVertical ? 22 : 16;
  const bubbleMaxWidth = isVertical ? width * 0.8 : width * 0.55;
  const paddingH = isVertical ? 52 : 100;
  const paddingV = isVertical ? 100 : 70;
  const gap = isVertical ? 30 : 22;
  const dotSize = isVertical ? 14 : 10;

  return (
    <AbsoluteFill>
      <TechBackground bg={chatBg} scanY={scanY} scanOpacity={scanOpacity} />

      <AbsoluteFill style={{
        ...techStyle,
        display: 'flex',
        flexDirection: 'column',
        // Vertical: anchor conversation lower (near where an input would be) to kill the empty void
        justifyContent: isVertical ? 'flex-end' : 'center',
        padding: `${paddingV}px ${paddingH}px`,
        gap,
      }}>
        {scene.headline && (
          <div style={{
            color: 'rgba(255,255,255,0.35)',
            fontFamily: cfg.fonts.code,
            fontSize: isVertical ? 22 : 16,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            {scene.headline}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap }}>
          {messages.map((msg, i) => {
            const { arrivalFrame, thinkingEnd, typingEnd } = timeline[i];
            if (frame < arrivalFrame) return null;

            const isUser = msg.role === 'user';

            const entry = spring({
              frame: Math.max(0, frame - arrivalFrame),
              fps,
              config: { stiffness: 160, damping: 22 },
            });

            let visibleText = msg.text;
            let showThinking = false;
            let isCursorVisible = false;

            if (!isUser) {
              if (frame < thinkingEnd) {
                showThinking = true;
                visibleText = '';
              } else {
                const elapsed = frame - thinkingEnd;
                const charCount = Math.min(
                  msg.text.length,
                  Math.round((elapsed / fps) * CHARS_PER_SECOND)
                );
                visibleText = msg.text.substring(0, charCount);
                showThinking = false;
                isCursorVisible = charCount < msg.text.length;
              }
            }

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  opacity: entry,
                  transform: `translateY(${(1 - entry) * 22}px)`,
                }}
              >
                {/* Role label */}
                <div style={{
                  color: isUser ? 'rgba(255,255,255,0.42)' : `${cfg.palette.primary}cc`,
                  fontFamily: cfg.fonts.code,
                  fontSize: labelSize,
                  letterSpacing: '1.5px',
                  marginBottom: isVertical ? 10 : 7,
                  paddingLeft: isUser ? 0 : 10,
                  paddingRight: isUser ? 10 : 0,
                }}>
                  {isUser ? '👤 Tu' : '🤖 Claude'}
                </div>

                {/* Message bubble */}
                <div style={{
                  maxWidth: bubbleMaxWidth,
                  background: isUser
                    ? 'rgba(255,255,255,0.07)'
                    : 'rgba(252, 55, 24, 0.10)',
                  border: `1px solid ${isUser ? 'rgba(255,255,255,0.10)' : cfg.palette.primary + '38'}`,
                  borderRadius: isUser
                    ? `${fontSize}px ${fontSize * 0.25}px ${fontSize}px ${fontSize}px`
                    : `${fontSize * 0.25}px ${fontSize}px ${fontSize}px ${fontSize}px`,
                  padding: isVertical ? '22px 30px' : '14px 22px',
                  backdropFilter: 'blur(12px)',
                  boxShadow: isUser
                    ? '0 4px 20px rgba(0,0,0,0.3)'
                    : `0 4px 20px rgba(252,55,24,0.08), 0 0 0 0px transparent`,
                }}>
                  {showThinking ? (
                    <ThinkingDots frame={frame - arrivalFrame} fps={fps} dotSize={dotSize} />
                  ) : (
                    <div style={{
                      color: '#FFFFFF',
                      fontFamily: cfg.fonts.body,
                      fontSize,
                      lineHeight: 1.55,
                      letterSpacing: '0.2px',
                    }}>
                      {visibleText}
                      {isCursorVisible && (
                        <span style={{
                          opacity: Math.sin(frame * 0.38) > 0 ? 1 : 0,
                          color: cfg.palette.primary,
                          fontWeight: 700,
                          marginLeft: 1,
                        }}>|</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
