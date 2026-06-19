# ADR 0001: Phase 0 Contract Decisions

## Status

Accepted for Phase 0.

## Context

The package is private at version `0.0.0`, so Phase 0 can still make breaking contract decisions. The project-review
analysis is architecture direction and blocker triage, not a one-pass implementation plan. Only the section 3 blockers
are required before the first public release.

## Decisions

### Source mounting

v1 keeps Model A: `material3Source()` emits fully qualified `m3.*` tokens directly.

Plural mounted sources are deferred. The package will not introduce source fragments, namespace mounting, multiple
Material 3 instances, or source collision rules in Phase 0 unless a later v1 requirement explicitly makes plural sources
mandatory.

### Public API naming

v1 keeps Option A: the current root names remain the public names. This includes `createSchemeTokens`,
`createSourceGraph`, `compileGraph`, and `validateGraph`.

The package will not perform a broad `color*` rename for v1. New capability names may still be added later when they
describe new behavior, for example a future DTCG exporter.

### Transform hook

The recipe does not expose a public graph transform hook for v1.

The existing broad `transform` hook accepted and returned `ColorSchemeTokenGraph`, which widens any future exact-key
inference and makes returned provenance and dependency metadata untrusted until validation and compile run again. Rather
than rename that escape hatch, Phase 0 removes it from the public recipe contract. Typed plugins or other extension
points are deferred.

No `transform` compatibility alias is provided while the package remains private.

### DTCG

DTCG is exporter/importer interop only. It is not the internal schema, not the canonical serializer, and not the source of
truth for modes, visibility, references, or provenance.

Any DTCG support must live behind explicit importer or exporter APIs and must be loss-aware when the DTCG model and the
internal graph model do not represent the same information.

### Material source boundary

The package root remains generic. Material 3 stays behind the `color-scheme-tokens/sources/material3` subpath.

Core graph modules, recipe modules, layer modules, exporters, serializers, and the root export must not import Material
utilities or Material 3 adapter modules.

### Serializer boundary

`serializeTokenSet()` is the canonical internal snapshot format for deterministic compiled-token snapshots.

It is independent from DTCG and must stay stable for insertion-order-independent tests, fixture review, and release
verification. DTCG output may be added as a separate exporter, but it must not replace this serializer.

## Consequences

Phase 0 implementation can stay narrow:

- Remove the current recipe transform escape hatch from the v1 contract.
- Keep Material 3 direct `m3.*` output for v1.
- Keep existing root API names.
- Add blocker tests as precise TODOs until the graph model changes are implemented deliberately.
- Defer DTCG export, typed builders, source mounting, full provenance traces, color algebra, contrast, diffing,
  `light-dark()` output, shadcn targets, package splits, and root API renames.
