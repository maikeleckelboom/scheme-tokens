import type { ColorComponent, ColorSpace, ColorValue } from "../core/color";
import { normalizeNumber } from "../core/json";

const colorFunctionSpaces = new Set<ColorSpace>([
  "srgb",
  "srgb-linear",
  "display-p3",
  "a98-rgb",
  "prophoto-rgb",
  "rec2020",
  "xyz-d65",
  "xyz-d50",
]);

export function formatCssColor(color: ColorValue): string {
  if (color.colorSpace === "srgb" && canFormatHex(color)) {
    return `#${toHexByte(color.components[0] as number)}${toHexByte(
      color.components[1] as number,
    )}${toHexByte(color.components[2] as number)}`;
  }

  if (colorFunctionSpaces.has(color.colorSpace)) {
    return formatColorFunction(color.colorSpace, color.components, color.alpha);
  }

  if (color.colorSpace === "hsl" || color.colorSpace === "hwb") {
    return `${color.colorSpace}(${formatComponents(color.components)}${formatAlpha(color.alpha)})`;
  }

  return `${color.colorSpace}(${formatComponents(color.components)}${formatAlpha(color.alpha)})`;
}

function formatColorFunction(
  space: ColorSpace,
  components: readonly [ColorComponent, ColorComponent, ColorComponent],
  alpha: number,
): string {
  return `color(${space} ${formatComponents(components)}${formatAlpha(alpha)})`;
}

function formatComponents(
  components: readonly [ColorComponent, ColorComponent, ColorComponent],
): string {
  return components.map(formatComponent).join(" ");
}

function formatAlpha(alpha: number): string {
  return alpha === 1 ? "" : ` / ${formatNumber(alpha)}`;
}

function canFormatHex(color: ColorValue): boolean {
  return (
    color.alpha === 1 &&
    typeof color.components[0] === "number" &&
    typeof color.components[1] === "number" &&
    typeof color.components[2] === "number" &&
    isByteAligned(color.components[0]) &&
    isByteAligned(color.components[1]) &&
    isByteAligned(color.components[2])
  );
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

function formatComponent(value: ColorComponent): string {
  return value === "none" ? "none" : formatNumber(value);
}

function formatNumber(value: number): string {
  return normalizeNumber(value).toString();
}
