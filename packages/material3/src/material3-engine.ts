import { Blend } from "./vendor/material-color-utilities/blend/blend";
import type { SpecVersion } from "./vendor/material-color-utilities/dynamiccolor/color_spec";
import { DynamicScheme } from "./vendor/material-color-utilities/dynamiccolor/dynamic_scheme";
import type { Platform } from "./vendor/material-color-utilities/dynamiccolor/dynamic_scheme";
import { Variant } from "./vendor/material-color-utilities/dynamiccolor/variant";
import { Hct } from "./vendor/material-color-utilities/hct/hct";
import { TonalPalette } from "./vendor/material-color-utilities/palettes/tonal_palette";
import { SchemeCmf } from "./vendor/material-color-utilities/scheme/scheme_cmf";
import { SchemeContent } from "./vendor/material-color-utilities/scheme/scheme_content";
import { SchemeExpressive } from "./vendor/material-color-utilities/scheme/scheme_expressive";
import { SchemeFidelity } from "./vendor/material-color-utilities/scheme/scheme_fidelity";
import { SchemeFruitSalad } from "./vendor/material-color-utilities/scheme/scheme_fruit_salad";
import { SchemeMonochrome } from "./vendor/material-color-utilities/scheme/scheme_monochrome";
import { SchemeNeutral } from "./vendor/material-color-utilities/scheme/scheme_neutral";
import { SchemeRainbow } from "./vendor/material-color-utilities/scheme/scheme_rainbow";
import { SchemeTonalSpot } from "./vendor/material-color-utilities/scheme/scheme_tonal_spot";
import { SchemeVibrant } from "./vendor/material-color-utilities/scheme/scheme_vibrant";
import { argbFromHex, hexFromArgb } from "./vendor/material-color-utilities/utils/string_utils";
import {
  colorTokenGraphKind,
  type ColorTokenDefinitionInput,
  type ColorTokenGraphInput,
  type TokenVisibility,
} from "scheme-tokens";
import {
  material3RoleTokenKey,
  MATERIAL3_ROLE_NAMES,
  type Material3RoleName,
} from "./material3-roles";
import type {
  Material3ExtendedColor,
  Material3PaletteOverrides,
  Material3Platform,
  Material3SpecVersion,
  Material3Variant,
} from "./material3";

export const MATERIAL3_ENGINE_PACKAGE = "material-foundation/material-color-utilities";
export const MATERIAL3_ENGINE_VERSION = "main@6fd88eb3e95ba1d457842e2a2bf847d06b3a018a";

export type Material3Mode = "light" | "dark";

type Material3ExtendedColorRole = "color" | "onColor" | "colorContainer" | "onColorContainer";

type Material3PaletteName =
  | "primary"
  | "secondary"
  | "tertiary"
  | "neutral"
  | "neutralVariant"
  | "error";

type Material3PaletteRecord = Readonly<Record<Material3PaletteName, TonalPalette>>;

type SchemeConstructor = new (
  sourceColorHcts: Hct[],
  isDark: boolean,
  contrastLevel: number,
  specVersion?: SpecVersion,
  platform?: Platform,
) => DynamicScheme;

const MATERIAL3_EXTENDED_COLOR_ROLES = [
  "color",
  "onColor",
  "colorContainer",
  "onColorContainer",
] as const satisfies readonly Material3ExtendedColorRole[];

const OPTIONAL_MATERIAL3_ROLE_NAMES = new Set<Material3RoleName>([
  "primaryDim",
  "secondaryDim",
  "tertiaryDim",
  "errorDim",
]);

const PALETTE_NAMES = [
  "primary",
  "secondary",
  "tertiary",
  "neutral",
  "neutralVariant",
  "error",
] as const satisfies readonly Material3PaletteName[];

const SCHEME_CONSTRUCTORS = {
  monochrome: SchemeMonochrome,
  neutral: SchemeNeutral,
  "tonal-spot": SchemeTonalSpot,
  vibrant: SchemeVibrant,
  expressive: SchemeExpressive,
  fidelity: SchemeFidelity,
  content: SchemeContent,
  rainbow: SchemeRainbow,
  "fruit-salad": SchemeFruitSalad,
  cmf: SchemeCmf,
} as const satisfies Readonly<Record<Material3Variant, SchemeConstructor>>;

