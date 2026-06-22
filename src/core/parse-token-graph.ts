import type {
  TokenDefinitionInput,
  TokenExpressionInput,
  TokenGraphInput,
  TokenGraphIssue,
  ParseTokenGraphResult,
  ParseTokenLayerResult,
  TokenLayerInput,
  ReferenceInput,
  TokenOrigin,
  TokenVisibility,
} from "./graph";
import { tokenGraphKind, tokenLayerKind, isReferenceInput } from "./graph";
import { isSingleSegmentIdentifier, isTokenKey } from "./identifiers";
import {
  compareCodeUnits,
  copyJsonValue,
  defineRecordValue,
  pointer,
  readArray,
  readPlainRecord,
  sortedRecord,
} from "./json";
import type { JsonValue } from "./json";
import { IssueCollector, type FailureResult, type Result } from "./result";

interface ParsedToken {
  readonly visibility: TokenVisibility;
  readonly valueByMode: Readonly<Record<string, ParsedTokenExpression>>;
  readonly expressionPathsByMode: Readonly<Record<string, string>>;
  readonly origin: TokenOrigin;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

interface TokenDeclaration {
  readonly key: string;
  readonly path: string;
  readonly token: ParsedToken;
}

export type ParsedTokenExpression<Key extends string = string> = string | ReferenceInput<Key>;

export interface ParsedTokenGraphToken<Mode extends string = string, Key extends string = string> {
  readonly visibility: TokenVisibility;
  readonly valueByMode: Readonly<Record<Mode, ParsedTokenExpression<Key>>>;
  readonly origin: TokenOrigin;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

export interface ParsedTokenGraph<Mode extends string = string, Key extends string = string> {
  readonly kind: typeof tokenGraphKind;
  readonly formatVersion: 1;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly tokens: Readonly<Record<Key, ParsedTokenGraphToken<Mode, Key>>>;
}

const topLevelKeys = new Set([
  "$schema",
  "kind",
  "formatVersion",
  "modes",
  "defaultMode",
  "defaultVisibility",
  "tokens",
  "layers",
]);

const layerKeys = new Set([
  "$schema",
  "kind",
  "formatVersion",
  "id",
  "defaultVisibility",
  "tokens",
]);
const tokenKeys = new Set([
  "visibility",
  "description",
  "deprecated",
  "extensions",
  "value",
  "valueByMode",
]);

export function parseTokenGraph(input: unknown): ParseTokenGraphResult {
  const parsed = parseTokenGraphArtifact(input);
  return parsed.ok ? { ok: true, graph: parsed.value } : parsed;
}

export function parseTokenLayer(input: unknown): ParseTokenLayerResult {
  const collector = new IssueCollector<TokenGraphIssue>();
  const layer = parseStandaloneLayer(input, collector);
  const issues = collector.issues();
  return issues === undefined && layer !== undefined ? { ok: true, layer } : fail(issues);
}

function parseTokenGraphArtifact(input: unknown): Result<TokenGraphInput, TokenGraphIssue> {
  const collector = new IssueCollector<TokenGraphIssue>();
  const top = readPlainRecord(input, {
    code: "invalid-object",
    message: "Token graph must be a plain object.",
  });
  if (!top.ok) {
    return top as Result<never, TokenGraphIssue>;
  }

  const graphRecord = new Map(top.value.map((entry) => [entry.key, entry.value]));
  rejectUnknownKeys(top.value, topLevelKeys, "", collector);
  parseKind(graphRecord.get("kind"), tokenGraphKind, pointer("kind"), collector);

  const formatVersion = graphRecord.get("formatVersion");
  if (formatVersion !== 1) {
    collector.add({
      code: formatVersion === undefined ? "missing-property" : "invalid-format-version",
      message: "Token graph formatVersion must be numeric 1.",
      path: pointer("formatVersion"),
    });
  }

  const schema = graphRecord.get("$schema");
  if (schema !== undefined && typeof schema !== "string") {
    collector.add({
      code: "invalid-schema-uri",
      message: "$schema must be a string when present.",
      path: pointer("$schema"),
    });
  }

  const modes = parseModes(graphRecord.get("modes"), collector);
  const defaultMode = parseDefaultMode(graphRecord.get("defaultMode"), modes, collector);
  const canonicalModes =
    modes === undefined || defaultMode === undefined
      ? undefined
      : canonicalizeModes(modes, defaultMode);
  const defaultVisibility = parseVisibility(
    graphRecord.get("defaultVisibility"),
    pointer("defaultVisibility"),
    "invalid-default-visibility",
    collector,
  );

  const tokensInput = graphRecord.get("tokens");
  if (tokensInput === undefined) {
    collector.add({
      code: "missing-property",
      message: "Token graph requires tokens.",
      path: pointer("tokens"),
    });
  }
  const tokens =
    tokensInput === undefined
      ? undefined
      : parseStandaloneLayerTokens(tokensInput, pointer("tokens"), collector, canonicalModes);
  const layers = parseGraphLayersArtifact(graphRecord.get("layers"), canonicalModes, collector);

  const issues = collector.issues();
  if (issues !== undefined) {
    return { ok: false, issues };
  }
  if (
    canonicalModes === undefined ||
    defaultMode === undefined ||
    defaultVisibility === undefined ||
    tokens === undefined
  ) {
    return fail(undefined);
  }

  const artifact: TokenGraphInput = {
    ...(typeof schema === "string" ? { $schema: schema } : {}),
    kind: tokenGraphKind,
    formatVersion: 1,
    modes: canonicalModes as readonly [string, ...string[]],
    defaultMode,
    defaultVisibility,
    tokens,
    ...(layers === undefined ? {} : { layers }),
  };
  const internal = parseTokenGraphInternal(artifact);
  return internal.ok ? { ok: true, value: artifact } : internal;
}

export function parseTokenGraphInternal(input: unknown): Result<ParsedTokenGraph, TokenGraphIssue> {
  const collector = new IssueCollector<TokenGraphIssue>();
  const top = readPlainRecord(input, {
    code: "invalid-object",
    message: "Token graph must be a plain object.",
  });
  if (!top.ok) {
    return top as Result<never, TokenGraphIssue>;
  }

  const graphRecord = new Map(top.value.map((entry) => [entry.key, entry.value]));
  rejectUnknownKeys(top.value, topLevelKeys, "", collector);
  parseKind(graphRecord.get("kind"), tokenGraphKind, pointer("kind"), collector);

  const formatVersion = graphRecord.get("formatVersion");
  if (formatVersion !== 1) {
    collector.add({
      code: formatVersion === undefined ? "missing-property" : "invalid-format-version",
      message: "Token graph formatVersion must be numeric 1.",
      path: pointer("formatVersion"),
    });
  }

  const schema = graphRecord.get("$schema");
  if (schema !== undefined && typeof schema !== "string") {
    collector.add({
      code: "invalid-schema-uri",
      message: "$schema must be a string when present.",
      path: pointer("$schema"),
    });
  }

  const modes = parseModes(graphRecord.get("modes"), collector);
  const defaultMode = parseDefaultMode(graphRecord.get("defaultMode"), modes, collector);
  const canonicalModes =
    modes === undefined || defaultMode === undefined
      ? undefined
      : canonicalizeModes(modes, defaultMode);
  const defaultVisibility = parseVisibility(
    graphRecord.get("defaultVisibility"),
    pointer("defaultVisibility"),
    "invalid-default-visibility",
    collector,
  );

  const declarations = new Map<string, TokenDeclaration>();
  const graphTokenPaths = new Map<string, string>();
  const validModes = canonicalModes ?? [];

  const tokensInput = graphRecord.get("tokens");
  if (tokensInput === undefined) {
    collector.add({
      code: "missing-property",
      message: "Token graph requires tokens.",
      path: pointer("tokens"),
    });
  }
  if (tokensInput !== undefined && defaultVisibility !== undefined) {
    parseTokenRecord(tokensInput, {
      path: pointer("tokens"),
      modes: validModes,
      defaultVisibility,
      originForKey: () => ({ kind: "graph" }),
      collector,
      declarations,
      firstTokenPaths: graphTokenPaths,
    });
  }

  const layerIds = new Map<string, string>();
  const layersInput = graphRecord.get("layers");
  if (layersInput !== undefined) {
    const layers = readArray(layersInput, {
      code: "invalid-object",
      message: "layers must be a dense array of layer objects.",
      path: pointer("layers"),
    });
    if (!layers.ok) {
      collector.add({
        code: "invalid-object",
        message: "layers must be an array.",
        path: pointer("layers"),
      });
    } else {
      for (const entry of layers.value) {
        parseGraphLayer(entry.value, entry.index, {
          modes: validModes,
          collector,
          declarations,
          layerIds,
        });
      }
    }
  }

  const tokenMap = new Map(
    [...declarations.values()].map((declaration) => [declaration.key, declaration.token] as const),
  );
  validateReferences(tokenMap, validModes, collector);
  validateCycles(tokenMap, validModes, collector);

  const issues = collector.issues();
  if (issues !== undefined) {
    return { ok: false, issues };
  }

  if (canonicalModes === undefined || defaultMode === undefined) {
    return {
      ok: false,
      issues: [{ code: "empty-modes", message: "Token graph requires valid modes." }],
    };
  }

  return {
    ok: true,
    value: {
      kind: tokenGraphKind,
      formatVersion: 1,
      modes: canonicalModes as readonly [string, ...string[]],
      defaultMode,
      tokens: sortedRecord(
        [...declarations.values()].map(
          (declaration) => [declaration.key, toPublicToken(declaration.token)] as const,
        ),
      ),
    },
  };
}

function parseStandaloneLayer(
  input: unknown,
  collector: IssueCollector<TokenGraphIssue>,
): TokenLayerInput | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: "Token layer must be a plain object.",
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly TokenGraphIssue[]);
    return undefined;
  }
  rejectUnknownKeys(entries.value, layerKeys, "", collector);

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  parseKind(record.get("kind"), tokenLayerKind, pointer("kind"), collector);
  if (record.get("formatVersion") !== 1) {
    collector.add({
      code: record.has("formatVersion") ? "invalid-format-version" : "missing-property",
      message: "Token layer formatVersion must be numeric 1.",
      path: pointer("formatVersion"),
    });
  }

  const schema = record.get("$schema");
  if (schema !== undefined && typeof schema !== "string") {
    collector.add({
      code: "invalid-schema-uri",
      message: "$schema must be a string.",
      path: pointer("$schema"),
    });
  }

  const id = parseLayerId(record.get("id"), pointer("id"), collector);
  const defaultVisibility = parseVisibility(
    record.get("defaultVisibility"),
    pointer("defaultVisibility"),
    "invalid-default-visibility",
    collector,
  );
  const tokens = parseStandaloneLayerTokens(record.get("tokens"), pointer("tokens"), collector);
  if (record.get("tokens") === undefined) {
    collector.add({
      code: "missing-property",
      message: "Layer requires tokens.",
      path: pointer("tokens"),
    });
  }
  if (id === undefined || defaultVisibility === undefined || tokens === undefined) {
    return undefined;
  }
  return {
    ...(typeof schema === "string" ? { $schema: schema } : {}),
    kind: tokenLayerKind,
    formatVersion: 1,
    id,
    defaultVisibility,
    tokens,
  };
}

