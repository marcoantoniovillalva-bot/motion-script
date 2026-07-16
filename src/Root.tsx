import React from 'react';
import { Composition } from 'remotion';
import { HorizontalVideo } from './HorizontalVideo';
import { VerticalReel } from './VerticalReel';
import { defaultVideoProps } from './default-props';
import { MotionScriptVideo, defaultMotionProps } from './MotionScriptVideo';
import { LOGO_INTRO_FRAMES } from './motion-components/LogoIntroScene';
import type { MotionScriptProps } from './motion-script-types';
import { TalkingHeadEdit } from './TalkingHeadEdit';
import type { TalkingHeadEditProps } from './talking-head-types';

const defaultTalkingHeadProps: TalkingHeadEditProps = {
  footageSrc: 'raw-edits/esempio/composited.mp4',
  durationSeconds: 120,
  captions: [],
  zoomPlan: { duration: 120, beats: [] },
  faceTrack: { duration: 120, sampleFps: 6, samples: [] },
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VerticalReel"
        component={VerticalReel}
        durationInFrames={2700}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultVideoProps}
      />
      <Composition
        id="HorizontalVideo"
        component={HorizontalVideo}
        durationInFrames={18000}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ ...defaultVideoProps, format: 'horizontal' }}
      />
      <Composition
        id="MotionScript"
        component={MotionScriptVideo}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultMotionProps}
        calculateMetadata={({ props }: { props: MotionScriptProps }) => {
          const lastScene = props.scenes[props.scenes.length - 1];
          const durationInFrames = Math.ceil(lastScene.end * 30) + LOGO_INTRO_FRAMES;
          return {
            durationInFrames,
            width: props.format === 'vertical' ? 1080 : 1920,
            height: props.format === 'vertical' ? 1920 : 1080,
          };
        }}
      />
      <Composition
        id="TalkingHeadEdit"
        component={TalkingHeadEdit}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultTalkingHeadProps}
        calculateMetadata={({ props }: { props: TalkingHeadEditProps }) => ({
          durationInFrames: Math.max(1, Math.round(props.durationSeconds * 30)),
        })}
      />
    </>
  );
};
