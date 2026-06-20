import type {
  ColorTokenGraphInput,
  ColorTokenSource,
  Issue,
  Result,
  TokenVisibility,
} from "scheme-tokens";
import {
  createMaterial3Graph,
  MATERIAL3_ENGINE_PACKAGE,
  MATERIAL3_ENGINE_VERSION,
} from "./material3-engine";
import { readPlainRecord } from "./plain-record";
import { describeUnknown } from "./safe-description";

export const material3Variants = [
  "monochrome",
  "neutral",
  "tonal-spot",
  "vibrant",
  "expressive",
  "fidelity",
  "content",
  "rainbow",
  "fruit-salad",
  "cmf",
] as const;

export const material3SpecVersions = ["2021", "2025", "2026"] as const;

export const material3Platforms = ["phone", "watch"] as const;

export type Material3Variant = (typeof material3Variants)[number];
export type Material3SpecVersion = (typeof material3SpecVersions)[number];
export type Material3Platform = (typeof material3Platforms)[number];
export type Material3SourceColorsInput = string | readonly string[];

export interface Material3PaletteOverridesInput {
  readonly primary?: string;
  readonly secondary?: string;
  readonly tertiary?: string;
  readonly neutral?: string;
  readonly neutralVariant?: string;
  readonly error?: string;
}

export interface Material3ExtendedColorInput {
  readonly name: string;
  readonly color: string;
  readonly harmonize?: boolean;
  readonly description?: string;
}

export interface Material3Input {
  readonly sourceColors: Material3SourceColorsInput;
  readonly variant?: Material3Variant;
  readonly contrastLevel?: number;
  readonly specVersion?: Material3SpecVersion;
  readonly platform?: Material3Platform;
  readonly palettes?: Material3PaletteOverridesInput;
  readonly extendedColors?: readonly Material3ExtendedColorInput[];
  readonly paletteTones?: true | readonly number[];
}

export type Material3GenerationOptions = Omit<Material3Input, "sourceColors">;

export interface Material3IntegrationOptions {
  readonly id?: string;
  readonly defaultVisibility?: TokenVisibility;
}

export interface Material3Preset {
  (
    sourceColors: Material3SourceColorsInput,
    generationOptions?: Material3GenerationOptions,
  ): ColorTokenSource<Material3Issue>;
  (input: Material3Input): ColorTokenSource<Material3Issue>;
}

type Material3ColorField =
  | "sourceColors"
  | "extendedColors.color"
  | `palettes.${Material3PaletteName}`;

export type Material3Issue =
  | (Issue<"material3-invalid-input"> & {
      readonly receivedType: string;
    })
  | (Issue<"material3-invalid-source-colors"> & {
      readonly field: "sourceColors";
      readonly receivedType?: string;
    })
  | (Issue<"material3-unsupported-color-input"> & {
      readonly field: Material3ColorField;
      readonly receivedType?: string;
      readonly value?: string;
    })
  | (Issue<"material3-invalid-variant"> & {
      readonly receivedType?: string;
      readonly value?: string;
    })
  | (Issue<"material3-invalid-contrast-level"> & {
      readonly receivedType?: string;
      readonly value?: number;
    })
  | (Issue<"material3-invalid-spec-version"> & {
      readonly receivedType?: string;
      readonly value?: string;
    })
  | (Issue<"material3-invalid-platform"> & {
      readonly receivedType?: string;
      readonly value?: string;
    })
  | (Issue<"material3-invalid-id"> & {
      readonly receivedType?: string;
      readonly value?: string;
    })
  | (Issue<"material3-invalid-default-visibility"> & {
      readonly receivedType?: string;
      readonly value?: string;
    })
  | (Issue<"material3-invalid-palettes"> & {
      readonly receivedType?: string;
    })
  | (Issue<"material3-invalid-extended-colors"> & {
      readonly receivedType?: string;
    })
  | (Issue<"material3-invalid-extended-color"> & {
      readonly receivedType?: string;
    })
  | (Issue<"material3-invalid-extended-color-name"> & {
      readonly receivedType?: string;
      readonly value?: string;
    })
  | (Issue<"material3-duplicate-extended-color-name"> & {
      readonly value: string;
    })
  | (Issue<"material3-unsupported-extended-color-input"> & {
      readonly receivedType?: string;
      readonly value?: string;
    })
  | (Issue<"material3-invalid-extended-color-harmonize"> & {
      readonly receivedType: string;
    })
  | (Issue<"material3-invalid-extended-color-description"> & {
      readonly receivedType: string;
    })
  | (Issue<"material3-invalid-palette-tones"> & {
      readonly receivedType?: string;
    })
  | (Issue<"material3-invalid-palette-tone"> & {
      readonly receivedType?: string;
      readonly value?: number;
    })
  | (Issue<"material3-duplicate-palette-tone"> & {
      readonly value: number;
    })
  | (Issue<"material3-engine-failed"> & {
      readonly enginePackage: typeof MATERIAL3_ENGINE_PACKAGE;
      readonly engineVersion: typeof MATERIAL3_ENGINE_VERSION;
      readonly causeMessage?: string;
    });

