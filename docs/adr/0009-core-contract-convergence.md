# ADR 0009: Core Contract Convergence

## Status

Accepted.

## Context

The core contract is approaching its 1.0 stability review. The
[consumer evidence audit](../audit-2026-08-consumer-evidence.md) measured the production-shaped
graph, exercised the released package in its known consumer, and tested the remaining authoring
hypotheses. The measurements are retained in that audit rather than repeated here. The
[roadmap](../roadmap.md) turns the resulting decisions into 0.3 and 1.0 evidence gates.

The convergence work found one small public-type trap worth correcting before 1.0: exact CSS
selector maps already own each complete selector, but the previous options interface also allowed a
separate `scope` in TypeScript even though runtime validation rejected the combination. The same
review found no evidence that broader mode, layer, diagnostic, or inspection APIs would improve the
compact compiler contract.

## Decision

### Core boundary and authoring paths

Core remains an embedded, string-valued design-token graph compiler with zero runtime dependencies.
Token values remain opaque strings or explicit references. Resolver or DTCG semantics, DTCG export,
platform exporters, a CLI, structured token values, plugin registries, and design-system product
policy remain outside core.

`defineTokens()` remains the simple trusted authoring path. `defineTokenGraph()` remains the full
trusted composition path for explicit graph options and layers.

The graph exclusively owns `modes` and `defaultMode`. A standalone layer remains
`TokenLayer<Key, string>` because it has no mode envelope of its own. Direct layer expressions
broadcast across every mode in the owning graph. Explicit standalone layer mode maps remain
unbound until composition and are then validated against the graph's complete mode envelope.

### Composition and declaration replacement

Graph tokens compose first. Layers apply afterward in array order. A later declaration for an
existing key replaces the complete earlier declaration; it is not a metadata patch. Visibility,
description, deprecation, and extensions do not implicitly merge from a shadowed declaration.
Provenance identifies the winning declaration.

References are validated and resolved against the complete composed graph. This permits an earlier
graph declaration to reference a key supplied by a later composition position without changing
the precedence rule.

The measured consumer evidence rejects mode-set and default-plus-overrides helpers for the current
contract. It also provides no justification for partial-layer semantics, partial persisted mode
maps, metadata merging, or another layer-authoring helper.

### Results, diagnostics, and selection

`Result` remains binary: a success contains `value`, and a failure contains a non-empty `issues`
tuple. Compiler failures remain separate from advisory analysis. The package does not add
`formatIssues()`, `unwrap()`, warning or severity channels, or inspection APIs. No name or symbol is
reserved for a hypothetical future inspection API.

Exact literal-key selection remains the path to complete exact output typing after runtime
validation. Runtime-filtered public selection and dynamically parsed artifacts remain
conservatively partial.

### CSS options correction

Exact selector maps and a separate `scope` are now an invalid TypeScript combination. Runtime
`invalid-scope` defense remains for untyped, fabricated, or mutated input. Making
`ExportCssVarsOptions` a union rather than the previous interface-shaped contract is an intentional
pre-1.0 correction; it is not a new exporter capability.

### Pre-1.0 ownership and optional composition

The packaged schemas retain their existing `$id` values. Ownership of the
`https://scheme-tokens.dev/schemas/` namespace remains unresolved and must be addressed deliberately
before 1.0 if possible, without changing identifiers as part of this convergence decision.

`@scheme-tokens/material3` remains an optional sibling package outside core. Its packed-consumer
gates explicitly demonstrate compatibility with both the 0.2 and 0.3 core release lines.

## Consequences

- The 0.3 release narrows one invalid CSS option state without broadening runtime capability.
- Layer mode authority, precedence, whole-declaration replacement, reference resolution, and
  provenance remain one coherent composition model.
- Existing concrete issue unions are sufficient for application-local formatting and throwing
  policy.
- New authoring, diagnostic, or inspection surface requires materially new consumer evidence rather
  than hypothetical convenience.
- Schema namespace ownership remains a visible 1.0 evidence gate, not a hidden migration in 0.3.

## Rejected expansions

- Mode-set, default-plus-overrides, or mode-bound authoring helpers.
- Mode-bound layer helpers, partial layer patches, partial persisted mode maps, or metadata merging.
- Package-owned issue formatting, unwrapping, warning, severity, or inspection APIs.
- Resolver, DTCG export, CLI, platform-exporter, structured-value, plugin, or product-policy scope in
  core.

## References

- [ADR 0001: Core Package Boundary](./0001-core-boundary.md)
- [ADR 0002: Pre-release Public API Reset](./0002-public-api-reset.md)
- [ADR 0008: Material 3 Fragment Layer Type](./0008-material3-fragment-layer-type.md)
- [Consumer evidence audit](../audit-2026-08-consumer-evidence.md)
- [Roadmap](../roadmap.md)
