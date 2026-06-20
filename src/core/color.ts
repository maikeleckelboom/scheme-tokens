import { escapePointerSegment, normalizeNumber, pointer, readPlainRecord } from "./json";
import type { Issue, Result } from "./result";

export const colorSpaces = [
  "srgb",
  "srgb-linear",
  "hsl",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "display-p3",
  "a98-rgb",
  "prophoto-rgb",
  "rec2020",
  "xyz-d65",
  "xyz-d50",
] as const;

export type ColorSpace = (typeof colorSpaces)[number];
export type ColorComponent = number | "none";

export interface ColorValueInput {
  readonly colorSpace: ColorSpace;
  readonly components: readonly ColorComponent[];
  readonly alpha?: number;
  readonly hex?: string;
}

export type ColorInput = string | ColorValueInput;

export interface ColorValue {
  readonly colorSpace: ColorSpace;
  readonly components: readonly [ColorComponent, ColorComponent, ColorComponent];
  readonly alpha: number;
  readonly hex?: string;
}

export type ParseColorIssue = Issue<
  | "invalid-color-input"
  | "unsupported-color-syntax"
  | "invalid-color-space"
  | "missing-color-property"
  | "unknown-color-property"
  | "invalid-color-component"
  | "invalid-color-components"
  | "invalid-color-alpha"
  | "invalid-color-hex"
> & {
  readonly component?: string;
  readonly colorSpace?: string;
};

const supportedColorSpaces = new Set<string>(colorSpaces);
const rgbLikeSpaces = new Set<ColorSpace>([
  "srgb",
  "srgb-linear",
  "display-p3",
  "a98-rgb",
  "prophoto-rgb",
  "rec2020",
]);
const xyzSpaces = new Set<ColorSpace>(["xyz-d65", "xyz-d50"]);
const hueComponentIndexes = new Map<ColorSpace, number>([
  ["hsl", 0],
  ["hwb", 0],
  ["lch", 2],
  ["oklch", 2],
]);
const nonNegativeComponentIndexes = new Map<ColorSpace, readonly number[]>([
  ["lch", [1]],
  ["oklch", [1]],
]);
const hexPattern = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function parseColor(input: unknown): Result<ColorValue, ParseColorIssue> {
  return parseColorAt(input);
}

export function parseColorAt(input: unknown, path?: string): Result<ColorValue, ParseColorIssue> {
  if (typeof input === "string") {
    return parseColorString(input, path);
  }
  return parseColorObject(input, path, { requireAlpha: false });
}

export function parsePersistedColorAt(
  input: unknown,
  path?: string,
): Result<ColorValue, ParseColorIssue> {
  if (typeof input === "string") {
    return unsupported(path);
  }
  return parseColorObject(input, path, { requireAlpha: true });
}

export function cloneColor(color: ColorValue): ColorValue {
  return {
    colorSpace: color.colorSpace,
    components: color.components.map(normalizeComponent) as [
      ColorComponent,
      ColorComponent,
      ColorComponent,
    ],
    alpha: normalizeNumber(color.alpha),
    ...(color.hex === undefined ? {} : { hex: color.hex }),
  };
}

