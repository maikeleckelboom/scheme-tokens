import { defineTokenGraph, defineTokenLayer, type TokenVisibility } from "scheme-tokens";
import { generateMaterial3Mode } from "./engine";
import { material3RoleDefinitions } from "./role-catalog";
import type {
  Material3AdditiveModeOptions,
  Material3Appearance,
  Material3ExactModeOptions,
  Material3GraphFragment,
  Material3SpecVersion,
  Material3TokenKey,
  Material3Variant,
} from "./types/material3";

const optionKeys = new Set([
  "specVersion",
  "variant",
  "contrastLevel",
  "visibility",
  "modes",
  "exactModes",
  "defaultMode",
]);
const modeOptionKeys = new Set(["appearance", "sourceColor", "variant", "contrastLevel"]);
const variants = new Set<string>([
  "monochrome",
  "neutral",
  "tonal-spot",
  "vibrant",
  "expressive",
  "fidelity",
  "content",
  "rainbow",
  "fruit-salad",
]);
const supported2025Variants = new Set<Material3Variant>([
  "neutral",
  "tonal-spot",
  "vibrant",
  "expressive",
]);

interface ModeOverrides {
  readonly appearance?: Material3Appearance;
  readonly sourceColor?: string;
  readonly variant?: Material3Variant;
  readonly contrastLevel?: number;
}

interface ParsedOptions {
  readonly specVersion: Material3SpecVersion;
  readonly variant: Material3Variant;
  readonly contrastLevel: number;
  readonly visibility: TokenVisibility;
  readonly modes: readonly [string, ...string[]];
  readonly defaultMode: string;
  readonly overridesByMode: ReadonlyMap<string, ModeOverrides>;
}

interface RecordEntry {
  readonly key: string;
  readonly value: unknown;
}

export function material3<const Mode extends string>(
  sourceColor: string,
  options: Material3ExactModeOptions<Mode>,
): Material3GraphFragment<Mode>;
export function material3<const Extra extends string = never>(
  sourceColor: string,
  options?: Material3AdditiveModeOptions<Extra>,
): Material3GraphFragment<"light" | "dark" | Extra>;
export function material3(sourceColor: string, options?: unknown): Material3GraphFragment<string> {
  const canonicalSource = normalizeSourceColor(sourceColor, "sourceColor");
  const parsed = parseOptions(options);
  const tokens = generateTokenDefinitions(canonicalSource, parsed);
  const layer = defineTokenLayer({
    id: "material3",
    defaultVisibility: parsed.visibility,
    tokens,
  });
  const completed = defineTokenGraph({
    modes: parsed.modes,
    defaultMode: parsed.defaultMode,
    tokens: {},
    layers: [layer],
  });
  const validatedLayer = completed.layers?.[0];
  if (validatedLayer === undefined) {
    throw new Error("Core validation did not preserve the generated Material layer.");
  }

  return {
    modes: completed.modes,
    defaultMode: completed.defaultMode,
    layers: [validatedLayer],
  };
}