export interface Material3ExtendedColor {
  readonly name: string;
  readonly color: string;
  readonly harmonize: boolean;
  readonly description?: string;
}

type Material3PaletteName =
  | "primary"
  | "secondary"
  | "tertiary"
  | "neutral"
  | "neutralVariant"
  | "error";

export type Material3PaletteOverrides = Readonly<Partial<Record<Material3PaletteName, string>>>;

interface ParsedMaterial3Input {
  readonly sourceColors: readonly [string, ...string[]] | undefined;
  readonly variant: Material3Variant;
  readonly contrastLevel: number;
  readonly specVersion: Material3SpecVersion;
  readonly platform: Material3Platform;
  readonly palettes: Material3PaletteOverrides;
  readonly extendedColors: readonly Material3ExtendedColor[];
  readonly paletteTones: readonly number[] | undefined;
  readonly issues: readonly Material3Issue[];
}

interface ParsedMaterial3IntegrationOptions {
  readonly sourceId: string;
  readonly defaultVisibility: TokenVisibility;
  readonly issues: readonly Material3Issue[];
}

const defaultSourceId = "material3";
const defaultVisibility = "public";
const defaultVariant: Material3Variant = "tonal-spot";
const defaultContrastLevel = 0;
const defaultSpecVersion: Material3SpecVersion = "2021";
const defaultPlatform: Material3Platform = "phone";
const strictHexPattern = /^#[0-9a-fA-F]{6}$/;
const sourceIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const defaultPaletteTones = [
  0, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100,
] as const;

const material3InputKeys = new Set([
  "sourceColors",
  "variant",
  "contrastLevel",
  "specVersion",
  "platform",
  "palettes",
  "extendedColors",
  "paletteTones",
]);

const material3OptionalGenerationOptionKeys = new Set([
  "variant",
  "contrastLevel",
  "specVersion",
  "platform",
  "palettes",
  "extendedColors",
  "paletteTones",
]);

const material3IntegrationOptionKeys = new Set(["id", "defaultVisibility"]);

const paletteKeys = new Set<Material3PaletteName>([
  "primary",
  "secondary",
  "tertiary",
  "neutral",
  "neutralVariant",
  "error",
]);

interface NormalizedMaterial3Arguments {
  readonly input: Material3Input;
  readonly options: unknown;
}

