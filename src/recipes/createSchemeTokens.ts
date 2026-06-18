import {
  compileGraph,
  type CompileOptions,
  type CompileProblem,
  type CompiledTokenSet,
} from "../core/compileGraph";
import type { ColorSchemeTokenGraph, Result } from "../core/graph";
import { serializeTokenSet } from "../core/serializeTokenSet";
import { exportCssVariables, type CssVariableOptions } from "../exporters/exportCssVariables";

export interface SchemeTokensRecipeOptions {
  readonly graph: ColorSchemeTokenGraph;
  readonly compile?: CompileOptions;
  readonly css?: CssVariableOptions;
}

export interface SchemeTokensRecipeResult {
  readonly graph: ColorSchemeTokenGraph;
  readonly compiled: CompiledTokenSet;
  readonly css: string;
  readonly snapshot: string;
}

export type SchemeTokensRecipeRun = Result<SchemeTokensRecipeResult, CompileProblem>;

export function createSchemeTokens(options: SchemeTokensRecipeOptions): SchemeTokensRecipeRun {
  const compiled = compileGraph(options.graph, options.compile);
  if (!compiled.ok) return compiled;

  return {
    ok: true,
    value: {
      graph: options.graph,
      compiled: compiled.value,
      css: exportCssVariables(compiled.value, options.css),
      snapshot: serializeTokenSet(compiled.value),
    },
  };
}
