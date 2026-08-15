# ADR 0008: Material 3 Fragment Layer Type

## Status

Accepted. This record supersedes only the `Material3GraphFragment.layers` typing in
[ADR 0006](./0006-material3-authoring-and-mode-contract.md).

## Context

ADR 0006 modeled the generated layer as `TokenLayer<Material3TokenKey, Mode>`. Real core instead
returns `TokenLayer<Key, string>` from `defineTokenLayer()` because an isolated layer does not own a
mode envelope; the graph does.

The phase-1 real-core probe was run with both shapes. Both preserve the exact Material token-key
union, default/additive/exact mode inference, default-mode constraints, graph spread composition,
heterogeneous layer keys, exact `selection: "all"` keys, and compiled modes. Real
`defineTokenLayer()` produces `TokenLayer<Material3TokenKey, string>` without reconstruction or a
type assertion.

The narrower layer generic adds no parity guarantee: a `TokenLayer<Key, Mode>` can still contain a
direct expression, and structural typing does not exclude additional mode keys. The fragment's
`modes` and `defaultMode`, validated through `defineTokenGraph()`, remain the mode authority.

## Decision

The public fragment uses the smallest core-truthful layer type:

```ts
interface Material3GraphFragment<Mode extends string> {
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly layers: readonly [TokenLayer<Material3TokenKey>];
}
```

The adapter must not cast or reconstruct the result of `defineTokenLayer()` to attach the graph mode
generic. Exact mode inference continues to come from the graph envelope.

## Consequences

- The public type matches the real core helper result.
- Material token keys remain finite and exact.
- Graph and compiled mode inference remain unchanged.
- The fragment does not imply that an isolated layer owns or validates a mode envelope.

## References

- [ADR 0006: Material 3 Authoring and Mode Contract](./0006-material3-authoring-and-mode-contract.md)
- [`tests/rnd/material3/type-probes/material3-api-type-probe.ts`](../../tests/rnd/material3/type-probes/material3-api-type-probe.ts)