export function material3(
  input: Material3Input,
  options?: Material3IntegrationOptions,
): ColorTokenSource<Material3Issue>;
export function material3(
  sourceColors: Material3SourceColorsInput,
  generationOptions?: Material3GenerationOptions,
  integrationOptions?: Material3IntegrationOptions,
): ColorTokenSource<Material3Issue>;
export function material3(
  inputOrSourceColors: Material3Input | Material3SourceColorsInput,
  optionsOrGenerationOptions?: Material3IntegrationOptions | Material3GenerationOptions,
  integrationOptions?: Material3IntegrationOptions,
): ColorTokenSource<Material3Issue> {
  const normalized = normalizeMaterial3Arguments(
    inputOrSourceColors,
    optionsOrGenerationOptions,
    integrationOptions,
  );
  const parsedInput = parseMaterial3Input(normalized.input);
  const parsedOptions = parseMaterial3IntegrationOptions(normalized.options);

  return {
    id: parsedOptions.sourceId,
    build(): Result<ColorTokenGraphInput, Material3Issue> {
      const issues = [...parsedInput.issues, ...parsedOptions.issues];
      if (issues.length > 0) {
        return fail(issues);
      }
      if (parsedInput.sourceColors === undefined) {
        return fail([
          {
            code: "material3-invalid-source-colors",
            message: "sourceColors is required.",
            field: "sourceColors",
            path: "/sourceColors",
          },
        ]);
      }

      try {
        return {
          ok: true,
          value: createMaterial3Graph({
            sourceColors: parsedInput.sourceColors,
            sourceId: parsedOptions.sourceId,
            defaultVisibility: parsedOptions.defaultVisibility,
            variant: parsedInput.variant,
            contrastLevel: parsedInput.contrastLevel,
            specVersion: parsedInput.specVersion,
            platform: parsedInput.platform,
            palettes: parsedInput.palettes,
            extendedColors: parsedInput.extendedColors,
            paletteTones: parsedInput.paletteTones,
          }),
        };
      } catch (cause) {
        return fail([
          {
            code: "material3-engine-failed",
            message: "The Material 3 engine failed while generating a token graph.",
            enginePackage: MATERIAL3_ENGINE_PACKAGE,
            engineVersion: MATERIAL3_ENGINE_VERSION,
            ...describeCaughtCause(cause),
          },
        ]);
      }
    },
  };
}

export function material3Preset(
  generationDefaults: Material3GenerationOptions = {},
  integrationOptions?: Material3IntegrationOptions,
): Material3Preset {
  const preparedDefaults = copyMaterial3InputValue(
    generationDefaults,
  ) as Material3GenerationOptions;
  const preparedIntegrationOptions =
    integrationOptions === undefined
      ? undefined
      : (copyMaterial3InputValue(integrationOptions) as Material3IntegrationOptions);

  const preset: Material3Preset = (
    inputOrSourceColors: Material3Input | Material3SourceColorsInput,
    generationOptions?: Material3GenerationOptions,
  ): ColorTokenSource<Material3Issue> => {
    if (isSourceColorsShorthand(inputOrSourceColors)) {
      return material3(
        inputOrSourceColors,
        mergeMaterial3GenerationOptions(preparedDefaults, generationOptions),
        preparedIntegrationOptions,
      );
    }

    return material3(
      mergeMaterial3Input(preparedDefaults, inputOrSourceColors),
      preparedIntegrationOptions,
    );
  };

  return Object.freeze(preset);
}

function mergeMaterial3GenerationOptions(
  defaults: Material3GenerationOptions,
  runtimeOptions: Material3GenerationOptions | undefined,
): Material3GenerationOptions {
  if (runtimeOptions === undefined) {
    return copyMaterial3InputValue(defaults) as Material3GenerationOptions;
  }
  return mergeDefinedMaterial3RuntimeOptions(
    defaults,
    runtimeOptions,
  ) as Material3GenerationOptions;
}

function mergeMaterial3Input(
  defaults: Material3GenerationOptions,
  input: Material3Input,
): Material3Input {
  return mergeDefinedMaterial3RuntimeOptions(defaults, input) as Material3Input;
}

