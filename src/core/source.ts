import type { CompileTokenGraphIssue, CompiledTokenSet, TokenSelection } from "./compiled-types";
import { compileParsedTokenGraph, parseCompileSelection } from "./compile-token-graph";
import type {
  TokenFragmentInput,
  TokenGraph,
  TokenGraphInput,
  TokenGraphIssue,
  TokenVisibility,
} from "./graph";
import { isSingleSegmentIdentifier } from "./identifiers";
import { defineRecordValue, escapePointerSegment, isJsonSafeIssue, readPlainRecord } from "./json";
import { parseTokenGraphInternal } from "./parse-token-graph";
import type { Issue, Result } from "./result";

export interface TokenSource<I extends Issue = Issue> {
  readonly id: string;
  build(): Result<TokenGraphInput, I>;
}

type NonEmptyReadonlyArray<Value> = readonly [Value, ...Value[]];

export interface BuildTokenSetOptions<I extends Issue = Issue> {
  readonly sources: NonEmptyReadonlyArray<TokenSource<I>>;
  readonly fragments?: readonly TokenFragmentInput[];
  readonly selection?: TokenSelection;
}

export interface BuildTokenSetValue {
  readonly graph: TokenGraph;
  readonly compiled: CompiledTokenSet;
}

export type BuildTokenSetIssue =
  | TokenGraphIssue
  | CompileTokenGraphIssue
  | (Issue<
      | "invalid-build-options"
      | "invalid-source-id"
      | "duplicate-source-id"
      | "source-build-failed"
      | "invalid-source-result"
      | "invalid-source-issue"
    > & {
      readonly sourceId?: string;
      readonly sourceIndex?: number;
      readonly firstPath?: string;
    });

export function buildTokenSet<I extends Issue>(
  options: BuildTokenSetOptions<I>,
): Result<BuildTokenSetValue, I | BuildTokenSetIssue> {
  const parsedOptions = parseBuildOptions(options);
  if (!parsedOptions.ok) {
    return parsedOptions as Result<never, I | BuildTokenSetIssue>;
  }

  const sourceResults: BuiltSourceGraph[] = [];
  for (const [sourceIndex, source] of parsedOptions.value.sources.entries()) {
    const sourceResult = callSource(source, sourceIndex);
    if (!sourceResult.ok) {
      return sourceResult as Result<never, I | BuildTokenSetIssue>;
    }
    sourceResults.push({ source, graph: sourceResult.value, sourceIndex });
  }

  const composed = composeSourceGraphs(
    sourceResults as unknown as NonEmptyReadonlyArray<BuiltSourceGraph>,
    parsedOptions.value.fragments,
  );
  if (!composed.ok) {
    return composed as Result<never, I | BuildTokenSetIssue>;
  }
  const callerFragmentIds = collectCallerFragmentIds(parsedOptions.value.fragments);
  return buildFromComposedGraph(
    composed.value.graph,
    composed.value.tokenSourceIds,
    composed.value.fragmentSourceIds,
    callerFragmentIds,
    parsedOptions.value.selection,
  ) as Result<BuildTokenSetValue, I | BuildTokenSetIssue>;
}

function buildFromComposedGraph(
  graphInput: unknown,
  tokenSourceIds: ReadonlyMap<string, string>,
  fragmentSourceIds: ReadonlyMap<string, string>,
  callerFragmentIds: ReadonlySet<string>,
  selection: TokenSelection | undefined,
): Result<BuildTokenSetValue, BuildTokenSetIssue> {
  const parsedGraph = parseTokenGraphInternal(graphInput, {
    callerFragmentIds,
    tokenSourceIds,
    fragmentSourceIds,
  });
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
      compiled: compiled.value,
    },
  };
}

interface ParsedBuildOptions<I extends Issue> {
  readonly sources: NonEmptyReadonlyArray<TokenSource<I>>;
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
    if (entry.key !== "sources" && entry.key !== "fragments" && entry.key !== "selection") {
      return {
        ok: false,
        issues: [{ code: "invalid-build-options", message: `Unknown build option: ${entry.key}.` }],
      };
    }
  }

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const sources = parseSources<I>(record.get("sources"));
  if (!sources.ok) {
    return sources;
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
      sources: sources.value,
      ...(fragments === undefined ? {} : { fragments: fragments as readonly TokenFragmentInput[] }),
      ...(record.has("selection") ? { selection: record.get("selection") as TokenSelection } : {}),
    },
  };
}

