import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { ReelCaptions } from './ReelCaptions';
import { captionAnchorY, smoothedFaceAt, zoomScaleAt } from './talking-head-motion';
import { BrollAudio, BrollLayer, pipProgressAt, splitProgressAt } from './BrollLayer';
import { FONT_FACE_CSS } from './talking-head-fonts';
import type { TalkingHeadEditProps } from './talking-head-types';

export const TalkingHeadEdit: React.FC<TalkingHeadEditProps> = ({
  footageSrc,
  captions,
  zoomPlan,
  faceTrack,
  brollPlan,
  transparentBase,
}) => {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const second = frame / fps;

  // Smoothed (not raw) face: keeps both the zoom origin and the chin-anchored captions
  // calm against per-sample tracker jitter.
  const face = smoothedFaceAt(faceTrack, second);
  const scale = zoomScaleAt(zoomPlan?.beats, second);

  // SPLIT b-roll: the footage slides down and shrinks into the bottom half while the
  // mock window (drawn by BrollLayer) occupies the top. split=0 → normal layout.
  const split = splitProgressAt(brollPlan, frame, fps);
  // PIP b-roll: the footage shrinks into a small rounded card bottom-right, raised
  // above the dark canvas that BrollLayer draws behind it.
  const pip = pipProgressAt(brollPlan, frame, fps);

  const chinCaptionY = captionAnchorY(face, scale);
  // During split/pip the chin moves with the footage transform, so the anchor formula no
  // longer matches the screen: pin captions to the seam (split, reference template) or
  // just above the mini-card (pip), blending smoothly with each ramp.
  const captionY = chinCaptionY * (1 - split - pip) + 0.475 * split + 0.56 * pip;

  return (
    <AbsoluteFill style={{ background: transparentBase ? 'transparent' : '#000000', overflow: 'hidden' }}>
      <style>{FONT_FACE_CSS}</style>
      {transparentBase ? null : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: pip > 0 ? 10 : undefined,
            scale: String(1 - split * 0.32 - pip * 0.62),
            translate: `${pip * 0.30 * width}px ${split * 0.26 * height + pip * 0.30 * height}px`,
            borderRadius: pip * 44,
            overflow: 'hidden',
            boxShadow: pip > 0 ? `0 ${18 * pip}px ${54 * pip}px rgba(0,0,0,0.55)` : undefined,
          }}
        >
          <OffthreadVideo
            src={staticFile(footageSrc)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${scale})`,
              transformOrigin: `${face.cx * 100}% ${face.cy * 100}%`,
            }}
          />
        </div>
      )}
      <BrollLayer plan={brollPlan} captionY={captionY} />
      <BrollAudio plan={brollPlan} />
      {transparentBase ? null : (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30 }}>
          <ReelCaptions captions={captions} vertical chinY={captionY} simpleStyle />
        </div>
      )}
    </AbsoluteFill>
  );
};

export type { TalkingHeadEditProps } from './talking-head-types';
