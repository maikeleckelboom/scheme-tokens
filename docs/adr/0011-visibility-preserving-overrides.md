# ADR 0011: Visibility-Preserving Overrides

## Status

Proposed. If accepted, this record narrows the rule in
[ADR 0009](./0009-core-contract-convergence.md) that "visibility, description, deprecation, and
extensions do not implicitly merge from a shadowed declaration" to description, deprecation, and
extensions. It is independent of [ADR 0010](./0010-graph-tokens-compose-last.md) and composes with
it.

## Context

Visibility is part of a token's contract: it decides whether default public compilation and CSS
export include the key. A replacing declaration without an explicit `visibility` currently receives
the `defaultVisibility` of its own composition position, which defaults to `public`. The replaced
declaration's visibility is discarded.
[core-v1.test.ts:122-156](../../tests/unit/core-v1.test.ts) pins that an internal token replaced by
a declaration without visibility becomes public.

The material3 README shows the effect in the project's own documentation
([packages/material3/README.md:84-96](../../packages/material3/README.md)):

```ts
const material = material3("#6750a4", { visibility: "internal" });
const overrides = defineTokenLayer({
  id: "brand-overrides",
  tokens: { "md.sys.color.primary": "#ff0055" },
});
```

The override is meant to change a value. It also publishes `md.sys.color.primary`: default
compilation selects it and CSS export emits `--md--sys--color--primary`
([audit 2026-09](../audit-2026-09.md), finding 1.2 and probe A2). The root README avoids the leak
only because its override layer sets `defaultVisibility: "internal"`.

The roadmap asks for concrete consumer evidence before whole-declaration replacement is revisited. A
documented value override that silently widens the public contract is that evidence.

## Decision

The effective visibility of a key resolves in this order:

1. An explicit `visibility` on the winning declaration wins.
2. Otherwise, a winning declaration that replaces an earlier declaration of the same key inherits
   that declaration's effective visibility.
3. Otherwise, the declaring position's `defaultVisibility` applies.

`defaultVisibility` therefore governs the keys that a graph or layer introduces, not the keys it
overrides. Description, deprecation, and extensions keep whole-declaration replacement.

The strict wire format already separates explicit from defaulted visibility, because a token record
carries `visibility` only when it was authored. No format or schema change is needed, and compiled
metadata continues to report the effective value.

## Consequences

- Value overrides no longer change the public contract. Publishing an overridden token requires
  `visibility: "public"` on the override.
- The material3 README example becomes correct as written.
- Overrides without explicit visibility change meaning, so the change ships as a pre-1.0 minor with a
  changeset. [core-v1.test.ts:122-156](../../tests/unit/core-v1.test.ts) changes its expected
  visibility, and the architecture, public API, and define-tokens documentation change together.
- Type-level visibility inference ([audit 2026-09](../audit-2026-09.md), finding 2.2), if adopted,
  must mirror the same three rules.

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

Rejected as the decision. It fixes one example and leaves the trap in place. The README must be
corrected in any case.

## References

- [ADR 0006: Material 3 Authoring and Mode Contract](./0006-material3-authoring-and-mode-contract.md)
- [ADR 0009: Core Contract Convergence](./0009-core-contract-convergence.md)
- [ADR 0010: Graph Tokens Compose Last](./0010-graph-tokens-compose-last.md)
- [Audit 2026-09](../audit-2026-09.md)