function parseGraphLayersArtifact(
  input: unknown,
  modes: readonly string[] | undefined,
  collector: IssueCollector<TokenGraphIssue>,
): readonly TokenLayerInput[] | undefined {
  if (input === undefined) {
    return undefined;
  }
  const layers = readArray(input, {
    code: "invalid-object",
    message: "layers must be a dense array of layer objects.",
    path: pointer("layers"),
  });
  if (!layers.ok) {
    collector.add({
      code: "invalid-object",
      message: "layers must be an array.",
      path: pointer("layers"),
    });
    return undefined;
  }

  const output: TokenLayerInput[] = [];
  const layerIds = new Map<string, string>();
  for (const entry of layers.value) {
    const layer = parseLayerArtifact(
      entry.value,
      pointer("layers", entry.index),
      modes,
      layerIds,
      collector,
    );
    if (layer !== undefined) {
      output.push(layer);
    }
  }
  return output;
}

function parseLayerArtifact(
  input: unknown,
  path: string,
  modes: readonly string[] | undefined,
  layerIds: Map<string, string>,
  collector: IssueCollector<TokenGraphIssue>,
): TokenLayerInput | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: "Layer must be a plain object.",
    path,
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly TokenGraphIssue[]);
    return undefined;
  }
  rejectUnknownKeys(entries.value, layerKeys, path, collector);

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  parseKind(record.get("kind"), tokenLayerKind, `${path}/kind`, collector);
  if (record.get("formatVersion") !== 1) {
    collector.add({
      code: record.has("formatVersion") ? "invalid-format-version" : "missing-property",
      message: "Layer formatVersion must be numeric 1.",
      path: `${path}/formatVersion`,
    });
  }

  const schema = record.get("$schema");
  if (schema !== undefined && typeof schema !== "string") {
    collector.add({
      code: "invalid-schema-uri",
      message: "$schema must be a string.",
      path: `${path}/$schema`,
    });
  }

  const id = parseLayerId(record.get("id"), `${path}/id`, collector);
  if (id !== undefined) {
    const firstPath = layerIds.get(id);
    if (firstPath !== undefined) {
      collector.add({
        code: "duplicate-layer-id",
        message: `Duplicate layer id: ${id}.`,
        path: `${path}/id`,
        layerId: id,
        firstPath,
      });
    } else {
      layerIds.set(id, `${path}/id`);
    }
  }

  const defaultVisibility = parseVisibility(
    record.get("defaultVisibility"),
    `${path}/defaultVisibility`,
    "invalid-default-visibility",
    collector,
  );
  const tokensInput = record.get("tokens");
  if (tokensInput === undefined) {
    collector.add({
      code: "missing-property",
      message: "Layer requires tokens.",
      path: `${path}/tokens`,
    });
  }
  const tokens =
    tokensInput === undefined
      ? undefined
      : parseStandaloneLayerTokens(tokensInput, `${path}/tokens`, collector, modes);
  if (id === undefined || defaultVisibility === undefined || tokens === undefined) {
    return undefined;
  }
  return {
    ...(typeof schema === "string" ? { $schema: schema } : {}),
    kind: tokenLayerKind,
    formatVersion: 1,
    id,
    defaultVisibility,
    tokens,
  };
}