function parseColorObject(
  input: unknown,
  path: string | undefined,
  options: { readonly requireAlpha: boolean },
): Result<ColorValue, ParseColorIssue> {
  const entries = readPlainRecord(input, {
    code: "invalid-color-input",
    message: "Color input must be a concrete CSS string or plain structured color object.",
    ...(path === undefined ? {} : { path }),
  });
  if (!entries.ok) {
    return entries as Result<never, ParseColorIssue>;
  }

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const colorSpace = record.get("colorSpace");
  if (typeof colorSpace !== "string") {
    return missing("colorSpace", path);
  }
  if (!supportedColorSpaces.has(colorSpace)) {
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

  for (const key of record.keys()) {
    if (key !== "colorSpace" && key !== "components" && key !== "alpha" && key !== "hex") {
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

  if (options.requireAlpha && !record.has("alpha")) {
    return missing("alpha", path, colorSpace);
  }

  const components = readComponents(record.get("components"), path, colorSpace as ColorSpace);
  if (!components.ok) {
    return components;
  }

  const alpha = readAlpha(record.get("alpha"), path, colorSpace);
  if (!alpha.ok) {
    return alpha;
  }

  const hex = readHex(record.get("hex"), record.has("hex"), path, colorSpace);
  if (!hex.ok) {
    return hex;
  }

  return {
    ok: true,
    value: {
      colorSpace: colorSpace as ColorSpace,
      components: normalizeComponents(colorSpace as ColorSpace, components.value),
      alpha: normalizeNumber(alpha.value),
      ...(hex.value === undefined ? {} : { hex: hex.value }),
    },
  };
}

function parseColorString(
  input: string,
  path: string | undefined,
): Result<ColorValue, ParseColorIssue> {
  const source = input.trim();
  if (source === "") {
    return unsupported(path);
  }

  const hex = parseHex(source);
  if (hex !== undefined) {
    return { ok: true, value: hex };
  }

  if (/^transparent$/i.test(source)) {
    return {
      ok: true,
      value: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0 },
    };
  }

  const rgb = parseRgbFunction(source, path);
  if (rgb !== undefined) {
    return rgb;
  }

  const hsl = parseCylindricalFunction(source, "hsl", path);
  if (hsl !== undefined) {
    return hsl;
  }

  const hwb = parseCylindricalFunction(source, "hwb", path);
  if (hwb !== undefined) {
    return hwb;
  }

  const lab = parseLabLikeFunction(source, "lab", path);
  if (lab !== undefined) {
    return lab;
  }

  const lch = parseLabLikeFunction(source, "lch", path);
  if (lch !== undefined) {
    return lch;
  }

  const oklab = parseLabLikeFunction(source, "oklab", path);
  if (oklab !== undefined) {
    return oklab;
  }

  const oklch = parseLabLikeFunction(source, "oklch", path);
  if (oklch !== undefined) {
    return oklch;
  }

  const color = parseColorFunction(source, path);
  if (color !== undefined) {
    return color;
  }

  return unsupported(path);
}

function parseHex(input: string): ColorValue | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(input);
  if (match === null) {
    return undefined;
  }
  const digits = match[1] as string;
  const expanded =
    digits.length <= 4 ? [...digits].map((digit) => `${digit}${digit}`).join("") : digits;
  const r = Number.parseInt(expanded.slice(0, 2), 16) / 255;
  const g = Number.parseInt(expanded.slice(2, 4), 16) / 255;
  const b = Number.parseInt(expanded.slice(4, 6), 16) / 255;
  const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
  return {
    colorSpace: "srgb",
    components: [r, g, b],
    alpha,
    hex: `#${expanded.toLowerCase()}`,
  };
}

function parseRgbFunction(
  input: string,
  path: string | undefined,
): Result<ColorValue, ParseColorIssue> | undefined {
  const match = /^rgba?\((.*)\)$/i.exec(input);
  if (match === null) {
    return undefined;
  }
  const body = (match[1] as string).trim();
  if (body.includes(",")) {
    if (body.includes("/")) {
      return componentIssue("rgb", "Mixed rgb delimiter forms are not supported.", path);
    }
    const parts = body.split(",").map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4) {
      return componentIssue("rgb", "rgb() expects three channels and optional alpha.", path);
    }
    return createColor(
      "srgb",
      [
        parseRgbChannel(parts[0], "r"),
        parseRgbChannel(parts[1], "g"),
        parseRgbChannel(parts[2], "b"),
      ],
      parts[3] === undefined ? { ok: true, value: 1 } : parseAlphaText(parts[3], "alpha"),
      path,
    );
  }

  const slashParts = body.split("/");
  if (slashParts.length > 2) {
    return componentIssue("alpha", "rgb() has too many alpha separators.", path);
  }
  const channels = (slashParts[0] ?? "").trim().split(/\s+/).filter(Boolean);
  if (channels.length !== 3) {
    return componentIssue("rgb", "rgb() expects three channels.", path);
  }
  const alpha =
    slashParts[1] === undefined
      ? { ok: true as const, value: 1 }
      : parseAlphaText(slashParts[1].trim(), "alpha");
  return createColor(
    "srgb",
    [
      parseRgbChannel(channels[0], "r"),
      parseRgbChannel(channels[1], "g"),
      parseRgbChannel(channels[2], "b"),
    ],
    alpha,
    path,
  );
}

