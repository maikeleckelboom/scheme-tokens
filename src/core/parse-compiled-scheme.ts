import type {
  CompiledColorScheme,
  CompiledColorToken,
  ParseCompiledSchemeIssue,
} from "./compiled-types";
import { compiledColorSchemeKind, type TokenOrigin, type TokenVisibility } from "./graph";
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

const topLevelKeys = new Set(["kind", "formatVersion", "modes", "defaultMode", "tokens"]);
const tokenKeys = new Set([
  "visibility",
  "valueByMode",
  "origin",
  "dependenciesByMode",
  "description",
  "deprecated",
  "extensions",
]);

export function parseCompiledScheme(
  input: unknown,
): Result<CompiledColorScheme, ParseCompiledSchemeIssue> {
  const collector = new IssueCollector<ParseCompiledSchemeIssue>();
  const top = readPlainRecord(input, {
    code: "invalid-object",
    message: "Compiled color scheme must be a plain object.",
  });
  if (!top.ok) {
    return top as Result<never, ParseCompiledSchemeIssue>;
  }

  const record = new Map(top.value.map((entry) => [entry.key, entry.value]));
  rejectUnknownKeys(top.value, topLevelKeys, "", collector);
  parseKind(record.get("kind"), collector);
  if (record.get("formatVersion") !== 1) {
    collector.add({
      code: record.has("formatVersion") ? "invalid-format-version" : "missing-property",
      message: "Compiled color scheme formatVersion must be numeric 1.",
      path: pointer("formatVersion"),
    });
  }

  const modes = parseModes(record.get("modes"), collector);
  const defaultMode = parseDefaultMode(record.get("defaultMode"), modes, collector);
  const canonicalModes =
    modes === undefined || defaultMode === undefined
      ? undefined
      : canonicalizeModes(modes, defaultMode);
  const tokens = parseTokens(record.get("tokens"), canonicalModes ?? [], collector);

  const issues = collector.issues();
  if (issues !== undefined) {
    return { ok: false, issues };
  }
  if (canonicalModes === undefined || defaultMode === undefined || tokens === undefined) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-object",
          message: "Compiled color scheme could not be parsed.",
        },
      ],
    };
  }

  return {
    ok: true,
    value: {
      kind: compiledColorSchemeKind,
      formatVersion: 1,
      modes: canonicalModes as readonly [string, ...string[]],
      defaultMode,
      tokens,
    },
  };
}

function parseKind(input: unknown, collector: IssueCollector<ParseCompiledSchemeIssue>): void {
  if (input === compiledColorSchemeKind) {
    return;
  }
  collector.add({
    code: input === undefined ? "missing-property" : "invalid-artifact-kind",
    message: `Artifact kind must be ${compiledColorSchemeKind}.`,
    path: pointer("kind"),
  });
}

