import {
  compileGraph,
  type CompileOptions,
  type CompileProblem,
  type CompiledTokenSet,
} from "../core/compileGraph";
import { createSchemeGraph } from "../core/createSchemeGraph";
import type { ColorSchemeTokenGraph, Result } from "../core/graph";
import type { GraphBuildProblem, SchemeSource, SchemeSourceProblem } from "../core/schemeSource";
import { serializeTokenSet } from "../core/serializeTokenSet";
import { exportCssVariables, type CssVariableOptions } from "../exporters/exportCssVariables";
import { applyLayers } from "../layers/applyLayers";
import type { ColorSchemeTokenLayer } from "../layers/layer";

export type ColorSchemeTokenGraphTransform = (
  graph: ColorSchemeTokenGraph,
) => ColorSchemeTokenGraph;

export interface SchemeTokensRecipeOptions {
  readonly source: SchemeSource;
  readonly layers?: readonly ColorSchemeTokenLayer[];
  readonly transforms?: readonly ColorSchemeTokenGraphTransform[];
  readonly compile?: CompileOptions;
  readonly css?: CssVariableOptions;
}

export interface SchemeTokensRecipeResult {
  readonly graph: ColorSchemeTokenGraph;
  readonly tokenSet: CompiledTokenSet;
  readonly cssVariables: string;
  readonly snapshot: string;
}

export type SchemeTokensRecipeProblem = GraphBuildProblem<SchemeSourceProblem> | CompileProblem;

export function createSchemeTokens(
  options: SchemeTokensRecipeOptions,
): Result<SchemeTokensRecipeResult, SchemeTokensRecipeProblem> {
  const graphResult = createSchemeGraph({ source: options.source });
  if (!graphResult.ok) return graphResult;

  const layeredGraph =
    options.layers === undefined
      ? graphResult.value
      : applyLayers(graphResult.value, options.layers);
  const graph = applyTransforms(layeredGraph, options.transforms ?? []);
  const compiled = compileGraph(graph, options.compile);
  if (!compiled.ok) return compiled;

  return {
    ok: true,
    value: {
      graph,
      tokenSet: compiled.value,
      cssVariables: exportCssVariables(compiled.value, options.css),
      snapshot: serializeTokenSet(compiled.value),
    },
  };
}

function applyTransforms(
  graph: ColorSchemeTokenGraph,
  transforms: readonly ColorSchemeTokenGraphTransform[],
): ColorSchemeTokenGraph {
  return transforms.reduce((currentGraph, transform) => transform(currentGraph), graph);
}
