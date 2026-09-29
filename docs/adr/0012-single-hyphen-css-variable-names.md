# ADR 0012: Single-Hyphen CSS Variable Names

## Status

Proposed. If accepted, this record changes the default property-name encoding of `exportCssVars()`,
a CSS exporter contract under [semver.md](../semver.md). It does not change the `variableName`
escape hatch recorded in [ADR 0002](./0002-public-api-reset.md).

## Context

The default encoder joins token-key segments with `--` and the prefix with `-`
([export-css-variables.ts:687-693](../../src/exporters/export-css-variables.ts)).
`action.primary.background` with prefix `app` becomes `--app-action--primary--background`. The
double hyphen keeps the encoding injective: a segment cannot contain `--`, so `a-b.c` and `a.b-c`
stay distinct.

The [2026-09 audit](../audit-2026-09.md) (finding 1.3) records the evidence against it as a default:

- Both known real naming configurations replace the default with `segments.join("-")`: the
  production consumer, and the material3 README, which targets the `--md-sys-color-*` names that
  Material Web consumes.
- The Tailwind guide tells readers not to do that
  ([tailwind-css-v4.md:12-15](../tailwind-css-v4.md)). The documentation contradicts itself.
- Style Dictionary (`name/kebab`), Terrazzo, Tailwind, and Material emit single hyphens. The default
  is the first thing a reader sees in the README output.
- Injectivity does not require the double hyphen. `exportCssVars()` already rejects colliding names
  with `duplicate-css-variable`, reporting `key`, `firstKey`, and `property`, instead of overwriting a
  declaration.

## Decision

The default property name is `--` followed by the optional prefix and the token-key segments, all
joined with single hyphens:

```text
action.primary.background               -> --action-primary-background
action.primary.background (prefix app)  -> --app-action-primary-background
md.sys.color.on-primary                 -> --md-sys-color-on-primary
```

Collisions among exported keys return the existing `duplicate-css-variable` issue. `variableName`
remains the escape hatch and receives the new encoding as `defaultName`. The custom-property safety
grammar is unchanged; it already accepts single-hyphen names.

## Consequences

- Conventional names work without a callback, and the material3 recipe no longer needs
  `variableName`.
- Structurally different keys can now collide, for example `a-b.c` and `a.b-c`. Export then fails
  with both keys named, and the author renames a key or supplies `variableName`. Only exported keys
  can collide.
- CSS output changes for every consumer that uses default names, so the change ships as a pre-1.0
  minor with a changeset. The production consumer uses a callback and is unaffected. The executable
  theme-coordinate example, the README, and the Tailwind guide change their expected output. Today
  only the theme-coordinate gate asserts multi-segment default names, and no test covers a
  default-encoding collision; unit tests must pin both.

## Alternatives

### Add a declarative separator option

Keep `--` and add an option such as `separator: "-"`. Rejected as the primary fix: it adds surface
and keeps an unconventional default.

### Keep the current default

Rejected. Both known real configurations opt out, and the documentation disagrees with itself.

### Escape hyphens inside segments

Encode in-segment hyphens differently, for example with `_`, to keep injectivity with single-hyphen
separators. Rejected: it produces unconventional names and adds an escaping rule for authors to
learn.

## References

- [ADR 0002: Pre-release Public API Reset](./0002-public-api-reset.md)
- [Audit 2026-09](../audit-2026-09.md)
- [Consumer evidence audit](../audit-2026-08-consumer-evidence.md), CSS variable naming evidence
