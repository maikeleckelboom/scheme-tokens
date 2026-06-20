import { cloneColor, type ColorValue } from "./color";
import type { ColorExpression, TokenGraph, TokenGraphIssue, TokenGraphToken } from "./graph";
import type {
  CompileTokenGraphIssue,
  CompiledToken,
  CompiledScheme,
  TokenSelection,
} from "./compiled-types";
import { isTokenKey } from "./identifiers";
import { compareCodeUnits, defineRecordValue, readPlainRecord, sortedRecord } from "./json";
import { parseTokenGraphInternal } from "./parse-token-graph";
import { IssueCollector, type Result } from "./result";

export type {
  CompileTokenGraphIssue,
  CompileTokenGraphOptions,
  CompiledToken,
  CompiledScheme,
  TokenSelection,
} from "./compiled-types";

interface ResolvedNode {
  readonly value: ColorValue;
}

export function compileTokenGraph(
  input: unknown,
  options?: import("./compiled-types").CompileTokenGraphOptions,
): Result<CompiledScheme, TokenGraphIssue | CompileTokenGraphIssue> {
  const parsed = parseTokenGraphInternal(input, {});
  if (!parsed.ok) {
    return parsed;
  }

  const selection = parseCompileSelection(parsed.value, options);
  if (!selection.ok) {
    return selection;
  }

  return compileParsedTokenGraph(parsed.value, selection.value);
}

export function compileParsedTokenGraph(
  graph: TokenGraph,
  selection: TokenSelection = "public",
): Result<CompiledScheme, CompileTokenGraphIssue> {
  const selectedKeys = selectTokenKeys(graph, selection);
  if (!selectedKeys.ok) {
    return selectedKeys;
  }

  const memo = new Map<string, ResolvedNode>();
  const tokens: Record<string, CompiledToken> = {};

  for (const key of selectedKeys.value) {
    const source = graph.tokens[key] as TokenGraphToken;
    const valueByMode: Record<string, ColorValue> = {};
    const dependenciesByMode: Record<string, readonly string[]> = {};

    for (const mode of graph.modes) {
      const node = resolveNode(graph, key, mode, memo);
      defineRecordValue(valueByMode, mode, cloneColor(node.value));
      defineRecordValue(dependenciesByMode, mode, directDependencies(source, mode));
    }

    const compiled: CompiledToken = {
      visibility: source.visibility,
      valueByMode: sortedRecord(Object.entries(valueByMode)),
      origin: cloneOrigin(source.origin),
      dependenciesByMode: sortedRecord(Object.entries(dependenciesByMode)),
      ...(source.description === undefined ? {} : { description: source.description }),
      ...(source.deprecated === undefined ? {} : { deprecated: source.deprecated }),
      ...(source.extensions === undefined ? {} : { extensions: source.extensions }),
    };
    defineRecordValue(tokens, key, compiled);
  }

  return {
    ok: true,
    value: {
      formatVersion: 1,
      modes: [...graph.modes] as unknown as readonly [string, ...string[]],
      defaultMode: graph.defaultMode,
      tokens: sortedRecord(Object.entries(tokens)),
    },
  };
}

