# ADR 0011: Visibility-Preserving Overrides

## Status

Proposed, as a decision slice of [ADR 0013](./0013-coherent-token-model.md). If accepted, this
record narrows the rule in [ADR 0009](./0009-core-contract-convergence.md) that "visibility,
description, deprecation, and extensions do not implicitly merge from a shadowed declaration" to
description, deprecation, and extensions. It is independent of
[ADR 0010](./0010-graph-tokens-compose-last.md) and composes with it.

## Context

Visibility is part of a token's contract: it decides whether default public compilation and CSS
export include the key. A replacing declaration without an explicit `visibility` currently receives
the `defaultVisibility` of its own composition position, which defaults to `public`. The replaced
declaration's visibility is discarded.
[core-v1.test.ts:122-156](../../tests/unit/core-v1.test.ts) pins that an internal token replaced by
a declaration without visibility becomes public.

The material3 README showed the effect in the project's own documentation until the example was
corrected under the current contract by adding `defaultVisibility: "internal"` to the override
layer:

```ts
const material = material3("#6750a4", { visibility: "internal" });
const overrides = defineTokenLayer({
  id: "brand-overrides",
  tokens: { "md.sys.color.primary": "#ff0055" },
});
```

The override was meant to change a value. It also published `md.sys.color.primary`: default
compilation selected it and CSS export emitted `--md--sys--color--primary`
([audit 2026-09](../audit-2026-09.md), finding 1.2 and probe A2). The corrected example is right
only because every author of an override layer remembers the extra option.

The roadmap asks for concrete consumer evidence before whole-declaration replacement is revisited. A
documented value override that silently widened the public contract is that evidence.

## Decision

The effective visibility of a key resolves in this order:

1. An explicit `visibility` on the winning declaration wins.
2. Otherwise, a winning declaration that replaces an earlier declaration of the same key inherits
   that declaration's effective visibility.
3. Otherwise, the declaring position's `defaultVisibility` applies.

Equivalently, the most recent explicit visibility in the key's declaration chain wins; without
one, the default of the position that introduced the key applies. `defaultVisibility` therefore
governs the keys that a graph or layer introduces, not the keys it overrides. Description,
deprecation, and extensions keep whole-declaration replacement. There is no general metadata merge.

The strict wire format already separates explicit from defaulted visibility, because a token record
carries `visibility` only when it was authored. The parsed internal representation must preserve
that distinction until composition completes instead of resolving visibility per position. No new
wire field is needed, and compiled metadata reports the effective value together with the explicit
visibility of each declaration in the composition path (ADR 0013, D6).

## Consequences

- Value overrides no longer change the public contract. Publishing an overridden token requires
  `visibility: "public"` on the override.
- The override example no longer depends on `defaultVisibility: "internal"`; a later layer or a
  direct graph override of an internal role stays internal.
- Static typing mirrors the same three rules. The type prototype for ADR 0013 (D4) folds layers and
  graph tokens over explicit-visibility key unions and reproduces the runtime result, including an
  explicitly republished role and an override that stays internal, on TypeScript 5.9 and 6.0.
- Overrides without explicit visibility change meaning, so the change ships with format version 2.
  Readers upgrade a persisted v1 graph by writing an explicit `visibility` wherever the new rule
  would differ from v1. In the prototype, 772 such values were written across 2,000 randomized v1
  graphs, and compiled visibility matched v1 for every token.
- [core-v1.test.ts:122-156](../../tests/unit/core-v1.test.ts) changes its expected visibility, and
  the architecture, public API, and define-tokens documentation change together, with a changeset.

## Alternatives

### Keep replacement and reject implicit visibility changes

A new issue code, for example `implicit-visibility-change`, would fail compilation when a replacing
declaration without explicit visibility changes the effective visibility. This avoids any inheritance
rule, but every value override of an internal token must restate its visibility. It also adds a
contractual issue code. This is the fallback if inheritance is rejected.

### Merge all metadata

Rejected. Description and deprecation describe one particular declaration, and merging extensions
needs key-level conflict rules that no consumer has asked for.

### Correct the README only

Rejected as the decision. The README has been corrected under the current contract, but the trap
remains for every new override layer.

## References

- [ADR 0006: Material 3 Authoring and Mode Contract](./0006-material3-authoring-and-mode-contract.md)
- [ADR 0009: Core Contract Convergence](./0009-core-contract-convergence.md)
- [ADR 0010: Graph Tokens Compose Last](./0010-graph-tokens-compose-last.md)
- [ADR 0013: Coherent Token Model](./0013-coherent-token-model.md)
- [Audit 2026-09](../audit-2026-09.md)
