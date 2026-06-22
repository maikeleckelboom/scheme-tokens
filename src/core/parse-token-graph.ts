import { cloneColor, parsePersistedColorAt, type ColorValue } from "./color";
import type {
  ColorTokenDefinitionInput,
  ColorTokenExpressionInput,
  ColorTokenGraphInput,
  ColorTokenGraphIssue,
  ColorTokenLayerInput,
  ReferenceInput,
  TokenOrigin,
  TokenVisibility,
} from "./graph";
import { colorTokenGraphKind, colorTokenLayerKind, isReferenceInput } from "./graph";
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
import { IssueCollector, type Result } from "./result";

interface ParseContext {
  readonly sourceId?: string;
  readonly callerLayerIds?: ReadonlySet<string>;
  readonly tokenSourceIds?: ReadonlyMap<string, string>;
  readonly layerSourceIds?: ReadonlyMap<string, string>;
  readonly skipReferenceValidation?: boolean;
}

interface ParsedToken {
  readonly visibility: TokenVisibility;
  readonly valueByMode: Readonly<Record<string, ParsedColorExpression>>;
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

export type ParsedColorExpression<Key extends string = string> = ColorValue | ReferenceInput<Key>;

export interface ParsedTokenGraphToken<Mode extends string = string, Key extends string = string> {
  readonly visibility: TokenVisibility;
  readonly valueByMode: Readonly<Record<Mode, ParsedColorExpression<Key>>>;
  readonly origin: TokenOrigin;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}

export interface ParsedTokenGraph<Mode extends string = string, Key extends string = string> {
  readonly kind: typeof colorTokenGraphKind;
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

export function parseTokenGraph(
  input: unknown,
): Result<ColorTokenGraphInput, ColorTokenGraphIssue> {
  return parseTokenGraphArtifact(input);
}

export function parseTokenLayer(
  input: unknown,
): Result<ColorTokenLayerInput, ColorTokenGraphIssue> {
  const collector = new IssueCollector<ColorTokenGraphIssue>();
  const layer = parseStandaloneLayer(input, collector);
  const issues = collector.issues();
  return issues === undefined && layer !== undefined ? { ok: true, value: layer } : fail(issues);
}

function parseTokenGraphArtifact(
  input: unknown,
): Result<ColorTokenGraphInput, ColorTokenGraphIssue> {
  const collector = new IssueCollector<ColorTokenGraphIssue>();
  const top = readPlainRecord(input, {
    code: "invalid-object",
    message: "Color token graph must be a plain object.",
  });
  if (!top.ok) {
    return top as Result<never, ColorTokenGraphIssue>;
  }

  const graphRecord = new Map(top.value.map((entry) => [entry.key, entry.value]));
  rejectUnknownKeys(top.value, topLevelKeys, "", collector);
  parseKind(graphRecord.get("kind"), colorTokenGraphKind, pointer("kind"), collector);

  const formatVersion = graphRecord.get("formatVersion");
  if (formatVersion !== 1) {
    collector.add({
      code: formatVersion === undefined ? "missing-property" : "invalid-format-version",
      message: "Color token graph formatVersion must be numeric 1.",
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
      message: "Color token graph requires tokens.",
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

  const artifact: ColorTokenGraphInput = {
    ...(typeof schema === "string" ? { $schema: schema } : {}),
    kind: colorTokenGraphKind,
    formatVersion: 1,
    modes: canonicalModes as readonly [string, ...string[]],
    defaultMode,
    defaultVisibility,
    tokens,
    ...(layers === undefined ? {} : { layers }),
  };
  const internal = parseTokenGraphInternal(artifact, {});
  return internal.ok ? { ok: true, value: artifact } : internal;
}

export function parseTokenGraphInternal(
  input: unknown,
  context: ParseContext,
): Result<ParsedTokenGraph, ColorTokenGraphIssue> {
  const collector = new IssueCollector<ColorTokenGraphIssue>();
  const top = readPlainRecord(input, {
    code: "invalid-object",
    message: "Color token graph must be a plain object.",
  });
  if (!top.ok) {
    return top as Result<never, ColorTokenGraphIssue>;
  }

  const graphRecord = new Map(top.value.map((entry) => [entry.key, entry.value]));
  rejectUnknownKeys(top.value, topLevelKeys, "", collector);
  parseKind(graphRecord.get("kind"), colorTokenGraphKind, pointer("kind"), collector);

  const formatVersion = graphRecord.get("formatVersion");
  if (formatVersion !== 1) {
    collector.add({
      code: formatVersion === undefined ? "missing-property" : "invalid-format-version",
      message: "Color token graph formatVersion must be numeric 1.",
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
      message: "Color token graph requires tokens.",
      path: pointer("tokens"),
    });
  }
  if (tokensInput !== undefined && defaultVisibility !== undefined) {
    parseTokenRecord(tokensInput, {
      path: pointer("tokens"),
      modes: validModes,
      defaultVisibility,
      originForKey: (key) => directOrigin(context, key),
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
          context,
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
  if (context.skipReferenceValidation !== true) {
    validateReferences(tokenMap, validModes, collector);
    validateCycles(tokenMap, validModes, collector);
  }

  const issues = collector.issues();
  if (issues !== undefined) {
    return { ok: false, issues };
  }

  if (canonicalModes === undefined || defaultMode === undefined) {
    return {
      ok: false,
      issues: [{ code: "empty-modes", message: "Color token graph requires valid modes." }],
    };
  }

  return {
    ok: true,
    value: {
      kind: colorTokenGraphKind,
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
  collector: IssueCollector<ColorTokenGraphIssue>,
): ColorTokenLayerInput | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: "Color token layer must be a plain object.",
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly ColorTokenGraphIssue[]);
    return undefined;
  }
  rejectUnknownKeys(entries.value, layerKeys, "", collector);

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  parseKind(record.get("kind"), colorTokenLayerKind, pointer("kind"), collector);
  if (record.get("formatVersion") !== 1) {
    collector.add({
      code: record.has("formatVersion") ? "invalid-format-version" : "missing-property",
      message: "Color token layer formatVersion must be numeric 1.",
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
    kind: colorTokenLayerKind,
    formatVersion: 1,
    id,
    defaultVisibility,
    tokens,
  };
}

function parseGraphLayersArtifact(
  input: unknown,
  modes: readonly string[] | undefined,
  collector: IssueCollector<ColorTokenGraphIssue>,
): readonly ColorTokenLayerInput[] | undefined {
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

  const output: ColorTokenLayerInput[] = [];
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
  collector: IssueCollector<ColorTokenGraphIssue>,
): ColorTokenLayerInput | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: "Layer must be a plain object.",
    path,
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly ColorTokenGraphIssue[]);
    return undefined;
  }
  rejectUnknownKeys(entries.value, layerKeys, path, collector);

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  parseKind(record.get("kind"), colorTokenLayerKind, `${path}/kind`, collector);
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
    kind: colorTokenLayerKind,
    formatVersion: 1,
    id,
    defaultVisibility,
    tokens,
  };
}

function parseStandaloneLayerTokens(
  input: unknown,
  path: string,
  collector: IssueCollector<ColorTokenGraphIssue>,
  modes?: readonly string[],
): Readonly<Record<string, ColorTokenDefinitionInput>> | undefined {
  if (input === undefined) {
    return {};
  }
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: "tokens must be a plain object record.",
    path,
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly ColorTokenGraphIssue[]);
    return undefined;
  }

  const tokens: Record<string, ColorTokenDefinitionInput> = {};
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
  collector: IssueCollector<ColorTokenGraphIssue>,
  modes?: readonly string[],
): ColorTokenDefinitionInput | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "Token definition must be a plain object.",
    path,
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly ColorTokenGraphIssue[]);
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
  collector: IssueCollector<ColorTokenGraphIssue>,
  modes?: readonly string[],
): Readonly<Record<string, ColorTokenExpressionInput>> | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "valueByMode must be a plain object.",
    path,
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly ColorTokenGraphIssue[]);
    return undefined;
  }
  const output: Record<string, ColorTokenExpressionInput> = {};
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
  collector: IssueCollector<ColorTokenGraphIssue>,
): readonly string[] | undefined {
  if (input === undefined) {
    collector.add({
      code: "missing-property",
      message: "Color token graph requires modes.",
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
  collector: IssueCollector<ColorTokenGraphIssue>,
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
  collector: IssueCollector<ColorTokenGraphIssue>,
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
    readonly collector: IssueCollector<ColorTokenGraphIssue>;
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
    options.collector.addMany(entries.issues as readonly ColorTokenGraphIssue[]);
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
    readonly context: ParseContext;
    readonly modes: readonly string[];
    readonly collector: IssueCollector<ColorTokenGraphIssue>;
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
    options.collector.addMany(entries.issues as readonly ColorTokenGraphIssue[]);
    return;
  }
  rejectUnknownKeys(entries.value, layerKeys, path, options.collector);

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  parseKind(record.get("kind"), colorTokenLayerKind, `${path}/kind`, options.collector);
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
      originForKey: () => layerOrigin(layerId, options.context),
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
    readonly collector: IssueCollector<ColorTokenGraphIssue>;
  },
): ParsedToken | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "Token definition must be a plain object.",
    path: options.path,
  });
  if (!entries.ok) {
    options.collector.addMany(entries.issues as readonly ColorTokenGraphIssue[]);
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

  const valueByMode: Record<string, ParsedColorExpression> = {};
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
  collector: IssueCollector<ColorTokenGraphIssue>,
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
      collector.addMany(extensionEntries.issues as readonly ColorTokenGraphIssue[]);
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
          collector.addMany(value.issues as readonly ColorTokenGraphIssue[]);
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
    readonly collector: IssueCollector<ColorTokenGraphIssue>;
    readonly output: Record<string, ParsedColorExpression>;
    readonly expressionPathsByMode: Record<string, string>;
  },
): void {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "valueByMode must be a plain object.",
    path: options.path,
  });
  if (!entries.ok) {
    options.collector.addMany(entries.issues as readonly ColorTokenGraphIssue[]);
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
  collector: IssueCollector<ColorTokenGraphIssue>,
): ParsedColorExpression | undefined {
  if (isReferenceInput(input)) {
    const entries = readPlainRecord(input, {
      code: "invalid-reference",
      message: "References must be exact plain objects.",
      path,
    });
    if (!entries.ok) {
      collector.addMany(entries.issues as readonly ColorTokenGraphIssue[]);
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

  const color = parsePersistedColorAt(input, path);
  if (!color.ok) {
    collector.addMany(color.issues as readonly ColorTokenGraphIssue[]);
    return undefined;
  }
  return color.value;
}

function validateReferences(
  tokens: ReadonlyMap<string, ParsedToken>,
  modes: readonly string[],
  collector: IssueCollector<ColorTokenGraphIssue>,
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
  collector: IssueCollector<ColorTokenGraphIssue>,
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
  collector: IssueCollector<ColorTokenGraphIssue>,
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
  collector: IssueCollector<ColorTokenGraphIssue>,
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
  collector: IssueCollector<ColorTokenGraphIssue>,
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

function directOrigin(context: ParseContext, tokenKey: string): TokenOrigin {
  const sourceId = context.tokenSourceIds?.get(tokenKey) ?? context.sourceId;
  return sourceId === undefined ? { kind: "graph" } : { kind: "source", id: sourceId };
}

function layerOrigin(layerId: string, context: ParseContext): TokenOrigin {
  const sourceId = context.layerSourceIds?.get(layerId);
  if (sourceId !== undefined) {
    return { kind: "source", id: sourceId };
  }
  if (context.sourceId !== undefined && !context.callerLayerIds?.has(layerId)) {
    return { kind: "source", id: context.sourceId };
  }
  return { kind: "layer", id: layerId };
}

function cloneExpression(expression: ParsedColorExpression): ParsedColorExpression {
  return isReferenceExpression(expression) ? { ref: expression.ref } : cloneColor(expression);
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

function isReferenceExpression(expression: ParsedColorExpression): expression is ReferenceInput {
  return "ref" in expression;
}

function escapeTokenPath(key: string): string {
  return key.replaceAll("~", "~0").replaceAll("/", "~1");
}

function fail(
  issues: readonly [ColorTokenGraphIssue, ...ColorTokenGraphIssue[]] | undefined,
): Result<never, ColorTokenGraphIssue> {
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
