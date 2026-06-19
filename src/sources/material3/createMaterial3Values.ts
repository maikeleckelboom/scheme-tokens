import type { SrgbColor } from "../../core/colorValue";
import { validateColorValue } from "../../core/colorValue";
import type { ModeValueInput, Result, TokenNodeInput } from "../../core/graph";
import { darkMode, lightMode } from "../../core/modes";
import type { Material3ResolvedAlgorithmOptions, Material3SrgbKeyColors } from "./material3Source";
import { material3RoleSet } from "./material3RoleSet";
import { argbToSrgb, srgbToArgb } from "./internal/argb";
import { createMaterialBackedScheme, readSchemeRoleArgb } from "./internal/materialDynamicScheme";

export interface Material3ValueOptions {
  readonly sourceColor: SrgbColor;
  readonly keyColors?: Material3SrgbKeyColors;
  readonly algorithm: Material3ResolvedAlgorithmOptions;
}

export interface Material3ValueProblem {
  readonly kind:
    | "unsupported-source-color"
    | "unsupported-key-color"
    | "invalid-color-input"
    | "unsupported-alpha"
    | "invalid-contrast-level"
    | "missing-required-role"
    | "asymmetric-optional-role"
    | "invalid-generated-color";
  readonly message: string;
  readonly sourceId?: string;
  readonly role?: string;
  readonly mode?: string;
  readonly path?: string;
}

export type Material3ValueResult = Result<readonly TokenNodeInput[], Material3ValueProblem>;

export function createMaterial3Values(options: Material3ValueOptions): Material3ValueResult {
  const inputProblems = validateSourceInput(options.sourceColor);
  const keyColorProblems = validateKeyColors(options.keyColors);
  if (inputProblems.length > 0 || keyColorProblems.length > 0) {
    return { ok: false, problems: [...inputProblems, ...keyColorProblems] };
  }

  const sourceColorArgb = srgbToArgb(options.sourceColor);
  const keyColorArgbs = createKeyColorArgbs(options.keyColors);
  const materialOptions = {
    sourceColorArgb,
    ...options.algorithm,
    ...(keyColorArgbs === undefined ? {} : { keyColorArgbs }),
  };
  const lightScheme = createMaterialBackedScheme({
    ...materialOptions,
    isDark: false,
  });
  const darkScheme = createMaterialBackedScheme({
    ...materialOptions,
    isDark: true,
  });
  const tokens: TokenNodeInput[] = [];
  const problems: Material3ValueProblem[] = [];

  for (const role of material3RoleSet.roles) {
    const lightValue = readSchemeRoleArgb(lightScheme, role.sourceRole);
    const darkValue = readSchemeRoleArgb(darkScheme, role.sourceRole);

    if (lightValue === undefined || darkValue === undefined) {
      if (role.required) {
        for (const mode of [lightMode, darkMode]) {
          const value = mode === lightMode ? lightValue : darkValue;
          if (value !== undefined) continue;
          problems.push({
            kind: "missing-required-role",
            message: `Material 3 source did not generate required role ${role.sourceRole} for ${String(mode)} mode.`,
            sourceId: material3RoleSet.sourceId,
            role: role.sourceRole,
            mode: String(mode),
          });
        }
      } else if (lightValue !== darkValue) {
        problems.push({
          kind: "asymmetric-optional-role",
          message: `Optional Material 3 role ${role.sourceRole} must be present in both modes or neither mode.`,
          sourceId: material3RoleSet.sourceId,
          role: role.sourceRole,
        });
      }
      continue;
    }

    const values: ModeValueInput<SrgbColor>[] = [
      { mode: lightMode, value: argbToSrgb(lightValue) },
      { mode: darkMode, value: argbToSrgb(darkValue) },
    ];

    for (const entry of values) {
      const colorProblems = validateColorValue(entry.value, `role.${role.sourceRole}`);
      for (const problem of colorProblems) {
        problems.push({
          kind: "invalid-generated-color",
          message: problem.message,
          sourceId: material3RoleSet.sourceId,
          role: role.sourceRole,
          mode: String(entry.mode),
          ...(problem.path === undefined ? {} : { path: problem.path }),
        });
      }
    }

    tokens.push({
      kind: "color",
      key: role.key,
      values,
      provenance: {
        source: material3RoleSet.sourceId,
        id: role.sourceRole,
      },
    });
  }

  return problems.length === 0 ? { ok: true, value: tokens } : { ok: false, problems };
}

function validateSourceInput(sourceColor: SrgbColor): readonly Material3ValueProblem[] {
  const problems: Material3ValueProblem[] = [];

  if (sourceColor.colorSpace !== "srgb") {
    problems.push({
      kind: "unsupported-source-color",
      message: "material3Source currently accepts only sRGB source colors.",
      sourceId: material3RoleSet.sourceId,
      path: "sourceColor.colorSpace",
    });
    return problems;
  }

  for (const problem of validateColorValue(sourceColor, "sourceColor")) {
    problems.push({
      kind: "unsupported-source-color",
      message: problem.message,
      sourceId: material3RoleSet.sourceId,
      ...(problem.path === undefined ? {} : { path: problem.path }),
    });
  }

  if (sourceColor.alpha !== 1) {
    problems.push({
      kind: "unsupported-alpha",
      message: "material3Source requires sourceColor alpha to be 1.",
      sourceId: material3RoleSet.sourceId,
      path: "sourceColor.alpha",
    });
  }

  return problems;
}

function validateKeyColors(
  keyColors: Material3SrgbKeyColors | undefined,
): readonly Material3ValueProblem[] {
  if (keyColors === undefined) return [];

  const problems: Material3ValueProblem[] = [];
  for (const keyColorName of material3KeyColorNames) {
    const color = keyColors[keyColorName];
    if (color === undefined) continue;

    const path = `keyColors.${keyColorName}`;
    if (color.colorSpace !== "srgb") {
      problems.push({
        kind: "unsupported-key-color",
        message: "Material 3 key colors currently accept only sRGB colors.",
        sourceId: material3RoleSet.sourceId,
        path: `${path}.colorSpace`,
      });
      continue;
    }

    for (const problem of validateColorValue(color, path)) {
      problems.push({
        kind: "unsupported-key-color",
        message: problem.message,
        sourceId: material3RoleSet.sourceId,
        ...(problem.path === undefined ? {} : { path: problem.path }),
      });
    }

    if (color.alpha !== 1) {
      problems.push({
        kind: "unsupported-alpha",
        message: "Material 3 key colors must be opaque.",
        sourceId: material3RoleSet.sourceId,
        path: `${path}.alpha`,
      });
    }
  }

  return problems;
}

function createKeyColorArgbs(
  keyColors: Material3SrgbKeyColors | undefined,
): Material3KeyColorArgbs | undefined {
  if (keyColors === undefined) return undefined;

  const keyColorArgbs: Material3KeyColorArgbs = {};
  for (const keyColorName of material3KeyColorNames) {
    const color = keyColors[keyColorName];
    if (color === undefined) continue;
    keyColorArgbs[keyColorName] = srgbToArgb(color);
  }

  return Object.keys(keyColorArgbs).length === 0 ? undefined : keyColorArgbs;
}

const material3KeyColorNames = [
  "primary",
  "secondary",
  "tertiary",
  "neutral",
  "neutralVariant",
] as const satisfies readonly (keyof Material3SrgbKeyColors)[];

export type Material3KeyColorArgbs = Partial<
  Record<(typeof material3KeyColorNames)[number], number>
>;
