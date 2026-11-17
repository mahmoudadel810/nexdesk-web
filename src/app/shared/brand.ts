const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** Relative luminance as WCAG defines it, from 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const match = HEX.exec(hex);
  if (!match) {
    return 0;
  }

  const [r, g, b] = match.slice(1).map((part) => {
    const channel = parseInt(part, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** The text colour, white or near-black, that reads best on a background of <paramref name="hex"/>. */
export function onColor(hex: string): string {
  return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#1b1b1f') ? '#ffffff' : '#1b1b1f';
}

/**
 * CSS custom properties that repaint Material's primary colour with a workspace's brand colour. In dark
 * mode the colour is lightened so text and outlines drawn with it stay readable on dark surfaces.
 */
export function brandTokens(hex: string | null | undefined): Record<string, string> {
  if (!hex || !HEX.test(hex)) {
    return {};
  }

  const dark = `color-mix(in srgb, ${hex} 60%, white)`;
  return {
    '--mat-sys-primary': `light-dark(${hex}, ${dark})`,
    '--mat-sys-on-primary': `light-dark(${onColor(hex)}, #1b1b1f)`,
    '--mat-sys-primary-container': `light-dark(color-mix(in srgb, ${hex} 16%, white), color-mix(in srgb, ${hex} 40%, #1b1b1f))`,
    '--mat-sys-on-primary-container': `light-dark(color-mix(in srgb, ${hex} 70%, black), color-mix(in srgb, ${hex} 25%, white))`,
  };
}