const ENGINE_VARIANTS = {
  monochrome: Variant.MONOCHROME,
  neutral: Variant.NEUTRAL,
  "tonal-spot": Variant.TONAL_SPOT,
  vibrant: Variant.VIBRANT,
  expressive: Variant.EXPRESSIVE,
  fidelity: Variant.FIDELITY,
  content: Variant.CONTENT,
  rainbow: Variant.RAINBOW,
  "fruit-salad": Variant.FRUIT_SALAD,
  cmf: Variant.CMF,
} as const satisfies Readonly<Record<Material3Variant, Variant>>;

export function createMaterial3Graph(input: {
  readonly sourceColors: readonly [string, ...string[]];
  readonly sourceId: string;
  readonly defaultVisibility: TokenVisibility;
  readonly variant: Material3Variant;
  readonly contrastLevel: number;
  readonly specVersion: Material3SpecVersion;
  readonly platform: Material3Platform;
  readonly paletteOverrides: Material3PaletteOverrides;
  readonly extendedColors: readonly Material3ExtendedColor[];
  readonly paletteTones: readonly number[] | undefined;
}): ColorTokenGraphInput<Material3Mode> {
  const sourceColorHcts = input.sourceColors.map((color) => Hct.fromInt(argbFromHex(color)));
  const sourceArgb = sourceColorHcts[0]!.toInt();
  const light = createDynamicScheme(input, sourceColorHcts, false);
  const dark = createDynamicScheme(input, sourceColorHcts, true);
  const extendedColors = input.extendedColors.map((color) =>
    createExtendedColorGroup(sourceArgb, color),
  );

  return {
    kind: colorTokenGraphKind,
    formatVersion: 1,
    modes: ["light", "dark"],
    defaultMode: "light",
    defaultVisibility: input.defaultVisibility,
    tokens: createMaterial3Tokens({
      sourceId: input.sourceId,
      light,
      dark,
      extendedColors,
      paletteTones: input.paletteTones,
    }),
  };
}

function createDynamicScheme(
  input: {
    readonly variant: Material3Variant;
    readonly contrastLevel: number;
    readonly specVersion: Material3SpecVersion;
    readonly platform: Material3Platform;
    readonly paletteOverrides: Material3PaletteOverrides;
  },
  sourceColorHcts: readonly Hct[],
  isDark: boolean,
): DynamicScheme {
  const constructor = SCHEME_CONSTRUCTORS[input.variant];
  const base = new constructor(
    [...sourceColorHcts],
    isDark,
    input.contrastLevel,
    input.specVersion,
    input.platform,
  );
  const basePalettes = readPalettes(base);
  const overridePalettes = createPaletteOverrides(input.paletteOverrides);
  if (Object.values(overridePalettes).every((palette) => palette === undefined)) {
    return base;
  }

  return createDynamicSchemeFromOptions({
    sourceColorHcts: [...sourceColorHcts],
    variant: ENGINE_VARIANTS[input.variant],
    contrastLevel: input.contrastLevel,
    isDark,
    platform: input.platform,
    specVersion: base.specVersion,
    primaryPalette: overridePalettes.primary ?? basePalettes.primary,
    secondaryPalette: overridePalettes.secondary ?? basePalettes.secondary,
    tertiaryPalette: overridePalettes.tertiary ?? basePalettes.tertiary,
    neutralPalette: overridePalettes.neutral ?? basePalettes.neutral,
    neutralVariantPalette: overridePalettes.neutralVariant ?? basePalettes.neutralVariant,
    errorPalette: overridePalettes.error ?? basePalettes.error,
  });
}

function createDynamicSchemeFromOptions(args: Readonly<Record<string, unknown>>): DynamicScheme {
  const constructor = DynamicScheme as unknown as {
    new (options: Readonly<Record<string, unknown>>): DynamicScheme;
  };
  return new constructor(args);
}

