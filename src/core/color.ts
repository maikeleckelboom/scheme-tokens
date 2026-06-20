import { readPlainRecord, normalizeNumber, pointer } from "./json";
import type { Issue, Result } from "./result";

export type ColorSpace = "srgb" | "display-p3" | "oklch";

export interface SrgbColorInput {
  readonly colorSpace: "srgb";
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha?: number;
}

export interface DisplayP3ColorInput {
  readonly colorSpace: "display-p3";
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha?: number;
}

export interface OklchColorInput {
  readonly colorSpace: "oklch";
  readonly l: number;
  readonly c: number;
  readonly h: number;
  readonly alpha?: number;
}

export type ColorInput = string | SrgbColorInput | DisplayP3ColorInput | OklchColorInput;

export interface SrgbColor {
  readonly colorSpace: "srgb";
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}

export interface DisplayP3Color {
  readonly colorSpace: "display-p3";
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

export type ColorValue = SrgbColor | DisplayP3Color | OklchColor;

export type ParseColorIssue = Issue<
  | "invalid-color-input"
  | "unsupported-color-syntax"
  | "invalid-color-space"
  | "missing-color-property"
  | "unknown-color-property"
  | "invalid-color-component"
> & {
  readonly component?: string;
  readonly colorSpace?: string;
};

export function parseColor(input: unknown): Result<ColorValue, ParseColorIssue> {
  return parseColorAt(input);
}

export function parseColorAt(input: unknown, path?: string): Result<ColorValue, ParseColorIssue> {
  if (typeof input === "string") return parseColorString(input, path);
  return parseColorObject(input, path);
}

export function cloneColor(color: ColorValue): ColorValue {
  if (color.colorSpace === "oklch") {
    return {
      colorSpace: "oklch",
      l: normalizeNumber(color.l),
      c: normalizeNumber(color.c),
      h: normalizeHue(color.c, color.h),
      alpha: normalizeNumber(color.alpha),
    };
  }

  return {
    colorSpace: color.colorSpace,
    r: normalizeNumber(color.r),
    g: normalizeNumber(color.g),
    b: normalizeNumber(color.b),
    alpha: normalizeNumber(color.alpha),
  };
}

function parseColorObject(
  input: unknown,
  path: string | undefined,
): Result<ColorValue, ParseColorIssue> {
  const entries = readPlainRecord(input, {
    code: "invalid-color-input",
    message: "Color input must be a concrete CSS string or plain color object.",
    ...(path === undefined ? {} : { path }),
  });
  if (!entries.ok) return entries as Result<never, ParseColorIssue>;

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const colorSpace = record.get("colorSpace");
  if (typeof colorSpace !== "string") {
    return missing("colorSpace", path);
  }

  if (colorSpace !== "srgb" && colorSpace !== "display-p3" && colorSpace !== "oklch") {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-color-space",
          message: "Unsupported color space.",
          colorSpace,
          ...(path === undefined ? {} : { path: child(path, "colorSpace") }),
        },
      ],
    };
  }

  const allowed =
    colorSpace === "oklch"
      ? new Set(["colorSpace", "l", "c", "h", "alpha"])
      : new Set(["colorSpace", "r", "g", "b", "alpha"]);
  for (const key of record.keys()) {
    if (!allowed.has(key)) {
      return {
        ok: false,
        issues: [
          {
            code: "unknown-color-property",
            message: `Unknown color property: ${key}.`,
            component: key,
            colorSpace,
            ...(path === undefined ? {} : { path: child(path, key) }),
          },
        ],
      };
    }
  }

  if (colorSpace === "oklch") {
    const l = readFinite(record, "l", path, colorSpace);
    if (!l.ok) return l;
    const c = readFinite(record, "c", path, colorSpace);
    if (!c.ok) return c;
    const h = readFinite(record, "h", path, colorSpace);
    if (!h.ok) return h;
    const alpha = readAlpha(record.get("alpha"), path, colorSpace);
    if (!alpha.ok) return alpha;
    if (c.value < 0) {
      return componentIssue("c", "OKLCH chroma must be non-negative.", path, colorSpace);
    }
    return {
      ok: true,
      value: {
        colorSpace,
        l: normalizeNumber(l.value),
        c: normalizeNumber(c.value),
        h: normalizeHue(c.value, h.value),
        alpha: normalizeNumber(alpha.value),
      },
    };
  }

  const r = readFinite(record, "r", path, colorSpace);
  if (!r.ok) return r;
  const g = readFinite(record, "g", path, colorSpace);
  if (!g.ok) return g;
  const b = readFinite(record, "b", path, colorSpace);
  if (!b.ok) return b;
  const alpha = readAlpha(record.get("alpha"), path, colorSpace);
  if (!alpha.ok) return alpha;
  return {
    ok: true,
    value: {
      colorSpace,
      r: normalizeNumber(r.value),
      g: normalizeNumber(g.value),
      b: normalizeNumber(b.value),
      alpha: normalizeNumber(alpha.value),
    },
  };
}

