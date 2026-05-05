import React from 'react';
import { Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionConfig } from '../motion-config';

const URL_MAP: Record<string, string> = {
  '🚀': staticFile('emoji/rocket_3d.png'),
  '🤖': staticFile('emoji/robot_3d.png'),
  '💻': staticFile('emoji/laptop_3d.png'),
  '⚙️': staticFile('emoji/gear_3d.png'),
  '🔧': staticFile('emoji/wrench_3d.png'),
  '🛠️': staticFile('emoji/hammer_and_wrench_3d.png'),
  '🐙': staticFile('emoji/octopus_3d.png'),
  '🔗': staticFile('emoji/link_3d.png'),
  '📱': staticFile('emoji/mobile_phone_3d.png'),
  '🌐': staticFile('emoji/globe_with_meridians_3d.png'),
  '🔄': staticFile('emoji/counterclockwise_arrows_button_3d.png'),
  '📦': staticFile('emoji/package_3d.png'),
  '📊': staticFile('emoji/bar_chart_3d.png'),
  '📈': staticFile('emoji/chart_increasing_3d.png'),
  '💰': staticFile('emoji/money_bag_3d.png'),
  '💎': staticFile('emoji/gem_stone_3d.png'),
  '🎯': staticFile('emoji/bullseye_3d.png'),
  '📣': staticFile('emoji/megaphone_3d.png'),
  '🎨': staticFile('emoji/artist_palette_3d.png'),
  '🔑': staticFile('emoji/key_3d.png'),
  '⭐': staticFile('emoji/star_3d.png'),
  '🏆': staticFile('emoji/trophy_3d.png'),
  '👥': staticFile('emoji/busts_in_silhouette_3d.png'),
  '💬': staticFile('emoji/speech_balloon_3d.png'),
  '💡': staticFile('emoji/light_bulb_3d.png'),
  '📝': staticFile('emoji/memo_3d.png'),
  '📋': staticFile('emoji/clipboard_3d.png'),
  '🎓': staticFile('emoji/graduation_cap_3d.png'),
  '🧩': staticFile('emoji/puzzle_piece_3d.png'),
  '📚': staticFile('emoji/books_3d.png'),
  '⚡': staticFile('emoji/high_voltage_3d.png'),
  '⏱️': staticFile('emoji/stopwatch_3d.png'),
  '🔥': staticFile('emoji/fire_3d.png'),
  '✨': staticFile('emoji/sparkles_3d.png'),
  '🎬': staticFile('emoji/clapper_board_3d.png'),
  '🎉': staticFile('emoji/party_popper_3d.png'),
  '✅': staticFile('emoji/check_mark_button_3d.png'),
  '❌': staticFile('emoji/cross_mark_3d.png'),
  '⚠️': staticFile('emoji/warning_3d.png'),
  '💪': staticFile('emoji/flexed_biceps_3d.png'),
  '👋': staticFile('emoji/waving_hand_3d.png'),
  '😓': staticFile('emoji/downcast_face_with_sweat_3d.png'),
  '😊': staticFile('emoji/smiling_face_with_smiling_eyes_3d.png'),
  '🧠': staticFile('emoji/brain_3d.png'),
  '🔍': staticFile('emoji/magnifying_glass_tilted_right_3d.png'),
  '⚖️': staticFile('emoji/balance_scale_3d.png'),
  '🧮': staticFile('emoji/abacus_3d.png'),
  '🖼️': staticFile('emoji/framed_picture_3d.png'),
  '🎵': staticFile('emoji/musical_note_3d.png'),
  '👤': staticFile('emoji/bust_in_silhouette_3d.png'),
  '❓': staticFile('emoji/red_question_mark_3d.png'),
  '🌍': staticFile('emoji/globe_showing_europe-africa_3d.png'),
  '🔒': staticFile('emoji/locked_3d.png'),
  '💼': staticFile('emoji/briefcase_3d.png'),
  '🎙️': staticFile('emoji/studio_microphone_3d.png'),
  '🚗': staticFile('emoji/automobile_3d.png'),
  '🔬': staticFile('emoji/microscope_3d.png'),
  '🎤': staticFile('emoji/microphone_3d.png'),
  '📡': staticFile('emoji/satellite_antenna_3d.png'),
  '🏗️': staticFile('emoji/building_construction_3d.png'),
  '👨‍💻': staticFile('emoji/man_technologist_3d.png'),
};