function parseCylindricalFunction(
  input: string,
  colorSpace: "hsl" | "hwb",
  path: string | undefined,
): Result<ColorValue, ParseColorIssue> | undefined {
  const match = new RegExp(`^${colorSpace}a?\\((.*)\\)$`, "i").exec(input);
  if (match === null) {
    return undefined;
  }
  const body = (match[1] as string).trim();
  if (body.includes(",")) {
    return componentIssue(colorSpace, `${colorSpace}() uses space-separated syntax.`, path);
  }
  const parts = splitFunctionComponents(body);
  if (!parts.ok) {
    return componentIssue(parts.component, parts.message, path, colorSpace);
  }
  if (parts.components.length !== 3) {
    return componentIssue(
      colorSpace,
      `${colorSpace}() expects three components.`,
      path,
      colorSpace,
    );
  }
  return createColor(
    colorSpace,
    [
      parseHueText(parts.components[0], "h"),
      parsePercentOrNumber(parts.components[1], colorSpace === "hsl" ? "s" : "w", 1),
      parsePercentOrNumber(parts.components[2], colorSpace === "hsl" ? "l" : "b", 1),
    ],
    parts.alpha === undefined
      ? { ok: true as const, value: 1 }
      : parseAlphaText(parts.alpha, "alpha"),
    path,
  );
}

function parseLabLikeFunction(
  input: string,
  colorSpace: "lab" | "lch" | "oklab" | "oklch",
  path: string | undefined,
): Result<ColorValue, ParseColorIssue> | undefined {
  const match = new RegExp(`^${colorSpace}\\((.*)\\)$`, "i").exec(input);
  if (match === null) {
    return undefined;
  }
  const body = (match[1] as string).trim();
  if (body.includes(",")) {
    return componentIssue(colorSpace, `${colorSpace}() uses space-separated syntax.`, path);
  }
  const parts = splitFunctionComponents(body);
  if (!parts.ok) {
    return componentIssue(parts.component, parts.message, path, colorSpace);
  }
  if (parts.components.length !== 3) {
    return componentIssue(
      colorSpace,
      `${colorSpace}() expects three components.`,
      path,
      colorSpace,
    );
  }

  const isPolar = colorSpace === "lch" || colorSpace === "oklch";
  const firstScale = colorSpace === "lab" || colorSpace === "lch" ? 100 : 1;
  return createColor(
    colorSpace,
    [
      parsePercentOrNumber(parts.components[0], "l", firstScale),
      parseRequiredNumberOrNone(parts.components[1], isPolar ? "c" : "a"),
      isPolar
        ? parseHueText(parts.components[2], "h")
        : parseRequiredNumberOrNone(parts.components[2], "b"),
    ],
    parts.alpha === undefined
      ? { ok: true as const, value: 1 }
      : parseAlphaText(parts.alpha, "alpha"),
    path,
  );
}

