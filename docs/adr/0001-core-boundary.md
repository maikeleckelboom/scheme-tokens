# ADR 0001: Core Package Boundary

## Status

Accepted.

## Decision

`scheme-tokens` is the dependency-light core for authored string-valued token graphs, explicit references, graph modes,
ordered layers, visibility, validation, compilation, diagnostics, deterministic serialization, and CSS custom-property
projection.

The package does not interpret token strings or own palette generation, conversion, proof policy, repair policy, role
conventions, product project models, or runtime extension registries.

## Consequences

- Root imports have no optional capability engine dependency graph.
- Public authored and persisted data remains JSON-safe.
- External producers feed ordinary string tokens or strict graph artifacts.
- Compiled values remain direct mode maps once a key is known to be present. Runtime-filtered public records require
  optional access. Exact literal tuples provide definite key reads after validation; `all` does so only for finite
  authored key unions. Dynamically parsed artifacts remain partial.
- Advanced visibility, origin, dependency, and descriptive data lives under `metadataByToken`.
- Composition happens through graphs, references, and ordered layers rather than provider or plugin frameworks.

## Non-goals

- A generic structured design-token value model.
- Value parsing, transformation, or generation.
- Product-domain policy or storage models.
- Compatibility for removed unpublished APIs.