// --- Animation definitions ---
type AnimType =
  | 'launch'      // 🚀 rises upward with wobble
  | 'robot'       // 🤖 works side-to-side, processes
  | 'spin'        // ⚙️ 🔄 🌐 rotates continuously
  | 'float'       // 💡 ✨ ⭐ 💎 gentle 3D bob
  | 'bounce'      // 🎉 💰 💪 energetic vertical bounce
  | 'shake'       // ⚠️ 📣 urgent side-to-side
  | 'pulse'       // ⚡ 🎯 rhythmic scale in/out
  | 'type-motion' // 💻 📝 📋 subtle typing bob
  | 'flicker'     // 🔥 rapid asymmetric scale
  | 'pendulum'    // ⏱️ swings from top
  | 'wave'        // 👋 rotation wave
  | 'grow'        // 📈 slowly rises from below
  | 'none';

type AnimDef = {
  motion: AnimType;
  origin?: string;
  sound?: string;
  soundFrames?: (fps: number, totalFrames: number) => number[];
};

const ANIM: Record<string, AnimDef> = {
  '🚀': {
    motion: 'launch',
    sound: 'whoosh-soft.wav',
    soundFrames: () => [0],
  },
  '🤖': {
    motion: 'robot',
    sound: 'ui-blip.wav',
    soundFrames: (fps, total) =>
      Array.from({ length: Math.ceil(total / Math.round(fps * 1.5)) }, (_, i) => Math.round(i * fps * 1.5)),
  },
  '⚙️': { motion: 'spin', sound: 'ui-blip.wav', soundFrames: () => [0] },
  '🔄': { motion: 'spin' },
  '🌐': { motion: 'spin' },
  '💡': { motion: 'float' },
  '✨': { motion: 'float' },
  '⭐': { motion: 'float' },
  '💎': { motion: 'float' },
  '💬': { motion: 'float' },
  '🧩': { motion: 'float' },
  '🎓': { motion: 'float' },
  '🐙': { motion: 'float' },
  '📚': { motion: 'float' },
  '🧠': { motion: 'float' },
  '⚖️': { motion: 'float' },
  '🖼️': { motion: 'float' },
  '🎵': { motion: 'float' },
  '🎨': { motion: 'float' },
  '⚡':{ motion: 'pulse', sound: 'bass-hit-soft.wav', soundFrames: () => [0] },
  '🎯': { motion: 'pulse' },
  '📡': { motion: 'pulse' },
  '💰': { motion: 'bounce', sound: 'pop-soft.wav', soundFrames: (fps) => [0, Math.round(fps * 0.6)] },
  '🎉': { motion: 'bounce', sound: 'pop-soft.wav', soundFrames: (fps) => [0, Math.round(fps * 0.5), Math.round(fps * 1.0)] },
  '💪': { motion: 'bounce' },
  '🏆': { motion: 'bounce' },
  '🔑': { motion: 'bounce' },
  '🔥': { motion: 'flicker' },
  '⚠️': { motion: 'shake', sound: 'ui-blip.wav', soundFrames: () => [0] },
  '📣': { motion: 'shake' },
  '👋': { motion: 'wave' },
  '😓': { motion: 'wave' },
  '💻': { motion: 'type-motion' },
  '📝': { motion: 'type-motion' },
  '📋': { motion: 'type-motion' },
  '🛠️': { motion: 'type-motion' },
  '🔧': { motion: 'type-motion' },
  '📱': { motion: 'type-motion' },
  '🔬': { motion: 'type-motion' },
  '🧮': { motion: 'type-motion' },
  '👨‍💻': { motion: 'type-motion' },
  '⏱️': {
    motion: 'pendulum',
    origin: 'center top',
    sound: 'tick.wav',
    soundFrames: (fps) => [0, 0.33, 0.66, 1.0, 1.33, 1.66, 2.0].map(t => Math.round(fps * t)),
  },
  '📈': { motion: 'grow' },
  '📊': { motion: 'grow' },
  '🔍': { motion: 'grow' },
};

