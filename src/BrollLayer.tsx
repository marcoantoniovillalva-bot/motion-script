import React from 'react';
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, Easing, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { GlassCard } from './motion-components/GlassCard';
import { MONTRA_FONT, HIGHLIGHT_FONT } from './talking-head-fonts';
import type { BrollAsset, BrollPlan, BrollSegment } from './broll-types';

const ORANGE = '#FF8A1F';
const DARK = '#1A1A1A';
const CREAM = '#FAF9F5';

// Frames spent animating in/out of each segment.
const ENTER = 14;
const EXIT = 10;

export function activeBrollSegment(plan: BrollPlan | undefined, t: number): BrollSegment | undefined {
  return plan?.segments?.find((s) => t >= s.start && t < s.end);
}

/** 0→1 while entering, 1 during hold, →0 while exiting. Drives every template's animation. */
function segmentProgress(seg: BrollSegment, frame: number, fps: number) {
  const startF = seg.start * fps;
  const endF = seg.end * fps;
  const enter = interpolate(frame, [startF, startF + ENTER], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.34, 1.56, 0.64, 1), // overshoot: iOS-icon bounce
  });
  const exit = interpolate(frame, [endF - EXIT, endF], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.4, 0, 1, 1),
  });
  return Math.min(enter, exit);
}

/** Linear (no overshoot) variant for opacity — a bouncy alpha looks like flicker. */
function segmentOpacity(seg: BrollSegment, frame: number, fps: number) {
  const startF = seg.start * fps;
  const endF = seg.end * fps;
  const enter = interpolate(frame, [startF, startF + ENTER], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const exit = interpolate(frame, [endF - EXIT, endF], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return Math.min(enter, exit);
}

// The plan sometimes bakes a "✓" into the item text — the UI draws its own checkmark.
function cleanItem(value: string) {
  return value.replace(/\s*[✓✔]\s*$/u, '');
}

/** Animated mock desktop UI — automation checklist that completes itself. */
const MockTasks: React.FC<{ title?: string; items: string[]; local: number }> = ({ title, items, local }) => (
  <div style={{ width: '100%', height: '100%', background: CREAM, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '36px 46px', gap: 16 }}>
    <div style={{ fontFamily: MONTRA_FONT, fontWeight: 800, fontSize: 40, color: DARK, marginBottom: 6 }}>{title ?? 'Automazioni attive'}</div>
    {items.map((item, i) => {
      const doneAt = 0.7 + i * 0.9; // one task completes every ~0.9s
      const pop = interpolate(local, [doneAt, doneAt + 0.3], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      });
      return (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 16, padding: '15px 22px' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: pop > 0 ? ORANGE : '#E8E4DC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontSize: 22,
              fontWeight: 800,
              scale: String(0.85 + pop * 0.15),
              flexShrink: 0,
            }}
          >
            {pop > 0.4 ? '✓' : ''}
          </div>
          <div style={{ fontFamily: MONTRA_FONT, fontSize: 30, color: DARK, opacity: 0.55 + pop * 0.45 }}>{cleanItem(item)}</div>
        </div>
      );
    })}
  </div>
);

/** Animated mock desktop UI — chat with the AI agent, bubbles typing in one by one. */
const MockChat: React.FC<{ title?: string; items: string[]; local: number }> = ({ title, items, local }) => (
  <div style={{ width: '100%', height: '100%', background: CREAM, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '34px 44px', gap: 14 }}>
    <div style={{ fontFamily: MONTRA_FONT, fontWeight: 800, fontSize: 38, color: DARK, marginBottom: 4 }}>{title ?? 'Agente IA'}</div>
    {items.map((msg, i) => {
      const showAt = 0.5 + i * 1.05;
      const pop = interpolate(local, [showAt, showAt + 0.35], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      });
      if (pop === 0) return null;
      const fromAgent = i % 2 === 0;
      return (
        <div
          key={i}
          style={{
            alignSelf: fromAgent ? 'flex-start' : 'flex-end',
            maxWidth: '78%',
            background: fromAgent ? '#FFFFFF' : ORANGE,
            color: fromAgent ? DARK : '#FFFFFF',
            fontFamily: MONTRA_FONT,
            fontSize: 29,
            padding: '16px 24px',
            borderRadius: 22,
            borderBottomLeftRadius: fromAgent ? 6 : 22,
            borderBottomRightRadius: fromAgent ? 22 : 6,
            boxShadow: '0 3px 12px rgba(0,0,0,0.07)',
            opacity: pop,
            scale: String(0.9 + pop * 0.1),
          }}
        >
          {msg}
        </div>
      );
    })}
  </div>
);