function parseColorString(
  input: string,
  path: string | undefined,
): Result<ColorValue, ParseColorIssue> {
  const source = input.trim();
  if (source === "") return unsupported(path);

  const hex = parseHex(source);
  if (hex !== undefined) return { ok: true, value: hex };

  if (/^transparent$/i.test(source)) {
    return { ok: true, value: { colorSpace: "srgb", r: 0, g: 0, b: 0, alpha: 0 } };
  }

  const rgb = parseRgbFunction(source, path);
  if (rgb !== undefined) return rgb;

  const oklch = parseOklchFunction(source, path);
  if (oklch !== undefined) return oklch;

  const color = parseColorFunction(source, path);
  if (color !== undefined) return color;

  return unsupported(path);
}

function parseHex(input: string): SrgbColor | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(input);
  if (match === null) return undefined;
  const digits = match[1] as string;
  const expanded =
    digits.length <= 4 ? [...digits].map((digit) => `${digit}${digit}`).join("") : digits;
  const r = Number.parseInt(expanded.slice(0, 2), 16) / 255;
  const g = Number.parseInt(expanded.slice(2, 4), 16) / 255;
  const b = Number.parseInt(expanded.slice(4, 6), 16) / 255;
  const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
  return { colorSpace: "srgb", r, g, b, alpha };
}

function parseRgbFunction(
  input: string,
  path: string | undefined,
): Result<ColorValue, ParseColorIssue> | undefined {
  const match = /^rgba?\((.*)\)$/i.exec(input);
  if (match === null) return undefined;
  const body = (match[1] as string).trim();
  if (body.includes(",")) {
    if (body.includes("/"))
      return componentIssue("rgb", "Mixed rgb delimiter forms are not supported.", path);
    const parts = body.split(",").map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4)
      return componentIssue("rgb", "rgb() expects three channels and optional alpha.", path);
    return createRgb(
      parseRgbChannel(parts[0], "r"),
      parseRgbChannel(parts[1], "g"),
      parseRgbChannel(parts[2], "b"),
      parts[3] === undefined ? { ok: true, value: 1 } : parseAlphaText(parts[3], "alpha"),
      path,
    );
  }

  const slashParts = body.split("/");
  if (slashParts.length > 2)
    return componentIssue("alpha", "rgb() has too many alpha separators.", path);
  const channels = (slashParts[0] ?? "").trim().split(/\s+/).filter(Boolean);
  if (channels.length !== 3) return componentIssue("rgb", "rgb() expects three channels.", path);
  const alpha =
    slashParts[1] === undefined
      ? { ok: true as const, value: 1 }
      : parseAlphaText(slashParts[1].trim(), "alpha");
  return createRgb(
    parseRgbChannel(channels[0], "r"),
    parseRgbChannel(channels[1], "g"),
    parseRgbChannel(channels[2], "b"),
    alpha,
    path,
  );
}

