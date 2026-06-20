import type { CompileTokenGraphIssue, CompiledColorScheme, TokenSelection } from "./compiled-types";
import { compileParsedTokenGraph, parseCompileSelection } from "./compile-token-graph";
import type {
  ColorTokenGraphInput,
  ColorTokenGraphIssue,
  ColorTokenLayerInput,
  TokenVisibility,
} from "./graph";
import { colorTokenGraphKind } from "./graph";
import { isSingleSegmentIdentifier } from "./identifiers";
import { defineRecordValue, escapePointerSegment, isJsonSafeIssue, readPlainRecord } from "./json";
import { parseTokenGraphInternal } from "./parse-token-graph";
import type { Issue, Result } from "./result";

export interface ColorTokenSource<I extends Issue = Issue> {
  readonly id: string;
  build(): Result<ColorTokenGraphInput, I>;
}

export interface BuildSchemeOptions<I extends Issue = Issue> {
  readonly $schema?: never;
  readonly formatVersion?: never;
  readonly id?: never;
  readonly modes?: readonly [string, ...string[]];
  readonly defaultMode?: string;
  readonly defaultVisibility?: TokenVisibility;
  readonly tokens?: never;
  readonly base?: ColorTokenSource<I> | readonly ColorTokenSource<I>[];
  readonly layers?: readonly ColorTokenLayerInput[];
  readonly selection?: TokenSelection;
}

export type BuildSchemeSourceOptions<I extends Issue = Issue> = Omit<BuildSchemeOptions<I>, "base">;

export type SchemeBuilderConfig = BuildSchemeSourceOptions;

export interface SchemeBuilderBuildOptions<I extends Issue = Issue> {
  readonly base?: ColorTokenSource<I> | readonly ColorTokenSource<I>[];
}

export interface SchemeBuilder {
  build(): Result<CompiledColorScheme, BuildSchemeIssue>;
  build<I extends Issue>(
    source: ColorTokenSource<I>,
  ): Result<CompiledColorScheme, I | BuildSchemeIssue>;
  build<I extends Issue>(
    sources: readonly [ColorTokenSource<I>, ...ColorTokenSource<I>[]],
  ): Result<CompiledColorScheme, I | BuildSchemeIssue>;
  build<I extends Issue>(
    input: SchemeBuilderBuildOptions<I>,
  ): Result<CompiledColorScheme, I | BuildSchemeIssue>;
}

export type BuildSchemeIssue =
  | ColorTokenGraphIssue
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

export function buildScheme<I extends Issue>(
  options: BuildSchemeOptions<I>,
): Result<CompiledColorScheme, I | BuildSchemeIssue>;
export function buildScheme<I extends Issue>(
  source: ColorTokenSource<I>,
): Result<CompiledColorScheme, I | BuildSchemeIssue>;
export function buildScheme<I extends Issue>(
  source: ColorTokenSource<I>,
  options: BuildSchemeSourceOptions<I>,
): Result<CompiledColorScheme, I | BuildSchemeIssue>;
export function buildScheme<I extends Issue>(
  sources: readonly [ColorTokenSource<I>, ...ColorTokenSource<I>[]],
): Result<CompiledColorScheme, I | BuildSchemeIssue>;
export function buildScheme<I extends Issue>(
  sources: readonly [ColorTokenSource<I>, ...ColorTokenSource<I>[]],
  options: BuildSchemeSourceOptions<I>,
): Result<CompiledColorScheme, I | BuildSchemeIssue>;
export function buildScheme<I extends Issue>(
  input:
    | BuildSchemeOptions<I>
    | ColorTokenSource<I>
    | readonly [ColorTokenSource<I>, ...ColorTokenSource<I>[]],
  options?: BuildSchemeSourceOptions<I>,
): Result<CompiledColorScheme, I | BuildSchemeIssue> {
  const normalizedOptions = normalizeBuildSchemeCall(input, options);
  if (!normalizedOptions.ok) {
    return normalizedOptions as Result<never, I | BuildSchemeIssue>;
  }

  return buildSchemeOptions(normalizedOptions.value);
}

