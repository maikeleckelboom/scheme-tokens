import type { JsonValue } from "./json";
import { defineRecordValue, readPlainRecord } from "./json";
import { isSingleSegmentIdentifier, isTokenKey } from "./identifiers";
import type { FailureResult, Issue } from "./result";
import { describeUnknown } from "./unknown-description";

export const tokenGraphKind = "scheme-tokens/token-graph";
export const tokenLayerKind = "scheme-tokens/token-layer";
export const compiledSchemeKind = "scheme-tokens/compiled-scheme";

export type TokenGraphKind = typeof tokenGraphKind;
export type TokenLayerKind = typeof tokenLayerKind;
export type CompiledSchemeKind = typeof compiledSchemeKind;

export type TokenVisibility = "public" | "internal";

export interface ReferenceInput<Key extends string = string> {
  readonly ref: Key;
}

export type TokenExpressionInput<Key extends string = string> = string | ReferenceInput<Key>;

export type TokenDefinitionInput<Mode extends string = string, Key extends string = string> = {
  readonly visibility?: TokenVisibility;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
} & (
  | {
      readonly value: TokenExpressionInput<Key>;
      readonly valueByMode?: never;
    }
  | {
      readonly value?: never;
      readonly valueByMode: Readonly<Record<Mode, TokenExpressionInput<Key>>>;
    }
);

export interface TokenLayerInput<Mode extends string = string, Key extends string = string> {
  readonly $schema?: string;
  readonly kind: TokenLayerKind;
  readonly formatVersion: 1;
  readonly id: string;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<Key, TokenDefinitionInput<Mode, Key>>>;
}

