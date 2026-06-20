# ADR 0003: Format Adapter Packages

## Status

Accepted. Planned, not implemented.

## Context

ADR 0002 defines source and conversion adapter packages. Some ecosystem work does not fit cleanly into only one of those
roles. DTCG is the motivating example: it can be imported as source material, exported from compiled schemes, and converted
through explicit mapping rules, but it is also an external file and wire format with its own naming, metadata, aliases,
and validation rules.

The core package must stay dependency-light and must not grow external format runtimes just because those formats are
important to the design-token ecosystem.

## Decision

Format adapters are separate packages that import or export external file and wire formats. Use role-first package names
such as `@scheme-tokens/format-dtcg`.

Core must not import format adapters. Format adapters may import `scheme-tokens` contracts and helpers, but core
continues to export only the root runtime surface, strict core schemas, and package metadata.

A format adapter may expose more than one kind of API when the external format is bidirectional:

- source helpers, such as a future `dtcgSource(input)`;
- conversion functions for adapter-owned intermediate work;
- exporters, such as a future `exportDtcgDocuments(compiled)`.

Do not create placeholder packages. A format adapter package exists only when it has a real implementation and release
proof.

## Contract Rules

Format adapter public inputs and outputs must be JSON-safe plain data unless a specific function is explicitly documented
as accepting a richer runtime object.

Recoverable failures use `Result` with adapter-owned issue codes and JSON Pointer paths. Format adapters must not cast
their issue codes into core issue unions.

Outputs that claim to be `TokenGraphInput`, `TokenLayerInput`, or `CompiledScheme` must validate through the matching
core parser and schema contract. Outputs that are external-format artifacts remain adapter-owned artifacts.

External format key and name rules do not change the core token-key language. Core token keys remain dot-separated
lower-kebab identifier segments. A format adapter owns strict mapping, name preservation, and diagnostics for external
names. It must not rely on core silently slugifying external names.

## DTCG Example

`@scheme-tokens/format-dtcg` is planned as the DTCG format adapter. It is not part of `scheme-tokens` 0.1.0.

The first DTCG import surface is expected to be `dtcgSource(input)`, returning source material that can enter
`buildScheme()`. The first export surface is expected to be `exportDtcgDocuments(compiled)`, taking a core
`CompiledScheme` and producing DTCG documents.

DTCG token names are external format names and may not be valid core token keys. The DTCG adapter must preserve or report
those names through adapter-owned mapping and diagnostics instead of weakening core validation.

## Consequences

- Core remains engine-free and format-runtime-free.
- External standards interoperability can evolve without widening the root package.
- Source, conversion, and format adapters can share the same package-boundary rules without requiring a registry.
- DTCG support can be planned honestly without shipping parser or exporter runtime code before the contract is ready.
