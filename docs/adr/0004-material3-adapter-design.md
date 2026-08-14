# ADR 0004: Material 3 Adapter Design

## Status

Proposed.

Builds on ADR 0001 (core boundary). Constrained by ADR 0002 (public API reset). The authored layer
shape depends on ADR 0003. Supersedes the dependency chain in `maikeleckelboom/material-schemes`
`docs/migration-plan.md`.

## Decision

`@scheme-tokens/material3` generates Material 3 roles and returns a plain `TokenLayerInput`. It is
data, not a runner. Core stays unchanged.

Generated roles land as internal tokens under Material's own canonical names. The consumer authors
their own semantic roles in the graph and references the generated keys. Public compilation emits
only the semantic roles. The Material role set is plumbing.

## Vocabulary alignment

The audience for this adapter is people who already know Material 3. That decides the shape of both
sides, in opposite directions.

**Input aligns with `material-color-utilities` on names and semantics.** Every renamed concept is a
translation the consumer has to perform, and it makes Google's own documentation unusable as a
reference. Keep upstream naming even where it is awkward. `contrastLevel` as a float from -1 to 1 is
odd, but it is upstream's oddity and not ours to fix.

**Input deviates from upstream on representation, deliberately.** Upstream's `DynamicSchemeOptions`
is verified as:

```ts
interface DynamicSchemeOptions {
  sourceColorHct: Hct;
  variant: Variant; // numeric enum: MONOCHROME = 0 … FRUIT_SALAD = 8
  contrastLevel: number;
  isDark: boolean;
  platform?: Platform; // 'phone' | 'watch'
  specVersion?: SpecVersion; // '2021' | '2025'
  primaryPalette?: TonalPalette;
  secondaryPalette?: TonalPalette;
  tertiaryPalette?: TonalPalette;
  neutralPalette?: TonalPalette;
  neutralVariantPalette?: TonalPalette;
  errorPalette?: TonalPalette;
}
```

Two of those cannot be mirrored, and forcing them would be wrong rather than faithful:

| Upstream                                             | Adapter                                   | Why                                                                                                                                                                                                                                                            |
| ---------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sourceColorHct: Hct`                                | `sourceColorHex: string`                  | `Hct` is a class instance. ADR 0001 requires public authored data to stay JSON-safe, and accepting `Hct` would force every consumer to import upstream. The name differs from `sourceColorHct` on purpose, so the deviation is visible rather than surprising. |
| `variant: Variant`                                   | `variant: "monochrome" \| "vibrant" \| …` | The enum is numeric. Persisting `3` in a config is opaque, not JSON-meaningful, and directly exposed to upstream reordering. A string union is stable, readable, and the numeric mapping becomes an internal pinned table.                                     |
| `contrastLevel`, `isDark`, `platform`, `specVersion` | identical                                 | JSON-safe already. Mirror exactly.                                                                                                                                                                                                                             |

`primaryPalette` and the other palette overrides are deliberately not exposed. The layer model is
the override mechanism, and two competing ones would be worse than either.

**Output deliberately does not align.** Reproducing a `Theme` object with `schemes.light`,
`schemes.dark`, `palettes`, and `customColors` is the wrapper this adapter exists to not be. The
output is a `TokenLayerInput`.

This also settles what the adapter's documentation owns: configuration follows upstream, so point at
Google's documentation for what variants and contrast levels mean. What this package documents is
the output and the two deviations above.

## Why the layer shape

ADR 0001 already licenses it:

> External producers feed ordinary string tokens or strict graph artifacts.

The predecessor repository prescribed the same direction:

```
public graph/compiler API
  -> dynamicSchemeSource
    -> private upstream adapter
      -> @material/material-color-utilities
```

with the rule that reusing role extraction, contrast normalisation, and palette-style mapping is
fine, but keeping those wrappers publicly visible is not.

One part of that plan is stale. It assumed a `TokenSource` with a callable `build()`, run by
`buildScheme()`. ADR 0002 removed both, and `check-api.ts` now fails the build if the bundle
contains the string `material3`. What remains is `defineTokenGraph({ layers })`, which accepts plain
layer data.

That is a better boundary than the plan anticipated. The adapter implements no core contract, calls
no core function, and depends on `scheme-tokens` for types only. Zero runtime coupling.

## Verified working today

Run against `dev` at `639392c`, with no core changes.

```ts
const generated = defineTokenLayer({
  id: "material3",
  defaultVisibility: "internal",
  tokens: {
    "md.sys.color.primary": { light: "#6750a4", dark: "#d0bcff" },
    "md.sys.color.surface": { light: "#fffbfe", dark: "#141218" },
  },
});

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [generated],
  tokens: {
    "action-primary-bg": { ref: "md.sys.color.primary" },
    "surface-canvas": { ref: "md.sys.color.surface" },
  },
});

