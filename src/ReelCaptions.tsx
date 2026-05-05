import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CaptionChunk } from './types';

type Props = {
  captions?: CaptionChunk[];
  vertical?: boolean;
};

const ORANGE = '#F04405';
const WHITE = '#FFFFFF';

function activeCaption(captions: CaptionChunk[] | undefined, second: number) {
  return captions?.find((caption) => second >= caption.start && second < caption.end);
}

function stripPunctuation(value: string) {
  return value.replace(/[.,;:!?]+$/g, '');
}

function normalizeWord(value: string) {
  return stripPunctuation(value).toLowerCase();
}

function splitTokens(caption: CaptionChunk) {
  const words = caption.text.split(/\s+/).filter(Boolean);
  const highlight = caption.highlight ? normalizeWord(caption.highlight) : '';
  return words.map((word) => {
    const clean = normalizeWord(word);
    return {
      raw: stripPunctuation(word),
      isHighlight: Boolean(highlight) && clean === highlight,
    };
  });
}

function fontFamilyFor(importance: CaptionChunk['importance']) {
  if (importance === 'high') {
    return 'Impact, Arial Black, Arial, Helvetica, sans-serif';
  }
  if (importance === 'medium') {
    return 'Georgia, Times New Roman, serif';
  }
  return 'Arial, Helvetica, sans-serif';
}

function baseFontSize(vertical: boolean, importance: CaptionChunk['importance'], length: number) {
  const base = vertical
    ? importance === 'high' ? 104 : importance === 'medium' ? 64 : 48
    : importance === 'high' ? 82 : importance === 'medium' ? 48 : 34;
  if (length > 24) return base * 0.78;
  if (length > 16) return base * 0.88;
  return base;
}

export const ReelCaptions: React.FC<Props> = ({ captions, vertical = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const second = frame / fps;
  const caption = activeCaption(captions, second);

  if (!caption) return null;

  const importance = caption.importance || (caption.highlight ? 'high' : 'low');
  const tokens = splitTokens(caption);
  const localFrame = Math.max(0, frame - caption.start * fps);
  const pop = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: importance === 'high' ? 190 : 135, mass: 0.72 },
  });
  const opacity = interpolate(localFrame, [0, 3, 999], [0, 1, 1], { extrapolateRight: 'clamp' });
  const textLength = tokens.map((token) => token.raw).join(' ').length;
  const top = vertical ? 1040 : 390;
  const size = baseFontSize(vertical, importance, textLength);
  const family = fontFamilyFor(importance);
  const uppercase = importance === 'high';

  return (
    <div
      style={{
        position: 'absolute',
        left: vertical ? 56 : 150,
        right: vertical ? 56 : 150,
        top,
        opacity,
        transform: `scale(${0.92 + pop * 0.08})`,
        textAlign: 'center',
        lineHeight: importance === 'high' ? 0.94 : 1.08,
        filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.46))',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'inline',
          fontFamily: family,
          fontSize: size,
          fontWeight: importance === 'low' ? 700 : 950,
          fontStyle: importance === 'medium' ? 'italic' : 'normal',
          letterSpacing: importance === 'high' ? 1.2 : 0,
          textTransform: uppercase ? 'uppercase' : 'none',
          WebkitTextStroke: importance === 'high'
            ? vertical ? '2px rgba(0,0,0,0.18)' : '1px rgba(0,0,0,0.16)'
            : '0px transparent',
        }}
      >
        {tokens.map((token, index) => {
          const isHot = token.isHighlight && importance === 'high';
          return (
            <React.Fragment key={`${token.raw}-${index}`}>
              <span
                style={{
                  color: isHot ? ORANGE : WHITE,
                  fontFamily: isHot ? 'Impact, Arial Black, Arial, Helvetica, sans-serif' : family,
                  fontWeight: isHot ? 950 : undefined,
                }}
              >
                {uppercase || isHot ? token.raw.toUpperCase() : token.raw}
              </span>
              {index < tokens.length - 1 ? ' ' : ''}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
