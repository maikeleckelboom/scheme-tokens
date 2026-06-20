import {
  cloneColor,
  parseColor,
  type ColorInput,
  type ColorValue,
  type ColorValueInput,
  type ParseColorIssue,
} from "./color";
import type { JsonValue } from "./json";
import { defineRecordValue, readPlainRecord } from "./json";
import type { Issue, Result } from "./result";

export const colorTokenGraphKind = "scheme-tokens/color-token-graph";
export const colorTokenLayerKind = "scheme-tokens/color-token-layer";
export const compiledColorSchemeKind = "scheme-tokens/compiled-color-scheme";

export type ColorTokenGraphKind = typeof colorTokenGraphKind;
export type ColorTokenLayerKind = typeof colorTokenLayerKind;
export type CompiledColorSchemeKind = typeof compiledColorSchemeKind;

export type TokenVisibility = "public" | "internal";

export interface ReferenceInput<Key extends string = string> {
  readonly ref: Key;
}

export type ColorExpressionInput<Key extends string = string> = ColorInput | ReferenceInput<Key>;
export type ColorTokenExpressionInput<Key extends string = string> =
  | ColorValueInput
  | ReferenceInput<Key>;
export type ColorExpression<Key extends string = string> = ColorValue | ReferenceInput<Key>;

export type ColorTokenDefinitionInput<Mode extends string = string, Key extends string = string> = {
  readonly visibility?: TokenVisibility;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
} & (
  | {
      readonly value: ColorTokenExpressionInput<Key>;
      readonly valueByMode?: never;
    }
  | {
      readonly value?: never;
      readonly valueByMode: Readonly<Record<Mode, ColorTokenExpressionInput<Key>>>;
    }
);

export interface ColorTokenLayerInput<Mode extends string = string, Key extends string = string> {
  readonly $schema?: string;
  readonly kind: ColorTokenLayerKind;
  readonly formatVersion: 1;
  readonly id: string;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<Key, ColorTokenDefinitionInput<Mode, Key>>>;
}

export interface ColorTokenGraphInput<Mode extends string = string, Key extends string = string> {
  readonly $schema?: string;
  readonly kind: ColorTokenGraphKind;
  readonly formatVersion: 1;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<Key, ColorTokenDefinitionInput<Mode, Key>>>;
  readonly layers?: readonly ColorTokenLayerInput<Mode>[];
}

type TokenDefinitionMetadataAuthoringInput = {
  readonly visibility?: TokenVisibility;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
};

type TokenDefinitionModeAuthoringInput<
  Mode extends string,
  Key extends string,
> = string extends Mode
  ? TokenDefinitionMetadataAuthoringInput & Readonly<Record<string, unknown>>
  : TokenDefinitionMetadataAuthoringInput &
      Readonly<Partial<Record<Mode, ColorExpressionInput<Key>>>>;

type TokenDefinitionObjectAuthoringInput<
  Mode extends string,
  Key extends string,
> = TokenDefinitionMetadataAuthoringInput &
  (
    | {
        readonly value: ColorExpressionInput<Key>;
        readonly valueByMode?: never;
      }
    | {
        readonly value?: never;
        readonly valueByMode: Readonly<Record<Mode, ColorExpressionInput<Key>>>;
      }
  );

export type ColorTokenDefinitionAuthoringInput<
  Mode extends string = string,
  Key extends string = string,
> =
  | ColorTokenDefinitionInput<Mode, Key>
  | TokenDefinitionObjectAuthoringInput<Mode, Key>
  | ColorExpressionInput<Key>
  | Readonly<Record<Mode, ColorExpressionInput<Key>>>
  | TokenDefinitionModeAuthoringInput<Mode, Key>;

export interface ColorTokenLayerAuthoringInput<
  Mode extends string = string,
  Key extends string = string,
> {
  readonly $schema?: string;
  readonly kind?: ColorTokenLayerKind;
  readonly formatVersion?: 1;
  readonly id: string;
  readonly defaultVisibility?: TokenVisibility;
  readonly modes?: readonly [Mode, ...Mode[]];
  readonly tokens: Readonly<Record<Key, ColorTokenDefinitionAuthoringInput<Mode, Key>>>;
}

export type ColorTokenGraphAuthoringInput<
  Mode extends string = string,
  Key extends string = string,
