import type { ParseResult, Result } from "./graph";

export interface SrgbColor {
  readonly colorSpace: "srgb";
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}

export interface OklchColor {
  readonly colorSpace: "oklch";
  readonly l: number;
  readonly c: number;
  readonly h: number;
  readonly alpha: number;
}

export interface DisplayP3Color {
  readonly colorSpace: "display-p3";
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}

export type ColorValue = SrgbColor | OklchColor | DisplayP3Color;

export type ColorInput = string | ColorValue;

export interface ColorInputProblem {
  readonly kind: "invalid-color-input";
  readonly code: "invalid-color-input";
  readonly message: string;
  readonly input: unknown;
  readonly path?: string;
}

export interface ColorValueProblem {
  readonly kind: "invalid-color-value";
  readonly message: string;
  readonly path?: string;
}

const HEX_COLOR_PATTERN = /^#?[0-9a-fA-F]{6}$/;

export function parseHexColor(input: string): ParseResult<SrgbColor, ColorValueProblem> {
  if (!HEX_COLOR_PATTERN.test(input)) {
    return {
      ok: false,
      problem: {
        kind: "invalid-color-value",
        message: "Hex colors must use #RRGGBB or RRGGBB syntax.",
      },
    };
  }

  const normalized = input.startsWith("#") ? input.slice(1) : input;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return { ok: true, value: srgb255(r, g, b) };
}

export function hex(input: string): SrgbColor {
  const result = parseHexColor(input);
  if (result.ok) return result.value;
  throw new Error(result.problem.message);
}

export function parseColorInput(
  input: ColorInput,
  path: string = "color",
): Result<ColorValue, ColorInputProblem> {
  if (typeof input === "string") {
    const result = parseHexColor(input);
    if (result.ok) return result;

    return {
      ok: false,
      problems: [
        {
          kind: "invalid-color-input",
          code: "invalid-color-input",
          message: result.problem.message,
          input,
          path,
        },
      ],
    };
  }

  if (isColorValueShape(input)) {
    const problems = validateColorValue(input, path).map((problem) => ({
      kind: "invalid-color-input" as const,
      code: "invalid-color-input" as const,
      message: problem.message,
      input,
      ...(problem.path === undefined ? { path } : { path: problem.path }),
    }));

    return problems.length === 0 ? { ok: true, value: input } : { ok: false, problems };
  }

  return {
    ok: false,
    problems: [
      {
        kind: "invalid-color-input",
        code: "invalid-color-input",
        message: "Color input must be a hex string or supported ColorValue object.",
        input,
        path,
      },
    ],
  };
}

export function srgb255(r: number, g: number, b: number, alpha: number = 1): SrgbColor {
  assertByteChannel(r, "r");
  assertByteChannel(g, "g");
  assertByteChannel(b, "b");
  assertAlpha(alpha);

  return {
    colorSpace: "srgb",
    r: r / 255,
    g: g / 255,
    b: b / 255,
    alpha,
  };
}

export function validateColorValue(value: ColorValue, path?: string): readonly ColorValueProblem[] {
  const problems: ColorValueProblem[] = [];

  if (value.colorSpace === "srgb" || value.colorSpace === "display-p3") {
    validateUnitChannel(value.r, `${path ?? "color"}.r`, problems);
    validateUnitChannel(value.g, `${path ?? "color"}.g`, problems);
    validateUnitChannel(value.b, `${path ?? "color"}.b`, problems);
    validateAlphaChannel(value.alpha, `${path ?? "color"}.alpha`, problems);
    return problems;
  }

  if (value.colorSpace === "oklch") {
    validateUnitChannel(value.l, `${path ?? "color"}.l`, problems);
    validateNonNegative(value.c, `${path ?? "color"}.c`, problems);
    validateFinite(value.h, `${path ?? "color"}.h`, problems);
    validateAlphaChannel(value.alpha, `${path ?? "color"}.alpha`, problems);
    return problems;
  }

  problems.push({
    kind: "invalid-color-value",
    message: `Unsupported color space at ${path ?? "color"}.`,
    ...(path === undefined ? {} : { path }),
  });
  return problems;
}

function assertByteChannel(value: number, channel: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error(`sRGB channel ${channel} must be an integer from 0 through 255.`);
  }
}

function assertAlpha(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Alpha must be a finite number from 0 through 1.");
  }
}

function isColorValueShape(input: unknown): input is ColorValue {
  if (input === null || typeof input !== "object") return false;
  const colorSpace = (input as { readonly colorSpace?: unknown }).colorSpace;
  return colorSpace === "srgb" || colorSpace === "oklch" || colorSpace === "display-p3";
}

function validateUnitChannel(value: number, path: string, problems: ColorValueProblem[]): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    problems.push({
      kind: "invalid-color-value",
      message: `${path} must be a finite number from 0 through 1.`,
      path,
    });
  }
}

function validateAlphaChannel(value: number, path: string, problems: ColorValueProblem[]): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    problems.push({
      kind: "invalid-color-value",
      message: `${path} must be a finite number from 0 through 1.`,
      path,
    });
  }
}

function validateNonNegative(value: number, path: string, problems: ColorValueProblem[]): void {
  if (!Number.isFinite(value) || value < 0) {
    problems.push({
      kind: "invalid-color-value",
      message: `${path} must be a finite non-negative number.`,
      path,
    });
  }
}

function validateFinite(value: number, path: string, problems: ColorValueProblem[]): void {
  if (!Number.isFinite(value)) {
    problems.push({
      kind: "invalid-color-value",
      message: `${path} must be a finite number.`,
      path,
    });
  }
}
