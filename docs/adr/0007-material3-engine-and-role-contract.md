# ADR 0007: Material 3 Engine and Role Contract

## Status

Accepted, with the phase-1 engine evidence reproduced. This record supersedes the engine, role,
capability, and fixture portions of [ADR 0004](./0004-material3-adapter-design.md).

## Context

Material Color Utilities exposes a broader and less uniform surface than the adapter should publish:

- deprecated static fields coexist with current instance methods;
- palette key colors sit beside system roles;
- four bare `*Dim` methods expose incoherent pre-2025 behavior;
- five variants silently fall back from requested 2025 behavior to effective 2021;
- phone and watch generation are materially different concerns;
- upstream accepts broader color and contrast inputs than the adapter contract;
- the engine role surface is not identical to current `md.sys.color` token deprecation policy.

The adapter therefore defines and executes an explicit contract instead of reflecting engine
properties or passing upstream options through.

## Decision

### Exact engine and execution boundary

The first adapter release is backed by exactly:

```text
@material/material-color-utilities@0.4.0
```

The dependency is an exact pin. The installed npm package and its observable runtime behavior are
the engine authority. The R&D runner reads the installed manifest and fails before execution unless
the version is `0.4.0`.

The published package's extensionless internal ESM imports fail under raw Node. The repository
bundles the exact installed package into a temporary probe module with esbuild 0.28.1, executes that
module, and discards the bundle. No patched engine source or bundled probe artifact is committed.
This exercises the same packaging workaround the future adapter distribution requires.

An engine upgrade is an intentional adapter contract change and must not arrive through semver-range
drift.

### Current instance API only

The engine boundary constructs `new MaterialDynamicColors()` and calls named instance methods. It
never reads the deprecated static role fields. The explicit role table maps engine method names to
logical keys:

```ts
{
  engineMethod: "onPrimaryContainer",
  tokenKey: "md.sys.color.on-primary-container",
}
```

The future implementation uses this table as the authority for role reads and `Material3TokenKey`.
Reflection is used only by the R&D exhaustiveness gate to detect upstream surface drift.

Each accepted role is resolved from a selected scheme and must produce canonical lowercase
`#[0-9a-f]{6}`. Missing, undefined, throwing, or noncanonical roles are engine-contract failures;
roles are never conditionally omitted.

### Accepted 48-role contract

The adapter emits exactly these Material system color tokens:

```text
md.sys.color.background
md.sys.color.on-background
md.sys.color.surface
md.sys.color.surface-dim
md.sys.color.surface-bright
md.sys.color.surface-container-lowest
md.sys.color.surface-container-low
md.sys.color.surface-container
md.sys.color.surface-container-high
md.sys.color.surface-container-highest
md.sys.color.on-surface
md.sys.color.surface-variant
md.sys.color.on-surface-variant
md.sys.color.inverse-surface
md.sys.color.inverse-on-surface
md.sys.color.outline
md.sys.color.outline-variant
md.sys.color.shadow
md.sys.color.scrim
md.sys.color.primary
md.sys.color.on-primary
md.sys.color.primary-container
md.sys.color.on-primary-container
md.sys.color.inverse-primary
md.sys.color.secondary
md.sys.color.on-secondary
md.sys.color.secondary-container
md.sys.color.on-secondary-container
md.sys.color.tertiary
md.sys.color.on-tertiary
md.sys.color.tertiary-container
md.sys.color.on-tertiary-container
md.sys.color.error
md.sys.color.on-error
md.sys.color.error-container
md.sys.color.on-error-container
md.sys.color.primary-fixed
md.sys.color.primary-fixed-dim
md.sys.color.on-primary-fixed
md.sys.color.on-primary-fixed-variant
md.sys.color.secondary-fixed
md.sys.color.secondary-fixed-dim
md.sys.color.on-secondary-fixed
md.sys.color.on-secondary-fixed-variant
md.sys.color.tertiary-fixed
md.sys.color.tertiary-fixed-dim
md.sys.color.on-tertiary-fixed
md.sys.color.on-tertiary-fixed-variant
```

### Exhaustive engine-role classification

The exact installed instance prototype exposes 60 methods relevant to this decision:

```text
48 accepted system roles
11 excluded role methods
 1 helper outside the role set: highestSurface
60 instance methods total
```

The 59 role methods are classified exactly once. The executable gate asserts no accepted/excluded
overlap, no unknown prototype method, no unclassified role, and no missing expected method.

The 11 exclusions are:

