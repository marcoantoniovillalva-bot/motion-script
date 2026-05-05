import React from 'react';
import {
  Audio,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { AssetOverlay } from './types';

type Props = {
  assets?: AssetOverlay[];
};

function soundFile(sound: AssetOverlay['sound']) {
  if (sound === 'pop') return 'sounds/pop-soft.wav';
  if (sound === 'ui-blip') return 'sounds/ui-blip.wav';
  if (sound === 'bass-hit') return 'sounds/bass-hit-soft.wav';
  if (sound === 'whoosh') return 'sounds/whoosh-soft.wav';
  return null;
}

function placementStyle(placement: AssetOverlay['placement']) {
  const base: React.CSSProperties = {
    position: 'absolute',
    zIndex: 8,
  };

  if (placement === 'top-left') return { ...base, top: 160, left: 58 };
  if (placement === 'top-right') return { ...base, top: 160, right: 58 };
  if (placement === 'bottom-left') return { ...base, bottom: 240, left: 58 };
  if (placement === 'bottom-right') return { ...base, bottom: 240, right: 58 };
  if (placement === 'center') {
    return {
      ...base,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }
  return { ...base, top: 610, right: 52 };
}

function AssetItem({ asset }: { asset: AssetOverlay }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = Math.max((asset.end - asset.start) * fps, 1);
  const exitStart = Math.max(duration - 10, 1);
  const opacity = interpolate(frame, [0, 6, exitStart, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const enterX = asset.animation === 'slide'
    ? interpolate(frame, [0, 8], [42, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;
  const scale = asset.animation === 'pop'
    ? interpolate(frame, [0, 5, 10], [0.88, 1.04, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;
  const style = placementStyle(asset.placement);

  return (
    <div
      style={{
        ...style,
        width: asset.placement === 'side-card' ? 360 : 300,
        opacity,
        transform: `${style.transform || ''} translateX(${enterX}px) scale(${scale})`,
        transformOrigin: 'center center',
        pointerEvents: 'none',
      }}
    >
      {asset.kind === 'badge' ? (
        <div
          style={{
            background: 'rgba(16,24,40,0.88)',
            color: '#FFFFFF',
            border: '2px solid #F97316',
            padding: '14px 18px',
            fontFamily: 'Impact, Arial Black, Arial, Helvetica, sans-serif',
            fontSize: 34,
            lineHeight: 1.04,
            textTransform: 'uppercase',
            boxShadow: '0 18px 48px rgba(0,0,0,0.28)',
          }}
        >
          {asset.text}
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            aspectRatio: asset.kind === 'video' ? '9 / 16' : '4 / 5',
            border: '2px solid rgba(255,255,255,0.72)',
            background: 'rgba(16,24,40,0.72)',
            boxShadow: '0 18px 48px rgba(0,0,0,0.32)',
            overflow: 'hidden',
          }}
        >
          {asset.kind === 'video' && asset.src ? (
            <OffthreadVideo
              src={staticFile(asset.src)}
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : null}
          {(asset.kind === 'image' || asset.kind === 'logo') && asset.src ? (
            <Img
              src={staticFile(asset.src)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: asset.kind === 'logo' ? 'contain' : 'cover',
                padding: asset.kind === 'logo' ? 24 : 0,
                background: asset.kind === 'logo' ? '#FFFFFF' : undefined,
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

export const AssetOverlays: React.FC<Props> = ({ assets = [] }) => {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <>
      {assets.map((asset) => {
        const from = Math.max(0, Math.round(asset.start * fps));
        const duration = Math.max(1, Math.round((asset.end - asset.start) * fps));
        if (from >= durationInFrames) return null;
        const sound = soundFile(asset.sound);

        return (
          <Sequence key={asset.id} from={from} durationInFrames={duration}>
            <AssetItem asset={asset} />
            {sound ? <Audio src={staticFile(sound)} volume={0.09} /> : null}
          </Sequence>
        );
      })}
    </>
  );
};