function parseSources<I extends Issue>(
  input: unknown,
): Result<NonEmptyReadonlyArray<TokenSource<I>>, BuildTokenSetIssue> {
  if (!Array.isArray(input)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "sources must be a non-empty array.",
          path: "/sources",
        },
      ],
    };
  }
  if (input.length === 0) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "sources must contain at least one source.",
          path: "/sources",
        },
      ],
    };
  }

  const sources: TokenSource<I>[] = [];
  const sourceIdPaths = new Map<string, string>();
  for (const [sourceIndex, value] of input.entries()) {
    const source = parseSource<I>(value, sourceIndex);
    if (!source.ok) {
      return source;
    }
    const idPath = `/sources/${sourceIndex}/id`;
    const firstPath = sourceIdPaths.get(source.value.id);
    if (firstPath !== undefined) {
      return {
        ok: false,
        issues: [
          {
            code: "duplicate-source-id",
            message: `Duplicate source id: ${source.value.id}.`,
            path: idPath,
            sourceId: source.value.id,
            sourceIndex,
            firstPath,
          },
        ],
      };
    }
    sourceIdPaths.set(source.value.id, idPath);
    sources.push(source.value);
  }

  return { ok: true, value: [sources[0] as TokenSource<I>, ...sources.slice(1)] };
}

function parseSource<I extends Issue>(
  input: unknown,
  sourceIndex: number,
): Result<TokenSource<I>, BuildTokenSetIssue> {
  const path = `/sources/${sourceIndex}`;
  const entries = readPlainRecord(input, {
    code: "invalid-build-options",
    message: "source must be a plain object with id and build.",
    path,
  });
  if (!entries.ok) {
    return entries as Result<never, BuildTokenSetIssue>;
  }
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  if (!record.has("id") || !record.has("build")) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "source must contain id and build.",
          path,
          sourceIndex,
        },
      ],
    };
  }
  const id = record.get("id");
  if (typeof id !== "string" || !isSingleSegmentIdentifier(id)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-source-id",
          message: "source.id must be a lower-kebab single segment.",
          path: `${path}/id`,
          sourceIndex,
        },
      ],
    };
  }
  const build = record.get("build");
  if (typeof build !== "function") {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "source.build must be a function.",
          path: `${path}/build`,
          sourceId: id,
          sourceIndex,
        },
      ],
    };
  }
  return { ok: true, value: input as TokenSource<I> };
}

function callSource<I extends Issue>(
  source: TokenSource<I>,
  sourceIndex: number,
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
          path: `/sources/${sourceIndex}`,
          sourceId: source.id,
          sourceIndex,
        },
      ],
    };
  }

  const checked = validateSourceResult<I>(result, source.id, sourceIndex);
  return checked;
}

function validateSourceResult<I extends Issue>(
  input: unknown,
  sourceId: string,
  sourceIndex: number,
): Result<TokenGraphInput, I | BuildTokenSetIssue> {
  const entries = readPlainRecord(input, {
    code: "invalid-source-result",
    message: "Source build result must be a plain Result object.",
    path: `/sources/${sourceIndex}`,
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
            path: `/sources/${sourceIndex}`,
            sourceId,
            sourceIndex,
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
          path: `/sources/${sourceIndex}`,
          sourceId,
          sourceIndex,
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
          path: `/sources/${sourceIndex}/issues`,
          sourceId,
          sourceIndex,
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
            path: `/sources/${sourceIndex}/issues`,
            sourceId,
            sourceIndex,
          },
        ],
      };
    }
  }
  return { ok: false, issues: issues as unknown as readonly [I, ...I[]] };
}

interface BuiltSourceGraph<I extends Issue = Issue> {
  readonly source: TokenSource<I>;
  readonly graph: TokenGraphInput;
  readonly sourceIndex: number;
}

interface ComposedSourceGraphs {
  readonly graph: unknown;
  readonly tokenSourceIds: ReadonlyMap<string, string>;
  readonly fragmentSourceIds: ReadonlyMap<string, string>;
}