function parseColorFunction(
  input: string,
  path: string | undefined,
): Result<ColorValue, ParseColorIssue> | undefined {
  const match = /^color\(\s*([a-z0-9-]+)\s+(.*)\)$/i.exec(input);
  if (match === null) {
    return undefined;
  }
  const colorSpace = (match[1] as string).toLowerCase();
  if (!rgbLikeSpaces.has(colorSpace as ColorSpace) && !xyzSpaces.has(colorSpace as ColorSpace)) {
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
  if (body.includes(",")) {
    return componentIssue("color", "color() uses space-separated syntax.", path, colorSpace);
  }
  const parts = splitFunctionComponents(body);
  if (!parts.ok) {
    return componentIssue(parts.component, parts.message, path, colorSpace);
  }
  if (parts.components.length !== 3) {
    return componentIssue("color", "color() expects three coordinates.", path, colorSpace);
  }
  return createColor(
    colorSpace as ColorSpace,
    [
      parsePercentOrNumber(parts.components[0], "0", 1),
      parsePercentOrNumber(parts.components[1], "1", 1),
      parsePercentOrNumber(parts.components[2], "2", 1),
    ],
    parts.alpha === undefined
      ? { ok: true as const, value: 1 }
      : parseAlphaText(parts.alpha, "alpha"),
    path,
  );
}

function createColor(
  colorSpace: ColorSpace,
  components: readonly NumberParseOutcome[],
  alpha: NumberParseOutcome,
  path: string | undefined,
): Result<ColorValue, ParseColorIssue> {
  if (components.length !== 3) {
    return componentIssue(
      "components",
      "Color functions require three components.",
      path,
      colorSpace,
    );
  }
  const [first, second, third] = components as readonly [
    NumberParseOutcome,
    NumberParseOutcome,
    NumberParseOutcome,
  ];
  if (!first.ok) {
    return componentIssue(first.component, first.message, path, colorSpace);
  }
  if (!second.ok) {
    return componentIssue(second.component, second.message, path, colorSpace);
  }
  if (!third.ok) {
    return componentIssue(third.component, third.message, path, colorSpace);
  }
  if (!alpha.ok) {
    return componentIssue(alpha.component, alpha.message, path, colorSpace);
  }
  if (alpha.value === "none") {
    return alphaIssue("Alpha must be a finite number.", path, colorSpace);
  }

  const values: [ColorComponent, ColorComponent, ColorComponent] = [
    first.value,
    second.value,
    third.value,
  ];
  const alphaValue = alpha.value;
  if (alphaValue < 0 || alphaValue > 1) {
    return alphaIssue("Alpha must be between 0 and 1.", path, colorSpace);
  }
  const normalized = normalizeComponents(colorSpace, values);
  const validation = validateComponents(colorSpace, normalized, path);
  if (!validation.ok) {
    return validation;
  }

  return {
    ok: true,
    value: {
      colorSpace,
      components: normalized,
      alpha: normalizeNumber(alphaValue),
    },
  };
}

type NumberParseOutcome =
  | { readonly ok: true; readonly value: ColorComponent }
  | { readonly ok: false; readonly component: string; readonly message: string };

function splitFunctionComponents(body: string):
  | {
      readonly ok: true;
      readonly components: readonly string[];
      readonly alpha?: string;
    }
  | {
      readonly ok: false;
      readonly component: string;
      readonly message: string;
    } {
  const slashParts = body.split("/");
  if (slashParts.length > 2) {
    return {
      ok: false,
      component: "alpha",
      message: "Color function has too many alpha separators.",
    };
  }
  const components = (slashParts[0] ?? "").trim().split(/\s+/).filter(Boolean);
  const alpha = slashParts[1]?.trim();
  return {
    ok: true,
    components,
    ...(alpha === undefined || alpha === "" ? {} : { alpha }),
  };
}

function parseRgbChannel(input: string | undefined, component: string): NumberParseOutcome {
  return parsePercentOrNumber(input, component, 255);
}

function parsePercentOrNumber(
  input: string | undefined,
  component: string,
  numberScale: number,
): NumberParseOutcome {
  if (input === undefined || input === "") {
    return invalidNumber(component);
  }
  if (input.toLowerCase() === "none") {
    return { ok: true, value: "none" };
  }
  if (input.endsWith("%")) {
    const value = Number(input.slice(0, -1));
    return Number.isFinite(value) ? { ok: true, value: value / 100 } : invalidNumber(component);
  }
  const value = Number(input);
  return Number.isFinite(value)
    ? { ok: true, value: value / numberScale }
    : invalidNumber(component);
}

function parseRequiredNumberOrNone(
  input: string | undefined,
  component: string,
): NumberParseOutcome {
  if (input === undefined || input === "") {
    return invalidNumber(component);
  }
  if (input.toLowerCase() === "none") {
    return { ok: true, value: "none" };
  }
  if (input.endsWith("%")) {
    return invalidNumber(component);
  }
  const value = Number(input);
  return Number.isFinite(value) ? { ok: true, value } : invalidNumber(component);
}

function parseHueText(input: string | undefined, component: string): NumberParseOutcome {
  if (input === undefined || input === "") {
    return invalidNumber(component);
  }
  if (input.toLowerCase() === "none") {
    return { ok: true, value: "none" };
  }
  const text = input.toLowerCase().endsWith("deg") ? input.slice(0, -3) : input;
  const value = Number(text);
  return Number.isFinite(value) ? { ok: true, value } : invalidNumber(component);
}

function parseAlphaText(input: string | undefined, component: string): NumberParseOutcome {
  const parsed = parsePercentOrNumber(input, component, 1);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.value === "none") {
    return { ok: false, component, message: "Alpha must be a finite number." };
  }
  return parsed.value >= 0 && parsed.value <= 1
    ? parsed
    : { ok: false, component, message: "Alpha must be between 0 and 1." };
}

function invalidNumber(component: string): NumberParseOutcome {
  return { ok: false, component, message: `Invalid numeric component: ${component}.` };
}