export interface TokenGraphInput<Mode extends string = string, Key extends string = string> {
  readonly $schema?: string;
  readonly kind: TokenGraphKind;
  readonly formatVersion: 1;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: Readonly<Record<Key, TokenDefinitionInput<Mode, Key>>>;
  readonly layers?: readonly TokenLayerInput<Mode>[];
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
      Readonly<Partial<Record<Mode, TokenExpressionInput<Key>>>>;

type TokenDefinitionObjectAuthoringInput<
  Mode extends string,
  Key extends string,
> = TokenDefinitionMetadataAuthoringInput &
  (
    | {
        readonly value: TokenExpressionInput<Key>;
        readonly valueByMode?: never;
      }
    | {
        readonly value?: never;
        readonly valueByMode: Readonly<Record<Mode, TokenExpressionInput<Key>>>;
      }
  );

export type TokenDefinitionAuthoringInput<
  Mode extends string = string,
  Key extends string = string,
> =
  | TokenDefinitionInput<Mode, Key>
  | TokenDefinitionObjectAuthoringInput<Mode, Key>
  | TokenExpressionInput<Key>
  | Readonly<Record<Mode, TokenExpressionInput<Key>>>
  | TokenDefinitionModeAuthoringInput<Mode, Key>;

type TokenDefinitionReservedKey =
  | keyof TokenDefinitionMetadataAuthoringInput
  | "value"
  | "valueByMode";

type TokenDefinitionModeKey<Input> = Input extends TokenExpressionInput
  ? never
  : Input extends { readonly value: unknown }
    ? never
    : Input extends { readonly valueByMode: unknown }
      ? never
      : Exclude<Extract<keyof Input, string>, TokenDefinitionReservedKey>;

type InferredDefineTokensMode<Tokens extends Readonly<Record<string, unknown>>> = [
  TokenDefinitionModeKey<Tokens[keyof Tokens]>,
] extends [never]
  ? "base"
  : TokenDefinitionModeKey<Tokens[keyof Tokens]>;

type DefineTokensRecord = Readonly<Record<string, TokenDefinitionAuthoringInput<string, string>>>;

type DefineTokensOptions<Mode extends string> = {
  readonly $schema?: string;
  readonly kind?: TokenGraphKind;
  readonly formatVersion?: 1;
  readonly modes?: never;
  readonly defaultMode?: never;
  readonly defaultVisibility?: TokenVisibility;
  readonly layers?: readonly TokenLayerInput<Mode>[];
  readonly tokens?: never;
  readonly aliases?: never;
};

type DefinedTokensGraph<Mode extends string, Key extends string> = TokenGraphInput<Mode, Key>;

export interface TokenLayerAuthoringInput<
  Mode extends string = string,
  Key extends string = string,
  AliasKey extends string = string,
> {
  readonly $schema?: string;
  readonly kind?: TokenLayerKind;
  readonly formatVersion?: 1;
  readonly id: string;
  readonly defaultVisibility?: TokenVisibility;
  readonly modes?: readonly [Mode, ...Mode[]];
  readonly tokens?: Readonly<Record<Key, TokenDefinitionAuthoringInput<Mode, Key>>>;
  readonly aliases?: Readonly<Record<AliasKey, string>>;
}

export type TokenGraphAuthoringInput<Mode extends string = string, Key extends string = string> =
  | {
      readonly $schema?: string;
      readonly kind?: TokenGraphKind;
      readonly formatVersion?: 1;
      readonly modes?: never;
      readonly defaultMode?: never;
      readonly defaultVisibility?: TokenVisibility;
      readonly tokens?: Readonly<Record<Key, TokenDefinitionAuthoringInput<"base", Key>>>;
      readonly aliases?: Readonly<Record<string, string>>;
      readonly layers?: readonly TokenLayerInput<"base">[];
    }
  | {
      readonly $schema?: string;
      readonly kind?: TokenGraphKind;
      readonly formatVersion?: 1;
      readonly modes: readonly [Mode, ...Mode[]];
      readonly defaultMode: Mode;
      readonly defaultVisibility?: TokenVisibility;
      readonly tokens?: Readonly<Record<Key, TokenDefinitionAuthoringInput<Mode, Key>>>;
      readonly aliases?: Readonly<Record<string, string>>;
      readonly layers?: readonly TokenLayerInput<Mode>[];
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

type LayerTokenKeyOf<T> = T extends { readonly layers: infer Layers }
  ? Layers extends readonly (infer Layer)[]
    ? TokenKeyOf<Layer>
    : never
  : never;

export type TokenKeyOf<T> = DirectTokenKeyOf<T> | LayerTokenKeyOf<T>;

export type ModeOf<T> = T extends { readonly modes: readonly [infer First, ...infer Rest] }
  ? Extract<First | Rest[number], string>
  : T extends { readonly defaultMode: infer Mode }
    ? Extract<Mode, string>
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
  | "duplicate-token-key"
  | "invalid-visibility"
  | "invalid-token-definition"
  | "missing-token-value"
  | "conflicting-token-value"
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

export function tokenRef<const Key extends string>(key: Key): ReferenceInput<Key> {
  if (!isTokenKey(key)) {
    throw new RangeError("tokenRef key must be a dot-separated lower-kebab token key.");
  }
  return { ref: key };
}

type TokenAuthoringRecord<Mode extends string> = Readonly<
  Record<string, TokenDefinitionAuthoringInput<Mode, string>>
>;

type TokenAliasAuthoringRecord = Readonly<Record<string, string>>;

export function defineTokenGraph<
  const Tokens extends TokenAuthoringRecord<"base"> = Record<never, never>,
  const Aliases extends TokenAliasAuthoringRecord = Record<never, never>,
  const Layers extends readonly TokenLayerInput<"base", string>[] = readonly TokenLayerInput<
    "base",
    string
  >[],
>(input: {
  readonly $schema?: string;
  readonly kind?: TokenGraphKind;
  readonly formatVersion?: 1;
  readonly modes?: never;
  readonly defaultMode?: never;
  readonly defaultVisibility?: TokenVisibility;
  readonly tokens?: Tokens;
  readonly aliases?: Aliases;
  readonly layers: Layers;
}): TokenGraphInput<"base", Extract<keyof Tokens | keyof Aliases, string>> & {
  readonly layers: Layers;
};
export function defineTokenGraph<
  const Tokens extends TokenAuthoringRecord<"base"> = Record<never, never>,
  const Aliases extends TokenAliasAuthoringRecord = Record<never, never>,
>(input: {
  readonly $schema?: string;
  readonly kind?: TokenGraphKind;
  readonly formatVersion?: 1;
  readonly modes?: never;
  readonly defaultMode?: never;
  readonly defaultVisibility?: TokenVisibility;
  readonly tokens?: Tokens;
  readonly aliases?: Aliases;
  readonly layers?: readonly TokenLayerInput<"base">[];
}): TokenGraphInput<"base", Extract<keyof Tokens | keyof Aliases, string>>;
export function defineTokenGraph<
  const Modes extends readonly [string, ...string[]],
  const Tokens extends TokenAuthoringRecord<NoInfer<Modes[number]>> = Record<never, never>,
  const Aliases extends TokenAliasAuthoringRecord = Record<never, never>,
  const Layers extends readonly TokenLayerInput<NoInfer<Modes[number]>, string>[] =
    readonly TokenLayerInput<NoInfer<Modes[number]>, string>[],
>(input: {
  readonly $schema?: string;
  readonly kind?: TokenGraphKind;
  readonly formatVersion?: 1;
  readonly modes: Modes;
  readonly defaultMode: Modes[number];
  readonly defaultVisibility?: TokenVisibility;
  readonly tokens?: Tokens;
  readonly aliases?: Aliases;
  readonly layers: Layers;
}): TokenGraphInput<Modes[number], Extract<keyof Tokens | keyof Aliases, string>> & {
  readonly layers: Layers;
};
export function defineTokenGraph<
  const Modes extends readonly [string, ...string[]],
  const Tokens extends TokenAuthoringRecord<NoInfer<Modes[number]>> = Record<never, never>,
  const Aliases extends TokenAliasAuthoringRecord = Record<never, never>,
>(input: {
  readonly $schema?: string;
  readonly kind?: TokenGraphKind;
  readonly formatVersion?: 1;
  readonly modes: Modes;
  readonly defaultMode: Modes[number];
  readonly defaultVisibility?: TokenVisibility;
  readonly tokens?: Tokens;
  readonly aliases?: Aliases;
  readonly layers?: readonly TokenLayerInput<NoInfer<Modes[number]>>[];
}): TokenGraphInput<Modes[number], Extract<keyof Tokens | keyof Aliases, string>>;
export function defineTokenGraph(input: TokenGraphAuthoringInput): TokenGraphInput {
  return defineTokenGraphFromInput(input, "defineTokenGraph");
}

function defineTokenGraphFromInput(
  input: TokenGraphAuthoringInput,
  helperName: string,
): TokenGraphInput {
  assertGraphHelperInput(input, helperName);
  if (input.kind !== undefined && input.kind !== tokenGraphKind) {
    throw new RangeError(`${helperName} kind must be ${tokenGraphKind}.`);
  }
  const modes = "modes" in input && input.modes !== undefined ? input.modes : ["base"];
  assertHelperModesCanUseShorthand(modes, helperName);
  const defaultMode =
    "defaultMode" in input && input.defaultMode !== undefined ? input.defaultMode : modes[0];
  return {
    ...(input.$schema === undefined ? {} : { $schema: input.$schema }),
    kind: tokenGraphKind,
    formatVersion: input.formatVersion ?? 1,
    modes: [...modes] as readonly [string, ...string[]],
    defaultMode,
    defaultVisibility: input.defaultVisibility ?? "public",
    tokens: normalizeTokenAndAliasRecords(input.tokens ?? {}, input.aliases, modes, helperName),
    ...(input.layers === undefined ? {} : { layers: input.layers }),
  };
}

/**
 * Define an authored token graph from ordinary token records.
 */
export function defineTokens<const Tokens extends DefineTokensRecord>(
  tokens: Tokens,
  options?: DefineTokensOptions<InferredDefineTokensMode<Tokens>>,
): DefinedTokensGraph<InferredDefineTokensMode<Tokens>, Extract<keyof Tokens, string>>;
export function defineTokens<
  const Modes extends readonly [string, ...string[]],
  const Tokens extends Readonly<
    Record<string, TokenDefinitionAuthoringInput<NoInfer<Modes[number]>, string>>
  >,
>(
  tokens: Tokens,
  options: {
    readonly $schema?: string;
    readonly kind?: TokenGraphKind;
    readonly formatVersion?: 1;
    readonly modes: Modes;
    readonly defaultMode: Modes[number];
    readonly defaultVisibility?: TokenVisibility;
    readonly layers?: readonly TokenLayerInput<NoInfer<Modes[number]>>[];
    readonly tokens?: never;
    readonly aliases?: never;
  },
): TokenGraphInput<Modes[number], Extract<keyof Tokens, string>>;
export function defineTokens(
  tokens: Readonly<Record<string, TokenDefinitionAuthoringInput>>,
  options: Omit<TokenGraphAuthoringInput, "tokens" | "aliases"> & {
    readonly tokens?: never;
    readonly aliases?: never;
  } = {},
): TokenGraphInput {
  assertDefineTokensOptions(options);
  const inferredModes = inferDefineTokensModes(tokens, options);
  const graphOptions =
    inferredModes === undefined
      ? options
      : {
          ...options,
          modes: inferredModes,
          defaultMode: inferredModes[0],
        };
  return defineTokenGraphFromInput(
    { ...graphOptions, tokens } as TokenGraphAuthoringInput,
    "defineTokens",
  );
}

export function defineTokenLayer<
  const Mode extends string = string,
  const Tokens extends Readonly<Record<string, TokenDefinitionAuthoringInput<Mode, string>>> =
    Readonly<Record<string, TokenDefinitionAuthoringInput<Mode>>>,
  const Aliases extends TokenAliasAuthoringRecord = Record<never, never>,
>(
  input: TokenLayerAuthoringInput<Mode, string, string> & {
    readonly tokens?: Tokens;
    readonly aliases?: Aliases;
  },
): TokenLayerInput<Mode, Extract<keyof Tokens | keyof Aliases, string>> {
  if (input.kind !== undefined && input.kind !== tokenLayerKind) {
    throw new RangeError(`defineTokenLayer kind must be ${tokenLayerKind}.`);
  }
  const modes = input.modes;
  if (modes !== undefined) {
    assertHelperModesCanUseShorthand(modes, "defineTokenLayer");
  }
  return {
    ...(input.$schema === undefined ? {} : { $schema: input.$schema }),
    kind: tokenLayerKind,
    formatVersion: input.formatVersion ?? 1,
    id: input.id,
    defaultVisibility: input.defaultVisibility ?? "public",
    tokens: normalizeTokenAndAliasRecords(
      input.tokens ?? {},
      input.aliases,
      modes,
      "defineTokenLayer",
    ) as Readonly<Record<string, TokenDefinitionInput<Mode>>>,
  } as TokenLayerInput<Mode, Extract<keyof Tokens | keyof Aliases, string>>;
}

export function isReferenceInput(input: unknown): input is ReferenceInput {
  const entries = readPlainRecord(input, {
    code: "invalid-reference",
    message: "Reference probes must be plain data.",
  });
  return entries.ok && entries.value.some((entry) => entry.key === "ref");
}

export type ParseTokenGraphResult<Mode extends string = string, Key extends string = string> =
  | {
      readonly ok: true;
      readonly graph: TokenGraphInput<Mode, Key>;
    }
  | FailureResult<TokenGraphIssue>;

export type ParseTokenLayerResult<Mode extends string = string, Key extends string = string> =
  | {
      readonly ok: true;
      readonly layer: TokenLayerInput<Mode, Key>;
    }
  | FailureResult<TokenGraphIssue>;

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
  laneName: "tokens",
): Readonly<Record<string, TokenDefinitionInput>> {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: `${helperName} ${laneName} must be a plain object record.`,
  });
  if (!entries.ok) {
    throw new TypeError(`${helperName} ${laneName} must be a plain object record.`);
  }

  const output: Record<string, TokenDefinitionInput> = {};
  for (const entry of entries.value) {
    defineRecordValue(
      output,
      entry.key,
      normalizeTokenDefinition(
        entry.value as TokenDefinitionAuthoringInput,
        modes,
        helperName,
        entry.key,
      ),
    );
  }
  return output;
}

