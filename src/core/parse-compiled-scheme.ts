import type {
  CompiledScheme,
  CompiledExpression,
  TokenDeclarationRecord,
  CompiledToken,
  CompiledTokenMetadata,
  ParseCompiledSchemeIssue,
} from "./compiled-types";
import { compiledSchemeKind, type TokenOrigin } from "./graph";
import { isSingleSegmentIdentifier, isTokenKey } from "./identifiers";
import {
  compareCodeUnits,
  defineRecordValue,
  escapePointerSegment,
  pointer,
  readArray,
  readPlainRecord,
  sortedRecord,
} from "./json";
import { IssueCollector, type Result } from "./result";

import {
  parseModes,
  parseVisibility,
  parseDefaultMode,
  parseDefinitionMetadata as parseOptionalMetadata,
  rejectUnknownKeys,
} from "./validation-fields";

const topLevelKeys = new Set([
  "$schema",
  "kind",
  "formatVersion",
  "modes",
  "defaultMode",
  "tokens",
  "metadataByToken",
]);
const metadataKeys = new Set([
  "visibility",
  "declarations",
  "expressionByMode",
  "description",
  "deprecated",
  "extensions",
]);

export function parseCompiledScheme(
  input: unknown,
): Result<CompiledScheme<string, string, false>, ParseCompiledSchemeIssue> {
  const collector = new IssueCollector<ParseCompiledSchemeIssue>();
  const top = readPlainRecord(input, {
    code: "invalid-object",
    message: "Compiled scheme must be a plain object.",
  });
  if (!top.ok) {
    return top;
  }

  const record = new Map(top.value.map((entry) => [entry.key, entry.value]));
  rejectUnknownKeys(top.value, topLevelKeys, "", collector);
  parseKind(record.get("kind"), collector);
  if (record.get("formatVersion") !== 2) {
    collector.add({
      code: record.has("formatVersion") ? "invalid-format-version" : "missing-property",
      message: "Compiled scheme formatVersion must be numeric 2; recompile from the source graph.",
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

  const modes = parseModes(record.get("modes"), collector);
  const defaultMode = parseDefaultMode(record.get("defaultMode"), modes, collector);
  const canonicalModes = modes === undefined || defaultMode === undefined ? undefined : modes;
  const tokens = parseTokens(record.get("tokens"), canonicalModes ?? [], collector);
  const metadataByToken = parseMetadataByToken(
    record.get("metadataByToken"),
    tokens === undefined ? undefined : Object.keys(tokens),
    canonicalModes ?? [],
    collector,
  );

  const issues = collector.issues();
  if (issues !== undefined) {
    return { ok: false, issues };
  }
  if (
    canonicalModes === undefined ||
    defaultMode === undefined ||
    tokens === undefined ||
    metadataByToken === undefined
  ) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-object",
          message: "Compiled scheme could not be parsed.",
        },
      ],
    };
  }

  return {
    ok: true,
    value: {
      ...(typeof schema === "string" ? { $schema: schema } : {}),
      kind: compiledSchemeKind,
      formatVersion: 2,
      modes: canonicalModes as readonly [string, ...string[]],
      defaultMode,
      tokens,
      metadataByToken,
    },
  };
}

function parseKind(input: unknown, collector: IssueCollector<ParseCompiledSchemeIssue>): void {
  if (input === compiledSchemeKind) {
    return;
  }
  collector.add({
    code: input === undefined ? "missing-property" : "invalid-artifact-kind",
    message: `Artifact kind must be ${compiledSchemeKind}.`,
    path: pointer("kind"),
  });
}

function parseTokens(
  input: unknown,
  modes: readonly string[],
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): Readonly<Record<string, CompiledToken>> | undefined {
  if (input === undefined) {
    collector.add({
      code: "missing-property",
      message: "Compiled scheme requires tokens.",
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
    collector.addMany(entries.issues);
    return undefined;
  }
  if (entries.value.length === 0) {
    collector.add({
      code: "invalid-object",
      message: "tokens must contain at least one compiled token.",
      path: pointer("tokens"),
    });
  }
  const tokens: Record<string, CompiledToken> = {};
  for (const entry of entries.value) {
    const tokenPath = `${pointer("tokens")}/${escapePointerSegment(entry.key)}`;
    if (!isTokenKey(entry.key)) {
      collector.add({
        code: "invalid-token-key",
        message: "Token keys must be dot-separated lower-kebab identifiers.",
        path: tokenPath,
        key: entry.key,
      });
      continue;
    }
    const token = parseTokenModeValues(entry.value, tokenPath, modes, collector);
    if (token !== undefined) {
      defineRecordValue(tokens, entry.key, token);
    }
  }
  return sortedRecord(Object.entries(tokens));
}

function parseTokenModeValues(
  input: unknown,
  path: string,
  modes: readonly string[],
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): CompiledToken | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "Compiled token must be a plain mode-value object.",
    path,
  });
  if (!entries.ok) {
    collector.addMany(entries.issues);
    return undefined;
  }
  const modeSet = new Set(modes);
  const seen = new Set<string>();
  const output: Record<string, string> = {};
  for (const entry of entries.value) {
    const valuePath = `${path}/${escapePointerSegment(entry.key)}`;
    if (!modeSet.has(entry.key)) {
      collector.add({
        code: "unknown-mode-value",
        message: `Compiled token contains unknown mode: ${entry.key}.`,
        path: valuePath,
        mode: entry.key,
      });
      continue;
    }
    seen.add(entry.key);
    if (typeof entry.value !== "string") {
      collector.add({
        code: "invalid-token-value",
        message: "Compiled token values must be CSS strings.",
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
        message: `Compiled token is missing mode: ${mode}.`,
        path,
        mode,
      });
    }
  }
  return sortedRecord(Object.entries(output));
}

