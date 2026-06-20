import type { CompileTokenGraphIssue, CompiledTokenSet, TokenSelection } from "./compiled-types";
import { compileParsedTokenGraph, parseCompileSelection } from "./compile-token-graph";
import type { TokenFragmentInput, TokenGraph, TokenGraphInput, TokenGraphIssue } from "./graph";
import { isSingleSegmentIdentifier } from "./identifiers";
import { defineRecordValue, isJsonSafeIssue, readPlainRecord } from "./json";
import { parseTokenGraphInternal } from "./parse-token-graph";
import type { Issue, Result } from "./result";

export interface TokenSource<I extends Issue = Issue> {
  readonly id: string;
  build(): Result<TokenGraphInput, I>;
}

export interface BuildTokenSetOptions<I extends Issue = Issue> {
  readonly source: TokenSource<I>;
  readonly fragments?: readonly TokenFragmentInput[];
  readonly selection?: TokenSelection;
}

export interface BuildTokenSetValue {
  readonly graph: TokenGraph;
  readonly tokenSet: CompiledTokenSet;
}

export type BuildTokenSetIssue =
  | TokenGraphIssue
  | CompileTokenGraphIssue
  | (Issue<
      | "invalid-build-options"
      | "invalid-source-id"
      | "source-build-failed"
      | "invalid-source-result"
      | "invalid-source-issue"
    > & {
      readonly sourceId?: string;
    });

export function buildTokenSet<I extends Issue>(
  options: BuildTokenSetOptions<I>,
): Result<BuildTokenSetValue, I | BuildTokenSetIssue> {
  const parsedOptions = parseBuildOptions(options);
  if (!parsedOptions.ok) {
    return parsedOptions as Result<never, I | BuildTokenSetIssue>;
  }

  const sourceResult = callSource(parsedOptions.value.source);
  if (!sourceResult.ok) {
    return sourceResult as Result<never, I | BuildTokenSetIssue>;
  }

  const composedGraph = composeSourceGraph(sourceResult.value, parsedOptions.value.fragments);
  const callerFragmentIds = collectCallerFragmentIds(parsedOptions.value.fragments);
  return buildFromComposedGraph(
    composedGraph,
    parsedOptions.value.source.id,
    callerFragmentIds,
    parsedOptions.value.selection,
  ) as Result<BuildTokenSetValue, I | BuildTokenSetIssue>;
}

function buildFromComposedGraph(
  graphInput: unknown,
  sourceId: string,
  callerFragmentIds: ReadonlySet<string>,
  selection: TokenSelection | undefined,
): Result<BuildTokenSetValue, BuildTokenSetIssue> {
  const parsedGraph = parseTokenGraphInternal(graphInput, { sourceId, callerFragmentIds });
  if (!parsedGraph.ok) {
    return parsedGraph;
  }

  const parsedSelection = parseCompileSelection(
    parsedGraph.value,
    selection === undefined ? undefined : { selection },
  );
  if (!parsedSelection.ok) {
    return parsedSelection;
  }

  const compiled = compileParsedTokenGraph(parsedGraph.value, parsedSelection.value);
  if (!compiled.ok) {
    return compiled;
  }

  return {
    ok: true,
    value: {
      graph: parsedGraph.value,
      tokenSet: compiled.value,
    },
  };
}

interface ParsedBuildOptions<I extends Issue> {
  readonly source: TokenSource<I>;
  readonly fragments?: readonly TokenFragmentInput[];
  readonly selection?: TokenSelection;
}

function parseBuildOptions<I extends Issue>(
  input: BuildTokenSetOptions<I>,
): Result<ParsedBuildOptions<I>, BuildTokenSetIssue> {
  const entries = readPlainRecord(input, {
    code: "invalid-build-options",
    message: "buildTokenSet options must be a plain object.",
  });
  if (!entries.ok) {
    return entries as Result<never, BuildTokenSetIssue>;
  }

  for (const entry of entries.value) {
    if (entry.key !== "source" && entry.key !== "fragments" && entry.key !== "selection") {
      return {
        ok: false,
        issues: [{ code: "invalid-build-options", message: `Unknown build option: ${entry.key}.` }],
      };
    }
  }

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const source = parseSource<I>(record.get("source"));
  if (!source.ok) {
    return source;
  }
  const fragments = record.get("fragments");
  if (fragments !== undefined && !Array.isArray(fragments)) {
    return {
      ok: false,
      issues: [{ code: "invalid-build-options", message: "fragments must be an array." }],
    };
  }

  return {
    ok: true,
    value: {
      source: source.value,
      ...(fragments === undefined ? {} : { fragments: fragments as readonly TokenFragmentInput[] }),
      ...(record.has("selection") ? { selection: record.get("selection") as TokenSelection } : {}),
    },
  };
}