export function createSchemeBuilder(config: SchemeBuilderConfig): SchemeBuilder {
  return createSchemeBuildKernel(config);
}

function buildSchemeOptions<I extends Issue>(
  input: BuildSchemeOptions<I>,
): Result<CompiledColorScheme, I | BuildSchemeIssue> {
  const parsedOptions = parseBuildOptions(input);
  if (!parsedOptions.ok) {
    return parsedOptions as Result<never, I | BuildSchemeIssue>;
  }

  const sourceResults: BuiltSourceGraph[] = [];
  for (const [sourceIndex, source] of parsedOptions.value.sources.entries()) {
    const sourceResult = callSource(source, sourceIndex);
    if (!sourceResult.ok) {
      return sourceResult as Result<never, I | BuildSchemeIssue>;
    }
    sourceResults.push({ source, graph: sourceResult.value, sourceIndex });
  }

  const composed = composeSourceGraphs(
    sourceResults,
    parsedOptions.value.layers,
    parsedOptions.value.envelope,
  );
  if (!composed.ok) {
    return composed as Result<never, I | BuildSchemeIssue>;
  }
  const callerLayerIds = collectCallerLayerIds(parsedOptions.value.layers);
  return buildFromComposedGraph(
    composed.value.graph,
    composed.value.tokenSourceIds,
    composed.value.layerSourceIds,
    callerLayerIds,
    parsedOptions.value.selection,
  ) as Result<CompiledColorScheme, I | BuildSchemeIssue>;
}

interface SchemeBuildKernel {
  build<I extends Issue>(
    input?:
      | ColorTokenSource<I>
      | readonly [ColorTokenSource<I>, ...ColorTokenSource<I>[]]
      | SchemeBuilderBuildOptions<I>,
  ): Result<CompiledColorScheme, I | BuildSchemeIssue>;
}

function createSchemeBuildKernel(config: SchemeBuilderConfig): SchemeBuildKernel {
  const preparedConfig = copyPreparedBuildOptions(config);

  return Object.freeze({
    build<I extends Issue>(
      input?:
        | ColorTokenSource<I>
        | readonly [ColorTokenSource<I>, ...ColorTokenSource<I>[]]
        | SchemeBuilderBuildOptions<I>,
    ): Result<CompiledColorScheme, I | BuildSchemeIssue> {
      const normalizedOptions = normalizeBuilderBuildCall<I>(preparedConfig, input);
      if (!normalizedOptions.ok) {
        return normalizedOptions as Result<never, I | BuildSchemeIssue>;
      }
      return buildSchemeOptions(normalizedOptions.value);
    },
  });
}

function normalizeBuilderBuildCall<I extends Issue>(
  preparedConfig: BuildSchemeSourceOptions,
  input:
    | ColorTokenSource<I>
    | readonly [ColorTokenSource<I>, ...ColorTokenSource<I>[]]
    | SchemeBuilderBuildOptions<I>
    | undefined,
): Result<BuildSchemeOptions<I>, BuildSchemeIssue> {
  const parsedConfig = parseBuildSourceOptions(preparedConfig);
  if (!parsedConfig.ok) {
    return parsedConfig;
  }

  if (input === undefined) {
    return { ok: true, value: parsedConfig.value as BuildSchemeOptions<I> };
  }
  if (Array.isArray(input)) {
    return {
      ok: true,
      value: {
        ...parsedConfig.value,
        base: input,
      },
    };
  }
  if (isSourceShorthand(input)) {
    return {
      ok: true,
      value: {
        ...parsedConfig.value,
        base: input,
      },
    };
  }

  const entries = readPlainRecord(input, {
    code: "invalid-build-options",
    message: "scheme builder build input must be a plain object.",
  });
  if (!entries.ok) {
    return entries as Result<never, BuildSchemeIssue>;
  }

  const merged: Record<string, unknown> = {};
  const configEntries = readPlainRecord(parsedConfig.value, {
    code: "invalid-build-options",
    message: "scheme builder config must be a plain object.",
  });
  if (!configEntries.ok) {
    return configEntries as Result<never, BuildSchemeIssue>;
  }

  for (const entry of configEntries.value) {
    defineRecordValue(merged, entry.key, entry.value);
  }
  for (const entry of entries.value) {
    defineRecordValue(merged, entry.key, entry.value);
  }

  return { ok: true, value: merged as BuildSchemeOptions<I> };
}

