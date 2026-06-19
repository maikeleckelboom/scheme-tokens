import {
  type CompileOptions,
  type CompileProblem,
  compileValidatedGraph,
  type CompiledTokenSet,
} from "../core/compileGraph";
import { resolveColorTokenValue } from "../core/colorTokenValue";
import { createSourceGraph } from "../core/createSourceGraph";
import type {
  ColorSchemeTokenGraphInput,
  Result,
  ValidatedColorSchemeTokenGraph,
} from "../core/graph";
import type {
  ColorSchemeTokenSource,
  ColorSchemeTokenSourceProblem,
  GraphBuildProblem,
} from "../core/colorSchemeTokenSource";
import { serializeTokenSet } from "../core/serializeTokenSet";
import { validateGraph, type TokenGraphProblem } from "../core/validateGraph";
import { exportCssVariables, type CssVariableOptions } from "../exporters/exportCssVariables";
import { applyLayers } from "../layers/applyLayers";
import type { ColorSchemeTokenLayerInput } from "../layers/layer";

export type ColorSchemeTokenAliases = Readonly<Record<string, string>>;

export interface SchemeTokensRecipeOptions {
  readonly source: ColorSchemeTokenSource;
  readonly layers?: readonly ColorSchemeTokenLayerInput[];
  readonly aliases?: ColorSchemeTokenAliases;
  readonly compile?: CompileOptions;
  readonly css?: CssVariableOptions;
}

export interface SchemeTokensRecipeResult {
  readonly graph: ValidatedColorSchemeTokenGraph;
  readonly tokenSet: CompiledTokenSet;
  readonly cssVariables: string;
  readonly snapshot: string;
}

export type SchemeTokensRecipeProblem =
  | GraphBuildProblem<ColorSchemeTokenSourceProblem>
  | TokenGraphProblem
  | CompileProblem;

export function createSchemeTokens(
  options: SchemeTokensRecipeOptions,
): Result<SchemeTokensRecipeResult, SchemeTokensRecipeProblem> {
  const graphResult = createSourceGraph({ source: options.source });
  if (!graphResult.ok) return graphResult;

  const graph = applyRecipeAdditions(graphResult.value, options);
  if (!graph.ok) return graph;

  const compiled = compileValidatedGraph(graph.value, options.compile);
  if (!compiled.ok) return compiled;

  return {
    ok: true,
    value: {
      graph: graph.value,
      tokenSet: compiled.value,
      cssVariables: exportCssVariables(compiled.value, options.css),
      snapshot: serializeTokenSet(compiled.value),
    },
  };
}

function applyRecipeAdditions(
  graph: ValidatedColorSchemeTokenGraph,
  options: SchemeTokensRecipeOptions,
): Result<ValidatedColorSchemeTokenGraph, TokenGraphProblem> {
  if (options.layers === undefined && options.aliases === undefined) {
    return { ok: true, value: graph };
  }

  const graphInput = toGraphInput(graph);
  const layeredGraph =
    options.layers === undefined ? graphInput : applyLayers(graphInput, options.layers);
  const aliasedGraph =
    options.aliases === undefined
      ? layeredGraph
      : applyLayers(layeredGraph, [aliasesToLayerInput(options.aliases)]);

  return validateGraph(aliasedGraph);
}

function aliasesToLayerInput(aliases: ColorSchemeTokenAliases): ColorSchemeTokenLayerInput {
  return {
    name: "recipe-aliases",
    tokens: Object.entries(aliases).map(([key, target]) => ({
      kind: "alias",
      key,
      target,
    })),
  };
}

function toGraphInput(graph: ValidatedColorSchemeTokenGraph): ColorSchemeTokenGraphInput {
  return {
    ...graph,
    modes: graph.modes.map(String),
    tokens: graph.tokens.map((token) =>
      token.kind === "alias"
        ? {
            ...token,
            key: String(token.key),
            target: Array.isArray(token.target)
              ? token.target.map((entry) => ({
                  mode: String(entry.mode),
                  value: String(entry.value),
                }))
              : String(token.target),
          }
        : {
            ...token,
            key: String(token.key),
            values: token.values.map((entry) => ({
              mode: String(entry.mode),
              value: resolveColorTokenValue(entry.value),
            })),
          },
    ),
  };
}
