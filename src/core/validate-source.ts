import { canonicalizeExpression, type ExpressionSource } from "./canonical-expression";
import {
  isModeKey,
  tokenGraphKind,
  tokenLayerKind,
  type TokenDefinition,
  type TokenExpression,
  type TokenGraph,
  type TokenGraphIssue,
  type TokenLayer,
} from "./graph";
import { isTokenKey } from "./identifiers";
import { defineRecordValue, pointer, readArray, readPlainRecord, sortedRecord } from "./json";
import { IssueCollector, type Result } from "./result";
import { SourcePaths } from "./source-paths";
import {
  parseDefaultMode,
  parseDefinitionMetadata,
  parseLayerId,
  parseModes,
  parseVisibility,
  rejectUnknownKeys,
} from "./validation-fields";

interface ValidationOptions {
  /** The retained v1 grammar is a delta here; only the upgrader uses it. */
  readonly version?: 1 | 2;
  readonly paths?: SourcePaths;
}
export interface ValidatedSource<Artifact> {
  readonly artifact: Artifact;
  readonly expressions: ReadonlyMap<string, ExpressionSource>;
}
interface Context {
  readonly version: 1 | 2;
  readonly paths: SourcePaths;
  readonly collector: IssueCollector<TokenGraphIssue>;
  readonly expressions: Map<string, ExpressionSource>;
}
const graphKeys = new Set([
  "$schema",
  "kind",
  "formatVersion",
  "modes",
  "defaultMode",
  "defaultVisibility",
  "layers",
  "tokens",
]);
const layerKeys = new Set([
  "$schema",
  "kind",
  "formatVersion",
  "id",
  "defaultVisibility",
  "tokens",
]);
const definitionKeys = new Set(["value", "visibility", "description", "deprecated", "extensions"]);

export function validateSourceGraph(
  input: unknown,
  options: ValidationOptions = {},
): Result<ValidatedSource<TokenGraph>, TokenGraphIssue> {
  const context = createContext(options);
  const record = artifactRecord(input, "", tokenGraphKind, graphKeys, context);
  if (record === undefined) {
    return failure(context);
  }
  const modes = parseModes(record.get("modes"), context.collector);
  const defaultMode = parseDefaultMode(record.get("defaultMode"), modes, context.collector);
  const defaultVisibility = parseVisibility(
    record.get("defaultVisibility"),
    "/defaultVisibility",
    "invalid-default-visibility",
    context.collector,
  );
  const tokens = validateTokens(record.get("tokens"), "/tokens", context, modes);
  const layers: TokenLayer[] = [];
  const ids = new Map<string, string>();
  if (record.has("layers")) {
    const entries = readArray(record.get("layers"), {
      code: "invalid-object",
      message: "layers must be a dense array.",
      path: "/layers",
    });
    if (!entries.ok) {
      context.collector.addMany(entries.issues);
    } else {
      for (const entry of entries.value) {
        const path = pointer("layers", entry.index);
        const layer = validateLayer(entry.value, path, context, modes);
        if (layer !== undefined) {
          const firstPath = ids.get(layer.id);
          if (firstPath !== undefined) {
            context.collector.add({
              code: "duplicate-layer-id",
              message: "Duplicate layer id: " + layer.id,
              path: path + "/id",
              firstPath,
              layerId: layer.id,
            });
          } else {
            ids.set(layer.id, path + "/id");
          }
          layers.push(layer);
        }
      }
    }
  }
  if (
    modes === undefined ||
    modes.length === 0 ||
    defaultMode === undefined ||
    defaultVisibility === undefined ||
    tokens === undefined ||
    context.collector.hasIssues
  ) {
    return failure(context);
  }
  return {
    ok: true,
    value: {
      artifact: {
        ...schemaField(record),
        kind: tokenGraphKind,
        formatVersion: 2,
        modes: modes as [string, ...string[]],
        defaultMode,
        defaultVisibility,
        ...(record.has("layers") ? { layers } : {}),
        tokens,
      },
      expressions: context.expressions,
    },
  };
}

export function validateSourceLayer(
  input: unknown,
  options: ValidationOptions = {},
): Result<ValidatedSource<TokenLayer>, TokenGraphIssue> {
  const context = createContext(options);
  const artifact = validateLayer(input, "", context);
  return artifact === undefined || context.collector.hasIssues
    ? failure(context)
    : { ok: true, value: { artifact, expressions: context.expressions } };
}

function createContext(options: ValidationOptions): Context {
  return {
    version: options.version ?? 2,
    paths: options.paths ?? new SourcePaths(),
    collector: new IssueCollector(),
    expressions: new Map(),
  };
}

