import {
  defineTokenGraph,
  defineTokenLayer,
  type TokenLayer,
  type TokenVisibility,
} from "scheme-tokens";
import { generateMaterial3Mode, type Material3EngineCoordinate } from "./engine";
import { material3RoleDefinitions } from "./role-catalog";
import type {
  Material3ColorMode,
  Material3Options,
  Material3SpecVersion,
  Material3TokenKey,
  Material3Variant,
} from "./types/material3";

const optionKeys = new Set(["specVersion", "variant", "contrastLevel", "visibility", "modes"]);
const modeOptionKeys = new Set(["colorMode", "sourceColor", "variant", "contrastLevel"]);
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

interface ParsedOptions {
  readonly visibility: TokenVisibility;
  readonly coordinatesByMode: ReadonlyMap<string, Material3EngineCoordinate>;
}

interface RecordEntry {
  readonly key: string;
  readonly value: unknown;
}

export function material3(
  sourceColor: string,
  options?: undefined,
): TokenLayer<
  Material3TokenKey,
  Material3ColorMode,
  {
    readonly default: "public";
    readonly public: never;
    readonly internal: never;
    readonly omitted: Material3TokenKey;
  }
>;
export function material3<
  const Mode extends string = Material3ColorMode,
  const Visibility extends TokenVisibility = "public",
>(
  sourceColor: string,
  options: Material3Options<Mode, Visibility>,
): TokenLayer<
  Material3TokenKey,
  NoInfer<Mode>,
  {
    readonly default: NoInfer<Visibility>;
    readonly public: never;
    readonly internal: never;
    readonly omitted: Material3TokenKey;
  }
>;
export function material3(sourceColor: string, options?: unknown): TokenLayer {
  const canonicalSource = normalizeSourceColor(sourceColor, "sourceColor");
  const parsed = parseOptions(canonicalSource, options);
  const layer = defineTokenLayer({
    id: "material3",
    defaultVisibility: parsed.visibility,
    tokens: generateTokenDefinitions(parsed.coordinatesByMode),
  });
  // The overloads require the settings behind every precise mode/default claim.
  // The catalog supplies exactly 48 keys, with preflighted mode maps and omitted
  // declaration visibility. Return the real core-validated layer without a cast.
  return layer;
}

function parseOptions(sourceColor: string, input: unknown): ParsedOptions {
  const entries = input === undefined ? [] : readDataRecord(input, "material3 options");
  rejectUnknownKeys(entries, optionKeys, "material3 options");
  const record = new Map(entries.map((entry) => [entry.key, entry.value]));
  const modeEntries = record.has("modes")
    ? readDataRecord(record.get("modes"), "material3 modes")
    : [
        { key: "light", value: {} },
        { key: "dark", value: {} },
      ];
  const candidateModes = modeEntries.map((entry) => entry.key);
  if (!isNonEmpty(candidateModes)) {
    throw new TypeError("material3 modes must contain at least one mode.");
  }

  // Only core owns mode-name grammar. This empty envelope validates names before
  // generation, never generated tokens; its order/default are not adapter output.
  // Structural errors propagate unchanged, including the complete issue-tuple cause.
  defineTokenGraph({ modes: candidateModes, defaultMode: candidateModes[0], tokens: {} });

  const specVersion = readSpecVersion(record);
  const variant = readVariant(record, "variant", "tonal-spot");
  const contrastLevel = readContrast(record, "contrastLevel", 0);
  const visibility = readVisibility(record);
  const coordinatesByMode = new Map<string, Material3EngineCoordinate>();
  for (const { key: mode, value } of modeEntries) {
    const overrides = readDataRecord(value, `material3 mode "${mode}"`);
    rejectUnknownKeys(overrides, modeOptionKeys, `material3 mode "${mode}"`);
    const settings = new Map(overrides.map((entry) => [entry.key, entry.value]));
    const builtIn = mode === "light" || mode === "dark";
    if (builtIn && settings.has("colorMode")) {
      throw new RangeError(`material3 mode "${mode}" must not declare redundant colorMode.`);
    }
    if (!builtIn && !settings.has("colorMode")) {
      throw new TypeError(`material3 mode "${mode}" requires colorMode.`);
    }
    const coordinate: Material3EngineCoordinate = {
      appearance: builtIn ? mode : normalizeColorMode(settings.get("colorMode"), mode),
      sourceColor: settings.has("sourceColor")
        ? normalizeSourceColor(settings.get("sourceColor"), `mode "${mode}" sourceColor`)
        : sourceColor,
      specVersion,
      variant: readVariant(settings, "variant", variant),
      contrastLevel: readContrast(settings, "contrastLevel", contrastLevel),
    };
    if (specVersion === "2025" && !supported2025Variants.has(coordinate.variant)) {
      throw new RangeError(
        `material3 mode "${mode}" requests unsupported 2025 variant "${coordinate.variant}".`,
      );
    }
    coordinatesByMode.set(mode, coordinate);
  }
  // Every effective coordinate is checked before the first engine call. A global
  // variant overridden in every mode need not itself be a supported coordinate.
  return { visibility, coordinatesByMode };
}

function generateTokenDefinitions(
  coordinatesByMode: ReadonlyMap<string, Material3EngineCoordinate>,
): Readonly<Record<string, Readonly<Record<string, string>>>> {
  const valuesByMode = [...coordinatesByMode].map(
    ([mode, coordinate]) => [mode, generateMaterial3Mode(coordinate)] as const,
  );
  return Object.fromEntries(
    material3RoleDefinitions.map(({ tokenKey }) => [
      tokenKey,
      Object.fromEntries(valuesByMode.map(([mode, values]) => [mode, values[tokenKey]])),
    ]),
  );
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

function normalizeColorMode(input: unknown, mode: string): Material3ColorMode {
  if (input !== "light" && input !== "dark") {
    throw new RangeError(`material3 mode "${mode}" colorMode must be light or dark.`);
  }
  return input;
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
