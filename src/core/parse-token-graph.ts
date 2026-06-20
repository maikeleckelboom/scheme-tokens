import { cloneColor, parseColorAt } from "./color";
import type {
  ColorExpression,
  ReferenceInput,
  TokenGraph,
  TokenGraphIssue,
  TokenGraphToken,
  TokenOrigin,
  TokenVisibility,
} from "./graph";
import { isReferenceInput } from "./graph";
import { isExtensionKey, isSingleSegmentIdentifier, isTokenKey } from "./identifiers";
import {
  compareCodeUnits,
  copyJsonValue,
  defineRecordValue,
  pointer,
  readPlainRecord,
  sortedRecord,
} from "./json";
import type { JsonValue } from "./json";
import { IssueCollector, type Result } from "./result";

interface ParseContext {
  readonly sourceId?: string;
  readonly callerFragmentIds?: ReadonlySet<string>;
  readonly tokenSourceIds?: ReadonlyMap<string, string>;
  readonly fragmentSourceIds?: ReadonlyMap<string, string>;
  readonly skipReferenceValidation?: boolean;
}

interface ParsedToken {
  readonly visibility: TokenVisibility;
  readonly valueByMode: Readonly<Record<string, ColorExpression>>;
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

const topLevelKeys = new Set([
  "$schema",
  "formatVersion",
  "modes",
  "defaultMode",
  "defaultVisibility",
  "tokens",
  "fragments",
]);

const fragmentKeys = new Set(["$schema", "formatVersion", "id", "defaultVisibility", "tokens"]);
const tokenKeys = new Set([
  "visibility",
  "description",
  "deprecated",
  "extensions",
  "value",
  "valueByMode",
]);

export function parseTokenGraph(input: unknown): Result<TokenGraph, TokenGraphIssue> {
  return parseTokenGraphInternal(input, {});
}

export function parseTokenGraphInternal(
  input: unknown,
  context: ParseContext,
): Result<TokenGraph, TokenGraphIssue> {
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

  const declarations: TokenDeclaration[] = [];
  const firstTokenPaths = new Map<string, string>();
  const validModes = canonicalModes ?? [];

  const tokensInput = graphRecord.get("tokens");
  if (tokensInput === undefined) {
    collector.add({
      code: "missing-property",
      message: "Token graph requires tokens.",
      path: pointer("tokens"),
    });
  } else if (defaultVisibility !== undefined) {
    parseTokenRecord(tokensInput, {
      path: pointer("tokens"),
      modes: validModes,
      defaultVisibility,
      originForKey: (key) => directOrigin(context, key),
      collector,
      declarations,
      firstTokenPaths,
    });
  }

  const fragmentIds = new Map<string, string>();
  const fragmentsInput = graphRecord.get("fragments");
  if (fragmentsInput !== undefined) {
    if (!Array.isArray(fragmentsInput)) {
      collector.add({
        code: "invalid-object",
        message: "fragments must be an array.",
        path: pointer("fragments"),
      });
    } else {
      for (const [index, fragmentInput] of fragmentsInput.entries()) {
        parseFragment(fragmentInput, index, {
          context,
          modes: validModes,
          collector,
          declarations,
          firstTokenPaths,
          fragmentIds,
        });
      }
    }
  }

  const tokenMap = new Map(
    declarations.map((declaration) => [declaration.key, declaration.token] as const),
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
      issues: [{ code: "empty-modes", message: "Token graph requires valid modes." }],
    };
  }

  return {
    ok: true,
    value: {
      formatVersion: 1,
      modes: canonicalModes as readonly [string, ...string[]],
      defaultMode,
      tokens: sortedRecord(
        declarations.map(
          (declaration) => [declaration.key, toPublicToken(declaration.token)] as const,
        ),
      ),
    },
  };
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
  if (!Array.isArray(input)) {
    collector.add({
      code: "invalid-mode-key",
      message: "modes must be an array.",
      path: pointer("modes"),
    });
    return undefined;
  }
  if (input.length === 0) {
    collector.add({
      code: "empty-modes",
      message: "modes must contain at least one mode.",
      path: pointer("modes"),
    });
    return undefined;
  }

