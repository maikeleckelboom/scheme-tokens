# Architecture

color-scheme-tokens is a graph-first package. The public center is `ColorSchemeTokenGraph`, not a dynamic-color wrapper
and not a product-specific theme object.

## Pipeline

```text
scheme source input
  -> scheme source graph
  -> optional token layers
  -> optional graph transforms
  -> validated/compiled token set
  -> exporter projection
```

Scheme sources create graph nodes with stable token keys, modes, authored color intents, aliases, and provenance.
Token layers map scheme roles into app-facing aliases and may add authored color tokens. Graph transforms provide a
narrow programmatic customization hook before compile/export. The compiler validates the graph, resolves aliases, and
unwraps color intents into concrete color values. Exporters consume compiled token sets only.

## Boundaries

- Dynamic color is the first intended source, but dynamic color does not define the package identity.
- Scheme role keys use `scheme.*`.
- The dynamic source is backed by `@material/material-color-utilities` internally; upstream types and Material-branded
  wrappers are not public runtime API.
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