function copyPreparedBuildOptions(input: SchemeBuilderConfig): BuildSchemeSourceOptions {
  const entries = readPlainRecord(input, {
    code: "invalid-build-options",
    message: "scheme builder config must be a plain object.",
  });
  if (!entries.ok) {
    return input;
  }

  const output: Record<string, unknown> = {};
  for (const entry of entries.value) {
    defineRecordValue(output, entry.key, copyPreparedValue(entry.value, new Set()));
  }
  return Object.freeze(output) as BuildSchemeSourceOptions;
}

function copyPreparedValue(input: unknown, seen: Set<object>): unknown {
  if (
    input === null ||
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    return input;
  }

  if (Array.isArray(input)) {
    if (seen.has(input)) {
      return input;
    }
    seen.add(input);
    const output = input.map((value) => copyPreparedValue(value, seen));
    seen.delete(input);
    return Object.freeze(output);
  }

  if (input !== null && typeof input === "object") {
    if (seen.has(input)) {
      return input;
    }

    const entries = readPlainRecord(input, {
      code: "invalid-build-options",
      message: "scheme builder config values must be plain objects.",
    });
    if (!entries.ok) {
      return input;
    }

    seen.add(input);
    const output: Record<string, unknown> = {};
    for (const entry of entries.value) {
      defineRecordValue(output, entry.key, copyPreparedValue(entry.value, seen));
    }
    seen.delete(input);
    return Object.freeze(output);
  }

  return input;
}

function normalizeBuildSchemeCall<I extends Issue>(
  input:
    | BuildSchemeOptions<I>
    | ColorTokenSource<I>
    | readonly [ColorTokenSource<I>, ...ColorTokenSource<I>[]],
  options: BuildSchemeSourceOptions<I> | undefined,
): Result<BuildSchemeOptions<I>, BuildSchemeIssue> {
  if (options !== undefined) {
    const parsedOptions = parseBuildSourceOptions(options);
    if (!parsedOptions.ok) {
      return parsedOptions;
    }
    return {
      ok: true,
      value: {
        ...parsedOptions.value,
        base: Array.isArray(input) ? input : (input as ColorTokenSource<I>),
      },
    };
  }

  if (Array.isArray(input)) {
    return { ok: true, value: { base: input } };
  }

  return isSourceShorthand(input)
    ? { ok: true, value: { base: input } }
    : { ok: true, value: input as BuildSchemeOptions<I> };
}

function parseBuildSourceOptions<I extends Issue>(
  input: BuildSchemeSourceOptions<I>,
): Result<BuildSchemeSourceOptions<I>, BuildSchemeIssue> {
  const entries = readPlainRecord(input, {
    code: "invalid-build-options",
    message: "buildScheme source options must be a plain object.",
  });
  if (!entries.ok) {
    return entries as Result<never, BuildSchemeIssue>;
  }
  if (entries.value.some((entry) => entry.key === "base")) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "buildScheme source options cannot include base.",
          path: "/base",
        },
      ],
    };
  }
  return { ok: true, value: input };
}

function isSourceShorthand<I extends Issue>(input: unknown): input is ColorTokenSource<I> {
  const entries = readPlainRecord(input, {
    code: "invalid-build-options",
    message: "source must be a plain object with id and build.",
  });
  if (!entries.ok) {
    return false;
  }
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  return typeof record.get("id") === "string" && typeof record.get("build") === "function";
}