function artifactRecord(
  input: unknown,
  path: string,
  kind: string,
  keys: ReadonlySet<string>,
  context: Context,
): Map<string, unknown> | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: "Artifact must be a plain object.",
    path,
  });
  if (!entries.ok) {
    context.collector.addMany(entries.issues);
    return undefined;
  }
  rejectUnknownKeys(entries.value, keys, path, context.collector);
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  if (record.get("kind") !== kind) {
    context.collector.add({
      code: record.has("kind") ? "invalid-artifact-kind" : "missing-property",
      message: "Artifact kind must be " + kind,
      path: path + "/kind",
    });
  }
  if (record.get("formatVersion") !== context.version) {
    context.collector.add({
      code: record.has("formatVersion") ? "invalid-format-version" : "missing-property",
      message: "Artifact formatVersion must be numeric " + context.version,
      path: path + "/formatVersion",
    });
  }
  const schema = record.get("$schema");
  const v1Schema =
    "https://scheme-tokens.dev/schemas/" + kind.slice("scheme-tokens/".length) + ".v1.schema.json";
  if (
    schema !== undefined &&
    (typeof schema !== "string" || (context.version === 1 && schema !== v1Schema))
  ) {
    context.collector.add({
      code: "invalid-schema-uri",
      message: context.version === 1 ? "$schema must be " + v1Schema : "$schema must be a string.",
      path: path + "/$schema",
    });
  }
  return record;
}

function schemaField(record: ReadonlyMap<string, unknown>): { readonly $schema?: string } {
  const schema = record.get("$schema");
  return typeof schema === "string" ? { $schema: schema } : {};
}

function validateLayer(
  input: unknown,
  path: string,
  context: Context,
  graphModes?: readonly string[],
): TokenLayer | undefined {
  const record = artifactRecord(input, path, tokenLayerKind, layerKeys, context);
  if (record === undefined) {
    return undefined;
  }
  const id = parseLayerId(record.get("id"), path + "/id", context.collector);
  const defaultVisibility = parseVisibility(
    record.get("defaultVisibility"),
    path + "/defaultVisibility",
    "invalid-default-visibility",
    context.collector,
  );
  const tokens = validateTokens(record.get("tokens"), path + "/tokens", context);
  if (id === undefined || defaultVisibility === undefined || tokens === undefined) {
    return undefined;
  }
  if (context.version === 2) {
    validateLayerModes(tokens, path, id, context, graphModes);
  }
  return {
    ...schemaField(record),
    kind: tokenLayerKind,
    formatVersion: 2,
    id,
    defaultVisibility,
    tokens,
  };
}

function validateTokens(
  input: unknown,
  path: string,
  context: Context,
  modes?: readonly string[],
): Readonly<Record<string, TokenDefinition>> | undefined {
  if (input === undefined) {
    context.collector.add({ code: "missing-property", message: "Artifact requires tokens.", path });
    return undefined;
  }
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: "tokens must be a plain record.",
    path,
  });
  if (!entries.ok) {
    context.collector.addMany(entries.issues);
    return undefined;
  }
  const tokens: Record<string, TokenDefinition> = {};
  for (const entry of entries.value) {
    const tokenPath = path + pointer(entry.key);
    if (!isTokenKey(entry.key)) {
      context.collector.add({
        code: "invalid-token-key",
        message: "Token keys must be lower-kebab dot paths.",
        path: tokenPath,
        key: entry.key,
      });
      continue;
    }
    const definition = readPlainRecord(entry.value, {
      code: "invalid-token-definition",
      message: "Token definition must be a plain object.",
      path: tokenPath,
    });
    if (!definition.ok) {
      context.collector.addMany(definition.issues);
      continue;
    }
    rejectUnknownKeys(definition.value, definitionKeys, tokenPath, context.collector);
    const record = new Map(definition.value.map((part) => [part.key, part.value]));
    const metadata = parseDefinitionMetadata(record, tokenPath, context.collector);
    const visibility = record.has("visibility")
      ? parseVisibility(
          record.get("visibility"),
          tokenPath + "/visibility",
          "invalid-visibility",
          context.collector,
        )
      : undefined;
    if (!record.has("value")) {
      context.collector.add({
        code: "missing-token-value",
        message: "Token definition requires value.",
        path: tokenPath,
      });
      continue;
    }
    const value = validateValue(record.get("value"), tokenPath + "/value", context, modes);
    if (value !== undefined) {
      defineRecordValue(tokens, entry.key, {
        value,
        ...(visibility === undefined ? {} : { visibility }),
        ...metadata,
      });
    }
  }
  return sortedRecord(Object.entries(tokens));
}

/** ADR 0015: property presence alone never classifies concat as an expression. */
export function isExpressionValue(input: unknown): input is TokenExpression {
  if (typeof input === "string") {
    return true;
  }
  const entries = readPlainRecord(input, { code: "invalid-token-value" });
  if (!entries.ok || entries.value.length !== 1) {
    return false;
  }
  const entry = entries.value[0];
  return entry?.key === "ref" || (entry?.key === "concat" && Array.isArray(entry.value));
}

