import { cloneColor, type ColorValue } from "./color";
import type {
  CompileTokenGraphIssue,
  CompileTokenGraphOptions,
  CompiledColorScheme,
  CompiledColorToken,
  TokenSelection,
} from "./compiled-types";
import type { ColorTokenGraphInput, ColorTokenGraphIssue, ModeOf, TokenKeyOf } from "./graph";
import { compiledColorSchemeKind } from "./graph";
import { isTokenKey } from "./identifiers";
import {
  compareCodeUnits,
  defineRecordValue,
  readArray,
  readPlainRecord,
  sortedRecord,
} from "./json";
import {
  parseTokenGraphInternal,
  type ParsedColorExpression,
  type ParsedTokenGraph,
  type ParsedTokenGraphToken,
} from "./parse-token-graph";
import { IssueCollector, type Result } from "./result";

export type {
  CompileTokenGraphIssue,
  CompileTokenGraphOptions,
  CompiledColorScheme,
  CompiledColorToken,
  TokenSelection,
} from "./compiled-types";

interface ResolvedNode {
  readonly value: ColorValue;
}

export function compileTokenGraph<const Input extends ColorTokenGraphInput>(
  input: Input,
  options?: CompileTokenGraphOptions<TokenKeyOf<Input>>,
): Result<
  CompiledColorScheme<TokenKeyOf<Input>, ModeOf<Input>>,
  ColorTokenGraphIssue | CompileTokenGraphIssue
>;
export function compileTokenGraph(
  input: unknown,
  options?: CompileTokenGraphOptions,
): Result<CompiledColorScheme, ColorTokenGraphIssue | CompileTokenGraphIssue>;
export function compileTokenGraph(
  input: unknown,
  options?: CompileTokenGraphOptions,
): Result<CompiledColorScheme, ColorTokenGraphIssue | CompileTokenGraphIssue> {
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

export function compileParsedTokenGraph<
  const Mode extends string = string,
  const Key extends string = string,
>(
  graph: ParsedTokenGraph<Mode, Key>,
  selection: TokenSelection<Key> = "public",
): Result<CompiledColorScheme<Key, Mode>, CompileTokenGraphIssue> {
  const selectedKeys = selectTokenKeys(graph, selection);
  if (!selectedKeys.ok) {
    return selectedKeys;
  }

  const memo = new Map<string, ResolvedNode>();
  const tokens: Record<string, CompiledColorToken<Mode>> = {};

  for (const key of selectedKeys.value) {
    const source = graph.tokens[key] as ParsedTokenGraphToken<Mode, Key>;
    const valueByMode: Record<string, ColorValue> = {};
    const dependenciesByMode: Record<string, readonly string[]> = {};

    for (const mode of graph.modes) {
      const node = resolveNode(graph, key, mode, memo);
      defineRecordValue(valueByMode, mode, cloneColor(node.value));
      defineRecordValue(dependenciesByMode, mode, directDependencies(source, mode));
    }

    const compiled: CompiledColorToken<Mode> = {
      visibility: source.visibility,
      valueByMode: sortedRecord(Object.entries(valueByMode)) as Readonly<Record<Mode, ColorValue>>,
      origin: cloneOrigin(source.origin),
      dependenciesByMode: sortedRecord(Object.entries(dependenciesByMode)) as Readonly<
        Record<Mode, readonly string[]>
      >,
      ...(source.description === undefined ? {} : { description: source.description }),
      ...(source.deprecated === undefined ? {} : { deprecated: source.deprecated }),
      ...(source.extensions === undefined ? {} : { extensions: source.extensions }),
    };
    defineRecordValue(tokens, key, compiled);
  }

  return {
    ok: true,
    value: {
      kind: compiledColorSchemeKind,
      formatVersion: 1,
      modes: [...graph.modes] as readonly [Mode, ...Mode[]],
      defaultMode: graph.defaultMode,
      tokens: sortedRecord(Object.entries(tokens)) as Readonly<
        Record<Key, CompiledColorToken<Mode>>
      >,
    },
  };
}

export function parseCompileSelection<Key extends string = string>(
  graph: ParsedTokenGraph<string, Key>,
  options: CompileTokenGraphOptions<Key> | undefined,
): Result<TokenSelection<Key>, CompileTokenGraphIssue> {
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
  const keyEntries = readArray(keys, {
    code: "invalid-selection",
    message: "selection.keys must be a dense array.",
  });
  if (!keyEntries.ok) {
    return {
      ok: false,
      issues: [{ code: "invalid-selection", message: "selection.keys must be an array." }],
    };
  }
  if (keyEntries.value.length === 0) {
    return {
      ok: false,
      issues: [{ code: "empty-selection", message: "Exact selection must not be empty." }],
    };
  }

  const collector = new IssueCollector<CompileTokenGraphIssue>();
  const seen = new Set<string>();
  const output: Key[] = [];
  for (const entry of keyEntries.value) {
    const key = entry.value;
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
    if (graph.tokens[key as Key] === undefined) {
      collector.add({
        code: "unknown-selection-key",
        message: `Selection key does not exist: ${key}.`,
        key,
      });
      continue;
    }
    output.push(key as Key);
  }

  const issues = collector.issues();
  return issues === undefined ? { ok: true, value: { keys: output } } : { ok: false, issues };
}

function selectTokenKeys<Key extends string>(
  graph: ParsedTokenGraph<string, Key>,
  selection: TokenSelection<Key>,
): Result<readonly Key[], CompileTokenGraphIssue> {
  const keys = Object.keys(graph.tokens) as Key[];
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

function resolveNode<Mode extends string, Key extends string>(
  graph: ParsedTokenGraph<Mode, Key>,
  startKey: Key,
  mode: Mode,
  memo: Map<string, ResolvedNode>,
): ResolvedNode {
  const startId = nodeId(startKey, mode);
  const existing = memo.get(startId);
  if (existing !== undefined) {
    return existing;
  }

  const stack: string[] = [];
  let currentKey: string = startKey;

  while (true) {
    const currentId = nodeId(currentKey, mode);
    const currentExisting = memo.get(currentId);
    if (currentExisting !== undefined) {
      return unwind(stack, mode, currentExisting, currentKey, memo);
    }

    const expression = (graph.tokens[currentKey as Key] as ParsedTokenGraphToken<Mode, Key>)
      .valueByMode[mode] as ParsedColorExpression<Key>;
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
  _leafKey: string,
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

function isReferenceExpression<Key extends string>(
  expression: ParsedColorExpression<Key>,
): expression is { readonly ref: Key } {
  return "ref" in expression;
}

function cloneOrigin(origin: ParsedTokenGraphToken["origin"]): ParsedTokenGraphToken["origin"] {
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

function directDependencies<Mode extends string, Key extends string>(
  token: ParsedTokenGraphToken<Mode, Key>,
  mode: Mode,
): readonly string[] {
  const expression = token.valueByMode[mode] as ParsedColorExpression<Key> | undefined;
  return expression !== undefined && isReferenceExpression(expression) ? [expression.ref] : [];
}
