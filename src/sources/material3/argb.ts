import type { SrgbColor } from "../../core/color";

export function srgbToArgb(color: SrgbColor): number {
  return ((0xff << 24) | (toByte(color.r) << 16) | (toByte(color.g) << 8) | toByte(color.b)) >>> 0;
}

export function argbToSrgb(argb: number): SrgbColor {
  return {
    colorSpace: "srgb",
    r: ((argb >>> 16) & 0xff) / 255,
    g: ((argb >>> 8) & 0xff) / 255,
    b: (argb & 0xff) / 255,
    alpha: 1,
  };
}

function toByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value * 255)));
}