function buildFromComposedGraph(
  graphInput: unknown,
  tokenSourceIds: ReadonlyMap<string, string>,
  layerSourceIds: ReadonlyMap<string, string>,
  callerLayerIds: ReadonlySet<string>,
  selection: TokenSelection | undefined,
): Result<CompiledColorScheme, BuildSchemeIssue> {
  const parsedGraph = parseTokenGraphInternal(graphInput, {
    callerLayerIds,
    tokenSourceIds,
    layerSourceIds,
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

  return compiled;
}

interface ParsedBuildOptions<I extends Issue> {
  readonly envelope: BuildSchemeEnvelope;
  readonly sources: readonly ColorTokenSource<I>[];
  readonly layers?: readonly ColorTokenLayerInput[];
  readonly selection?: TokenSelection;
}

interface BuildSchemeEnvelope {
  readonly modes?: readonly [string, ...string[]];
  readonly defaultMode?: string;
  readonly defaultVisibility?: TokenVisibility;
}

function parseBuildOptions<I extends Issue>(
  input: BuildSchemeOptions<I>,
): Result<ParsedBuildOptions<I>, BuildSchemeIssue> {
  const entries = readPlainRecord(input, {
    code: "invalid-build-options",
    message: "buildScheme options must be a plain object.",
  });
  if (!entries.ok) {
    return entries as Result<never, BuildSchemeIssue>;
  }

  for (const entry of entries.value) {
    if (
      entry.key !== "modes" &&
      entry.key !== "defaultMode" &&
      entry.key !== "defaultVisibility" &&
      entry.key !== "base" &&
      entry.key !== "layers" &&
      entry.key !== "selection"
    ) {
      return {
        ok: false,
        issues: [{ code: "invalid-build-options", message: `Unknown build option: ${entry.key}.` }],
      };
    }
  }

  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const envelope = parseBuildEnvelope(record);
  if (!envelope.ok) {
    return envelope;
  }
  const sources = parseBase<I>(record.get("base"));
  if (!sources.ok) {
    return sources;
  }
  if (sources.value.length === 0 && record.has("defaultMode") && !record.has("modes")) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "defaultMode requires modes when buildScheme has no base input.",
          path: "/defaultMode",
        },
      ],
    };
  }
  const layers = record.get("layers");
  if (layers !== undefined && !Array.isArray(layers)) {
    return {
      ok: false,
      issues: [{ code: "invalid-build-options", message: "layers must be an array." }],
    };
  }
  if (sources.value.length === 0 && (layers === undefined || layers.length === 0)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "buildScheme requires at least one base input or layer.",
        },
      ],
    };
  }

  return {
    ok: true,
    value: {
      envelope: envelope.value,
      sources: sources.value,
      ...(layers === undefined ? {} : { layers: layers as readonly ColorTokenLayerInput[] }),
      ...(record.has("selection") ? { selection: record.get("selection") as TokenSelection } : {}),
    },
  };
}

function parseBuildEnvelope(
  record: ReadonlyMap<string, unknown>,
): Result<BuildSchemeEnvelope, BuildSchemeIssue> {
  const modes = record.has("modes") ? parseBuildModes(record.get("modes")) : undefined;
  if (modes !== undefined && !modes.ok) {
    return modes;
  }

  const defaultMode = record.get("defaultMode");
  if (record.has("defaultMode") && typeof defaultMode !== "string") {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "defaultMode must be a string.",
          path: "/defaultMode",
        },
      ],
    };
  }
  if (modes !== undefined && !record.has("defaultMode")) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "defaultMode is required when modes is provided.",
          path: "/defaultMode",
        },
      ],
    };
  }
  if (
    modes !== undefined &&
    typeof defaultMode === "string" &&
    !modes.value.includes(defaultMode)
  ) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "defaultMode must belong to modes.",
          path: "/defaultMode",
        },
      ],
    };
  }

  const defaultVisibility = record.get("defaultVisibility");
  if (
    record.has("defaultVisibility") &&
    defaultVisibility !== "public" &&
    defaultVisibility !== "internal"
  ) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "defaultVisibility must be public or internal.",
          path: "/defaultVisibility",
        },
      ],
    };
  }

  return {
    ok: true,
    value: {
      ...(modes === undefined ? {} : { modes: modes.value }),
      ...(typeof defaultMode === "string" ? { defaultMode } : {}),
      ...(defaultVisibility === "public" || defaultVisibility === "internal"
        ? { defaultVisibility }
        : {}),
    },
  };
}

