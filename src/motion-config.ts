export const motionConfig = {
  brand: {
    name: 'Marketizzati',
    tagline: 'Marketing + IA = Risultati',
    logoSrc: 'brand/logo.png',
    // auto-set by setup-brand.mjs based on logo aspect ratio:
    // 'flip-3d'  → square/icon logos (ratio 0.7–1.6)
    // 'zoom-fade'→ wide logos or unknown (ratio 1.6–2.8)
    // 'slide-up' → wordmarks / very wide (ratio > 2.8)
    logoAnimation: 'flip-3d' as 'flip-3d' | 'zoom-fade' | 'slide-up',
  },
  palette: {
    primary: '#FC3718',
    dark:    '#090909',
    pink:    '#FEE9E5',
    cream:   '#FBFAF8',
    coral:   '#F46951',
  },
  fonts: {
    headline: 'Impact, Arial Black, sans-serif',
    body:     'Arial, Helvetica, sans-serif',
    code:     '"Courier New", "Lucida Console", monospace',
  },
  sounds: {
    enabled: true,
    volume:  0.12,
    perSceneType: {
      title:      'bass-hit-soft.wav',
      stat:       'ui-blip.wav',
      list:       'pop-soft.wav',
      comparison: 'whoosh-soft.wav',
      flow:       'ui-blip.wav',
      highlight:  'bass-hit-soft.wav',
      code:       'typing.wav',
      outro:      'bass-hit-soft.wav',
    } as Record<string, string>,
  },
  ai: {
    model:   'anthropic/claude-sonnet-4-5',
    baseURL: 'https://openrouter.ai/api/v1',
  },
  timing: {
    fps:              30,
    wordsPerSecond:   2.2,
    minSceneDuration: 2.5,
    maxSceneDuration: 8,
  },
} as const;

export type MotionConfig = typeof motionConfig;
