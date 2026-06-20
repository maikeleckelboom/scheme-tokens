import type { ColorInput, SrgbColor } from "../../core/color";
import { parseColorAt } from "../../core/color";
import type { TokenGraphInput } from "../../core/graph";
import { copyJsonValue, defineRecordValue, readPlainRecord } from "../../core/json";
import type { Issue, Result } from "../../core/result";
import type { TokenSource } from "../../core/source";
import { convertColor, isColorInGamut, mapColorToGamut } from "../../conversion/conversion";
import { argbToSrgb, srgbToArgb } from "./argb";
import { createMaterialScheme, readSchemeRoleArgb } from "./material3-adapter";
import { MATERIAL3_ROLES } from "./material3-roles";

export type Material3AlgorithmVariant = "tonalSpot" | "vibrant" | "expressive" | "neutral";
export type Material3SpecVersion = "2021" | "2025";
export type Material3Platform = "phone" | "watch";

export interface Material3KeyColors {
  readonly primary?: ColorInput;
  readonly secondary?: ColorInput;
  readonly tertiary?: ColorInput;
  readonly neutral?: ColorInput;
  readonly neutralVariant?: ColorInput;
}

export interface Material3AlgorithmOptions {
  readonly variant?: Material3AlgorithmVariant;
  readonly contrastLevel?: number;
  readonly specVersion?: Material3SpecVersion;
  readonly platform?: Material3Platform;
}

export interface Material3GamutMappingOptions {
  readonly method: "preserve-lightness";
}

export interface Material3SourceOptions {
  readonly sourceColor: ColorInput;
  readonly keyColors?: Material3KeyColors;
  readonly algorithm?: Material3AlgorithmOptions;
  readonly gamutMapping?: Material3GamutMappingOptions;
}

export type Material3SourceIssue = Issue<
  | "invalid-material3-options"
  | "invalid-source-color"
  | "invalid-key-color"
  | "unsupported-alpha"
  | "out-of-srgb-gamut"
  | "unsupported-variant"
  | "invalid-contrast-level"
  | "unsupported-spec-version"
  | "unsupported-platform"
  | "material3-generation-failed"
  | "issue-limit-reached"
> & {
  readonly sourceId?: "material3";
  readonly keyColor?: keyof Material3KeyColors;
};

interface ResolvedAlgorithm {
  readonly variant: Material3AlgorithmVariant;
  readonly contrastLevel: number;
  readonly specVersion: Material3SpecVersion;
  readonly platform: Material3Platform;
}

const keyColorNames = ["primary", "secondary", "tertiary", "neutral", "neutralVariant"] as const;

export function material3Source(
  options: Material3SourceOptions,
): TokenSource<Material3SourceIssue> {
  const copied = copyJsonValue(options, {
    code: "invalid-material3-options",
    message: "Material 3 source options must be JSON-safe plain data.",
  });

  return {
    id: "material3",
    build(): Result<TokenGraphInput, Material3SourceIssue> {
      if (!copied.ok)
        return {
          ok: false,
          issues: copied.issues as readonly [Material3SourceIssue, ...Material3SourceIssue[]],
        };
      return buildFromOptions(copied.value);
    },
  };
}

function buildFromOptions(input: unknown): Result<TokenGraphInput, Material3SourceIssue> {
  const parsed = parseOptions(input);
  if (!parsed.ok) return parsed;
  try {
    return {
      ok: true,
      value: createMaterialGraph(parsed.value),
    };
  } catch {
    return {
      ok: false,
      issues: [
        {
          code: "material3-generation-failed",
          message: "Material 3 generation failed.",
          sourceId: "material3",
        },
      ],
    };
  }
}

function parseOptions(input: unknown): Result<
  {
    readonly sourceColor: SrgbColor;
    readonly keyColors?: Partial<Record<(typeof keyColorNames)[number], SrgbColor>>;
    readonly algorithm: ResolvedAlgorithm;
  },
  Material3SourceIssue
> {
  const entries = readPlainRecord(input, {
    code: "invalid-material3-options",
    message: "Material 3 source options must be a plain object.",
  });
  if (!entries.ok) return entries as Result<never, Material3SourceIssue>;

  const allowed = new Set(["sourceColor", "keyColors", "algorithm", "gamutMapping"]);
  const issues: Material3SourceIssue[] = [];
  for (const entry of entries.value) {
    if (!allowed.has(entry.key)) {
      issues.push({
        code: "invalid-material3-options",
        message: `Unknown Material 3 option: ${entry.key}.`,
        sourceId: "material3",
      });
    }
  }

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const gamutMapping = parseGamutMapping(record.get("gamutMapping"), issues);
  const sourceColor = parseBridgeColor(
    record.get("sourceColor"),
    "sourceColor",
    "source",
    gamutMapping,
    issues,
  );
  const keyColors = parseKeyColors(record.get("keyColors"), gamutMapping, issues);
  const algorithm = parseAlgorithm(record.get("algorithm"), issues);

  if (issues.length > 0 || sourceColor === undefined || algorithm === undefined) {
    return {
      ok: false,
      issues: issues as unknown as readonly [Material3SourceIssue, ...Material3SourceIssue[]],
    };
  }

  return {
    ok: true,
    value: {
      sourceColor,
      ...(keyColors === undefined ? {} : { keyColors }),
      algorithm,
    },
  };
}