function parseBuildModes(input: unknown): Result<readonly [string, ...string[]], BuildSchemeIssue> {
  if (!Array.isArray(input)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "modes must be a non-empty array.",
          path: "/modes",
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
          message: "modes must contain at least one mode.",
          path: "/modes",
        },
      ],
    };
  }

  const modes: string[] = [];
  const modePaths = new Map<string, string>();
  for (const [index, value] of input.entries()) {
    const path = `/modes/${index}`;
    if (typeof value !== "string" || !isSingleSegmentIdentifier(value)) {
      return {
        ok: false,
        issues: [
          {
            code: "invalid-build-options",
            message: "modes entries must be lower-kebab single segments.",
            path,
          },
        ],
      };
    }
    const firstPath = modePaths.get(value);
    if (firstPath !== undefined) {
      return {
        ok: false,
        issues: [
          {
            code: "invalid-build-options",
            message: `Duplicate mode: ${value}.`,
            path,
            firstPath,
          },
        ],
      };
    }
    modePaths.set(value, path);
    modes.push(value);
  }

  const firstMode = modes[0];
  if (firstMode === undefined) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "modes must contain at least one mode.",
          path: "/modes",
        },
      ],
    };
  }

  return { ok: true, value: [firstMode, ...modes.slice(1)] };
}

function parseBase<I extends Issue>(
  input: unknown,
): Result<readonly ColorTokenSource<I>[], BuildSchemeIssue> {
  if (input === undefined) {
    return { ok: true, value: [] };
  }
  if (isSourceShorthand(input)) {
    const source = parseSource<I>(input, 0);
    return source.ok ? { ok: true, value: [source.value] } : source;
  }
  if (!Array.isArray(input)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "base must be a source or an array of sources.",
          path: "/base",
        },
      ],
    };
  }

  const sources: ColorTokenSource<I>[] = [];
  const sourceIdPaths = new Map<string, string>();
  for (const [sourceIndex, value] of input.entries()) {
    const source = parseSource<I>(value, sourceIndex);
    if (!source.ok) {
      return source;
    }
    const idPath = `/base/${sourceIndex}/id`;
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

  return { ok: true, value: sources };
}

function parseSource<I extends Issue>(
  input: unknown,
  sourceIndex: number,
): Result<ColorTokenSource<I>, BuildSchemeIssue> {
  const path = `/base/${sourceIndex}`;
  const entries = readPlainRecord(input, {
    code: "invalid-build-options",
    message: "source must be a plain object with id and build.",
    path,
  });
  if (!entries.ok) {
    return entries as Result<never, BuildSchemeIssue>;
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
  return { ok: true, value: input as ColorTokenSource<I> };
}

function callSource<I extends Issue>(
  source: ColorTokenSource<I>,
  sourceIndex: number,
): Result<ColorTokenGraphInput, I | BuildSchemeIssue> {
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
          path: `/base/${sourceIndex}`,
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
): Result<ColorTokenGraphInput, I | BuildSchemeIssue> {
  const entries = readPlainRecord(input, {
    code: "invalid-source-result",
    message: "Source build result must be a plain Result object.",
    path: `/base/${sourceIndex}`,
  });
  if (!entries.ok) {
    return entries as Result<never, I | BuildSchemeIssue>;
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
            path: `/base/${sourceIndex}`,
            sourceId,
            sourceIndex,
          },
        ],
      };
    }
    return { ok: true, value: record.get("value") as ColorTokenGraphInput };
  }
  if (okValue !== false || record.size !== 2 || !record.has("issues")) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-source-result",
          message: "Source result must be ok true/value or ok false/issues.",
          path: `/base/${sourceIndex}`,
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
          path: `/base/${sourceIndex}/issues`,
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
            path: `/base/${sourceIndex}/issues`,
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
  readonly source: ColorTokenSource<I>;
  readonly graph: ColorTokenGraphInput;
  readonly sourceIndex: number;
}

