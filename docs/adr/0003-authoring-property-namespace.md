# ADR 0003: Authoring Property Namespace

## Status

Rejected. The published authoring grammar accepted in ADR 0002 remains authoritative.

## Decision

Core trusted authoring continues to use the existing expanded-definition properties:

```text
value
visibility
description
deprecated
extensions
```

Core will not replace them with `$value`, `$description`, or other `$`-prefixed equivalents, and it
will not add a second equivalent authoring grammar.

The current grammar is coherent, already published, and has no demonstrated core defect. The
ergonomic gain from a `$` namespace is modest, while changing it would create avoidable API churn.
DTCG Resolver and Modifier concepts do not require trusted TypeScript authoring in this compiler to
adopt DTCG's property namespace. DTCG interoperability belongs at adapter, import, and export
boundaries, where external vocabulary can be translated into the existing core grammar.

Reserved mode names remain a deliberate part of that grammar. Adapters must handle collisions at
their boundaries rather than reopening the core authoring model.

## Context

ADR 0002 states, as part of the pre-release API reset:

> Token authoring has one grammar: a direct string or explicit reference; a direct explicit mode
> map; an expanded definition with required `value` and optional metadata. [...] Metadata cannot be
> mixed directly with mode keys.

and

> Mode names reserve the reference and definition field names needed to keep object interpretation
> unambiguous.

Both hold in the shipped code. Verified against `dev` at `639392c`.

`normalizeAuthoringDefinition` (`src/core/graph.ts:484`) dispatches all or nothing. If any key
belongs to `tokenDefinitionKeys` (`graph.ts:219`, holding `value`, `visibility`, `description`,
`deprecated`, `extensions`)
the object is an expanded definition, and `rejectUnknownAuthoringKeys` throws on every other key.
Otherwise it is a mode map.

```ts
// mode map
background: { light: "#ffffff", dark: "#111111" }

// expanded definition
foreground: {
  value: { light: "#111111", dark: "#ffffff" },
  description: "Default text",
}

// mixed, throws
foreground: { light: "#111111", dark: "#ffffff", description: "Default text" }
// RangeError: defineTokens token "foreground" definition contains unknown property "dark"
```

`reservedModeKeys` (`graph.ts:227`) is a guard inside the mode-map branch. It is not what separates
the two shapes. The separation is structural and deliberate, exactly as 0002 describes.

Earlier documentation claimed `{ visibility: "public", light: "#fff", dark: "#000" }` was supported.
It never was, and it throws the same way. That claim was part of the doc drift corrected during
0.1.0 release hardening.

## The question

Should the expanded form be replaced by a collapsed one, where modes and metadata are siblings?

```ts
foreground: {
  light: "#111111",
  dark: "#ffffff",
  $description: "Default text",
}
```

## Investigated alternative

ADR 0002 forbade mixing because mixing was ambiguous. The reserved-name set is the mechanism that
kept object interpretation unambiguous under that constraint.

A `$` prefix removes the ambiguity by construction rather than by reservation. Token keys are
dot-separated lower-kebab segments, so `$` falls outside the mode-name language entirely. Mode names
and property names become disjoint namespaces. No reserved set, no future collision, and new
properties stay additive permanently.

This matters most where 0002 could not have anticipated it. A DTCG adapter will want to align with
`$type`, `$description`, `$deprecated`, `$extensions`. Under the current model each of those is a
name that must enter the reserved set, and reserving a name a consumer already used as a mode breaks
them silently.

This is not a claim that 0002 was wrong. It is a claim that a mechanism exists which satisfies
0002's unambiguity requirement without its separation constraint.

## What 0002 still binds

> The golden path is short and has no competing equivalent form.

This forbids adding the collapsed form alongside the expanded one. If this is adopted, the collapsed
form replaces the expanded form. Two accepted shapes for one intent is exactly what the reset
removed.

## Scope this forces

If metadata takes `$`, `value` must too. `{ value: "#fff", $description: "..." }` is incoherent. The
consistent form is DTCG's:

```ts
brand: { $value: "#6750a4", $description: "Brand source" }
```

Two options:

1. **Helper only.** Authoring uses `$`, the strict wire format keeps `value`. No `formatVersion`
   change, no schema rewrite, no JSON Pointer contract break. Authored and persisted shapes differ,
   but they already do, because helper shorthand is deliberately not in the wire format.
2. **All the way.** The wire format adopts `$value`. This is `formatVersion: 2`, three schema
   rewrites, and a pointer contract break, the same cost class as the mode-axes change rejected in
   `application-theme-coordinates.md`.

Option 1 unless there is a reason beyond consistency.

## Honest weighing

The ergonomic gain is modest. It only affects tokens carrying both modes and metadata. Pure mode
maps are already flat, and tokens generated by an adapter never take this path because they are
produced programmatically. In practice this touches the hand-written semantic layer, perhaps half of
it.

The durable value is the namespace guarantee, not the ergonomics. It is insurance against a
collision class that has not occurred. Nobody adopts the package because of it.

The proposal argued that version 0.1.0 was the cheapest time to change the namespace. The package is
now published and the existing grammar is consumer-visible, which strengthens the churn cost rather
than demonstrating a defect that would justify it.

## DTCG consideration

DTCG 2025.10 specifies resolvers and modifiers for theming contexts. Those concepts do not require
this compiler's trusted TypeScript authoring to copy DTCG's property namespace. A future DTCG
adapter can translate its external vocabulary into explicit core modes, references, and token
definitions without changing the core grammar.

Note also that ADR 0001 lists "a generic structured design-token value model" as a non-goal, while
DTCG 2025.10 uses structured colors. Any DTCG adapter must flatten those to strings at its boundary.
That constraint is independent of this ADR but bears on the same alignment question.

## Consequences of the rejected alternative

- One authoring grammar remains, as 0002 requires. The expanded form is removed, not supplemented.
- Property names align one-to-one with DTCG, simplifying a future adapter.
- New token properties can be added indefinitely without reserving names.
- Consumers migrate `value` to `$value` and metadata keys to `$`-prefixed equivalents.
- ADR 0002's "metadata cannot be mixed directly with mode keys" is superseded, with its unambiguity
  requirement satisfied by a different mechanism.

## Consequences

- The current two-shape separation stands. It is coherent and has no defect.
- `value`, `visibility`, `description`, `deprecated`, and `extensions` remain the only expanded
  authoring properties.
- No compatibility alias or parallel `$`-prefixed grammar is introduced.
- External adapters translate their vocabulary into the core grammar and validate reserved-name
  collisions deliberately at their boundary.
- Any future proposal to add a reserved core property must still treat the mode-name impact as a
  public-contract decision.
