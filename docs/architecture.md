# Architecture

color-scheme-tokens is a graph-first package. The public center is `ColorSchemeTokenGraph`, not a dynamic-color wrapper
and not a product-specific theme object.

## Pipeline

```text
source adapter
  -> source-emitted graph
  -> optional token layers
  -> optional aliases
  -> optional graph transform
  -> validated/compiled token set
  -> exporter projection
```

Source adapters create graph nodes with stable token keys, modes, authored color intents, aliases, and provenance.
Token layers are reusable graph additions and may add aliases or authored color tokens. Recipe `aliases` are sugar for
simple alias nodes. The singular recipe `transform` provides a narrow programmatic graph hook after layers and aliases
and before compile/export. The compiler validates the graph, resolves aliases, and unwraps color intents into concrete
color values. Exporters consume compiled token sets only.

## Boundaries

- Dynamic color is the first intended source, but dynamic color does not define the package identity.
- The dynamic source emits `scheme.*` keys. That namespace is source-emitted token data, not mandatory graph structure.
- The dynamic source is backed by `@material/material-color-utilities` internally; the backing package is a source
  implementation detail. Upstream types and Material-branded wrappers are not public runtime API, and graph types,
  validation, compilation, layers, the transform hook, serialization, and CSS export remain generic.
- Token layers may add generic app aliases such as `chrome.background` and `semantic.action.background`; they must not
  introduce project-specific semantics.
- Color token nodes store `ModeValues<ColorIntent>`. v0 supports only solid color intents, and compiled color values
  remain concrete `ColorValue` objects.
- `serializeTokenSet()` is the deterministic JSON/snapshot primitive. A dedicated JSON token exporter is deferred.
- Dynamic color algorithm changes are package-level events because upstream generation changes can alter compiled token
  output; the upstream package is pinned exactly and fixtures are expected to catch drift.
- `tests/fixtures/dynamic-purple.token-set.snapshot.json` is byte-for-byte serialized output and is intentionally not
  formatter-owned.
- Exporters do not validate graphs, resolve aliases, or mutate token sets.
- Lab proof tooling remains external future work and is not package doctrine.

## Current Slice

The repository exposes only implemented root behavior: key parsing, mode parsing, color constructors, solid color
intents, source-backed graph creation, graph validation, compilation, deterministic serialization, CSS variable export,
the dynamic scheme source, the app surface layer, and the `createSchemeTokens()` recipe.

Dynamic source defaults are spec version `2021`, platform `phone`, contrast level `0`, and variant `tonal`. The source
emits the reconciled role inventory as `scheme.*` keys: 55 required roles and four optional dim roles when the upstream
adapter provides them symmetrically.
