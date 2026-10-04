import type { TokenDefinitionMetadata, TokenVisibility } from "./graph";
import { isModeKey } from "./graph";
import { isSingleSegmentIdentifier } from "./identifiers";
import {
  copyJsonValue,
  defineRecordValue,
  escapePointerSegment,
  pointer,
  readArray,
  readPlainRecord,
  sortedRecord,
  type JsonValue,
} from "./json";
import type { TokenGraphIssue } from "../types/diagnostics";
import type { Issue } from "./result";

type FieldIssue = Extract<
  TokenGraphIssue,
  {
    readonly code:
      | "invalid-description"
      | "invalid-deprecated"
      | "invalid-extensions"
      | "invalid-json-value"
      | "missing-property"
      | "invalid-mode-key"
      | "empty-modes"
      | "duplicate-mode-key"
      | "default-mode-not-found"
      | "invalid-visibility"
      | "invalid-default-visibility"
      | "invalid-layer-id"
      | "unknown-property";
  }
>;
type Collector<Code extends FieldIssue["code"]> = {
  add(issue: Extract<FieldIssue, { readonly code: Code }>): void;
  addMany(issues: readonly Extract<FieldIssue, { readonly code: Code }>[]): void;
};

export function parseDefinitionMetadata(
  record: ReadonlyMap<string, unknown>,
  path: string,
  collector: Collector<
    "invalid-description" | "invalid-deprecated" | "invalid-extensions" | "invalid-json-value"
  >,
): Omit<TokenDefinitionMetadata, "visibility"> {
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
      collector.addMany(extensionEntries.issues);
    } else {
      const copied: Record<string, JsonValue> = {};
      for (const entry of extensionEntries.value) {
        const value = copyJsonValue(entry.value, {
          code: "invalid-json-value",
          message: "Extension values must be JSON-safe.",
          path: `${path}/extensions/${escapePointerSegment(entry.key)}`,
        });
        if (value.ok) {
          defineRecordValue(copied, entry.key, value.value);
        } else {
          collector.addMany(value.issues);
        }
      }
      output.extensions = sortedRecord(Object.entries(copied));
    }
  }

  return output;
}

export function parseModes(
  input: unknown,
  collector: Collector<
    "missing-property" | "invalid-mode-key" | "empty-modes" | "duplicate-mode-key"
  >,
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
    if (typeof value !== "string" || !isModeKey(value)) {
      collector.add({
        code: "invalid-mode-key",
        message: "Mode identifiers must be unreserved lower-kebab single segments.",
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

export function parseDefaultMode(
  input: unknown,
  modes: readonly string[] | undefined,
  collector: Collector<"missing-property" | "default-mode-not-found">,
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

export function parseVisibility<Code extends "invalid-default-visibility" | "invalid-visibility">(
  input: unknown,
  path: string,
  code: Code,
  collector: { add(issue: Issue<NoInfer<Code>> & { readonly path: string }): void },
): TokenVisibility | undefined {
  if (input === "public" || input === "internal") {
    return input;
  }
  collector.add({ code, message: "Visibility must be public or internal.", path });
  return undefined;
}

export function parseLayerId(
  input: unknown,
  path: string,
  collector: Collector<"invalid-layer-id">,
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

export function rejectUnknownKeys(
  entries: readonly { readonly key: string }[],
  allowed: ReadonlySet<string>,
  path: string,
  collector: Collector<"unknown-property">,
): void {
  for (const entry of entries) {
    if (allowed.has(entry.key)) {
      continue;
    }
    collector.add({
      code: "unknown-property",
      message: `Unknown property: ${entry.key}.`,
      path: path === "" ? pointer(entry.key) : `${path}/${escapePointerSegment(entry.key)}`,
    });
  }
}