function parseStandaloneLayerTokens(
  input: unknown,
  path: string,
  collector: IssueCollector<TokenGraphIssue>,
  modes?: readonly string[],
): Readonly<Record<string, TokenDefinitionInput>> | undefined {
  if (input === undefined) {
    return {};
  }
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: "tokens must be a plain object record.",
    path,
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly TokenGraphIssue[]);
    return undefined;
  }

  const tokens: Record<string, TokenDefinitionInput> = {};
  for (const entry of entries.value) {
    const tokenPath = `${path}/${escapeTokenPath(entry.key)}`;
    if (!isTokenKey(entry.key)) {
      collector.add({
        code: "invalid-token-key",
        message: "Token keys must be dot-separated lower-kebab identifiers.",
        path: tokenPath,
        key: entry.key,
      });
      continue;
    }
    const token = parseTokenDefinitionArtifact(entry.value, tokenPath, collector, modes);
    if (token !== undefined) {
      defineRecordValue(tokens, entry.key, token);
    }
  }
  return sortedRecord(Object.entries(tokens));
}

function parseTokenDefinitionArtifact(
  input: unknown,
  path: string,
  collector: IssueCollector<TokenGraphIssue>,
  modes?: readonly string[],
): TokenDefinitionInput | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "Token definition must be a plain object.",
    path,
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly TokenGraphIssue[]);
    return undefined;
  }
  rejectUnknownKeys(entries.value, tokenKeys, path, collector);
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const metadata = parseDefinitionMetadata(record, path, collector);
  const visibility = record.get("visibility");
  if (visibility !== undefined && visibility !== "public" && visibility !== "internal") {
    collector.add({
      code: "invalid-visibility",
      message: "Visibility must be public or internal.",
      path: `${path}/visibility`,
    });
  }

  const hasValue = record.has("value");
  const hasValueByMode = record.has("valueByMode");
  if (hasValue && hasValueByMode) {
    collector.add({
      code: "conflicting-token-value",
      message: "Token definitions must use either value or valueByMode, not both.",
      path,
    });
    return undefined;
  }
  if (!hasValue && !hasValueByMode) {
    collector.add({
      code: "missing-token-value",
      message: "Token definitions require value.",
      path,
    });
    return undefined;
  }

  if (hasValue) {
    const value = parseExpression(record.get("value"), `${path}/value`, collector);
    return value === undefined
      ? undefined
      : {
          ...(visibility === undefined ? {} : { visibility: visibility as TokenVisibility }),
          ...metadata,
          value,
        };
  }

  const valueByMode = parseStandaloneValueByMode(
    record.get("valueByMode"),
    `${path}/valueByMode`,
    collector,
    modes,
  );
  return valueByMode === undefined
    ? undefined
    : {
        ...(visibility === undefined ? {} : { visibility: visibility as TokenVisibility }),
        ...metadata,
        valueByMode,
      };
}