function parseOptions(input: unknown): ParsedOptions {
  const entries = input === undefined ? [] : readDataRecord(input, "material3 options");
  rejectUnknownKeys(entries, optionKeys, "material3 options");
  const record = new Map(entries.map((entry) => [entry.key, entry.value]));
  const hasModes = record.has("modes");
  const hasExactModes = record.has("exactModes");
  if (hasModes && hasExactModes) {
    throw new RangeError("material3 options cannot combine modes and exactModes.");
  }

  const modeEntries = hasExactModes
    ? readDataRecord(record.get("exactModes"), "material3 exactModes")
    : hasModes
      ? readDataRecord(record.get("modes"), "material3 modes")
      : [];
  if (hasExactModes && modeEntries.length === 0) {
    throw new TypeError("material3 exactModes must contain at least one mode.");
  }

  const candidateModes = hasExactModes
    ? modeEntries.map((entry) => entry.key)
    : [
        "light",
        "dark",
        ...modeEntries
          .map((entry) => entry.key)
          .filter((mode) => mode !== "light" && mode !== "dark"),
      ];
  if (!isNonEmpty(candidateModes)) {
    throw new TypeError("material3 requires at least one mode.");
  }

  const hasDefaultMode = record.has("defaultMode");
  if (hasExactModes && !hasDefaultMode) {
    throw new TypeError("material3 exactModes require an explicit defaultMode.");
  }
  const defaultModeInput = hasDefaultMode ? record.get("defaultMode") : "light";
  if (typeof defaultModeInput !== "string") {
    throw new TypeError("material3 defaultMode must be a string.");
  }

  // Core owns mode grammar, reserved names, default membership, and canonical ordering.
  const envelope = defineTokenGraph({
    modes: candidateModes,
    defaultMode: defaultModeInput,
    tokens: {},
  });
  const overridesByMode = new Map<string, ModeOverrides>();
  for (const entry of modeEntries) {
    overridesByMode.set(entry.key, parseModeOverrides(entry.key, entry.value));
  }

  return {
    specVersion: readSpecVersion(record),
    variant: readVariant(record, "variant", "tonal-spot"),
    contrastLevel: readContrast(record, "contrastLevel", 0),
    visibility: readVisibility(record),
    modes: envelope.modes,
    defaultMode: envelope.defaultMode,
    overridesByMode,
  };
}

function parseModeOverrides(mode: string, input: unknown): ModeOverrides {
  const entries = readDataRecord(input, `material3 mode "${mode}"`);
  rejectUnknownKeys(entries, modeOptionKeys, `material3 mode "${mode}"`);
  const record = new Map(entries.map((entry) => [entry.key, entry.value]));
  const builtInAppearance = mode === "light" || mode === "dark";
  if (builtInAppearance && record.has("appearance")) {
    throw new RangeError(`material3 mode "${mode}" must not declare redundant appearance.`);
  }
  if (!builtInAppearance && !record.has("appearance")) {
    throw new TypeError(`material3 mode "${mode}" requires appearance.`);
  }

  return {
    ...(builtInAppearance
      ? {}
      : { appearance: normalizeAppearance(record.get("appearance"), mode) }),
    ...(record.has("sourceColor")
      ? {
          sourceColor: normalizeSourceColor(
            record.get("sourceColor"),
            `mode "${mode}" sourceColor`,
          ),
        }
      : {}),
    ...(record.has("variant")
      ? { variant: normalizeVariant(record.get("variant"), `mode "${mode}" variant`) }
      : {}),
    ...(record.has("contrastLevel")
      ? {
          contrastLevel: normalizeContrast(
            record.get("contrastLevel"),
            `mode "${mode}" contrastLevel`,
          ),
        }
      : {}),
  };
}

function generateTokenDefinitions(
  sourceColor: string,
  options: ParsedOptions,
): Readonly<Record<Material3TokenKey, Readonly<Record<string, string>>>> {
  // Every catalog entry is initialized before generation and Stage 2 sends the
  // completed maps through core, which rejects missing or unknown mode values.
  const output = {} as Record<Material3TokenKey, Record<string, string>>;
  for (const definition of material3RoleDefinitions) {
    output[definition.tokenKey] = {};
  }

  for (const mode of options.modes) {
    const overrides = options.overridesByMode.get(mode);
    const variant = overrides?.variant ?? options.variant;
    if (options.specVersion === "2025" && !supported2025Variants.has(variant)) {
      throw new RangeError(
        `material3 mode "${mode}" requests unsupported 2025 variant "${variant}".`,
      );
    }
    const values = generateMaterial3Mode({
      sourceColor: overrides?.sourceColor ?? sourceColor,
      appearance:
        mode === "light" || mode === "dark" ? mode : requireAppearance(overrides?.appearance, mode),
      variant,
      specVersion: options.specVersion,
      contrastLevel: overrides?.contrastLevel ?? options.contrastLevel,
    });
    for (const definition of material3RoleDefinitions) {
      output[definition.tokenKey][mode] = values[definition.tokenKey];
    }
  }
  return output;
}

