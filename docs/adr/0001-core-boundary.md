# ADR 0001: Core Package Boundary

## Status

Accepted.

## Decision

`scheme-tokens` is the dependency-light core package for authored token graphs, compiled scheme artifacts, diagnostics, deterministic serialization, and CSS variable export.

The root package does not own engine-backed behavior. It does not import or depend on Material 3, color conversion libraries, image extraction, browser canvas, or vendor-specific generators.

## Consequences

- Root imports stay engine-free.
- Public authoring data stays JSON-safe.
- External generators feed ordinary authored tokens or strict token graphs.
- The root package does not expose source, plugin, provider, preset, or registry APIs.
- Compiled token reads stay direct: `scheme.tokens.background.base`.
- Advanced metadata lives outside token value maps under `metadataByToken`.

## Non-Goals

- Material implementation.
- Palette generation.
- Color parsing or conversion.
- Engine package architecture.
- Migration compatibility for removed pre-release APIs.
