import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CaptionChunk } from './types';
import { HIGHLIGHT_FONT, MONTRA_FONT } from './talking-head-fonts';

type Props = {
  captions?: CaptionChunk[];
  vertical?: boolean;
  /** Normalized (0-1) chin Y from face-track.py — overrides the fixed `top` so captions
   *  follow the subject's chin instead of sitting at a constant screen position. */
  chinY?: number;
  /** One consistent bold sans font at all times, original case, no italic serif "medium"
   *  tier — matches the talking-head reference style: each caption chunk is EITHER fully
   *  white (Montra) OR fully the orange keyword font (never mixed within one chunk), unlike
   *  the reel system's per-word highlight + 3-tier styling. */
  simpleStyle?: boolean;
};

// Vivid but slightly muted orange matching the "regalato" reference fill; the earlier
// #F04405 read as red and #FF7900 as too neon on the graded footage.
const ORANGE = '#FF8A1F';
const WHITE = '#FFFFFF';

function activeCaption(captions: CaptionChunk[] | undefined, second: number) {
  return captions?.find((caption) => second >= caption.start && second < caption.end);
}

function stripPunctuation(value: string) {
  return value.replace(/[.,;:!?]+$/g, '');
}

// Displayed words keep ? and ! — they carry meaning ("Ci stai?"); only the clutter
// punctuation (commas, periods, colons) is stripped from captions.
function displayWord(value: string) {
  return value.replace(/[.,;:]+$/g, '');
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
      raw: displayWord(word),
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

export const ReelCaptions: React.FC<Props> = ({ captions, vertical = true, chinY, simpleStyle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const second = frame / fps;
  const caption = activeCaption(captions, second);

  if (!caption) return null;

  const importance = caption.importance || (caption.highlight ? 'high' : 'low');
  // Whole-chunk keyword flag for simpleStyle — the entire chunk renders in the orange
  // keyword font, not just one word inside it.
  const isKeywordChunk = Boolean(caption.highlight);
  const localFrame = Math.max(0, frame - caption.start * fps);
  const pop = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: importance === 'high' ? 190 : 135, mass: 0.72 },
  });
  const opacity = interpolate(localFrame, [0, 3, 999], [0, 1, 1], { extrapolateRight: 'clamp' });
  const frameHeight = vertical ? 1920 : 1080;
  const top = chinY != null
    ? chinY * frameHeight + (vertical ? 34 : 22)
    : (vertical ? 1040 : 390);

  if (simpleStyle) {
    const text = stripPunctuation(caption.text);
    // Script fonts read visually smaller than a bold sans at the same CSS size, and a
    // gradient fill hurts legibility — solid orange + a white outline (matching the
    // reference's bordered-keyword look) reads much better, so keyword chunks get an
    // extra size boost on top of the normal scaling.
    const baseSize = baseFontSize(vertical, 'low', text.length) * (text.length > 12 ? 1.5 : 1.75);
    const size = isKeywordChunk ? baseSize * 1.45 : baseSize;
    const family = isKeywordChunk ? HIGHLIGHT_FONT : MONTRA_FONT;

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
          lineHeight: 1.08,
          filter: isKeywordChunk
            ? 'drop-shadow(0 4px 7px rgba(26,26,26,0.4))'
            : 'drop-shadow(0 3px 5px rgba(0,0,0,0.55))',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'inline',
            fontFamily: family,
            fontSize: size,
            fontWeight: isKeywordChunk ? 400 : 800,
            ...(isKeywordChunk
              ? {
                  color: ORANGE,
                  // WebkitTextStroke is centered on the glyph edge and paintOrder puts the
                  // fill on top, so the visible outline is half this width — 16px ≈ the
                  // reference's ~8px thick white border at 1080-wide frames.
                  WebkitTextStroke: vertical ? '16px #FFFFFF' : '10px #FFFFFF',
                  paintOrder: 'stroke fill',
                }
              : { color: WHITE }),
          }}
        >
          {text}
        </div>
      </div>
    );
  }

  const tokens = splitTokens(caption);
  const textLength = tokens.map((token) => token.raw).join(' ').length;
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
