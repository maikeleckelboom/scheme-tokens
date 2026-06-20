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

export interface TokenFragmentInput<Mode extends string = string> {
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
  readonly fragments?: readonly TokenFragmentInput<Mode>[];
}

export type TokenDefinitionAuthoringInput<Mode extends string = string> =
  | TokenDefinitionInput<Mode>
  | ColorExpressionInput
  | Readonly<Record<Mode, ColorExpressionInput>>;

export interface TokenFragmentAuthoringInput<Mode extends string = string> {
  readonly $schema?: string;
  readonly formatVersion?: 1;
  readonly id: string;
  readonly defaultVisibility?: TokenVisibility;
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
      readonly fragments?: readonly TokenFragmentInput<"base">[];
    }
  | {
      readonly $schema?: string;
      readonly formatVersion?: 1;
      readonly modes: readonly [Mode, ...Mode[]];
      readonly defaultMode: Mode;
      readonly defaultVisibility?: TokenVisibility;
      readonly tokens: Readonly<Record<string, TokenDefinitionAuthoringInput<Mode>>>;
      readonly fragments?: readonly TokenFragmentInput<Mode>[];
    };

export type TokenOrigin =
  | {
      readonly kind: "graph";
    }
  | {
      readonly kind: "fragment";
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
      | "invalid-fragment-id"
      | "duplicate-fragment-id"
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
      readonly fragmentId?: string;
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
  readonly fragments?: readonly TokenFragmentInput<"base">[];
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
  readonly fragments?: readonly TokenFragmentInput<NoInfer<Modes[number]>>[];
}): TokenGraphInput<Modes[number]>;
export function defineTokenGraph(input: TokenGraphAuthoringInput): TokenGraphInput {
  const modes = "modes" in input && input.modes !== undefined ? input.modes : ["base"];
  assertHelperModesCanUseShorthand(modes);
  const defaultMode =
    "defaultMode" in input && input.defaultMode !== undefined ? input.defaultMode : modes[0];
  return {
    ...(input.$schema === undefined ? {} : { $schema: input.$schema }),
    formatVersion: input.formatVersion ?? 1,
    modes: [...modes] as readonly [string, ...string[]],
    defaultMode,
    defaultVisibility: input.defaultVisibility ?? "public",
    tokens: normalizeTokenRecord(input.tokens, modes),
    ...(input.fragments === undefined ? {} : { fragments: input.fragments }),
  };
}

export function defineTokenFragment<const Mode extends string = string>(input: {
  readonly $schema?: string;
  readonly formatVersion?: 1;
  readonly id: string;
  readonly defaultVisibility?: TokenVisibility;
  readonly tokens: Readonly<Record<string, TokenDefinitionAuthoringInput<Mode>>>;
}): TokenFragmentInput<Mode> {
  return {
    ...(input.$schema === undefined ? {} : { $schema: input.$schema }),
    formatVersion: input.formatVersion ?? 1,
    id: input.id,
    defaultVisibility: input.defaultVisibility ?? "public",
    tokens: normalizeTokenRecord(input.tokens, undefined) as Readonly<
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
  if (isTokenDefinitionInput(input)) {
    return normalizeExplicitTokenDefinition(input);
  }

  if (modes !== undefined && isModeValueRecord(input, modes)) {
    return { valueByMode: normalizeModeValues(input) };
  }

  return { value: normalizeColorExpression(input as ColorExpressionInput) };
}

function normalizeExplicitTokenDefinition(input: TokenDefinitionInput): TokenDefinitionInput {
  if ("value" in input && input.value !== undefined) {
    return { ...input, value: normalizeColorExpression(input.value) };
  }
  const valueByMode = "valueByMode" in input ? input.valueByMode : undefined;
  if (valueByMode === undefined) {
    return input;
  }
  return { ...input, valueByMode: normalizeModeValues(valueByMode) };
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

function isTokenDefinitionInput(input: unknown): input is TokenDefinitionInput {
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

function assertHelperModesCanUseShorthand(modes: readonly string[]): void {
  const reserved = modes.filter((mode) => tokenDefinitionKeys.has(mode));
  if (reserved.length > 0) {
    throw new RangeError(
      `defineTokenGraph mode names cannot use token-definition keys: ${reserved.join(", ")}.`,
    );
  }
}
