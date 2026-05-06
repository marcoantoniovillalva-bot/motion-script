/** Returns true if hex color has enough luminance to be considered "light" */
export function isLightColor(hex: string): boolean {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 145;
}

/** Returns a contrasting text color given a background hex */
export function getTextColor(bg?: string): '#090909' | '#FFFFFF' {
  return bg && isLightColor(bg) ? '#090909' : '#FFFFFF';
}

/** Returns a contrasting subtext color (slightly muted) */
export function getSubtextColor(bg?: string): string {
  return bg && isLightColor(bg) ? 'rgba(9,9,9,0.65)' : 'rgba(255,255,255,0.65)';
}

/** Returns text-shadow appropriate for background */
export function getTextShadow(bg?: string): string {
  return bg && isLightColor(bg)
    ? '0 1px 4px rgba(0,0,0,0.15)'
    : '0 2px 16px rgba(0,0,0,0.75)';
}
