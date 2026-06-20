import {
  argbFromHex,
  Hct,
  hexFromArgb,
  SchemeTonalSpot,
  themeFromSourceColor,
  type CustomColorGroup,
  type DynamicScheme,
} from "@material/material-color-utilities";
import type { TokenDefinitionInput, TokenGraphInput, TokenVisibility } from "color-scheme-tokens";
import {
  material3RoleTokenKey,
  MATERIAL3_ROLE_NAMES,
  type Material3RoleName,
} from "./material3-roles";
import type { Material3ExtendedColor } from "./material3-source";

export const MATERIAL3_ENGINE_PACKAGE = "@material/material-color-utilities";
export const MATERIAL3_ENGINE_VERSION = "0.4.0";

export type Material3Mode = "light" | "dark";
type Material3ExtendedColorRole = "color" | "onColor" | "colorContainer" | "onColorContainer";

const MATERIAL3_EXTENDED_COLOR_ROLES = [
  "color",
  "onColor",
  "colorContainer",
  "onColorContainer",
] as const satisfies readonly Material3ExtendedColorRole[];

export function createMaterial3Graph(input: {
  readonly sourceColor: string;
  readonly sourceId: string;
  readonly defaultVisibility: TokenVisibility;
  readonly extendedColors: readonly Material3ExtendedColor[];
}): TokenGraphInput<Material3Mode> {
  const sourceArgb = argbFromHex(input.sourceColor);
  const light = new SchemeTonalSpot(Hct.fromInt(sourceArgb), false, 0);
  const dark = new SchemeTonalSpot(Hct.fromInt(sourceArgb), true, 0);
  const extendedColors =
    input.extendedColors.length === 0
      ? []
      : themeFromSourceColor(
          sourceArgb,
          input.extendedColors.map((color) => ({
            name: color.name,
            value: argbFromHex(color.color),
            blend: color.harmonize,
          })),
        ).customColors;

  return {
    formatVersion: 1,
    modes: ["light", "dark"],
    defaultMode: "light",
    defaultVisibility: input.defaultVisibility,
    tokens: createMaterial3Tokens(input.sourceId, light, dark, extendedColors),
  };
}

function createMaterial3Tokens(
  sourceId: string,
  light: DynamicScheme,
  dark: DynamicScheme,
  extendedColors: readonly CustomColorGroup[],
): Readonly<Record<string, TokenDefinitionInput<Material3Mode>>> {
  const entries = [
    ...MATERIAL3_ROLE_NAMES.map(
      (role) =>
        [
          material3RoleTokenKey(sourceId, role),
          {
            valueByMode: {
              light: readRoleHex(light, role),
              dark: readRoleHex(dark, role),
            },
          },
        ] as const,
    ),
    ...extendedColors.flatMap((color) =>
      MATERIAL3_EXTENDED_COLOR_ROLES.map(
        (role) =>
          [
            material3ExtendedColorTokenKey(sourceId, color.color.name, role),
            {
              valueByMode: {
                light: readExtendedColorRoleHex(color.light, role),
                dark: readExtendedColorRoleHex(color.dark, role),
              },
            },
          ] as const,
      ),
    ),
  ];

  return Object.fromEntries(
    entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
  );
}

function readRoleHex(scheme: DynamicScheme, role: Material3RoleName): string {
  const value = scheme[role];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Material role did not resolve to a finite ARGB number: ${role}`);
  }
  return hexFromArgb(value);
}

function readExtendedColorRoleHex(
  group: CustomColorGroup[Material3Mode],
  role: Material3ExtendedColorRole,
): string {
  const value = group[role];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `Material extended color role did not resolve to a finite ARGB number: ${role}`,
    );
  }
  return hexFromArgb(value);
}

function material3ExtendedColorTokenKey(
  sourceId: string,
  name: string,
  role: Material3ExtendedColorRole,
): string {
  return `${sourceId}.extended.${name}.${extendedColorRoleToLowerKebab(role)}`;
}

function extendedColorRoleToLowerKebab(role: string): string {
  return role.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