function parseMetadataByToken(
  input: unknown,
  tokenKeys: readonly string[] | undefined,
  modes: readonly string[],
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): Readonly<Record<string, CompiledTokenMetadata>> | undefined {
  if (input === undefined) {
    collector.add({
      code: "missing-property",
      message: "Compiled scheme requires metadataByToken.",
      path: pointer("metadataByToken"),
    });
    return undefined;
  }
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: "metadataByToken must be a plain object record.",
    path: pointer("metadataByToken"),
  });
  if (!entries.ok) {
    collector.addMany(entries.issues);
    return undefined;
  }
  if (entries.value.length === 0) {
    collector.add({
      code: "invalid-object",
      message: "metadataByToken must contain at least one token metadata record.",
      path: pointer("metadataByToken"),
    });
  }

  const expected = tokenKeys === undefined ? undefined : new Set(tokenKeys);
  const seen = new Set<string>();
  const metadataByToken: Record<string, CompiledTokenMetadata> = {};
  for (const entry of entries.value) {
    const tokenPath = `${pointer("metadataByToken")}/${escapePointerSegment(entry.key)}`;
    if (!isTokenKey(entry.key)) {
      collector.add({
        code: "invalid-token-key",
        message: "Token metadata keys must be dot-separated lower-kebab identifiers.",
        path: tokenPath,
        key: entry.key,
      });
      continue;
    }
    if (expected !== undefined && !expected.has(entry.key)) {
      collector.add({
        code: "unknown-property",
        message: `metadataByToken contains unknown token: ${entry.key}.`,
        path: tokenPath,
        key: entry.key,
      });
      continue;
    }
    seen.add(entry.key);
    const metadata = parseTokenMetadata(entry.value, tokenPath, modes, collector);
    if (metadata !== undefined) {
      defineRecordValue(metadataByToken, entry.key, metadata);
    }
  }

  if (expected !== undefined) {
    for (const key of [...expected].sort(compareCodeUnits)) {
      if (!seen.has(key)) {
        collector.add({
          code: "missing-property",
          message: `metadataByToken is missing token: ${key}.`,
          path: `${pointer("metadataByToken")}/${escapePointerSegment(key)}`,
          key,
        });
      }
    }
  }

  return sortedRecord(Object.entries(metadataByToken));
}

function parseTokenMetadata(
  input: unknown,
  path: string,
  modes: readonly string[],
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): CompiledTokenMetadata | undefined {
  const entries = readPlainRecord(input, {
    code: "invalid-token-definition",
    message: "Compiled token metadata must be a plain object.",
    path,
  });
  if (!entries.ok) {
    collector.addMany(entries.issues);
    return undefined;
  }
  rejectUnknownKeys(entries.value, metadataKeys, path, collector);
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const visibility = parseVisibility(
    record.get("visibility"),
    `${path}/visibility`,
    "invalid-visibility",
    collector,
  );
  const declarations = parseDeclarations(
    record.get("declarations"),
    `${path}/declarations`,
    collector,
  );
  const expressionByMode = record.has("expressionByMode")
    ? parseExpressions(record.get("expressionByMode"), `${path}/expressionByMode`, modes, collector)
    : undefined;
  const metadata = parseOptionalMetadata(record, path, collector);
  if (visibility === undefined || declarations === undefined) {
    return undefined;
  }
  return {
    visibility,
    declarations,
    ...(expressionByMode === undefined ? {} : { expressionByMode }),
    ...metadata,
  };
}

function parseOrigin(
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
    collector.addMany(entries.issues);
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
  collector.add({ code: "invalid-origin", message: "Invalid compiled token origin.", path });
  return undefined;
}

