export type Scene = {
  start: number;
  end: number;
  role: string;
  onScreenText: string;
  voiceoverCue?: string;
  visual?: string;
  assets?: string[];
  editNote?: string;
};

export type CaptionChunk = {
  start: number;
  end: number;
  text: string;
  highlight?: string;
  importance?: 'high' | 'medium' | 'low';
};

export type AssetOverlay = {
  id: string;
  start: number;
  end: number;
  kind: 'video' | 'image' | 'logo' | 'badge';
  src?: string;
  text?: string;
  placement?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center' | 'side-card';
  animation?: 'pop' | 'slide' | 'fade';
  sound?: 'pop' | 'whoosh' | 'ui-blip' | 'bass-hit' | 'none';
  credit?: string;
};

export type VideoProps = {
  title: string;
  day: string;
  date: string;
  format: 'vertical' | 'horizontal';
  footage?: {
    src: string;
    fit?: 'cover' | 'contain';
    opacity?: number;
  };
  source?: {
    channel?: string;
    videoTitle?: string;
    url?: string;
  };
  scenes: Scene[];
  captions?: CaptionChunk[];
  assetOverlays?: AssetOverlay[];
  cta?: string;
  script?: string;
  brand?: {
    name: string;
    tagline: string;
    colors: {
      ink: string;
      blue: string;
      mint: string;
      orange: string;
      paper: string;
    };
  };
};
