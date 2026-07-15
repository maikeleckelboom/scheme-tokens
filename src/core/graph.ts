import type { JsonValue } from "./json";
import {
  compareCodeUnits,
  copyJsonValue,
  defineRecordValue,
  readArray,
  readPlainRecord,
  sortedRecord,
} from "./json";
import { isSingleSegmentIdentifier, isTokenKey } from "./identifiers";
import type { Issue } from "./result";
import { describeUnknown } from "./unknown-description";

export const tokenGraphKind = "scheme-tokens/token-graph";
export const tokenLayerKind = "scheme-tokens/token-layer";
export const compiledSchemeKind = "scheme-tokens/compiled-scheme";

export const tokenGraphSchemaUrl = "https://scheme-tokens.dev/schemas/token-graph.v1.schema.json";
export const tokenLayerSchemaUrl = "https://scheme-tokens.dev/schemas/token-layer.v1.schema.json";
export const compiledSchemeSchemaUrl =
  "https://scheme-tokens.dev/schemas/compiled-scheme.v1.schema.json";

export type TokenVisibility = "public" | "internal";

export interface TokenReference<Key extends string = string> {
  readonly ref: Key;
}

export type TokenExpression<Key extends string = string> = string | TokenReference<Key>;

type TokenModeValues<Mode extends string, Key extends string> = Readonly<
  Record<Mode, TokenExpression<Key>>
>;