function normalizeTokenAndAliasRecords(
  tokensInput: unknown,
  aliasesInput: unknown,
  modes: readonly string[] | undefined,
  helperName: string,
): Readonly<Record<string, TokenDefinitionInput>> {
  const output = {
    ...normalizeTokenRecord(tokensInput, modes, helperName, "tokens"),
  };
  if (aliasesInput === undefined) {
    return output;
  }

  const entries = readPlainRecord(aliasesInput, {
    code: "invalid-token-definition",
    message: `${helperName} aliases must be a plain object record.`,
  });
  if (!entries.ok) {
    throw new TypeError(`${helperName} aliases must be a plain object record.`);
  }

  for (const entry of entries.value) {
    if (Object.hasOwn(output, entry.key)) {
      throw new RangeError(
        `${helperName} aliases cannot redefine token "${entry.key}" from tokens.`,
      );
    }
    if (typeof entry.value !== "string") {
      throw new TypeError(`${helperName} alias "${entry.key}" must target a token key string.`);
    }
    defineRecordValue(output, entry.key, {
      value: normalizeReferenceInput({ ref: entry.value }, helperName, entry.key),
    });
  }
  return output;
}

function assertGraphHelperInput(
  input: unknown,
  helperName: string,
): asserts input is TokenGraphAuthoringInput {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: `${helperName} input must be a plain object.`,
  });
  if (!entries.ok) {
    throw new TypeError(`${helperName} input must be a plain object.`);
  }
  if (
    !entries.value.some((entry) => entry.key === "tokens") &&
    !entries.value.some((entry) => entry.key === "aliases")
  ) {
    throw new TypeError(`${helperName} input must include tokens or aliases.`);
  }
}

