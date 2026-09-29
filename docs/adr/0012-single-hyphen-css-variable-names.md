# ADR 0012: Single-Hyphen CSS Variable Names

## Status

Proposed, as a decision slice of [ADR 0013](./0013-coherent-token-model.md), whose CSS activation
model (D7) uses these names. If accepted, this record changes the default property-name encoding of
`exportCssVars()`, a CSS exporter contract under [semver.md](../semver.md). The `variableName`
escape hatch recorded in [ADR 0002](./0002-public-api-reset.md) stays.

## Context

The default encoder joins token-key segments with `--` and the prefix with `-`
([export-css-variables.ts:687-693](../../src/exporters/export-css-variables.ts)).
`action.primary.background` with prefix `app` becomes `--app-action--primary--background`. The
double hyphen keeps the encoding injective: a segment cannot contain `--`, so `a-b.c` and `a.b-c`
stay distinct.

The [2026-09 audit](../audit-2026-09.md) (finding 1.3) records the evidence against it as a default:

- Both known real naming configurations replace the default with `segments.join("-")`: the
  production consumer, which writes `--color-*` names, and the material3 README, which targets the
  `--md-sys-color-*` names that Material Web consumes.
- The Tailwind guide tells readers not to do that
  ([tailwind-css-v4.md:12-15](../tailwind-css-v4.md)). The documentation contradicts itself.
- Style Dictionary (`name/kebab`), Terrazzo, Tailwind, and Material emit single hyphens. The default
  is the first thing a reader sees in the README output.
- Injectivity does not require the double hyphen. `exportCssVars()` already rejects colliding names
  with `duplicate-css-variable` instead of overwriting a declaration.

## Decision

The contract has four parts.

1. **Readable names by default.** The default property name is `--`, followed by the optional
   prefix and a hyphen, followed by the token-key segments joined with single hyphens:

   ```text
   action.primary.background               -> --action-primary-background
   action.primary.background (prefix app)  -> --app-action-primary-background
   md.sys.color.on-primary                 -> --md-sys-color-on-primary
   ```

2. **Deterministic encoding.** The name depends only on the token key and the prefix. It does not
   depend on selection, mode, declaration order, or locale.

3. **Hard collision detection.** Every emitted name is checked before any CSS is produced. Every
   collision is reported, not only the first. Each `duplicate-css-variable` issue carries both
   token keys (`firstKey` in code-unit order and `key`) and the shared name (`property`), and its
   message names all three:

   ```text
   Tokens "a-b.c" and "a.b-c" both map to the CSS variable --a-b-c.
   ```

4. **A naming function for genuine exceptions.** `variableName` receives the token key, its
   segments, the prefix, and the default name, and may return any safe custom-property name. Its
   results go through the same safety and collision checks.

The custom-property safety grammar is unchanged; it already accepts single-hyphen names.

## Consequences

- Conventional names work without a callback. The production consumer can replace its callback
  with `prefix: "color"`, and the material3 recipe no longer needs `variableName`.
- Structurally different keys can now collide, for example `a-b.c` and `a.b-c`. Export then fails
  with both keys and the name, and the author renames a key or supplies `variableName`. Only
  exported keys can collide, so internal keys that stay out of the output never block an export.
- CSS output changes for every consumer that uses default names, so the change ships with a
  changeset in the breaking release of ADR 0013. The production consumer uses a callback and is
  unaffected. The executable theme-coordinate example, the README, and the Tailwind guide change
  their expected output. Today only the theme-coordinate gate asserts multi-segment default names,
  and no test covers a default-encoding collision; unit tests must pin both, including the message.

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
- [ADR 0013: Coherent Token Model](./0013-coherent-token-model.md)
- [Audit 2026-09](../audit-2026-09.md)
- [Consumer evidence audit](../audit-2026-08-consumer-evidence.md), CSS variable naming evidence