> =
  | {
      readonly $schema?: string;
      readonly kind?: ColorTokenGraphKind;
      readonly formatVersion?: 1;
      readonly modes?: never;
      readonly defaultMode?: never;
      readonly defaultVisibility?: TokenVisibility;
      readonly tokens: Readonly<Record<Key, ColorTokenDefinitionAuthoringInput<"base", Key>>>;
      readonly layers?: readonly ColorTokenLayerInput<"base">[];
    }
  | {
      readonly $schema?: string;
      readonly kind?: ColorTokenGraphKind;
      readonly formatVersion?: 1;
      readonly modes: readonly [Mode, ...Mode[]];
      readonly defaultMode: Mode;
      readonly defaultVisibility?: TokenVisibility;
      readonly tokens: Readonly<Record<Key, ColorTokenDefinitionAuthoringInput<Mode, Key>>>;
      readonly layers?: readonly ColorTokenLayerInput<Mode>[];
    };

export type TokenOrigin =
  | {
      readonly kind: "graph";
    }
  | {
      readonly kind: "layer";
      readonly id: string;
    }
  | {
      readonly kind: "source";
      readonly id: string;
      readonly sourceToken?: string;
    };

export interface ColorTokenGraphToken<Mode extends string = string, Key extends string = string> {
  readonly visibility: TokenVisibility;
  readonly valueByMode: Readonly<Record<Mode, ColorExpression<Key>>>;
  readonly origin: TokenOrigin;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

export interface ColorTokenGraph<Mode extends string = string, Key extends string = string> {
  readonly kind: ColorTokenGraphKind;
  readonly formatVersion: 1;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly tokens: Readonly<Record<Key, ColorTokenGraphToken<Mode, Key>>>;
}

export type TokenKeyOf<T> = T extends { readonly tokens: Readonly<Record<infer Key, unknown>> }
  ? Extract<Key, string>
  : never;

export type ModeOf<T> = T extends { readonly modes: readonly [infer First, ...infer Rest] }
  ? Extract<First | Rest[number], string>
  : T extends { readonly defaultMode: infer Mode }
    ? Extract<Mode, string>
    : never;

export type ColorTokenGraphIssue =
  | ParseColorIssue
  | (Issue<
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
      | "duplicate-token-key"
      | "invalid-visibility"
      | "invalid-token-definition"
      | "missing-token-value"
      | "conflicting-token-value"
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
    });

export function ref<const Key extends string>(key: Key): ReferenceInput<Key> {
  return { ref: key };
}

export function defineTokenGraph<
  const Tokens extends Readonly<Record<string, ColorTokenDefinitionAuthoringInput<"base", string>>>,
>(input: {
  readonly $schema?: string;
  readonly kind?: ColorTokenGraphKind;
  readonly formatVersion?: 1;
  readonly modes?: never;
  readonly defaultMode?: never;
  readonly defaultVisibility?: TokenVisibility;
  readonly tokens: Tokens;
  readonly layers?: readonly ColorTokenLayerInput<"base">[];
}): ColorTokenGraphInput<"base", Extract<keyof Tokens, string>>;
export function defineTokenGraph<
  const Modes extends readonly [string, ...string[]],
  const Tokens extends Readonly<
    Record<string, ColorTokenDefinitionAuthoringInput<NoInfer<Modes[number]>, string>>
  >,
>(input: {
  readonly $schema?: string;
  readonly kind?: ColorTokenGraphKind;
  readonly formatVersion?: 1;
  readonly modes: Modes;
  readonly defaultMode: Modes[number];
  readonly defaultVisibility?: TokenVisibility;
  readonly tokens: Tokens;
  readonly layers?: readonly ColorTokenLayerInput<NoInfer<Modes[number]>>[];
}): ColorTokenGraphInput<Modes[number], Extract<keyof Tokens, string>>;
export function defineTokenGraph(input: ColorTokenGraphAuthoringInput): ColorTokenGraphInput {
  return defineTokenGraphFromInput(input, "defineTokenGraph");
}

function defineTokenGraphFromInput(
  input: ColorTokenGraphAuthoringInput,
  helperName: string,
): ColorTokenGraphInput {
  assertGraphHelperInput(input, helperName);
  if (input.kind !== undefined && input.kind !== colorTokenGraphKind) {
    throw new RangeError(`${helperName} kind must be ${colorTokenGraphKind}.`);
  }
  const modes = "modes" in input && input.modes !== undefined ? input.modes : ["base"];
  assertHelperModesCanUseShorthand(modes, helperName);
  const defaultMode =
    "defaultMode" in input && input.defaultMode !== undefined ? input.defaultMode : modes[0];
  return {
    ...(input.$schema === undefined ? {} : { $schema: input.$schema }),
    kind: colorTokenGraphKind,
    formatVersion: input.formatVersion ?? 1,
    modes: [...modes] as readonly [string, ...string[]],
    defaultMode,
    defaultVisibility: input.defaultVisibility ?? "public",
    tokens: normalizeTokenRecord(input.tokens, modes, helperName),
    ...(input.layers === undefined ? {} : { layers: input.layers }),
  };
}