function parseModes(
  input: unknown,
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): readonly string[] | undefined {
  if (input === undefined) {
    collector.add({
      code: "missing-property",
      message: "Compiled color scheme requires modes.",
      path: pointer("modes"),
    });
    return undefined;
  }
  const array = readArray(input, {
    code: "invalid-mode-key",
    message: "modes must be a non-empty dense array.",
    path: pointer("modes"),
  });
  if (!array.ok || array.value.length === 0) {
    collector.add({
      code: "invalid-mode-key",
      message: "modes must be a non-empty array.",
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
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): string | undefined {
  if (typeof input !== "string") {
    collector.add({
      code: input === undefined ? "missing-property" : "invalid-mode-key",
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

function parseTokens(
  input: unknown,
  modes: readonly string[],
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): Readonly<Record<string, CompiledColorToken>> | undefined {
  if (input === undefined) {
    collector.add({
      code: "missing-property",
      message: "Compiled color scheme requires tokens.",
      path: pointer("tokens"),
    });
    return undefined;
  }
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: "tokens must be a plain object record.",
    path: pointer("tokens"),
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly ParseCompiledSchemeIssue[]);
    return undefined;
  }
  const tokens: Record<string, CompiledColorToken> = {};
  for (const entry of entries.value) {
    const tokenPath = `${pointer("tokens")}/${escapeTokenPath(entry.key)}`;
    if (!isTokenKey(entry.key)) {
      collector.add({
        code: "invalid-token-key",
        message: "Token keys must be dot-separated lower-kebab identifiers.",
        path: tokenPath,
        key: entry.key,
      });
      continue;
    }
    const token = parseToken(entry.value, tokenPath, modes, collector);
    if (token !== undefined) {
      defineRecordValue(tokens, entry.key, token);
    }
  }
  return sortedRecord(Object.entries(tokens));
}

function parseToken(
  input: unknown,
  path: string,
  modes: readonly string[],
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): CompiledColorToken | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "Compiled token must be a plain object.",
    path,
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly ParseCompiledSchemeIssue[]);
    return undefined;
  }
  rejectUnknownKeys(entries.value, tokenKeys, path, collector);
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const visibility = parseVisibility(record.get("visibility"), `${path}/visibility`, collector);
  const valueByMode = parseValueByMode(
    record.get("valueByMode"),
    `${path}/valueByMode`,
    modes,
    collector,
  );
  const origin = parseOrigin(record.get("origin"), `${path}/origin`, collector);
  const dependenciesByMode = parseDependenciesByMode(
    record.get("dependenciesByMode"),
    `${path}/dependenciesByMode`,
    modes,
    collector,
  );
  const metadata = parseMetadata(record, path, collector);
  if (
    visibility === undefined ||
    valueByMode === undefined ||
    origin === undefined ||
    dependenciesByMode === undefined
  ) {
    return undefined;
  }
  return {
    visibility,
    valueByMode,
    origin,
    dependenciesByMode,
    ...metadata,
  };
}

function parseVisibility(
  input: unknown,
  path: string,
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): TokenVisibility | undefined {
  if (input === "public" || input === "internal") {
    return input;
  }
  collector.add({
    code: "invalid-visibility",
    message: "Visibility must be public or internal.",
    path,
  });
  return undefined;
}

function parseValueByMode(
  input: unknown,
  path: string,
  modes: readonly string[],
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): Readonly<Record<string, string>> | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "valueByMode must be a plain object.",
    path,
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly ParseCompiledSchemeIssue[]);
    return undefined;
  }
  const modeSet = new Set(modes);
  const seen = new Set<string>();
  const output: Record<string, string> = {};
  for (const entry of entries.value) {
    const valuePath = `${path}/${escapeTokenPath(entry.key)}`;
    if (!modeSet.has(entry.key)) {
      collector.add({
        code: "unknown-mode-value",
        message: `valueByMode contains unknown mode: ${entry.key}.`,
        path: valuePath,
        mode: entry.key,
      });
      continue;
    }
    seen.add(entry.key);
    if (typeof entry.value !== "string") {
      collector.add({
        code: "invalid-token-value",
        message: "Compiled token values must be authored CSS color strings.",
        path: valuePath,
        mode: entry.key,
      });
      continue;
    }
    defineRecordValue(output, entry.key, entry.value);
  }
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
  return sortedRecord(Object.entries(output));
}

function parseOrigin(
  input: unknown,
  path: string,
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): TokenOrigin | undefined {
  return parseBaseOrigin(input, path, collector);
}

function parseBaseOrigin(
  input: unknown,
  path: string,
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): TokenOrigin | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-origin",
    message: "origin must be a plain object.",
    path,
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly ParseCompiledSchemeIssue[]);
    return undefined;
  }
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const kind = record.get("kind");
  if (kind === "graph" && entries.value.length === 1) {
    return { kind: "graph" };
  }
  if (
    kind === "layer" &&
    entries.value.length === 2 &&
    typeof record.get("id") === "string" &&
    isSingleSegmentIdentifier(record.get("id") as string)
  ) {
    return { kind, id: record.get("id") as string };
  }
  if (
    kind === "source" &&
    (entries.value.length === 2 || entries.value.length === 3) &&
    typeof record.get("id") === "string" &&
    isSingleSegmentIdentifier(record.get("id") as string) &&
    (!record.has("sourceToken") ||
      (typeof record.get("sourceToken") === "string" &&
        isTokenKey(record.get("sourceToken") as string)))
  ) {
    return {
      kind,
      id: record.get("id") as string,
      ...(typeof record.get("sourceToken") === "string"
        ? { sourceToken: record.get("sourceToken") as string }
        : {}),
    };
  }
  collector.add({ code: "invalid-origin", message: "Invalid compiled token origin.", path });
  return undefined;
}

