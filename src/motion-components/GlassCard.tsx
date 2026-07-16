import React from 'react';

type Intensity = 'light' | 'medium' | 'strong';

type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  intensity?: Intensity;
  accentColor?: string;
  borderRadius?: number;
};

export const GlassCard: React.FC<Props> = ({
  children,
  style,
  intensity = 'medium',
  accentColor,
  borderRadius = 24,
}) => {
  const bgAlpha   = intensity === 'light' ? 0.38 : intensity === 'medium' ? 0.58 : 0.75;
  const blurPx    = intensity === 'light' ? 14   : intensity === 'medium' ? 22   : 32;
  const shadowAlpha = intensity === 'light' ? 0.05 : intensity === 'medium' ? 0.08 : 0.12;

  return (
    <div style={{
      background: `rgba(255, 255, 255, ${bgAlpha})`,
      backdropFilter: `blur(${blurPx}px)`,
      WebkitBackdropFilter: `blur(${blurPx}px)`,
      border: '1px solid rgba(255, 255, 255, 0.82)',
      borderRadius,
      boxShadow: [
        `0 8px 40px rgba(0,0,0,${shadowAlpha})`,
        `inset 0 1px 0 rgba(255,255,255,0.96)`,
        `0 0 0 0.5px rgba(0,0,0,0.04)`,
        accentColor ? `inset 0 0 0 1.5px ${accentColor}22` : '',
      ].filter(Boolean).join(', '),
      ...style,
    }}>
      {children}
    </div>
  );
};
