# ADR 0015: Concat Mode Disambiguation

## Status

Accepted on 2026-09-30, during P2 implementation preparation. This record supersedes only the
reserved-mode rule in [ADR 0013](./0013-coherent-token-model.md), D2 and its application in D12,
that reserves `concat`. All other decisions in ADR 0013 remain unchanged, including D5's expression
grammar and D10's deterministic, lossless source-retention guarantee.

## Context

P2 preparation found that published `scheme-tokens@0.3.0` accepts `concat` as a mode name. Both its
graph and standalone layer parsers accept a mode map whose `concat` value is a string or reference.
Reserving that name in v2 would make a valid v1 source impossible to upgrade losslessly through the
ordinary v2 validator: retaining the name would fail validation, renaming it would change the
mode contract, and refusing it would break D10.

The reproduction used the [published 0.3.0 tarball](https://registry.npmjs.org/scheme-tokens/-/scheme-tokens-0.3.0.tgz),
whose SHA-1 and SHA-512 matched [P0's frozen evidence](../../tests/oracle/published-0.3.0.json):

```text
SHA-1: 8ce57052b08bbe01536b042168a7480427a6455c
SHA-512: SqZXKq90uz3ccax4cUDKlRGzckxDJ7T/kWcPiv0gOceVIgFz92yjq6hObcRDRrt7581nqwpnB8bQQ2KXM2oCDA==
```

The published parser and compiler both returned `ok: true` for:

```json
{
  "kind": "scheme-tokens/token-graph",
  "formatVersion": 1,
  "modes": ["concat"],
  "defaultMode": "concat",
  "defaultVisibility": "public",
  "tokens": { "a": { "value": { "concat": "opaque" } } }
}
```

Its compiled result preserves `modes: ["concat"]`, `defaultMode: "concat"`, and
`tokens.a.concat: "opaque"`. The standalone v1 layer with id `example`, default visibility
`public`, and the same token record also parses successfully. P1 already has a regression for
this released mode-name behavior; the frozen 2,000-case corpus does not include this mode.

## Decision

`concat` remains a valid mode name in v2. The reserved mode names are exactly:

```text
ref
value
visibility
description
deprecated
extensions
```

`valueByMode` remains removed; the lower-kebab grammar already excludes it.

At expression/value classification time, use structural shape:

1. A string is a literal expression.
2. An exact object whose only key is `ref` is a reference-expression candidate.
3. An exact object whose only key is `concat`, with an array as that property's value, is a
   concat-expression candidate.
4. Otherwise, an object in a token-value position is a mode-map candidate.

Normal expression or mode validation follows classification. The property name `concat` alone
never establishes that a value is a concat expression. Metadata expansion remains the existing
authoring boundary; classification applies to the resulting token value.

```ts
// Direct concat expression.
({ concat: ["x", { ref: "a" }] });

// One-mode maps, each with mode name concat.
({ concat: "opaque" });
({ concat: { ref: "a" } });
({ concat: { concat: ["x", { ref: "a" }] } });

// Multi-mode map.
({ concat: "opaque", dark: "other" });
```

`{ concat: [] }` is a concat-expression candidate and fails with D5's `invalid-token-value`
because its parts are empty. It is never reinterpreted as a mode map: a raw array is not a
`TokenExpression`. Nested concat parts remain invalid.

`ref` stays reserved because `{ ref: "x" }` cannot distinguish a reference from a hypothetical
mode named `ref` with a string value. The remaining reserved fields preserve the metadata and
expanded-authoring boundary.

## Consequences

- V2 JSON Schemas allow `concat` in the mode-name grammar. Literal, reference, concat-expression,
  and mode-map alternatives remain strict and unambiguous: only concat expressions have a raw
  parts array, while mode-map values must be expressions. Unknown fields remain invalid.
- V1 graphs and layers containing mode `concat` upgrade through the same ordinary v2 validator
  as every other source. Mode names, effective order, default mode, resolved values, visibility,
  and descriptive metadata retain D10's equivalence guarantee. There is no legacy exception.
- P2 adds native-v2 tests for all five shapes above and empty-concat rejection, plus focused
  graph and standalone-layer v1 migration regressions alongside the unchanged 2,000-case oracle.
  Parse/serialize/parse must preserve the mode and canonical expressions.
- P3's static authoring discrimination must distinguish `{ concat: readonly [...] }` from
  `{ concat: TokenExpression }`; the presence of a `concat` property alone is insufficient.
  P2 exposes truthful runtime types but does not implement P3's full inference redesign.
- Existing accepted ADRs remain historical records. The implementation plan references this
  narrowly superseding decision; recording it does not complete P2 or start a later phase.

## Alternatives

Rejecting valid v1 sources with this mode would sacrifice D10 without necessity. Renaming the
mode during upgrade would change authored data and compiled output. A private exception after
upgrade would split D11's semantic authority. All three are rejected because structural
disambiguation preserves every affected contract.

## References

- [ADR 0013: Coherent Token Model](./0013-coherent-token-model.md), D2, D5, D10–D12
- [0.4 implementation plan](../../planning/0.4-implementation-plan.md)
- [Published 0.3.0 oracle](../../tests/oracle/README.md)