function parseStandaloneValueByMode(
  input: unknown,
  path: string,
  collector: IssueCollector<TokenGraphIssue>,
  modes?: readonly string[],
): Readonly<Record<string, TokenExpressionInput>> | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "valueByMode must be a plain object.",
    path,
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly TokenGraphIssue[]);
    return undefined;
  }
  const output: Record<string, TokenExpressionInput> = {};
  const modeSet = modes === undefined ? undefined : new Set(modes);
  const seen = new Set<string>();
  for (const entry of entries.value) {
    const valuePath = `${path}/${escapeTokenPath(entry.key)}`;
    if (modeSet === undefined && !isSingleSegmentIdentifier(entry.key)) {
      collector.add({
        code: "invalid-mode-key",
        message: "Mode identifiers must be lower-kebab single segments.",
        path: valuePath,
        mode: entry.key,
      });
      continue;
    }
    if (modeSet !== undefined && !modeSet.has(entry.key)) {
      collector.add({
        code: "unknown-mode-value",
        message: `valueByMode contains unknown mode: ${entry.key}.`,
        path: valuePath,
        mode: entry.key,
      });
      continue;
    }
    seen.add(entry.key);
    const expression = parseExpression(entry.value, valuePath, collector);
    if (expression !== undefined) {
      defineRecordValue(output, entry.key, expression);
    }
  }
  if (modes !== undefined) {
    for (const mode of modes) {
      if (!seen.has(mode)) {
        collector.add({
          code: "missing-mode-value",
          message: `valueByMode is missing mode: ${mode}.`,
          path,
          mode,
        });
      }
    }
  }
  return sortedRecord(Object.entries(output));
}