function parseGamutMapping(
  input: unknown,
  issues: Material3SourceIssue[],
): "preserve-lightness" | undefined {
  if (input === undefined) return undefined;
  const entries = readPlainRecord(input, {
    code: "invalid-material3-options",
    message: "gamutMapping must be a plain object.",
  });
  if (!entries.ok) {
    issues.push(...(entries.issues as readonly Material3SourceIssue[]));
    return undefined;
  }
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  if (record.size !== 1 || record.get("method") !== "preserve-lightness") {
    issues.push({
      code: "invalid-material3-options",
      message: "gamutMapping.method must be preserve-lightness.",
      sourceId: "material3",
    });
    return undefined;
  }
  return "preserve-lightness";
}

function parseBridgeColor(
  input: unknown,
  path: string,
  usage: "source" | "key",
  gamutMapping: "preserve-lightness" | undefined,
  issues: Material3SourceIssue[],
  keyColor?: keyof Material3KeyColors,
): SrgbColor | undefined {
  if (input === undefined) {
    if (usage === "source") {
      issues.push({
        code: "invalid-source-color",
        message: "sourceColor is required.",
        sourceId: "material3",
      });
    }
    return undefined;
  }

  const parsed = parseColorAt(input, `/${path.replaceAll(".", "/")}`);
  if (!parsed.ok) {
    for (const issue of parsed.issues) {
      issues.push({
        code: usage === "source" ? "invalid-source-color" : "invalid-key-color",
        message: issue.message,
        sourceId: "material3",
        ...(keyColor === undefined ? {} : { keyColor }),
        ...(issue.path === undefined ? {} : { path: issue.path }),
      });
    }
    return undefined;
  }
  if (parsed.value.alpha !== 1) {
    issues.push({
      code: "unsupported-alpha",
      message: "Material 3 colors must be opaque.",
      sourceId: "material3",
      ...(keyColor === undefined ? {} : { keyColor }),
      path: `/${path.replaceAll(".", "/")}/alpha`,
    });
    return undefined;
  }

  const srgb =
    parsed.value.colorSpace === "srgb"
      ? { ok: true as const, value: parsed.value }
      : convertColor(parsed.value, "srgb");
  if (!srgb.ok || srgb.value.colorSpace !== "srgb") {
    issues.push({
      code: usage === "source" ? "invalid-source-color" : "invalid-key-color",
      message: "Unable to convert Material 3 color to sRGB.",
      sourceId: "material3",
      ...(keyColor === undefined ? {} : { keyColor }),
    });
    return undefined;
  }

  if (isColorInGamut(srgb.value, "srgb")) return srgb.value;
  if (gamutMapping === undefined) {
    issues.push({
      code: "out-of-srgb-gamut",
      message: "Material 3 color is outside sRGB gamut.",
      sourceId: "material3",
      ...(keyColor === undefined ? {} : { keyColor }),
    });
    return undefined;
  }

  const mapped = mapColorToGamut(srgb.value, "srgb", { method: gamutMapping });
  if (!mapped.ok || mapped.value.colorSpace !== "srgb") {
    issues.push({
      code: usage === "source" ? "invalid-source-color" : "invalid-key-color",
      message: "Unable to gamut-map Material 3 color to sRGB.",
      sourceId: "material3",
      ...(keyColor === undefined ? {} : { keyColor }),
    });
    return undefined;
  }
  return mapped.value;
}

function parseKeyColors(
  input: unknown,
  gamutMapping: "preserve-lightness" | undefined,
  issues: Material3SourceIssue[],
): Partial<Record<(typeof keyColorNames)[number], SrgbColor>> | undefined {
  if (input === undefined) return undefined;
  const entries = readPlainRecord(input, {
    code: "invalid-material3-options",
    message: "keyColors must be a plain object.",
  });
  if (!entries.ok) {
    issues.push(...(entries.issues as readonly Material3SourceIssue[]));
    return undefined;
  }
  const allowed = new Set<string>(keyColorNames);
  const output: Partial<Record<(typeof keyColorNames)[number], SrgbColor>> = {};
  for (const entry of entries.value) {
    if (!allowed.has(entry.key)) {
      issues.push({
        code: "invalid-material3-options",
        message: `Unknown key color: ${entry.key}.`,
        sourceId: "material3",
      });
      continue;
    }
    const keyColor = entry.key as (typeof keyColorNames)[number];
    const color = parseBridgeColor(
      entry.value,
      `keyColors.${entry.key}`,
      "key",
      gamutMapping,
      issues,
      keyColor,
    );
    if (color !== undefined) output[keyColor] = color;
  }
  return output;
}

