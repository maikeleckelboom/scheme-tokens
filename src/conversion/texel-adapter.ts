import { convert, DisplayP3, OKLCH, sRGB } from "@texel/color";
import type { ColorSpace, ColorValue } from "../core/color";
import { normalizeNumber } from "../core/json";

export function convertWithTexel(color: ColorValue, targetSpace: ColorSpace): ColorValue {
  const result = convert(
    [...vectorFromColor(color)],
    texelSpace(color.colorSpace) as never,
    texelSpace(targetSpace) as never,
  ) as readonly number[];
  return colorFromVector(targetSpace, result, color.alpha);
}

function vectorFromColor(color: ColorValue): readonly [number, number, number] {
  if (color.colorSpace === "oklch") return [color.l, color.c, color.h];
  return [color.r, color.g, color.b];
}

function colorFromVector(space: ColorSpace, vector: readonly number[], alpha: number): ColorValue {
  const first = finite(vector[0]);
  const second = finite(vector[1]);
  const third = finite(vector[2]);
  if (space === "oklch") {
    const chroma = Math.max(0, normalizeNumber(second));
    return {
      colorSpace: "oklch",
      l: normalizeNumber(first),
      c: chroma,
      h: chroma === 0 ? 0 : normalizeNumber(((third % 360) + 360) % 360),
      alpha: normalizeNumber(alpha),
    };
  }
  return {
    colorSpace: space,
    r: normalizeNumber(first),
    g: normalizeNumber(second),
    b: normalizeNumber(third),
    alpha: normalizeNumber(alpha),
  };
}

function texelSpace(space: ColorSpace): unknown {
  if (space === "srgb") return sRGB;
  if (space === "display-p3") return DisplayP3;
  return OKLCH;
}

function finite(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    throw new Error("Texel returned a non-finite color component.");
  }
  return value;
}
