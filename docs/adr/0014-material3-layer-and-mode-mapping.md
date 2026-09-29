# ADR 0014: Material 3 Layer and Graph-Mode Mapping

## Status

Proposed, together with [ADR 0013](./0013-coherent-token-model.md), whose layer mode sets (D12) it
applies to the Material 3 adapter. If accepted, this record supersedes:

- in [ADR 0006](./0006-material3-authoring-and-mode-contract.md): the spreadable graph fragment,
  additive `modes`, replacing `exactModes`, the top-level `defaultMode`, the override example,
  two-stage validation through a fragment, the CSS naming hook, and the provenance fields it names;
- [ADR 0008](./0008-material3-fragment-layer-type.md) as a whole, because the fragment type it
  corrects no longer exists.

The accepted role catalogue, engine pin, appearance rule, generation coordinates, fixed layer id,
and fixed `md.sys.color.*` namespace are unchanged
([ADR 0006](./0006-material3-authoring-and-mode-contract.md),
[ADR 0007](./0007-material3-engine-and-role-contract.md)).

## Context

`material3()` returns a graph fragment, `{ modes, defaultMode, layers }`, meant to be spread into
`defineTokenGraph()`. The generator therefore proposes the graph's mode envelope. That works when
Material is the whole graph and fails as soon as the application owns the modes.

The production consumer is that case. Its graph has six application-owned modes, in this order:

```text
mono-light  mono-dark  vivid-light  vivid-dark  material3-light  material3-dark
```

It generates Material with `exactModes` keyed by those six names, maps each to a generation
coordinate (the `mono-*` modes use the `monochrome` variant), passes `material.layers` to a graph
whose `modes` come from its own model, and then asserts by hand that the fragment's mode set and
default mode did not drift from the graph's. The adapter's types give no such guarantee: ADR 0008
types the layer as `TokenLayer<Material3TokenKey>` with no mode information, and spreading two
fragments into one object silently keeps only the last `modes`, `defaultMode`, and `layers`.

The same consumer reads Material values only in `material3-light` and `material3-dark`. The four
other columns are generated because a layer's mode maps must cover every graph mode, and nothing
reads them. Its theme-report tool separately generates plain `light` and `dark` Material output
with `exactModes: { light: {}, dark: {} }, defaultMode: "light"`.

Material generation is not a function of two "source modes". Each value is a function of a
generation coordinate: appearance, variant, contrast level, source color, and spec version. The
existing `exactModes` map already maps graph mode names to coordinates, including the six-mode
case. What is wrong is the ownership around it, not the mapping.

## Decision

### `material3()` returns one layer

```ts
function material3(
  sourceColor: string,
  options?: Material3Options,
): TokenLayer<
  Material3TokenKey,
  Mode, // the graph modes named by `options.modes`, `light | dark` by default
  { default: Visibility; public: never; internal: never }
>;
```

The result is an ordinary core layer with the fixed id `material3`. It never proposes graph modes
or a default mode; the graph declares them. A graph composes it like any other layer:

```ts
const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material3("#6750a4", { visibility: "internal" })],
  tokens: {
    "md.sys.color.primary": { light: "#b3261e", dark: "#f2b8b5" }, // stays internal (ADR 0011)
    "action.primary": tokenRef("md.sys.color.primary"),
  },
});
```

Overrides are ordinary graph tokens or later layers ([ADR 0010](./0010-graph-tokens-compose-last.md)),
and they keep the role's visibility ([ADR 0011](./0011-visibility-preserving-overrides.md)).

### `modes` maps graph modes to generation coordinates

`modes` is exact. Its keys are graph mode names and become the layer's mode set (ADR 0013, D12).
Each value is a generation coordinate:

```ts
material3(seed, {
  visibility: "internal",
  specVersion: "2021",
  contrastLevel: 0,
  variant: "tonal-spot",
  modes: {
    "mono-light": { appearance: "light", variant: "monochrome" },
    "mono-dark": { appearance: "dark", variant: "monochrome" },
    "vivid-light": { appearance: "light" },
    "vivid-dark": { appearance: "dark" },
    "material3-light": { appearance: "light" },
    "material3-dark": { appearance: "dark" },
  },
});
```

- Omitting `modes` means `{ light: {}, dark: {} }`.
- The keys `light` and `dark` imply their appearance and reject a redundant `appearance`; every
  other key requires `appearance`. This is ADR 0006's appearance rule, unchanged.
- Top-level `sourceColor`, `variant`, and `contrastLevel` are defaults that a mode may override;
  `specVersion` and `visibility` stay global.
- Mode names follow core's mode-name rules. The adapter validates them through core before it
  generates anything, so a reserved name such as `value` fails as an invalid mode instead of
  turning a generated mode map into an expanded token definition.
- Modes that share a coordinate share their generated values. Generating each distinct coordinate
  once is an implementation detail.

There is no string shorthand such as `"mono-light": "light"`. It would be a second form of
`{ appearance: "light" }` and could not express the per-mode variant that the production consumer
uses.

Removed from the adapter: `exactModes`, additive `modes` (built-in `light` and `dark` merged with
extra modes), `defaultMode`, and the `Material3GraphFragment` type. The additive form is replaced by
writing the built-in keys:

```ts
material3("#6750a4", {
  modes: {
    light: {},
    dark: { variant: "expressive" },
    "light-high": { appearance: "light", contrastLevel: 1 },
  },
});
```

### Compatibility with the graph is core's check

