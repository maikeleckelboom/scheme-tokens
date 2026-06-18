import type { SrgbColor } from "../../core/colorValue";
import { validateColorValue } from "../../core/colorValue";
import { literalColor } from "../../core/colorTokenValue";
import type { ModeValue, Result, TokenNode } from "../../core/graph";
import { darkMode, lightMode } from "../../core/modes";
import type { DynamicSchemeResolvedOptions } from "./dynamicSchemeSource";
import { dynamicColorRoleSet } from "./dynamicColorRoleSet";
import { argbToSrgb, srgbToArgb } from "./internal/argb";
import { createMaterialBackedScheme, readSchemeRoleArgb } from "./internal/materialDynamicScheme";

export interface DynamicSchemeValueOptions {
  readonly sourceColor: SrgbColor;
  readonly resolvedOptions: DynamicSchemeResolvedOptions;
}

export interface DynamicSchemeValueProblem {
  readonly kind:
    | "unsupported-source-color"
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

export type DynamicSchemeValueResult = Result<readonly TokenNode[], DynamicSchemeValueProblem>;

export function createDynamicSchemeValues(
  options: DynamicSchemeValueOptions,
): DynamicSchemeValueResult {
  const inputProblems = validateInput(options.sourceColor);
  if (inputProblems.length > 0) return { ok: false, problems: inputProblems };

  const sourceColorArgb = srgbToArgb(options.sourceColor);
  const lightScheme = createMaterialBackedScheme({
    sourceColorArgb,
    isDark: false,
    ...options.resolvedOptions,
  });
  const darkScheme = createMaterialBackedScheme({
    sourceColorArgb,
    isDark: true,
    ...options.resolvedOptions,
  });
  const tokens: TokenNode[] = [];
  const problems: DynamicSchemeValueProblem[] = [];

  for (const role of dynamicColorRoleSet.roles) {
    const lightValue = readSchemeRoleArgb(lightScheme, role.sourceRole);
    const darkValue = readSchemeRoleArgb(darkScheme, role.sourceRole);

    if (lightValue === undefined || darkValue === undefined) {
      if (role.required) {
        for (const mode of [lightMode, darkMode]) {
          const value = mode === lightMode ? lightValue : darkValue;
          if (value !== undefined) continue;
          problems.push({
            kind: "missing-required-role",
            message: `Dynamic source did not generate required role ${role.sourceRole} for ${String(mode)} mode.`,
            sourceId: dynamicColorRoleSet.sourceId,
            role: role.sourceRole,
            mode: String(mode),
          });
        }
      } else if (lightValue !== darkValue) {
        problems.push({
          kind: "asymmetric-optional-role",
          message: `Optional dynamic role ${role.sourceRole} must be present in both modes or neither mode.`,
          sourceId: dynamicColorRoleSet.sourceId,
          role: role.sourceRole,
        });
      }
      continue;
    }

    const values: ModeValue<ReturnType<typeof literalColor>>[] = [
      { mode: lightMode, value: literalColor(argbToSrgb(lightValue)) },
      { mode: darkMode, value: literalColor(argbToSrgb(darkValue)) },
    ];

    for (const entry of values) {
      const colorProblems = validateColorValue(entry.value.value, `role.${role.sourceRole}`);
      for (const problem of colorProblems) {
        problems.push({
          kind: "invalid-generated-color",
          message: problem.message,
          sourceId: dynamicColorRoleSet.sourceId,
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
        source: dynamicColorRoleSet.sourceId,
        id: role.sourceRole,
      },
    });
  }

  return problems.length === 0 ? { ok: true, value: tokens } : { ok: false, problems };
}

function validateInput(sourceColor: SrgbColor): readonly DynamicSchemeValueProblem[] {
  const problems: DynamicSchemeValueProblem[] = [];

  if (sourceColor.colorSpace !== "srgb") {
    problems.push({
      kind: "unsupported-source-color",
      message: "dynamicSchemeSource currently accepts only sRGB source colors.",
      sourceId: dynamicColorRoleSet.sourceId,
      path: "sourceColor.colorSpace",
    });
    return problems;
  }

  for (const problem of validateColorValue(sourceColor, "sourceColor")) {
    problems.push({
      kind: "unsupported-source-color",
      message: problem.message,
      sourceId: dynamicColorRoleSet.sourceId,
      ...(problem.path === undefined ? {} : { path: problem.path }),
    });
  }

  if (sourceColor.alpha !== 1) {
    problems.push({
      kind: "unsupported-alpha",
      message: "dynamicSchemeSource requires sourceColor alpha to be 1.",
      sourceId: dynamicColorRoleSet.sourceId,
      path: "sourceColor.alpha",
    });
  }

  return problems;
}
