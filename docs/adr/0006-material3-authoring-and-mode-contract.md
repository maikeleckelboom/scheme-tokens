# ADR 0006: Material 3 Authoring and Mode Contract

## Status

Accepted. This record supersedes the authoring, mode, visibility, composition, provenance, and CSS
portions of [ADR 0004](./0004-material3-adapter-design.md).

## Context

A Material adapter can easily grow a parallel framework of source objects, theme classes, preset
factories, override callbacks, CSS helpers, and manifests. That would obscure the existing
`scheme-tokens` authority and duplicate concepts core already defines precisely.

The smaller path is direct graph authoring: Material generation falls into ordinary core layers,
references, compilation, serialization, and CSS projection. The common call stays short while exact
token keys and graph modes remain available to TypeScript throughout the core pipeline.

## Decision

### One trusted authoring helper

The package exposes one runtime function:

```ts
material3(sourceColor, options?)
```

`material3()` is a trusted authoring helper in the same category as `defineTokenGraph()`,
`defineTokenLayer()`, and `tokenRef()`. It validates and copies its input and may throw `TypeError` or
`RangeError` for programmer misuse. It does not return `Result`; wrapping the successful value would
prevent native object spread.

Applications validate untrusted values from forms, persistence, or network data before calling the
helper or catch trusted-helper failures at their boundary.

### Spreadable graph fragment

The return value is a native graph fragment, not a theme class:

```ts
interface Material3GraphFragment<Mode extends string> {
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly layers: readonly [TokenLayer<Material3TokenKey, Mode>];
}
```

Ordinary composition is:

```ts
const material = material3("#6750a4", {
  visibility: "internal",
});

const graph = defineTokenGraph({
  ...material,
  tokens: {
    "surface.canvas": tokenRef("md.sys.color.surface"),
    "content.primary": tokenRef("md.sys.color.on-surface"),
  },
});
```

The fragment has the fixed layer ID `material3`. Material role keys use the fixed
`md.sys.color.*` namespace. Neither value is configurable.

### Exact finite token-key union

The adapter exports `Material3TokenKey` as the literal union derived from one explicit 48-role
catalog. Its layer remains:

```ts
TokenLayer<Material3TokenKey, Mode>;
```

It must never widen to `TokenLayer<string, Mode>`. Widening would destroy reference autocomplete,
typo rejection, exact compilation selections, and complete compiled token access.

### Reproduced real-core type proof

Phase 1 replaces the circular standalone probe with
`tests/rnd/material3/type-probes/material3-api-type-probe.ts`. The corrected probe imports these
contracts from the real `scheme-tokens` package:

```ts
compileTokenGraph;
defineTokenGraph;
defineTokenLayer;
tokenRef;
TokenLayer;
TokenVisibility;
```

Only the not-yet-implemented Material helper overloads and Material-owned option types are modeled
locally. The dedicated probe configuration uses strict TypeScript 6.0.3 with NodeNext resolution,
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, and
`skipLibCheck: false`.

The positive proof establishes:

- the default fragment infers `light | dark`;
- additive `modes` adds an exact custom literal;
- `exactModes` removes implicit `light | dark`;
- a valid `defaultMode` is accepted without widening the mode union;
- exact `light` and `dark` work without explicit appearance;
- custom modes work with explicit appearance;
- valid `md.sys.color.*` references pass through real core;
- the Material mode union survives `defineTokenGraph()`;
- an exact mode union survives `compileTokenGraph()`.

Negative `@ts-expect-error` cases establish:

- a misspelled Material role is rejected by real core;
- custom modes without appearance are rejected;
- redundant appearance on exact `light` and exact `dark` is rejected;
- `modes` and `exactModes` cannot coexist;
- an unknown additive `defaultMode` is rejected;
- an exact default outside the exact set is rejected.

Diagnostic wording and codes are not frozen as adapter API.

### Heterogeneous layer-tuple proof

The same probe composes the Material layer with a real second layer created by
`defineTokenLayer()`. Direct semantic tokens reference one key from each tuple member. Compilation
with `selection: "all"` proves the complete key union contains:

- every finite `Material3TokenKey`;
- the second layer's finite `brand.seed` key;
- the two graph-level semantic keys.

Typos against both layer sources are rejected.

This proof exposed a core conditional-type defect: the original private `LayerKeyOf` conditional did
not distribute across heterogeneous tuple members. Phase 1 corrects it through a distributive
`LayerMemberKey` helper and adds a non-Material core regression case. Runtime behavior is unchanged;
the public type contract now matches core's existing multi-layer runtime semantics.

### Pinned default path

For v1:

```ts
material3("#6750a4");
```

means:

```text
source color     #6750a4
variant          tonal-spot
spec version     2021
contrast level   0
platform         phone, internal and not configurable
modes            light, dark
default mode     light
visibility       public
```

These are frozen adapter defaults for the pinned engine, not a claim about Google's newest design
recommendation. Explicit consumer intent must never be silently ignored, clamped, or downgraded.

### Additive `modes`

The built-in envelope contains `light` and `dark`. `modes` patches either built-in and may add exact
custom modes:

```ts
material3("#6750a4", {
  modes: {
    dark: { variant: "expressive" },
    "light-high": {
      appearance: "light",
      contrastLevel: 1,
    },
  },
  defaultMode: "light-high",
});
```

The resulting union is `light | dark | light-high`.

### Replacing `exactModes`

`exactModes` replaces the complete mode set:

