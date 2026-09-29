import type { TokenDefinition, TokenGraph, TokenLayer, TokenVisibility } from "./graph";
import { tokenLayerKind } from "./graph";
import { compareCodeUnits, pointer, sortedRecord } from "./json";
import { SourcePaths } from "./source-paths";

/** Input has passed the shared validator's v1 grammar delta. No v1 resolver exists. */
export function upgradeV1Graph(graph: TokenGraph): {
  readonly artifact: TokenGraph;
  readonly paths: SourcePaths;
} {
  const paths = new SourcePaths();
  const effective = new Map<string, TokenVisibility>();
  const preserveVisibility = (
    tokens: Readonly<Record<string, TokenDefinition>>,
    fallback: TokenVisibility,
  ) =>
    sortedRecord(
      Object.entries(tokens).map(([key, token]) => {
        const oldVisibility = token.visibility ?? fallback;
        const previous = effective.get(key);
        effective.set(key, oldVisibility);
        return [
          key,
          previous !== undefined && token.visibility === undefined && previous !== oldVisibility
            ? { ...token, visibility: oldVisibility }
            : token,
        ] as const;
      }),
    );
  const graphTokens = preserveVisibility(graph.tokens, graph.defaultVisibility);
  const layers = (graph.layers ?? []).map((layer) => ({
    ...upgradeV1Layer(layer),
    tokens: preserveVisibility(layer.tokens, layer.defaultVisibility),
  }));
  const shadowed = new Set(layers.flatMap((layer) => Object.keys(layer.tokens)));
  const moved = Object.entries(graphTokens).filter(([key]) => shadowed.has(key));
  if (moved.length > 0) {
    const ids = new Set(layers.map((layer) => layer.id));
    let id = "v1-graph";
    let suffix = 1;
    while (ids.has(id)) {
      id = "v1-graph-" + suffix;
      suffix += 1;
    }
    layers.unshift({
      kind: tokenLayerKind,
      formatVersion: 2,
      id,
      defaultVisibility: graph.defaultVisibility,
      tokens: sortedRecord(moved),
    });
    for (const [key] of moved) {
      paths.set(pointer("layers", 0, "tokens", key), pointer("tokens", key));
    }
    for (let index = 1; index < layers.length; index += 1) {
      paths.set(pointer("layers", index), pointer("layers", index - 1));
    }
  }
  const { $schema: _schema, ...source } = graph;
  return {
    artifact: {
      ...source,
      formatVersion: 2,
      modes: [
        graph.defaultMode,
        ...graph.modes.filter((mode) => mode !== graph.defaultMode).sort(compareCodeUnits),
      ],
      ...(graph.layers === undefined && layers.length === 0 ? {} : { layers }),
      tokens: sortedRecord(Object.entries(graphTokens).filter(([key]) => !shadowed.has(key))),
    },
    paths,
  };
}

export function upgradeV1Layer(layer: TokenLayer): TokenLayer {
  const { $schema: _schema, ...source } = layer;
  return { ...source, formatVersion: 2 };
}
