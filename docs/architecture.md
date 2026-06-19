# Architecture

color-scheme-tokens is a graph-first package. The public center is `ColorSchemeTokenGraph`, not a Material wrapper and
not a product-specific theme object.

## Model

The package is split into three boundaries:

1. Generic color token graph core.
2. Generic recipe pipeline.
3. Explicit source adapters, currently including the Material 3 adapter.

Source adapters produce graphs. They do not define token nodes, modes, aliases, validation, compilation, layers,
deterministic serialization, or CSS export.

## Pipeline

```text
source adapter
  -> source-emitted graph
  -> optional token layers
  -> optional aliases
  -> validated/compiled token set
  -> exporter projection
```

Source adapters create graph nodes with stable token keys, modes, authored color token values, aliases, and provenance.
Token layers are reusable graph additions and may add aliases or authored color tokens. Recipe `aliases` are sugar for
simple alias nodes. The compiler validates the graph, resolves aliases, and unwraps color token values into concrete
color values. Exporters consume compiled token sets only.

## Boundaries

- The graph core is source-agnostic.
- The recipe pipeline is source-agnostic.
- Material 3 Dynamic Color is one explicit source adapter at `color-scheme-tokens/sources/material3`.
- The Material 3 adapter emits `m3.*` keys. That namespace is adapter-emitted token data, not mandatory graph structure.
- Consumer/application namespaces should be owned by the consumer, such as `app.*` or `brand.*`.
- Material 3 `keyColors` and `algorithm` options are adapter concerns. `specVersion`, `platform`, `variant`, and
  `contrastLevel` do not belong to generic recipe options.
- ARGB is an adapter implementation detail for Material 3 generation or an explicit low-level interop concern. Public
  authoring uses plain color inputs such as hex strings; constructors such as `hex()` and `srgb255()` are low-level
  helpers.
- The Material 3 adapter is backed by `@material/material-color-utilities` internally. Upstream types and Material
  utility wrappers are not public root API.
- Graph types, validation, compilation, layers, serialization, and CSS export remain generic.
- Token layers may add generic app or brand aliases; bundled layers must not quietly assume a source-emitted namespace.
- Color token nodes store `ModeValues<ColorTokenValue>`. v0 supports only literal color values, and compiled color values
  remain concrete `ColorValue` objects.
- `serializeTokenSet()` is the canonical internal deterministic snapshot format. It is independent from DTCG; dedicated
  interop exporters are deferred.
- Material Dynamic Color algorithm changes are package-level events because upstream generation changes can alter compiled
  token output; the upstream package is pinned exactly and fixtures are expected to catch drift.
- `tests/fixtures/material3-purple.token-set.snapshot.json` is byte-for-byte serialized Material 3 adapter output and is
  intentionally not formatter-owned.
- Exporters do not validate graphs, resolve aliases, or mutate token sets.
- Lab proof tooling remains external future work and is not package doctrine.

## Current Slice

The root package exposes generic behavior: key parsing, mode parsing, color constructors, literal color values,
`createSourceGraph()` source materialization, graph validation, compilation, deterministic serialization, CSS variable
export, generic layer types, and the `createSchemeTokens()` recipe.

The Material 3 subpath exposes `material3Source()` and Material 3 source option/problem types. The adapter defaults are
spec version `2021`, platform `phone`, contrast level `0`, and variant `tonalSpot`. It emits the reconciled role
inventory as `m3.*` keys: 55 required roles and four optional dim roles when the upstream adapter provides them
symmetrically.