// --- Transform functions ---
function getTransform(anim: AnimType, frame: number, fps: number): string {
  const t = frame / fps;

  switch (anim) {
    case 'launch': {
      const rise = Math.min(t * 0.9, 1);
      const y = -rise * rise * 28 + Math.sin(t * 5.5) * (1 - rise * 0.6) * 6;
      const x = Math.sin(t * 3.5) * (1 - rise * 0.5) * 8;
      const rot = Math.sin(t * 3.5) * (1 - rise * 0.4) * 6;
      return `translate(${x}px, ${y}px) rotate(${rot}deg)`;
    }
    case 'robot': {
      const sweep = Math.sin(t * 2.8) * 11;
      const nod = Math.sin(t * 1.6) * 5;
      const processBob = 1 + Math.abs(Math.sin(t * 7.5)) * 0.03;
      return `translateX(${sweep}px) rotateZ(${nod}deg) scale(${processBob})`;
    }
    case 'spin':
      return `rotate(${t * 110}deg)`;
    case 'float': {
      const y = Math.sin(t * 1.7) * 11;
      const x = Math.sin(t * 0.85) * 4;
      const tilt = Math.sin(t * 1.1) * 4;
      return `translate(${x}px, ${y}px) rotateZ(${tilt}deg)`;
    }
    case 'bounce': {
      const period = 0.58;
      const phase = (t % period) / period;
      const y = -Math.sin(phase * Math.PI) * 20;
      const squishX = 1 + Math.sin(phase * Math.PI) * 0.07;
      return `translateY(${y}px) scaleX(${squishX}) scaleY(${1 / squishX})`;
    }
    case 'shake':
      return `translateX(${Math.sin(t * 22) * 7 * Math.exp(-t * 0.5)}px)`;
    case 'pulse':
      return `scale(${1 + Math.sin(t * Math.PI * 1.6) * 0.09})`;
    case 'wave':
      return `rotateZ(${Math.sin(t * 3.8) * 22}deg)`;
    case 'type-motion': {
      const bob = Math.abs(Math.sin(t * 5.5)) * 5;
      const tilt = Math.sin(t * 2.8) * 2;
      return `translateY(${-bob}px) rotateZ(${tilt}deg)`;
    }
    case 'flicker': {
      const s = 1 + Math.sin(t * 17) * 0.07 + Math.sin(t * 29) * 0.04;
      return `scale(${s}) rotateZ(${Math.sin(t * 13) * 4}deg)`;
    }
    case 'pendulum':
      return `rotateZ(${Math.sin(t * Math.PI * 1.8) * 22}deg)`;
    case 'grow': {
      const grown = Math.min(1, t * 0.18);
      return `translateY(${-grown * 16}px) scale(${0.82 + grown})`;
    }
    default:
      return 'none';
  }
}

// --- Component ---
type Props = {
  emoji: string;
  size: number;
  style?: React.CSSProperties;
  playSound?: boolean;
  sceneDurationFrames?: number;
};

export const Emoji3D: React.FC<Props> = ({
  emoji,
  size,
  style,
  playSound = false,
  sceneDurationFrames = 270,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cfg = motionConfig;

  const url = URL_MAP[emoji];
  const animDef = ANIM[emoji];
  const motionType = animDef?.motion ?? 'none';
  const motionTransform = motionType !== 'none' ? getTransform(motionType, frame, fps) : 'none';
  const transformOrigin = animDef?.origin ?? 'center center';

  const soundFile = animDef?.sound;
  const soundFramesList: number[] = playSound && soundFile && animDef.soundFrames
    ? animDef.soundFrames(fps, sceneDurationFrames).filter(f => f < sceneDurationFrames - 4)
    : [];

  const imgStyle: React.CSSProperties = {
    width: size,
    height: size,
    objectFit: 'contain',
    display: 'block',
    transform: motionTransform,
    transformOrigin,
    filter: 'drop-shadow(0px 12px 28px rgba(0,0,0,0.38)) drop-shadow(0px 4px 8px rgba(0,0,0,0.22))',
    ...style,
  };

  const fallbackStyle: React.CSSProperties = {
    fontSize: size * 0.82,
    display: 'inline-block',
    lineHeight: 1,
    transform: motionTransform,
    transformOrigin,
    filter: 'drop-shadow(0px 8px 18px rgba(0,0,0,0.35))',
    ...style,
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: size, height: size, overflow: 'visible' }}>
      {url ? (
        <Img src={url} style={imgStyle} />
      ) : (
        <span style={fallbackStyle}>{emoji}</span>
      )}
      {playSound && soundFile && soundFramesList.map((f, i) => (
        <Sequence key={i} from={f} durationInFrames={8}>
          <Audio src={staticFile(`sounds/${soundFile}`)} volume={cfg.sounds.volume * 0.85} />
        </Sequence>
      ))}
    </div>
  );
};