function createPaletteOverrides(
  paletteOverrides: Material3PaletteOverrides,
): Readonly<Partial<Record<Material3PaletteName, TonalPalette>>> {
  return {
    ...(paletteOverrides.primary === undefined
      ? {}
      : { primary: TonalPalette.fromInt(argbFromHex(paletteOverrides.primary)) }),
    ...(paletteOverrides.secondary === undefined
      ? {}
      : { secondary: TonalPalette.fromInt(argbFromHex(paletteOverrides.secondary)) }),
    ...(paletteOverrides.tertiary === undefined
      ? {}
      : { tertiary: TonalPalette.fromInt(argbFromHex(paletteOverrides.tertiary)) }),
    ...(paletteOverrides.neutral === undefined
      ? {}
      : { neutral: TonalPalette.fromInt(argbFromHex(paletteOverrides.neutral)) }),
    ...(paletteOverrides.neutralVariant === undefined
      ? {}
      : { neutralVariant: TonalPalette.fromInt(argbFromHex(paletteOverrides.neutralVariant)) }),
    ...(paletteOverrides.error === undefined
      ? {}
      : { error: TonalPalette.fromInt(argbFromHex(paletteOverrides.error)) }),
  };
}

function createMaterial3Tokens(input: {
  readonly sourceId: string;
  readonly light: DynamicScheme;
  readonly dark: DynamicScheme;
  readonly extendedColors: readonly Material3ExtendedColorGroup[];
  readonly paletteTones: readonly number[] | undefined;
}): Readonly<Record<string, ColorTokenDefinitionInput<Material3Mode>>> {
  const entries: [string, ColorTokenDefinitionInput<Material3Mode>][] = [];

  for (const role of MATERIAL3_ROLE_NAMES) {
    const light = readRoleHex(input.light, role);
    const dark = readRoleHex(input.dark, role);
    if (light === undefined || dark === undefined) {
      continue;
    }
    entries.push([
      material3RoleTokenKey(input.sourceId, role),
      {
        valueByMode: {
          light: materialColorValue(light),
          dark: materialColorValue(dark),
        },
      },
    ]);
  }

  for (const color of input.extendedColors) {
    for (const role of MATERIAL3_EXTENDED_COLOR_ROLES) {
      entries.push([
        material3ExtendedColorTokenKey(input.sourceId, color.name, role),
        {
          ...(role === "color" && color.description !== undefined
            ? { description: color.description }
            : {}),
          valueByMode: {
            light: materialColorValue(readExtendedColorRoleHex(color.light, role)),
            dark: materialColorValue(readExtendedColorRoleHex(color.dark, role)),
          },
        },
      ]);
    }
  }

  if (input.paletteTones !== undefined) {
    entries.push(
      ...createPaletteToneEntries(input.sourceId, input.light, input.dark, input.paletteTones),
    );
    for (const color of input.extendedColors) {
      entries.push(...createExtendedPaletteToneEntries(input.sourceId, color, input.paletteTones));
    }
  }

  return Object.fromEntries(
    entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
  );
}

function createPaletteToneEntries(
  sourceId: string,
  light: DynamicScheme,
  dark: DynamicScheme,
  tones: readonly number[],
): [string, ColorTokenDefinitionInput<Material3Mode>][] {
  const lightPalettes = readPalettes(light);
  const darkPalettes = readPalettes(dark);

  return PALETTE_NAMES.flatMap((paletteName) =>
    tones.map((tone): [string, ColorTokenDefinitionInput<Material3Mode>] => [
      material3PaletteToneTokenKey(sourceId, paletteName, tone),
      {
        valueByMode: {
          light: materialColorValue(hexFromArgb(lightPalettes[paletteName].tone(tone))),
          dark: materialColorValue(hexFromArgb(darkPalettes[paletteName].tone(tone))),
        },
      },
    ]),
  );
}

function createExtendedPaletteToneEntries(
  sourceId: string,
  color: Material3ExtendedColorGroup,
  tones: readonly number[],
): [string, ColorTokenDefinitionInput<Material3Mode>][] {
  return tones.map((tone) => [
    material3ExtendedPaletteToneTokenKey(sourceId, color.name, tone),
    {
      ...(color.description === undefined ? {} : { description: color.description }),
      valueByMode: {
        light: materialColorValue(hexFromArgb(color.palette.tone(tone))),
        dark: materialColorValue(hexFromArgb(color.palette.tone(tone))),
      },
    },
  ]);
}

