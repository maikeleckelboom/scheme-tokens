# Architecture

color-scheme-tokens is a graph-first package. The public center is `ColorSchemeTokenGraph`, not a dynamic-color wrapper
and not a product-specific theme object.

## Pipeline

```text
scheme source input
  -> scheme source graph
  -> profile graph
  -> compiled token set
  -> exporter projection
```

Scheme sources create graph nodes with stable token keys, modes, concrete color values, aliases, and provenance.
Profiles add aliases that map scheme roles into app-facing tokens. The compiler validates the graph and resolves aliases
into a compiled token set. Exporters consume compiled token sets only.

## Boundaries

- Dynamic color is the first intended source, but dynamic color does not define the package identity.
- Scheme role keys use `scheme.*`.
- Profiles may add generic app aliases such as `app.surface`; they must not introduce project-specific semantics.
- Color token nodes store concrete `ColorValue` objects. `ColorIntent` is deferred from v0.
- `serializeTokenSet()` is the deterministic JSON/snapshot primitive. A dedicated JSON token exporter is deferred.
- Exporters do not validate graphs, resolve aliases, or mutate token sets.
- Lab proof tooling remains external future work and is not package doctrine.

## Current Initial Slice

The initial repository exposes only implemented root behavior: key parsing, mode parsing, color constructors, graph
creation, graph validation, compilation, deterministic serialization, and CSS variable export. The dynamic-color source
adapter is scaffolded internally and deliberately not root-exported until it can be wired without exposing legacy
wrapper APIs.
