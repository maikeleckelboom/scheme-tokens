# ADR 0004: Material 3 Adapter Design

## Status

Accepted for a future adapter package. This ADR does not add the adapter.

Builds on ADR 0001 (core boundary), ADR 0002 (public API reset), and ADR 0003
(the existing core authoring namespace remains authoritative). It supersedes the dependency chain in
`maikeleckelboom/material-schemes` `docs/migration-plan.md`.

## Decision

`@scheme-tokens/material3` will be a separate package that generates Material 3 role data and
returns a public `TokenLayer`. It must construct that layer through core's `defineTokenLayer()`
helper. It must not hand-roll an object that merely resembles a layer.

The dependency direction is intentional:

```text
@scheme-tokens/material3
    -> scheme-tokens
    -> no Material dependency
```

The adapter therefore has a runtime dependency on `scheme-tokens` sufficient to call
`defineTokenLayer()`. `@material/material-color-utilities` is pinned in the adapter package and must
never become a runtime, peer, or optional dependency of core.

Core remains the single grammar and validation authority. The adapter owns Material generation and
translation only. Core continues to own token graph and layer grammar, validation, references,
modes, visibility, provenance, compilation, serialization, and CSS projection.

Generated Material roles use Material's canonical `md.sys.color.*` namespace and are internal by
default. Consumers author public semantic tokens that reference those internal roles. Ordinary
public compilation returns the consumer's semantic roles while the Material plumbing stays hidden,
unless the caller explicitly selects the generated roles.

## Public surface

The conceptual entry point is:

```ts
material3(config: Material3Config, integration?: IntegrationOptions): TokenLayer
```

`Material3Config` owns generation. `IntegrationOptions` owns how the result enters the graph, such
as its layer `id` and `defaultVisibility`. Keep those concerns in separate argument positions. Do
not add a bare-string shorthand whose second argument changes meaning.

The implementation delegates final construction and normalization:

```ts
import { defineTokenLayer, type TokenLayer } from "scheme-tokens";

export function material3(/* ... */): TokenLayer {
  return defineTokenLayer({
    id: "material3",
    defaultVisibility: "internal",
    tokens: generatedTokens,
  });
}
```

This is runtime coupling in the correct direction. It prevents the adapter from duplicating core's
token-key, authoring, normalization, copying, and validation rules.

## Mode API

The final type probe accepted two explicit, mutually exclusive lanes named `modes` and
`exactModes`. They are not aliases and must not be collapsed into one option.

| Lane         | Meaning                                                                                             | Required negative constraints                                                             |
| ------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `modes`      | Normal generated modes. Appearance participates in generation rather than being inferred afterward. | `exactModes?: never`; `defaultMode` is limited to the supplied `modes` keys.              |
| `exactModes` | The caller supplies the exact output-mode-to-generated-Material relationship, including appearance. | `modes?: never`; `appearance?: never`; `defaultMode` is limited to the `exactModes` keys. |

Use overloads and deliberate negative properties to keep these categories statically
distinguishable. In particular, `appearance?: never` in the `exactModes` lane is intentional:
appearance is already part of each exact relationship, so a separate value would be redundant or
contradictory.

`defaultMode` must use `NoInfer` where necessary so it cannot widen or otherwise influence the mode
union inferred from `modes` or `exactModes`. The supplied mode keys are the authority; the default
chooses one of them.

The implementation type tests must retain the final probe's table:

- valid normal generated modes compile;
- valid exact mode mappings compile;
- `modes` and `exactModes` together fail;
- an exact mapping plus a separate `appearance` fails;
- a `defaultMode` absent from the supplied mode keys fails;
- invalid lane-specific properties fail instead of being silently normalized;
- inference preserves the literal supplied mode union.

Some invalid overload cases legitimately report TypeScript `TS2769`. Do not weaken the overloads,
add an ambiguous catch-all signature, or merge the two lanes merely to improve that diagnostic.