function readPalettes(scheme: DynamicScheme): Material3PaletteRecord {
  return {
    primary: scheme.primaryPalette,
    secondary: scheme.secondaryPalette,
    tertiary: scheme.tertiaryPalette,
    neutral: scheme.neutralPalette,
    neutralVariant: scheme.neutralVariantPalette,
    error: scheme.errorPalette,
  };
}

function readRoleHex(scheme: DynamicScheme, role: Material3RoleName): string | undefined {
  const colors = scheme.colors as unknown as Record<string, () => unknown>;
  const colorFactory = colors[role];
  if (typeof colorFactory !== "function") {
    if (OPTIONAL_MATERIAL3_ROLE_NAMES.has(role)) {
      return undefined;
    }
    throw new Error(`MaterialDynamicColors method is unavailable: ${role}`);
  }

  const dynamicColor = colorFactory.call(scheme.colors);
  if (dynamicColor === undefined) {
    if (OPTIONAL_MATERIAL3_ROLE_NAMES.has(role)) {
      return undefined;
    }
    throw new Error(`Material dynamic color is unavailable: ${role}`);
  }
  if (!isDynamicColorLike(dynamicColor)) {
    throw new Error(`Material role did not resolve to a dynamic color: ${role}`);
  }

  const value = dynamicColor.getArgb(scheme);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Material role did not resolve to a finite ARGB number: ${role}`);
  }
  return hexFromArgb(value);
}

interface DynamicColorLike {
  readonly getArgb: (scheme: DynamicScheme) => unknown;
}

function isDynamicColorLike(input: unknown): input is DynamicColorLike {
  return (
    typeof input === "object" &&
    input !== null &&
    "getArgb" in input &&
    typeof input.getArgb === "function"
  );
}

interface Material3ExtendedColorGroup {
  readonly name: string;
  readonly description?: string;
  readonly palette: TonalPalette;
  readonly light: Readonly<Record<Material3ExtendedColorRole, number>>;
  readonly dark: Readonly<Record<Material3ExtendedColorRole, number>>;
}

function createExtendedColorGroup(
  sourceArgb: number,
  color: Material3ExtendedColor,
): Material3ExtendedColorGroup {
  const originalValue = argbFromHex(color.color);
  const value = color.harmonize ? Blend.harmonize(originalValue, sourceArgb) : originalValue;
  const palette = TonalPalette.fromInt(value);

  return {
    name: color.name,
    ...(color.description === undefined ? {} : { description: color.description }),
    palette,
    light: {
      color: palette.tone(40),
      onColor: palette.tone(100),
      colorContainer: palette.tone(90),
      onColorContainer: palette.tone(10),
    },
    dark: {
      color: palette.tone(80),
      onColor: palette.tone(20),
      colorContainer: palette.tone(30),
      onColorContainer: palette.tone(90),
    },
  };
}

function readExtendedColorRoleHex(
  group: Material3ExtendedColorGroup[Material3Mode],
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

function materialColorValue(hex: string): string {
  return hex.toLowerCase();
}

function material3ExtendedColorTokenKey(
  sourceId: string,
  name: string,
  role: Material3ExtendedColorRole,
): string {
  return `${sourceId}.extended.${name}.${camelToLowerKebab(role)}`;
}

function material3PaletteToneTokenKey(
  sourceId: string,
  paletteName: Material3PaletteName,
  tone: number,
): string {
  return `${sourceId}.palette.${camelToLowerKebab(paletteName)}.${toneTokenSegment(tone)}`;
}

function material3ExtendedPaletteToneTokenKey(
  sourceId: string,
  name: string,
  tone: number,
): string {
  return `${sourceId}.extended.${name}.palette.${toneTokenSegment(tone)}`;
}

function camelToLowerKebab(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function toneTokenSegment(tone: number): string {
  return `tone-${String(tone).toLowerCase().replaceAll(".", "-").replaceAll("+", "")}`;
}
