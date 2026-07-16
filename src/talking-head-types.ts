import type { CaptionChunk } from './types';
import type { BrollPlan } from './broll-types';

export type FaceSample = {
  t: number;
  cx: number;
  cy: number;
  faceW: number;
  faceH: number;
  chinY: number;
};

export type FaceTrack = {
  duration: number;
  sampleFps: number;
  samples: FaceSample[];
};

export type ZoomBeat = {
  start: number;
  end: number;
  style: 'static' | 'fast-in-out' | 'slow-push';
  targetScale: number;
  reason?: string;
};

export type ZoomPlan = {
  duration: number;
  beats: ZoomBeat[];
};

export type TalkingHeadEditProps = {
  footageSrc: string;
  durationSeconds: number;
  captions: CaptionChunk[];
  zoomPlan: ZoomPlan;
  faceTrack: FaceTrack;
  /** Optional b-roll plan (broll-plan.json) rendered between footage and captions. */
  brollPlan?: BrollPlan;
  /** True for the b-roll-only alpha render: hides footage and captions, transparent bg. */
  transparentBase?: boolean;
};