/** Brand hook mock — product surface: logo pops, feature name types itself, NEW badge bounces. */
const MockProduct: React.FC<{ title?: string; logoSrc?: string; local: number }> = ({ title, logoSrc, local }) => {
  const label = title ?? 'Manage Agents';
  const typed = label.slice(0, Math.max(0, Math.floor((local - 0.7) * 16)));
  const logoPop = interpolate(local, [0.15, 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const badgePop = interpolate(local, [1.7, 2.05], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: CREAM, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34 }}>
      {logoSrc ? (
        <Img
          src={staticFile(logoSrc)}
          style={{ width: 230, height: 230, objectFit: 'contain', opacity: logoPop, scale: String(0.7 + logoPop * 0.3), filter: 'drop-shadow(0 14px 28px rgba(0,0,0,0.16))' }}
        />
      ) : null}
      <div style={{ fontFamily: MONTRA_FONT, fontWeight: 800, fontSize: 58, color: DARK, minHeight: 70 }}>
        {typed}
        <span style={{ opacity: Math.sin(local * 9) > 0 ? 0.85 : 0, color: ORANGE }}>|</span>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 38,
          right: 44,
          background: ORANGE,
          color: '#FFFFFF',
          fontFamily: MONTRA_FONT,
          fontWeight: 800,
          fontSize: 34,
          padding: '10px 26px',
          borderRadius: 999,
          boxShadow: '0 8px 22px rgba(255,138,31,0.45)',
          opacity: badgePop,
          scale: String(0.5 + badgePop * 0.5),
          rotate: `${(1 - badgePop) * 12 - 6}deg`,
        }}
      >
        NEW
      </div>
    </div>
  );
};

/** Free-resource preview mock — document page, GRATIS badge, chapter index auto-scrolling. */
const MockDoc: React.FC<{ title?: string; subtitle?: string; items: string[]; local: number }> = ({ title, subtitle, items, local }) => {
  const scroll = Math.min(Math.max(0, (local - 1.1) * 62), 120 + items.length * 30);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#ECE8E0', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '86%', marginTop: 34, background: '#FFFFFF', borderRadius: '18px 18px 0 0', boxShadow: '0 10px 42px rgba(0,0,0,0.13)', padding: '44px 52px', translate: `0px ${-scroll}px` }}>
        <div style={{ fontFamily: MONTRA_FONT, fontWeight: 800, fontSize: 52, color: DARK, lineHeight: 1.12 }}>{title ?? 'Guida Gratuita'}</div>
        {subtitle ? (
          <div style={{ fontFamily: HIGHLIGHT_FONT, fontSize: 42, color: ORANGE, marginTop: 10 }}>{subtitle}</div>
        ) : null}
        <div style={{ width: 130, height: 7, background: ORANGE, borderRadius: 4, marginTop: 22, marginBottom: 30 }} />
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: i === 0 ? 0 : 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(255,138,31,0.14)', color: ORANGE, fontFamily: MONTRA_FONT, fontWeight: 800, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {i + 1}
            </div>
            <div style={{ fontFamily: MONTRA_FONT, fontSize: 31, color: DARK }}>{cleanItem(item)}</div>
          </div>
        ))}
        <div style={{ height: 70 }} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 30,
          right: 38,
          background: ORANGE,
          color: '#FFFFFF',
          fontFamily: MONTRA_FONT,
          fontWeight: 800,
          fontSize: 32,
          padding: '9px 24px',
          borderRadius: 999,
          boxShadow: '0 8px 22px rgba(255,138,31,0.45)',
          rotate: '-4deg',
        }}
      >
        GRATIS
      </div>
    </div>
  );
};

/** Two dark cards side by side, orange border on the winner (reference: pricing compare).
 *  VISUAL-FIRST (client feedback: images over words — captions already carry the text):
 *  each item is "icone|Titolo|valore" where icone is one or more comma-separated asset
 *  paths (logos/emoji PNGs) shown BIG, and valore is ONE short word/phrase. */