compileTokenGraph(graph);
```

Public compilation returns exactly two tokens, `action-primary-bg` and `surface-canvas`. The
Material keys appear only under `selection: "all"`.

Provenance arrives where ADR 0001 says it lives, under `metadataByToken`:

```json
"action-primary-bg": {
  "visibility": "public",
  "origin": { "kind": "graph" },
  "dependenciesByMode": {
    "light": ["md.sys.color.primary"],
    "dark":  ["md.sys.color.primary"]
  }
}
```

This is what makes "which of my roles still resolve to generated defaults" answerable, and it needs
no new core API.

## Proposed surface

```ts
material3(config: Material3Config, integration?: IntegrationOptions): TokenLayerInput
```

`Material3Config` owns generation and uses upstream vocabulary. `IntegrationOptions` owns how the
result enters a graph (`id`, `defaultVisibility`, `prefix`). Keep them in separate argument
positions. ADR 0002 removed an overload matrix for exactly this reason, so do not reintroduce one:
no bare-string shorthand whose second argument changes meaning.

Mode coordinates are flattened by the caller, per `application-theme-coordinates.md`:

```ts
material3({
  sourceColorHex: "#6750a4",
  modes: {
    "mono-light": { variant: "monochrome", isDark: false },
    "mono-dark": { variant: "monochrome", isDark: true },
    "vivid-light": { variant: "vibrant", isDark: false },
    "vivid-dark": { variant: "vibrant", isDark: true },
  },
});
```

**`modes` here is a generation instruction, not an envelope declaration.** ADR 0002 is explicit:

> The graph exclusively owns that envelope; layers never declare modes.

Verified: `defineTokenLayer({ modes: [...] })` is rejected with `unknown property "modes"`. The
caller declares the envelope on the graph. If the layer's emitted mode names do not cover it,
`defineTokenGraph()` throws at construction rather than producing a compile issue, which is correct
per ADR 0002's rule that trusted helpers may throw for programmer misuse:

```
defineTokenGraph token "m.a" mode map is missing mode "sepia"
```

Document the combinatorial ceiling before someone hits it. Variant times dark times three contrast
levels is thirty hand-written mode names. Two by two is comfortable. It does not stay comfortable.

## Key naming restores the specification

Material Color Utilities emits camelCase (`onPrimaryContainer`, `surfaceContainerHighest`). That is
the JavaScript API idiom, not Material's naming. The specification's own canonical token names are
already dot-separated lower-kebab:

```
onPrimaryContainer      -> md.sys.color.on-primary-container
surfaceContainerHighest -> md.sys.color.surface-container-highest
```

So the adapter is not translating into a private convention. It is restoring Material's naming from
the JS binding's deviation, and that naming happens to be exactly the core key language. This is why
`md.sys.color.*` and not `material3.*`.

The mapping is the only thing consumers build against. It needs a committed snapshot of the full
role set per spec version, and a rename is a breaking change.

## Emit the complete role set

All roles are emitted, all `internal` by default. No curation.

Visibility makes this free: the Material roles never reach public output unless the consumer
references them. Emitting a chosen subset only removes options from someone who knows the
specification better than the adapter author does.

Upstream at 0.4.0 exposes roughly sixty accessors, including the six palette key colors
(`primaryPaletteKeyColor` and siblings) and the four dim roles. The role inventory from the
predecessor is therefore not a curation list. It is the record of which roles exist per spec
version, which is what makes parity checking and snapshot testing possible.

## What comes across from material-schemes

| Source                             | Use                                                                                                                                                                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/roles.ts`                     | The role inventory. Six palette key colors, roughly fifty required roles, four optional dim roles, default palette tones, supported spec versions and platforms. Hand-curated and tedious to reconstruct correctly. Highest value in the repository. |
| `src/variant.ts`                   | The numeric `Variant` enum matching upstream ordering. Becomes the internal string-to-number table.                                                                                                                                                  |
| `PaletteStyle` in `src/palette.ts` | The name to scheme-constructor dispatch table, which is the source of the public string union.                                                                                                                                                       |
| `resolveContrastLevelValue`        | Contrast level input normalisation.                                                                                                                                                                                                                  |
| `formatTokenName`                  | The idea only. The mapping above replaces the implementation.                                                                                                                                                                                        |

`harmonize` and `fixIfDisliked` are genuine Material domain and may stay internal as generation
options.

## What does not come across

- `src/css.ts`. Core owns CSS export. A second emitter is the duplication this architecture exists
  to prevent.
- The computational half of `src/contrast.ts`. Contrast ratios, contrast colors, lighten and darken
  belong to a contrast package. ADR 0001 places proof and repair policy outside core, and they do
  not belong in a generation adapter either.
