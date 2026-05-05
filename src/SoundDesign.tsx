import React from 'react';
import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import type { CaptionChunk, Scene } from './types';

type Props = {
  scenes?: Scene[];
  captions?: CaptionChunk[];
  vertical?: boolean;
};

type SoundEvent = {
  key: string;
  frame: number;
  file: string;
  volume: number;
};

function roleIncludes(scene: Scene, words: string[]) {
  const role = String(scene.role || '').toLowerCase();
  return words.some((word) => role.includes(word));
}

function uniqueEvents(events: SoundEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const bucket = `${event.file}-${Math.round(event.frame / 8)}`;
    if (seen.has(bucket)) return false;
    seen.add(bucket);
    return true;
  });
}

export const SoundDesign: React.FC<Props> = ({ scenes = [], captions = [], vertical = true }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const events: SoundEvent[] = [
    {
      key: 'hook-hit',
      frame: 0,
      file: 'sounds/bass-hit-soft.wav',
      volume: vertical ? 0.24 : 0.14,
    },
    {
      key: 'hook-whoosh',
      frame: Math.round(0.18 * fps),
      file: 'sounds/whoosh-soft.wav',
      volume: vertical ? 0.12 : 0.08,
    },
    {
      key: 'hook-pop',
      frame: Math.round(1.45 * fps),
      file: 'sounds/pop-soft.wav',
      volume: vertical ? 0.11 : 0.065,
    },
  ];

  for (const [index, scene] of scenes.entries()) {
    const frame = Math.max(0, Math.round(scene.start * fps));
    if (frame >= durationInFrames) continue;

    if (index > 0) {
      events.push({
        key: `whoosh-${index}`,
        frame,
        file: 'sounds/whoosh-soft.wav',
        volume: vertical ? 0.12 : 0.08,
      });
    }

    if (roleIncludes(scene, ['hook', 'cta', 'intro'])) {
      events.push({
        key: `hit-${index}`,
        frame: Math.max(0, frame - 2),
        file: 'sounds/bass-hit-soft.wav',
        volume: vertical ? 0.16 : 0.1,
      });
    }

    if (roleIncludes(scene, ['solution', 'example', 'section'])) {
      events.push({
        key: `blip-${index}`,
        frame: frame + Math.round(0.12 * fps),
        file: 'sounds/ui-blip.wav',
        volume: vertical ? 0.1 : 0.07,
      });
    }
  }

  for (const [index, caption] of captions.entries()) {
    if (caption.importance !== 'high' || !caption.highlight) continue;
    const frame = Math.max(0, Math.round(caption.start * fps));
    if (frame >= durationInFrames) continue;
    events.push({
      key: `pop-${index}`,
      frame,
      file: 'sounds/pop-soft.wav',
      volume: vertical ? 0.09 : 0.055,
    });
  }

  return (
    <>
      {uniqueEvents(events).map((event) => (
        <Sequence key={event.key} from={event.frame}>
          <Audio src={staticFile(event.file)} volume={event.volume} />
        </Sequence>
      ))}
    </>
  );
};
