import {
  argbFromHex,
  Hct,
  hexFromArgb,
  SchemeTonalSpot,
  type DynamicScheme,
} from "@material/material-color-utilities";
import type { TokenDefinitionInput, TokenGraphInput, TokenVisibility } from "color-scheme-tokens";
import {
  material3RoleTokenKey,
  MATERIAL3_ROLE_NAMES,
  type Material3RoleName,
} from "./material3-roles";

export const MATERIAL3_ENGINE_PACKAGE = "@material/material-color-utilities";
export const MATERIAL3_ENGINE_VERSION = "0.4.0";

export type Material3Mode = "light" | "dark";

export function createMaterial3Graph(input: {
  readonly sourceColor: string;
  readonly sourceId: string;
  readonly defaultVisibility: TokenVisibility;
}): TokenGraphInput<Material3Mode> {
  const sourceArgb = argbFromHex(input.sourceColor);
  const light = new SchemeTonalSpot(Hct.fromInt(sourceArgb), false, 0);
  const dark = new SchemeTonalSpot(Hct.fromInt(sourceArgb), true, 0);

  return {
    formatVersion: 1,
    modes: ["light", "dark"],
    defaultMode: "light",
    defaultVisibility: input.defaultVisibility,
    tokens: createMaterial3Tokens(input.sourceId, light, dark),
  };
}

function createMaterial3Tokens(
  sourceId: string,
  light: DynamicScheme,
  dark: DynamicScheme,
): Readonly<Record<string, TokenDefinitionInput<Material3Mode>>> {
  const entries = MATERIAL3_ROLE_NAMES.map(
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
  );

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