const MockCompare: React.FC<{ items: string[]; winner?: string; pill?: string; local: number }> = ({ items, winner, pill, local }) => {
  const cards = items.slice(0, 2).map((raw) => {
    const [icons, title, value] = raw.split('|');
    return { icons: (icons ?? '').split(',').filter(Boolean), title: title ?? '', value: value ?? '' };
  });
  const pillPop = interpolate(local, [1.3, 1.65], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  return (
    <div style={{ width: '100%', height: '100%', background: CREAM, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: '34px 40px' }}>
      <div style={{ display: 'flex', gap: 26, width: '100%', justifyContent: 'center' }}>
        {cards.map((card, i) => {
          const isWinner = (winner === 'right') === (i === 1);
          const cardPop = interpolate(local, [0.25 + i * 0.35, 0.6 + i * 0.35], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          });
          return (
            <div
              key={i}
              style={{
                width: '44%',
                background: DARK,
                borderRadius: 26,
                border: isWinner ? `4px solid ${ORANGE}` : '4px solid rgba(255,255,255,0.08)',
                padding: '34px 26px',
                textAlign: 'center',
                opacity: cardPop,
                scale: String(0.86 + cardPop * (isWinner ? 0.18 : 0.14)),
                boxShadow: isWinner ? '0 14px 40px rgba(255,138,31,0.28)' : '0 12px 32px rgba(0,0,0,0.35)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', gap: 20, minHeight: 150, alignItems: 'center' }}>
                {card.icons.map((icon, k) => (
                  <Img
                    key={k}
                    src={staticFile(icon)}
                    style={{ width: card.icons.length > 1 ? 110 : 145, height: card.icons.length > 1 ? 110 : 145, objectFit: 'contain', filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.4))' }}
                  />
                ))}
              </div>
              <div style={{ fontFamily: MONTRA_FONT, fontWeight: 800, fontSize: 30, color: 'rgba(250,249,245,0.6)', marginTop: 16 }}>{card.title}</div>
              <div style={{ fontFamily: MONTRA_FONT, fontWeight: 800, fontSize: 52, color: isWinner ? ORANGE : CREAM, marginTop: 8, lineHeight: 1.05 }}>{card.value}</div>
            </div>
          );
        })}
      </div>
      {pill ? (
        <div
          style={{
            background: 'rgba(26,26,26,0.08)',
            border: '1.5px solid rgba(26,26,26,0.18)',
            color: DARK,
            fontFamily: MONTRA_FONT,
            fontWeight: 800,
            fontSize: 32,
            padding: '12px 32px',
            borderRadius: 999,
            opacity: pillPop,
            scale: String(0.7 + pillPop * 0.3),
          }}
        >
          {pill}
        </div>
      ) : null}
    </div>
  );
};

// Comment pills for the BUBBLES template — preset scattered positions (normalized).
const BUBBLE_SPOTS = [
  { x: 0.10, y: 0.16, r: -5 },
  { x: 0.52, y: 0.11, r: 4 },
  { x: 0.16, y: 0.30, r: 3 },
  { x: 0.55, y: 0.27, r: -3 },
  { x: 0.30, y: 0.42, r: 5 },
];

/** iPhone mock with notifications sliding in one by one — the premium, contained version
 *  of "social proof": ordered and readable instead of scattered bubbles. */
