import type { ColorSchemeTokenGraph, TokenNode } from "../core/graph";
import type { ColorSchemeProfile } from "./profile";

export function applyProfile(
  graph: ColorSchemeTokenGraph,
  profile: ColorSchemeProfile,
): ColorSchemeTokenGraph {
  const profileTokens: TokenNode[] = profile.tokens.map((token) => ({
    kind: "alias",
    key: token.key,
    target: token.target,
    ...(token.provenance === undefined ? {} : { provenance: token.provenance }),
  }));

  return {
    ...graph,
    tokens: [...graph.tokens, ...profileTokens],
  };
}