function parseOklchFunction(
  input: string,
  path: string | undefined,
): Result<ColorValue, ParseColorIssue> | undefined {
  const match = /^oklch\((.*)\)$/i.exec(input);
  if (match === null) return undefined;
  const body = (match[1] as string).trim();
  if (body.includes(","))
    return componentIssue("oklch", "oklch() uses space-separated syntax.", path);
  const slashParts = body.split("/");
  if (slashParts.length > 2)
    return componentIssue("alpha", "oklch() has too many alpha separators.", path);
  const parts = (slashParts[0] ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 3)
    return componentIssue("oklch", "oklch() expects lightness, chroma, and hue.", path);
  const l = parsePercentOrNumber(parts[0], "l", 1);
  const c = parseRequiredNumber(parts[1], "c");
  const h = parseHueText(parts[2], "h");
  const alpha =
    slashParts[1] === undefined
      ? { ok: true as const, value: 1 }
      : parseAlphaText(slashParts[1].trim(), "alpha");
  if (!l.ok) return componentIssue(l.component, l.message, path);
  if (!c.ok) return componentIssue(c.component, c.message, path);
  if (!h.ok) return componentIssue(h.component, h.message, path);
  if (!alpha.ok) return componentIssue(alpha.component, alpha.message, path);
  if (c.value < 0) return componentIssue("c", "OKLCH chroma must be non-negative.", path);
  return {
    ok: true,
    value: {
      colorSpace: "oklch",
      l: normalizeNumber(l.value),
      c: normalizeNumber(c.value),
      h: normalizeHue(c.value, h.value),
      alpha: normalizeNumber(alpha.value),
    },
  };
}

function parseColorFunction(
  input: string,
  path: string | undefined,
): Result<ColorValue, ParseColorIssue> | undefined {
  const match = /^color\(\s*([a-z0-9-]+)\s+(.*)\)$/i.exec(input);
  if (match === null) return undefined;
  const colorSpace = (match[1] as string).toLowerCase();
  if (colorSpace !== "srgb" && colorSpace !== "display-p3") {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-color-space",
          message: `Unsupported color() space: ${colorSpace}.`,
          colorSpace,
          ...(path === undefined ? {} : { path }),
        },
      ],
    };
  }

  const body = (match[2] as string).trim();
  if (body.includes(","))
    return componentIssue("color", "color() uses space-separated syntax.", path, colorSpace);
  const slashParts = body.split("/");
  if (slashParts.length > 2)
    return componentIssue("alpha", "color() has too many alpha separators.", path, colorSpace);
  const channels = (slashParts[0] ?? "").trim().split(/\s+/).filter(Boolean);
  if (channels.length !== 3)
    return componentIssue("color", "color() expects three coordinates.", path, colorSpace);
  const alpha =
    slashParts[1] === undefined
      ? { ok: true as const, value: 1 }
      : parseAlphaText(slashParts[1].trim(), "alpha");
  return createRgb(
    parsePercentOrNumber(channels[0], "r", 1),
    parsePercentOrNumber(channels[1], "g", 1),
    parsePercentOrNumber(channels[2], "b", 1),
    alpha,
    path,
    colorSpace,
  );
}

function createRgb(
  r: NumberParseOutcome,
  g: NumberParseOutcome,
  b: NumberParseOutcome,
  alpha: NumberParseOutcome,
  path: string | undefined,
  colorSpace: "srgb" | "display-p3" = "srgb",
): Result<ColorValue, ParseColorIssue> {
  for (const component of [r, g, b, alpha]) {
    if (!component.ok)
      return componentIssue(component.component, component.message, path, colorSpace);
  }
  if (!r.ok) return componentIssue(r.component, r.message, path, colorSpace);
  if (!g.ok) return componentIssue(g.component, g.message, path, colorSpace);
  if (!b.ok) return componentIssue(b.component, b.message, path, colorSpace);
  if (!alpha.ok) return componentIssue(alpha.component, alpha.message, path, colorSpace);
  if (alpha.value < 0 || alpha.value > 1) {
    return componentIssue("alpha", "Alpha must be between 0 and 1.", path, colorSpace);
  }
  return {
    ok: true,
    value: {
      colorSpace,
      r: normalizeNumber(r.value),
      g: normalizeNumber(g.value),
      b: normalizeNumber(b.value),
      alpha: normalizeNumber(alpha.value),
    },
  };
}

