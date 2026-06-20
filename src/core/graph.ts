import { parseColor, type ColorInput, type ColorValue, type ParseColorIssue } from "./color";
import { isTokenKey } from "./identifiers";
import type { JsonValue } from "./json";
import { defineRecordValue, readPlainRecord } from "./json";
import type { Issue, Result } from "./result";

export type TokenVisibility = "public" | "internal";

export interface ReferenceInput {
  readonly ref: string;
}

export type ColorExpressionInput = ColorInput | ReferenceInput;
export type ColorExpression = ColorValue | ReferenceInput;

export type TokenDefinitionInput<Mode extends string = string> = {
  readonly visibility?: TokenVisibility;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
} & (
  | {
      readonly value: ColorExpressionInput;
      readonly valueByMode?: never;
    }
  | {
      readonly value?: never;
      readonly valueByMode: Readonly<Record<Mode, ColorExpressionInput>>;
    }
);

export interface TokenLayerInput<Mode extends string = string> {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly id: string;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<string, TokenDefinitionInput<Mode>>>;
}

export interface TokenGraphInput<Mode extends string = string> {
  readonly $schema?: string;
  readonly formatVersion: 1;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<string, TokenDefinitionInput<Mode>>>;
  readonly layers?: readonly TokenLayerInput<Mode>[];
}

type TokenDefinitionMetadataAuthoringInput = {
  readonly visibility?: TokenVisibility;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
};

type TokenDefinitionModeAuthoringInput<Mode extends string> = string extends Mode
  ? TokenDefinitionMetadataAuthoringInput & Readonly<Record<string, unknown>>
  : TokenDefinitionMetadataAuthoringInput & Readonly<Partial<Record<Mode, ColorExpressionInput>>>;

export type TokenDefinitionAuthoringInput<Mode extends string = string> =
  | TokenDefinitionInput<Mode>
  | ColorExpressionInput
  | Readonly<Record<Mode, ColorExpressionInput>>
  | TokenDefinitionModeAuthoringInput<Mode>;

export interface TokenLayerAuthoringInput<Mode extends string = string> {
  readonly $schema?: string;
  readonly formatVersion?: 1;
  readonly id: string;
  readonly defaultVisibility?: TokenVisibility;
  readonly modes?: readonly [Mode, ...Mode[]];
  readonly tokens: Readonly<Record<string, TokenDefinitionAuthoringInput<Mode>>>;
}

