import {
  Hct,
  MaterialDynamicColors,
  SchemeContent,
  SchemeExpressive,
  SchemeFidelity,
  SchemeFruitSalad,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeRainbow,
  SchemeTonalSpot,
  SchemeVibrant,
  argbFromHex,
  hexFromArgb,
  type DynamicScheme,
} from "@material/material-color-utilities";
import { material3RoleDefinitions, type Material3EngineMethod } from "./role-catalog";
import type {
  Material3Appearance,
  Material3SpecVersion,
  Material3TokenKey,
  Material3Variant,
} from "./types/material3";

export interface Material3EngineCoordinate {
  readonly sourceColor: string;
  readonly appearance: Material3Appearance;
  readonly variant: Material3Variant;
  readonly specVersion: Material3SpecVersion;
  readonly contrastLevel: number;
}

const variantConstructors = {
  monochrome: SchemeMonochrome,
  neutral: SchemeNeutral,
  "tonal-spot": SchemeTonalSpot,
  vibrant: SchemeVibrant,
  expressive: SchemeExpressive,
  fidelity: SchemeFidelity,
  content: SchemeContent,
  rainbow: SchemeRainbow,
  "fruit-salad": SchemeFruitSalad,
} as const;

export function generateMaterial3Mode(
  coordinate: Material3EngineCoordinate,
): Readonly<Record<Material3TokenKey, string>> {
  const scheme = createMaterial3Scheme(coordinate);
  if (scheme.specVersion !== coordinate.specVersion) {
    throw new Error(
      `Material Color Utilities did not honor requested spec ${coordinate.specVersion} for ${coordinate.variant}.`,
    );
  }

  const colors = new MaterialDynamicColors();
  // The catalog is the finite authority. The loop fills every catalog key and
  // the count check below rejects any incomplete construction before return.
  const output = {} as Record<Material3TokenKey, string>;
  for (const definition of material3RoleDefinitions) {
    const role = readAcceptedRole(colors, definition.engineMethod);
    const value = hexFromArgb(scheme.getArgb(role)).toLowerCase();
    if (!/^#[0-9a-f]{6}$/u.test(value)) {
      throw new Error(
        `Material Color Utilities returned a noncanonical value for ${definition.engineMethod}.`,
      );
    }
    output[definition.tokenKey] = value;
  }

  if (Object.keys(output).length !== material3RoleDefinitions.length) {
    throw new Error("Material Color Utilities did not produce all accepted Material roles.");
  }
  return output;
}

export function createMaterial3Scheme(coordinate: Material3EngineCoordinate): DynamicScheme {
  const Scheme = variantConstructors[coordinate.variant];
  return new Scheme(
    Hct.fromInt(argbFromHex(coordinate.sourceColor)),
    coordinate.appearance === "dark",
    coordinate.contrastLevel,
    coordinate.specVersion,
    "phone",
  );
}

function readAcceptedRole(colors: MaterialDynamicColors, method: Material3EngineMethod) {
  const role = colors[method]();
  if (role === undefined) {
    throw new Error(`MaterialDynamicColors.${method}() returned undefined.`);
  }
  return role;
}
