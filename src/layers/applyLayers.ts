import type { ColorSchemeTokenGraph, TokenNode } from "../core/graph";
import type { ColorSchemeTokenLayer } from "./layer";

export function applyLayers(
  graph: ColorSchemeTokenGraph,
  layers: readonly ColorSchemeTokenLayer[],
): ColorSchemeTokenGraph {
  const layerTokens: TokenNode[] = layers.flatMap((layer) =>
    layer.tokens.map((token) =>
      token.kind === "alias"
        ? {
            kind: "alias",
            key: token.key,
            target: token.target,
            ...(token.provenance === undefined ? {} : { provenance: token.provenance }),
          }
        : {
            kind: "color",
            key: token.key,
            values: token.values,
            ...(token.provenance === undefined ? {} : { provenance: token.provenance }),
          },
    ),
  );

  return {
    ...graph,
    tokens: [...graph.tokens, ...layerTokens],
  };
}