export function defineTokens<
  const Tokens extends Readonly<Record<string, ColorTokenDefinitionAuthoringInput<"base", string>>>,
>(
  tokens: Tokens,
  options?: {
    readonly $schema?: string;
    readonly kind?: ColorTokenGraphKind;
    readonly formatVersion?: 1;
    readonly modes?: never;
    readonly defaultMode?: never;
    readonly defaultVisibility?: TokenVisibility;
    readonly layers?: readonly ColorTokenLayerInput<"base">[];
    readonly tokens?: never;
  },
): ColorTokenGraphInput<"base", Extract<keyof Tokens, string>>;
export function defineTokens<
  const Modes extends readonly [string, ...string[]],
  const Tokens extends Readonly<
    Record<string, ColorTokenDefinitionAuthoringInput<NoInfer<Modes[number]>, string>>
  >,
>(
  tokens: Tokens,
  options: {
    readonly $schema?: string;
    readonly kind?: ColorTokenGraphKind;
    readonly formatVersion?: 1;
    readonly modes: Modes;
    readonly defaultMode: Modes[number];
    readonly defaultVisibility?: TokenVisibility;
    readonly layers?: readonly ColorTokenLayerInput<NoInfer<Modes[number]>>[];
    readonly tokens?: never;
  },
): ColorTokenGraphInput<Modes[number], Extract<keyof Tokens, string>>;
export function defineTokens(
  tokens: Readonly<Record<string, ColorTokenDefinitionAuthoringInput>>,
  options: Omit<ColorTokenGraphAuthoringInput, "tokens"> & { readonly tokens?: never } = {},
): ColorTokenGraphInput {
  assertDefineTokensOptions(options);
  return defineTokenGraphFromInput(
    { ...options, tokens } as ColorTokenGraphAuthoringInput,
    "defineTokens",
  );
}

export function defineTokenLayer<
  const Mode extends string = string,
  const Tokens extends Readonly<Record<string, ColorTokenDefinitionAuthoringInput<Mode, string>>> =
    Readonly<Record<string, ColorTokenDefinitionAuthoringInput<Mode>>>,
>(
  input: ColorTokenLayerAuthoringInput<Mode, string> & {
    readonly tokens: Tokens;
  },
): ColorTokenLayerInput<Mode, Extract<keyof Tokens, string>> {
  if (input.kind !== undefined && input.kind !== colorTokenLayerKind) {
    throw new RangeError(`defineTokenLayer kind must be ${colorTokenLayerKind}.`);
  }
  const modes = input.modes;
  if (modes !== undefined) {
    assertHelperModesCanUseShorthand(modes, "defineTokenLayer");
  }
  return {
    ...(input.$schema === undefined ? {} : { $schema: input.$schema }),
    kind: colorTokenLayerKind,
    formatVersion: input.formatVersion ?? 1,
    id: input.id,
    defaultVisibility: input.defaultVisibility ?? "public",
    tokens: normalizeTokenRecord(input.tokens, modes, "defineTokenLayer") as Readonly<
      Record<string, ColorTokenDefinitionInput<Mode>>
    >,
  } as ColorTokenLayerInput<Mode, Extract<keyof Tokens, string>>;
}

export function isReferenceInput(input: unknown): input is ReferenceInput {
  const entries = readPlainRecord(input, {
    code: "invalid-reference",
    message: "Reference probes must be plain data.",
  });
  return entries.ok && entries.value.some((entry) => entry.key === "ref");
}

export type ParseTokenGraphResult = Result<ColorTokenGraph, ColorTokenGraphIssue>;

const tokenDefinitionKeys = new Set([
  "visibility",
  "description",
  "deprecated",
  "extensions",
  "value",
  "valueByMode",
]);

function normalizeTokenRecord(
  input: unknown,
  modes: readonly string[] | undefined,
  helperName: string,
): Readonly<Record<string, ColorTokenDefinitionInput>> {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: `${helperName} tokens must be a plain object record.`,
  });
  if (!entries.ok) {
    throw new TypeError(`${helperName} tokens must be a plain object record.`);
  }

  const output: Record<string, ColorTokenDefinitionInput> = {};
  for (const entry of entries.value) {
    defineRecordValue(
      output,
      entry.key,
      normalizeTokenDefinition(entry.value as ColorTokenDefinitionAuthoringInput, modes),
    );
  }
  return output;
}