interface ComposedSourceGraphs {
  readonly graph: unknown;
  readonly tokenSourceIds: ReadonlyMap<string, string>;
  readonly layerSourceIds: ReadonlyMap<string, string>;
}

function composeSourceGraphs(
  sources: readonly BuiltSourceGraph[],
  layers: readonly ColorTokenLayerInput[] | undefined,
  envelope: BuildSchemeEnvelope,
): Result<ComposedSourceGraphs, BuildSchemeIssue> {
  const sourceGraphs: SourceGraphParts[] = [];
  for (const source of sources) {
    const sourceGraph = validateSourceGraph(source);
    if (!sourceGraph.ok) {
      return sourceGraph;
    }
    sourceGraphs.push(sourceGraph.value);
  }

  const output: Record<string, unknown> = {};
  defineRecordValue(output, "kind", colorTokenGraphKind);
  const first = sourceGraphs[0];
  if (first === undefined) {
    defineRecordValue(output, "formatVersion", 1);
    defineRecordValue(output, "modes", envelope.modes ?? ["base"]);
    defineRecordValue(output, "defaultMode", envelope.defaultMode ?? "base");
    defineRecordValue(output, "defaultVisibility", envelope.defaultVisibility ?? "public");
  } else {
    const envelopeMatch = validateBuildEnvelopeAgainstFirstSource(envelope, first);
    if (!envelopeMatch.ok) {
      return envelopeMatch;
    }
    if (first.schema !== undefined) {
      defineRecordValue(output, "$schema", first.schema);
    }
    defineRecordValue(output, "formatVersion", first.formatVersion);
    defineRecordValue(output, "modes", first.modes);
    defineRecordValue(output, "defaultMode", first.defaultMode);
    defineRecordValue(output, "defaultVisibility", first.defaultVisibility);
  }

  const tokens: Record<string, unknown> = {};
  const tokenSourceIds = new Map<string, string>();
  const layerSourceIds = new Map<string, string>();
  const firstTokenPaths = new Map<string, string>();
  const composedLayers: unknown[] = [];

  for (const sourceGraph of sourceGraphs) {
    if (first !== undefined) {
      const modeMatch = validateSourceModes(first, sourceGraph);
      if (!modeMatch.ok) {
        return modeMatch;
      }
    }

    const addedTokens = appendSourceTokens(tokens, tokenSourceIds, firstTokenPaths, sourceGraph);
    if (!addedTokens.ok) {
      return addedTokens;
    }

    if (sourceGraph.layers !== undefined) {
      for (const layer of sourceGraph.layers) {
        const layerId = readLayerId(layer);
        if (layerId !== undefined && !layerSourceIds.has(layerId)) {
          layerSourceIds.set(layerId, sourceGraph.sourceId);
        }
        composedLayers.push(layer);
      }
    }
  }

  defineRecordValue(output, "tokens", tokens);
  if (layers !== undefined) {
    composedLayers.push(...layers);
  }
  if (composedLayers.length > 0) {
    defineRecordValue(output, "layers", composedLayers);
  }

  return {
    ok: true,
    value: {
      graph: output,
      tokenSourceIds,
      layerSourceIds,
    },
  };
}

function validateBuildEnvelopeAgainstFirstSource(
  envelope: BuildSchemeEnvelope,
  first: SourceGraphParts,
): Result<void, BuildSchemeIssue> {
  if (envelope.modes !== undefined && !sameModes(envelope.modes, first.modes)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "buildScheme modes must match the first source graph.",
          path: "/modes",
        },
      ],
    };
  }
  if (envelope.defaultMode !== undefined && envelope.defaultMode !== first.defaultMode) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "buildScheme defaultMode must match the first source graph.",
          path: "/defaultMode",
        },
      ],
    };
  }
  if (
    envelope.defaultVisibility !== undefined &&
    envelope.defaultVisibility !== first.defaultVisibility
  ) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-build-options",
          message: "buildScheme defaultVisibility must match the first source graph.",
          path: "/defaultVisibility",
        },
      ],
    };
  }
  return { ok: true, value: undefined };
}

