import {
  compileGraph,
  type CompileOptions,
  type CompileProblem,
  type CompiledTokenSet,
} from "../core/compileGraph";
import { createSourceGraph } from "../core/createSourceGraph";
import type { AliasTokenNode, ColorSchemeTokenGraph, Result } from "../core/graph";
import type { TokenKey } from "../core/keys";
import type {
  ColorSchemeTokenSource,
  ColorSchemeTokenSourceProblem,
  GraphBuildProblem,
} from "../core/colorSchemeTokenSource";
import { serializeTokenSet } from "../core/serializeTokenSet";
import { exportCssVariables, type CssVariableOptions } from "../exporters/exportCssVariables";
import { applyLayers } from "../layers/applyLayers";
import type { ColorSchemeTokenLayer } from "../layers/layer";

export type ColorSchemeTokenAliases = Readonly<Record<string, string>>;

export interface SchemeTokensRecipeOptions {
  readonly source: ColorSchemeTokenSource;
  readonly layers?: readonly ColorSchemeTokenLayer[];
  readonly aliases?: ColorSchemeTokenAliases;
  readonly compile?: CompileOptions;
  readonly css?: CssVariableOptions;
}

export interface SchemeTokensRecipeResult {
  readonly graph: ColorSchemeTokenGraph;
  readonly tokenSet: CompiledTokenSet;
  readonly cssVariables: string;
  readonly snapshot: string;
}

export type SchemeTokensRecipeProblem =
  | GraphBuildProblem<ColorSchemeTokenSourceProblem>
  | CompileProblem;

export function createSchemeTokens(
  options: SchemeTokensRecipeOptions,
): Result<SchemeTokensRecipeResult, SchemeTokensRecipeProblem> {
  const graphResult = createSourceGraph({ source: options.source });
  if (!graphResult.ok) return graphResult;

  const layeredGraph =
    options.layers === undefined
      ? graphResult.value
      : applyLayers(graphResult.value, options.layers);
  const aliasedGraph =
    options.aliases === undefined ? layeredGraph : applyAliases(layeredGraph, options.aliases);
  const compiled = compileGraph(aliasedGraph, options.compile);
  if (!compiled.ok) return compiled;

  return {
    ok: true,
    value: {
      graph: aliasedGraph,
      tokenSet: compiled.value,
      cssVariables: exportCssVariables(compiled.value, options.css),
      snapshot: serializeTokenSet(compiled.value),
    },
  };
}

function applyAliases(
  graph: ColorSchemeTokenGraph,
  aliases: ColorSchemeTokenAliases,
): ColorSchemeTokenGraph {
  const aliasTokens: AliasTokenNode[] = Object.entries(aliases).map(([key, target]) => ({
    kind: "alias",
    key: key as TokenKey,
    target: target as TokenKey,
  }));

  return {
    ...graph,
    tokens: [...graph.tokens, ...aliasTokens],
  };
}