function parseAlgorithm(
  input: unknown,
  issues: Material3SourceIssue[],
): ResolvedAlgorithm | undefined {
  if (input === undefined) {
    return { variant: "tonalSpot", contrastLevel: 0, specVersion: "2021", platform: "phone" };
  }
  const entries = readPlainRecord(input, {
    code: "invalid-material3-options",
    message: "algorithm must be a plain object.",
  });
  if (!entries.ok) {
    issues.push(...(entries.issues as readonly Material3SourceIssue[]));
    return undefined;
  }
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const variant = record.get("variant") ?? "tonalSpot";
  const contrastLevel = record.get("contrastLevel") ?? 0;
  const specVersion = record.get("specVersion") ?? "2021";
  const platform = record.get("platform") ?? "phone";

  for (const entry of entries.value) {
    if (
      entry.key !== "variant" &&
      entry.key !== "contrastLevel" &&
      entry.key !== "specVersion" &&
      entry.key !== "platform"
    ) {
      issues.push({
        code: "invalid-material3-options",
        message: `Unknown algorithm option: ${entry.key}.`,
        sourceId: "material3",
      });
    }
  }
  if (
    variant !== "tonalSpot" &&
    variant !== "vibrant" &&
    variant !== "expressive" &&
    variant !== "neutral"
  ) {
    issues.push({
      code: "unsupported-variant",
      message: "Unsupported Material 3 variant.",
      sourceId: "material3",
    });
  }
  if (
    typeof contrastLevel !== "number" ||
    !Number.isFinite(contrastLevel) ||
    contrastLevel < -1 ||
    contrastLevel > 1
  ) {
    issues.push({
      code: "invalid-contrast-level",
      message: "contrastLevel must be finite and between -1 and 1.",
      sourceId: "material3",
    });
  }
  if (specVersion !== "2021" && specVersion !== "2025") {
    issues.push({
      code: "unsupported-spec-version",
      message: "Unsupported Material 3 spec version.",
      sourceId: "material3",
    });
  }
  if (platform !== "phone" && platform !== "watch") {
    issues.push({
      code: "unsupported-platform",
      message: "Unsupported Material 3 platform.",
      sourceId: "material3",
    });
  }

  return issues.length === 0
    ? {
        variant: variant as Material3AlgorithmVariant,
        contrastLevel: contrastLevel as number,
        specVersion: specVersion as Material3SpecVersion,
        platform: platform as Material3Platform,
      }
    : undefined;
}

function createMaterialGraph(options: {
  readonly sourceColor: SrgbColor;
  readonly keyColors?: Partial<Record<(typeof keyColorNames)[number], SrgbColor>>;
  readonly algorithm: ResolvedAlgorithm;
}): TokenGraphInput {
  const sourceColorArgb = srgbToArgb(options.sourceColor);
  const keyColorArgbs = createKeyColorArgbs(options.keyColors);
  const materialOptions = {
    sourceColorArgb,
    ...options.algorithm,
    ...(keyColorArgbs === undefined ? {} : { keyColorArgbs }),
  };
  const light = createMaterialScheme({ ...materialOptions, isDark: false });
  const dark = createMaterialScheme({ ...materialOptions, isDark: true });
  const tokens: Record<string, TokenGraphInput["tokens"][string]> = {};

  for (const [tokenKey, sourceRole] of MATERIAL3_ROLES) {
    const lightArgb = readSchemeRoleArgb(light, sourceRole);
    const darkArgb = readSchemeRoleArgb(dark, sourceRole);
    if (lightArgb === undefined || darkArgb === undefined) {
      throw new Error(`Material role missing: ${sourceRole}`);
    }
    defineRecordValue(tokens, tokenKey, {
      valueByMode: {
        light: argbToSrgb(lightArgb),
        dark: argbToSrgb(darkArgb),
      },
    });
  }

  return {
    formatVersion: 1,
    modes: ["light", "dark"],
    defaultMode: "light",
    defaultVisibility: "internal",
    tokens,
  };
}

function createKeyColorArgbs(
  keyColors: Partial<Record<(typeof keyColorNames)[number], SrgbColor>> | undefined,
): Partial<Record<(typeof keyColorNames)[number], number>> | undefined {
  if (keyColors === undefined) return undefined;
  const output: Partial<Record<(typeof keyColorNames)[number], number>> = {};
  for (const name of keyColorNames) {
    const color = keyColors[name];
    if (color !== undefined) output[name] = srgbToArgb(color);
  }
  return Object.keys(output).length === 0 ? undefined : output;
}