```ts
material3("#6750a4", {
  exactModes: {
    standard: { appearance: "light" },
    inverse: { appearance: "dark" },
  },
  defaultMode: "standard",
});
```

Only `standard` and `inverse` exist. No implicit `light` or `dark` is added. `modes` and
`exactModes` are mutually exclusive at both type and runtime boundaries.

`defaultMode` is top-level:

- additive authoring may omit it and defaults to `light`;
- exact authoring must provide it because the consumer owns the entire envelope.

`NoInfer` lets `defaultMode` select from the resolved union without inventing or widening that
union.

### One appearance rule

The exact key `light` implies Material light appearance. The exact key `dark` implies Material dark
appearance. Supplying `appearance` on either exact key is redundant and rejected.

Every other key requires explicit `appearance: "light" | "dark"`. The adapter never infers from
prefixes or suffixes such as `light-high`, `dark-brand`, `standard`, or `inverse`. The same rule is
used for `modes`, `exactModes`, runtime validation, documentation, and type tests.

### Per-mode generation coordinates

Top-level source, variant, and contrast values are defaults. A mode may override:

- `sourceColor`;
- `variant`;
- `contrastLevel`;
- appearance where the exact mode key does not imply it.

Per-mode source-color changes are deliberate. The adapter does not enforce cross-mode brand,
palette, or pairing coherence; that is application policy. `specVersion` and visibility remain
global in v1.

### Visibility and ordinary overrides

Optional `visibility` maps to the generated layer's `defaultVisibility` and defaults to `public`,
matching core authoring. Consumers choose `internal` when Material roles are implementation sources
for public semantic tokens.

There is no Material override callback. Consumers add an ordinary later layer:

```ts
const overrides = defineTokenLayer({
  id: "brand-overrides",
  tokens: {
    "md.sys.color.primary": "#ff0055",
  },
});

const graph = defineTokenGraph({
  ...material,
  layers: [...material.layers, overrides],
  tokens: {
    "action.primary.background": tokenRef("md.sys.color.primary"),
  },
});
```

Core's later-layer-wins rule remains the only override model.

### Core remains structural authority

After Material-specific input validation, the adapter validates through core in two stages:

1. validate and canonicalize `defineTokenGraph({ modes, defaultMode, tokens: {} })`;
2. generate mode maps, construct the layer with `defineTokenLayer()`, and validate the complete
   fragment through a second `defineTokenGraph()` call.

The first graph has no layers; the implementation must not assume `.layers` exists there.

Validating the envelope first ensures a reserved mode such as `value` fails as an invalid mode
instead of making a generated mode map look like an expanded token definition. Core remains the
single authority for valid/reserved modes, default membership, canonical ordering, layer IDs,
token-key grammar, complete mode maps, graph/layer parity, normalization, and input copying.

### One Material fragment per graph

A graph intentionally accepts at most one Material 3 generation fragment because the adapter uses
a fixed `material3` layer ID. This is a deliberate adapter contract, not a limitation of
`scheme-tokens` core. Multiple Material palettes or brands within one graph are modeled through
modes; otherwise consumers use separate graphs.

Two fragments would create duplicate layer IDs, which core correctly rejects. Configurable layer
IDs, namespaces, and multiple generated Material layers are not added to evade that invariant.

### CSS compatibility remains core-owned

Logical keys retain Material vocabulary:

```text
md.sys.color.primary
```

Core's generic collision-safe default encodes dot boundaries as double hyphens:

```text
--md--sys--color--primary
```

Material Web expects:

```text
--md-sys-color-primary
```

Consumers use the existing core hook immediately after basic composition:

```ts
const exported = exportCssVars(compiled, {
  variableName: ({ segments }) => `--${segments.join("-")}`,
});
```

The packed adapter consumer must assert:

```ts
exported.value.variableByToken["md.sys.color.primary"] === "--md-sys-color-primary";
```

The adapter exports no CSS helper and core gains no Material-specific naming option.

### Regeneration and provenance

Generated output remains normal core data and is serializable through `serializeTokenLayer()`. A
canonical generated layer may be committed so configuration, adapter, and engine changes produce a
normal reviewable Git diff. There is no Material serializer or CLI in v1.

After compilation:

- `metadataByToken[key].origin` answers which layer owns the winning definition, distinguishing
  `material3` from a later `brand-overrides` layer;
- `metadataByToken[key].dependenciesByMode` answers which direct token reference a semantic token
  uses in each mode.

`dependenciesByMode` is a direct dependency edge, not complete transitive lineage.

## Consequences

- Common authoring is one call and one object spread.
- Exact modes and keys survive through real core without another theme abstraction.
- Consumers customize through layers and references instead of adapter callbacks.
- The fixed identity makes provenance simple and deliberately limits each graph to one fragment.
- Runtime validation stays strict because upstream accepts or normalizes values outside the adapter
  contract.

## Rejected alternatives

- `Result` return: rejected because it prevents native spread for trusted authoring.
- mandatory explicit built-in mode entries: rejected as redundant.
- appearance inference from naming conventions: rejected because graph mode identifiers are
  application-owned.
- a second mode builder: rejected because one progressively disclosed helper is sufficient.
- Material-specific override, profile, serializer, CLI, or CSS options: rejected because core owns
  those concerns.

## References

- [ADR 0004: Material 3 Adapter Design](./0004-material3-adapter-design.md)
- [ADR 0005: Material 3 Adapter Package Boundary](./0005-material3-adapter-package-boundary.md)
- [ADR 0007: Material 3 Engine and Role Contract](./0007-material3-engine-and-role-contract.md)