function parseSource<I extends Issue>(input: unknown): Result<TokenSource<I>, BuildTokenSetIssue> {
  const entries = readPlainRecord(input, {
    code: "invalid-build-options",
    message: "source must be a plain object with id and build.",
  });
  if (!entries.ok) {
    return entries as Result<never, BuildTokenSetIssue>;
  }
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  if (!record.has("id") || !record.has("build")) {
    return {
      ok: false,
      issues: [{ code: "invalid-build-options", message: "source must contain id and build." }],
    };
  }
  const id = record.get("id");
  if (typeof id !== "string" || !isSingleSegmentIdentifier(id)) {
    return {
      ok: false,
      issues: [
        { code: "invalid-source-id", message: "source.id must be a lower-kebab single segment." },
      ],
    };
  }
  const build = record.get("build");
  if (typeof build !== "function") {
    return {
      ok: false,
      issues: [{ code: "invalid-build-options", message: "source.build must be a function." }],
    };
  }
  return { ok: true, value: input as TokenSource<I> };
}

function callSource<I extends Issue>(
  source: TokenSource<I>,
): Result<TokenGraphInput, I | BuildTokenSetIssue> {
  let result: unknown;
  try {
    result = source.build();
  } catch {
    return {
      ok: false,
      issues: [
        {
          code: "source-build-failed",
          message: "Source build threw an exception.",
          sourceId: source.id,
        },
      ],
    };
  }

  const checked = validateSourceResult<I>(result, source.id);
  return checked;
}

function validateSourceResult<I extends Issue>(
  input: unknown,
  sourceId: string,
): Result<TokenGraphInput, I | BuildTokenSetIssue> {
  const entries = readPlainRecord(input, {
    code: "invalid-source-result",
    message: "Source build result must be a plain Result object.",
  });
  if (!entries.ok) {
    return entries as Result<never, I | BuildTokenSetIssue>;
  }
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const okValue = record.get("ok");
  if (okValue === true) {
    if (record.size !== 2 || !record.has("value")) {
      return {
        ok: false,
        issues: [
          {
            code: "invalid-source-result",
            message: "Successful source result must contain ok and value.",
            sourceId,
          },
        ],
      };
    }
    return { ok: true, value: record.get("value") as TokenGraphInput };
  }
  if (okValue !== false || record.size !== 2 || !record.has("issues")) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-source-result",
          message: "Source result must be ok true/value or ok false/issues.",
          sourceId,
        },
      ],
    };
  }
  const issues = record.get("issues");
  if (!Array.isArray(issues) || issues.length === 0) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-source-result",
          message: "Failed source result must contain non-empty issues.",
          sourceId,
        },
      ],
    };
  }
  for (const issue of issues) {
    if (!isJsonSafeIssue(issue)) {
      return {
        ok: false,
        issues: [
          {
            code: "invalid-source-issue",
            message: "Source issues must be JSON-safe Issue objects.",
            sourceId,
          },
        ],
      };
    }
  }
  return { ok: false, issues: issues as unknown as readonly [I, ...I[]] };
}

function composeSourceGraph(
  graph: TokenGraphInput,
  fragments: readonly TokenFragmentInput[] | undefined,
): unknown {
  if (fragments === undefined || fragments.length === 0) {
    return graph;
  }
  const entries = readPlainRecord(graph, {
    code: "invalid-source-result",
    message: "Source graph must be a plain object.",
  });
  if (!entries.ok) {
    return graph;
  }

  const output: Record<string, unknown> = {};
  for (const entry of entries.value) {
    defineRecordValue(output, entry.key, entry.value);
  }
  const existingFragments = output.fragments;
  if (existingFragments === undefined) {
    defineRecordValue(output, "fragments", [...fragments]);
  } else if (Array.isArray(existingFragments)) {
    defineRecordValue(output, "fragments", [...existingFragments, ...fragments]);
  }
  return output;
}

function collectCallerFragmentIds(
  fragments: readonly TokenFragmentInput[] | undefined,
): ReadonlySet<string> {
  const ids = new Set<string>();
  if (fragments === undefined) {
    return ids;
  }
  for (const fragment of fragments) {
    const entries = readPlainRecord(fragment, {
      code: "invalid-build-options",
      message: "Fragment must be a plain object.",
    });
    if (!entries.ok) {
      continue;
    }
    const id = entries.value.find((entry) => entry.key === "id")?.value;
    if (typeof id === "string") {
      ids.add(id);
    }
  }
  return ids;
}