function parseModes(
  input: unknown,
  collector: IssueCollector<TokenGraphIssue>,
): readonly string[] | undefined {
  if (input === undefined) {
    collector.add({
      code: "missing-property",
      message: "Token graph requires modes.",
      path: pointer("modes"),
    });
    return undefined;
  }
  const array = readArray(input, {
    code: "invalid-mode-key",
    message: "modes must be a dense array.",
    path: pointer("modes"),
  });
  if (!array.ok) {
    collector.add({
      code: "invalid-mode-key",
      message: "modes must be an array.",
      path: pointer("modes"),
    });
    return undefined;
  }
  if (array.value.length === 0) {
    collector.add({
      code: "empty-modes",
      message: "modes must contain at least one mode.",
      path: pointer("modes"),
    });
    return undefined;
  }

  const modes: string[] = [];
  const seen = new Set<string>();
  for (const entry of array.value) {
    const value = entry.value;
    if (typeof value !== "string" || !isSingleSegmentIdentifier(value)) {
      collector.add({
        code: "invalid-mode-key",
        message: "Mode identifiers must be lower-kebab single segments.",
        path: pointer("modes", entry.index),
        ...(typeof value === "string" ? { mode: value } : {}),
      });
      continue;
    }
    if (seen.has(value)) {
      collector.add({
        code: "duplicate-mode-key",
        message: `Duplicate mode: ${value}.`,
        path: pointer("modes", entry.index),
        mode: value,
      });
      continue;
    }
    seen.add(value);
    modes.push(value);
  }

  return modes.length === 0 ? undefined : modes;
}

function parseDefaultMode(
  input: unknown,
  modes: readonly string[] | undefined,
  collector: IssueCollector<TokenGraphIssue>,
): string | undefined {
  if (typeof input !== "string") {
    collector.add({
      code: "missing-property",
      message: "defaultMode must be a declared mode.",
      path: pointer("defaultMode"),
    });
    return undefined;
  }
  if (modes !== undefined && !modes.includes(input)) {
    collector.add({
      code: "default-mode-not-found",
      message: "defaultMode must belong to modes.",
      path: pointer("defaultMode"),
      mode: input,
    });
    return undefined;
  }
  return input;
}

function parseVisibility(
  input: unknown,
  path: string,
  code: "invalid-default-visibility" | "invalid-visibility",
  collector: IssueCollector<TokenGraphIssue>,
): TokenVisibility | undefined {
  if (input === "public" || input === "internal") {
    return input;
  }
  collector.add({ code, message: "Visibility must be public or internal.", path });
  return undefined;
}

function parseTokenRecord(
  input: unknown,
  options: {
    readonly path: string;
    readonly modes: readonly string[];
    readonly defaultVisibility: TokenVisibility;
    readonly originForKey: (key: string) => TokenOrigin;
    readonly collector: IssueCollector<TokenGraphIssue>;
    readonly declarations: Map<string, TokenDeclaration>;
    readonly firstTokenPaths: Map<string, string>;
  },
): void {
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: "tokens must be a plain object record.",
    path: options.path,
  });
  if (!entries.ok) {
    options.collector.addMany(entries.issues as readonly TokenGraphIssue[]);
    return;
  }

  for (const entry of entries.value) {
    const tokenPath = `${options.path}/${escapeTokenPath(entry.key)}`;
    if (!isTokenKey(entry.key)) {
      options.collector.add({
        code: "invalid-token-key",
        message: "Token keys must be dot-separated lower-kebab identifiers.",
        path: tokenPath,
        key: entry.key,
      });
      continue;
    }

    const firstPath = options.firstTokenPaths.get(entry.key);
    if (firstPath !== undefined) {
      options.collector.add({
        code: "duplicate-token-key",
        message: `Duplicate token key: ${entry.key}.`,
        path: tokenPath,
        key: entry.key,
        firstPath,
      });
      continue;
    }

    const token = parseGraphTokenDefinition(entry.value, {
      path: tokenPath,
      key: entry.key,
      modes: options.modes,
      defaultVisibility: options.defaultVisibility,
      origin: options.originForKey(entry.key),
      collector: options.collector,
    });
    if (token === undefined) {
      continue;
    }

    options.firstTokenPaths.set(entry.key, tokenPath);
    options.declarations.set(entry.key, {
      key: entry.key,
      path: tokenPath,
      token,
    });
  }
}

