# @scheme-tokens/material3

Generate the accepted Material 3 system color roles as one ordinary `scheme-tokens` layer. The
adapter is optional: core remains a string-token compiler and does not install a color engine.

This README describes the P5 candidate, including P5.1 option-presence typing, for Material `0.2.0` and core `0.4.0`. The committed versions
remain `0.1.1` and `0.3.0`; the new API has not been published. [P6.1](../../docs/p6.1-package-evidence.md) verifies the package pair, compiler support and repository-owned consumers. External application migrations, framework checks and application identities are not release prerequisites. P7 release preparation remains separate. The [historical P6 report](../../docs/p6-consumer-evidence.md) retains the external observations.

## Generate and compose

```ts
import { material3 } from "@scheme-tokens/material3";
import { compileTokenGraph, defineTokenGraph, orThrow, tokenRef } from "scheme-tokens";

const material = material3("#6750a4", { visibility: "internal" });
const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material],
  tokens: {
    "surface.canvas": tokenRef("md.sys.color.surface"),
    "action.primary.background": tokenRef("md.sys.color.primary"),
  },
});
const compiled = orThrow(compileTokenGraph(graph));
// Complete public records: surface.canvas and action.primary.background.
```

The default call generates complete `light` and `dark` maps for the existing exact 48
`md.sys.color.*` roles. The layer has fixed id `material3`, public default visibility unless
configured, and no `modes`, `defaultMode`, or `layers` envelope. Only the graph chooses its mode
order and default. Core rejects a second Material layer with `duplicate-layer-id`.

## Exact graph-mode mapping

`modes` is an exact, non-empty map. Omitted means `{ light: {}, dark: {} }`; an explicit map replaces
that default completely. A one-mode map is valid. The exact keys `light` and `dark` imply their
Material color mode and reject redundant `colorMode`. Every other name, including `concat`, requires
`colorMode: "light" | "dark"`. Core owns the mode-name grammar and reserved names.

```ts
import { material3, type Material3Modes } from "@scheme-tokens/material3";
import { defineTokenGraph } from "scheme-tokens";

const compilerModes = [
  "mono-light",
  "mono-dark",
  "vivid-light",
  "vivid-dark",
  "material3-light",
  "material3-dark",
] as const;
type CompilerMode = (typeof compilerModes)[number];
const modes = {
  "mono-light": { colorMode: "light", variant: "monochrome" },
  "mono-dark": { colorMode: "dark", variant: "monochrome" },
  "vivid-light": { colorMode: "light" },
  "vivid-dark": { colorMode: "dark" },
  "material3-light": { colorMode: "light" },
  "material3-dark": { colorMode: "dark", sourceColor: "#009489" },
} as const satisfies Material3Modes<CompilerMode>;
const material = material3("#6750a4", { visibility: "internal", modes });
const graph = defineTokenGraph({
  modes: compilerModes,
  defaultMode: "mono-light",
  layers: [material],
  tokens: {},
});
```

All 48 roles cover all six graph modes. `satisfies` catches missing/extra modes and invalid settings.
Literal layer/graph mode sets must be equal; a dynamic map retains core's runtime
`layer-mode-mismatch` validation. Material cannot add modes or infer the graph envelope.

## Generation settings

The positional `sourceColor` is the only global source. The global defaults are:

| Setting         | Default                                  | Per-mode override       |
| --------------- | ---------------------------------------- | ----------------------- |
| `sourceColor`   | required positional argument             | yes                     |
| `variant`       | `tonal-spot`                             | yes                     |
| `contrastLevel` | `0`                                      | yes                     |
| `specVersion`   | `2021`                                   | no                      |
| `visibility`    | `public`                                 | no                      |
| `colorMode`     | exact light/dark key, otherwise required | custom names require it |

Each field falls back independently to the global value. A mode can change just its contrast while
inheriting source and variant. Source colors must match `#[0-9a-fA-F]{6}` exactly; uppercase digits
normalize to lowercase. Contrast must be finite and within inclusive `[-1, 1]`. Output remains
canonical lowercase six-digit hex, and generation remains phone-only.

Requested 2021 supports all nine variants: `monochrome`, `neutral`, `tonal-spot`, `vibrant`,
`expressive`, `fidelity`, `content`, `rainbow`, and `fruit-salad`. Requested 2025 supports only
`neutral`, `tonal-spot`, `vibrant`, and `expressive`; the others silently fall back in the pinned
engine and are rejected. Every effective coordinate is checked before any engine generation, with
the offending graph-mode name in the error. A global variant overridden in every mode is not an
effective coordinate and does not cause an unsupported-coordinate rejection.

Unsupported options throw `RangeError`; malformed plain-data inputs throw `TypeError`.
`appearance`, additive mode merging, string shorthand, `exactModes`, and Material-owned
`defaultMode` are removed. Top-level `sourceColor`, per-mode spec version/visibility, and unknown
options are rejected. Core mode-name errors propagate unchanged with their issue-tuple `cause`;
Material does not wrap them or introduce a Result/issue framework. Inputs are validated and copied.

## TypeScript contract

The only runtime export is `material3`. Exactly six named types are exported:
`Material3TokenKey`, `Material3ColorMode`, `Material3SpecVersion`, `Material3Variant`,
`Material3Modes`, and `Material3Options`. Per-mode settings, overrides, and the empty-map diagnostic
marker remain internal. `Material3Modes<Mode>[M]` names one mode's settings if needed.

`Material3Options` defaults Mode to `Material3ColorMode` and Visibility to `TokenVisibility`.
The function defaults Mode to `Material3ColorMode` and Visibility to `"public"`. Its return is:

```ts
import type { Material3TokenKey } from "@scheme-tokens/material3";
import type { TokenLayer, TokenVisibility } from "scheme-tokens";

type MaterialLayer<Mode extends string, Visibility extends TokenVisibility> = TokenLayer<
  Material3TokenKey,
  NoInfer<Mode>,
  {
    readonly default: NoInfer<Visibility>;
    readonly public: never;
    readonly internal: never;
    readonly omitted: Material3TokenKey;
  }
>;
```

The `omitted` fact adapts ADR 0014's earlier example to current core: all 48 generated declarations
omit explicit visibility and use the layer default. Core's nominal proof, visibility composition,
and completeness rules remain intact. `NoInfer` prevents an annotated variable, declared return,
or typed layer list from fabricating modes or visibility.

A default call is exactly public; inline `visibility: "internal"` is exactly internal. An object
checked with `satisfies Material3Options` keeps its literal settings. A variable annotated only as
`Material3Options` may hold internal visibility but conservatively yields `TokenVisibility`.
Default/public compilation of its graph is partial over every composed key: possibly public
Material roles remain possible, not definitely absent. Finite, fully known public selections and
exact key tuples remain complete; generic wrappers preserve supplied modes and visibility.

Precise facts require actual settings. `Material3Options<"custom", "internal">` requires both
`modes` and `visibility`; `{}` is rejected. A single built-in mode also requires its map, because
omission generates both light and dark. Visibility may be omitted when its type includes public.
The default-call signature accepts omitted or `undefined` options without generics. Explicit
generic calls require an options object satisfying these same field-presence rules.

```ts
import { material3, type Material3Options } from "@scheme-tokens/material3";
import type { TokenVisibility } from "scheme-tokens";

const defaults = material3("#6750a4"); // light/dark, public
const settings = {
  modes: { custom: { colorMode: "light" } },
  visibility: "internal",
} satisfies Material3Options<"custom", "internal">;

function generate<Mode extends string, Visibility extends TokenVisibility>(
  source: string,
  options: Material3Options<Mode, Visibility>,
) {
  return material3(source, options);
}
const custom = generate("#6750a4", settings); // custom, internal

function generateDefaults(options: Material3Options = {}) {
  return material3("#6750a4", options); // light/dark, conservative visibility
}
```

A narrowed custom/internal wrapper can have a default only if it supplies the required settings.
For possibly undefined options, narrow before calling or provide a valid fallback. For example,
bare `Material3Options | undefined` can use `material3(seed, options ?? {})`; custom settings need
a custom map fallback or a branch calling `material3(seed)` for the default case. Alternative
complete mode sets are never combined into one purported exact set. See
[ADR 0016](../../docs/adr/0016-material-option-presence.md) for the correction to ADR 0014.

## Overrides, CSS, and artifacts

Ordinary layers compose in array order, followed by graph tokens. Omitted override visibility
preserves the existing effective visibility; explicit visibility changes it. Here the generated
primary remains internal through the ordinary layer and graph override, while the alias is public:

```ts
import { material3 } from "@scheme-tokens/material3";
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  exportCssVars,
  orThrow,
  tokenRef,
} from "scheme-tokens";

const material = material3("#6750a4", { visibility: "internal" });
const brand = defineTokenLayer({ id: "brand", tokens: { "md.sys.color.primary": "#ff0055" } });
const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material, brand],
  tokens: {
    "md.sys.color.primary": { light: "#b3261e", dark: "#f2b8b5" },
    "action.primary.background": tokenRef("md.sys.color.primary"),
  },
});
const compiled = orThrow(compileTokenGraph(graph, { selection: "all" }));
const css = orThrow(exportCssVars(compiled, { system: { dark: "(prefers-color-scheme: dark)" } }));
// css.variableByToken["md.sys.color.primary"] === "--md-sys-color-primary"
// primary's declaration origins are material3, brand, then graph.
```

Core's default names already match `--md-sys-color-*`. Light applies at `:root`, dark under the
system condition, and `data-theme="light"`/`data-theme="dark"` markers override either in their
subtrees. Class activation uses custom `selectors: { dark: ".dark" }` conditions.
`serializeTokenLayer()` produces deterministic ordinary core data. Compiled metadata exposes
ordered `declarations` and sparse `expressionByMode`; the adapter adds no separate CSS,
serialization, or provenance API.

## Distribution and migration

The ESM-only package requires Node 24 or newer and TypeScript `>=5.9.3 <6.0.0 || >=6.0.2 <7.0.0 || >=7.0.2 <8.0.0`. The new core contract
requires peer `scheme-tokens: ^0.4.0`; earlier core minors are unsupported. Local packed gates apply
Changesets only in a temporary workspace to prove core `0.4.0` with Material `0.2.0`. Both tarballs
are installed together with strict peer checking, run in raw Node ESM and NodeNext, and checked
under strict-only and stricter TypeScript configurations. Core-only installation remains Material-free.

To migrate, replace fragment spreading with an explicit graph envelope and `layers: [material]`.
Replace `exactModes`/additive `modes` with one exact `modes` map, rename `appearance` to `colorMode`,
and remove the Material `defaultMode`. The old `Material3GraphFragment` and `Material3Appearance`
exports have no aliases. Engine algorithms, the 48-role catalog, capability fixtures and golden
outputs remain unchanged.

Material Color Utilities `0.4.0` stays pinned and bundled; no separate engine is installed at runtime.
The adapter is licensed under MIT and Apache-2.0. See `LICENSE`, `LICENSE-MATERIAL-COLOR-UTILITIES`,
and `THIRD_PARTY_NOTICES.md`.