export interface TokenDefinitionMetadata {
  readonly visibility?: TokenVisibility;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

export type TokenDefinition<
  Key extends string = string,
  Mode extends string = string,
> = TokenDefinitionMetadata & {
  readonly value: TokenExpression<Key> | TokenModeValues<Mode, Key>;
};

export interface TokenLayer<Key extends string = string, Mode extends string = string> {
  readonly $schema?: typeof tokenLayerSchemaUrl;
  readonly kind: typeof tokenLayerKind;
  readonly formatVersion: 1;
  readonly id: string;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<Key, TokenDefinition<string, Mode>>>;
}

export interface TokenGraph<
  Key extends string = string,
  Mode extends string = string,
  Layers extends readonly TokenLayer<string, string>[] = readonly TokenLayer<string, string>[],
> {
  readonly $schema?: typeof tokenGraphSchemaUrl;
  readonly kind: typeof tokenGraphKind;
  readonly formatVersion: 1;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<Key, TokenDefinition<string, Mode>>>;
  readonly layers?: Layers;
}

type TokenMetadataAuthoring = TokenDefinitionMetadata;

type ExpandedSingleTokenAuthoring<Key extends string> = TokenMetadataAuthoring & {
  readonly value: TokenExpression<Key>;
};

type ExpandedMultiTokenAuthoring<
  Mode extends string,
  Key extends string,
> = TokenMetadataAuthoring & {
  readonly value: TokenExpression<Key> | TokenModeValues<Mode, Key>;
};

type SingleTokenAuthoring<Key extends string> =
  | TokenExpression<Key>
  | ExpandedSingleTokenAuthoring<Key>;

type MultiTokenAuthoring<Mode extends string, Key extends string> =
  | TokenExpression<Key>
  | TokenModeValues<Mode, Key>
  | ExpandedMultiTokenAuthoring<Mode, Key>;

type ModeTuple = readonly [string, ...string[]];
type LayerTuple = readonly TokenLayer<string, string>[];
type ReservedMode =
  | "ref"
  | "value"
  | "valueByMode"
  | "visibility"
  | "description"
  | "deprecated"
  | "extensions";
type ValidModes<Modes extends ModeTuple> =
  Extract<Modes[number], ReservedMode> extends never ? Modes : never;

type LayerKeyOf<Layers extends LayerTuple> = Layers extends readonly []
  ? never
  : Layers[number] extends TokenLayer<infer Key, string>
    ? Key
    : never;

type DefinedGraph<
  DirectKey extends string,
  Mode extends string,
  Layers extends LayerTuple,
> = TokenGraph<DirectKey, Mode, Layers>;

interface SharedGraphOptions<Layers extends LayerTuple> {
  readonly $schema?: typeof tokenGraphSchemaUrl;
  readonly defaultVisibility?: TokenVisibility;
  readonly layers?: Layers;
}

type SingleGraphOptions<Layers extends LayerTuple> = SharedGraphOptions<Layers> & {
  readonly modes?: never;
  readonly defaultMode?: never;
};

type MultiGraphOptions<
  Modes extends ModeTuple,
  Layers extends LayerTuple,
> = SharedGraphOptions<Layers> & {
  readonly modes: ValidModes<Modes>;
  readonly defaultMode: NoInfer<Modes[number]>;
};

type SingleGraphAuthoring<
  DirectKey extends string,
  Layers extends LayerTuple,
> = SingleGraphOptions<Layers> & {
  readonly tokens: Readonly<
    Record<DirectKey, SingleTokenAuthoring<NoInfer<DirectKey | LayerKeyOf<Layers>>>>
  >;
};

type MultiGraphAuthoring<
  Modes extends ModeTuple,
  DirectKey extends string,
  Layers extends LayerTuple,
> = MultiGraphOptions<Modes, Layers> & {
  readonly tokens: Readonly<
    Record<
      DirectKey,
      MultiTokenAuthoring<NoInfer<Modes[number]>, NoInfer<DirectKey | LayerKeyOf<Layers>>>
    >
  >;
};

export type TokenOrigin =
  | {
      readonly kind: "graph";
    }
  | {
      readonly kind: "layer";
      readonly id: string;
    };

type DirectTokenKeyOf<T> = T extends { readonly tokens: Readonly<Record<infer Key, unknown>> }
  ? Extract<Key, string>
  : never;

export type TokenKeyOf<T> =
  T extends TokenGraph<infer DirectKey, string, infer Layers>
    ? DirectKey | LayerKeyOf<Layers>
    : DirectTokenKeyOf<T>;

export type ModeOf<T> = T extends { readonly modes: readonly [infer First, ...infer Rest] }
  ? Extract<First | Rest[number], string>
  : never;

export type TokenGraphIssue = Issue<
  | "invalid-object"
  | "unknown-property"
  | "missing-property"
  | "invalid-artifact-kind"
  | "invalid-format-version"
  | "invalid-schema-uri"
  | "invalid-json-value"
  | "empty-modes"
  | "invalid-mode-key"
  | "duplicate-mode-key"
  | "default-mode-not-found"
  | "invalid-default-visibility"
  | "invalid-layer-id"
  | "duplicate-layer-id"
  | "invalid-token-key"
  | "invalid-visibility"
  | "invalid-token-definition"
  | "missing-token-value"
  | "invalid-token-value"
  | "missing-mode-value"
  | "unknown-mode-value"
  | "invalid-reference"
  | "unknown-reference"
  | "reference-cycle"
  | "invalid-description"
  | "invalid-deprecated"
  | "invalid-extensions"
> & {
  readonly key?: string;
  readonly mode?: string;
  readonly layerId?: string;
  readonly firstPath?: string;
  readonly cycle?: readonly string[];
};

const tokenDefinitionKeys = new Set([
  "value",
  "visibility",
  "description",
  "deprecated",
  "extensions",
]);

const reservedModeKeys = new Set([...tokenDefinitionKeys, "ref", "valueByMode"]);

const graphAuthoringKeys = new Set([
  "$schema",
  "modes",
  "defaultMode",
  "defaultVisibility",
  "tokens",
  "layers",
]);

const layerAuthoringKeys = new Set(["$schema", "id", "defaultVisibility", "tokens"]);
const strictLayerKeys = new Set([
  "$schema",
  "kind",
  "formatVersion",
  "id",
  "defaultVisibility",
  "tokens",
]);

export function tokenRef<const Key extends string>(key: Key): TokenReference<Key> {
  if (!isTokenKey(key)) {
    throw new RangeError(
      "tokenRef key must be a dot-separated lower-kebab token key; numeric segments are allowed after the first segment.",
    );
  }
  return { ref: key };
}

export function defineTokens<
  const Key extends string,
  const Layers extends LayerTuple = readonly [],
>(
  tokens: Readonly<Record<Key, SingleTokenAuthoring<NoInfer<Key | LayerKeyOf<Layers>>>>>,
  options?: SingleGraphOptions<Layers>,
): DefinedGraph<Key, "base", Layers>;
export function defineTokens<
  const Modes extends ModeTuple,
  const Key extends string,
  const Layers extends LayerTuple = readonly [],
>(
  tokens: Readonly<
    Record<Key, MultiTokenAuthoring<NoInfer<Modes[number]>, NoInfer<Key | LayerKeyOf<Layers>>>>
  >,
  options: MultiGraphOptions<Modes, Layers>,
): DefinedGraph<Key, Modes[number], Layers>;
export function defineTokens(tokens: unknown, options: unknown = {}): TokenGraph {
  const optionEntries = readAuthoringRecord(options, "defineTokens options");
  rejectUnknownAuthoringKeys(optionEntries, graphAuthoringKeys, "defineTokens options");
  if (optionEntries.some((entry) => entry.key === "tokens")) {
    throw new RangeError("defineTokens options cannot include tokens.");
  }
  return defineTokenGraphFromEntries(
    [
      ...optionEntries,
      {
        key: "tokens",
        value: tokens,
      },
    ],
    "defineTokens",
  );
}

export function defineTokenGraph<
  const DirectKey extends string,
  const Layers extends LayerTuple = readonly [],
>(input: SingleGraphAuthoring<DirectKey, Layers>): DefinedGraph<DirectKey, "base", Layers>;
export function defineTokenGraph<
  const Modes extends ModeTuple,
  const DirectKey extends string,
  const Layers extends LayerTuple = readonly [],
>(
  input: MultiGraphAuthoring<Modes, DirectKey, Layers>,
): DefinedGraph<DirectKey, Modes[number], Layers>;
export function defineTokenGraph(input: unknown): TokenGraph {
  const entries = readAuthoringRecord(input, "defineTokenGraph input");
  return defineTokenGraphFromEntries(entries, "defineTokenGraph");
}

export function defineTokenLayer<const Key extends string>(input: {
  readonly $schema?: typeof tokenLayerSchemaUrl;
  readonly id: string;
  readonly defaultVisibility?: TokenVisibility;
  readonly tokens: Readonly<Record<Key, MultiTokenAuthoring<string, string>>>;
}): TokenLayer<Key, string>;
export function defineTokenLayer(input: unknown): TokenLayer {
  const entries = readAuthoringRecord(input, "defineTokenLayer input");
  rejectUnknownAuthoringKeys(entries, layerAuthoringKeys, "defineTokenLayer input");
  const record = new Map(entries.map((entry) => [entry.key, entry.value]));
  const schema = normalizeSchema(record.get("$schema"), tokenLayerSchemaUrl, "defineTokenLayer");
  const id = normalizeLayerId(record.get("id"), "defineTokenLayer");
  const defaultVisibility = normalizeVisibility(
    record.get("defaultVisibility"),
    "defineTokenLayer defaultVisibility",
  );
  if (!record.has("tokens")) {
    throw new TypeError("defineTokenLayer input must include tokens.");
  }

  return {
    ...(schema === undefined ? {} : { $schema: schema }),
    kind: tokenLayerKind,
    formatVersion: 1,
    id,
    defaultVisibility,
    tokens: normalizeAuthoringTokenRecord(record.get("tokens"), {
      helperName: "defineTokenLayer",
      modes: undefined,
      allowUnboundModeMap: true,
    }),
  };
}

export function isReferenceInput(input: unknown): input is TokenReference {
  const entries = readPlainRecord(input, {
    code: "invalid-reference",
    message: "Reference probes must be plain data.",
  });
  return entries.ok && entries.value.some((entry) => entry.key === "ref");
}

function defineTokenGraphFromEntries(
  entries: readonly { readonly key: string; readonly value: unknown }[],
  helperName: string,
): TokenGraph {
  rejectUnknownAuthoringKeys(entries, graphAuthoringKeys, `${helperName} input`);
  const record = new Map(entries.map((entry) => [entry.key, entry.value]));
  if (!record.has("tokens")) {
    throw new TypeError(`${helperName} input must include tokens.`);
  }

  const schema = normalizeSchema(record.get("$schema"), tokenGraphSchemaUrl, helperName);
  const modeEnvelope = normalizeAuthoringModes(
    record.get("modes"),
    record.get("defaultMode"),
    helperName,
  );
  const defaultVisibility = normalizeVisibility(
    record.get("defaultVisibility"),
    `${helperName} defaultVisibility`,
  );
  const layers = normalizeGraphLayers(record.get("layers"), modeEnvelope, helperName);

  return {
    ...(schema === undefined ? {} : { $schema: schema }),
    kind: tokenGraphKind,
    formatVersion: 1,
    modes: modeEnvelope.modes,
    defaultMode: modeEnvelope.defaultMode,
    defaultVisibility,
    tokens: normalizeAuthoringTokenRecord(record.get("tokens"), {
      helperName,
      modes: modeEnvelope.explicit ? modeEnvelope.modes : undefined,
      allowUnboundModeMap: false,
    }),
    ...(layers === undefined ? {} : { layers }),
  };
}

interface NormalizedModeEnvelope {
  readonly modes: readonly [string, ...string[]];
  readonly defaultMode: string;
  readonly explicit: boolean;
}

function normalizeAuthoringModes(
  modesInput: unknown,
  defaultModeInput: unknown,
  helperName: string,
): NormalizedModeEnvelope {
  if (modesInput === undefined && defaultModeInput === undefined) {
    return { modes: ["base"], defaultMode: "base", explicit: false };
  }
  if (modesInput === undefined) {
    throw new TypeError(`${helperName} defaultMode requires an explicit modes tuple.`);
  }
  if (defaultModeInput === undefined) {
    throw new TypeError(`${helperName} modes require an explicit defaultMode.`);
  }

  const entries = readArray(modesInput, {
    code: "invalid-mode-key",
    message: `${helperName} modes must be a dense non-empty array.`,
  });
  if (!entries.ok || entries.value.length === 0) {
    throw new TypeError(`${helperName} modes must be a dense non-empty array.`);
  }

  const seen = new Set<string>();
  const modes: string[] = [];
  for (const entry of entries.value) {
    if (typeof entry.value !== "string" || !isModeKey(entry.value)) {
      throw new RangeError(
        `${helperName} mode names must be lower-kebab identifiers and cannot use reserved token fields.`,
      );
    }
    if (seen.has(entry.value)) {
      throw new RangeError(`${helperName} modes cannot contain duplicate mode "${entry.value}".`);
    }
    seen.add(entry.value);
    modes.push(entry.value);
  }
  if (
    typeof defaultModeInput !== "string" ||
    !isModeKey(defaultModeInput) ||
    !seen.has(defaultModeInput)
  ) {
    throw new RangeError(`${helperName} defaultMode must be one of the declared modes.`);
  }

  return {
    modes: canonicalModes(modes, defaultModeInput),
    defaultMode: defaultModeInput,
    explicit: true,
  };
}

function canonicalModes(
  modes: readonly string[],
  defaultMode: string,
): readonly [string, ...string[]] {
  return [defaultMode, ...modes.filter((mode) => mode !== defaultMode).sort(compareCodeUnits)];
}

export function isModeKey(input: string): boolean {
  return isSingleSegmentIdentifier(input) && !reservedModeKeys.has(input);
}

interface NormalizeTokenRecordOptions {
  readonly helperName: string;
  readonly modes: readonly string[] | undefined;
  readonly allowUnboundModeMap: boolean;
}

function normalizeAuthoringTokenRecord(
  input: unknown,
  options: NormalizeTokenRecordOptions,
): Readonly<Record<string, TokenDefinition>> {
  const entries = readAuthoringRecord(input, `${options.helperName} tokens`);
  const output: Record<string, TokenDefinition> = {};
  for (const entry of entries) {
    if (!isTokenKey(entry.key)) {
      throw new RangeError(
        `${options.helperName} token key "${entry.key}" must be a valid dot-separated lower-kebab key.`,
      );
    }
    defineRecordValue(
      output,
      entry.key,
      normalizeAuthoringDefinition(entry.value, entry.key, options),
    );
  }
  return output;
}

function normalizeAuthoringDefinition(
  input: unknown,
  tokenKey: string,
  options: NormalizeTokenRecordOptions,
): TokenDefinition {
  if (typeof input === "string" || isReferenceInput(input)) {
    return { value: normalizeExpression(input, options.helperName, tokenKey) };
  }

  const entries = readAuthoringRecord(
    input,
    `${options.helperName} token "${tokenKey}" definition`,
  );
  if (entries.some((entry) => tokenDefinitionKeys.has(entry.key))) {
    rejectUnknownAuthoringKeys(
      entries,
      tokenDefinitionKeys,
      `${options.helperName} token "${tokenKey}" definition`,
    );
    const record = new Map(entries.map((entry) => [entry.key, entry.value]));
    if (!record.has("value")) {
      throw new TypeError(`${options.helperName} token "${tokenKey}" must include value.`);
    }
    return {
      value: normalizeTokenValue(record.get("value"), tokenKey, options),
      ...normalizeMetadata(record, options.helperName, tokenKey),
    };
  }

  return { value: normalizeModeMap(input, tokenKey, options) };
}

function normalizeTokenValue(
  input: unknown,
  tokenKey: string,
  options: NormalizeTokenRecordOptions,
): TokenDefinition["value"] {
  if (typeof input === "string" || isReferenceInput(input)) {
    return normalizeExpression(input, options.helperName, tokenKey);
  }
  return normalizeModeMap(input, tokenKey, options);
}

function normalizeModeMap(
  input: unknown,
  tokenKey: string,
  options: NormalizeTokenRecordOptions,
): Readonly<Record<string, TokenExpression>> {
  if (options.modes === undefined && !options.allowUnboundModeMap) {
    const entries = readPlainRecord(input, {
      code: "invalid-token-definition",
      message: "Mode maps require an explicit graph mode envelope.",
    });
    const keys = entries.ok ? entries.value.map((entry) => entry.key).join(", ") : "";
    throw new TypeError(
      `${options.helperName} token "${tokenKey}" mode map${keys.length === 0 ? "" : ` (${keys})`} requires explicit modes and defaultMode.`,
    );
  }

  const entries = readAuthoringRecord(input, `${options.helperName} token "${tokenKey}" mode map`);
  if (entries.length === 0) {
    throw new TypeError(`${options.helperName} token "${tokenKey}" mode map must not be empty.`);
  }

  const expectedModes = options.modes === undefined ? undefined : new Set(options.modes);
  const seen = new Set<string>();
  const output: Record<string, TokenExpression> = {};
  for (const entry of entries) {
    if (!isModeKey(entry.key)) {
      throw new RangeError(
        `${options.helperName} token "${tokenKey}" has invalid or reserved mode "${entry.key}".`,
      );
    }
    if (expectedModes !== undefined && !expectedModes.has(entry.key)) {
      throw new RangeError(
        `${options.helperName} token "${tokenKey}" mode map contains unknown mode "${entry.key}".`,
      );
    }
    seen.add(entry.key);
    defineRecordValue(
      output,
      entry.key,
      normalizeExpression(entry.value, options.helperName, tokenKey),
    );
  }

  if (expectedModes !== undefined) {
    for (const mode of options.modes as readonly string[]) {
      if (!seen.has(mode)) {
        throw new RangeError(
          `${options.helperName} token "${tokenKey}" mode map is missing mode "${mode}".`,
        );
      }
    }
  }
  return sortedRecord(Object.entries(output));
}

function normalizeExpression(
  input: unknown,
  helperName: string,
  tokenKey: string,
): TokenExpression {
  if (typeof input === "string") {
    return input;
  }
  if (!isReferenceInput(input)) {
    throw new TypeError(
      `${helperName} token "${tokenKey}" must use a string, tokenRef(), or a mode map (${describeUnknown(input)}).`,
    );
  }

  const entries = readAuthoringRecord(input, `${helperName} token "${tokenKey}" reference`);
  if (entries.length !== 1 || entries[0]?.key !== "ref" || typeof entries[0].value !== "string") {
    throw new TypeError(
      `${helperName} token "${tokenKey}" reference must contain exactly one ref string.`,
    );
  }
  if (!isTokenKey(entries[0].value)) {
    throw new RangeError(
      `${helperName} token "${tokenKey}" reference must target a valid token key.`,
    );
  }
  return { ref: entries[0].value };
}

function normalizeMetadata(
  record: ReadonlyMap<string, unknown>,
  helperName: string,
  tokenKey: string,
): TokenDefinitionMetadata {
  const visibility = record.get("visibility");
  if (visibility !== undefined && visibility !== "public" && visibility !== "internal") {
    throw new RangeError(
      `${helperName} token "${tokenKey}" visibility must be public or internal.`,
    );
  }
  const description = record.get("description");
  if (description !== undefined && typeof description !== "string") {
    throw new TypeError(`${helperName} token "${tokenKey}" description must be a string.`);
  }
  const deprecated = record.get("deprecated");
  if (
    deprecated !== undefined &&
    typeof deprecated !== "boolean" &&
    (typeof deprecated !== "string" || deprecated.length === 0)
  ) {
    throw new TypeError(
      `${helperName} token "${tokenKey}" deprecated must be boolean or a non-empty string.`,
    );
  }

  const extensions = record.get("extensions");
  return {
    ...(visibility === undefined ? {} : { visibility }),
    ...(description === undefined ? {} : { description }),
    ...(deprecated === undefined ? {} : { deprecated }),
    ...(extensions === undefined
      ? {}
      : { extensions: normalizeExtensions(extensions, helperName, tokenKey) }),
  };
}

function normalizeExtensions(
  input: unknown,
  helperName: string,
  tokenKey: string,
): Readonly<Record<string, JsonValue>> {
  const entries = readAuthoringRecord(input, `${helperName} token "${tokenKey}" extensions`);
  const output: Record<string, JsonValue> = {};
  for (const entry of entries) {
    const copied = copyJsonValue(entry.value, {
      code: "invalid-json-value",
      message: "Extension values must be JSON-safe.",
    });
    if (!copied.ok) {
      throw new TypeError(
        `${helperName} token "${tokenKey}" extension "${entry.key}" must be JSON-safe.`,
      );
    }
    defineRecordValue(output, entry.key, copied.value);
  }
  return output;
}

function normalizeGraphLayers(
  input: unknown,
  modeEnvelope: NormalizedModeEnvelope,
  helperName: string,
): readonly TokenLayer[] | undefined {
  if (input === undefined) {
    return undefined;
  }
  const entries = readArray(input, {
    code: "invalid-object",
    message: `${helperName} layers must be a dense array.`,
  });
  if (!entries.ok) {
    throw new TypeError(`${helperName} layers must be a dense array.`);
  }

  const layers: TokenLayer[] = [];
  const ids = new Set<string>();
  for (const entry of entries.value) {
    const layer = copyStrictLayer(entry.value, {
      helperName,
      modes: modeEnvelope.explicit ? modeEnvelope.modes : undefined,
      allowUnboundModeMap: false,
    });
    if (ids.has(layer.id)) {
      throw new RangeError(`${helperName} layers contain duplicate id "${layer.id}".`);
    }
    ids.add(layer.id);
    layers.push(layer);
  }
  return layers;
}

function copyStrictLayer(input: unknown, options: NormalizeTokenRecordOptions): TokenLayer {
  const entries = readAuthoringRecord(input, `${options.helperName} layer`);
  rejectUnknownAuthoringKeys(entries, strictLayerKeys, `${options.helperName} layer`);
  const record = new Map(entries.map((entry) => [entry.key, entry.value]));
  if (record.get("kind") !== tokenLayerKind) {
    throw new RangeError(`${options.helperName} layer kind must be ${tokenLayerKind}.`);
  }
  if (record.get("formatVersion") !== 1) {
    throw new RangeError(`${options.helperName} layer formatVersion must be 1.`);
  }
  const schema = normalizeSchema(record.get("$schema"), tokenLayerSchemaUrl, options.helperName);
  const id = normalizeLayerId(record.get("id"), options.helperName);
  const defaultVisibility = normalizeRequiredVisibility(
    record.get("defaultVisibility"),
    `${options.helperName} layer defaultVisibility`,
  );
  if (!record.has("tokens")) {
    throw new TypeError(`${options.helperName} layer must include tokens.`);
  }

  const tokenEntries = readAuthoringRecord(
    record.get("tokens"),
    `${options.helperName} layer tokens`,
  );
  const tokens: Record<string, TokenDefinition> = {};
  for (const entry of tokenEntries) {
    if (!isTokenKey(entry.key)) {
      throw new RangeError(`${options.helperName} layer token key "${entry.key}" is invalid.`);
    }
    const definitionEntries = readAuthoringRecord(
      entry.value,
      `${options.helperName} layer token "${entry.key}" definition`,
    );
    rejectUnknownAuthoringKeys(
      definitionEntries,
      tokenDefinitionKeys,
      `${options.helperName} layer token "${entry.key}" definition`,
    );
    const definitionRecord = new Map(
      definitionEntries.map((definitionEntry) => [definitionEntry.key, definitionEntry.value]),
    );
    if (!definitionRecord.has("value")) {
      throw new TypeError(`${options.helperName} layer token "${entry.key}" must include value.`);
    }
    defineRecordValue(tokens, entry.key, {
      value: normalizeTokenValue(definitionRecord.get("value"), entry.key, options),
      ...normalizeMetadata(definitionRecord, options.helperName, entry.key),
    });
  }

  return {
    ...(schema === undefined ? {} : { $schema: schema }),
    kind: tokenLayerKind,
    formatVersion: 1,
    id,
    defaultVisibility,
    tokens,
  };
}

function normalizeSchema<const Url extends string>(
  input: unknown,
  expected: Url,
  helperName: string,
): Url | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (input !== expected) {
    throw new RangeError(`${helperName} $schema must be ${expected}.`);
  }
  return expected;
}