The adapter's `modes` option is a generation instruction, not a layer envelope declaration. The
returned `TokenLayer` still declares no graph `modes` or `defaultMode`. The consuming graph owns its
mode envelope, and `defineTokenGraph()` rejects a generated layer whose mode maps do not cover that
envelope.

## Adapter vocabulary

Keep Material vocabulary when it describes the upstream domain, but expose only stable JSON-safe
values. Do not expose `Hct`, `DynamicScheme`, `TonalPalette`, numeric `Variant` values, or any other
upstream class or object as public adapter input or output.

The first source-color representation is exactly `sourceColorHex`, containing a strict six-digit
`#rrggbb` string. Validate it at the adapter boundary before calling upstream. Malformed values must
fail with an adapter-owned diagnostic or trusted-authoring error rather than reaching Material Color
Utilities and producing surprising output.

Material variants are stable string literals such as `"monochrome"` and `"vibrant"`. The adapter
maps them internally to upstream's numeric `Variant` enum. Pin and test that table explicitly so an
upstream reordering fails loudly.

The upstream `DynamicSchemeOptions` investigation found:

```ts
interface DynamicSchemeOptions {
  sourceColorHct: Hct;
  variant: Variant;
  contrastLevel: number;
  isDark: boolean;
  platform?: Platform;
  specVersion?: SpecVersion;
  primaryPalette?: TonalPalette;
  secondaryPalette?: TonalPalette;
  tertiaryPalette?: TonalPalette;
  neutralPalette?: TonalPalette;
  neutralVariantPalette?: TonalPalette;
  errorPalette?: TonalPalette;
}
```

The adapter does not mirror this type. `sourceColorHct` and numeric `variant` cross the public
boundary as `sourceColorHex` and a string-literal variant. Palette class overrides are not part of
the initial surface. Existing JSON-safe vocabulary such as contrast level, platform, and spec
version may be added only when a fixture or real consumer justifies it.

## Role names and visibility

Material Color Utilities exposes camelCase accessors. Those are JavaScript binding names, not the
token-key contract. The adapter maps the complete supported role inventory to Material's canonical
dot-separated lower-kebab names:

```text
primary                 -> md.sys.color.primary
onPrimary               -> md.sys.color.on-primary
surfaceContainerHighest -> md.sys.color.surface-container-highest
```

All generated roles are internal by default. The mapping is a versioned adapter contract, so commit
an explicit role inventory and snapshots for every supported variant and spec version. A role rename
is a breaking adapter change.

The initial implementation should emit the complete role inventory for its supported upstream
configuration rather than curate a smaller public subset. Visibility, not omission, keeps generated
plumbing out of ordinary public compilation.

## Composition and provenance

The architecture is already supported by core:

```ts
const generated = material3(/* exact adapter config */);

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [generated],
  tokens: {
    "action-primary-bg": tokenRef("md.sys.color.primary"),
    "surface-canvas": tokenRef("md.sys.color.surface"),
  },
});
```

Public compilation returns the authored semantic roles. If an exact selection or `"all"` includes a
generated Material key, it is present under its canonical `md.sys.color.*` name.

Core provenance remains sufficient. For a public semantic role that references a generated Material
role, `metadataByToken` retains `dependenciesByMode` naming that generated key. Consumers can
therefore answer which authored roles still resolve through generated defaults without another
provenance API.

## CSS projection

The adapter does not emit CSS. Core's `exportCssVars()` remains the only CSS projection boundary.
The canonical Material namespace already composes with its default name mapping.

Acceptance requires an end-to-end assertion for a compiled selection containing the generated role:

```ts
variableByToken["md.sys.color.primary"] === "--md-sys-color-primary";
```

No adapter-specific emitter or CSS naming option is needed.

## Upstream reuse and exclusions

Useful predecessor assets remain:

| Source                             | Use                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `src/roles.ts`                     | Explicit canonical role inventory and supported-version differences.                 |
| `src/variant.ts`                   | Evidence for the pinned internal string-to-numeric variant table.                    |
| `PaletteStyle` in `src/palette.ts` | Evidence for variant-to-scheme constructor dispatch.                                 |
| `resolveContrastLevelValue`        | Input-normalization evidence if contrast level enters the supported surface.         |
| `formatTokenName`                  | The idea only; replace it with the explicit canonical role mapping and its snapshot. |

Do not carry across:

- `src/css.ts`; core owns CSS projection;
- contrast validation, contrast repair, lighten, or darken behavior;
- `MaterialTheme`, `createTheme`, or another competing theme abstraction;
- public `DynamicColorScheme`, `DynamicScheme`, `TonalPalette`, or `Hct` classes;
- a runtime plugin or source runner in core.

Material-domain generation helpers such as harmonization may remain private implementation details
only when the supported first-scope configuration needs them.

## Pinning and determinism

The investigated upstream version is `@material/material-color-utilities` `0.4.0`. Pin it exactly in
the adapter package. Generated output is versioned behavior, so an upstream math or role change must
not arrive through a floating range.

Assert the string-to-numeric variant mapping directly. Snapshot the full generated role set for each
supported variant and spec version. Run deterministic generation fixtures on at least two supported
Node versions and require byte-identical token data.

The probe found spec versions `"2021"` and `"2025"` and platforms `"phone"` and `"watch"` in
upstream `0.4.0`. It did not find `specVersion: "2026"` or `variant: "cmf"`; do not invent them.
Roles that exist only in one spec version must be handled by explicit inventory differences, not
partial mode maps that violate the graph envelope.

## Initial scope

The first adapter must prove the boundary with the smallest useful configuration. Start with
`sourceColorHex`, the supported string-literal variant set needed by the fixture, appearance through
the accepted mode lanes, and internal canonical roles. Expand contrast level, spec version, platform,
custom colors, palette reference tokens, or harmonization only when committed fixtures or real
consumers require them.

Do not promise every Material Color Utilities option in the first release. In particular, do not add
a contrast repair engine, palette-class overrides, a Material-specific CSS emitter, or public
upstream classes.

The flagship exact-mode fixture is one source color with monochrome and vibrant variants across
light and dark: four explicitly named modes whose public semantic roles reference internal
`md.sys.color.*` tokens. It exercises variant mapping, mode parity, reference resolution,
visibility, provenance, and CSS projection without expanding the first option surface.

## Acceptance criteria

1. The adapter is outside core and depends at runtime on `scheme-tokens`; core has no Material
   runtime, peer, or optional dependency.
2. The public result is `TokenLayer`, constructed through `defineTokenLayer()`.
3. Type tests preserve distinct `modes` and `exactModes` overloads, the `NoInfer` default-mode
   constraint, deliberate negative properties including `appearance?: never`, and all rejected
   combinations from the final probe.
4. The source color has one strict JSON-safe representation and malformed values fail at the adapter
   boundary.
5. No upstream class or numeric enum is reachable from the public entry point.
6. The string-to-numeric variant table is pinned and asserted against upstream.
7. A complete canonical role inventory and generated-output snapshots are committed for the supported
   configuration.
8. Generated tokens are internal by default and use `md.sys.color.*`, never upstream camelCase
   accessor names as token keys.
9. An end-to-end graph proves public semantic selection, `metadataByToken` dependencies, and explicit
   selection of generated roles.
10. Core `exportCssVars()` proves
    `variableByToken["md.sys.color.primary"] === "--md-sys-color-primary"` with no adapter emitter.
11. Generated token data is deterministic across the supported Node versions exercised by CI.
12. The initial option surface stays limited to fixture-backed or consumer-backed requirements.

## Non-goals

- No Material implementation in core.
- No CSS emission in the adapter.
- No contrast validation or repair engine.
- No generic color parsing or color model in core.
- No public upstream classes or numeric enums.
- No runtime plugin registry or source runner.
- No attempt to expose every upstream option in the first adapter version.
