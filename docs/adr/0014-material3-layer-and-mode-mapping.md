# ADR 0014: Material 3 Layer and Graph-Mode Mapping

## Status

Proposed, for one final review of the concrete API below. It applies the layer mode sets of
[ADR 0013](./0013-coherent-token-model.md) (accepted), D12, to the Material 3 adapter. If accepted,
this record supersedes the parts of [ADR 0006](./0006-material3-authoring-and-mode-contract.md)
listed under [Supersession](#supersession) and
[ADR 0008](./0008-material3-fragment-layer-type.md) as a whole.
[ADR 0005](./0005-material3-adapter-package-boundary.md) and
[ADR 0007](./0007-material3-engine-and-role-contract.md) are unchanged.

## Context

`material3()` returns a graph fragment, `{ modes, defaultMode, layers }`, meant to be spread into
`defineTokenGraph()`. The generator therefore proposes the graph's mode envelope. That works when
Material is the whole graph and fails as soon as the application owns the modes.

The production consumer is that case. Its graph has six application-owned modes, in this order:

```text
mono-light  mono-dark  vivid-light  vivid-dark  material3-light  material3-dark
```

It generates Material with `exactModes` keyed by those six names and maps each to a generation
coordinate; the `mono-*` modes use the `monochrome` variant, the others the top-level variant
(`tonal-spot` by default, with `vibrant`, `expressive`, and `fidelity` as candidates). It passes
`material.layers` to a graph whose `modes` come from its own model, and then asserts by hand that
the fragment's mode set and default mode did not drift from the graph's. The adapter's types give
no such guarantee: ADR 0008 types the layer as `TokenLayer<Material3TokenKey>` with no mode
information, and spreading two fragments into one object silently keeps only the last `modes`,
`defaultMode`, and `layers`.

The same consumer reads Material values only in `material3-light` and `material3-dark`. The four
other columns are generated because a layer's mode maps must cover every graph mode, and nothing
reads them. Its theme-report tool separately generates plain `light` and `dark` Material output
with `exactModes: { light: {}, dark: {} }, defaultMode: "light"`, across spec versions, variants,
and contrast levels.

Material generation is not a function of two "source modes". Each value is a function of a
generation coordinate: appearance, variant, contrast level, source color, and spec version. The
existing `exactModes` map already maps graph mode names to coordinates, including the six-mode
case. What is wrong is the ownership around it, not the mapping.

## Decision

### `material3()` returns a `TokenLayer`

`material3()` returns one ordinary core `TokenLayer`. It does not return graph options, and it does
not return a graph fragment: the result has no `modes`, `defaultMode`, or `layers`, so there is
nothing to spread into a graph. A graph composes it only by listing it in its `layers` array.

The layer has the fixed id `material3`, the 48 `md.sys.color.*` keys of ADR 0007, and the default
visibility given by `visibility`. Its mode set (ADR 0013, D12) is the set of graph modes named by
`modes`. It is a requirement that core checks against the graph, never a second mode envelope:
`material3()` cannot add a mode to a graph, choose its default mode, or order its modes.

`material3()` stays a trusted helper (ADR 0006): it validates and copies its input and throws for
programmer misuse. Issues from the core helpers it calls propagate in the shape of ADR 0013, D9.

### Public API

```ts
import type { TokenLayer, TokenVisibility } from "scheme-tokens";

/** The 48 `md.sys.color.*` role keys of ADR 0007. */
export type Material3TokenKey =
  "md.sys.color.background" | /* … */ "md.sys.color.tertiary-fixed-dim";
export type Material3Appearance = "light" | "dark";
export type Material3SpecVersion = "2021" | "2025";
export type Material3Variant =
  | "monochrome"
  | "neutral"
  | "tonal-spot"
  | "vibrant"
  | "expressive"
  | "fidelity"
  | "content"
  | "rainbow"
  | "fruit-salad";

/** Generation inputs a graph mode may set; unset fields take the top-level defaults. */
export interface Material3Coordinate {
  readonly sourceColor?: string;
  readonly variant?: Material3Variant;
  readonly contrastLevel?: number;
}

/** `light` and `dark` imply their appearance; every other graph mode states it. */
type Material3ModeCoordinate<Mode extends string> = Mode extends Material3Appearance
  ? Material3Coordinate & { readonly appearance?: never }
  : Material3Coordinate & { readonly appearance: Material3Appearance };

/** One coordinate per graph mode, and at least one graph mode. */
export type Material3Modes<Mode extends string> = {
  readonly [M in Mode]: Material3ModeCoordinate<M>;
} & ([Mode] extends [never] ? { readonly "at least one graph mode": never } : unknown);

export interface Material3Options<
  Mode extends string,
  Visibility extends TokenVisibility,
> extends Material3Coordinate {
  readonly specVersion?: Material3SpecVersion;
  readonly visibility?: Visibility;
  readonly modes?: Material3Modes<Mode>;
}

export declare function material3<
  const Mode extends string = Material3Appearance,
  const Visibility extends TokenVisibility = "public",
>(
  sourceColor: string,
  options?: Material3Options<Mode, Visibility>,
): TokenLayer<
  Material3TokenKey,
  NoInfer<Mode>,
  { readonly default: NoInfer<Visibility>; readonly public: never; readonly internal: never }
>;
```

- The root exports are `material3`, `Material3TokenKey`, `Material3Appearance`,
  `Material3SpecVersion`, `Material3Variant`, `Material3Coordinate`, `Material3Modes`, and
  `Material3Options`. `Material3GraphFragment` is removed. `Material3Modes<Mode>` lets an
  application check a coordinate map declared apart from the call, as in example B.
- `modes` is exact. Its keys are graph mode names and become the layer's mode set. Omitting `modes`
  means `{ light: {}, dark: {} }`.
- The keys `light` and `dark` imply their appearance and reject a redundant `appearance`; every
  other key requires `appearance`. This is ADR 0006's appearance rule, unchanged.
- The top-level `sourceColor` argument and the `variant` and `contrastLevel` options are defaults
  that each mode may override. `specVersion` and `visibility` stay global.
- An empty `modes` object is rejected. Without the guard, TypeScript infers `Mode = never` for
  `modes: {}`, which types the layer as fitting every graph while the runtime rejects it.
- There is no string shorthand such as `"mono-light": "light"`, no `exactModes`, no additive
  `modes` merged with built-in `light` and `dark`, and no `defaultMode`.

At runtime, `material3()` checks, before generating anything: its own options, including the
appearance rule; each mode's coordinate against the capability matrix of ADR 0007, naming the graph
mode when a combination is unsupported (for example `specVersion: "2025"` with
`variant: "monochrome"`); and the mode names through core's envelope validation, so a reserved name
such as `value` fails as an invalid mode instead of turning a generated mode map into an expanded
token definition. It then builds the layer with `defineTokenLayer()`. Modes that share a coordinate
share their generated values; generating each distinct coordinate once is an implementation detail.

### Modes map to generation coordinates, not to `light` and `dark`

Every graph mode receives a complete generation coordinate: appearance, variant, contrast level,
and source color, with the spec version shared. Two graph modes with the same appearance can
therefore have different Material values, and two graph modes can share one coordinate.

A mapping such as `"mono-light": "light"` could only say that a mode takes the values of a
`light`/`dark` pair generated elsewhere. The production consumer needs more than that: its `mono-*`
modes are generated with the `monochrome` variant, whose palettes differ from the tonal-spot
palettes of `vivid-*` and `material3-*` in every role, although `mono-light`, `vivid-light`, and
`material3-light` all have the light appearance. Its theme-report tool varies the spec version,
the variant, and the contrast level per generated output. None of that is expressible as an alias
of `light` or `dark`, so the adapter keeps coordinates and has no alias form.

### Example A: a basic Material graph

```ts
import { defineTokenGraph, tokenRef } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const theme = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material3("#6750a4", { visibility: "internal" })],
  tokens: {
    // Overrides a generated role. It stays internal (ADR 0011).
    "md.sys.color.primary": { light: "#b3261e", dark: "#f2b8b5" },
    // Application aliases, public by default.
    "action.primary": tokenRef("md.sys.color.primary"),
    "surface.canvas": tokenRef("md.sys.color.surface"),
  },
});
```

The graph declares the modes, their order, and the default mode. `material3()` sees none of it.
Without `modes`, it generates the coordinates `light` and `dark`, so its layer's mode set is
`light | dark`, and core accepts the layer because that set equals the graph's. The same call in a
graph with `modes: ["dark", "light"]` is accepted too, because order belongs to the graph. The
default public compilation has exactly the keys `action.primary` and `surface.canvas`.

### Example B: the six-mode production graph

```ts
import { defineTokenGraph } from "scheme-tokens";
import { material3, type Material3Modes } from "@scheme-tokens/material3";

const compilerModes = [
  "mono-light",
  "mono-dark",
  "vivid-light",
  "vivid-dark",
  "material3-light",
  "material3-dark",
] as const;
type CompilerMode = (typeof compilerModes)[number];

// Today's `material3ExactModes`, keyed by the graph's modes.
const material3Modes = {
  "mono-light": { appearance: "light", variant: "monochrome" },
  "mono-dark": { appearance: "dark", variant: "monochrome" },
  "vivid-light": { appearance: "light" },
  "vivid-dark": { appearance: "dark" },
  "material3-light": { appearance: "light" },
  "material3-dark": { appearance: "dark" },
} as const satisfies Material3Modes<CompilerMode>;

const material = material3(material3Seed, {
  visibility: "internal",
  specVersion: "2021",
  variant, // "tonal-spot" by default; a mode that sets its own variant keeps it
  contrastLevel: 0,
  modes: material3Modes,
});

const graph = defineTokenGraph({
  modes: compilerModes,
  defaultMode: "mono-light",
  layers: [material],
  tokens,
});
```

With the default `variant`, each graph mode gets this coordinate:

| Graph mode        | Appearance | Variant      | Contrast | Source          | Spec   |
| ----------------- | ---------- | ------------ | -------- | --------------- | ------ |
| `mono-light`      | light      | `monochrome` | 0        | `material3Seed` | `2021` |
| `mono-dark`       | dark       | `monochrome` | 0        | `material3Seed` | `2021` |
| `vivid-light`     | light      | `tonal-spot` | 0        | `material3Seed` | `2021` |
| `vivid-dark`      | dark       | `tonal-spot` | 0        | `material3Seed` | `2021` |
| `material3-light` | light      | `tonal-spot` | 0        | `material3Seed` | `2021` |
| `material3-dark`  | dark       | `tonal-spot` | 0        | `material3Seed` | `2021` |

The layer's mode set is exactly `CompilerMode`, so the graph accepts it; `vivid-*` and
`material3-*` share values because they share coordinates, and `mono-*` differs from both. The
consumer still generates four columns it never reads. That is the cost of total mode maps, which
ADR 0009 keeps; the values are internal and cheap.

### Example C: composition with another layer

```ts
import { defineTokenGraph, defineTokenLayer, tokenRef } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const brand = defineTokenLayer({
  id: "brand",
  defaultVisibility: "internal",
  tokens: {
    "md.sys.color.primary": { light: "#ff0055", dark: "#ff7aa2" },
    "brand.radius": "12px",
  },
});

const theme = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material3("#6750a4", { visibility: "internal" }), brand],
  tokens: {
    "action.primary": tokenRef("md.sys.color.primary"),
    "control.radius": tokenRef("brand.radius"),
  },
});
```

Composition order is the `layers` array, then the graph's own `tokens`
([ADR 0010](./0010-graph-tokens-compose-last.md)), and nothing else. `brand` replaces the generated
`md.sys.color.primary`, the role keeps its internal visibility, and its provenance lists
`material3` then `brand`. Writing `layers: [brand, material3(…)]` would make the generated value
win instead. There is no object-spread merging: neither layer carries `modes`, `defaultMode`, or
`layers`, so nothing can be overwritten by spreading, and both layers are checked against the
graph's modes independently. Compiled with `selection: "all"`, the key union is the 48 Material
roles, `brand.radius`, `action.primary`, and `control.radius`; the default public selection has
exactly `action.primary` and `control.radius`.

### Example D: a mode mismatch

**Static.** When both mode sets are literal, `defineTokenGraph()` rejects the mismatch at compile
time, on the `layers` entry, and names both sets. The default layer in the six-mode graph, on
TypeScript 7.0.2 (visibility argument abbreviated):

```ts
defineTokenGraph({
  modes: compilerModes,
  defaultMode: "mono-light",
  layers: [material3(material3Seed)],
  tokens: {},
});
```

```text
error TS2375: Type 'TokenLayer<Material3TokenKey, Material3Appearance, {…}>' is not assignable to type
  'TokenLayer<Material3TokenKey, Material3Appearance, {…}> & LayerModeMismatch<...>' with 'exactOptionalPropertyTypes: true'. …
  Type 'TokenLayer<Material3TokenKey, Material3Appearance, {…}>' is missing the following properties from type
  'LayerModeMismatch<"dark" | "light", "material3-dark" | "material3-light" | "mono-dark" | "mono-light" | "vivid-dark" | "vivid-light">': layerModes, graphModes
```

The same error appears for a six-mode layer in a `light`/`dark` graph, and for a `light`/`dark`
layer in a `light`/`dark`/`dim` graph: equality, not inclusion. Diagnostic wording is not
contractual; the rejection is.

**Runtime.** When either set is dynamic, the type check steps aside and core checks at runtime. A
coordinate map read from configuration has the mode set `string`:

```ts
declare const configuredModes: Material3Modes<string>;
const material = material3(material3Seed, { modes: configuredModes }); // mode set: string

defineTokenGraph({ modes: compilerModes, defaultMode: "mono-light", layers: [material], tokens });
```

This typechecks. If the configured keys are `light` and `dark`, `defineTokenGraph()` throws with
one issue in its `cause`, and `parseTokenGraph()` returns the same issue for a persisted graph
whose Material layer was generated for `light` and `dark`:

```json
{
  "code": "layer-mode-mismatch",
  "message": "Layer \"material3\" has modes dark, light; the graph declares mono-light, mono-dark, vivid-light, vivid-dark, material3-light, material3-dark.",
  "path": "/layers/0",
  "layerId": "material3",
  "modes": [
    "mono-light",
    "mono-dark",
    "vivid-light",
    "vivid-dark",
    "material3-light",
    "material3-dark"
  ],
  "layerModes": ["dark", "light"]
}
```

The per-token `missing-mode-value` and `unknown-mode-value` issues that the mismatch implies are
not reported for the layer (ADR 0013, D12).

### The declared mode set is not inferred from context

The return type wraps `Mode` and the visibility in `NoInfer`. Without it, TypeScript infers `Mode`
for `material3("#6750a4")` from a contextual return type that expects a mode-bearing layer, so the
type claims modes the runtime never generates. The closing pass found the hazard with an earlier
`defineTokenGraph` variant whose `layers` constraint supplied that contextual type (ADR 0013,
Appendix A, case M6). The chosen `defineTokenGraph` signature no longer supplies it, but other
contexts do. The acceptance pass verified on TypeScript 7.0.2, 7.1-dev, and 6.0.3 that without
`NoInfer` the default `light`/`dark` layer passes as a six-mode layer in each of these, and that
with `NoInfer` all three are rejected:

```ts
// X1: an annotated variable
const material: TokenLayer<Material3TokenKey, CompilerMode> = material3("#6750a4");
// X2: a declared return type
function createMaterial(): TokenLayer<Material3TokenKey, CompilerMode> {
  return material3("#6750a4");
}
// X3: a typed layer list
const layers: readonly TokenLayer<string, CompilerMode>[] = [material3("#6750a4")];
```

`NoInfer` on the return type is therefore the boundary: `Mode` is inferred from `modes` only, or
defaults to `light | dark`.

### Typing the implementation

A concrete `defineTokenLayer()` call derives the mode set from its tokens without an assertion. The
adapter's implementation is generic in `Mode`, and TypeScript cannot evaluate the derived set for
an unresolved type parameter, so the adapter asserts its declared return type once, at the function
boundary. The adapter's type tests and core's runtime check at composition keep that assertion
honest. This reverses ADR 0008's rule against attaching a mode generic to the layer: its premise,
that an isolated layer carries no mode information, no longer holds.

### One Material layer per graph

The layer id stays `material3` and the keys stay `md.sys.color.*`. A second Material layer in one
graph would repeat the id, which core rejects as `duplicate-layer-id`, and would replace every role
of the first. A graph therefore holds at most one. Several palettes in one graph remain modes, as
in the production consumer.

### CSS and provenance come from core

Under [ADR 0012](./0012-single-hyphen-css-variable-names.md), `md.sys.color.primary` exports as
`--md-sys-color-primary` by default, the name Material Web reads. The `variableName` recipe leaves
the README. Provenance is core's compiled metadata (ADR 0013, D6): `declarations` shows `material3`
and any override, and `expressionByMode` shows which role a public alias reads.

## Supersession

If this record is accepted, it supersedes these parts of
[ADR 0006](./0006-material3-authoring-and-mode-contract.md):

| ADR 0006 section                     | Outcome                                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| One trusted authoring helper         | Kept. Its rationale for not returning `Result`, that wrapping would prevent object spread, no longer applies; the trusted-helper category does. |
| Spreadable graph fragment            | Superseded: `Material3GraphFragment`, spread composition, and its example. The fixed id and `md.sys.color.*` namespace stay.                    |
| Exact finite token-key union         | Kept. `TokenLayer<Material3TokenKey, Mode>` now carries the layer's mode set and visibility phantoms (ADR 0013, D12).                           |
| Reproduced real-core type proof      | Superseded for additive `modes`, `exactModes`, and `defaultMode`; replaced by the cases of ADR 0013, Appendix A, and this record.               |
| Heterogeneous layer-tuple proof      | Kept.                                                                                                                                           |
| Pinned default path                  | Kept, except "default mode light": the default coordinate map is `{ light: {}, dark: {} }`, and the graph chooses its default mode.             |
| Additive `modes`                     | Superseded. Built-in keys are written explicitly.                                                                                               |
| Replacing `exactModes`               | Superseded: `exactModes`, top-level `defaultMode`, their mutual exclusion, and `NoInfer` on `defaultMode`. The exact map becomes `modes`.       |
| One appearance rule                  | Kept, applied to the keys of `modes`.                                                                                                           |
| Per-mode generation coordinates      | Kept.                                                                                                                                           |
| Visibility and ordinary overrides    | `visibility` kept. The override example is superseded by graph tokens or later layers (ADRs 0010 and 0011).                                     |
| Core remains structural authority    | Two-stage validation through a fragment superseded: names through core, the layer through `defineTokenLayer()`, the fit by D12.                 |
| One Material fragment per graph      | Kept as one Material layer per graph.                                                                                                           |
| CSS compatibility remains core-owned | The `variableName` recipe and the double-hyphen premise are superseded by ADR 0012. No CSS helper in the adapter, as before.                    |
| Regeneration and provenance          | Serialization kept. `origin` and `dependenciesByMode` are superseded by `declarations` and `expressionByMode` (ADR 0013, D6).                   |

[ADR 0008](./0008-material3-fragment-layer-type.md) is superseded as a whole. Its type,
`Material3GraphFragment.layers`, no longer exists, and its rule that the adapter must not attach a
mode generic to the layer is reversed under [Typing the implementation](#typing-the-implementation).

## Consequences

### For the production consumer

- `exactModes` becomes `modes`, and `defaultMode` leaves the Material call.
- `layers: material.layers` becomes `layers: [material]`.
- The hand-written checks that the fragment's mode set and default mode match `compilerModes` are
  deleted. The type check replaces them for literal maps, and `layer-mode-mismatch` replaces them at
  runtime.
- `compileMaterial3Roles` and the theme-report tool state the graph envelope themselves, two lines
  each, instead of spreading a fragment.

The consumer becomes simpler: one fewer option, two drift checks deleted, and the graph visibly
owns its modes.

### For other callers

- The README's first example gains the two envelope lines that the fragment used to supply.
- The Material demo applications replace `defineTokenGraph({ ...material, tokens })` with an
  explicit envelope and `layers: [material]`.
- `@scheme-tokens/material3` needs a breaking release with a changeset, a new API snapshot, and its
  peer range moved to the core release of ADR 0013. Its type tests replace the fragment proofs with
  the mode-set cases of ADR 0013, Appendix A, and the cases in this record, including X1–X3 and the
  empty-map guard, on the TypeScript versions of ADR 0013, D13.

## Alternatives

### Keep returning graph options

Rejected. The generator proposes modes that the application owns, spreading composes layers by
overwriting, and mode agreement stays a hand-written check.

### Map each graph mode to `light` or `dark`

`material3(seed, { modes: { "mono-light": "light", … } })`, or a graph-level mapping that points
each graph mode at a generated `light` or `dark` column. Rejected: it cannot express the
production consumer's monochrome modes or any per-mode variant, contrast level, or source color,
and a graph-level mapping would make layers declare modes of their own and add a per-layer mapping
to the graph wire format. The generator already receives the mapping as input, so core needs no
second mapping mechanism.

### Allow a layer to cover a subset of the graph's modes

The production consumer would generate only the two modes it reads. Rejected: a token would have no
value in some modes, which breaks the one-value-per-mode invariant, and ADR 0009 rejects partial
mode maps.

### A configurable layer id

Rejected again. Two Material layers share every key, so the later one replaces the earlier one
completely.

## References

- [ADR 0005: Material 3 Adapter Package Boundary](./0005-material3-adapter-package-boundary.md)
- [ADR 0006: Material 3 Authoring and Mode Contract](./0006-material3-authoring-and-mode-contract.md)
- [ADR 0007: Material 3 Engine and Role Contract](./0007-material3-engine-and-role-contract.md)
- [ADR 0008: Material 3 Fragment Layer Type](./0008-material3-fragment-layer-type.md)
- [ADR 0009: Core Contract Convergence](./0009-core-contract-convergence.md)
- [ADR 0010: Graph Tokens Compose Last](./0010-graph-tokens-compose-last.md)
- [ADR 0011: Visibility-Preserving Overrides](./0011-visibility-preserving-overrides.md)
- [ADR 0012: Single-Hyphen CSS Variable Names](./0012-single-hyphen-css-variable-names.md)
- [ADR 0013: Coherent Token Model](./0013-coherent-token-model.md)