function normalizeLayerId(input: unknown, helperName: string): string {
  if (typeof input !== "string" || !isSingleSegmentIdentifier(input)) {
    throw new RangeError(`${helperName} id must be a lower-kebab identifier.`);
  }
  return input;
}

function normalizeVisibility(input: unknown, label: string): TokenVisibility {
  if (input === undefined) {
    return "public";
  }
  return normalizeRequiredVisibility(input, label);
}

function normalizeRequiredVisibility(input: unknown, label: string): TokenVisibility {
  if (input !== "public" && input !== "internal") {
    throw new RangeError(`${label} must be public or internal.`);
  }
  return input;
}

function readAuthoringRecord(
  input: unknown,
  label: string,
): readonly { readonly key: string; readonly value: unknown }[] {
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: `${label} must be a plain object.`,
  });
  if (!entries.ok) {
    throw new TypeError(`${label} must be a plain object.`);
  }
  return entries.value;
}

function rejectUnknownAuthoringKeys(
  entries: readonly { readonly key: string }[],
  allowed: ReadonlySet<string>,
  label: string,
): void {
  const unknown = entries.find((entry) => !allowed.has(entry.key));
  if (unknown !== undefined) {
    throw new RangeError(`${label} contains unknown property "${unknown.key}".`);
  }
}
