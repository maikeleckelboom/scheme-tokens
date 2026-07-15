import type {
  CompileTokenGraphIssue,
  CompileTokenGraphOptions,
  CompiledScheme,
  CompiledToken,
  CompiledTokenMetadata,
  TokenSelection,
} from "./compiled-types";
import type { ModeOf, TokenGraph, TokenKeyOf } from "./graph";
import { compiledSchemeKind } from "./graph";
import { isTokenKey } from "./identifiers";
import {
  compareCodeUnits,
  defineRecordValue,
  pointer,
  readArray,
  readPlainRecord,
  sortedRecord,
} from "./json";
import {
  parseTokenGraphInternal,
  type ParsedTokenExpression,
  type ParsedTokenGraph,
  type ParsedTokenGraphToken,
} from "./parse-token-graph";
import { IssueCollector, type Result } from "./result";

export type {
  CompileTokenGraphIssue,
  CompileTokenGraphOptions,
  CompiledScheme,
  CompiledToken,
  CompiledTokenMetadata,
  TokenSelection,
} from "./compiled-types";

interface ResolvedNode {
  readonly value: string;
}

type SelectedKey<Input, Options> = Options extends {
  readonly selection: { readonly keys: readonly (infer Key)[] };
}
  ? Extract<Key, string>
  : TokenKeyOf<Input>;

type HasFiniteKeys<Key extends string> = string extends Key ? false : true;

type CompleteSelection<Input, Options> = Options extends {
  readonly selection: "all";
}
  ? HasFiniteKeys<TokenKeyOf<Input>>
  : Options extends {
        readonly selection: { readonly keys: infer Keys extends readonly string[] };
      }
    ? number extends Keys["length"]
      ? false
      : true
    : false;

type CompiledGraphResult<Input, Options> = Result<
  CompiledScheme<SelectedKey<Input, Options>, ModeOf<Input>, CompleteSelection<Input, Options>>,
  CompileTokenGraphIssue
>;

/**
 * Compile a token graph into deterministic token mode maps and metadata.
 */
export function compileTokenGraph<const Input extends TokenGraph>(
  input: Input,
): CompiledGraphResult<Input, undefined>;
export function compileTokenGraph<
  const Input extends TokenGraph,
  const Options extends CompileTokenGraphOptions<TokenKeyOf<Input>>,
>(input: Input, options: Options): CompiledGraphResult<Input, Options>;
export function compileTokenGraph(
  input: TokenGraph,
  options?: CompileTokenGraphOptions,
): Result<CompiledScheme<string, string, boolean>, CompileTokenGraphIssue> {
  const parsed = parseTokenGraphInternal(input);
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
): Result<CompiledScheme<Key, Mode, boolean>, CompileTokenGraphIssue> {
  const selectedKeys = selectTokenKeys(graph, selection);
  if (!selectedKeys.ok) {
    return selectedKeys;
  }

  const memo = new Map<string, ResolvedNode>();
  const tokens: Record<string, CompiledToken<Mode>> = {};
  const metadataByToken: Record<string, CompiledTokenMetadata<Mode>> = {};

  for (const key of selectedKeys.value) {
    const source = graph.tokens[key] as ParsedTokenGraphToken<Mode, Key>;
    const modeValues: Record<string, string> = {};
    const dependenciesByMode: Record<string, readonly string[]> = {};

    for (const mode of graph.modes) {
      const node = resolveNode(graph, key, mode, memo);
      defineRecordValue(modeValues, mode, node.value);
      defineRecordValue(dependenciesByMode, mode, directDependencies(source, mode));
    }

    defineRecordValue(
      tokens,
      key,
      sortedRecord(Object.entries(modeValues)) as Readonly<Record<Mode, string>>,
    );
    defineRecordValue(metadataByToken, key, {
      visibility: source.visibility,
      origin: cloneOrigin(source.origin),
      dependenciesByMode: sortedRecord(Object.entries(dependenciesByMode)) as Readonly<
        Record<Mode, readonly string[]>
      >,
      ...(source.description === undefined ? {} : { description: source.description }),
      ...(source.deprecated === undefined ? {} : { deprecated: source.deprecated }),
      ...(source.extensions === undefined ? {} : { extensions: source.extensions }),
    });
  }

  return {
    ok: true,
    value: {
      kind: compiledSchemeKind,
      formatVersion: 1,
      modes: [...graph.modes] as readonly [Mode, ...Mode[]],
      defaultMode: graph.defaultMode,
      tokens: sortedRecord(Object.entries(tokens)) as Readonly<Record<Key, CompiledToken<Mode>>>,
      metadataByToken: sortedRecord(Object.entries(metadataByToken)) as Readonly<
        Record<Key, CompiledTokenMetadata<Mode>>
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
            path: pointer(entry.key),
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
    path: pointer("selection"),
  });
  if (!selectionEntries.ok) {
    return selectionEntries as Result<never, CompileTokenGraphIssue>;
  }
  if (selectionEntries.value.length !== 1 || selectionEntries.value[0]?.key !== "keys") {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-selection",
          message: "Exact selection must contain only keys.",
          path: pointer("selection"),
        },
      ],
    };
  }

  const keys = selectionEntries.value[0].value;
  const keyEntries = readArray(keys, {
    code: "invalid-selection",
    message: "selection.keys must be a dense array.",
    path: pointer("selection", "keys"),
  });
  if (!keyEntries.ok) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-selection",
          message: "selection.keys must be an array.",
          path: pointer("selection", "keys"),
        },
      ],
    };
  }
  if (keyEntries.value.length === 0) {
    return {
      ok: false,
      issues: [
        {
          code: "empty-selection",
          message: "Exact selection must not be empty.",
          path: pointer("selection", "keys"),
        },
      ],
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
        path: pointer("selection", "keys", entry.index),
        ...(typeof key === "string" ? { key } : {}),
      });
      continue;
    }
    if (seen.has(key)) {
      collector.add({
        code: "duplicate-selection-key",
        message: `Duplicate selection key: ${key}.`,
        path: pointer("selection", "keys", entry.index),
        key,
      });
      continue;
    }
    seen.add(key);
    if (graph.tokens[key as Key] === undefined) {
      collector.add({
        code: "unknown-selection-key",
        message: `Selection key does not exist: ${key}.`,
        path: pointer("selection", "keys", entry.index),
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
      .expressionByMode[mode] as ParsedTokenExpression<Key>;
    if (!isReferenceExpression(expression)) {
      const resolved = { value: expression };
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
    current = { value: current.value };
    memo.set(nodeId(key, mode), current);
  }
  return current;
}

function nodeId(key: string, mode: string): string {
  return `${key}\0${mode}`;
}

function isReferenceExpression<Key extends string>(
  expression: ParsedTokenExpression<Key>,
): expression is { readonly ref: Key } {
  return typeof expression === "object" && expression !== null && "ref" in expression;
}

function cloneOrigin(origin: ParsedTokenGraphToken["origin"]): ParsedTokenGraphToken["origin"] {
  if (origin.kind === "graph") {
    return { kind: "graph" };
  }
  return { kind: "layer", id: origin.id };
}

function directDependencies<Mode extends string, Key extends string>(
  token: ParsedTokenGraphToken<Mode, Key>,
  mode: Mode,
): readonly string[] {
  const expression = token.expressionByMode[mode] as ParsedTokenExpression<Key> | undefined;
  return expression !== undefined && isReferenceExpression(expression) ? [expression.ref] : [];
}
