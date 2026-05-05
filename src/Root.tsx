import React from 'react';
import { Composition } from 'remotion';
import { HorizontalVideo } from './HorizontalVideo';
import { VerticalReel } from './VerticalReel';
import { defaultVideoProps } from './default-props';
import { MotionScriptVideo, defaultMotionProps } from './MotionScriptVideo';
import { LOGO_INTRO_FRAMES } from './motion-components/LogoIntroScene';
import type { MotionScriptProps } from './motion-script-types';

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
    </>
  );
};