export function parseCompileSelection(
  graph: TokenGraph,
  options: import("./compiled-types").CompileTokenGraphOptions | undefined,
): Result<TokenSelection, CompileTokenGraphIssue> {
  if (options === undefined) {
    return { ok: true, value: "public" };
  }

  const optionEntries = readPlainRecord(options, {
    code: "invalid-compile-options",
    message: "Compile options must be a plain object.",
  });
  if (!optionEntries.ok) {
    return optionEntries as Result<never, CompileTokenGraphIssue>;
  }

  for (const entry of optionEntries.value) {
    if (entry.key !== "selection") {
      return {
        ok: false,
        issues: [
          {
            code: "invalid-compile-options",
            message: `Unknown compile option: ${entry.key}.`,
          },
        ],
      };
    }
  }

  const selection = optionEntries.value.find((entry) => entry.key === "selection")?.value;
  if (selection === undefined) {
    return { ok: true, value: "public" };
  }
  if (selection === "public" || selection === "all") {
    return { ok: true, value: selection };
  }

  const selectionEntries = readPlainRecord(selection, {
    code: "invalid-selection",
    message: "selection must be public, all, or { keys }.",
  });
  if (!selectionEntries.ok) {
    return selectionEntries as Result<never, CompileTokenGraphIssue>;
  }
  if (selectionEntries.value.length !== 1 || selectionEntries.value[0]?.key !== "keys") {
    return {
      ok: false,
      issues: [{ code: "invalid-selection", message: "Exact selection must contain only keys." }],
    };
  }

  const keys = selectionEntries.value[0].value;
  if (!Array.isArray(keys)) {
    return {
      ok: false,
      issues: [{ code: "invalid-selection", message: "selection.keys must be an array." }],
    };
  }
  if (keys.length === 0) {
    return {
      ok: false,
      issues: [{ code: "empty-selection", message: "Exact selection must not be empty." }],
    };
  }

  const collector = new IssueCollector<CompileTokenGraphIssue>();
  const seen = new Set<string>();
  const output: string[] = [];
  for (const key of keys) {
    if (typeof key !== "string" || !isTokenKey(key)) {
      collector.add({
        code: "invalid-selection-key",
        message: "Selection keys must be valid token keys.",
        ...(typeof key === "string" ? { key } : {}),
      });
      continue;
    }
    if (seen.has(key)) {
      collector.add({
        code: "duplicate-selection-key",
        message: `Duplicate selection key: ${key}.`,
        key,
      });
      continue;
    }
    seen.add(key);
    if (graph.tokens[key] === undefined) {
      collector.add({
        code: "unknown-selection-key",
        message: `Selection key does not exist: ${key}.`,
        key,
      });
      continue;
    }
    output.push(key);
  }

  const issues = collector.issues();
  return issues === undefined ? { ok: true, value: { keys: output } } : { ok: false, issues };
}

function selectTokenKeys(
  graph: TokenGraph,
  selection: TokenSelection,
): Result<readonly string[], CompileTokenGraphIssue> {
  const keys = Object.keys(graph.tokens);
  const selected =
    selection === "all"
      ? keys
      : selection === "public"
        ? keys.filter((key) => graph.tokens[key]?.visibility === "public")
        : [...selection.keys];

  const canonical = [...selected].sort(compareCodeUnits);
  if (canonical.length === 0) {
    return {
      ok: false,
      issues: [{ code: "no-selected-tokens", message: "Selection did not match any tokens." }],
    };
  }
  return { ok: true, value: canonical };
}

function resolveNode(
  graph: TokenGraph,
  startKey: string,
  mode: string,
  memo: Map<string, ResolvedNode>,
): ResolvedNode {
  const startId = nodeId(startKey, mode);
  const existing = memo.get(startId);
  if (existing !== undefined) {
    return existing;
  }

  const stack: string[] = [];
  let currentKey = startKey;

  while (true) {
    const currentId = nodeId(currentKey, mode);
    const currentExisting = memo.get(currentId);
    if (currentExisting !== undefined) {
      return unwind(stack, mode, currentExisting, currentKey, memo);
    }

    const expression = (graph.tokens[currentKey] as TokenGraphToken).valueByMode[
      mode
    ] as ColorExpression;
    if (!isReferenceExpression(expression)) {
      const resolved = { value: cloneColor(expression) };
      memo.set(currentId, resolved);
      return unwind(stack, mode, resolved, currentKey, memo);
    }

    stack.push(currentKey);
    currentKey = expression.ref;
  }
}

function unwind(
  stack: readonly string[],
  mode: string,
  leaf: ResolvedNode,
  leafKey: string,
  memo: Map<string, ResolvedNode>,
): ResolvedNode {
  let current = leaf;
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const key = stack[index] as string;
    current = { value: cloneColor(current.value) };
    memo.set(nodeId(key, mode), current);
  }
  return current;
}

function nodeId(key: string, mode: string): string {
  return `${key}\0${mode}`;
}

function isReferenceExpression(
  expression: ColorExpression,
): expression is { readonly ref: string } {
  return "ref" in expression;
}

function cloneOrigin(origin: TokenGraphToken["origin"]): TokenGraphToken["origin"] {
  if (origin.kind === "graph") {
    return { kind: "graph" };
  }
  if (origin.kind === "layer") {
    return { kind: "layer", id: origin.id };
  }
  return {
    kind: "source",
    id: origin.id,
    ...(origin.sourceToken === undefined ? {} : { sourceToken: origin.sourceToken }),
  };
}

function directDependencies(token: TokenGraphToken, mode: string): readonly string[] {
  const expression = token.valueByMode[mode] as ColorExpression | undefined;
  return expression !== undefined && isReferenceExpression(expression) ? [expression.ref] : [];
}
