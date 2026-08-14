# ADR 0002: Pre-release Public API Reset

## Status

Accepted.

## Context

The unpublished API had parallel token-definition forms, operation-specific success fields, implicit multimode
discovery, and helper vocabulary that obscured authority. Preserving those shapes would make the first public release
harder to learn and harder to evolve safely.

## Decision

The root runtime contains twelve operations: four trusted authoring helpers, three untrusted parsers, compilation, CSS
export, and three canonical serializers.

All fallible operations use public `Result<Value, Problem>` with the success payload under `value` and a non-empty
`issues` tuple on failure.

Token authoring has one grammar:

- a direct string or explicit reference;
- a direct explicit mode map;
- an expanded definition with required `value` and optional metadata.

`value` contains either one expression or a mode map. The separate `valueByMode` and `aliases` forms are removed.
Metadata cannot be mixed directly with mode keys.

Omitted mode options mean `base`/`base`. Providing a mode envelope requires an explicit default. The graph exclusively
owns that envelope; layers never declare modes.

Mode names reserve the reference and definition field names needed to keep object interpretation unambiguous. Token
paths may use numeric segments after their first segment.

Trusted helpers validate, normalize, and copy programmer-authored input and may throw for misuse. Parsers accept
`unknown`, do not throw for JSON-compatible input, copy accepted artifacts, and return `Result`.

Omitted and explicit public compilation expose conservatively partial token records because visibility filtering happens
at runtime. An exact literal key tuple is complete after validation. All selection is complete only for finite authored
key unions; dynamically parsed graphs remain partial, `parseCompiledScheme()` is always incomplete, and CSS export
preserves that completeness in its token lookup.

Compilation and serialization preserve arbitrary token strings. CSS export rejects declaration-unsafe strings with
`invalid-css-value` and validates selectors with an intentionally bounded safe grammar. Exact selector maps are typed to
the compiled mode union. The CSS `variableName` callback remains as an advanced contained escape hatch; declarative
options remain the primary API.

## Consequences

- The golden path is short and has no competing equivalent form.
- Persisted artifacts, parsers, serializers, and schemas share the same definition grammar.
- Bare strings remain literals and public tokens may resolve through internal tokens.
- Public-selection reads require optional access unless the caller chooses an exact literal tuple or uses `all` with a
  finite authored key union.
- Consumers must migrate named success fields to `value`, `valueByMode` to `value`, aliases to ordinary `tokenRef()`
  definitions, and untrusted compilation calls to the parse lane.
- Removed unpublished names are deleted rather than retained as aliases.