function normalizeTokenDefinition(
  input: TokenDefinitionAuthoringInput | undefined,
  modes: readonly string[] | undefined,
  helperName: string,
  tokenKey: string,
): TokenDefinitionInput {
  if (isTokenDefinitionObject(input)) {
    return normalizeObjectTokenDefinition(input, helperName, tokenKey);
  }

  if (modes !== undefined && isModeValueRecord(input, modes)) {
    return { valueByMode: normalizeModeValues(input, helperName, tokenKey) };
  }

  return { value: normalizeTokenExpression(input as TokenExpressionInput, helperName, tokenKey) };
}

function normalizeObjectTokenDefinition(
  input: TokenDefinitionMetadataAuthoringInput & Readonly<Record<string, unknown>>,
  helperName: string,
  tokenKey: string,
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
    return {
      ...metadata,
      value: normalizeTokenExpression(input.value as TokenExpressionInput, helperName, tokenKey),
    };
  }
  const valueByMode = "valueByMode" in input ? input.valueByMode : undefined;
  if (valueByMode === undefined) {
    if (modeEntries.length === 0) {
      throw new TypeError(`${helperName} token "${tokenKey}" must include a value.`);
    }
    const modeValues: Record<string, TokenExpressionInput> = {};
    for (const entry of modeEntries) {
      defineRecordValue(modeValues, entry.key, entry.value as TokenExpressionInput);
    }
    return { ...metadata, valueByMode: normalizeModeValues(modeValues, helperName, tokenKey) };
  }
  return {
    ...metadata,
    valueByMode: normalizeModeValues(
      valueByMode as Readonly<Record<string, TokenExpressionInput>>,
      helperName,
      tokenKey,
    ),
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
  input: Readonly<Record<string, TokenExpressionInput>>,
  helperName: string,
  tokenKey: string,
): Readonly<Record<string, TokenExpressionInput>> {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "valueByMode must be a plain object record.",
  });
  if (!entries.ok) {
    throw new TypeError(`${helperName} token "${tokenKey}" valueByMode must be a plain object.`);
  }
  const output: Record<string, TokenExpressionInput> = {};
  for (const entry of entries.value) {
    defineRecordValue(
      output,
      entry.key,
      normalizeTokenExpression(entry.value as TokenExpressionInput, helperName, tokenKey),
    );
  }
  return output;
}