| Engine method                   | Classification           | Rationale                                                                        |
| ------------------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| `primaryPaletteKeyColor`        | palette key              | Main-palette data, not an `md.sys.color` system role.                            |
| `secondaryPaletteKeyColor`      | palette key              | Main-palette data, not an `md.sys.color` system role.                            |
| `tertiaryPaletteKeyColor`       | palette key              | Main-palette data, not an `md.sys.color` system role.                            |
| `neutralPaletteKeyColor`        | palette key              | Main-palette data, not an `md.sys.color` system role.                            |
| `neutralVariantPaletteKeyColor` | palette key              | Main-palette data, not an `md.sys.color` system role.                            |
| `errorPaletteKeyColor`          | palette key              | Main-palette data, not an `md.sys.color` system role.                            |
| `primaryDim`                    | incoherent pre-2025 role | Newer role definition resolves through older spec mathematics.                   |
| `secondaryDim`                  | incoherent pre-2025 role | Newer role definition resolves through older spec mathematics.                   |
| `tertiaryDim`                   | incoherent pre-2025 role | Newer role definition resolves through older spec mathematics.                   |
| `errorDim`                      | incoherent pre-2025 role | Newer role definition resolves through older spec mathematics.                   |
| `surfaceTint`                   | deprecated system token  | Current `md.sys.color` token authority deprecates it in favor of tonal surfaces. |

Bare `*Dim` exclusion does not use a substring rule. `surfaceDim`, `surfaceBright`,
`primaryFixedDim`, `secondaryFixedDim`, and `tertiaryFixedDim` remain accepted and are asserted by
name.

`background` and `onBackground` remain accepted. Current guidance describes background as legacy
and prefers surface, but does not mark it deprecated; legacy guidance is not equivalent to
deprecation.

### Supported generation controls

V1 accepts:

- one inherited source color with optional per-mode source overrides;
- spec version `2021` or `2025`;
- nine named variants;
- finite contrast in inclusive `[-1, 1]`, including intermediate values;
- light or dark appearance;
- phone generation only.

The platform is fixed internally to `phone`. Watch generation changes both behavior and relevant
role policy and is not a v1 value switch.

### Strict source and contrast input

Source colors accept exactly:

```text
#[0-9a-fA-F]{6}
```

Uppercase digits are accepted and canonicalized to lowercase. Missing `#`, shorthand, eight-digit
input, surrounding whitespace, alpha forms, CSS functions, and other representations are rejected
before the engine.

MCU `argbFromHex()` is not the validator: it accepts three-, six-, and eight-digit forms and treats
the eight-digit form as AARRGGBB, which can silently reinterpret CSS-style RRGGBBAA input.

Contrast must be a number, finite, and within inclusive `[-1, 1]`. `NaN`, infinities, and values
outside the range are rejected rather than clamped.

### Capability matrix and silent-fallback rejection

Requested 2021 supports all nine variants. Requested 2025 is supported only when the pinned engine
preserves the requested spec:

| Variant     | Requested-2025 effective spec | Compared role values | Different | Adapter policy         |
| ----------- | ----------------------------: | -------------------: | --------: | ---------------------- |
| monochrome  |                          2021 |                3,776 |         0 | reject silent fallback |
| neutral     |                          2025 |                3,776 |     3,326 | support                |
| tonal-spot  |                          2025 |                3,776 |     3,214 | support                |
| vibrant     |                          2025 |                3,776 |     3,333 | support                |
| expressive  |                          2025 |                3,776 |     3,369 | support                |
| fidelity    |                          2021 |                3,776 |         0 | reject silent fallback |
| content     |                          2021 |                3,776 |         0 | reject silent fallback |
| rainbow     |                          2021 |                3,776 |         0 | reject silent fallback |
| fruit-salad |                          2021 |                3,776 |         0 | reject silent fallback |

These repository-owned measurements cover:

```text
8 seeds
× 2 appearances
× 4 contrast levels (-1, 0, 0.5, 1)
× 59 classified role methods
× 9 variants
= 33,984 requested-2021/requested-2025 role comparisons
```

The eight seeds are `#6750a4`, `#006a60`, `#b3261e`, `#ffbf00`, `#0095a8`, `#777777`,
`#8a8c2a`, and `#009489`. Every coordinate is phone-only. The evidence persists per-role counts and
per-coordinate effective specs and hashes without making exact comparison counts public adapter
API.

The independently reported shape is reproduced exactly: monochrome, fidelity, content, rainbow,
and fruit-salad are effective-2021 and value-identical; neutral, tonal-spot, vibrant, and expressive
remain effective-2025 and differ by thousands of role values.