function composeSourceGraphs(
  sources: NonEmptyReadonlyArray<BuiltSourceGraph>,
  fragments: readonly TokenFragmentInput[] | undefined,
): Result<ComposedSourceGraphs, BuildTokenSetIssue> {
  const sourceGraphs: SourceGraphParts[] = [];
  for (const source of sources) {
    const sourceGraph = validateSourceGraph(source);
    if (!sourceGraph.ok) {
      return sourceGraph;
    }
    sourceGraphs.push(sourceGraph.value);
  }
  const first = sourceGraphs[0] as SourceGraphParts;

  const output: Record<string, unknown> = {};
  if (first.schema !== undefined) {
    defineRecordValue(output, "$schema", first.schema);
  }
  defineRecordValue(output, "formatVersion", first.formatVersion);
  defineRecordValue(output, "modes", first.modes);
  defineRecordValue(output, "defaultMode", first.defaultMode);
  defineRecordValue(output, "defaultVisibility", first.defaultVisibility);

  const tokens: Record<string, unknown> = {};
  const tokenSourceIds = new Map<string, string>();
  const fragmentSourceIds = new Map<string, string>();
  const firstTokenPaths = new Map<string, string>();
  const composedFragments: unknown[] = [];

  for (const sourceGraph of sourceGraphs) {
    const modeMatch = validateSourceModes(first, sourceGraph);
    if (!modeMatch.ok) {
      return modeMatch;
    }

    const addedTokens = appendSourceTokens(tokens, tokenSourceIds, firstTokenPaths, sourceGraph);
    if (!addedTokens.ok) {
      return addedTokens;
    }

    if (sourceGraph.fragments !== undefined) {
      for (const fragment of sourceGraph.fragments) {
        const fragmentId = readFragmentId(fragment);
        if (fragmentId !== undefined && !fragmentSourceIds.has(fragmentId)) {
          fragmentSourceIds.set(fragmentId, sourceGraph.sourceId);
        }
        composedFragments.push(fragment);
      }
    }
  }

  defineRecordValue(output, "tokens", tokens);
  if (fragments !== undefined) {
    composedFragments.push(...fragments);
  }
  if (composedFragments.length > 0) {
    defineRecordValue(output, "fragments", composedFragments);
  }

  return {
    ok: true,
    value: {
      graph: output,
      tokenSourceIds,
      fragmentSourceIds,
    },
  };
}

interface RawSourceGraphParts {
  readonly sourceId: string;
  readonly sourceIndex: number;
  readonly schema?: unknown;
  readonly defaultVisibility: unknown;
  readonly tokens: unknown;
  readonly fragments?: readonly unknown[];
}

interface SourceGraphParts extends RawSourceGraphParts {
  readonly formatVersion: 1;
  readonly modes: readonly [string, ...string[]];
  readonly defaultMode: string;
  readonly defaultVisibility: TokenVisibility;
}

function validateSourceGraph(
  source: BuiltSourceGraph,
): Result<SourceGraphParts, BuildTokenSetIssue> {
  const parsed = parseTokenGraphInternal(source.graph, { skipReferenceValidation: true });
  if (!parsed.ok) {
    return {
      ok: false,
      issues: prefixSourceGraphIssues(parsed.issues, source),
    };
  }

  const parts = readSourceGraph(source);
  if (!parts.ok) {
    return parts;
  }

  return {
    ok: true,
    value: {
      ...parts.value,
      formatVersion: 1,
      modes: parsed.value.modes,
      defaultMode: parsed.value.defaultMode,
      defaultVisibility: parts.value.defaultVisibility as TokenVisibility,
    },
  };
}

function readSourceGraph(
  source: BuiltSourceGraph,
): Result<RawSourceGraphParts, BuildTokenSetIssue> {
  const sourcePath = `/sources/${source.sourceIndex}`;
  const entries = readPlainRecord(source.graph, {
    code: "invalid-source-result",
    message: "Source graph must be a plain object.",
    path: sourcePath,
  });
  if (!entries.ok) {
    return entries as Result<never, BuildTokenSetIssue>;
  }
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const fragments = record.get("fragments");
  if (fragments !== undefined && !Array.isArray(fragments)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-source-result",
          message: "Source graph fragments must be an array.",
          path: `${sourcePath}/fragments`,
          sourceId: source.source.id,
          sourceIndex: source.sourceIndex,
        },
      ],
    };
  }

  return {
    ok: true,
    value: {
      sourceId: source.source.id,
      sourceIndex: source.sourceIndex,
      ...(record.has("$schema") ? { schema: record.get("$schema") } : {}),
      defaultVisibility: record.get("defaultVisibility"),
      tokens: record.get("tokens"),
      ...(fragments === undefined ? {} : { fragments }),
    },
  };
}