function readComponents(
  input: unknown,
  path: string | undefined,
  colorSpace: ColorSpace,
): Result<readonly [ColorComponent, ColorComponent, ColorComponent], ParseColorIssue> {
  if (!Array.isArray(input)) {
    return {
      ok: false,
      issues: [
        {
          code: input === undefined ? "missing-color-property" : "invalid-color-components",
          message: "components must be an array of three color components.",
          component: "components",
          colorSpace,
          ...(path === undefined ? {} : { path: child(path, "components") }),
        },
      ],
    };
  }

  let descriptors: Record<string, PropertyDescriptor>;
  try {
    descriptors = Object.getOwnPropertyDescriptors(input) as Record<string, PropertyDescriptor>;
  } catch {
    return componentsIssue("components must be readable data properties.", path, colorSpace);
  }

  if (input.length !== 3) {
    return componentsIssue("components must contain exactly three entries.", path, colorSpace);
  }

  const output: ColorComponent[] = [];
  for (let index = 0; index < 3; index += 1) {
    const descriptor = descriptors[String(index)];
    if (descriptor === undefined || !("value" in descriptor)) {
      return componentsIssue("components must not be sparse or accessor-backed.", path, colorSpace);
    }
    const value = descriptor.value;
    if (value !== "none" && (typeof value !== "number" || !Number.isFinite(value))) {
      return componentIssue(
        String(index),
        "Color components must be finite numbers or none.",
        child(path, "components", index),
        colorSpace,
      );
    }
    output.push(value === "none" ? value : normalizeNumber(value));
  }

  const components = output as [ColorComponent, ColorComponent, ColorComponent];
  const validation = validateComponents(colorSpace, components, path);
  if (!validation.ok) {
    return validation;
  }
  return { ok: true, value: components };
}

function validateComponents(
  colorSpace: ColorSpace,
  components: readonly [ColorComponent, ColorComponent, ColorComponent],
  path: string | undefined,
): Result<void, ParseColorIssue> {
  const nonNegative = nonNegativeComponentIndexes.get(colorSpace) ?? [];
  for (const index of nonNegative) {
    const component = components[index];
    if (typeof component === "number" && component < 0) {
      return componentIssue(
        String(index),
        `${colorSpace} component ${index} must be non-negative.`,
        child(path, "components", index),
        colorSpace,
      );
    }
  }
  return { ok: true, value: undefined };
}

function normalizeComponents(
  colorSpace: ColorSpace,
  components: readonly [ColorComponent, ColorComponent, ColorComponent],
): readonly [ColorComponent, ColorComponent, ColorComponent] {
  const normalized = components.map(normalizeComponent) as [
    ColorComponent,
    ColorComponent,
    ColorComponent,
  ];
  const hueIndex = hueComponentIndexes.get(colorSpace);
  if (hueIndex !== undefined && typeof normalized[hueIndex] === "number") {
    normalized[hueIndex] = normalizeHue(normalized[hueIndex] as number);
  }
  return normalized;
}

function normalizeComponent(component: ColorComponent): ColorComponent {
  return component === "none" ? component : normalizeNumber(component);
}

function readAlpha(
  value: unknown,
  path: string | undefined,
  colorSpace: string,
): Result<number, ParseColorIssue> {
  if (value === undefined) {
    return { ok: true, value: 1 };
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    return alphaIssue("Alpha must be a finite number between 0 and 1.", path, colorSpace);
  }
  return { ok: true, value };
}

function readHex(
  value: unknown,
  hasValue: boolean,
  path: string | undefined,
  colorSpace: string,
): Result<string | undefined, ParseColorIssue> {
  if (!hasValue) {
    return { ok: true, value: undefined };
  }
  if (typeof value !== "string" || !hexPattern.test(value)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-color-hex",
          message: "hex must be #rrggbb or #rrggbbaa when present.",
          component: "hex",
          colorSpace,
          ...(path === undefined ? {} : { path: child(path, "hex") }),
        },
      ],
    };
  }
  return { ok: true, value: value.toLowerCase() };
}

function normalizeHue(hue: number): number {
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

function componentsIssue(
  message: string,
  path: string | undefined,
  colorSpace: string,
): Result<never, ParseColorIssue> {
  return {
    ok: false,
    issues: [
      {
        code: "invalid-color-components",
        message,
        component: "components",
        colorSpace,
        ...(path === undefined ? {} : { path: child(path, "components") }),
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

function alphaIssue(
  message: string,
  path: string | undefined,
  colorSpace: string,
): Result<never, ParseColorIssue> {
  return {
    ok: false,
    issues: [
      {
        code: "invalid-color-alpha",
        message,
        component: "alpha",
        colorSpace,
        ...(path === undefined ? {} : { path: child(path, "alpha") }),
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

function child(parent: string | undefined, ...segments: readonly (string | number)[]): string {
  const suffix = segments.map((segment) => escapePointerSegment(String(segment))).join("/");
  if (parent === undefined || parent === "") {
    return pointer(...segments);
  }
  return `${parent}/${suffix}`;
}