function mergeDefinedMaterial3RuntimeOptions(
  defaults: Material3GenerationOptions,
  runtimeInput: Material3GenerationOptions | Material3Input,
): Material3GenerationOptions | Material3Input {
  const merged: Record<string, unknown> = {
    ...(copyMaterial3InputValue(defaults) as Material3GenerationOptions),
  };
  const copiedRuntimeInput = copyMaterial3InputValue(runtimeInput);
  const runtimeEntries = readPlainRecord(copiedRuntimeInput);
  if (!runtimeEntries.ok) {
    return {
      ...merged,
      ...(copiedRuntimeInput as Material3GenerationOptions | Material3Input),
    };
  }

  for (const entry of runtimeEntries.value) {
    if (material3OptionalGenerationOptionKeys.has(entry.key) && entry.value === undefined) {
      continue;
    }
    Object.defineProperty(merged, entry.key, {
      value: entry.value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return merged;
}

function copyMaterial3InputValue(input: unknown): unknown {
  return copyMaterial3InputValueInternal(input, new Set());
}

function copyMaterial3InputValueInternal(input: unknown, seen: Set<object>): unknown {
  if (
    input === null ||
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    return input;
  }

  if (Array.isArray(input)) {
    if (seen.has(input)) {
      return input;
    }
    seen.add(input);
    const output = input.map((value) => copyMaterial3InputValueInternal(value, seen));
    seen.delete(input);
    return Object.freeze(output);
  }

  if (typeof input === "object") {
    if (seen.has(input)) {
      return input;
    }

    const entries = readPlainRecord(input);
    if (!entries.ok) {
      return input;
    }

    seen.add(input);
    const output: Record<string, unknown> = {};
    for (const entry of entries.value) {
      Object.defineProperty(output, entry.key, {
        value: copyMaterial3InputValueInternal(entry.value, seen),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    seen.delete(input);
    return Object.freeze(output);
  }

  return input;
}

function normalizeMaterial3Arguments(
  inputOrSourceColors: Material3Input | Material3SourceColorsInput,
  optionsOrGenerationOptions: Material3IntegrationOptions | Material3GenerationOptions | undefined,
  integrationOptions: Material3IntegrationOptions | undefined,
): NormalizedMaterial3Arguments {
  if (isSourceColorsShorthand(inputOrSourceColors)) {
    return {
      input: {
        sourceColors: inputOrSourceColors,
        ...optionsOrGenerationOptions,
      },
      options: integrationOptions,
    };
  }

  return {
    input: inputOrSourceColors,
    options: optionsOrGenerationOptions,
  };
}

function isSourceColorsShorthand(input: unknown): input is Material3SourceColorsInput {
  return typeof input === "string" || Array.isArray(input);
}

function parseMaterial3Input(input: unknown): ParsedMaterial3Input {
  const entries = readPlainRecord(input);
  if (!entries.ok) {
    return {
      sourceColors: undefined,
      variant: defaultVariant,
      contrastLevel: defaultContrastLevel,
      specVersion: defaultSpecVersion,
      platform: defaultPlatform,
      palettes: {},
      extendedColors: [],
      paletteTones: undefined,
      issues: [entries.issue],
    };
  }

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const issues: Material3Issue[] = [];
  const sourceColors = normalizeSourceColors(
    record.get("sourceColors"),
    record.has("sourceColors"),
    issues,
  );
  const variant = parseVariant(
    record.get("variant"),
    hasDefinedRecordValue(record, "variant"),
    issues,
  );
  const contrastLevel = parseContrastLevel(
    record.get("contrastLevel"),
    hasDefinedRecordValue(record, "contrastLevel"),
    issues,
  );
  const specVersion = parseSpecVersion(
    record.get("specVersion"),
    hasDefinedRecordValue(record, "specVersion"),
    issues,
  );
  const platform = parsePlatform(
    record.get("platform"),
    hasDefinedRecordValue(record, "platform"),
    issues,
  );
  const palettes = parsePalettes(
    record.get("palettes"),
    hasDefinedRecordValue(record, "palettes"),
    issues,
  );
  const extendedColors = parseExtendedColors(
    record.get("extendedColors"),
    hasDefinedRecordValue(record, "extendedColors"),
    issues,
  );
  const paletteTones = parsePaletteTones(
    record.get("paletteTones"),
    hasDefinedRecordValue(record, "paletteTones"),
    issues,
  );

  if (variant === "cmf" && specVersion !== "2026") {
    issues.push({
      code: "material3-invalid-spec-version",
      message: 'variant "cmf" requires specVersion "2026".',
      path: "/specVersion",
      value: specVersion,
    });
  }

  for (const entry of entries.value) {
    if (!material3InputKeys.has(entry.key)) {
      issues.push({
        code: "material3-invalid-input",
        message: `Unknown material3 input property: ${entry.key}.`,
        path: `/${jsonPointerSegment(entry.key)}`,
        receivedType: describeUnknown(entry.value),
      });
    }
  }

  return {
    sourceColors,
    variant,
    contrastLevel,
    specVersion,
    platform,
    palettes,
    extendedColors,
    paletteTones,
    issues,
  };
}

function parseMaterial3IntegrationOptions(options: unknown): ParsedMaterial3IntegrationOptions {
  if (options === undefined) {
    return {
      sourceId: defaultSourceId,
      defaultVisibility,
      issues: [],
    };
  }

  const entries = readPlainRecord(options);
  if (!entries.ok) {
    return {
      sourceId: defaultSourceId,
      defaultVisibility,
      issues: [entries.issue],
    };
  }

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const issues: Material3Issue[] = [];
  const sourceId = parseSourceId(record.get("id"), hasDefinedRecordValue(record, "id"), issues);
  const visibility = parseDefaultVisibility(
    record.get("defaultVisibility"),
    hasDefinedRecordValue(record, "defaultVisibility"),
    issues,
  );

  for (const entry of entries.value) {
    if (!material3IntegrationOptionKeys.has(entry.key)) {
      issues.push({
        code: "material3-invalid-input",
        message: `Unknown material3 integration option: ${entry.key}.`,
        path: `/${jsonPointerSegment(entry.key)}`,
        receivedType: describeUnknown(entry.value),
      });
    }
  }

  return {
    sourceId,
    defaultVisibility: visibility,
    issues,
  };
}

function parseSourceId(value: unknown, hasValue: boolean, issues: Material3Issue[]): string {
  if (!hasValue) {
    return defaultSourceId;
  }
  if (typeof value === "string" && sourceIdPattern.test(value)) {
    return value;
  }
  issues.push({
    code: "material3-invalid-id",
    message: "id must be a lower-kebab single segment.",
    path: "/id",
    ...(typeof value === "string" ? { value } : { receivedType: describeUnknown(value) }),
  });
  return defaultSourceId;
}

function parseDefaultVisibility(
  value: unknown,
  hasValue: boolean,
  issues: Material3Issue[],
): TokenVisibility {
  if (!hasValue) {
    return defaultVisibility;
  }
  if (value === "public" || value === "internal") {
    return value;
  }
  issues.push({
    code: "material3-invalid-default-visibility",
    message: "defaultVisibility must be public or internal.",
    path: "/defaultVisibility",
    ...(typeof value === "string" ? { value } : { receivedType: describeUnknown(value) }),
  });
  return defaultVisibility;
}

function normalizeSourceColors(
  value: unknown,
  hasValue: boolean,
  issues: Material3Issue[],
): readonly [string, ...string[]] | undefined {
  if (!hasValue) {
    issues.push({
      code: "material3-invalid-source-colors",
      message: "sourceColors is required.",
      field: "sourceColors",
      path: "/sourceColors",
    });
    return undefined;
  }

  if (typeof value === "string") {
    const color = parseHexColor(value, "/sourceColors", "sourceColors", issues);
    return color === undefined ? undefined : [color];
  }

  if (!Array.isArray(value)) {
    issues.push({
      code: "material3-invalid-source-colors",
      message: "sourceColors must be a #rrggbb string or a non-empty array of #rrggbb strings.",
      field: "sourceColors",
      path: "/sourceColors",
      receivedType: describeUnknown(value),
    });
    return undefined;
  }

  let items: readonly unknown[];
  try {
    items = [...value];
  } catch {
    issues.push({
      code: "material3-invalid-source-colors",
      message: "sourceColors must be a #rrggbb string or a non-empty array of #rrggbb strings.",
      field: "sourceColors",
      path: "/sourceColors",
      receivedType: describeUnknown(value),
    });
    return undefined;
  }

  if (items.length === 0) {
    issues.push({
      code: "material3-invalid-source-colors",
      message: "sourceColors must contain at least one color.",
      field: "sourceColors",
      path: "/sourceColors",
    });
    return undefined;
  }

  const colors: string[] = [];
  for (const [index, item] of items.entries()) {
    const color = parseHexColor(item, `/sourceColors/${index}`, "sourceColors", issues);
    if (color !== undefined) {
      colors.push(color);
    }
  }
  return colors.length === items.length ? (colors as [string, ...string[]]) : undefined;
}

function parseVariant(
  value: unknown,
  hasValue: boolean,
  issues: Material3Issue[],
): Material3Variant {
  if (!hasValue) {
    return defaultVariant;
  }
  if (typeof value === "string" && (material3Variants as readonly string[]).includes(value)) {
    return value as Material3Variant;
  }
  issues.push({
    code: "material3-invalid-variant",
    message: `variant must be one of: ${material3Variants.join(", ")}.`,
    path: "/variant",
    ...(typeof value === "string" ? { value } : { receivedType: describeUnknown(value) }),
  });
  return defaultVariant;
}

function parseContrastLevel(value: unknown, hasValue: boolean, issues: Material3Issue[]): number {
  if (!hasValue) {
    return defaultContrastLevel;
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= -1 && value <= 1) {
    return value;
  }
  issues.push({
    code: "material3-invalid-contrast-level",
    message: "contrastLevel must be a finite number from -1 through 1.",
    path: "/contrastLevel",
    ...(typeof value === "number" && Number.isFinite(value)
      ? { value }
      : { receivedType: describeUnknown(value) }),
  });
  return defaultContrastLevel;
}

function parseSpecVersion(
  value: unknown,
  hasValue: boolean,
  issues: Material3Issue[],
): Material3SpecVersion {
  if (!hasValue) {
    return defaultSpecVersion;
  }
  if (typeof value === "string" && (material3SpecVersions as readonly string[]).includes(value)) {
    return value as Material3SpecVersion;
  }
  issues.push({
    code: "material3-invalid-spec-version",
    message: `specVersion must be one of: ${material3SpecVersions.join(", ")}.`,
    path: "/specVersion",
    ...(typeof value === "string" ? { value } : { receivedType: describeUnknown(value) }),
  });
  return defaultSpecVersion;
}

function parsePlatform(
  value: unknown,
  hasValue: boolean,
  issues: Material3Issue[],
): Material3Platform {
  if (!hasValue) {
    return defaultPlatform;
  }
  if (typeof value === "string" && (material3Platforms as readonly string[]).includes(value)) {
    return value as Material3Platform;
  }
  issues.push({
    code: "material3-invalid-platform",
    message: `platform must be one of: ${material3Platforms.join(", ")}.`,
    path: "/platform",
    ...(typeof value === "string" ? { value } : { receivedType: describeUnknown(value) }),
  });
  return defaultPlatform;
}

function parsePalettes(
  value: unknown,
  hasValue: boolean,
  issues: Material3Issue[],
): Material3PaletteOverrides {
  if (!hasValue) {
    return {};
  }

  const entries = readPlainRecord(value);
  if (!entries.ok) {
    issues.push({
      code: "material3-invalid-palettes",
      message: "palettes must be a JSON-safe plain object.",
      path: "/palettes",
      receivedType:
        "receivedType" in entries.issue ? entries.issue.receivedType : describeUnknown(value),
    });
    return {};
  }

  const palettes: Partial<Record<Material3PaletteName, string>> = {};
  for (const entry of entries.value) {
    if (!paletteKeys.has(entry.key as Material3PaletteName)) {
      issues.push({
        code: "material3-invalid-input",
        message: `Unknown material3 palettes property: ${entry.key}.`,
        path: `/palettes/${jsonPointerSegment(entry.key)}`,
        receivedType: describeUnknown(entry.value),
      });
      continue;
    }
    const paletteName = entry.key as Material3PaletteName;
    if (entry.value === undefined) {
      continue;
    }
    const color = parseHexColor(
      entry.value,
      `/palettes/${jsonPointerSegment(entry.key)}`,
      `palettes.${paletteName}`,
      issues,
    );
    if (color !== undefined) {
      palettes[paletteName] = color;
    }
  }
  return palettes;
}

function parseExtendedColors(
  value: unknown,
  hasValue: boolean,
  issues: Material3Issue[],
): readonly Material3ExtendedColor[] {
  if (!hasValue) {
    return [];
  }
  if (!Array.isArray(value)) {
    issues.push({
      code: "material3-invalid-extended-colors",
      message: "extendedColors must be an array.",
      path: "/extendedColors",
      receivedType: describeUnknown(value),
    });
    return [];
  }

  let items: readonly unknown[];
  try {
    items = [...value];
  } catch {
    issues.push({
      code: "material3-invalid-extended-colors",
      message: "extendedColors must be an array.",
      path: "/extendedColors",
      receivedType: describeUnknown(value),
    });
    return [];
  }

  const colors: Material3ExtendedColor[] = [];
  const seenNames = new Set<string>();
  for (const [index, item] of items.entries()) {
    const color = parseExtendedColor(item, index, issues);
    if (color === undefined) {
      continue;
    }
    if (seenNames.has(color.name)) {
      issues.push({
        code: "material3-duplicate-extended-color-name",
        message: `Duplicate extended color name: ${color.name}.`,
        path: `/extendedColors/${index}/name`,
        value: color.name,
      });
      continue;
    }
    seenNames.add(color.name);
    colors.push(color);
  }
  return colors;
}

function parseExtendedColor(
  input: unknown,
  index: number,
  issues: Material3Issue[],
): Material3ExtendedColor | undefined {
  const path = `/extendedColors/${index}`;
  const entries = readPlainRecord(input);
  if (!entries.ok) {
    issues.push({
      code: "material3-invalid-extended-color",
      message: "extendedColors entries must be JSON-safe plain objects.",
      path,
      receivedType:
        "receivedType" in entries.issue ? entries.issue.receivedType : describeUnknown(input),
    });
    return undefined;
  }

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const name = parseExtendedColorName(record.get("name"), record.has("name"), path, issues);
  const color = parseExtendedColorValue(record.get("color"), record.has("color"), path, issues);
  const harmonize = parseExtendedColorHarmonize(
    record.get("harmonize"),
    hasDefinedRecordValue(record, "harmonize"),
    path,
    issues,
  );
  const description = parseExtendedColorDescription(
    record.get("description"),
    hasDefinedRecordValue(record, "description"),
    path,
    issues,
  );

  for (const entry of entries.value) {
    if (
      entry.key !== "name" &&
      entry.key !== "color" &&
      entry.key !== "harmonize" &&
      entry.key !== "description"
    ) {
      issues.push({
        code: "material3-invalid-input",
        message: `Unknown material3 extendedColors entry property: ${entry.key}.`,
        path: `${path}/${jsonPointerSegment(entry.key)}`,
        receivedType: describeUnknown(entry.value),
      });
    }
  }

  if (
    name === undefined ||
    color === undefined ||
    harmonize === undefined ||
    description === null
  ) {
    return undefined;
  }
  return {
    name,
    color,
    harmonize,
    ...(description === undefined ? {} : { description }),
  };
}

function parseExtendedColorName(
  value: unknown,
  hasValue: boolean,
  path: string,
  issues: Material3Issue[],
): string | undefined {
  if (!hasValue) {
    issues.push({
      code: "material3-invalid-extended-color-name",
      message: "extended color name is required.",
      path: `${path}/name`,
    });
    return undefined;
  }
  if (typeof value !== "string") {
    issues.push({
      code: "material3-invalid-extended-color-name",
      message: "extended color name must be a lower-kebab single segment.",
      path: `${path}/name`,
      receivedType: describeUnknown(value),
    });
    return undefined;
  }
  if (!sourceIdPattern.test(value)) {
    issues.push({
      code: "material3-invalid-extended-color-name",
      message: "extended color name must be a lower-kebab single segment.",
      path: `${path}/name`,
      value,
    });
    return undefined;
  }
  return value;
}

function parseExtendedColorValue(
  value: unknown,
  hasValue: boolean,
  path: string,
  issues: Material3Issue[],
): string | undefined {
  if (!hasValue) {
    issues.push({
      code: "material3-unsupported-extended-color-input",
      message: "extended color color is required.",
      path: `${path}/color`,
    });
    return undefined;
  }
  return parseHexColor(value, `${path}/color`, "extendedColors.color", issues);
}

function parseExtendedColorHarmonize(
  value: unknown,
  hasValue: boolean,
  path: string,
  issues: Material3Issue[],
): boolean | undefined {
  if (!hasValue) {
    return true;
  }
  if (typeof value === "boolean") {
    return value;
  }
  issues.push({
    code: "material3-invalid-extended-color-harmonize",
    message: "extended color harmonize must be a boolean.",
    path: `${path}/harmonize`,
    receivedType: describeUnknown(value),
  });
  return undefined;
}

function parseExtendedColorDescription(
  value: unknown,
  hasValue: boolean,
  path: string,
  issues: Material3Issue[],
): string | undefined | null {
  if (!hasValue) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  issues.push({
    code: "material3-invalid-extended-color-description",
    message: "extended color description must be a string.",
    path: `${path}/description`,
    receivedType: describeUnknown(value),
  });
  return null;
}

function parsePaletteTones(
  value: unknown,
  hasValue: boolean,
  issues: Material3Issue[],
): readonly number[] | undefined {
  if (!hasValue) {
    return undefined;
  }
  if (value === true) {
    return defaultPaletteTones;
  }
  if (!Array.isArray(value)) {
    issues.push({
      code: "material3-invalid-palette-tones",
      message: "paletteTones must be true or an array of numbers from 0 through 100.",
      path: "/paletteTones",
      receivedType: describeUnknown(value),
    });
    return undefined;
  }

  let items: readonly unknown[];
  try {
    items = [...value];
  } catch {
    issues.push({
      code: "material3-invalid-palette-tones",
      message: "paletteTones must be true or an array of numbers from 0 through 100.",
      path: "/paletteTones",
      receivedType: describeUnknown(value),
    });
    return undefined;
  }

  const tones: number[] = [];
  const seen = new Set<number>();
  for (const [index, item] of items.entries()) {
    if (typeof item !== "number" || !Number.isFinite(item) || item < 0 || item > 100) {
      issues.push({
        code: "material3-invalid-palette-tone",
        message: "palette tone must be a finite number from 0 through 100.",
        path: `/paletteTones/${index}`,
        ...(typeof item === "number" && Number.isFinite(item)
          ? { value: item }
          : { receivedType: describeUnknown(item) }),
      });
      continue;
    }
    if (seen.has(item)) {
      issues.push({
        code: "material3-duplicate-palette-tone",
        message: `Duplicate palette tone: ${item}.`,
        path: `/paletteTones/${index}`,
        value: item,
      });
      continue;
    }
    seen.add(item);
    tones.push(item);
  }
  return tones;
}

function parseHexColor(
  value: unknown,
  path: string,
  field: Material3ColorField,
  issues: Material3Issue[],
): string | undefined {
  if (typeof value !== "string") {
    issues.push({
      code: "material3-unsupported-color-input",
      message: `${field} currently supports strict #rrggbb hex strings only.`,
      field,
      path,
      receivedType: describeUnknown(value),
    });
    return undefined;
  }
  if (!strictHexPattern.test(value)) {
    issues.push({
      code: "material3-unsupported-color-input",
      message: `${field} currently supports strict #rrggbb hex strings only.`,
      field,
      path,
      value,
    });
    return undefined;
  }
  return value.toLowerCase();
}

function jsonPointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function hasDefinedRecordValue(record: ReadonlyMap<string, unknown>, key: string): boolean {
  return record.has(key) && record.get(key) !== undefined;
}

function describeCaughtCause(cause: unknown): { readonly causeMessage?: string } {
  if (cause instanceof Error) {
    try {
      return { causeMessage: truncateCauseMessage(cause.message || cause.name || "Error") };
    } catch {
      return { causeMessage: "Error" };
    }
  }
  if (typeof cause === "string") {
    return { causeMessage: truncateCauseMessage(cause) };
  }
  return { causeMessage: describeUnknown(cause) };
}

function truncateCauseMessage(message: string): string {
  return message.length <= 240 ? message : `${message.slice(0, 237)}...`;
}

function fail(issues: readonly Material3Issue[]): Result<never, Material3Issue> {
  if (issues.length === 0) {
    throw new Error("Expected at least one Material 3 source issue.");
  }
  return { ok: false, issues: issues as [Material3Issue, ...Material3Issue[]] };
}
