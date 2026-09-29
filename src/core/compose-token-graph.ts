import type { TokenDeclarationRecord } from "./compiled-types";
import type {
  TokenDefinition,
  TokenDefinitionMetadata,
  TokenGraph,
  TokenVisibility,
} from "./graph";
import type { ExpressionSource } from "./canonical-expression";
import { pointer, sortedRecord } from "./json";
import { isExpressionValue, type ValidatedSource } from "./validate-source";

export interface ComposedToken<Mode extends string = string> extends Omit<
  TokenDefinitionMetadata,
  "visibility"
> {
  readonly visibility: TokenVisibility;
  readonly declarations: readonly [TokenDeclarationRecord, ...TokenDeclarationRecord[]];
  readonly expressions: Readonly<Record<Mode, ExpressionSource>>;
}
export interface ComposedGraph<Mode extends string = string, Key extends string = string> {
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly tokens: Readonly<Record<Key, ComposedToken<Mode>>>;
}

/** Layers in array order, then graph. Only visibility looks through replaced declarations. */
export function composeTokenGraph(source: ValidatedSource<TokenGraph>): ComposedGraph {
  const graph = source.artifact;
  const tokens = new Map<string, ComposedToken>();
  const apply = (
    definitions: Readonly<Record<string, TokenDefinition>>,
    fallback: TokenVisibility,
    origin: TokenDeclarationRecord["origin"],
    path: string,
  ) => {
    for (const [key, definition] of Object.entries(definitions)) {
      const previous = tokens.get(key);
      const { value, visibility, ...metadata } = definition;
      const declaration = { origin, ...(visibility === undefined ? {} : { visibility }) };
      const expressions = sortedRecord(
        graph.modes.map((mode) => {
          const expressionPath =
            path + pointer(key, "value") + (isExpressionValue(value) ? "" : pointer(mode));
          const expression = source.expressions.get(expressionPath);
          if (expression === undefined) {
            throw new Error("Validated token must have every expression.");
          }
          return [mode, expression] as const;
        }),
      );
      tokens.set(key, {
        ...metadata,
        visibility: visibility ?? previous?.visibility ?? fallback,
        declarations:
          previous === undefined ? [declaration] : [...previous.declarations, declaration],
        expressions,
      });
    }
  };
  graph.layers?.forEach((layer, index) =>
    apply(
      layer.tokens,
      layer.defaultVisibility,
      { kind: "layer", id: layer.id },
      pointer("layers", index, "tokens"),
    ),
  );
  apply(graph.tokens, graph.defaultVisibility, { kind: "graph" }, "/tokens");
  return { modes: graph.modes, defaultMode: graph.defaultMode, tokens: sortedRecord(tokens) };
}