type NumberParseOutcome =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly component: string; readonly message: string };

function parseRgbChannel(input: string | undefined, component: string): NumberParseOutcome {
  return parsePercentOrNumber(input, component, 255);
}

function parsePercentOrNumber(
  input: string | undefined,
  component: string,
  numberScale: number,
): NumberParseOutcome {
  if (input === undefined || input === "") return invalidNumber(component);
  if (input.endsWith("%")) {
    const value = Number(input.slice(0, -1));
    return Number.isFinite(value) ? { ok: true, value: value / 100 } : invalidNumber(component);
  }
  const value = Number(input);
  return Number.isFinite(value)
    ? { ok: true, value: value / numberScale }
    : invalidNumber(component);
}

function parseRequiredNumber(input: string | undefined, component: string): NumberParseOutcome {
  if (input === undefined || input === "" || input.endsWith("%")) return invalidNumber(component);
  const value = Number(input);
  return Number.isFinite(value) ? { ok: true, value } : invalidNumber(component);
}

function parseHueText(input: string | undefined, component: string): NumberParseOutcome {
  if (input === undefined || input === "") return invalidNumber(component);
  const text = input.toLowerCase().endsWith("deg") ? input.slice(0, -3) : input;
  const value = Number(text);
  return Number.isFinite(value) ? { ok: true, value } : invalidNumber(component);
}

function parseAlphaText(input: string | undefined, component: string): NumberParseOutcome {
  const parsed = parsePercentOrNumber(input, component, 1);
  if (!parsed.ok) return parsed;
  return parsed.value >= 0 && parsed.value <= 1
    ? parsed
    : { ok: false, component, message: "Alpha must be between 0 and 1." };
}

function invalidNumber(component: string): NumberParseOutcome {
  return { ok: false, component, message: `Invalid numeric component: ${component}.` };
}

function readFinite(
  record: ReadonlyMap<string, unknown>,
  component: string,
  path: string | undefined,
  colorSpace: string,
): Result<number, ParseColorIssue> {
  const value = record.get(component);
  if (value === undefined) return missing(component, path, colorSpace);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return componentIssue(component, "Color components must be finite numbers.", path, colorSpace);
  }
  return { ok: true, value };
}

function readAlpha(
  value: unknown,
  path: string | undefined,
  colorSpace: string,
): Result<number, ParseColorIssue> {
  if (value === undefined) return { ok: true, value: 1 };
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    return componentIssue(
      "alpha",
      "Alpha must be a finite number between 0 and 1.",
      path,
      colorSpace,
    );
  }
  return { ok: true, value };
}

function normalizeHue(chroma: number, hue: number): number {
  if (chroma === 0) return 0;
  const normalized = ((hue % 360) + 360) % 360;
  return normalizeNumber(normalized);
}

function missing(
  component: string,
  path: string | undefined,
  colorSpace?: string,
): Result<never, ParseColorIssue> {
  return {
    ok: false,
    issues: [
      {
        code: "missing-color-property",
        message: `Missing color property: ${component}.`,
        component,
        ...(colorSpace === undefined ? {} : { colorSpace }),
        ...(path === undefined ? {} : { path: child(path, component) }),
      },
    ],
  };
}

function componentIssue(
  component: string,
  message: string,
  path: string | undefined,
  colorSpace?: string,
): Result<never, ParseColorIssue> {
  return {
    ok: false,
    issues: [
      {
        code: "invalid-color-component",
        message,
        component,
        ...(colorSpace === undefined ? {} : { colorSpace }),
        ...(path === undefined ? {} : { path }),
      },
    ],
  };
}

function unsupported(path: string | undefined): Result<never, ParseColorIssue> {
  return {
    ok: false,
    issues: [
      {
        code: "unsupported-color-syntax",
        message: "Unsupported concrete color syntax.",
        ...(path === undefined ? {} : { path }),
      },
    ],
  };
}

function child(parent: string | undefined, segment: string): string {
  return parent === undefined || parent === "" ? pointer(segment) : `${parent}/${segment}`;
}