function parseDeclarations(
  input: unknown,
  path: string,
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): readonly [TokenDeclarationRecord, ...TokenDeclarationRecord[]] | undefined {
  const array = readArray(input, {
    code: "invalid-declarations",
    message: "declarations must be a non-empty dense array.",
    path,
  });
  if (!array.ok) {
    collector.addMany(array.issues);
    return undefined;
  }
  if (array.value.length === 0) {
    collector.add({
      code: "invalid-declarations",
      message: "declarations must not be empty.",
      path,
    });
    return undefined;
  }
  const declarations: TokenDeclarationRecord[] = [];
  for (const entry of array.value) {
    const entryPath = path + pointer(entry.index);
    const record = readPlainRecord(entry.value, {
      code: "invalid-declarations",
      message: "Declaration must be a plain object.",
      path: entryPath,
    });
    if (!record.ok) {
      collector.addMany(record.issues);
      continue;
    }
    rejectUnknownKeys(record.value, new Set(["origin", "visibility"]), entryPath, collector);
    const fields = new Map(record.value.map((field) => [field.key, field.value]));
    const origin = parseOrigin(fields.get("origin"), entryPath + "/origin", collector);
    const visibility = fields.has("visibility")
      ? parseVisibility(
          fields.get("visibility"),
          entryPath + "/visibility",
          "invalid-visibility",
          collector,
        )
      : undefined;
    if (origin !== undefined) {
      declarations.push({ origin, ...(visibility === undefined ? {} : { visibility }) });
    }
  }
  return declarations.length === 0
    ? undefined
    : (declarations as [TokenDeclarationRecord, ...TokenDeclarationRecord[]]);
}

function parseExpressions(
  input: unknown,
  path: string,
  modes: readonly string[],
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): Readonly<Record<string, CompiledExpression>> | undefined {
  const record = readPlainRecord(input, {
    code: "invalid-expression",
    message: "expressionByMode must be a non-empty sparse record.",
    path,
  });
  if (!record.ok) {
    collector.addMany(record.issues);
    return undefined;
  }
  if (record.value.length === 0) {
    collector.add({
      code: "invalid-expression",
      message: "Omit an empty expressionByMode record.",
      path,
    });
  }
  const output: Record<string, CompiledExpression> = {};
  for (const entry of record.value) {
    const entryPath = path + pointer(entry.key);
    if (!modes.includes(entry.key)) {
      collector.add({
        code: "unknown-mode-value",
        message: "Unknown expression mode.",
        path: entryPath,
        mode: entry.key,
      });
      continue;
    }
    const expression = parseRetainedExpression(entry.value, entryPath, collector);
    if (expression !== undefined) {
      defineRecordValue(output, entry.key, expression);
    }
  }
  return sortedRecord(Object.entries(output));
}

function parseRetainedExpression(
  input: unknown,
  path: string,
  collector: IssueCollector<ParseCompiledSchemeIssue>,
): CompiledExpression | undefined {
  const invalid = {
    code: "invalid-expression",
    message: "Expected a canonical retained reference or concat.",
    path,
  } as const;
  const record = readPlainRecord(input, invalid);
  if (!record.ok) {
    collector.addMany(record.issues);
    return undefined;
  }
  const entry = record.value[0];
  if (record.value.length !== 1 || entry === undefined) {
    collector.add(invalid);
    return undefined;
  }
  if (entry.key === "ref" && typeof entry.value === "string" && isTokenKey(entry.value)) {
    return { ref: entry.value };
  }
  if (entry.key !== "concat") {
    collector.add(invalid);
    return undefined;
  }
  const array = readArray(entry.value, invalid);
  if (!array.ok) {
    collector.addMany(array.issues);
    return undefined;
  }
  if (array.value.length < 2) {
    collector.add(invalid);
    return undefined;
  }
  const parts: (string | { readonly ref: string; readonly value: string })[] = [];
  let previousLiteral = false;
  let references = 0;
  for (const part of array.value) {
    const partInvalid = { ...invalid, path: path + pointer("concat", part.index) };
    if (typeof part.value === "string") {
      if (part.value.length === 0 || previousLiteral) {
        collector.add(partInvalid);
        return undefined;
      }
      parts.push(part.value);
      previousLiteral = true;
    } else {
      const fields = readPlainRecord(part.value, partInvalid);
      if (!fields.ok) {
        collector.addMany(fields.issues);
        return undefined;
      }
      const data = new Map(fields.value.map((field) => [field.key, field.value]));
      const ref = data.get("ref");
      const value = data.get("value");
      if (
        fields.value.length !== 2 ||
        typeof ref !== "string" ||
        !isTokenKey(ref) ||
        typeof value !== "string"
      ) {
        collector.add(partInvalid);
        return undefined;
      }
      parts.push({ ref, value });
      previousLiteral = false;
      references += 1;
    }
  }
  if (references === 0) {
    collector.add(invalid);
    return undefined;
  }
  return {
    concat: parts as [
      string | { readonly ref: string; readonly value: string },
      ...(string | { readonly ref: string; readonly value: string })[],
    ],
  };
}