const MockPhone: React.FC<{ title?: string; items: string[]; local: number }> = ({ title, items, local }) => (
  <div style={{ width: '100%', height: '100%', background: CREAM, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
    <div style={{ width: 350, height: 690, borderRadius: 56, background: 'linear-gradient(160deg, #2A2723 0%, #171512 70%)', border: '10px solid #0D0C0B', boxShadow: '0 24px 60px rgba(0,0,0,0.35)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 14, left: '50%', translate: '-50% 0px', width: 110, height: 30, borderRadius: 15, background: '#0D0C0B' }} />
      <div style={{ position: 'absolute', top: 70, left: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((msg, i) => {
          const showAt = 0.6 + i * 0.95;
          const pop = interpolate(local, [showAt, showAt + 0.35], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          });
          if (pop === 0) return null;
          return (
            <div key={i} style={{ background: 'rgba(255,255,255,0.95)', borderRadius: 18, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, opacity: pop, translate: `0px ${(1 - pop) * -26}px`, scale: String(0.92 + pop * 0.08), boxShadow: '0 6px 18px rgba(0,0,0,0.25)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${ORANGE}, #D97757)`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: MONTRA_FONT, fontWeight: 800, fontSize: 18 }}>
                {(title ?? 'IA').slice(0, 2)}
              </div>
              <div>
                <div style={{ fontFamily: MONTRA_FONT, fontWeight: 800, fontSize: 20, color: DARK }}>{title ?? 'Agente IA'}</div>
                <div style={{ fontFamily: MONTRA_FONT, fontSize: 21, color: '#3A3733', marginTop: 2 }}>{cleanItem(msg)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

/** Icons popping in sequence with micro-labels — the visual-first replacement for text
 *  lists (client preference: images over words, captions already carry the text). */
const MockIconRow: React.FC<{ items: string[]; local: number; compact: boolean; idleT: number }> = ({ items, local, compact, idleT }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: compact ? 44 : 70, padding: compact ? '40px 40px' : '70px 60px' }}>
    {items.slice(0, 4).map((raw, i) => {
      const [src, label] = raw.split('|');
      const pop = interpolate(local, [0.3 + i * 0.4, 0.65 + i * 0.4], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
      });
      return (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, opacity: pop, scale: String(0.5 + pop * 0.5) }}>
          <Img
            src={staticFile(src)}
            style={{ width: compact ? 170 : 210, height: compact ? 170 : 210, objectFit: 'contain', filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.22))', translate: `0px ${Math.sin(idleT * 2 + i * 1.4) * 8}px` }}
          />
          {label ? <div style={{ fontFamily: MONTRA_FONT, fontWeight: 800, fontSize: compact ? 28 : 34, color: DARK }}>{label}</div> : null}
        </div>
      );
    })}
  </div>
);

/** Tool logos orbiting the central brand logo — "integrations" made visual. */
const MockOrbit: React.FC<{ logoSrc?: string; items: string[]; local: number }> = ({ logoSrc, items, local }) => {
  const introPop = interpolate(local, [0.2, 0.55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const R = 255;
  return (
    <div style={{ width: '100%', height: '100%', background: CREAM, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%', width: R * 2, height: R * 1.72, borderRadius: '50%', border: '2px dashed rgba(26,26,26,0.14)' }} />
      {logoSrc ? (
        <Img
          src={staticFile(logoSrc)}
          style={{ position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%', width: 170, height: 170, objectFit: 'contain', opacity: introPop, scale: String(0.6 + introPop * 0.4), filter: `drop-shadow(0 0 34px rgba(255,138,31,0.45)) drop-shadow(0 10px 24px rgba(0,0,0,0.2))` }}
        />
      ) : null}
      {items.map((src, i) => {
        const angle = (i / Math.max(items.length, 1)) * Math.PI * 2 + local * 0.5;
        const x = Math.cos(angle) * R;
        const y = Math.sin(angle) * R * 0.86;
        return (
          <Img
            key={i}
            src={staticFile(src)}
            style={{ position: 'absolute', left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, translate: '-50% -50%', width: 96, height: 96, objectFit: 'contain', opacity: introPop, filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.25))' }}
          />
        );
      })}
    </div>
  );
};

/** Faithful recreation of a real product console session (researched from the actual
 *  product docs — e.g. Claude Managed Agents emits literally "[Using tool: bash]" and
 *  "Agent finished."). Line prefixes: "$ " command (typewritten char by char),
 *  "[" tool call (orange), "✓" success (green-ish), anything else = plain output. */
const MockAgentConsole: React.FC<{ items: string[]; local: number }> = ({ items, local }) => {
  const MONO = 'Consolas, Menlo, monospace';
  let clock = 0.4;
  const timed = items.map((line) => {
    const isCmd = line.startsWith('$ ');
    const showAt = clock;
    clock += isCmd ? 0.28 + line.length * 0.028 : 0.55;
    return { line, showAt, isCmd };
  });
  return (
    <div style={{ width: '100%', height: '100%', background: '#1E1C19', padding: '34px 40px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
      {timed.map(({ line, showAt, isCmd }, i) => {
        if (local < showAt) return null;
        const isTool = line.startsWith('[');
        const isOk = line.startsWith('✓') || line.includes('✓');
        const shown = isCmd ? '$ ' + line.slice(2, 2 + Math.max(0, Math.floor((local - showAt) * 36))) : line;
        return (
          <div
            key={i}
            style={{
              fontFamily: MONO,
              fontSize: 27,
              lineHeight: 1.45,
              color: isTool ? ORANGE : isOk ? '#7BC47F' : isCmd ? CREAM : 'rgba(250,249,245,0.75)',
              fontWeight: isCmd ? 700 : 400,
            }}
          >
            {shown}
            {isCmd && local - showAt < (line.length - 2) / 36 ? <span style={{ color: ORANGE }}>▌</span> : null}
          </div>
        );
      })}
    </div>
  );
};

const AssetContent: React.FC<{ asset: BrollAsset; compact: boolean; local: number }> = ({ asset, compact, local }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Idle motion for icons: the client wants every b-roll visibly alive — a gentle float
  // and wobble, like an app icon waiting to be tapped.
  const idleT = frame / fps;
  switch (asset.kind) {
    case 'stat': {
      // Count-up animation: digits in the value climb from 0 to target in ~0.9s (eased),
      // prefix/suffix stay fixed ("H24" → H0…H24, "15 min" → 0…15 min).
      const match = asset.value.match(/^(\D*)(\d+)(.*)$/);
      let shown = asset.value;
      if (match) {
        const target = parseInt(match[2], 10);
        const eased = 1 - Math.pow(1 - Math.min(1, Math.max(0, (local - 0.15) / 0.9)), 3);
        shown = `${match[1]}${Math.round(target * eased)}${match[3]}`;
      }
      return (
        <div style={{ textAlign: 'center', padding: compact ? '38px 56px' : '64px 80px' }}>
          <div style={{ fontFamily: HIGHLIGHT_FONT, fontSize: compact ? 130 : 190, color: ORANGE, lineHeight: 1 }}>
            {shown}
          </div>
          <div style={{ fontFamily: MONTRA_FONT, fontSize: compact ? 40 : 54, color: DARK, marginTop: 18, fontWeight: 800 }}>
            {asset.label}
          </div>
        </div>
      );
    }
    case 'list':
      return (
        <div style={{ padding: compact ? '36px 52px' : '56px 72px' }}>
          {asset.title ? (
            <div style={{ fontFamily: MONTRA_FONT, fontSize: compact ? 44 : 58, color: DARK, fontWeight: 800, marginBottom: 22 }}>
              {asset.title}
            </div>
          ) : null}
          {asset.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: i === 0 ? 0 : 16 }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, background: ORANGE, flexShrink: 0 }} />
              <div style={{ fontFamily: MONTRA_FONT, fontSize: compact ? 38 : 48, color: DARK, fontWeight: 400 }}>{item}</div>
            </div>
          ))}
        </div>
      );
    case 'text': {
      const parts = asset.emphasis ? asset.text.split(asset.emphasis) : [asset.text];
      return (
        <div style={{ textAlign: 'center', padding: compact ? '42px 58px' : '64px 84px' }}>
          <div style={{ fontFamily: MONTRA_FONT, fontSize: compact ? 48 : 62, color: DARK, fontWeight: 800, lineHeight: 1.25 }}>
            {parts[0]}
            {asset.emphasis ? (
              <span style={{ fontFamily: HIGHLIGHT_FONT, color: ORANGE, fontWeight: 400 }}> {asset.emphasis} </span>
            ) : null}
            {parts[1] ?? ''}
          </div>
        </div>
      );
    }
    case 'image': {
      // Transparent icons (Fluent emoji, SVGL logos, Vecteezy vectors) float inside the
      // card with a soft drop shadow for the premium glass depth; photos crop to fill.
      const isIcon = asset.source === 'fluent' || asset.source === 'svgl' || asset.source === 'vecteezy';
      if (compact && isIcon) {
        return (
          <div style={{ padding: '38px 60px', display: 'flex', justifyContent: 'center' }}>
            <Img
              src={staticFile(asset.src)}
              style={{
                width: 300,
                height: 300,
                objectFit: 'contain',
                filter: 'drop-shadow(0 14px 26px rgba(0,0,0,0.22))',
                translate: `0px ${Math.sin(idleT * 2.1) * 11}px`,
                rotate: `${Math.sin(idleT * 1.5 + 1) * 5}deg`,
              }}
            />
          </div>
        );
      }
      // Icons in split/takeover: centered, contained, never cover-stretched (an SVG logo
      // stretched to fill a window looks broken).
      if (isIcon) {
        // Explicit width/height (not max*): SVGs often carry tiny intrinsic sizes and
        // max-constraints won't upscale them — they'd render as a thumbnail.
        return (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 70 }}>
            <Img
              src={staticFile(asset.src)}
              style={{
                width: '55%',
                height: '60%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 18px 34px rgba(0,0,0,0.2))',
                translate: `0px ${Math.sin(idleT * 1.9) * 14}px`,
                rotate: `${Math.sin(idleT * 1.4 + 1) * 3.5}deg`,
              }}
            />
          </div>
        );
      }
      // Inside a card the container has no intrinsic size — give the image one; in
      // split/takeover it fills the parent.
      return compact ? (
        <Img src={staticFile(asset.src)} style={{ width: 640, height: 430, objectFit: 'cover', display: 'block' }} />
      ) : (
        <Img src={staticFile(asset.src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      );
    }
    case 'video':
      return <OffthreadVideo muted src={staticFile(asset.src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
    case 'logos':
      // Brand logos side by side, floating slightly out of phase for the alive feel.
      return (
        <div style={{ padding: '46px 64px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 70 }}>
          {asset.srcs.map((src, i) => (
            <Img
              key={i}
              src={staticFile(src)}
              style={{
                width: 220,
                height: 220,
                objectFit: 'contain',
                filter: 'drop-shadow(0 14px 26px rgba(0,0,0,0.2))',
                translate: `0px ${Math.sin(idleT * 2 + i * 1.7) * 10}px`,
                rotate: `${Math.sin(idleT * 1.4 + i * 2.1) * 4}deg`,
              }}
            />
          ))}
        </div>
      );
    case 'mockui': {
      const items = asset.items?.length ? asset.items : ['Gestione dati', 'Email promemoria', 'Report settimanale'];
      switch (asset.variant) {
        case 'chat':
          return <MockChat title={asset.title} items={items} local={local} />;
        case 'product':
          return <MockProduct title={asset.title} logoSrc={asset.logoSrc} local={local} />;
        case 'doc':
          return <MockDoc title={asset.title} subtitle={asset.subtitle} items={items} local={local} />;
        case 'compare':
          return <MockCompare items={items} winner={asset.subtitle} pill={asset.title} local={local} />;
        case 'phone':
          return <MockPhone title={asset.title} items={items} local={local} />;
        case 'iconrow':
          return <MockIconRow items={items} local={local} compact={compact} idleT={idleT} />;
        case 'orbit':
          return <MockOrbit logoSrc={asset.logoSrc} items={items} local={local} />;
        case 'agentconsole':
          return <MockAgentConsole items={items} local={local} />;
        default:
          return <MockTasks title={asset.title} items={items} local={local} />;
      }
    }
    default:
      return null;
  }
};

/** macOS-style window chrome for the SPLIT template (reference: user's template #2). */
const MacWindow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ width: '100%', height: '100%', borderRadius: 30, overflow: 'hidden', background: CREAM, boxShadow: '0 18px 60px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column' }}>
    <div style={{ height: 54, background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 26, flexShrink: 0 }}>
      <div style={{ width: 18, height: 18, borderRadius: 9, background: '#FF5F57' }} />
      <div style={{ width: 18, height: 18, borderRadius: 9, background: '#FEBC2E' }} />
      <div style={{ width: 18, height: 18, borderRadius: 9, background: '#28C840' }} />
    </div>
    <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
  </div>
);

type Props = {
  plan?: BrollPlan;
  /** Normalized Y of the caption anchor — cards must stay BELOW the captions. */
  captionY: number;
};

/** B-roll layer for TalkingHeadEdit: renders between footage and captions.
 *  Templates (see .claude/skills/broll-director/SKILL.md): CARD (glass card in the free
 *  band below the captions), SPLIT (macOS-style window in the top half — the footage
 *  repositioning for split lives in TalkingHeadEdit, not here), TAKEOVER (fullscreen). */
export const BrollLayer: React.FC<Props> = ({ plan, captionY }) => {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const t = frame / fps;

  const seg = activeBrollSegment(plan, t);
  if (!seg) return null;

  const p = segmentProgress(seg, frame, fps);
  const opacity = segmentOpacity(seg, frame, fps);

  if (seg.template === 'takeover') {
    return (
      <AbsoluteFill style={{ opacity, pointerEvents: 'none' }}>
        <div style={{ width: '100%', height: '100%', scale: String(1.06 - p * 0.06) }}>
          <AssetContent asset={seg.asset} compact={false} local={t - seg.start} />
        </div>
      </AbsoluteFill>
    );
  }

  if (seg.template === 'pip') {
    // Content-first: dark canvas + window with the content up top; the footage shrinks
    // into a small rounded card (handled by TalkingHeadEdit, which raises its z-index
    // above this layer while pip is active).
    return (
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <AbsoluteFill
          style={{
            background: 'radial-gradient(circle at 32% 18%, #24221F 0%, #131210 62%)',
            opacity,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: width * 0.05,
            right: width * 0.05,
            top: height * 0.045,
            height: height * 0.5,
            opacity,
            translate: `0px ${(p - 1) * 60}px`,
          }}
        >
          <MacWindow>
            <AssetContent asset={seg.asset} compact={false} local={t - seg.start} />
          </MacWindow>
        </div>
      </AbsoluteFill>
    );
  }

  if (seg.template === 'bubbles') {
    // Comment pills popping over the footage — social proof for CTA moments.
    const texts = seg.asset.kind === 'list' ? seg.asset.items : seg.asset.kind === 'text' ? [seg.asset.text] : [];
    const local = t - seg.start;
    return (
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {texts.slice(0, 5).map((text, i) => {
          const spot = BUBBLE_SPOTS[i % BUBBLE_SPOTS.length];
          const pop = interpolate(local, [0.25 + i * 0.55, 0.6 + i * 0.55], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          });
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: width * spot.x,
                top: height * spot.y,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: 'rgba(26,26,26,0.88)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 999,
                padding: '16px 30px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                opacity: pop * opacity,
                scale: String(0.6 + pop * 0.4),
                rotate: `${spot.r}deg`,
                translate: `0px ${Math.sin(idle(frame, fps) * 1.8 + i * 2) * 6}px`,
              }}
            >
              <div style={{ width: 22, height: 22, borderRadius: 11, background: `linear-gradient(135deg, ${ORANGE}, #D97757)` }} />
              <div style={{ fontFamily: MONTRA_FONT, fontWeight: 800, fontSize: 34, color: '#FFFFFF' }}>{text}</div>
            </div>
          );
        })}
      </AbsoluteFill>
    );
  }

  if (seg.template === 'split') {
    // Window occupies the top ~45%; footage transform (bottom half) is handled by
    // TalkingHeadEdit via brollSplitProgress so both stay in sync through `p`.
    return (
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            left: width * 0.04,
            right: width * 0.04,
            top: height * 0.035,
            height: height * 0.42,
            opacity,
            translate: `0px ${(p - 1) * 60}px`,
            // Optional premium product-shot tilt: the window enters flat, then leans in
            // gradually ("si inclina poco a poco") and keeps a slow breathing oscillation.
            // Sparingly (per-segment flag), never on dense text or real screen content.
            transform: seg.tilt
              ? (() => {
                  const lean = interpolate(t - seg.start, [0.5, 1.8], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.bezier(0.25, 0.8, 0.35, 1),
                  });
                  return `perspective(1700px) rotateY(${lean * (-7 + Math.sin((frame / fps) * 0.9) * 1.6)}deg) rotateX(${lean * 2.5}deg)`;
                })()
              : undefined,
          }}
        >
          <MacWindow>
            <AssetContent asset={seg.asset} compact={false} local={t - seg.start} />
          </MacWindow>
        </div>
      </AbsoluteFill>
    );
  }

  // CARD (default): glass card centered in the band below the captions.
  const captionBottomPx = captionY * height + 210; // caption anchor + caption block height
  const cardTop = Math.min(captionBottomPx + 30, height * 0.72);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: width * 0.09,
          right: width * 0.09,
          top: cardTop,
          display: 'flex',
          justifyContent: 'center',
          opacity,
          scale: String(0.6 + p * 0.4),
          translate: `0px ${(1 - p) * 46}px`,
        }}
      >
        <GlassCard intensity="strong" accentColor={ORANGE} borderRadius={34} style={{ overflow: 'hidden', maxWidth: '100%' }}>
          <AssetContent asset={seg.asset} compact local={t - seg.start} />
        </GlassCard>
      </div>
    </AbsoluteFill>
  );
};

/** 0→1 while a SPLIT segment is active (with the same enter/exit ramps) — used by
 *  TalkingHeadEdit to slide/scale the footage into the bottom half in sync. */
export function splitProgressAt(plan: BrollPlan | undefined, frame: number, fps: number): number {
  const seg = activeBrollSegment(plan, frame / fps);
  if (!seg || seg.template !== 'split') return 0;
  return segmentProgress(seg, frame, fps);
}

/** 0→1 while a PIP segment is active — TalkingHeadEdit shrinks the footage into a small
 *  rounded card and raises it above the dark canvas drawn by this layer. */
export function pipProgressAt(plan: BrollPlan | undefined, frame: number, fps: number): number {
  const seg = activeBrollSegment(plan, frame / fps);
  if (!seg || seg.template !== 'pip') return 0;
  return segmentProgress(seg, frame, fps);
}

// Shared idle clock for floating animations outside AssetContent.
function idle(frame: number, fps: number) {
  return frame / fps;
}

/** Sound design for the b-roll layer: a soft whoosh when a window slides in, a pop when
 *  a card bounces in, ticks on each checklist completion, an airy reveal on doc/product
 *  mocks. Rendered as parallel Sequences so it works in both the full render and the
 *  transparent b-roll-only export (SFX travel WITH the layer). Volumes stay low — the
 *  voice always leads. SFX files are synthesized in public/sfx/ (no licensing). */
export const BrollAudio: React.FC<{ plan?: BrollPlan }> = ({ plan }) => {
  const { fps } = useVideoConfig();
  if (!plan?.segments?.length) return null;
  return (
    <>
      {plan.segments.map((seg, i) => {
        const startF = Math.round(seg.start * fps);
        const isSplitLike = seg.template === 'split' || seg.template === 'takeover';
        const entrySfx = isSplitLike ? 'sfx/whoosh.wav' : 'sfx/pop.wav';
        const entryVol = isSplitLike ? 0.32 : 0.38;
        const ticks: number[] = [];
        if (seg.asset.kind === 'mockui' && (seg.asset.variant === 'tasks' || seg.asset.variant === 'chat')) {
          const items = seg.asset.items?.length ? seg.asset.items : ['a', 'b', 'c'];
          const step = seg.asset.variant === 'tasks' ? 0.9 : 1.05;
          const first = seg.asset.variant === 'tasks' ? 0.7 : 0.5;
          items.forEach((_, j) => ticks.push(first + j * step));
        }
        const isReveal = seg.asset.kind === 'mockui' && (seg.asset.variant === 'doc' || seg.asset.variant === 'product');
        return (
          <React.Fragment key={i}>
            <Sequence from={startF} durationInFrames={Math.round(fps)} name={`sfx-enter-${i}`}>
              <Audio src={staticFile(entrySfx)} volume={entryVol} />
            </Sequence>
            {isReveal ? (
              <Sequence from={startF + 6} durationInFrames={Math.round(fps)} name={`sfx-reveal-${i}`}>
                <Audio src={staticFile('sfx/reveal.wav')} volume={0.28} />
              </Sequence>
            ) : null}
            {ticks
              .filter((t) => t < seg.end - seg.start)
              .map((t, j) => (
                <Sequence key={j} from={startF + Math.round(t * fps)} durationInFrames={Math.round(fps / 2)} name={`sfx-tick-${i}-${j}`}>
                  <Audio src={staticFile('sfx/tick.wav')} volume={0.24} />
                </Sequence>
              ))}
          </React.Fragment>
        );
      })}
    </>
  );
};