function readSpecVersion(record: ReadonlyMap<string, unknown>): Material3SpecVersion {
  if (!record.has("specVersion")) {
    return "2021";
  }
  const value = record.get("specVersion");
  if (value !== "2021" && value !== "2025") {
    throw new RangeError("material3 specVersion must be 2021 or 2025.");
  }
  return value;
}

function readVariant(
  record: ReadonlyMap<string, unknown>,
  key: string,
  fallback: Material3Variant,
): Material3Variant {
  return record.has(key) ? normalizeVariant(record.get(key), `material3 ${key}`) : fallback;
}

function normalizeVariant(input: unknown, label: string): Material3Variant {
  if (typeof input !== "string" || !isMaterial3Variant(input)) {
    throw new RangeError(`${label} is not a supported Material variant.`);
  }
  return input;
}

function isMaterial3Variant(input: string): input is Material3Variant {
  return variants.has(input);
}

function readContrast(record: ReadonlyMap<string, unknown>, key: string, fallback: number): number {
  return record.has(key) ? normalizeContrast(record.get(key), `material3 ${key}`) : fallback;
}

function normalizeContrast(input: unknown, label: string): number {
  if (typeof input !== "number") {
    throw new TypeError(`${label} must be a number.`);
  }
  if (!Number.isFinite(input) || input < -1 || input > 1) {
    throw new RangeError(`${label} must be finite and within [-1, 1].`);
  }
  return Object.is(input, -0) ? 0 : input;
}

function readVisibility(record: ReadonlyMap<string, unknown>): TokenVisibility {
  if (!record.has("visibility")) {
    return "public";
  }
  const value = record.get("visibility");
  if (value !== "public" && value !== "internal") {
    throw new RangeError("material3 visibility must be public or internal.");
  }
  return value;
}

function normalizeAppearance(input: unknown, mode: string): Material3Appearance {
  if (input !== "light" && input !== "dark") {
    throw new RangeError(`material3 mode "${mode}" appearance must be light or dark.`);
  }
  return input;
}

function requireAppearance(
  appearance: Material3Appearance | undefined,
  mode: string,
): Material3Appearance {
  if (appearance === undefined) {
    throw new Error(`Validated custom mode "${mode}" lost its appearance.`);
  }
  return appearance;
}

function normalizeSourceColor(input: unknown, label: string): string {
  if (typeof input !== "string") {
    throw new TypeError(`material3 ${label} must be a string.`);
  }
  if (!/^#[0-9a-fA-F]{6}$/u.test(input)) {
    throw new RangeError(`material3 ${label} must match #[0-9a-fA-F]{6}.`);
  }
  return input.toLowerCase();
}

function readDataRecord(input: unknown, label: string): readonly RecordEntry[] {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError(`${label} must be a plain object.`);
  }

  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(input);
    descriptors = Object.getOwnPropertyDescriptors(input);
  } catch {
    throw new TypeError(`${label} must be readable plain data.`);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object.`);
  }

  const entries: RecordEntry[] = [];
  for (const key of Object.keys(descriptors).sort(compareCodeUnits)) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !descriptor.enumerable) {
      continue;
    }
    if (!("value" in descriptor)) {
      throw new TypeError(`${label} must contain data properties only.`);
    }
    entries.push({ key, value: descriptor.value });
  }
  return entries;
}

function rejectUnknownKeys(
  entries: readonly RecordEntry[],
  allowed: ReadonlySet<string>,
  label: string,
): void {
  const unknown = entries.find((entry) => !allowed.has(entry.key));
  if (unknown !== undefined) {
    throw new RangeError(`${label} contains unknown property "${unknown.key}".`);
  }
}

function isNonEmpty<Value>(values: readonly Value[]): values is readonly [Value, ...Value[]] {
  return values.length > 0;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