export type TokenGraphAuthoringInput<Mode extends string = string> =
  | {
      readonly $schema?: string;
      readonly formatVersion?: 1;
      readonly modes?: never;
      readonly defaultMode?: never;
      readonly defaultVisibility?: TokenVisibility;
      readonly tokens: Readonly<Record<string, TokenDefinitionAuthoringInput<"base">>>;
      readonly layers?: readonly TokenLayerInput<"base">[];
    }
  | {
      readonly $schema?: string;
      readonly formatVersion?: 1;
      readonly modes: readonly [Mode, ...Mode[]];
      readonly defaultMode: Mode;
      readonly defaultVisibility?: TokenVisibility;
      readonly tokens: Readonly<Record<string, TokenDefinitionAuthoringInput<Mode>>>;
      readonly layers?: readonly TokenLayerInput<Mode>[];
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

export interface TokenGraphToken {
  readonly visibility: TokenVisibility;
  readonly valueByMode: Readonly<Record<string, ColorExpression>>;
  readonly origin: TokenOrigin;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

export interface TokenGraph {
  readonly formatVersion: 1;
  readonly modes: readonly [string, ...string[]];
  readonly defaultMode: string;
  readonly tokens: Readonly<Record<string, TokenGraphToken>>;
}

export type TokenGraphIssue =
  | ParseColorIssue
  | (Issue<
      | "invalid-object"
      | "unknown-property"
      | "missing-property"
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
      | "invalid-extension-key"
    > & {
      readonly key?: string;
      readonly mode?: string;
      readonly layerId?: string;
      readonly firstPath?: string;
      readonly cycle?: readonly string[];
    });

export function defineTokenGraph<
  const Tokens extends Readonly<Record<string, TokenDefinitionAuthoringInput<"base">>>,
>(input: {
  readonly $schema?: string;
  readonly formatVersion?: 1;
  readonly modes?: never;
  readonly defaultMode?: never;
  readonly defaultVisibility?: TokenVisibility;
  readonly tokens: Tokens;
  readonly layers?: readonly TokenLayerInput<"base">[];
}): TokenGraphInput<"base">;
export function defineTokenGraph<
  const Modes extends readonly [string, ...string[]],
  const Tokens extends Readonly<
    Record<string, TokenDefinitionAuthoringInput<NoInfer<Modes[number]>>>
  >,
>(input: {
  readonly $schema?: string;
  readonly formatVersion?: 1;
  readonly modes: Modes;
  readonly defaultMode: Modes[number];
  readonly defaultVisibility?: TokenVisibility;
  readonly tokens: Tokens;
  readonly layers?: readonly TokenLayerInput<NoInfer<Modes[number]>>[];
}): TokenGraphInput<Modes[number]>;
export function defineTokenGraph(input: TokenGraphAuthoringInput): TokenGraphInput {
  return defineTokenGraphFromInput(input);
}

function defineTokenGraphFromInput(input: TokenGraphAuthoringInput): TokenGraphInput {
  const modes = "modes" in input && input.modes !== undefined ? input.modes : ["base"];
  assertHelperModesCanUseShorthand(modes, "defineTokenGraph");
  const defaultMode =
    "defaultMode" in input && input.defaultMode !== undefined ? input.defaultMode : modes[0];
  return {
    ...(input.$schema === undefined ? {} : { $schema: input.$schema }),
    formatVersion: input.formatVersion ?? 1,
    modes: [...modes] as readonly [string, ...string[]],
    defaultMode,
    defaultVisibility: input.defaultVisibility ?? "public",
    tokens: normalizeTokenRecord(input.tokens, modes),
    ...(input.layers === undefined ? {} : { layers: input.layers }),
  };
}

export function defineTokens<
  const Tokens extends Readonly<Record<string, TokenDefinitionAuthoringInput<"base">>>,
>(
  tokens: Tokens,
  options?: {
    readonly $schema?: string;
    readonly formatVersion?: 1;
    readonly modes?: never;
    readonly defaultMode?: never;
    readonly defaultVisibility?: TokenVisibility;
    readonly layers?: readonly TokenLayerInput<"base">[];
    readonly tokens?: never;
  },
): TokenGraphInput<"base">;
export function defineTokens<
  const Modes extends readonly [string, ...string[]],
  const Tokens extends Readonly<
    Record<string, TokenDefinitionAuthoringInput<NoInfer<Modes[number]>>>
  >,
>(
  tokens: Tokens,
  options: {
    readonly $schema?: string;
    readonly formatVersion?: 1;
    readonly modes: Modes;
    readonly defaultMode: Modes[number];
    readonly defaultVisibility?: TokenVisibility;
    readonly layers?: readonly TokenLayerInput<NoInfer<Modes[number]>>[];
    readonly tokens?: never;
  },
): TokenGraphInput<Modes[number]>;
export function defineTokens(
  tokens: Readonly<Record<string, TokenDefinitionAuthoringInput>>,
  options: Omit<TokenGraphAuthoringInput, "tokens"> & { readonly tokens?: never } = {},
): TokenGraphInput {
  assertDefineTokensOptions(options);
  return defineTokenGraphFromInput({ ...options, tokens } as TokenGraphAuthoringInput);
}

export function defineTokenLayer<const Mode extends string = string>(
  input: TokenLayerAuthoringInput<Mode>,
): TokenLayerInput<Mode> {
  const modes = input.modes;
  if (modes !== undefined) {
    assertHelperModesCanUseShorthand(modes, "defineTokenLayer");
  }
  return {
    ...(input.$schema === undefined ? {} : { $schema: input.$schema }),
    formatVersion: input.formatVersion ?? 1,
    id: input.id,
    defaultVisibility: input.defaultVisibility ?? "public",
    tokens: normalizeTokenRecord(input.tokens, modes) as Readonly<
      Record<string, TokenDefinitionInput<Mode>>
    >,
  };
}

export function isReferenceInput(input: unknown): input is ReferenceInput {
  const entries = readPlainRecord(input, {
    code: "invalid-reference",
    message: "Reference probes must be plain data.",
  });
  return entries.ok && entries.value.some((entry) => entry.key === "ref");
}

export type ParseTokenGraphResult = Result<TokenGraph, TokenGraphIssue>;

const tokenDefinitionKeys = new Set([
  "visibility",
  "description",
  "deprecated",
  "extensions",
  "value",
  "valueByMode",
]);

function normalizeTokenRecord(
  input: Readonly<Record<string, TokenDefinitionAuthoringInput>>,
  modes: readonly string[] | undefined,
): Readonly<Record<string, TokenDefinitionInput>> {
  const output: Record<string, TokenDefinitionInput> = {};
  for (const key of Object.keys(input)) {
    defineRecordValue(output, key, normalizeTokenDefinition(input[key], modes));
  }
  return output;
}

function normalizeTokenDefinition(
  input: TokenDefinitionAuthoringInput | undefined,
  modes: readonly string[] | undefined,
): TokenDefinitionInput {
  if (isTokenDefinitionObject(input)) {
    return normalizeObjectTokenDefinition(input);
  }

  if (modes !== undefined && isModeValueRecord(input, modes)) {
    return { valueByMode: normalizeModeValues(input) };
  }

  return { value: normalizeColorExpression(input as ColorExpressionInput) };
}

function normalizeObjectTokenDefinition(
  input: TokenDefinitionMetadataAuthoringInput &
    Partial<TokenDefinitionInput> &
    Readonly<Record<string, unknown>>,
): TokenDefinitionInput {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "Token definition probes must be plain data.",
  });
  if (!entries.ok) {
    return input as TokenDefinitionInput;
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
      return metadata as TokenDefinitionInput;
    }
    const modeValues: Record<string, ColorExpressionInput> = {};
    for (const entry of modeEntries) {
      defineRecordValue(modeValues, entry.key, entry.value as ColorExpressionInput);
    }
    return { ...metadata, valueByMode: normalizeModeValues(modeValues) };
  }
  return { ...metadata, valueByMode: normalizeModeValues(valueByMode) };
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
): Readonly<Record<string, ColorExpressionInput>> {
  const output: Record<string, ColorExpressionInput> = {};
  for (const mode of Object.keys(input)) {
    defineRecordValue(output, mode, normalizeColorExpression(input[mode] as ColorExpressionInput));
  }
  return output;
}

function normalizeColorExpression(input: ColorExpressionInput): ColorExpressionInput {
  if (typeof input !== "string") {
    return input;
  }
  if (parseColor(input).ok || !isTokenKey(input)) {
    return input;
  }
  return { ref: input };
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
