import type { ColorInput, SrgbColor } from "../../core/colorValue";
import { parseColorInput } from "../../core/colorValue";
import { createTokenGraph } from "../../core/createSourceGraph";
import type { Result } from "../../core/graph";
import type { ColorSchemeTokenSource } from "../../core/colorSchemeTokenSource";
import { createMaterial3Values, type Material3ValueProblem } from "./createMaterial3Values";
import { material3RoleSet } from "./material3RoleSet";

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

export interface Material3SrgbKeyColors {
  readonly primary?: SrgbColor;
  readonly secondary?: SrgbColor;
  readonly tertiary?: SrgbColor;
  readonly neutral?: SrgbColor;
  readonly neutralVariant?: SrgbColor;
}

export interface Material3AlgorithmOptions {
  readonly variant?: Material3AlgorithmVariant;
  readonly contrastLevel?: number;
  readonly specVersion?: Material3SpecVersion;
  readonly platform?: Material3Platform;
}

export interface Material3SourceOptions {
  readonly color: ColorInput;
  readonly keyColors?: Material3KeyColors;
  readonly algorithm?: Material3AlgorithmOptions;
}

export interface Material3ResolvedAlgorithmOptions {
  readonly variant: Material3AlgorithmVariant;
  readonly contrastLevel: number;
  readonly specVersion: Material3SpecVersion;
  readonly platform: Material3Platform;
}

export interface Material3OptionProblem {
  readonly kind:
    | "unsupported-variant"
    | "invalid-contrast-level"
    | "unsupported-spec-version"
    | "unsupported-platform";
  readonly message: string;
  readonly sourceId?: string;
  readonly path?: string;
}

export type Material3SourceProblem = Material3ValueProblem | Material3OptionProblem;

export function material3Source(
  options: Material3SourceOptions,
): ColorSchemeTokenSource<Material3SourceProblem> {
  return {
    id: material3RoleSet.sourceId,
    roleSet: material3RoleSet,
    createGraph() {
      const resolvedAlgorithm = resolveAlgorithmOptions(options.algorithm);
      if (!resolvedAlgorithm.ok) return resolvedAlgorithm;

      const sourceColor = normalizeMaterial3Color(options.color, "color", "source");
      if (!sourceColor.ok) return sourceColor;

      const keyColors = normalizeMaterial3KeyColors(options.keyColors);
      if (!keyColors.ok) return keyColors;

      const values = createMaterial3Values({
        sourceColor: sourceColor.value,
        algorithm: resolvedAlgorithm.value,
        ...(keyColors.value === undefined ? {} : { keyColors: keyColors.value }),
      });

      if (!values.ok) return values;

      return {
        ok: true,
        value: createTokenGraph({
          tokens: values.value,
        }),
      };
    },
  };
}

function normalizeMaterial3KeyColors(
  keyColors: Material3KeyColors | undefined,
): Result<Material3SrgbKeyColors | undefined, Material3ValueProblem> {
  if (keyColors === undefined) return { ok: true, value: undefined };

  const normalized: Partial<Record<keyof Material3KeyColors, SrgbColor>> = {};
  const problems: Material3ValueProblem[] = [];

  for (const name of material3KeyColorNames) {
    const color = keyColors[name];
    if (color === undefined) continue;

    const result = normalizeMaterial3Color(color, `keyColors.${name}`, "key");
    if (result.ok) {
      normalized[name] = result.value;
    } else {
      problems.push(...result.problems);
    }
  }

  return problems.length === 0 ? { ok: true, value: normalized } : { ok: false, problems };
}

function normalizeMaterial3Color(
  input: ColorInput,
  path: string,
  usage: "source" | "key",
): Result<SrgbColor, Material3ValueProblem> {
  const result = parseColorInput(input, path);
  if (!result.ok) {
    return {
      ok: false,
      problems: result.problems.map((problem) => ({
        kind: "invalid-color-input",
        message: problem.message,
        sourceId: material3RoleSet.sourceId,
        ...(problem.path === undefined ? {} : { path: problem.path }),
      })),
    };
  }

  const color = result.value;
  const problems: Material3ValueProblem[] = [];
  if (color.colorSpace !== "srgb") {
    problems.push({
      kind: usage === "source" ? "unsupported-source-color" : "unsupported-key-color",
      message:
        usage === "source"
          ? "material3Source currently accepts only sRGB source colors."
          : "Material 3 key colors currently accept only sRGB colors.",
      sourceId: material3RoleSet.sourceId,
      path: `${path}.colorSpace`,
    });
  }

  if (color.alpha !== 1) {
    problems.push({
      kind: "unsupported-alpha",
      message:
        usage === "source"
          ? "material3Source requires color alpha to be 1."
          : "Material 3 key colors must be opaque.",
      sourceId: material3RoleSet.sourceId,
      path: `${path}.alpha`,
    });
  }

  return problems.length === 0 ? { ok: true, value: color as SrgbColor } : { ok: false, problems };
}

const material3KeyColorNames = [
  "primary",
  "secondary",
  "tertiary",
  "neutral",
  "neutralVariant",
] as const satisfies readonly (keyof Material3KeyColors)[];

const material3AlgorithmDefaults: Material3ResolvedAlgorithmOptions = {
  specVersion: "2021",
  platform: "phone",
  contrastLevel: 0,
  variant: "tonalSpot",
};

function resolveAlgorithmOptions(
  options: Material3AlgorithmOptions = {},
): Result<Material3ResolvedAlgorithmOptions, Material3OptionProblem> {
  const problems: Material3OptionProblem[] = [];
  const variant = options.variant ?? material3AlgorithmDefaults.variant;
  const specVersion = options.specVersion ?? material3AlgorithmDefaults.specVersion;
  const platform = options.platform ?? material3AlgorithmDefaults.platform;
  const contrastLevel = options.contrastLevel ?? material3AlgorithmDefaults.contrastLevel;

  if (!["tonalSpot", "vibrant", "expressive", "neutral"].includes(variant)) {
    problems.push({
      kind: "unsupported-variant",
      message: `Unsupported Material 3 algorithm variant: ${String(variant)}.`,
      sourceId: material3RoleSet.sourceId,
      path: "algorithm.variant",
    });
  }

  if (!Number.isFinite(contrastLevel) || contrastLevel < -1 || contrastLevel > 1) {
    problems.push({
      kind: "invalid-contrast-level",
      message: "contrastLevel must be a finite number between -1 and 1.",
      sourceId: material3RoleSet.sourceId,
      path: "algorithm.contrastLevel",
    });
  }

  if (!["2021", "2025"].includes(specVersion)) {
    problems.push({
      kind: "unsupported-spec-version",
      message: `Unsupported Material 3 spec version: ${String(specVersion)}.`,
      sourceId: material3RoleSet.sourceId,
      path: "algorithm.specVersion",
    });
  }

  if (!["phone", "watch"].includes(platform)) {
    problems.push({
      kind: "unsupported-platform",
      message: `Unsupported Material 3 platform: ${String(platform)}.`,
      sourceId: material3RoleSet.sourceId,
      path: "algorithm.platform",
    });
  }

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    value: {
      variant,
      specVersion,
      platform,
      contrastLevel,
    },
  };
}