function parseGraphLayer(
  input: unknown,
  index: number,
  options: {
    readonly modes: readonly string[];
    readonly collector: IssueCollector<TokenGraphIssue>;
    readonly declarations: Map<string, TokenDeclaration>;
    readonly layerIds: Map<string, string>;
  },
): void {
  const path = pointer("layers", index);
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: "Layer must be a plain object.",
    path,
  });
  if (!entries.ok) {
    options.collector.addMany(entries.issues as readonly TokenGraphIssue[]);
    return;
  }
  rejectUnknownKeys(entries.value, layerKeys, path, options.collector);

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  parseKind(record.get("kind"), tokenLayerKind, `${path}/kind`, options.collector);
  if (record.get("formatVersion") !== 1) {
    options.collector.add({
      code: record.has("formatVersion") ? "invalid-format-version" : "missing-property",
      message: "Layer formatVersion must be numeric 1.",
      path: `${path}/formatVersion`,
    });
  }

  const schema = record.get("$schema");
  if (schema !== undefined && typeof schema !== "string") {
    options.collector.add({
      code: "invalid-schema-uri",
      message: "$schema must be a string.",
      path: `${path}/$schema`,
    });
  }

  const layerId = parseLayerId(record.get("id"), `${path}/id`, options.collector);
  if (layerId !== undefined) {
    const firstPath = options.layerIds.get(layerId);
    if (firstPath !== undefined) {
      options.collector.add({
        code: "duplicate-layer-id",
        message: `Duplicate layer id: ${layerId}.`,
        path: `${path}/id`,
        layerId,
        firstPath,
      });
    } else {
      options.layerIds.set(layerId, `${path}/id`);
    }
  }

  const defaultVisibility = parseVisibility(
    record.get("defaultVisibility"),
    `${path}/defaultVisibility`,
    "invalid-default-visibility",
    options.collector,
  );
  const tokens = record.get("tokens");
  if (tokens === undefined) {
    options.collector.add({
      code: "missing-property",
      message: "Layer requires tokens.",
      path: `${path}/tokens`,
    });
  }
  if (layerId === undefined || defaultVisibility === undefined) {
    return;
  }

  const layerTokenPaths = new Map<string, string>();
  if (tokens !== undefined) {
    parseTokenRecord(tokens, {
      path: `${path}/tokens`,
      modes: options.modes,
      defaultVisibility,
      originForKey: () => ({ kind: "layer", id: layerId }),
      collector: options.collector,
      declarations: options.declarations,
      firstTokenPaths: layerTokenPaths,
    });
  }
}

function parseGraphTokenDefinition(
  input: unknown,
  options: {
    readonly path: string;
    readonly key: string;
    readonly modes: readonly string[];
    readonly defaultVisibility: TokenVisibility;
    readonly origin: TokenOrigin;
    readonly collector: IssueCollector<TokenGraphIssue>;
  },
): ParsedToken | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "Token definition must be a plain object.",
    path: options.path,
  });
  if (!entries.ok) {
    options.collector.addMany(entries.issues as readonly TokenGraphIssue[]);
    return undefined;
  }
  rejectUnknownKeys(entries.value, tokenKeys, options.path, options.collector);

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const visibilityInput = record.get("visibility");
  const visibility =
    visibilityInput === undefined
      ? options.defaultVisibility
      : parseVisibility(
          visibilityInput,
          `${options.path}/visibility`,
          "invalid-visibility",
          options.collector,
        );
  if (visibility === undefined) {
    return undefined;
  }

  const metadata = parseDefinitionMetadata(record, options.path, options.collector);
  const hasValue = record.has("value");
  const hasValueByMode = record.has("valueByMode");
  if (hasValue && hasValueByMode) {
    options.collector.add({
      code: "conflicting-token-value",
      message: "Token definitions must use either value or valueByMode, not both.",
      path: options.path,
      key: options.key,
    });
    return undefined;
  }
  if (!hasValue && !hasValueByMode) {
    options.collector.add({
      code: "missing-token-value",
      message: "Token definitions require value or valueByMode.",
      path: options.path,
      key: options.key,
    });
    return undefined;
  }

  const valueByMode: Record<string, ParsedTokenExpression> = {};
  const expressionPathsByMode: Record<string, string> = {};
  if (hasValue) {
    const expression = parseExpression(
      record.get("value"),
      `${options.path}/value`,
      options.collector,
    );
    if (expression !== undefined) {
      for (const mode of options.modes) {
        defineRecordValue(valueByMode, mode, cloneExpression(expression));
        defineRecordValue(expressionPathsByMode, mode, `${options.path}/value`);
      }
    }
  } else {
    parseValueByMode(record.get("valueByMode"), {
      path: `${options.path}/valueByMode`,
      key: options.key,
      modes: options.modes,
      collector: options.collector,
      output: valueByMode,
      expressionPathsByMode,
    });
  }

  if (Object.keys(valueByMode).length !== options.modes.length) {
    return undefined;
  }
  return {
    visibility,
    valueByMode: sortedRecord(Object.entries(valueByMode)),
    expressionPathsByMode: sortedRecord(Object.entries(expressionPathsByMode)),
    origin: options.origin,
    ...metadata,
  };
}

