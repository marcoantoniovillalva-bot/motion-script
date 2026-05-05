import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';
import type { MotionScriptScene } from '../motion-script-types';

export const ScreenshotScene: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cfg = motionConfig;
  const p = cfg.palette;

  const visual = scene.visual as { kind: 'browser'; src: string; url: string; label?: string };
  const duration = scene.end - scene.start;
  const totalFrames = Math.round(duration * fps);

  const isVertical = height > width;

  // Frame entry: scale + fade in
  const frameEntry = spring({ frame, fps, config: { stiffness: 140, damping: 18, mass: 0.9 } });

  // Scroll animation: pan up through page after 1s, stop before end
  const scrollStart = Math.round(fps * 1.2);
  const scrollEnd = totalFrames - Math.round(fps * 1.2);
  const scrollProgress = interpolate(frame, [scrollStart, scrollEnd], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scrollY = interpolate(scrollProgress, [0, 1], [0, -28]); // percentage

  // Text entry
  const labelEntry = spring({ frame: Math.max(0, frame - 12), fps, config: { stiffness: 120, damping: 20 } });

  const browserTopPx = isVertical ? 120 : 80;
  const browserSidePx = isVertical ? 40 : 80;
  const browserH = isVertical ? height - browserTopPx - 200 : height - browserTopPx - 160;
  const urlBarH = isVertical ? 52 : 44;

  const displayUrl = visual.url
    ? visual.url.replace('https://', '').replace('http://', '').substring(0, 60)
    : '';

  return (
    <AbsoluteFill style={{ background: '#0a0a12' }}>
      {/* Ambient glow behind browser */}
      <div style={{
        position: 'absolute',
        top: '30%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: width * 0.8,
        height: height * 0.5,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${p.primary}18 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Browser window */}
      <div style={{
        position: 'absolute',
        top: browserTopPx,
        left: browserSidePx,
        right: browserSidePx,
        height: browserH,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.08)',
        transform: `scale(${frameEntry})`,
        transformOrigin: 'top center',
      }}>
        {/* Browser chrome bar */}
        <div style={{
          height: urlBarH,
          background: '#1c1c28',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          {/* Traffic lights */}
          {['#FF5F56', '#FFBD2E', '#27C93F'].map((c, i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c, opacity: 0.9 }} />
          ))}
          {/* URL bar */}
          <div style={{
            flex: 1,
            marginLeft: 12,
            background: '#0d0d1a',
            borderRadius: 7,
            padding: isVertical ? '8px 14px' : '6px 12px',
            color: '#8b949e',
            fontFamily: cfg.fonts.code,
            fontSize: isVertical ? 18 : 14,
            letterSpacing: '0.3px',
            border: '1px solid rgba(255,255,255,0.08)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            🔒 {displayUrl}
          </div>
        </div>

        {/* Screenshot content */}
        <div style={{ flex: 1, overflow: 'hidden', background: '#fff', height: browserH - urlBarH }}>
          {visual.src ? (
            <Img
              src={staticFile(visual.src)}
              style={{
                width: '100%',
                display: 'block',
                transform: `translateY(${scrollY}%)`,
                transformOrigin: 'top center',
              }}
            />
          ) : (
            // Placeholder when screenshot not yet fetched
            <div style={{
              width: '100%', height: '100%',
              background: '#f8f9fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 16,
            }}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>🌐</div>
              <div style={{ color: '#555', fontSize: 18, fontFamily: 'monospace' }}>{displayUrl}</div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom label */}
      <div style={{
        position: 'absolute',
        bottom: isVertical ? 60 : 36,
        left: 0, right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        opacity: labelEntry,
        transform: `translateY(${(1 - labelEntry) * 20}px)`,
      }}>
        {scene.headline && (
          <div style={{
            color: '#FFFFFF',
            fontFamily: cfg.fonts.headline,
            fontSize: isVertical ? 52 : 42,
            fontWeight: 900,
            textAlign: 'center',
            textShadow: '0 2px 12px rgba(0,0,0,0.8)',
            textTransform: 'uppercase',
            letterSpacing: '2px',
          }}>
            {scene.headline}
          </div>
        )}
        {visual.label && (
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            border: `1px solid ${p.primary}66`,
            borderRadius: 20,
            padding: isVertical ? '6px 20px' : '5px 16px',
            color: p.primary,
            fontFamily: cfg.fonts.code,
            fontSize: isVertical ? 20 : 16,
            letterSpacing: '2px',
          }}>
            {visual.label}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
