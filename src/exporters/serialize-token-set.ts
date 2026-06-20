import type { ColorValue } from "../core/color";
import type { CompiledTokenSet } from "../core/compiled-types";
import type { JsonValue } from "../core/json";
import { compareCodeUnits, defineRecordValue, normalizeNumber } from "../core/json";

export function serializeTokenSet(tokenSet: CompiledTokenSet): string {
  return `${JSON.stringify(canonicalTokenSet(tokenSet), null, 2)}\n`;
}

function canonicalTokenSet(tokenSet: CompiledTokenSet): unknown {
  const tokens: Record<string, unknown> = {};
  for (const key of Object.keys(tokenSet.tokens).sort(compareCodeUnits)) {
    const token = tokenSet.tokens[key];
    if (token === undefined) continue;
    const valueByMode: Record<string, unknown> = {};
    const dependenciesByMode: Record<string, readonly string[]> = {};
    for (const mode of tokenSet.modes) {
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
    if (token.description !== undefined)
      defineRecordValue(output, "description", token.description);
    if (token.deprecated !== undefined) defineRecordValue(output, "deprecated", token.deprecated);
    if (token.extensions !== undefined)
      defineRecordValue(output, "extensions", canonicalJson(token.extensions));
    defineRecordValue(tokens, key, output);
  }

  const output: Record<string, unknown> = {};
  defineRecordValue(output, "formatVersion", 1);
  defineRecordValue(output, "modes", [...tokenSet.modes]);
  defineRecordValue(output, "defaultMode", tokenSet.defaultMode);
  defineRecordValue(output, "tokens", tokens);
  return output;
}

function canonicalOrigin(origin: CompiledTokenSet["tokens"][string]["origin"]): unknown {
  const output: Record<string, unknown> = {};
  defineRecordValue(output, "kind", origin.kind);
  if (origin.kind === "fragment" || origin.kind === "source")
    defineRecordValue(output, "id", origin.id);
  if (origin.kind === "source" && origin.sourceToken !== undefined) {
    defineRecordValue(output, "sourceToken", origin.sourceToken);
  }
  return output;
}

function canonicalColor(color: ColorValue): unknown {
  const output: Record<string, unknown> = {};
  defineRecordValue(output, "colorSpace", color.colorSpace);
  if (color.colorSpace === "oklch") {
    defineRecordValue(output, "l", normalizeNumber(color.l));
    defineRecordValue(output, "c", normalizeNumber(color.c));
    defineRecordValue(output, "h", normalizeNumber(color.h));
  } else {
    defineRecordValue(output, "r", normalizeNumber(color.r));
    defineRecordValue(output, "g", normalizeNumber(color.g));
    defineRecordValue(output, "b", normalizeNumber(color.b));
  }
  defineRecordValue(output, "alpha", normalizeNumber(color.alpha));
  return output;
}

function canonicalJson(value: JsonValue): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return normalizeNumber(value);
  if (Array.isArray(value)) return value.map((entry) => canonicalJson(entry));

  const output: Record<string, JsonValue> = {};
  const record = value as Readonly<Record<string, JsonValue>>;
  for (const key of Object.keys(record).sort(compareCodeUnits)) {
    defineRecordValue(output, key, canonicalJson(record[key] as JsonValue));
  }
  return output;
}
