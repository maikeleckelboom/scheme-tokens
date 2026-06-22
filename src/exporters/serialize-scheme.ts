import type { ColorComponent, ColorValue, ColorValueInput } from "../core/color";
import type { CompiledColorScheme } from "../core/compiled-types";
import type {
  ColorTokenDefinitionInput,
  ColorTokenExpressionInput,
  ColorTokenGraphInput,
  ColorTokenLayerInput,
  ReferenceInput,
} from "../core/graph";
import { colorTokenGraphKind, colorTokenLayerKind, compiledColorSchemeKind } from "../core/graph";
import type { JsonValue } from "../core/json";
import { compareCodeUnits, defineRecordValue, normalizeNumber } from "../core/json";

export function serializeTokenGraph(graph: ColorTokenGraphInput): string {
  return `${JSON.stringify(canonicalTokenGraph(graph), null, 2)}\n`;
}

export function serializeTokenLayer(layer: ColorTokenLayerInput): string {
  return `${JSON.stringify(canonicalTokenLayer(layer), null, 2)}\n`;
}

export function serializeCompiledScheme(scheme: CompiledColorScheme): string {
  return `${JSON.stringify(canonicalCompiledScheme(scheme), null, 2)}\n`;
}

function canonicalTokenGraph(graph: ColorTokenGraphInput): unknown {
  const output: Record<string, unknown> = {};
  if (graph.$schema !== undefined) {
    defineRecordValue(output, "$schema", graph.$schema);
  }
  defineRecordValue(output, "kind", colorTokenGraphKind);
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

function canonicalTokenLayer(layer: ColorTokenLayerInput): unknown {
  const output: Record<string, unknown> = {};
  if (layer.$schema !== undefined) {
    defineRecordValue(output, "$schema", layer.$schema);
  }
  defineRecordValue(output, "kind", colorTokenLayerKind);
  defineRecordValue(output, "formatVersion", 1);
  defineRecordValue(output, "id", layer.id);
  defineRecordValue(output, "defaultVisibility", layer.defaultVisibility);
  defineRecordValue(output, "tokens", canonicalDefinitions(layer.tokens));
  return output;
}

function canonicalDefinitions(
  tokens: Readonly<Record<string, ColorTokenDefinitionInput>>,
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

function canonicalDefinition(token: ColorTokenDefinitionInput): unknown {
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

function canonicalCompiledScheme(scheme: CompiledColorScheme): unknown {
  const tokens: Record<string, unknown> = {};
  for (const key of Object.keys(scheme.tokens).sort(compareCodeUnits)) {
    const token = scheme.tokens[key];
    if (token === undefined) {
      continue;
    }
    const valueByMode: Record<string, unknown> = {};
    const dependenciesByMode: Record<string, readonly string[]> = {};
    for (const mode of scheme.modes) {
      defineRecordValue(valueByMode, mode, canonicalColor(token.valueByMode[mode] as ColorValue));
      defineRecordValue(
        dependenciesByMode,
        mode,
        [...(token.dependenciesByMode[mode] ?? [])].sort(compareCodeUnits),
      );
    }

    const output: Record<string, unknown> = {};
    defineRecordValue(output, "visibility", token.visibility);
    defineRecordValue(output, "valueByMode", valueByMode);
    defineRecordValue(output, "origin", canonicalOrigin(token.origin));
    defineRecordValue(output, "dependenciesByMode", dependenciesByMode);
    if (token.description !== undefined) {
      defineRecordValue(output, "description", token.description);
    }
    if (token.deprecated !== undefined) {
      defineRecordValue(output, "deprecated", token.deprecated);
    }
    if (token.extensions !== undefined) {
      defineRecordValue(output, "extensions", canonicalJson(token.extensions));
    }
    defineRecordValue(tokens, key, output);
  }

  const output: Record<string, unknown> = {};
  defineRecordValue(output, "kind", compiledColorSchemeKind);
  defineRecordValue(output, "formatVersion", 1);
  defineRecordValue(output, "modes", [...scheme.modes]);
  defineRecordValue(output, "defaultMode", scheme.defaultMode);
  defineRecordValue(output, "tokens", tokens);
  return output;
}

function canonicalOrigin(origin: CompiledColorScheme["tokens"][string]["origin"]): unknown {
  const output: Record<string, unknown> = {};
  defineRecordValue(output, "kind", origin.kind);
  if (origin.kind === "layer" || origin.kind === "source") {
    defineRecordValue(output, "id", origin.id);
  }
  if (origin.kind === "source" && origin.sourceToken !== undefined) {
    defineRecordValue(output, "sourceToken", origin.sourceToken);
  }
  return output;
}

function canonicalExpression(expression: ColorTokenExpressionInput): unknown {
  return isReferenceExpression(expression) ? { ref: expression.ref } : canonicalColor(expression);
}

function canonicalColor(color: ColorValue | ColorValueInput): unknown {
  const output: Record<string, unknown> = {};
  defineRecordValue(output, "colorSpace", color.colorSpace);
  defineRecordValue(output, "components", color.components.map(canonicalComponent));
  defineRecordValue(output, "alpha", normalizeNumber(color.alpha ?? 1));
  if (color.hex !== undefined) {
    defineRecordValue(output, "hex", color.hex.toLowerCase());
  }
  return output;
}

function canonicalComponent(component: ColorComponent): ColorComponent {
  return component === "none" ? component : normalizeNumber(component);
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

function isReferenceExpression(
  expression: ColorTokenExpressionInput,
): expression is ReferenceInput {
  return "ref" in expression;
}
