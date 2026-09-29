# ADR 0010: Graph Tokens Compose Last

## Status

Proposed. If accepted, this record supersedes the composition order in
[ADR 0009](./0009-core-contract-convergence.md), "Graph tokens compose first. Layers apply afterward
in array order.", and the matching part of the roadmap's 1.0 gate that retains graph-first
composition. Whole-declaration replacement is addressed separately by
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

The one production consumer has no layers
([consumer evidence audit](../audit-2026-08-consumer-evidence.md)). No known graph depends on the
current order.

## Decision

Layers compose first, in array order. Graph `tokens` compose last. A later composition position
still replaces the complete earlier declaration with the same key.

The rest of the composition contract is unchanged:

- references resolve against the complete composed graph;
- `metadataByToken[key].origin` identifies the winning declaration, so `{ kind: "graph" }` now
  means "authored or overridden by the graph itself";
- duplicate layer ids, mode envelope ownership, and selection are unaffected.

The wire format and JSON Schemas do not change. Only the meaning of an existing graph changes, and
only where a graph key collides with a layer key.

## Consequences

- The graph's own tokens are the final word, as unlayered CSS and Style Dictionary `source` tokens
  are. `defineTokenGraph({ ...material, tokens })` overrides generated roles directly, and the
  README override section no longer needs an extra layer.
- "Which public roles are still generated defaults?" reads directly from provenance: `layer` origins
  are generated or imported, `graph` origins are the application's own.
- Graph defaults that a layer should override move into the first layer. Every precedence remains
  expressible because layers stay freely ordered.
- Colliding keys change meaning, so the change ships as a pre-1.0 minor with a changeset.
  [core-v1.test.ts:107](../../tests/unit/core-v1.test.ts) inverts. The README, architecture,
  public API, and define-tokens guide, and the material3 README change together.
- Canonical serialization still writes `tokens` before `layers`. Reordering the keys to mirror
  precedence is a separate serialization-contract decision and is left open.

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
- [Audit 2026-09](../audit-2026-09.md)
- [Consumer evidence audit](../audit-2026-08-consumer-evidence.md)
