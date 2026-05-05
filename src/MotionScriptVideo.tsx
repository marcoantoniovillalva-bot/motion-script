import React, { useEffect, useState } from 'react';
import { AbsoluteFill, Sequence, continueRender, delayRender, staticFile, useVideoConfig } from 'remotion';
import { Lottie } from '@remotion/lottie';
import type { LottieAnimationData } from '@remotion/lottie';
import { LogoIntroScene, LOGO_INTRO_FRAMES } from './motion-components/LogoIntroScene';
import { TitleScene } from './motion-components/TitleScene';
import { StatScene } from './motion-components/StatScene';
import { ListScene } from './motion-components/ListScene';
import { ComparisonScene } from './motion-components/ComparisonScene';
import { FlowScene } from './motion-components/FlowScene';
import { HighlightScene } from './motion-components/HighlightScene';
import { CodeScene } from './motion-components/CodeScene';
import { OutroScene } from './motion-components/OutroScene';
import { ImageScene } from './motion-components/ImageScene';
import { ScreenshotScene } from './motion-components/ScreenshotScene';
import { LottieScene } from './motion-components/LottieScene';
import { ChatScene } from './motion-components/ChatScene';
import type { MotionScriptProps, MotionScriptScene } from './motion-script-types';

// Scene types that already have their own full-screen visual content — skip bgLottie overlay
const SKIP_BG_LOTTIE = new Set(['image', 'screenshot', 'lottie', 'chat']);

const BgLottieOverlay: React.FC<{ concept: string }> = ({ concept }) => {
  const [data, setData] = useState<LottieAnimationData | null>(null);
  const [handle] = useState(() => delayRender(`BgLottie:${concept}`));

  useEffect(() => {
    const src = staticFile(`lottie/${concept}.json`);
    fetch(src)
      .then(r => r.json())
      .then(d => { setData(d); continueRender(handle); })
      .catch(() => continueRender(handle));
  }, [concept, handle]);

  if (!data) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        height: '90%',
        opacity: 0.13,
        mixBlendMode: 'screen',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Lottie
          animationData={data}
          loop
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </AbsoluteFill>
  );
};

const SceneDispatcher: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  switch (scene.type) {
    case 'title':       return <TitleScene scene={scene} />;
    case 'stat':        return <StatScene scene={scene} />;
    case 'list':        return <ListScene scene={scene} />;
    case 'comparison':  return <ComparisonScene scene={scene} />;
    case 'flow':        return <FlowScene scene={scene} />;
    case 'highlight':   return <HighlightScene scene={scene} />;
    case 'code':        return <CodeScene scene={scene} />;
    case 'outro':       return <OutroScene scene={scene} />;
    case 'image':       return <ImageScene scene={scene} />;
    case 'screenshot':  return <ScreenshotScene scene={scene} />;
    case 'lottie':      return <LottieScene scene={scene} />;
    case 'chat':        return <ChatScene scene={scene} />;
    default:            return <HighlightScene scene={scene} />;
  }
};

const SceneWithOverlays: React.FC<{ scene: MotionScriptScene }> = ({ scene }) => {
  const showBgLottie = !!scene.bgLottie && !SKIP_BG_LOTTIE.has(scene.type);
  return (
    <AbsoluteFill>
      <SceneDispatcher scene={scene} />
      {showBgLottie && <BgLottieOverlay concept={scene.bgLottie!} />}
    </AbsoluteFill>
  );
};

export const MotionScriptVideo: React.FC<MotionScriptProps> = (props) => {
  const { fps } = useVideoConfig();
  const { scenes } = props;

  return (
    <AbsoluteFill>
      {/* Logo intro — always first 3s */}
      <Sequence from={0} durationInFrames={LOGO_INTRO_FRAMES}>
        <LogoIntroScene />
      </Sequence>

      {/* Actual scenes — offset by logo intro duration */}
      {scenes.map((scene, i) => {
        const startFrame = Math.round(scene.start * fps) + LOGO_INTRO_FRAMES;
        const durationFrames = Math.max(1, Math.round((scene.end - scene.start) * fps));
        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationFrames}>
            <SceneWithOverlays scene={scene} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const defaultMotionProps: MotionScriptProps = {
  title: 'Demo Motion Graphics',
  format: 'vertical',
  scenes: [
    {
      start: 0, end: 5,
      type: 'title',
      headline: 'Inizia Oggi',
      visual: { kind: 'icon', emoji: '🚀' },
      bgLottie: 'rocket',
    },
    {
      start: 5, end: 13,
      type: 'image',
      headline: 'Claude Code',
      subtext: 'Il terminale AI di Anthropic',
      visual: { kind: 'photo', src: '', query: 'AI artificial intelligence technology', attribution: 'Pexels' },
    },
    {
      start: 13, end: 21,
      type: 'screenshot',
      headline: 'Documentazione ufficiale',
      visual: { kind: 'browser', src: '', url: 'https://github.com/anthropics/claude-code', label: 'GitHub' },
    },
    {
      start: 21, end: 30,
      type: 'stat',
      headline: 'Risparmio tempo',
      visual: { kind: 'counter', from: 0, to: 87, suffix: '%', label: 'Ore risparmiate ogni settimana' },
      bgLottie: 'chart-growth',
    },
    {
      start: 30, end: 38,
      type: 'list',
      headline: 'Vantaggi chiave',
      visual: { kind: 'list', items: [
        { icon: '✅', text: 'Automazione totale' },
        { icon: '⚡', text: 'Risposta istantanea' },
        { icon: '💰', text: 'Costi ridotti' },
      ]},
      bgLottie: 'settings',
    },
    {
      start: 38, end: 46,
      type: 'highlight',
      headline: 'Risultato immediato',
      visual: { kind: 'big-text', text: '10x' },
      bgLottie: 'chart-growth',
    },
    {
      start: 46, end: 52,
      type: 'outro',
      headline: 'Inizia Ora',
      subtext: 'Crea il tuo primo video oggi',
      visual: { kind: 'big-text', text: '→' },
      bgLottie: 'rocket',
    },
  ],
};
