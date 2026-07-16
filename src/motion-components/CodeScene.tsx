import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import type { MotionScriptScene } from '../motion-script-types';

const TERMINAL_BG = '#0d1117';
const TERMINAL_CHROME = '#161b22';
const COLOR_CMD = '#58a6ff';
const COLOR_OUTPUT = '#8b949e';
const COLOR_SUCCESS = '#3fb950';

export const CodeScene: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;
  const p = cfg.palette;

  const visual = scene.visual as { kind: 'code'; lines: string[]; lang?: string };
  const lines = visual.kind === 'code' ? visual.lines : [];

  const staggerFrames = Math.max(10, Math.round(((scene.end - scene.start) * fps * 0.75) / Math.max(lines.length, 1)));
  const windowIn = spring({ frame, fps, config: { stiffness: 160, damping: 16, mass: 0.9 } });
  const headlineOpacity = spring({ frame: Math.max(0, frame - 6), fps, config: { stiffness: 120, damping: 18 } });

  // Terminal is always dark — ignore any light bg from the parser
  const bg = '#0d1117';
  const isVertical = height > width;
  const codeSize = isVertical ? 32 : 26;
  const terminalW = isVertical ? '90%' : '80%';
  const headlineSize = isVertical ? 46 : 36;
  const dotSize = isVertical ? 16 : 13;
  const linePad = isVertical ? '12px 24px' : '10px 20px';

  // Cursor blink
  const cursorVisible = Math.floor(frame / 15) % 2 === 0;

  // Determine last visible line index
  const lastVisible = lines.reduce((acc, _, i) => {
    const lineFrame = Math.max(0, frame - i * staggerFrames);
    return lineFrame > 0 ? i : acc;
  }, -1);

  const isCommand = (line: string) => line.startsWith('$') || line.startsWith('>');
  const isSuccess = (line: string) => line.startsWith('✓') || line.startsWith('✅') || line.toLowerCase().startsWith('done');

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <AbsoluteFill style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isVertical ? '60px 40px' : '50px 80px',
        gap: isVertical ? 32 : 24,
      }}>
        {scene.headline && (
          <div style={{
            color: '#FFFFFF',
            fontFamily: cfg.fonts.headline,
            fontSize: headlineSize,
            fontWeight: 900,
            textTransform: 'uppercase',
            opacity: headlineOpacity,
          }}>
            {scene.headline}
          </div>
        )}

        {/* Terminal window */}
        <div style={{
          width: terminalW,
          backgroundColor: TERMINAL_BG,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          transform: `scale(${windowIn})`,
          transformOrigin: 'center top',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {/* Chrome bar */}
          <div style={{
            backgroundColor: TERMINAL_CHROME,
            padding: isVertical ? '14px 18px' : '11px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: dotSize * 0.6,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ width: dotSize, height: dotSize, borderRadius: '50%', backgroundColor: '#ff5f57' }} />
            <div style={{ width: dotSize, height: dotSize, borderRadius: '50%', backgroundColor: '#febc2e' }} />
            <div style={{ width: dotSize, height: dotSize, borderRadius: '50%', backgroundColor: '#28c840' }} />
          </div>

          {/* Lines */}
          <div style={{ padding: isVertical ? '20px 0' : '16px 0' }}>
            {lines.map((line, i) => {
              const lineFrame = Math.max(0, frame - i * staggerFrames);
              const lineOpacity = interpolate(lineFrame, [0, 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              const lineSlide = interpolate(lineFrame, [0, 8], [12, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

              const color = isSuccess(line) ? COLOR_SUCCESS : isCommand(line) ? COLOR_CMD : COLOR_OUTPUT;

              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: linePad,
                    opacity: lineOpacity,
                    transform: `translateY(${lineSlide}px)`,
                  }}
                >
                  {i === lastVisible && cursorVisible && lineFrame > 2 && (
                    <span style={{
                      color: COLOR_SUCCESS,
                      fontFamily: cfg.fonts.code,
                      fontSize: codeSize,
                    }}>▋</span>
                  )}
                  <span style={{
                    color,
                    fontFamily: cfg.fonts.code,
                    fontSize: codeSize,
                    lineHeight: 1.5,
                    whiteSpace: 'pre',
                  }}>
                    {line}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {scene.subtext && (
          <div style={{
            color: 'rgba(255,255,255,0.45)',
            fontFamily: cfg.fonts.body,
            fontSize: isVertical ? 28 : 22,
            textAlign: 'center',
            opacity: headlineOpacity,
          }}>
            {scene.subtext}
          </div>
        )}
      </AbsoluteFill>

      {/* Typing sounds per line */}
      {cfg.sounds.enabled && lines.map((_, i) => (
        <Sequence key={i} from={i * staggerFrames} durationInFrames={4}>
          <Audio src={staticFile(`sounds/${cfg.sounds.perSceneType.code}`)} volume={cfg.sounds.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