interface RawSourceGraphParts {
  readonly sourceId: string;
  readonly sourceIndex: number;
  readonly schema?: unknown;
  readonly defaultVisibility: unknown;
  readonly tokens: unknown;
  readonly layers?: readonly unknown[];
}

interface SourceGraphParts extends RawSourceGraphParts {
  readonly formatVersion: 1;
  readonly modes: readonly [string, ...string[]];
  readonly defaultMode: string;
  readonly defaultVisibility: TokenVisibility;
}

function validateSourceGraph(source: BuiltSourceGraph): Result<SourceGraphParts, BuildSchemeIssue> {
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

function readSourceGraph(source: BuiltSourceGraph): Result<RawSourceGraphParts, BuildSchemeIssue> {
  const sourcePath = `/base/${source.sourceIndex}`;
  const entries = readPlainRecord(source.graph, {
    code: "invalid-source-result",
    message: "Source graph must be a plain object.",
    path: sourcePath,
  });
  if (!entries.ok) {
    return entries as Result<never, BuildSchemeIssue>;
  }
  const record = new Map(entries.value.map((entry) => [entry.key, entry.value]));
  const layers = record.get("layers");
  if (layers !== undefined && !Array.isArray(layers)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid-source-result",
          message: "Source graph layers must be an array.",
          path: `${sourcePath}/layers`,
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
      ...(layers === undefined ? {} : { layers }),
    },
  };
}

function prefixSourceGraphIssues(
  issues: readonly [ColorTokenGraphIssue, ...ColorTokenGraphIssue[]],
  source: BuiltSourceGraph,
): readonly [BuildSchemeIssue, ...BuildSchemeIssue[]] {
  const [first, ...rest] = issues;
  return [
    prefixSourceGraphIssue(first, source),
    ...rest.map((issue) => prefixSourceGraphIssue(issue, source)),
  ];
}

function prefixSourceGraphIssue(
  issue: ColorTokenGraphIssue,
  source: BuiltSourceGraph,
): BuildSchemeIssue {
  const path = issue.path ?? "";
  return {
    ...issue,
    path: path === "" ? `/base/${source.sourceIndex}` : `/base/${source.sourceIndex}${path}`,
  };
}

function validateSourceModes(
  first: SourceGraphParts,
  current: SourceGraphParts,
): Result<void, BuildSchemeIssue> {
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
          path: `/base/${current.sourceIndex}/modes`,
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
          path: `/base/${current.sourceIndex}/defaultMode`,
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
): Result<void, BuildSchemeIssue> {
  const entries = readPlainRecord(sourceGraph.tokens, {
    code: "invalid-source-result",
    message: "Source graph tokens must be a plain object record.",
    path: `/base/${sourceGraph.sourceIndex}/tokens`,
  });
  if (!entries.ok) {
    return entries as Result<never, BuildSchemeIssue>;
  }

  for (const entry of entries.value) {
    const tokenPath = `/base/${sourceGraph.sourceIndex}/tokens/${escapePointerSegment(entry.key)}`;
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

function readLayerId(layer: unknown): string | undefined {
  const entries = readPlainRecord(layer, {
    code: "invalid-build-options",
    message: "Layer must be a plain object.",
  });
  if (!entries.ok) {
    return undefined;
  }
  const id = entries.value.find((entry) => entry.key === "id")?.value;
  return typeof id === "string" ? id : undefined;
}

function collectCallerLayerIds(
  layers: readonly ColorTokenLayerInput[] | undefined,
): ReadonlySet<string> {
  const ids = new Set<string>();
  if (layers === undefined) {
    return ids;
  }
  for (const layer of layers) {
    const entries = readPlainRecord(layer, {
      code: "invalid-build-options",
      message: "Layer must be a plain object.",
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