function parseDefinitionMetadata(
  record: ReadonlyMap<string, unknown>,
  path: string,
  collector: IssueCollector<TokenGraphIssue>,
): Pick<ParsedToken, "description" | "deprecated" | "extensions"> {
  const output: {
    description?: string;
    deprecated?: boolean | string;
    extensions?: Readonly<Record<string, JsonValue>>;
  } = {};

  const description = record.get("description");
  if (description !== undefined) {
    if (typeof description === "string") {
      output.description = description;
    } else {
      collector.add({
        code: "invalid-description",
        message: "description must be a string.",
        path: `${path}/description`,
      });
    }
  }

  const deprecated = record.get("deprecated");
  if (deprecated !== undefined) {
    if (deprecated === true || deprecated === false) {
      output.deprecated = deprecated;
    } else if (typeof deprecated === "string" && deprecated.length > 0) {
      output.deprecated = deprecated;
    } else {
      collector.add({
        code: "invalid-deprecated",
        message: "deprecated must be boolean or non-empty string.",
        path: `${path}/deprecated`,
      });
    }
  }

  const extensions = record.get("extensions");
  if (extensions !== undefined) {
    const extensionEntries = readPlainRecord(extensions, {
      code: "invalid-extensions",
      message: "extensions must be a plain object.",
      path: `${path}/extensions`,
    });
    if (!extensionEntries.ok) {
      collector.addMany(extensionEntries.issues as readonly TokenGraphIssue[]);
    } else {
      const copied: Record<string, JsonValue> = {};
      for (const entry of extensionEntries.value) {
        const value = copyJsonValue(entry.value, {
          code: "invalid-json-value",
          message: "Extension values must be JSON-safe.",
          path: `${path}/extensions/${escapeTokenPath(entry.key)}`,
        });
        if (value.ok) {
          defineRecordValue(copied, entry.key, value.value);
        } else {
          collector.addMany(value.issues as readonly TokenGraphIssue[]);
        }
      }
      output.extensions = sortedRecord(Object.entries(copied));
    }
  }

  return output;
}

function parseValueByMode(
  input: unknown,
  options: {
    readonly path: string;
    readonly key: string;
    readonly modes: readonly string[];
    readonly collector: IssueCollector<TokenGraphIssue>;
    readonly output: Record<string, ParsedTokenExpression>;
    readonly expressionPathsByMode: Record<string, string>;
  },
): void {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "valueByMode must be a plain object.",
    path: options.path,
  });
  if (!entries.ok) {
    options.collector.addMany(entries.issues as readonly TokenGraphIssue[]);
    return;
  }

  const modeSet = new Set(options.modes);
  const seen = new Set<string>();
  for (const entry of entries.value) {
    const valuePath = `${options.path}/${escapeTokenPath(entry.key)}`;
    if (!modeSet.has(entry.key)) {
      options.collector.add({
        code: "unknown-mode-value",
        message: `valueByMode contains unknown mode: ${entry.key}.`,
        path: valuePath,
        key: options.key,
        mode: entry.key,
      });
      continue;
    }
    seen.add(entry.key);
    const expression = parseExpression(entry.value, valuePath, options.collector);
    if (expression !== undefined) {
      defineRecordValue(options.output, entry.key, expression);
      defineRecordValue(options.expressionPathsByMode, entry.key, valuePath);
    }
  }

  for (const mode of options.modes) {
    if (!seen.has(mode)) {
      options.collector.add({
        code: "missing-mode-value",
        message: `valueByMode is missing mode: ${mode}.`,
        path: options.path,
        key: options.key,
        mode,
      });
    }
  }
}

function parseExpression(
  input: unknown,
  path: string,
  collector: IssueCollector<TokenGraphIssue>,
): ParsedTokenExpression | undefined {
  if (isReferenceInput(input)) {
    const entries = readPlainRecord(input, {
      code: "invalid-reference",
      message: "References must be exact plain objects.",
      path,
    });
    if (!entries.ok) {
      collector.addMany(entries.issues as readonly TokenGraphIssue[]);
      return undefined;
    }
    const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
    if (
      entries.value.length !== 1 ||
      typeof record.get("ref") !== "string" ||
      !isTokenKey(record.get("ref") as string)
    ) {
      collector.add({
        code: "invalid-reference",
        message: "References must contain exactly one valid ref token key.",
        path,
      });
      return undefined;
    }
    return { ref: record.get("ref") as string };
  }

  if (typeof input === "string") {
    return input;
  }
  collector.add({
    code: "invalid-token-value",
    message: "Token values must be authored CSS strings or explicit references.",
    path,
  });
  return undefined;
}

function validateReferences(
  tokens: ReadonlyMap<string, ParsedToken>,
  modes: readonly string[],
  collector: IssueCollector<TokenGraphIssue>,
): void {
  for (const [key, token] of tokens) {
    for (const mode of modes) {
      const expression = token.valueByMode[mode];
      if (expression === undefined || !isReferenceExpression(expression)) {
        continue;
      }
      if (!tokens.has(expression.ref)) {
        collector.add({
          code: "unknown-reference",
          message: `Reference target does not exist: ${expression.ref}.`,
          ...(token.expressionPathsByMode[mode] === undefined
            ? {}
            : { path: token.expressionPathsByMode[mode] }),
          key,
          mode,
        });
      }
    }
  }
}