The public adapter contract remains binary: a resolved mode is supported or rejected. There is no
runtime fallback or tri-state capability object.

### HCT branch boundaries and hard-path certification

The broad machine evidence asserts the pinned predicate boundaries:

```text
Hct.isYellow: hue >= 105 and hue < 125
Hct.isCyan:   hue >= 170 and hue < 207
```

Boundary probes immediately below, at, immediately below the upper limit, and at the upper limit
must yield `false, true, true, false`.

Hard golden seeds are certified from actual derived engine palette state before fixture generation:

| Path   | Coordinate                                     |     Derived palette hue in light and dark | Assertion                    |
| ------ | ---------------------------------------------- | ----------------------------------------: | ---------------------------- |
| yellow | `#8a8c2a`, 2025, expressive, contrast 1, phone | `neutralPalette.hue = 112.26236398709452` | `Hct.isYellow(...) === true` |
| cyan   | `#009489`, 2025, expressive, contrast 1, phone | `primaryPalette.hue = 187.66649302382956` | `Hct.isCyan(...) === true`   |

This is derived-branch evidence, not an inference from source hue. A future engine that changes
palette derivation and misses either predicate makes generation fail loudly. No `isBlue` fixture is
added because pinned 2025 behavior does not currently require that predicate.

### Four primary golden vectors

The human-review set is exactly:

| Vector          | Coordinate                                     | What it certifies                                                                 |
| --------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| baseline        | `#6750a4`, 2021, tonal-spot, contrast 0, phone | Stable recovered pinned-engine baseline across light and dark.                    |
| spec transition | `#6750a4`, 2025, tonal-spot, contrast 0, phone | Isolates the spec change; exactly 87 of 96 values differ from baseline.           |
| hard yellow     | `#8a8c2a`, 2025, expressive, contrast 1, phone | Non-default variant, maximum contrast, and derived yellow neutral-palette branch. |
| hard cyan       | `#009489`, 2025, expressive, contrast 1, phone | Non-default variant, maximum contrast, and derived cyan primary-palette branch.   |

Each fixture contains 48 sorted token keys, complete light/dark maps, lowercase opaque hex values,
and stable engine/configuration provenance. Regeneration is deterministic and normal validation
compares new output byte-for-byte with the committed files.

The repository-generated baseline is byte-identical to the recovered primary R&D vector. The three
new vectors are byte-identical to the independently generated secondary crosschecks. Those external
files are not committed and are not repository source of truth.

### Engine upgrade law

An engine upgrade is isolated from unrelated refactoring and includes:

1. the exact dependency change;
2. updated upstream notice and provenance;
3. successful execution against the installed package;
4. reviewed capability-matrix changes;
5. reviewed role-surface changes;
6. reviewed golden-vector diffs;
7. packed-consumer proof;
8. a changeset explaining observable capability or output changes.

If a future engine repairs the bare-dim incoherence, changes deprecations, or supports new specs or
platforms, that evidence enables a new decision; it does not automatically widen this contract.

## Consequences

- Consumers receive a finite coherent Material system-role set rather than engine reflection.
- Deprecated static APIs and deprecated system tokens do not become adapter obligations.
- Explicit 2025 intent cannot be silently downgraded.
- Engine upgrades produce inspectable data instead of unobserved theme drift.
- Watch, palettes, custom colors, and future specs remain separable decisions.

## Rejected alternatives

- publish all 59 role methods: rejected because palette keys, bare dims, and `surfaceTint` do not
  belong to the accepted system-role contract;
- make bare dims optional: rejected because that models no coherent capability in the pinned engine;
- accept effective-2021 fallback as requested 2025: rejected because explicit intent must not be
  silently weakened;
- infer capability from one seed or one aggregate vector: rejected because coincidence can occur per
  seed and per role;
- contract private upstream delegates or source line numbers: rejected because pinned version,
  public symbols, observable behavior, and committed fixtures are the durable evidence.

## References

- [ADR 0005: Material 3 Adapter Package Boundary](./0005-material3-adapter-package-boundary.md)
- [ADR 0006: Material 3 Authoring and Mode Contract](./0006-material3-authoring-and-mode-contract.md)
- [`tests/rnd/material3/material3-contract.ts`](../../tests/rnd/material3/material3-contract.ts)
- [`tests/rnd/material3/fixtures/material3-0.4.0-capability-matrix.json`](../../tests/rnd/material3/fixtures/material3-0.4.0-capability-matrix.json)
