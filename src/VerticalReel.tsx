import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { AssetOverlays } from './AssetOverlays';
import { ReelCaptions } from './ReelCaptions';
import { SoundDesign } from './SoundDesign';
import { activeCaption, emphasisLevel, microPan, microZoom } from './motion';
import type { Scene, VideoProps } from './types';

const fallbackColors = {
  ink: '#101828',
  blue: '#155EEF',
  mint: '#12B76A',
  orange: '#F97316',
  paper: '#F8FAFC',
};

function activeScene(scenes: Scene[], second: number): Scene {
  return scenes.find((scene) => second >= scene.start && second < scene.end) || scenes[0];
}

export const VerticalReel: React.FC<VideoProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const second = frame / fps;
  const colors = props.brand?.colors || fallbackColors;
  const scene = activeScene(props.scenes || [], second);
  const caption = activeCaption(props.captions, second);
  const level = emphasisLevel(scene, caption);
  const hookPunch = second < 2.2
    ? interpolate(second, [0, 0.18, 1.15, 2.2], [1.055, 1.035, 1.018, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;
  const hookTitleOpacity = interpolate(second, [0, 0.15, 3.2, 4.2], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hookBorderOpacity = interpolate(second, [0, 0.15, 1.05, 1.55], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hookFlash = interpolate(second, [0, 0.2, 0.7], [0.28, 0.16, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const zoom = microZoom(scene, second, level) * hookPunch;
  const pan = microPan(scene, second, level);

  return (
    <AbsoluteFill
      style={{
        background: colors.paper,
        color: colors.ink,
        fontFamily: 'Arial, Helvetica, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(160deg, ${colors.paper} 0%, #FFFFFF 34%, #EAF1FF 100%)`,
          transform: props.footage?.src
            ? undefined
            : `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: 'center center',
        }}
      />

      {props.footage?.src ? (
        <OffthreadVideo
          src={staticFile(props.footage.src)}
          muted
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: props.footage.fit || 'cover',
            opacity: 1,
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: 'center center',
          }}
        />
      ) : null}

      {props.footage?.src ? <Audio src={staticFile(props.footage.src)} volume={1} /> : null}

      {props.footage?.src ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.20))',
            pointerEvents: 'none',
          }}
        />
      ) : null}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `${Math.round(11 * hookBorderOpacity)}px solid rgba(249, 115, 22, ${0.65 * hookBorderOpacity})`,
          boxShadow: `inset 0 0 90px rgba(249, 115, 22, ${hookFlash})`,
          opacity: hookBorderOpacity,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 82,
          left: 64,
          right: 64,
          display: 'flex',
          justifyContent: 'center',
          opacity: hookTitleOpacity,
          transform: `translateY(${interpolate(second, [0, 0.24, 4.2], [-24, 0, -8], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}px) scale(${interpolate(second, [0, 0.18, 4.2], [0.92, 1, 0.98], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })})`,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: 'rgba(16, 24, 40, 0.84)',
            color: '#FFFFFF',
            border: `3px solid ${colors.orange}`,
            padding: '12px 20px',
            fontFamily: 'Impact, Arial Black, Arial, Helvetica, sans-serif',
            fontSize: 38,
            lineHeight: 1,
            letterSpacing: 0,
            textTransform: 'uppercase',
            boxShadow: '0 16px 44px rgba(0,0,0,0.28)',
          }}
        >
          Clienti in automatico?
        </div>
      </div>

      <AssetOverlays assets={props.assetOverlays} />
      <ReelCaptions captions={props.captions} vertical />
      <SoundDesign scenes={props.scenes} captions={props.captions} vertical />
    </AbsoluteFill>
  );
};