The layer's mode set must equal the graph's mode set (ADR 0013, D12):

- with literal options, `defineTokenGraph()` rejects a mismatch at compile time and names both sets:
  `… is missing the following properties from type 'LayerModeMismatch<"light" | "dark", "mono-light" | "mono-dark" | "vivid-light" | "vivid-dark" | "material3-light" | "material3-dark">'`;
- at runtime, every graph helper and parser reports one `layer-mode-mismatch` issue for the layer,
  with its `layerId`, the graph's `modes`, and the `layerModes`;
- when either mode set is dynamic, only the runtime check applies.

The mode order is the graph's. A layer has a mode set, not an order, so `modes: ["dark", "light"]`
composes the default layer unchanged.

### The declared mode set is not inferred from context

The return type wraps `Mode` and the visibility in `NoInfer`. Without it, TypeScript infers `Mode`
for `material3("#6750a4")` written inline in a six-mode graph's `layers` from the contextual return
type, so the type claims six modes while the runtime generates `light` and `dark`. The type
prototype showed exactly that before the fix, on every version from 5.4 to 7.1-dev (ADR 0013,
Appendix A, case M6).

### Typing the implementation

A concrete `defineTokenLayer()` call derives the mode set from its tokens without an assertion. The
adapter's implementation is generic in `Mode`, and TypeScript cannot evaluate the derived set for
an unresolved type parameter, so the adapter asserts its declared return type once, at the function
boundary. The adapter's type tests and core's runtime check at composition keep that assertion
honest. This replaces ADR 0008's rule against attaching a mode generic to the layer: its premise,
that an isolated layer carries no mode information, no longer holds.

### One Material layer per graph

The layer id stays `material3` and the keys stay `md.sys.color.*`. A second Material layer in one
graph would repeat the id and replace every role of the first, so a graph still holds at most one.
Several palettes in one graph remain modes, as in the production consumer.

### CSS and provenance come from core

Under [ADR 0012](./0012-single-hyphen-css-variable-names.md), `md.sys.color.primary` exports as
`--md-sys-color-primary` by default, the name Material Web reads. The `variableName` recipe leaves
the README. Provenance is core's compiled metadata (ADR 0013, D6): `declarations` shows `material3`
and any override, and `expressionByMode` shows which role a public alias reads.

## Consequences

### For the production consumer

```ts
const material = material3(seed, {
  visibility: "internal",
  specVersion: "2021",
  contrastLevel: 0,
  variant,
  modes: material3Modes, // today's `material3ExactModes`, keyed by CompilerMode
});

const graph = defineTokenGraph({
  modes: compilerModes,
  defaultMode: "mono-light",
  layers: [material],
  tokens,
});
```

- `exactModes` becomes `modes`, and `defaultMode` leaves the Material call.
- The hand-written checks that the fragment's mode set and default mode match `compilerModes` are
  deleted. The type check replaces them for literal maps, and `layer-mode-mismatch` replaces them at
  runtime.
- `compileMaterial3Roles` and the theme-report tool state the graph envelope themselves, two lines
  each, instead of spreading a fragment.
- The four Material columns that nothing reads are still generated. That is the cost of total mode
  maps (ADR 0009 rejected partial ones); the values are internal and cheap.

The consumer becomes simpler: one fewer option, two drift checks deleted, and the graph visibly
owns its modes.

### For other callers

- The README's first example gains the two envelope lines that the fragment used to supply.
- The Material demo applications replace `defineTokenGraph({ ...material, tokens })` with an
  explicit envelope and `layers: [material]`.
- `@scheme-tokens/material3` needs a breaking release with a changeset, a new API snapshot, and its
  peer range moved to the core release of ADR 0013. Its type tests replace the fragment proofs with
  the mode-set cases of ADR 0013, Appendix A (M1–M13), including the `NoInfer` regression.

## Alternatives

### Keep returning graph options

Rejected. The generator proposes modes that the application owns, spreading composes layers by
overwriting, and mode agreement stays a hand-written check.

### Generate `light` and `dark` once and map graph modes at composition

A layer would keep source modes of its own, and the graph would map each graph mode to one of them.
Rejected: layers would declare modes after all, the graph wire format would carry a per-layer mode
mapping, and the mapping could not express per-mode coordinates such as the monochrome variant. The
generator already receives the mapping as input, so core needs no second mapping mechanism.

### Allow a layer to cover a subset of the graph's modes

The production consumer would generate only the two modes it reads. Rejected: a token would have no
value in some modes, which breaks the one-value-per-mode invariant, and ADR 0009 rejects partial
mode maps.

### A configurable layer id

Rejected again. Two Material layers share every key, so the later one replaces the earlier one
completely.

## References

- [ADR 0006: Material 3 Authoring and Mode Contract](./0006-material3-authoring-and-mode-contract.md)
- [ADR 0007: Material 3 Engine and Role Contract](./0007-material3-engine-and-role-contract.md)
- [ADR 0008: Material 3 Fragment Layer Type](./0008-material3-fragment-layer-type.md)
- [ADR 0009: Core Contract Convergence](./0009-core-contract-convergence.md)
- [ADR 0010: Graph Tokens Compose Last](./0010-graph-tokens-compose-last.md)
- [ADR 0011: Visibility-Preserving Overrides](./0011-visibility-preserving-overrides.md)
- [ADR 0012: Single-Hyphen CSS Variable Names](./0012-single-hyphen-css-variable-names.md)
- [ADR 0013: Coherent Token Model](./0013-coherent-token-model.md)
