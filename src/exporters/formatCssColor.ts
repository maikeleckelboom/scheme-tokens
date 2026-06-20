import type { ColorValue } from "../core/color";
import { normalizeNumber } from "../core/json";

export function formatCssColor(color: ColorValue): string {
  if (color.colorSpace === "srgb") {
    if (
      color.alpha === 1 &&
      isByteAligned(color.r) &&
      isByteAligned(color.g) &&
      isByteAligned(color.b)
    ) {
      return `#${toHexByte(color.r)}${toHexByte(color.g)}${toHexByte(color.b)}`;
    }
    return formatColorFunction("srgb", [color.r, color.g, color.b], color.alpha);
  }

  if (color.colorSpace === "display-p3") {
    return formatColorFunction("display-p3", [color.r, color.g, color.b], color.alpha);
  }

  return `oklch(${formatNumber(color.l)} ${formatNumber(color.c)} ${formatNumber(color.h)}${formatAlpha(color.alpha)})`;
}

function formatColorFunction(
  space: "srgb" | "display-p3",
  channels: readonly number[],
  alpha: number,
): string {
  return `color(${space} ${channels.map(formatNumber).join(" ")}${formatAlpha(alpha)})`;
}

function formatAlpha(alpha: number): string {
  return alpha === 1 ? "" : ` / ${formatNumber(alpha)}`;
}

function isByteAligned(value: number): boolean {
  const byte = Math.round(value * 255);
  return byte >= 0 && byte <= 255 && byte / 255 === value;
}

function toHexByte(value: number): string {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, "0");
}

function formatNumber(value: number): string {
  return normalizeNumber(value).toString();
}
