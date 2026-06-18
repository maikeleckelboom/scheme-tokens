import type { ColorValue } from "../core/colorValue";

export function formatCssColor(value: ColorValue): string {
  if (value.colorSpace === "srgb") {
    const r = toByte(value.r);
    const g = toByte(value.g);
    const b = toByte(value.b);

    if (value.alpha === 1) return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
    return `rgb(${r} ${g} ${b} / ${formatNumber(value.alpha)})`;
  }

  if (value.colorSpace === "display-p3") {
    return `color(display-p3 ${formatNumber(value.r)} ${formatNumber(value.g)} ${formatNumber(value.b)} / ${formatNumber(value.alpha)})`;
  }

  return `oklch(${formatNumber(value.l)} ${formatNumber(value.c)} ${formatNumber(value.h)} / ${formatNumber(value.alpha)})`;
}

function toByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value * 255)));
}

function toHexByte(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function formatNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}