function validateValue(
  input: unknown,
  path: string,
  context: Context,
  modes?: readonly string[],
): TokenDefinition["value"] | undefined {
  const probe = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "Token value must be an expression or non-empty mode map.",
    path,
  });
  const v1Ref =
    context.version === 1 && probe.ok && probe.value.some((entry) => entry.key === "ref");
  if (typeof input === "string" || v1Ref || (context.version === 2 && isExpressionValue(input))) {
    return validateExpression(input, path, context);
  }
  if (!probe.ok) {
    context.collector.addMany(probe.issues);
    return undefined;
  }
  if (probe.value.length === 0) {
    context.collector.add({
      code: "invalid-token-value",
      message: "Mode maps must not be empty.",
      path,
    });
    return undefined;
  }
  const values: Record<string, TokenExpression> = {};
  const seen = new Set<string>();
  for (const entry of probe.value) {
    const modePath = path + pointer(entry.key);
    if (!isModeKey(entry.key)) {
      context.collector.add({
        code: entry.key === "ref" ? "invalid-reference" : "invalid-mode-key",
        message: "Invalid or reserved mode: " + entry.key,
        path: modePath,
        mode: entry.key,
      });
      continue;
    }
    if (modes !== undefined && !modes.includes(entry.key)) {
      context.collector.add({
        code: "unknown-mode-value",
        message: "Token value contains unknown mode: " + entry.key,
        path: modePath,
        mode: entry.key,
      });
      continue;
    }
    seen.add(entry.key);
    const expression = validateExpression(entry.value, modePath, context);
    if (expression !== undefined) {
      defineRecordValue(values, entry.key, expression);
    }
  }
  for (const mode of modes ?? []) {
    if (!seen.has(mode)) {
      context.collector.add({
        code: "missing-mode-value",
        message: "Token value is missing mode: " + mode,
        path,
        mode,
      });
    }
  }
  return sortedRecord(Object.entries(values));
}

function validateExpression(
  input: unknown,
  path: string,
  context: Context,
): TokenExpression | undefined {
  if (context.version === 1 && typeof input !== "string") {
    const probe = readPlainRecord(input, { code: "invalid-token-value" });
    if (!probe.ok || !probe.value.some((entry) => entry.key === "ref")) {
      context.collector.add({
        code: "invalid-token-value",
        message: "V1 expressions must be strings or explicit references.",
        path,
      });
      return undefined;
    }
  }
  const result = canonicalizeExpression(input, path);
  if (!result.ok) {
    context.collector.addMany(result.issues);
    return undefined;
  }
  context.expressions.set(path, {
    ...result.value,
    path: context.paths.original(result.value.path),
    referencePaths: result.value.referencePaths.map((referencePath) =>
      context.paths.original(referencePath),
    ),
  });
  return result.value.expression;
}

function validateLayerModes(
  tokens: Readonly<Record<string, TokenDefinition>>,
  path: string,
  layerId: string,
  context: Context,
  graphModes?: readonly string[],
): void {
  let first: { readonly modes: readonly string[]; readonly path: string } | undefined;
  for (const [key, token] of Object.entries(tokens)) {
    if (isExpressionValue(token.value)) {
      continue;
    }
    const modes = Object.keys(token.value).sort();
    const valuePath = path + pointer("tokens", key, "value");
    if (first === undefined) {
      first = { modes, path: valuePath };
    } else if (!equalModeSets(first.modes, modes)) {
      context.collector.add({
        code: "layer-mode-mismatch",
        message: "Layer mode maps disagree.",
        path: valuePath,
        firstPath: first.path,
        key,
        layerId,
        modes: first.modes,
        layerModes: modes,
      });
      return;
    }
  }
  if (first !== undefined && graphModes !== undefined && !equalModeSets(first.modes, graphModes)) {
    context.collector.add({
      code: "layer-mode-mismatch",
      message: "Layer modes must equal graph modes.",
      path,
      layerId,
      modes: graphModes,
      layerModes: first.modes,
    });
  }
}

function equalModeSets(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && right.every((mode) => left.includes(mode));
}

function failure(context: Context): Result<never, TokenGraphIssue> {
  const issues = context.collector.issues() ?? [
    { code: "invalid-object", message: "Invalid source artifact." },
  ];
  const mapped = issues.map((issue) => ({
    ...issue,
    ...(issue.path === undefined ? {} : { path: context.paths.original(issue.path) }),
    ...(issue.firstPath === undefined
      ? {}
      : { firstPath: context.paths.original(issue.firstPath) }),
  }));
  return { ok: false, issues: mapped as [TokenGraphIssue, ...TokenGraphIssue[]] };
}
