import type {
  CompileTokenGraphIssue,
  CompileTokenGraphOptions,
  CompiledScheme,
  CompiledToken,
  CompiledTokenMetadata,
  TokenSelection,
} from "./compiled-types";
import type { IsFinite } from "./authoring-types";
import type { TokenGraph } from "./graph";
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
import { composeTokenGraph, type ComposedGraph } from "./compose-token-graph";
import { validateSourceGraph } from "./validate-source";
import { resolveTokenGraph } from "./resolve-token-graph";
import { IssueCollector, type Result } from "./result";
import type { CompiledExpression, CompiledConcatPart } from "./compiled-types";

export type {
  CompileTokenGraphIssue,
  CompileTokenGraphOptions,
  CompiledScheme,
  CompiledToken,
  CompiledTokenMetadata,
  TokenSelection,
} from "./compiled-types";

type GraphKey<Input> = Input extends TokenGraph<infer Key extends string> ? Key : string;
type GraphMode<Input> = Input extends TokenGraph<string, infer Mode extends string> ? Mode : string;
type GraphPublicKey<Input> =
  Input extends TokenGraph<string, string, infer PublicKey extends string> ? PublicKey : string;

// Branches name `CompiledScheme` directly so results print as the public interface.
type PublicCompiled<Input> =
  IsFinite<GraphPublicKey<Input>> extends true
    ? CompiledScheme<GraphPublicKey<Input>, GraphMode<Input>, true>
    : CompiledScheme<GraphKey<Input>, GraphMode<Input>, false>;

// Selection types that are not literal stay conservatively partial over every graph key.
type SelectedCompiled<Input, Options> = [Options] extends [{ readonly selection: "all" }]
  ? CompiledScheme<GraphKey<Input>, GraphMode<Input>, IsFinite<GraphKey<Input>>>
  : [Options] extends [{ readonly selection: infer Keys extends readonly string[] }]
    ? CompiledScheme<
        Keys[number],
        GraphMode<Input>,
        number extends Keys["length"] ? false : IsFinite<Keys[number]>
      >
    : [Options] extends [{ readonly selection?: "public" | undefined }]
      ? PublicCompiled<Input>
      : CompiledScheme<GraphKey<Input>, GraphMode<Input>, false>;

/**
 * Compile a token graph into deterministic token mode maps and metadata. A union of graphs
 * yields one scheme type per graph, so the keys of different graphs never merge.
 */
export function compileTokenGraph<const Input extends TokenGraph>(
  input: Input,
): Result<Input extends unknown ? PublicCompiled<Input> : never, CompileTokenGraphIssue>;
export function compileTokenGraph<
  const Input extends TokenGraph,
  const Options extends CompileTokenGraphOptions<GraphKey<Input>>,
>(
  input: Input,
  options: Options,
): Result<Input extends unknown ? SelectedCompiled<Input, Options> : never, CompileTokenGraphIssue>;
export function compileTokenGraph(
  input: TokenGraph,
  options?: CompileTokenGraphOptions,
): Result<CompiledScheme<string, string, boolean>, CompileTokenGraphIssue> {
  const parsed = validateSourceGraph(input);
  if (!parsed.ok) {
    return parsed;
  }

  const graph = composeTokenGraph(parsed.value);
  const selection = parseCompileSelection(graph, options);
  if (!selection.ok) {
    return selection;
  }

  return compileComposedGraph(graph, selection.value);
}

function compileComposedGraph(
  graph: ComposedGraph,
  selection: TokenSelection,
): Result<CompiledScheme<string, string, boolean>, CompileTokenGraphIssue> {
  const resolved = resolveTokenGraph(graph);
  if (!resolved.ok) {
    return resolved;
  }
  const selected = selectTokenKeys(graph, selection);
  if (!selected.ok) {
    return selected;
  }
  const tokens: Record<string, CompiledToken> = {};
  const metadataByToken: Record<string, CompiledTokenMetadata> = {};
  for (const key of selected.value) {
    const source = graph.tokens[key];
    const values = resolved.value[key];
    if (source === undefined || values === undefined) {
      throw new Error("Selected token must exist.");
    }
    const { expressions, ...metadata } = source;
    const expressionByMode: Record<string, CompiledExpression> = {};
    for (const mode of graph.modes) {
      const expression = expressions[mode]?.expression;
      if (typeof expression === "object") {
        if ("ref" in expression) {
          defineRecordValue(expressionByMode, mode, { ref: expression.ref });
        } else {
          const concat = expression.concat.map((part) => {
            if (typeof part === "string") {
              return part;
            }
            const value = resolved.value[part.ref]?.[mode];
            if (value === undefined) {
              throw new Error("Resolved reference must exist.");
            }
            return { ref: part.ref, value };
          }) as [CompiledConcatPart, ...CompiledConcatPart[]];
          defineRecordValue(expressionByMode, mode, { concat });
        }
      }
    }
    defineRecordValue(tokens, key, values);
    defineRecordValue(metadataByToken, key, {
      ...metadata,
      ...(Object.keys(expressionByMode).length === 0
        ? {}
        : { expressionByMode: sortedRecord(Object.entries(expressionByMode)) }),
    });
  }
  return {
    ok: true,
    value: {
      kind: compiledSchemeKind,
      formatVersion: 2,
      modes: [...graph.modes],
      defaultMode: graph.defaultMode,
      tokens,
      metadataByToken,
    },
  };
}

function parseCompileSelection<Key extends string = string>(
  graph: ComposedGraph<string, Key>,
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

  const keyEntries = readArray(selection, {
    code: "invalid-selection",
    message: "selection must be public, all, or a dense array of token keys.",
    path: pointer("selection"),
  });
  if (!keyEntries.ok) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-selection",
          message: "selection must be public, all, or an array of token keys.",
          path: pointer("selection"),
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
          path: pointer("selection"),
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
        path: pointer("selection", entry.index),
        ...(typeof key === "string" ? { key } : {}),
      });
      continue;
    }
    if (seen.has(key)) {
      collector.add({
        code: "duplicate-selection-key",
        message: `Duplicate selection key: ${key}.`,
        path: pointer("selection", entry.index),
        key,
      });
      continue;
    }
    seen.add(key);
    if (graph.tokens[key as Key] === undefined) {
      collector.add({
        code: "unknown-selection-key",
        message: `Selection key does not exist: ${key}.`,
        path: pointer("selection", entry.index),
        key,
      });
      continue;
    }
    output.push(key as Key);
  }

  const issues = collector.issues();
  return issues === undefined ? { ok: true, value: output } : { ok: false, issues };
}

function selectTokenKeys<Key extends string>(
  graph: ComposedGraph<string, Key>,
  selection: TokenSelection<Key>,
): Result<readonly Key[], CompileTokenGraphIssue> {
  const keys = Object.keys(graph.tokens) as Key[];
  const selected =
    selection === "all"
      ? keys
      : selection === "public"
        ? keys.filter((key) => graph.tokens[key]?.visibility === "public")
        : [...selection];

  const canonical = [...selected].sort(compareCodeUnits);
  if (canonical.length === 0) {
    return {
      ok: false,
      issues: [{ code: "no-selected-tokens", message: "Selection did not match any tokens." }],
    };
  }
  return { ok: true, value: canonical };
}