  const modes: string[] = [];
  const seen = new Set<string>();
  for (const [index, value] of input.entries()) {
    if (typeof value !== "string" || !isSingleSegmentIdentifier(value)) {
      collector.add({
        code: "invalid-mode-key",
        message: "Mode identifiers must be lower-kebab single segments.",
        path: pointer("modes", index),
        ...(typeof value === "string" ? { mode: value } : {}),
      });
      continue;
    }
    if (seen.has(value)) {
      collector.add({
        code: "duplicate-mode-key",
        message: `Duplicate mode: ${value}.`,
        path: pointer("modes", index),
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
    readonly declarations: TokenDeclaration[];
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

    const token = parseTokenDefinition(entry.value, {
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
    options.declarations.push({ key: entry.key, path: tokenPath, token });
  }
}

function parseFragment(
  input: unknown,
  index: number,
  options: {
    readonly context: ParseContext;
    readonly modes: readonly string[];
    readonly collector: IssueCollector<TokenGraphIssue>;
    readonly declarations: TokenDeclaration[];
    readonly firstTokenPaths: Map<string, string>;
    readonly fragmentIds: Map<string, string>;
  },
): void {
  const path = pointer("fragments", index);
  const entries = readPlainRecord(input, {
    code: "invalid-object",
    message: "Fragment must be a plain object.",
    path,
  });
  if (!entries.ok) {
    options.collector.addMany(entries.issues as readonly TokenGraphIssue[]);
    return;
  }
  rejectUnknownKeys(entries.value, fragmentKeys, path, options.collector);

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  if (record.get("formatVersion") !== 1) {
    options.collector.add({
      code: "invalid-format-version",
      message: "Fragment formatVersion must be numeric 1.",
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

  const id = record.get("id");
  const fragmentId = typeof id === "string" && isSingleSegmentIdentifier(id) ? id : undefined;
  if (fragmentId === undefined) {
    options.collector.add({
      code: "invalid-fragment-id",
      message: "Fragment id must be a lower-kebab single segment.",
      path: `${path}/id`,
      ...(typeof id === "string" ? { fragmentId: id } : {}),
    });
  } else {
    const firstPath = options.fragmentIds.get(fragmentId);
    if (firstPath !== undefined) {
      options.collector.add({
        code: "duplicate-fragment-id",
        message: `Duplicate fragment id: ${fragmentId}.`,
        path: `${path}/id`,
        fragmentId,
        firstPath,
      });
    } else {
      options.fragmentIds.set(fragmentId, `${path}/id`);
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
      message: "Fragment requires tokens.",
      path: `${path}/tokens`,
    });
  }
  if (fragmentId === undefined || defaultVisibility === undefined || tokens === undefined) {
    return;
  }

  parseTokenRecord(tokens, {
    path: `${path}/tokens`,
    modes: options.modes,
    defaultVisibility,
    originForKey: () => fragmentOrigin(fragmentId, options.context),
    collector: options.collector,
    declarations: options.declarations,
    firstTokenPaths: options.firstTokenPaths,
  });
}

function parseTokenDefinition(
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

  const metadata = parseMetadata(record, options.path, options.collector);
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

  const valueByMode: Record<string, ColorExpression> = {};
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

function parseMetadata(
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
        if (!isExtensionKey(entry.key)) {
          collector.add({
            code: "invalid-extension-key",
            message: "Extension keys must contain at least two lower-kebab namespace segments.",
            path: `${path}/extensions/${escapeTokenPath(entry.key)}`,
          });
          continue;
        }
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
    readonly output: Record<string, ColorExpression>;
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
): ColorExpression | undefined {
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

  const color = parseColorAt(input, path);
  if (!color.ok) {
    collector.addMany(color.issues as readonly TokenGraphIssue[]);
    return undefined;
  }
  return color.value;
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

function directOrigin(context: ParseContext, tokenKey: string): TokenOrigin {
  const sourceId = context.tokenSourceIds?.get(tokenKey) ?? context.sourceId;
  return sourceId === undefined ? { kind: "graph" } : { kind: "source", id: sourceId };
}

function fragmentOrigin(fragmentId: string, context: ParseContext): TokenOrigin {
  const sourceId = context.fragmentSourceIds?.get(fragmentId);
  if (sourceId !== undefined) {
    return { kind: "source", id: sourceId };
  }
  if (context.sourceId !== undefined && !context.callerFragmentIds?.has(fragmentId)) {
    return { kind: "source", id: context.sourceId };
  }
  return { kind: "fragment", id: fragmentId };
}

function cloneExpression(expression: ColorExpression): ColorExpression {
  return isReferenceExpression(expression) ? { ref: expression.ref } : cloneColor(expression);
}

function toPublicToken(token: ParsedToken): TokenGraphToken {
  return {
    visibility: token.visibility,
    valueByMode: token.valueByMode,
    origin: token.origin,
    ...(token.description === undefined ? {} : { description: token.description }),
    ...(token.deprecated === undefined ? {} : { deprecated: token.deprecated }),
    ...(token.extensions === undefined ? {} : { extensions: token.extensions }),
  };
}

function isReferenceExpression(expression: ColorExpression): expression is ReferenceInput {
  return "ref" in expression;
}

function escapeTokenPath(key: string): string {
  return key.replaceAll("~", "~0").replaceAll("/", "~1");
}
