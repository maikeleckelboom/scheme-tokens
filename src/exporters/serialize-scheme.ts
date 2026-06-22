import type { CompiledScheme } from "../core/compiled-types";
import type {
  TokenDefinitionInput,
  TokenExpressionInput,
  TokenGraphInput,
  TokenLayerInput,
  ReferenceInput,
} from "../core/graph";
import { tokenGraphKind, tokenLayerKind, compiledSchemeKind } from "../core/graph";
import type { JsonValue } from "../core/json";
import { compareCodeUnits, defineRecordValue, normalizeNumber } from "../core/json";

export function serializeTokenGraph(graph: TokenGraphInput): string {
  return `${JSON.stringify(canonicalTokenGraph(graph), null, 2)}\n`;
}

export function serializeTokenLayer(layer: TokenLayerInput): string {
  return `${JSON.stringify(canonicalTokenLayer(layer), null, 2)}\n`;
}

export function serializeCompiledScheme(scheme: CompiledScheme): string {
  return `${JSON.stringify(canonicalCompiledScheme(scheme), null, 2)}\n`;
}

function canonicalTokenGraph(graph: TokenGraphInput): unknown {
  const output: Record<string, unknown> = {};
  if (graph.$schema !== undefined) {
    defineRecordValue(output, "$schema", graph.$schema);
  }
  defineRecordValue(output, "kind", tokenGraphKind);
  defineRecordValue(output, "formatVersion", 1);
  defineRecordValue(output, "modes", [...graph.modes]);
  defineRecordValue(output, "defaultMode", graph.defaultMode);
  defineRecordValue(output, "defaultVisibility", graph.defaultVisibility);
  defineRecordValue(output, "tokens", canonicalDefinitions(graph.tokens));
  if (graph.layers !== undefined) {
    defineRecordValue(output, "layers", graph.layers.map(canonicalTokenLayer));
  }
  return output;
}

function canonicalTokenLayer(layer: TokenLayerInput): unknown {
  const output: Record<string, unknown> = {};
  if (layer.$schema !== undefined) {
    defineRecordValue(output, "$schema", layer.$schema);
  }
  defineRecordValue(output, "kind", tokenLayerKind);
  defineRecordValue(output, "formatVersion", 1);
  defineRecordValue(output, "id", layer.id);
  defineRecordValue(output, "defaultVisibility", layer.defaultVisibility);
  defineRecordValue(output, "tokens", canonicalDefinitions(layer.tokens));
  return output;
}

function canonicalDefinitions(
  tokens: Readonly<Record<string, TokenDefinitionInput>>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(tokens).sort(compareCodeUnits)) {
    const token = tokens[key];
    if (token !== undefined) {
      defineRecordValue(output, key, canonicalDefinition(token));
    }
  }
  return output;
}

function canonicalDefinition(token: TokenDefinitionInput): unknown {
  const output: Record<string, unknown> = {};
  if (token.visibility !== undefined) {
    defineRecordValue(output, "visibility", token.visibility);
  }
  if ("value" in token && token.value !== undefined) {
    defineRecordValue(output, "value", canonicalExpression(token.value));
  } else if ("valueByMode" in token && token.valueByMode !== undefined) {
    const values: Record<string, unknown> = {};
    for (const mode of Object.keys(token.valueByMode).sort(compareCodeUnits)) {
      const expression = token.valueByMode[mode];
      if (expression !== undefined) {
        defineRecordValue(values, mode, canonicalExpression(expression));
      }
    }
    defineRecordValue(output, "valueByMode", values);
  }
  if (token.description !== undefined) {
    defineRecordValue(output, "description", token.description);
  }
  if (token.deprecated !== undefined) {
    defineRecordValue(output, "deprecated", token.deprecated);
  }
  if (token.extensions !== undefined) {
    defineRecordValue(output, "extensions", canonicalJson(token.extensions));
  }
  return output;
}

function canonicalCompiledScheme(scheme: CompiledScheme): unknown {
  const tokens: Record<string, unknown> = {};
  for (const key of Object.keys(scheme.tokens).sort(compareCodeUnits)) {
    const token = scheme.tokens[key];
    if (token === undefined) {
      continue;
    }
    const modeValues: Record<string, unknown> = {};
    for (const mode of scheme.modes) {
      defineRecordValue(modeValues, mode, token[mode]);
    }
    defineRecordValue(tokens, key, modeValues);
  }

  const metadataByToken: Record<string, unknown> = {};
  for (const key of Object.keys(scheme.metadataByToken).sort(compareCodeUnits)) {
    const metadata = scheme.metadataByToken[key];
    if (metadata === undefined) {
      continue;
    }
    const dependenciesByMode: Record<string, readonly string[]> = {};
    for (const mode of scheme.modes) {
      defineRecordValue(
        dependenciesByMode,
        mode,
        [...(metadata.dependenciesByMode[mode] ?? [])].sort(compareCodeUnits),
      );
    }

    const output: Record<string, unknown> = {};
    defineRecordValue(output, "visibility", metadata.visibility);
    defineRecordValue(output, "origin", canonicalOrigin(metadata.origin));
    defineRecordValue(output, "dependenciesByMode", dependenciesByMode);
    if (metadata.description !== undefined) {
      defineRecordValue(output, "description", metadata.description);
    }
    if (metadata.deprecated !== undefined) {
      defineRecordValue(output, "deprecated", metadata.deprecated);
    }
    if (metadata.extensions !== undefined) {
      defineRecordValue(output, "extensions", canonicalJson(metadata.extensions));
    }
    defineRecordValue(metadataByToken, key, output);
  }

  const output: Record<string, unknown> = {};
  defineRecordValue(output, "kind", compiledSchemeKind);
  defineRecordValue(output, "formatVersion", 1);
  defineRecordValue(output, "modes", [...scheme.modes]);
  defineRecordValue(output, "defaultMode", scheme.defaultMode);
  defineRecordValue(output, "tokens", tokens);
  defineRecordValue(output, "metadataByToken", metadataByToken);
  return output;
}

function canonicalOrigin(origin: CompiledScheme["metadataByToken"][string]["origin"]): unknown {
  const output: Record<string, unknown> = {};
  defineRecordValue(output, "kind", origin.kind);
  if (origin.kind === "layer") {
    defineRecordValue(output, "id", origin.id);
  }
  return output;
}

function canonicalExpression(expression: TokenExpressionInput): unknown {
  return isReferenceExpression(expression) ? { ref: expression.ref } : expression;
}

function canonicalJson(value: JsonValue): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return normalizeNumber(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalJson(entry));
  }

  const output: Record<string, JsonValue> = {};
  const record = value as Readonly<Record<string, JsonValue>>;
  for (const key of Object.keys(record).sort(compareCodeUnits)) {
    defineRecordValue(output, key, canonicalJson(record[key] as JsonValue));
  }
  return output;
}

function isReferenceExpression(expression: TokenExpressionInput): expression is ReferenceInput {
  return typeof expression === "object" && expression !== null && "ref" in expression;
}
