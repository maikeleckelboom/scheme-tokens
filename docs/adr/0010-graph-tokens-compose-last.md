# ADR 0010: Graph Tokens Compose Last

## Status

Proposed, as a decision slice of [ADR 0013](./0013-coherent-token-model.md), which designs
composition, visibility, authoring, and static typing as one contract. If accepted, this record
supersedes the composition order in [ADR 0009](./0009-core-contract-convergence.md), "Graph tokens
compose first. Layers apply afterward in array order.", and the matching part of the roadmap's 1.0
gate that retains graph-first composition. Override visibility is decided by
[ADR 0011](./0011-visibility-preserving-overrides.md).

## Context

A token graph has two kinds of composition position: its own `tokens` and an ordered `layers`
array. Graph tokens currently compose first and layers apply afterward, so a layer declaration
replaces a graph declaration with the same key
([parse-token-graph.ts:233-268](../../src/core/parse-token-graph.ts)).
[core-v1.test.ts:107](../../tests/unit/core-v1.test.ts) pins that order.

The [2026-09 audit](../audit-2026-09.md) (finding 1.1) shows the consequence for the documented
fragment pattern:

```ts
const graph = defineTokenGraph({
  ...material3("#6750a4"),
  tokens: {
    // Replaced by the generated material3 layer without a diagnostic.
    "md.sys.color.primary": "#ff0055",
  },
});
```

Compilation succeeds and returns the generated value, and provenance names the `material3` layer.
Nothing reports that an authored declaration had no effect. The README therefore teaches overrides
through an additional layer, and [architecture.md](../architecture.md) has to warn that composition
"is not CSS cascade behavior".

Readers bring cascade intuition to this API. In CSS cascade layers, unlayered declarations beat
every named layer. Style Dictionary's `source` tokens override its `include` tokens, and preset
systems apply the user's own configuration last. Generated data arrives as layers, so graph-first
composition ranks generator output above the application's own tokens.

The one production consumer has 338 graph tokens and a 48-token `material3` layer, and none of its
graph keys collides with a layer key ([ADR 0013](./0013-coherent-token-model.md), acceptance
examples). No known graph depends on the current order.

## Decision

Layers compose first, in array order. Graph `tokens` compose last. A later composition position
still replaces the complete earlier declaration with the same key, except for visibility, which
[ADR 0011](./0011-visibility-preserving-overrides.md) decides.

With this order, token layers compose exactly like CSS cascade layers: later layers win over
earlier ones, and the unlayered declarations, here the graph's own tokens, win over every layer.

The rest of the composition contract is unchanged:

- references resolve against the complete composed graph;
- provenance identifies the winning declaration, and the reshaped compiled metadata in ADR 0013
  (D6) also lists the declarations it replaced, in composition order;
- duplicate layer ids, mode envelope ownership, and selection are unaffected.

## Consequences

- The graph's own tokens are the final word. `defineTokens(tokens, material3(…))` overrides
  generated roles directly, and the README override section no longer needs an extra layer.
- "Which public roles are still generated defaults?" reads directly from provenance: a winning
  `layer` declaration is generated or imported, a winning `graph` declaration is the application's
  own.
- Graph defaults that a layer should override move into the first layer. Every precedence remains
  expressible because layers stay freely ordered.
- The meaning of an existing graph changes where a graph key collides with a layer key, so the
  change ships with format version 2 (ADR 0013, D10). Readers upgrade a persisted v1 graph by moving
  the graph declarations that v1 layers shadowed into a leading layer. Those declarations never won
  in v1, so the compiled output is unchanged. In the prototype, 2,000 randomized v1 graphs with
  3,780 graph–layer collisions compiled identically before and after the upgrade.
- [core-v1.test.ts:107](../../tests/unit/core-v1.test.ts) inverts. The README, architecture,
  public API, and define-tokens guide, and the material3 README change together, with a changeset.
- The canonical v2 graph writes `layers` before `tokens` so the serialized order mirrors
  composition order (ADR 0013, D10).

## Alternatives

### Keep graph-first and reject shadowed graph tokens

A new issue code, for example `shadowed-graph-token`, would fail compilation when a layer replaces a
graph declaration. This removes the silent loss without changing the order, but it forbids the
override users reach for first and still requires an extra layer. It also adds a contractual issue
code. This is the fallback if graph-last composition is rejected.

### Keep the current order and document it

Rejected. The loss stays silent, and provenance names the winning layer without saying that an
authored declaration was discarded.

### Make precedence configurable

A graph-level switch between both orders. Rejected: two composition models for one intent,
contrary to [ADR 0002](./0002-public-api-reset.md).

## References

- [ADR 0002: Pre-release Public API Reset](./0002-public-api-reset.md)
- [ADR 0006: Material 3 Authoring and Mode Contract](./0006-material3-authoring-and-mode-contract.md)
- [ADR 0009: Core Contract Convergence](./0009-core-contract-convergence.md)
- [ADR 0011: Visibility-Preserving Overrides](./0011-visibility-preserving-overrides.md)
- [ADR 0013: Coherent Token Model](./0013-coherent-token-model.md)
- [Audit 2026-09](../audit-2026-09.md)
- [Consumer evidence audit](../audit-2026-08-consumer-evidence.md)
