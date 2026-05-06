export type SceneType =
  | 'title' | 'stat' | 'list' | 'comparison' | 'flow'
  | 'highlight' | 'code' | 'outro'
  | 'image' | 'screenshot' | 'lottie' | 'chat' | 'video' | 'brand';

export type VisualContent =
  | { kind: 'icon';       emoji: string; label?: string }
  | { kind: 'counter';    from: number; to: number; suffix?: string; prefix?: string; label: string }
  | { kind: 'list';       items: { icon: string; text: string }[] }
  | { kind: 'comparison'; left: { label: string; icon: string; color?: string };
                          right: { label: string; icon: string; color?: string };
                          verdict?: 'left' | 'right' | 'both' }
  | { kind: 'flow';       steps: { icon: string; label: string; color?: string }[] }
  | { kind: 'big-text';   text: string; color?: string }
  | { kind: 'code';       lines: string[]; lang?: string }
  | { kind: 'photo';      src?: string; srcs?: string[]; attribution?: string; wikipedia?: string; query?: string }
  | { kind: 'browser';    src: string; url: string; label?: string }
  | { kind: 'lottie';     src: string; loop?: boolean; speed?: number; concept?: string }
  | { kind: 'chat';       messages: { role: 'user' | 'ai'; text: string }[] }
  | { kind: 'clip';       src: string; query?: string }
  | { kind: 'brand-chat'; brand: 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'meta' | 'perplexity'; prompt: string; response: string; iconSrc?: string }

export type MotionScriptScene = {
  start: number;
  end: number;
  type: SceneType;
  bg?: string;
  headline?: string;
  subtext?: string;
  visual: VisualContent;
  bgLottie?: string; // lottie concept overlay (see LOTTIE_CONCEPTS in parse-script)
}

export type MotionScriptProps = {
  title: string;
  format: 'vertical' | 'horizontal';
  scenes: MotionScriptScene[];
}
