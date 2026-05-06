import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { MotionScriptScene } from '../motion-script-types';

// ─── Brand visual presets ──────────────────────────────────────────────────────
const BRANDS = {
  chatgpt: {
    name: 'ChatGPT',
    windowBg:   '#212121',
    sidebarBg:  '#171717',
    headerBg:   '#2d2d2d',
    inputBg:    '#2f2f2f',
    inputBorder:'#555555',
    accent:     '#10a37f',
    userBubble: '#2f2f2f',
    aiBubbleBg: 'transparent',
    textColor:  '#ececec',
    mutedColor: '#8e8ea0',
    modelLabel: 'GPT-4o',
    avatar:     'G',
    avatarBg:   '#10a37f',
  },
  claude: {
    name: 'Claude',
    windowBg:   '#1a1a1a',
    sidebarBg:  '#111111',
    headerBg:   '#222222',
    inputBg:    '#2a2a2a',
    inputBorder:'#444444',
    accent:     '#cf6750',
    userBubble: '#2d2d2d',
    aiBubbleBg: 'transparent',
    textColor:  '#e5e5e5',
    mutedColor: '#888888',
    modelLabel: 'Claude Sonnet',
    avatar:     'A',
    avatarBg:   '#cf6750',
  },
  gemini: {
    name: 'Gemini',
    windowBg:   '#1e1f20',
    sidebarBg:  '#131314',
    headerBg:   '#2a2b2c',
    inputBg:    '#282a2b',
    inputBorder:'#444444',
    accent:     '#8ab4f8',
    userBubble: '#303133',
    aiBubbleBg: 'transparent',
    textColor:  '#e8eaed',
    mutedColor: '#9aa0a6',
    modelLabel: 'Gemini 2.5 Pro',
    avatar:     '✦',
    avatarBg:   '#4285f4',
  },
  deepseek: {
    name: 'DeepSeek',
    windowBg:   '#0d1117',
    sidebarBg:  '#010409',
    headerBg:   '#161b22',
    inputBg:    '#21262d',
    inputBorder:'#30363d',
    accent:     '#4b9eff',
    userBubble: '#21262d',
    aiBubbleBg: 'transparent',
    textColor:  '#c9d1d9',
    mutedColor: '#8b949e',
    modelLabel: 'DeepSeek-V4',
    avatar:     'D',
    avatarBg:   '#4b9eff',
  },
  meta: {
    name: 'Meta AI',
    windowBg:   '#1c1e21',
    sidebarBg:  '#18191a',
    headerBg:   '#242526',
    inputBg:    '#3a3b3c',
    inputBorder:'#4e4f50',
    accent:     '#2374e1',
    userBubble: '#2374e1',
    aiBubbleBg: '#3a3b3c',
    textColor:  '#e4e6eb',
    mutedColor: '#b0b3b8',
    modelLabel: 'LLaMA 3.3',
    avatar:     'M',
    avatarBg:   '#2374e1',
  },
  perplexity: {
    name: 'Perplexity',
    windowBg:   '#1a1a2e',
    sidebarBg:  '#16213e',
    headerBg:   '#0f3460',
    inputBg:    '#16213e',
    inputBorder:'#0f3460',
    accent:     '#20dfdf',
    userBubble: '#0f3460',
    aiBubbleBg: 'transparent',
    textColor:  '#e0e0e0',
    mutedColor: '#909090',
    modelLabel: 'Pro Search',
    avatar:     'P',
    avatarBg:   '#20dfdf',
  },
};

// ─── Typing text animation ─────────────────────────────────────────────────────
const TypedText: React.FC<{ text: string; frame: number; startFrame: number; charsPerFrame?: number; color: string; fontSize: number; fontFamily: string }> = ({
  text, frame, startFrame, charsPerFrame = 1.2, color, fontSize, fontFamily,
}) => {
  const elapsed = Math.max(0, frame - startFrame);
  const chars = Math.min(text.length, Math.floor(elapsed * charsPerFrame));
  const visible = text.slice(0, chars);
  const showCursor = chars < text.length;

  return (
    <span style={{ color, fontSize, fontFamily, lineHeight: 1.6 }}>
      {visible}
      {showCursor && (
        <span style={{
          display: 'inline-block',
          width: 2,
          height: fontSize * 1.1,
          background: color,
          marginLeft: 2,
          verticalAlign: 'middle',
          opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0,
        }} />
      )}
    </span>
  );
};

