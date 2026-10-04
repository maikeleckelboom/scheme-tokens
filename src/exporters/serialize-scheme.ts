import type { CompiledScheme } from "../core/compiled-types";
import type {
  TokenDefinition,
  TokenExpression,
  TokenGraph,
  TokenLayer,
  TokenOrigin,
} from "../core/graph";
import { tokenGraphKind, tokenLayerKind, compiledSchemeKind } from "../core/graph";
import { isExpressionValue } from "../core/validate-source";
import { canonicalizeExpression } from "../core/canonical-expression";
import { orThrow } from "../core/result";
import type { JsonValue } from "../core/json";
import { compareCodeUnits, defineRecordValue, normalizeNumber } from "../core/json";

export function serializeTokenGraph(graph: TokenGraph): string {
  return `${JSON.stringify(canonicalTokenGraph(graph), null, 2)}\n`;
}

export function serializeTokenLayer(layer: TokenLayer): string {
  return `${JSON.stringify(canonicalTokenLayer(layer), null, 2)}\n`;
}

type AnyCompiledScheme = CompiledScheme<string, string, boolean>;

export function serializeCompiledScheme(scheme: AnyCompiledScheme): string {
  return `${JSON.stringify(canonicalCompiledScheme(scheme), null, 2)}\n`;
}

function canonicalTokenGraph(graph: TokenGraph): unknown {
  const output: Record<string, unknown> = {};
  if (graph.$schema !== undefined) {
    defineRecordValue(output, "$schema", graph.$schema);
  }
  defineRecordValue(output, "kind", tokenGraphKind);
  defineRecordValue(output, "formatVersion", 2);
  defineRecordValue(output, "modes", [...graph.modes]);
  defineRecordValue(output, "defaultMode", graph.defaultMode);
  defineRecordValue(output, "defaultVisibility", graph.defaultVisibility);
  if (graph.layers !== undefined) {
    defineRecordValue(output, "layers", graph.layers.map(canonicalTokenLayer));
  }
  defineRecordValue(output, "tokens", canonicalDefinitions(graph.tokens));
  return output;
}

function canonicalTokenLayer(layer: TokenLayer): unknown {
  const output: Record<string, unknown> = {};
  if (layer.$schema !== undefined) {
    defineRecordValue(output, "$schema", layer.$schema);
  }
  defineRecordValue(output, "kind", tokenLayerKind);
  defineRecordValue(output, "formatVersion", 2);
  defineRecordValue(output, "id", layer.id);
  defineRecordValue(output, "defaultVisibility", layer.defaultVisibility);
  defineRecordValue(output, "tokens", canonicalDefinitions(layer.tokens));
  return output;
}

function canonicalDefinitions(
  tokens: Readonly<Record<string, TokenDefinition>>,
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

function canonicalDefinition(token: TokenDefinition): unknown {
  const output: Record<string, unknown> = {};
  if (token.visibility !== undefined) {
    defineRecordValue(output, "visibility", token.visibility);
  }
  defineRecordValue(output, "value", canonicalTokenValue(token.value));
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

function canonicalCompiledScheme(scheme: AnyCompiledScheme): unknown {
  const modes = [...scheme.modes];
  const tokens: Record<string, unknown> = {};
  for (const key of Object.keys(scheme.tokens).sort(compareCodeUnits)) {
    const token = scheme.tokens[key];
    if (token === undefined) {
      continue;
    }
    const modeValues: Record<string, unknown> = {};
    for (const mode of modes) {
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
    const output: Record<string, unknown> = {};
    defineRecordValue(output, "visibility", metadata.visibility);
    defineRecordValue(
      output,
      "declarations",
      metadata.declarations.map((declaration) => ({
        origin: canonicalOrigin(declaration.origin),
        ...(declaration.declaredVisibility === undefined
          ? {}
          : { declaredVisibility: declaration.declaredVisibility }),
      })),
    );
    if (metadata.expressionByMode !== undefined) {
      const expressions: Record<string, unknown> = {};
      for (const mode of Object.keys(metadata.expressionByMode).sort(compareCodeUnits)) {
        const expression = metadata.expressionByMode[mode];
        if (expression !== undefined) {
          defineRecordValue(
            expressions,
            mode,
            "ref" in expression
              ? { ref: expression.ref }
              : {
                  concat: expression.concat.map((part) =>
                    typeof part === "string" ? part : { ref: part.ref, value: part.value },
                  ),
                },
          );
        }
      }
      defineRecordValue(output, "expressionByMode", expressions);
    }
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
  if (scheme.$schema !== undefined) {
    defineRecordValue(output, "$schema", scheme.$schema);
  }
  defineRecordValue(output, "kind", compiledSchemeKind);
  defineRecordValue(output, "formatVersion", 2);
  defineRecordValue(output, "modes", modes);
  defineRecordValue(output, "defaultMode", scheme.defaultMode);
  defineRecordValue(output, "tokens", tokens);
  defineRecordValue(output, "metadataByToken", metadataByToken);
  return output;
}

function canonicalOrigin(origin: TokenOrigin): unknown {
  const output: Record<string, unknown> = {};
  defineRecordValue(output, "kind", origin.kind);
  if (origin.kind === "layer") {
    defineRecordValue(output, "id", origin.id);
  }
  return output;
}

function canonicalTokenValue(value: TokenDefinition["value"]): unknown {
  if (isExpressionValue(value)) {
    return canonicalExpression(value);
  }
  const values: Record<string, unknown> = {};
  for (const mode of Object.keys(value).sort(compareCodeUnits)) {
    const expression = value[mode];
    if (expression !== undefined) {
      defineRecordValue(values, mode, canonicalExpression(expression));
    }
  }
  return values;
}

function canonicalExpression(expression: TokenExpression): unknown {
  return orThrow(canonicalizeExpression(expression, "")).expression;
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