- `src/theme.ts`. `MaterialTheme` and `createTheme` are a competing theme concept. The graph is the
  theme.
- `DynamicColorScheme` as a public class. Four hundred and twenty-nine lines and fourteen public
  fields. The adapter is a function that returns data.

## Pinning and drift

`@material/material-color-utilities` is at `0.4.0`, published 2026-01-21. Pin it exactly, not with a
caret. Generated output is a versioned artifact, so an upstream change to variant math changes the
adapter's output and is a breaking change downstream.

Snapshot the full generated role set per variant and per spec version. Assert the string-to-numeric
`Variant` mapping explicitly rather than trusting the upstream enum to keep its values. That
assertion is the reason the public API takes strings.

Supported spec versions are `'2021'` and `'2025'`, verified in `color_spec.d.ts`. Platform is
`'phone' | 'watch'`. CMF is not supported. Earlier drifted documentation referenced
`specVersion: "2026"` and `variant: "cmf"`, which do not exist in 0.4.0. Do not carry those forward.

## Role parity and spec versions

The dim roles (`primaryDim`, `secondaryDim`, `tertiaryDim`, `errorDim`) are emitted only for spec
versions that expose them. Core requires every token to define every declared mode.

Generating all modes from one spec version is consistent. Mixing spec versions across modes produces
a mode map that does not cover the declared envelope, which `defineTokenGraph()` rejects. That is
the helper catching a real mistake, not a limitation to configure away. Document it as intended
behaviour.

## Non-goals

- No CSS emission.
- No contrast validation or repair.
- No color space conversion beyond ARGB integer to `#rrggbb`.
- No theme, palette preview, or runtime style injection concept.
- No dependency on a color package. The adapter emits opaque strings and needs nothing else.
- **No re-export of upstream classes.** `DynamicScheme`, `TonalPalette`, and `Hct` stay internal.
  Making them public is the legacy wrapper surface the migration plan forbade, and it imports ADR
  0001's non-goals through the back door. Alignment is about vocabulary, not surface area.

## Acceptance

1. The adapter imports no runtime value from `scheme-tokens`, only types. Assert in a boundary test.
2. A full role-set snapshot per variant and spec version, committed.
3. The camelCase to specification-name mapping is snapshot tested across the complete role
   inventory.
4. The string-to-numeric `Variant` table is asserted against upstream, so an upstream reordering
   fails loudly rather than silently changing output.
5. Generated output is byte-identical across two Node versions.
6. The end-to-end case compiles: generated layer plus authored semantic graph, public selection
   returns only the authored roles, `metadataByToken` names the generated dependencies.
7. A layer that declares modes is rejected, per ADR 0002. Verified as current behaviour.
8. A mode map that does not cover the graph envelope throws at `defineTokenGraph()`.
9. No upstream class is reachable from the public entry point.
10. Config is JSON-serialisable end to end, per ADR 0001.

## First fixture

Use the monochrome and vibrant variant pair across light and dark as the flagship test. Four modes,
two variants, one source color, semantic roles referencing `md.sys.color.*`.

This is the same design problem worked through for `maikel.site` (one system, two expressions, the
monochrome one canonical), generated rather than authored. It exercises multi-variant composition,
mode parity, reference resolution, and provenance in a single graph, against a design question that
was thought through independently of this package.

## Scope discipline

The adapter has no consumer yet, so the usual pressure that keeps option surfaces small is absent.
Every upstream capability will feel like it should be supported because upstream supports it.

Ship `sourceColorHex`, `variant`, and `isDark` first. Add `contrastLevel`, `specVersion`,
`platform`, and custom colors only when the fixture or a real consumer demands them. Custom color
groups fit the model well, each producing `md.sys.color.<name>`, `on-<name>`, `<name>-container`,
and `on-<name>-container`, but they are not needed to prove the architecture.

## Open questions

**Tonal palettes as tokens.** `md.ref.palette.*` is Material's own reference layer, not something
this adapter would invent, and ADR 0002 permits the keys mechanically: "Token paths may use numeric
segments after their first segment", so `md.ref.palette.primary.40` is valid. Under the alignment
principle above, including them is the consistent answer. Six palettes times eighteen tones is one
hundred and eight additional internal tokens, which argues for an opt-in flag rather than exclusion.
Decide before first release, since adding it later is additive but removing it is not.

**Alpha.** Material roles are opaque, so `#rrggbb` should be correct. Confirm against the upstream
ARGB output before fixing the format.

**Authoring shape.** If ADR 0003 is accepted, the layer's token definitions take `$` prefixed
properties, which changes the adapter's emitted shape. Sequence 0003 first or accept a follow-up
change here.

**Scope ownership.** `@scheme-tokens` on npm must be claimed before the first adapter publish. The
predecessor's public documentation already names the scope.