function normalizeTokenExpression(
  input: TokenExpressionInput,
  helperName: string,
  tokenKey: string,
): TokenExpressionInput {
  if (isReferenceInput(input)) {
    return normalizeReferenceInput(input, helperName, tokenKey);
  }
  if (typeof input === "string") {
    return input;
  }
  throw new TypeError(
    `${helperName} token "${tokenKey}" must be an authored CSS string or explicit token reference (${describeUnknown(
      input,
    )}). Use tokenRef("token.key") or { ref: "token.key" } for references.`,
  );
}

function normalizeReferenceInput(
  input: ReferenceInput,
  helperName: string,
  tokenKey: string,
): ReferenceInput {
  const entries = readPlainRecord(input, {
    code: "invalid-reference",
    message: "Reference helpers must be plain data.",
  });
  if (!entries.ok) {
    throw new TypeError(`${helperName} token "${tokenKey}" reference must be a plain object.`);
  }
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  if (entries.value.length !== 1 || typeof record.get("ref") !== "string") {
    throw new TypeError(
      `${helperName} token "${tokenKey}" reference must contain exactly one ref string.`,
    );
  }
  const key = record.get("ref") as string;
  if (!isTokenKey(key)) {
    throw new RangeError(
      `${helperName} token "${tokenKey}" reference must be a dot-separated lower-kebab token key.`,
    );
  }
  return { ref: key };
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
): input is Readonly<Record<string, TokenExpressionInput>> {
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

function inferDefineTokensModes(
  tokens: Readonly<Record<string, TokenDefinitionAuthoringInput>>,
  options: Omit<TokenGraphAuthoringInput, "tokens" | "aliases">,
): readonly [string, ...string[]] | undefined {
  if ("modes" in options && options.modes !== undefined) {
    return undefined;
  }
  if ("defaultMode" in options && options.defaultMode !== undefined) {
    return undefined;
  }

  const entries = readPlainRecord(tokens, {
    code: "invalid-token-definition",
    message: "defineTokens token inference requires a plain object record.",
  });
  if (!entries.ok) {
    return undefined;
  }

  const modeSet = new Set<string>();
  for (const entry of entries.value) {
    for (const mode of inferModeRecordKeys(entry.value)) {
      modeSet.add(mode);
    }
  }

  if (modeSet.size === 0) {
    return undefined;
  }

  const sortedModes = [...modeSet].sort();
  if (modeSet.has("base")) {
    return ["base", ...sortedModes.filter((mode) => mode !== "base")];
  }
  return sortedModes as [string, ...string[]];
}

function inferModeRecordKeys(input: unknown): readonly string[] {
  if (isReferenceInput(input)) {
    return [];
  }

  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "Mode inference probes must be plain data.",
  });
  if (!entries.ok || entries.value.length === 0) {
    return [];
  }

  if (entries.value.some((entry) => entry.key === "value" || entry.key === "valueByMode")) {
    return [];
  }

  const modes: string[] = [];
  for (const entry of entries.value) {
    if (tokenDefinitionKeys.has(entry.key)) {
      continue;
    }
    if (!isSingleSegmentIdentifier(entry.key)) {
      return [];
    }
    modes.push(entry.key);
  }
  return modes;
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
  if (entries.value.some((entry) => entry.key === "aliases")) {
    throw new RangeError("defineTokens options cannot include aliases.");
  }
}