function assertGraphHelperInput(
  input: unknown,
  helperName: string,
): asserts input is ColorTokenGraphAuthoringInput {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: `${helperName} input must be a plain object.`,
  });
  if (!entries.ok) {
    throw new TypeError(`${helperName} input must be a plain object.`);
  }
  if (!entries.value.some((entry) => entry.key === "tokens")) {
    throw new TypeError(`${helperName} input must include tokens.`);
  }
}

function normalizeTokenDefinition(
  input: ColorTokenDefinitionAuthoringInput | undefined,
  modes: readonly string[] | undefined,
): ColorTokenDefinitionInput {
  if (isTokenDefinitionObject(input)) {
    return normalizeObjectTokenDefinition(input);
  }

  if (modes !== undefined && isModeValueRecord(input, modes)) {
    return { valueByMode: normalizeModeValues(input) };
  }

  return { value: normalizeColorExpression(input as ColorExpressionInput) };
}

function normalizeObjectTokenDefinition(
  input: TokenDefinitionMetadataAuthoringInput & Readonly<Record<string, unknown>>,
): ColorTokenDefinitionInput {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "Token definition probes must be plain data.",
  });
  if (!entries.ok) {
    return input as ColorTokenDefinitionInput;
  }

  const modeEntries = entries.value.filter((entry) => !tokenDefinitionKeys.has(entry.key));
  if (modeEntries.length > 0 && ("value" in input || "valueByMode" in input)) {
    throw new RangeError(
      "Token definition shorthand cannot combine value or valueByMode with mode keys.",
    );
  }

  const metadata = tokenDefinitionMetadata(input);
  if ("value" in input && input.value !== undefined) {
    return { ...metadata, value: normalizeColorExpression(input.value as ColorExpressionInput) };
  }
  const valueByMode = "valueByMode" in input ? input.valueByMode : undefined;
  if (valueByMode === undefined) {
    if (modeEntries.length === 0) {
      return metadata as ColorTokenDefinitionInput;
    }
    const modeValues: Record<string, ColorExpressionInput> = {};
    for (const entry of modeEntries) {
      defineRecordValue(modeValues, entry.key, entry.value as ColorExpressionInput);
    }
    return { ...metadata, valueByMode: normalizeModeValues(modeValues) };
  }
  return {
    ...metadata,
    valueByMode: normalizeModeValues(valueByMode as Readonly<Record<string, ColorExpressionInput>>),
  };
}

function tokenDefinitionMetadata(
  input: TokenDefinitionMetadataAuthoringInput,
): TokenDefinitionMetadataAuthoringInput {
  return {
    ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.deprecated === undefined ? {} : { deprecated: input.deprecated }),
    ...(input.extensions === undefined ? {} : { extensions: input.extensions }),
  };
}

function normalizeModeValues(
  input: Readonly<Record<string, ColorExpressionInput>>,
): Readonly<Record<string, ColorTokenExpressionInput>> {
  const output: Record<string, ColorTokenExpressionInput> = {};
  for (const mode of Object.keys(input)) {
    defineRecordValue(output, mode, normalizeColorExpression(input[mode] as ColorExpressionInput));
  }
  return output;
}

function normalizeColorExpression(input: ColorExpressionInput): ColorTokenExpressionInput {
  if (isReferenceInput(input)) {
    return input;
  }
  const color = parseColor(input);
  return color.ok ? cloneColor(color.value) : (input as ColorValueInput);
}

function isTokenDefinitionObject(input: unknown): input is TokenDefinitionMetadataAuthoringInput {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "Token definition probes must be plain data.",
  });
  return entries.ok && entries.value.some((entry) => tokenDefinitionKeys.has(entry.key));
}

function isModeValueRecord(
  input: unknown,
  modes: readonly string[],
): input is Readonly<Record<string, ColorExpressionInput>> {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "Mode value probes must be plain data.",
  });
  if (!entries.ok || entries.value.length === 0) {
    return false;
  }
  const modeSet = new Set(modes);
  return entries.value.every((entry) => modeSet.has(entry.key));
}

function assertHelperModesCanUseShorthand(modes: readonly string[], helperName: string): void {
  const reserved = modes.filter((mode) => tokenDefinitionKeys.has(mode));
  if (reserved.length > 0) {
    throw new RangeError(
      `${helperName} mode names cannot use token-definition keys: ${reserved.join(", ")}.`,
    );
  }
}

function assertDefineTokensOptions(options: unknown): void {
  const entries = readPlainRecord(options, {
    code: "invalid-token-definition",
    message: "defineTokens options must be a plain object.",
  });
  if (!entries.ok) {
    throw new TypeError("defineTokens options must be a plain object.");
  }
  if (entries.value.some((entry) => entry.key === "tokens")) {
    throw new RangeError("defineTokens options cannot include tokens.");
  }
}