// ─── Thinking dots ─────────────────────────────────────────────────────────────
const ThinkingDots: React.FC<{ frame: number; color: string }> = ({ frame, color }) => (
  <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 0' }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{
        width: 8, height: 8, borderRadius: '50%', background: color,
        opacity: 0.3 + 0.7 * ((Math.sin(frame * 0.18 - i * 1.1) + 1) / 2),
      }} />
    ))}
  </div>
);

// ─── Sidebar conversation item ─────────────────────────────────────────────────
const SidebarItem: React.FC<{ text: string; active?: boolean; theme: typeof BRANDS['chatgpt'] }> = ({ text, active, theme }) => (
  <div style={{
    padding: '10px 14px',
    borderRadius: 8,
    background: active ? `${theme.accent}22` : 'transparent',
    color: active ? theme.textColor : theme.mutedColor,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    borderLeft: active ? `2px solid ${theme.accent}` : '2px solid transparent',
    marginBottom: 2,
  }}>
    {text}
  </div>
);

// ─── Main BrandScene ───────────────────────────────────────────────────────────
export const BrandScene: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isVertical = height > width;

  const visual = scene.visual as { kind: 'brand-chat'; brand: keyof typeof BRANDS; prompt: string; response: string };
  const theme = BRANDS[visual.brand] ?? BRANDS.chatgpt;

  const sceneDurationFrames = Math.round((scene.end - scene.start) * fps);

  // Animation timing
  const SIDEBAR_IN  = 0;
  const HEADER_IN   = 4;
  const USER_START  = 14;
  const THINK_START = USER_START + Math.ceil(visual.prompt.length / 1.2) + 6;
  const AI_START    = THINK_START + 20;

  // Entrance springs
  const windowSpring = spring({ frame, fps, config: { stiffness: 120, damping: 18 } });
  const sidebarOpacity = interpolate(frame, [SIDEBAR_IN, SIDEBAR_IN + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const headerOpacity  = interpolate(frame, [HEADER_IN, HEADER_IN + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const userOpacity    = interpolate(frame, [USER_START - 2, USER_START + 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const thinkOpacity   = interpolate(frame, [THINK_START, THINK_START + 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const aiOpacity      = interpolate(frame, [AI_START, AI_START + 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const showThinking = frame >= THINK_START && frame < AI_START;
  const showAI       = frame >= AI_START;

  // Fade out near end
  const fadeOut = interpolate(frame, [sceneDurationFrames - 10, sceneDurationFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const fontFamily = "'Segoe UI', system-ui, -apple-system, sans-serif";
  const fontSize   = isVertical ? 22 : 18;
  const sidebarW   = isVertical ? 220 : 260;

  const scale = 0.88 + windowSpring * 0.12;

  return (
    <AbsoluteFill style={{
      background: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: fadeOut,
    }}>
      {/* Browser chrome outer */}
      <div style={{
        width: isVertical ? '92%' : '90%',
        height: isVertical ? '82%' : '84%',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: `0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)`,
        transform: `scale(${scale})`,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Browser top bar */}
        <div style={{
          background: '#2a2a2a',
          height: 38,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: 8,
          flexShrink: 0,
        }}>
          {['#ff5f57','#febc2e','#28c840'].map((c, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
          ))}
          {/* URL bar */}
          <div style={{
            flex: 1, margin: '0 12px',
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 6,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 10,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontFamily }}>
              🔒 {visual.brand === 'chatgpt' ? 'chat.openai.com' : visual.brand === 'claude' ? 'claude.ai' : visual.brand === 'gemini' ? 'gemini.google.com' : visual.brand === 'deepseek' ? 'chat.deepseek.com' : visual.brand === 'meta' ? 'meta.ai' : 'perplexity.ai'}
            </span>
          </div>
        </div>

        {/* App window */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: theme.windowBg }}>

          {/* Sidebar */}
          {!isVertical && (
            <div style={{
              width: sidebarW,
              background: theme.sidebarBg,
              borderRight: `1px solid rgba(255,255,255,0.06)`,
              display: 'flex',
              flexDirection: 'column',
              padding: '14px 10px',
              opacity: sidebarOpacity,
              flexShrink: 0,
            }}>
              {/* New chat button */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                marginBottom: 12,
              }}>
                <span style={{ color: theme.textColor, fontFamily, fontSize: 15, fontWeight: 600 }}>{theme.name}</span>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: `${theme.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: theme.accent, fontSize: 16 }}>✏</span>
                </div>
              </div>
              <div style={{ color: theme.mutedColor, fontSize: 11, fontFamily, letterSpacing: 1, textTransform: 'uppercase', padding: '0 4px 8px' }}>Oggi</div>
              <SidebarItem text={visual.prompt.slice(0, 30) + (visual.prompt.length > 30 ? '…' : '')} active theme={theme} />
              <SidebarItem text="Marketing con l'IA" theme={theme} />
              <SidebarItem text="Automazione workflow" theme={theme} />
              <SidebarItem text="Analisi competitors" theme={theme} />
            </div>
          )}

          {/* Main chat area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{
              padding: '12px 20px',
              borderBottom: `1px solid rgba(255,255,255,0.06)`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: theme.windowBg,
              opacity: headerOpacity,
              flexShrink: 0,
            }}>
              <span style={{ color: theme.textColor, fontFamily, fontSize: 15, fontWeight: 600 }}>{theme.modelLabel}</span>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3dd68c' }} />
            </div>

            {/* Messages area */}
            <div style={{
              flex: 1,
              overflowY: 'hidden',
              padding: isVertical ? '20px 16px' : '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}>

              {/* User message */}
              <div style={{
                display: 'flex',
                gap: 12,
                opacity: userOpacity,
                alignItems: 'flex-start',
                justifyContent: 'flex-end',
              }}>
                <div style={{
                  background: theme.userBubble,
                  borderRadius: 18,
                  padding: `${isVertical ? 12 : 10}px ${isVertical ? 18 : 16}px`,
                  maxWidth: '75%',
                  border: `1px solid rgba(255,255,255,0.08)`,
                }}>
                  <TypedText
                    text={visual.prompt}
                    frame={frame}
                    startFrame={USER_START}
                    color={theme.textColor}
                    fontSize={fontSize}
                    fontFamily={fontFamily}
                  />
                </div>
                <div style={{
                  width: isVertical ? 34 : 30,
                  height: isVertical ? 34 : 30,
                  borderRadius: '50%',
                  background: '#555',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#fff',
                  fontSize: 13,
                  fontFamily,
                }}>U</div>
              </div>

              {/* AI response */}
              {(showThinking || showAI) && (
                <div style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  opacity: Math.max(thinkOpacity, aiOpacity),
                }}>
                  <div style={{
                    width: isVertical ? 34 : 30,
                    height: isVertical ? 34 : 30,
                    borderRadius: '50%',
                    background: theme.avatarBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: '#fff',
                    fontSize: 13,
                    fontFamily,
                    fontWeight: 700,
                  }}>{theme.avatar}</div>

                  <div style={{
                    background: theme.aiBubbleBg,
                    maxWidth: '80%',
                    padding: `${isVertical ? 8 : 6}px 0`,
                  }}>
                    {showThinking && !showAI && (
                      <ThinkingDots frame={frame} color={theme.mutedColor} />
                    )}
                    {showAI && (
                      <TypedText
                        text={visual.response}
                        frame={frame}
                        startFrame={AI_START}
                        charsPerFrame={0.9}
                        color={theme.textColor}
                        fontSize={fontSize}
                        fontFamily={fontFamily}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div style={{
              padding: isVertical ? '12px 16px 16px' : '12px 20px 16px',
              flexShrink: 0,
            }}>
              <div style={{
                background: theme.inputBg,
                border: `1px solid ${theme.inputBorder}`,
                borderRadius: 12,
                padding: `${isVertical ? 12 : 10}px 16px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ color: theme.mutedColor, fontSize: fontSize - 2, fontFamily }}>Scrivi un messaggio…</span>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 14 }}>↑</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Headline overlay */}
      {scene.headline && (
        <div style={{
          position: 'absolute',
          top: isVertical ? 40 : 28,
          left: 0, right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: interpolate(frame, [2, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            borderRadius: 8,
            padding: '6px 20px',
            color: '#fff',
            fontFamily,
            fontSize: isVertical ? 22 : 18,
            fontWeight: 600,
            letterSpacing: '0.5px',
          }}>
            {scene.headline}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