function validateCycles(
  tokens: ReadonlyMap<string, ParsedToken>,
  modes: readonly string[],
  collector: IssueCollector<TokenGraphIssue>,
): void {
  const cycleKeys = new Set<string>();
  const tokenKeys = [...tokens.keys()].sort(compareCodeUnits);

  for (const mode of modes) {
    const resolved = new Set<string>();
    for (const start of tokenKeys) {
      if (resolved.has(start)) {
        continue;
      }
      const path: string[] = [];
      const indexes = new Map<string, number>();
      let current: string | undefined = start;
      let foundCycle = false;

      while (current !== undefined) {
        if (resolved.has(current)) {
          break;
        }
        const existingIndex = indexes.get(current);
        if (existingIndex !== undefined) {
          const canonicalCycle = canonicalCycleKeys(path.slice(existingIndex));
          const key = `${mode}\0${canonicalCycle.join("\0")}`;
          if (!cycleKeys.has(key)) {
            cycleKeys.add(key);
            const issuePath = tokens.get(current)?.expressionPathsByMode[mode];
            collector.add({
              code: "reference-cycle",
              message: `Reference cycle detected for mode ${mode}.`,
              ...(issuePath === undefined ? {} : { path: issuePath }),
              mode,
              cycle: canonicalCycle,
            });
          }
          foundCycle = true;
          break;
        }

        indexes.set(current, path.length);
        path.push(current);
        const token = tokens.get(current);
        const expression = token?.valueByMode[mode];
        current =
          expression !== undefined && isReferenceExpression(expression)
            ? expression.ref
            : undefined;
      }

      if (!foundCycle) {
        for (const item of path) {
          resolved.add(item);
        }
      }
    }
  }
}

function parseKind(
  input: unknown,
  expected: string,
  path: string,
  collector: IssueCollector<TokenGraphIssue>,
): void {
  if (input === expected) {
    return;
  }
  collector.add({
    code: input === undefined ? "missing-property" : "invalid-artifact-kind",
    message: `Artifact kind must be ${expected}.`,
    path,
  });
}

function parseLayerId(
  input: unknown,
  path: string,
  collector: IssueCollector<TokenGraphIssue>,
): string | undefined {
  const layerId = typeof input === "string" && isSingleSegmentIdentifier(input) ? input : undefined;
  if (layerId === undefined) {
    collector.add({
      code: "invalid-layer-id",
      message: "Layer id must be a lower-kebab single segment.",
      path,
      ...(typeof input === "string" ? { layerId: input } : {}),
    });
  }
  return layerId;
}

function canonicalCycleKeys(cycle: readonly string[]): readonly string[] {
  if (cycle.length === 0) {
    return cycle;
  }
  let smallestIndex = 0;
  for (let index = 1; index < cycle.length; index += 1) {
    if (compareCodeUnits(cycle[index] as string, cycle[smallestIndex] as string) < 0) {
      smallestIndex = index;
    }
  }
  return [...cycle.slice(smallestIndex), ...cycle.slice(0, smallestIndex)];
}

function rejectUnknownKeys(
  entries: readonly { readonly key: string }[],
  allowed: ReadonlySet<string>,
  path: string,
  collector: IssueCollector<TokenGraphIssue>,
): void {
  for (const entry of entries) {
    if (allowed.has(entry.key)) {
      continue;
    }
    collector.add({
      code: "unknown-property",
      message: `Unknown property: ${entry.key}.`,
      path: path === "" ? pointer(entry.key) : `${path}/${escapeTokenPath(entry.key)}`,
    });
  }
}

function canonicalizeModes(
  modes: readonly string[],
  defaultMode: string,
): readonly [string, ...string[]] {
  return [
    defaultMode,
    ...modes.filter((mode) => mode !== defaultMode).sort(compareCodeUnits),
  ] as readonly [string, ...string[]];
}

function cloneExpression(expression: ParsedTokenExpression): ParsedTokenExpression {
  return isReferenceExpression(expression) ? { ref: expression.ref } : expression;
}

function toPublicToken(token: ParsedToken): ParsedTokenGraphToken {
  return {
    visibility: token.visibility,
    valueByMode: token.valueByMode,
    origin: token.origin,
    ...(token.description === undefined ? {} : { description: token.description }),
    ...(token.deprecated === undefined ? {} : { deprecated: token.deprecated }),
    ...(token.extensions === undefined ? {} : { extensions: token.extensions }),
  };
}

function isReferenceExpression(expression: ParsedTokenExpression): expression is ReferenceInput {
  return typeof expression === "object" && expression !== null && "ref" in expression;
}

function escapeTokenPath(key: string): string {
  return key.replaceAll("~", "~0").replaceAll("/", "~1");
}

function fail(
  issues: readonly [TokenGraphIssue, ...TokenGraphIssue[]] | undefined,
): FailureResult<TokenGraphIssue> {
  return {
    ok: false,
    issues: issues ?? [
      {
        code: "invalid-object",
        message: "Artifact could not be parsed.",
      },
    ],
  };
}