function parseDependenciesByMode(
  input: unknown,
  path: string,
  modes: readonly string[],
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): Readonly<Record<string, readonly string[]>> | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-dependencies",
    message: "dependenciesByMode must be a plain object.",
    path,
  });
  if (!entries.ok) {
    collector.addMany(entries.issues as readonly ParseCompiledSchemeIssue[]);
    return undefined;
  }
  const modeSet = new Set(modes);
  const seen = new Set<string>();
  const output: Record<string, readonly string[]> = {};
  for (const entry of entries.value) {
    const valuePath = `${path}/${escapeTokenPath(entry.key)}`;
    if (!modeSet.has(entry.key)) {
      collector.add({
        code: "unknown-mode-value",
        message: `dependenciesByMode contains unknown mode: ${entry.key}.`,
        path: valuePath,
        mode: entry.key,
      });
      continue;
    }
    seen.add(entry.key);
    const dependenciesInput = readArray(entry.value, {
      code: "invalid-dependencies",
      message: "Mode dependencies must be a dense array.",
      path: valuePath,
    });
    if (!dependenciesInput.ok) {
      collector.add({
        code: "invalid-dependencies",
        message: "Mode dependencies must be an array.",
        path: valuePath,
      });
      continue;
    }
    const dependencies: string[] = [];
    for (const dependencyEntry of dependenciesInput.value) {
      const dependency = dependencyEntry.value;
      if (typeof dependency !== "string" || !isTokenKey(dependency)) {
        collector.add({
          code: "invalid-dependencies",
          message: "Dependencies must be valid token keys.",
          path: `${valuePath}/${dependencyEntry.index}`,
          ...(typeof dependency === "string" ? { key: dependency } : {}),
        });
        continue;
      }
      dependencies.push(dependency);
    }
    defineRecordValue(output, entry.key, [...dependencies].sort(compareCodeUnits));
  }
  for (const mode of modes) {
    if (!seen.has(mode)) {
      collector.add({
        code: "missing-mode-value",
        message: `dependenciesByMode is missing mode: ${mode}.`,
        path,
        mode,
      });
    }
  }
  return sortedRecord(Object.entries(output));
}

function parseMetadata(
  record: ReadonlyMap<string, unknown>,
  path: string,
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): Pick<CompiledColorToken, "description" | "deprecated" | "extensions"> {
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
    const entries = readPlainRecord(extensions, {
      code: "invalid-extensions",
      message: "extensions must be a plain object.",
      path: `${path}/extensions`,
    });
    if (!entries.ok) {
      collector.addMany(entries.issues as readonly ParseCompiledSchemeIssue[]);
    } else {
      const copied: Record<string, JsonValue> = {};
      for (const entry of entries.value) {
        const value = copyJsonValue(entry.value, {
          code: "invalid-json-value",
          message: "Extension values must be JSON-safe.",
          path: `${path}/extensions/${escapeTokenPath(entry.key)}`,
        });
        if (value.ok) {
          defineRecordValue(copied, entry.key, value.value);
        } else {
          collector.addMany(value.issues as readonly ParseCompiledSchemeIssue[]);
        }
      }
      output.extensions = sortedRecord(Object.entries(copied));
    }
  }
  return output;
}

function rejectUnknownKeys(
  entries: readonly { readonly key: string }[],
  allowed: ReadonlySet<string>,
  path: string,
  collector: IssueCollector<ParseCompiledSchemeIssue>,
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

function escapeTokenPath(key: string): string {
  return key.replaceAll("~", "~0").replaceAll("/", "~1");
}
