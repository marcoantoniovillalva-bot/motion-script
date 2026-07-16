// Types for the b-roll layer (see .claude/skills/broll-director/SKILL.md).
// A plan is produced by scripts/broll-plan.mjs (LLM) and rendered by BrollLayer.tsx
// inside the TalkingHeadEdit composition, between the footage and the captions.

export type BrollAsset =
  | { kind: 'stat'; value: string; label: string }
  | { kind: 'list'; title?: string; items: string[] }
  | { kind: 'text'; text: string; emphasis?: string }
  // src is relative to public/ (e.g. "broll/esempio/img-01.png"). The LLM plan also
  // carries how to obtain the file before rendering (scripts/broll-assets.mjs):
  //  - 'fluent': Microsoft Fluent 3D emoji (transparent PNG, free) — `emoji` is the
  //    asset name, e.g. "Rocket"; preferred for generic 3D icons in cards
  //  - 'svgl': official tech brand logo SVG (transparent, free) — `brand` is the query
  //  - 'vecteezy': vector search fallback for icons Fluent can't cover (stockQuery)
  //  - 'stock': Pexels photos/videos (stockQuery)
  //  - 'ai': Replicate generation (prompt), only when nothing above can show it
  | {
      kind: 'image';
      src: string;
      source?: 'stock' | 'vecteezy' | 'fluent' | 'svgl' | 'ai';
      stockQuery?: string;
      emoji?: string;
      brand?: string;
      prompt?: string;
    }
  | { kind: 'video'; src: string; source?: 'stock'; stockQuery?: string }
  // Two or three brand logos side by side in a card (e.g. "Make o N8N") — each src is
  // fetched via svgl into public/, brands[] carries the search terms for the fetcher.
  | { kind: 'logos'; srcs: string[]; brands?: string[] }
  // Animated simulated desktop app UI (rendered live by BrollLayer, no file needed):
  // 'tasks' = automation checklist completing itself; 'chat' = AI-agent conversation
  // typing in; 'product' = brand hook (logo + feature name typing + NEW badge);
  // 'doc' = free-resource preview (document page with GRATIS badge, chapters auto-scroll);
  // 'compare' = two dark cards side by side, orange border on the winner — items is
  // exactly two entries "Titolo|valore|etichetta", subtitle is 'left'|'right' (winner),
  // title becomes the pill label below the cards.
  // 'phone' = iPhone mock with notifications sliding in (items = notification texts);
  // 'iconrow' = 3-4 icons popping in sequence with micro-labels (items = "src|label") —
  //   the visual-first replacement for text lists, works in card too;
  // 'orbit' = tool logos orbiting the central logo (logoSrc = center, items = orbiting srcs).
  // 'agentconsole' = faithful recreation of a real product console/terminal session
  //   (e.g. Claude Managed Agents): items are lines with prefix markers — "$ " command
  //   (typewritten), "[...]" tool call (orange), "✓" success, plain = output.
  | { kind: 'mockui'; variant: 'tasks' | 'chat' | 'product' | 'doc' | 'compare' | 'phone' | 'iconrow' | 'orbit' | 'agentconsole'; title?: string; subtitle?: string; items?: string[]; logoSrc?: string };

export type BrollSegment = {
  start: number;
  end: number;
  // card: glass card below captions; split: macOS window top / speaker bottom;
  // takeover: fullscreen asset; pip: content on dark canvas, speaker in a small rounded
  // card (content-first); bubbles: comment pills popping over the footage (CTA moments).
  template: 'card' | 'split' | 'takeover' | 'pip' | 'bubbles';
  asset: BrollAsset;
  /** Split only: subtle 3D perspective tilt on the window (premium product-shot look).
   *  Use sparingly — 1-2 per video, never on text-dense content. */
  tilt?: boolean;
  reason?: string;
};

export type BrollPlan = {
  segments: BrollSegment[];
};