function prefixSourceGraphIssues(
  issues: readonly [TokenGraphIssue, ...TokenGraphIssue[]],
  source: BuiltSourceGraph,
): readonly [BuildTokenSetIssue, ...BuildTokenSetIssue[]] {
  const [first, ...rest] = issues;
  return [
    prefixSourceGraphIssue(first, source),
    ...rest.map((issue) => prefixSourceGraphIssue(issue, source)),
  ];
}

function prefixSourceGraphIssue(
  issue: TokenGraphIssue,
  source: BuiltSourceGraph,
): BuildTokenSetIssue {
  const path = issue.path ?? "";
  return {
    ...issue,
    path: path === "" ? `/sources/${source.sourceIndex}` : `/sources/${source.sourceIndex}${path}`,
  };
}

function validateSourceModes(
  first: SourceGraphParts,
  current: SourceGraphParts,
): Result<void, BuildTokenSetIssue> {
  if (current.sourceIndex === first.sourceIndex) {
    return { ok: true, value: undefined };
  }
  if (!sameModes(first.modes, current.modes)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-source-result",
          message: "Source graph modes must match the first source graph.",
          path: `/sources/${current.sourceIndex}/modes`,
          sourceId: current.sourceId,
          sourceIndex: current.sourceIndex,
        },
      ],
    };
  }
  if (first.defaultMode !== current.defaultMode) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-source-result",
          message: "Source graph defaultMode must match the first source graph.",
          path: `/sources/${current.sourceIndex}/defaultMode`,
          sourceId: current.sourceId,
          sourceIndex: current.sourceIndex,
        },
      ],
    };
  }
  return { ok: true, value: undefined };
}

function sameModes(left: unknown, right: unknown): boolean {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return false;
  }
  if (left.length !== right.length) {
    return false;
  }
  const rightModes = new Set(right);
  return left.every((mode) => rightModes.has(mode));
}

function appendSourceTokens(
  output: Record<string, unknown>,
  tokenSourceIds: Map<string, string>,
  firstTokenPaths: Map<string, string>,
  sourceGraph: SourceGraphParts,
): Result<void, BuildTokenSetIssue> {
  const entries = readPlainRecord(sourceGraph.tokens, {
    code: "invalid-source-result",
    message: "Source graph tokens must be a plain object record.",
    path: `/sources/${sourceGraph.sourceIndex}/tokens`,
  });
  if (!entries.ok) {
    return entries as Result<never, BuildTokenSetIssue>;
  }

  for (const entry of entries.value) {
    const tokenPath = `/sources/${sourceGraph.sourceIndex}/tokens/${escapePointerSegment(entry.key)}`;
    const firstPath = firstTokenPaths.get(entry.key);
    if (firstPath !== undefined) {
      return {
        ok: false,
        issues: [
          {
            code: "duplicate-token-key",
            message: `Duplicate token key: ${entry.key}.`,
            path: tokenPath,
            key: entry.key,
            firstPath,
          },
        ],
      };
    }
    firstTokenPaths.set(entry.key, tokenPath);
    tokenSourceIds.set(entry.key, sourceGraph.sourceId);
    defineRecordValue(
      output,
      entry.key,
      withDefaultVisibility(entry.value, sourceGraph.defaultVisibility),
    );
  }

  return { ok: true, value: undefined };
}

function withDefaultVisibility(token: unknown, defaultVisibility: unknown): unknown {
  if (defaultVisibility !== "public" && defaultVisibility !== "internal") {
    return token;
  }
  const entries = readPlainRecord(token, {
    code: "invalid-token-definition",
    message: "Token definition must be a plain object.",
  });
  if (!entries.ok || entries.value.some((entry) => entry.key === "visibility")) {
    return token;
  }
  const output: Record<string, unknown> = {};
  for (const entry of entries.value) {
    defineRecordValue(output, entry.key, entry.value);
  }
  defineRecordValue(output, "visibility", defaultVisibility);
  return output;
}

function readFragmentId(fragment: unknown): string | undefined {
  const entries = readPlainRecord(fragment, {
    code: "invalid-build-options",
    message: "Fragment must be a plain object.",
  });
  if (!entries.ok) {
    return undefined;
  }
  const id = entries.value.find((entry) => entry.key === "id")?.value;
  return typeof id === "string" ? id : undefined;
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
