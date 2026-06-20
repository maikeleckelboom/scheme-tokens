import type { ColorSpace, ColorValue } from "../core/color";
import { cloneColor } from "../core/color";
import type { Issue, Result } from "../core/result";
import { convertWithTexel } from "./texel-adapter";

export type ColorGamut = "srgb" | "display-p3";
export type GamutMappingMethod = "preserve-lightness";

export interface MapColorToGamutOptions {
  readonly method: GamutMappingMethod;
  readonly outputSpace?: ColorSpace;
}

export type ColorConversionIssue = Issue<
  "unsupported-color-space" | "color-conversion-failed" | "non-finite-color-result"
> & {
  readonly colorSpace?: string;
  readonly targetSpace?: string;
};

export type GamutMappingIssue = Issue<
  | "unsupported-gamut"
  | "unsupported-gamut-mapping-method"
  | "invalid-output-space"
  | "gamut-mapping-failed"
  | "non-finite-color-result"
> & {
  readonly gamut?: string;
  readonly method?: string;
  readonly outputSpace?: string;
};

export function convertColor(
  color: ColorValue,
  targetSpace: ColorSpace,
): Result<ColorValue, ColorConversionIssue> {
  if (!isSupportedSpace(color.colorSpace)) {
    return {
      ok: false,
      issues: [
        {
          code: "unsupported-color-space",
          message: "Unsupported source color space.",
          colorSpace: String(color.colorSpace),
        },
      ],
    };
  }
  if (!isSupportedSpace(targetSpace)) {
    return {
      ok: false,
      issues: [
        {
          code: "unsupported-color-space",
          message: "Unsupported target color space.",
          targetSpace: String(targetSpace),
        },
      ],
    };
  }
  if (color.colorSpace === targetSpace) return { ok: true, value: cloneColor(color) };

  try {
    const value = convertWithTexel(color, targetSpace);
    return hasFiniteColor(value)
      ? { ok: true, value }
      : {
          ok: false,
          issues: [
            {
              code: "non-finite-color-result",
              message: "Conversion produced a non-finite color.",
              targetSpace,
            },
          ],
        };
  } catch {
    return {
      ok: false,
      issues: [
        {
          code: "color-conversion-failed",
          message: "Color conversion failed.",
          colorSpace: color.colorSpace,
          targetSpace,
        },
      ],
    };
  }
}

export function isColorInGamut(color: ColorValue, gamut: ColorGamut): boolean {
  if (gamut !== "srgb" && gamut !== "display-p3") return false;
  const converted = convertColor(color, gamut);
  if (!converted.ok || converted.value.colorSpace === "oklch") return false;
  return (
    inUnitGamut(converted.value.r) &&
    inUnitGamut(converted.value.g) &&
    inUnitGamut(converted.value.b)
  );
}

export function mapColorToGamut(
  color: ColorValue,
  gamut: ColorGamut,
  options: MapColorToGamutOptions,
): Result<ColorValue, GamutMappingIssue> {
  if (gamut !== "srgb" && gamut !== "display-p3") {
    return {
      ok: false,
      issues: [{ code: "unsupported-gamut", message: "Unsupported gamut.", gamut: String(gamut) }],
    };
  }
  if (options.method !== "preserve-lightness") {
    return {
      ok: false,
      issues: [
        {
          code: "unsupported-gamut-mapping-method",
          message: "Unsupported gamut mapping method.",
          method: String(options.method),
        },
      ],
    };
  }
  const outputSpace = options.outputSpace ?? gamut;
  if (!isSupportedSpace(outputSpace)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-output-space",
          message: "Unsupported output color space.",
          outputSpace: String(outputSpace),
        },
      ],
    };
  }

  const converted = convertColor(color, gamut);
  if (!converted.ok || converted.value.colorSpace === "oklch") {
    return {
      ok: false,
      issues: [
        { code: "gamut-mapping-failed", message: "Unable to convert to target gamut.", gamut },
      ],
    };
  }

  const mappedInTarget: ColorValue = {
    colorSpace: gamut,
    r: clamp01(converted.value.r),
    g: clamp01(converted.value.g),
    b: clamp01(converted.value.b),
    alpha: converted.value.alpha,
  };
  const output =
    outputSpace === gamut
      ? { ok: true as const, value: mappedInTarget }
      : convertColor(mappedInTarget, outputSpace);
  if (!output.ok) {
    return {
      ok: false,
      issues: [
        {
          code: "gamut-mapping-failed",
          message: "Unable to convert mapped color to output space.",
          gamut,
          outputSpace,
        },
      ],
    };
  }
  if (!hasFiniteColor(output.value)) {
    return {
      ok: false,
      issues: [
        {
          code: "non-finite-color-result",
          message: "Gamut mapping produced a non-finite color.",
          gamut,
          outputSpace,
        },
      ],
    };
  }
  return { ok: true, value: output.value };
}

function isSupportedSpace(input: unknown): input is ColorSpace {
  return input === "srgb" || input === "display-p3" || input === "oklch";
}

function hasFiniteColor(color: ColorValue): boolean {
  return color.colorSpace === "oklch"
    ? Number.isFinite(color.l) &&
        Number.isFinite(color.c) &&
        Number.isFinite(color.h) &&
        Number.isFinite(color.alpha)
    : Number.isFinite(color.r) &&
        Number.isFinite(color.g) &&
        Number.isFinite(color.b) &&
        Number.isFinite(color.alpha);
}

function inUnitGamut(value: number): boolean {
  return value >= -1e-12 && value <= 1 + 1e-12;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
