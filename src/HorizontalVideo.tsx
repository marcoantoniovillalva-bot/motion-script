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
import { ReelCaptions } from './ReelCaptions';
import { SoundDesign } from './SoundDesign';
import { activeCaption, emphasisLevel, microPan, microZoom } from './motion';
import type { Scene, VideoProps } from './types';

const colors = {
  ink: '#101828',
  blue: '#155EEF',
  mint: '#12B76A',
  orange: '#F97316',
  paper: '#F8FAFC',
};

function activeScene(scenes: Scene[], second: number): Scene {
  return scenes.find((scene) => second >= scene.start && second < scene.end) || scenes[0];
}

function splitText(text: string, max = 52) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export const HorizontalVideo: React.FC<VideoProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const second = frame / fps;
  const scene = activeScene(props.scenes || [], second);
  const progress = Math.min(frame / durationInFrames, 1);
  const sceneProgress = Math.min(Math.max((second - (scene?.start || 0)) / Math.max((scene?.end || 1) - (scene?.start || 0), 1), 0), 1);
  const opacity = interpolate(sceneProgress, [0, 0.08, 0.92, 1], [0, 1, 1, 0.86]);
  const lines = splitText(scene?.onScreenText || props.title);
  const caption = activeCaption(props.captions, second);
  const level = emphasisLevel(scene, caption);
  const zoom = microZoom(scene, second, level);
  const pan = microPan(scene, second, level);

  return (
    <AbsoluteFill style={{ background: colors.paper, color: colors.ink, fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, #FFFFFF 0%, #EEF4FF 52%, #F8FAFC 100%)',
          transform: props.footage?.src ? undefined : `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
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
            opacity: props.footage.opacity ?? 0.22,
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: 'center center',
          }}
        />
      ) : null}

      {props.footage?.src ? (
        <Audio src={staticFile(props.footage.src)} volume={1} />
      ) : null}

      <div style={{ position: 'absolute', top: 0, left: 0, height: 12, width: `${progress * 100}%`, background: colors.orange }} />

      <div style={{ position: 'absolute', top: 44, left: 64, right: 64, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: colors.blue }}>Marketizzati</div>
        <div style={{ fontSize: 22, color: '#667085', fontWeight: 700 }}>{props.day} · {props.date}</div>
      </div>

      <div style={{ position: 'absolute', top: 126, left: 64, width: 760 }}>
        <div style={{ fontSize: 24, color: colors.orange, fontWeight: 900, textTransform: 'uppercase' }}>
          {scene?.role || 'capitolo'}
        </div>
        <div style={{ marginTop: 18, opacity }}>
          {lines.map((line) => (
            <div key={line} style={{ fontSize: line.length > 44 ? 54 : 64, lineHeight: 1.06, fontWeight: 950, letterSpacing: 0 }}>
              {line}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 158,
          right: 64,
          width: 430,
          minHeight: 260,
          background: colors.ink,
          color: '#FFFFFF',
          padding: 30,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 21, fontWeight: 900, color: colors.mint, textTransform: 'uppercase' }}>Fonte approvata</div>
          <div style={{ marginTop: 14, fontSize: 30, lineHeight: 1.15, fontWeight: 850 }}>
            {props.source?.channel || 'Fonte'}
          </div>
          <div style={{ marginTop: 14, fontSize: 20, lineHeight: 1.28, color: '#D0D5DD' }}>
            {props.source?.videoTitle || ''}
          </div>
        </div>
        <div style={{ fontSize: 19, color: '#98A2B3' }}>AI pratica per PMI italiane</div>
      </div>

      <div style={{ position: 'absolute', left: 64, right: 64, bottom: 92, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {[scene?.visual, scene?.editNote].filter(Boolean).map((item, index) => (
          <div
            key={item}
            style={{
              background: index === 0 ? '#FFFFFF' : '#ECFDF3',
              border: `2px solid ${index === 0 ? '#D0D5DD' : colors.mint}`,
              padding: '22px 26px',
              fontSize: 24,
              lineHeight: 1.25,
              fontWeight: 750,
            }}
          >
            {item}
          </div>
        ))}
      </div>

      <ReelCaptions captions={props.captions} vertical={false} />
      <SoundDesign scenes={props.scenes} captions={props.captions} vertical={false} />
    </AbsoluteFill>
  );
};
