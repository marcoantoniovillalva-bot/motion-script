import { FREEHAND_DATA_URI, LOBSTER_DATA_URI, LOBSTERTWO_DATA_URI, LOBSTERTWOITALIC_DATA_URI, MONTRA_DATA_URI, PACIFICO_DATA_URI } from './talking-head-fonts-data';

// Reference video uses two real CapCut fonts: "Montra" (white body captions, licensed
// free-for-personal-use from Surplus Type Co — confirmed correct) and CapCut's "a mano
// libera" for the orange keyword lines. Freehand and Pacifico were rejected (too thin /
// too soft), upright Lobster Two Bold read as a heavy serif under the thick white stroke,
// and Lobster Two Bold Italic still had too much thick/thin stroke contrast and pointed
// terminals; classic "Lobster" is the current pick — fat, near-monoline rounded letters
// with a built-in slight slant, closest to the reference's "regalato" (it ships a single
// weight/style, so keyword chunks keep fontStyle normal).
// Keep the older fonts exported in case we need to fall back/compare again.
// Embedded as base64 data URIs (see scripts/generate-font-data.mjs) and declared as plain
// CSS @font-face — the JS FontFace()/delayRender() API repeatedly stalled for many seconds
// under Remotion's headless render tabs (even with no network involved), so this sidesteps
// that machinery entirely and lets the browser's normal style engine load the font synchronously.
export const MONTRA_FONT = 'Montra, Arial, Helvetica, sans-serif';
export const FREEHAND_FONT = 'Freehand, cursive';
export const PACIFICO_FONT = 'Pacifico, cursive';
export const LOBSTER_TWO_FONT = 'Lobster Two, cursive';
export const HIGHLIGHT_FONT = 'Lobster, cursive';

export const FONT_FACE_CSS = `
@font-face {
  font-family: 'Montra';
  src: url(${MONTRA_DATA_URI}) format('opentype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Freehand';
  src: url(${FREEHAND_DATA_URI}) format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Pacifico';
  src: url(${PACIFICO_DATA_URI}) format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Lobster Two';
  src: url(${LOBSTERTWO_DATA_URI}) format('truetype');
  font-weight: 700;
  font-style: normal;
}
@font-face {
  font-family: 'Lobster Two';
  src: url(${LOBSTERTWOITALIC_DATA_URI}) format('truetype');
  font-weight: 700;
  font-style: italic;
}
@font-face {
  font-family: 'Lobster';
  src: url(${LOBSTER_DATA_URI}) format('truetype');
  font-weight: 400;
  font-style: normal;
}
`;
