# scheme-tokens

`scheme-tokens` compiles token graphs.

Define string values, explicit references, modes and ordered layers. `compileTokenGraph()` resolves
them into a deterministic scheme with declaration provenance and retained expressions per mode.
Core does not know what a color is. Values are opaque strings.

Generators such as [`@scheme-tokens/material3`](./packages/material3/README.md) plug in as normal
token layers.

This branch implements the core v2 candidate for the planned 0.4 release, its static TypeScript contract, and its CSS activation exporter with optional variable references. The manifests still carry released versions until the later versioning phase. P5 and P5.1 Material contracts are accepted; [P6.1](docs/p6.1-package-evidence.md) owns package-only candidate verification and consumer compiler support. External application migrations are not release prerequisites. The [historical P6 report](docs/p6-consumer-evidence.md) retains its observations. P7 release preparation remains separate. Nothing has been published from this candidate.

## Install

Core:

```sh
pnpm add scheme-tokens
```

With Material 3 color generation:

```sh
pnpm add scheme-tokens @scheme-tokens/material3
```

Both packages are ESM-only. Node.js usage requires Node 24 or newer. Core has no runtime
dependencies or filesystem access and runs in browsers.

## First graph

References are explicit. Bare strings are always literal values.

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.600": {
      value: "oklch(62% 0.18 250)",
      visibility: "internal",
    },

    "action.primary": tokenRef("brand.600"),
  },
});

const compiled = compileTokenGraph(graph);

if (!compiled.ok) {
  throw new Error(compiled.issues.map((issue) => issue.message).join("\n"));
}

const exported = exportCssVars(compiled.value);

if (!exported.ok) {
  throw new Error(exported.issues.map((issue) => issue.message).join("\n"));
}

console.log(exported.value.css);
```

Output:

```css
:where(:root) {
  --action-primary: oklch(62% 0.18 250);
}
```

References can resolve through `brand.600`, but it stays out of the default public output. Token
key segments join with single hyphens, so `action.primary` becomes `--action-primary`.

## Material 3

The sibling package's `material3` helper returns one validated `TokenLayer`. The graph declares its modes and default mode, and composes the result with `layers: [material]`.

```ts
import { material3 } from "@scheme-tokens/material3";

const material = material3("#6750a4");
```

The default layer contains 48 `md.sys.color.*` roles with complete `light` and `dark` values,
including:

```text
md.sys.color.primary
md.sys.color.on-primary
md.sys.color.primary-container
md.sys.color.on-primary-container

md.sys.color.surface
md.sys.color.on-surface
md.sys.color.surface-container
md.sys.color.outline
```

The role names form a literal TypeScript union.

The adapter owns Material color generation, variants, contrast levels, and source colors. Core
owns graph composition, references, modes, visibility, layer order, compilation, provenance,
serialization, and CSS projection.

### Expose application semantics

Material roles can stay internal while the application exposes its own token names.

```ts
import { material3 } from "@scheme-tokens/material3";
import { compileTokenGraph, defineTokenGraph, tokenRef } from "scheme-tokens";

const material = material3("#6750a4", {
  visibility: "internal",
});

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material],

  tokens: {
    "surface.canvas": tokenRef("md.sys.color.surface"),
    "surface.foreground": tokenRef("md.sys.color.on-surface"),

    "action.primary.background": tokenRef("md.sys.color.primary"),
    "action.primary.foreground": tokenRef("md.sys.color.on-primary"),
  },
});

const compiled = compileTokenGraph(graph);
```

Default compilation resolves the internal Material roles and returns the public application
tokens.

### Variants, contrast, and custom modes

`modes` is an exact, non-empty map from graph modes to generation settings. Omitting it means
`{ light: {}, dark: {} }`; supplying it replaces that set completely. The exact keys `light` and
`dark` imply their Material color mode. Every other key requires `colorMode: "light" | "dark"`.

```ts
import { material3, type Material3Modes } from "@scheme-tokens/material3";
import { defineTokenGraph } from "scheme-tokens";

const modes = {
  "light-high": { colorMode: "light", contrastLevel: 1 },
  "brand-dark": { colorMode: "dark", sourceColor: "#009489" },
} satisfies Material3Modes<"light-high" | "brand-dark">;
const material = material3("#6750a4", {
  specVersion: "2025",
  variant: "expressive",
  contrastLevel: 0.5,
  modes,
});
const graph = defineTokenGraph({
  modes: ["light-high", "brand-dark"],
  defaultMode: "light-high",
  layers: [material],
  tokens: {},
});
```

The positional source is the only global source color. Per-mode source, variant, and contrast
resolve independently over global settings. Spec version and visibility stay global. All effective
coordinates are checked before generation, and core validates mode names. One-mode maps are valid;
empty maps are rejected. The graph owns mode order and default, and its set must equal the layer's.

TypeScript preserves the exact role keys, mode set, and visibility. `Material3Modes` checks a map
against an application's graph modes; `Material3Options` lets wrappers forward them. A default call
is precisely public, an inline internal option stays internal, and bare `Material3Options` keeps
visibility conservative. See the [adapter reference](./packages/material3/README.md#typescript-contract).

## Material 3 with shadcn/ui

You can map [shadcn/ui](https://ui.shadcn.com/docs/theming) roles to internal Material roles with
`tokenRef()`.

```ts
import { material3 } from "@scheme-tokens/material3";
import { compileTokenGraph, defineTokenGraph, exportCssVars, tokenRef } from "scheme-tokens";

const material = material3("#6750a4", {
  visibility: "internal",
});

const theme = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material],

  tokens: {
    background: tokenRef("md.sys.color.background"),
    foreground: tokenRef("md.sys.color.on-background"),

    card: tokenRef("md.sys.color.surface-container-low"),
    "card-foreground": tokenRef("md.sys.color.on-surface"),

    popover: tokenRef("md.sys.color.surface-container"),
    "popover-foreground": tokenRef("md.sys.color.on-surface"),

    primary: tokenRef("md.sys.color.primary"),
    "primary-foreground": tokenRef("md.sys.color.on-primary"),

    secondary: tokenRef("md.sys.color.secondary-container"),
    "secondary-foreground": tokenRef("md.sys.color.on-secondary-container"),

    muted: tokenRef("md.sys.color.surface-container-low"),
    "muted-foreground": tokenRef("md.sys.color.on-surface-variant"),

    accent: tokenRef("md.sys.color.surface-container-high"),
    "accent-foreground": tokenRef("md.sys.color.on-surface"),

    destructive: tokenRef("md.sys.color.error"),
    "destructive-foreground": tokenRef("md.sys.color.on-error"),

    border: tokenRef("md.sys.color.outline-variant"),
    input: tokenRef("md.sys.color.outline"),
    ring: tokenRef("md.sys.color.primary"),
  },
});

const compiled = compileTokenGraph(theme);

if (!compiled.ok) {
  throw new Error(compiled.issues.map((issue) => issue.message).join("\n"));
}

const exported = exportCssVars(compiled.value, {
  attribute: false,
  selectors: {
    dark: ".dark",
  },
});

if (!exported.ok) {
  throw new Error(exported.issues.map((issue) => issue.message).join("\n"));
}

console.log(exported.value.css);
```

The light values land on `:where(:root)` and the dark values on `:where(.dark)`, so a `.dark`
class on any element, not only the root, switches that subtree.

This is an application mapping, not a built-in shadcn adapter. Material and shadcn/ui do not define
identical semantics.

Chart roles are left out. Material does not define a five-series categorical chart palette.
Sidebar roles are application-specific too, so this example leaves them out.

## Layers and overrides

Generated and authored layers use the same ordering rules.

```ts
import { material3 } from "@scheme-tokens/material3";
import { defineTokenGraph, defineTokenLayer, tokenRef } from "scheme-tokens";

const material = material3("#6750a4", {
  visibility: "internal",
});

const overrides = defineTokenLayer({
  id: "brand-overrides",
  tokens: {
    "md.sys.color.primary": "#ff0055",
  },
});

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material, overrides],

  tokens: {
    "action.primary.background": tokenRef("md.sys.color.primary"),
  },
});
```

Layers have stable IDs and local default visibility, but no mode envelope. Direct expressions fit every graph. All mode maps within one layer must name the same set; a non-empty set must exactly match the graph modes, ignoring order. Mismatches return one deterministic `layer-mode-mismatch` per invalid layer. The graph owns mode order and default. Layers compose in array order, then graph tokens compose last. The winner supplies value and descriptive metadata. Omitted visibility preserves prior effective visibility; explicit visibility restates it. With no explicit visibility, the default of the position that introduced the key applies.

Compiled values remain `tokens[key][mode]`. Metadata contains effective `visibility` and non-empty `declarations` in composition order. Each declaration contains `origin: { kind: "graph" }` or `{ kind: "layer", id }`, plus `visibility` only when explicitly authored. The last declaration wins. Sparse `expressionByMode` omits literal modes, retains pure `{ ref }` records without duplicated values, and retains canonical concat parts with `{ ref, value }` for referenced parts. Descriptions, deprecation, and extensions come only from the winner.

## Modes

Modes belong to the graph. Layers only provide values for those modes. A direct layer expression
applies to every graph mode. A layer mode map stays unbound while standalone and must exactly cover
the owning graph's modes when composed; it never contributes or infers a graph mode envelope.

```ts
import { defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    "brand.600": "oklch(62% 0.18 250)",
    "brand.400": "oklch(78% 0.12 250)",

    background: {
      light: "#ffffff",
      dark: "#111111",
    },

    primary: {
      light: tokenRef("brand.600"),
      dark: tokenRef("brand.400"),
    },
  },
});
```

Authored graph mode order is preserved exactly, and the default need not be first.

## Concat

```ts
import { defineTokenGraph, tokenConcat, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: { primary: "#6750a4", ring: tokenConcat`0 0 0 3px ${tokenRef("primary")}` },
});
```

`tokenConcat` is a tagged template with reference-only substitutions. An empty template becomes `""`; a lone reference becomes `{ ref }`. Exact `{ concat: [...] }` source expressions merge adjacent literals, drop empty literals, and collapse literal-only content. Empty arrays and nested concat are invalid. Resolved concat is limited to 65,536 UTF-16 code units before joining; arbitrary literals and pure references remain unrestricted.

`concat` is a valid mode name: `{ concat: "opaque" }`, `{ concat: { ref: "a" } }`, and `{ concat: { concat: ["x", { ref: "a" }] } }` are mode maps. Only an exact singleton object with an array under `concat` is a concat expression. `{ concat: [] }` is therefore an invalid expression, never a mode map. `ref`, `value`, `visibility`, `description`, `deprecated`, and `extensions` remain reserved.

## Visibility and selection

References resolve before visibility is applied.

```ts
import { compileTokenGraph, defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    source: {
      value: "#6750a4",
      visibility: "internal",
    },

    primary: tokenRef("source"),
  },
});

const publicScheme = compileTokenGraph(graph);
const completeScheme = compileTokenGraph(graph, {
  selection: "all",
});
const exactScheme = compileTokenGraph(graph, {
  selection: {
    keys: ["primary"],
  },
});
```

Default compilation selects public tokens. `selection: "all"` includes internal tokens. A literal
`keys` selection stays exact in TypeScript. For a literal graph TypeScript also knows the public keys
after layers and graph tokens compose, so `publicScheme` is a complete record of `primary`; dynamic or
parsed graphs stay partial. The supported compiler is TypeScript `>=5.9.3 <6.0.0 || >=6.0.2 <7.0.0 || >=7.0.2 <8.0.0`.

## Persisted artifacts

Graphs, layers, and compiled schemes have strict versioned artifact forms. Use the `define*`
helpers for trusted TypeScript authoring. Use `parseTokenGraph()`, `parseTokenLayer()`, and
`parseCompiledScheme()` for persisted or otherwise untrusted input. Their matching serializers
produce canonical output. Published schemas are available at:

```text
scheme-tokens/schemas/token-graph.v2.schema.json
scheme-tokens/schemas/token-layer.v2.schema.json
scheme-tokens/schemas/compiled-scheme.v2.schema.json
```

Current writers emit `formatVersion: 2`. Source parsers also accept historical v1 graphs/layers, upgrade once, and validate under the same current rules. Shadowed graph declarations move to a deterministic leading synthetic layer; only necessary visibility restatements are added, and historical default-first mode order is preserved. V1 schema hints are validated historically and dropped on upgrade. Standalone inconsistent layer maps return `layer-mode-mismatch`. Compiled v1 is rejected with `invalid-format-version`: recompile its source graph.

In v2, `$schema` may be any string. It is preserved verbatim, never fetched or used for version selection, and never synthesized. Trusted helpers do not accept `$schema`. Only `kind` and `formatVersion` select the runtime format. A documented editor hint for the planned 0.4 release is `https://cdn.jsdelivr.net/npm/scheme-tokens@0.4.0/schemas/token-graph.v2.schema.json`; that release is not published yet. Each packaged schema has a stable identity such as `tag:maikel.site,2026-09-29:scheme-tokens/schema/token-graph/v2`. All three are self-contained Draft 2020-12 with fragment-only internal references.

## CSS projection

CSS export is separate from compilation. `exportCssVars()` takes a compiled scheme and emits CSS
plus structured block data.

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(
  defineTokenGraph({
    modes: ["light", "dark"],
    defaultMode: "light",
    tokens: {
      primary: {
        light: "#6750a4",
        dark: "#d0bcff",
      },
      "color-scheme": {
        light: "light",
        dark: "dark",
      },
    },
  }),
);

if (!compiled.ok) {
  throw new Error(compiled.issues.map((issue) => issue.message).join("\n"));
}

const exported = exportCssVars(compiled.value, {
  prefix: "app",
  system: {
    dark: "(prefers-color-scheme: dark)",
  },
});
```

Output:

```css
:where(:root) {
  --app-color-scheme: light;
  --app-primary: #6750a4;
}

@media (prefers-color-scheme: dark) {
  :where(:root) {
    --app-color-scheme: dark;
    --app-primary: #d0bcff;
  }
}

:where([data-theme="light"]) {
  --app-color-scheme: light;
  --app-primary: #6750a4;
}

:where([data-theme="dark"]) {
  --app-color-scheme: dark;
  --app-primary: #d0bcff;
}
```

A mode activates through four tiers, emitted in this order:

1. **base**: the default mode at `root` (`:root`, or `:host` for a shadow root);
2. **system**: a media condition per mode at `root`, from `system`. No mode is inferred;
3. **explicit**: one attribute marker per mode, `data-theme` when the scheme has several modes.
   Set `attribute` to another `data-*` name, or to `false` for no markers;
4. **custom**: author selectors per mode, from `selectors`, each optionally inside a media
   condition.

Every selector is wrapped in `:where()`, so precedence comes only from this order: a later
matching block wins, then the scheme's authored mode order, then the order of a mode's conditions.
Every block declares every selected token. Markers are unanchored, so `data-theme="dark"` on any
element switches its subtree, and a light island inside it works. A value that is not a mode, such
as `data-theme="system"`, leaves the system preference in charge.

Application CSS competes through the ordinary cascade. Any application rule with specificity
overrides a generated declaration, before or after the tokens; `cascadeLayer: "tokens"` wraps the
output in `@layer tokens`. The exporter emits custom properties only, so bind `color-scheme` where
modes activate:

```css
:root,
[data-theme] {
  color-scheme: var(--app-color-scheme);
}
```

The result contains the CSS, structured blocks with `tier`, `mode`, `selectors`, optional `media`,
and `declarations`, and the token-to-variable lookup:

```text
exported.value.css
exported.value.blocks
exported.value.variableByToken
```

Default variable names join the optional prefix and the key segments with single hyphens. Keys
such as `a-b.c` and `a.b-c` would share `--a-b-c`; every such collision among the exported tokens
fails with both keys and the variable. `variableName` handles genuine naming exceptions.

### Live references

Resolved output is the default: omission, explicit `undefined`, and `references: "resolved"` keep the compiled strings and existing CSS unchanged. Use `references: "var"` to project retained explicit references:

```ts
import {
  compileTokenGraph,
  defineTokenGraph,
  exportCssVars,
  orThrow,
  tokenConcat,
  tokenRef,
} from "scheme-tokens";

const scheme = orThrow(
  compileTokenGraph(
    defineTokenGraph({
      tokens: {
        spacing: "20px",
        gap: tokenRef("spacing"),
        width: tokenConcat`calc(${tokenRef("spacing")} * 2)`,
      },
    }),
  ),
);
const css = orThrow(exportCssVars(scheme, { references: "var", prefix: "app" })).css;
```

This emits `--app-gap: var(--app-spacing)` and `--app-width: calc(var(--app-spacing) * 2)`. A direct target links only when it is in the compiled scheme's emitted key set. Otherwise a pure reference inlines its own resolved value, and each concat reference part inlines its retained value. A selected internal target can link; an omitted public target cannot. References never bypass an omitted intermediate or add dependencies. Links reuse actual `prefix`/`variableName` results, built once per selected key in canonical order. Authored `var(...)` strings remain opaque.

Every activation block redeclares all aliases, so target overrides on that element propagate, including unlayered application overrides when tokens use a cascade layer. An unmarked descendant's target override leaves its inherited alias unchanged. Core concat joins characters while CSS substitutes token streams: with a numeric target of `20`, `var(--number)px` is not `20px`, and inserted `var()` inside a quoted string remains literal text. Use resolved output for arbitrary string assembly.

CSS safety checks the complete emitted declaration once per key/mode. Unsafe retained concat points to `/metadataByToken/<key>/expressionByMode/<mode>`; resolved or directly inlined token values retain `/tokens/<key>/<mode>`. Unused resolved values, unused fallbacks, and isolated fragments are not checked in `"var"` mode. Compiled parsing validates metadata structure without proving consistency with tokens or acyclicity of edited references. Invalid options and names remain collected failures. See the [CSS export guide](./docs-site/guide/export-css-variables.md#reference-output) for selection, propagation, concat, and safety details, including the existing HTML embedding boundary.

## Results

Fallible public operations return the same `Result`: `{ ok: true, value }` or
`{ ok: false, issues }`. The `issues` tuple is never empty.

`orThrow(result)` returns the exact success value or throws an `Error` containing every issue code, optional path, and message, with the original issue tuple in `cause`. Trusted authoring helpers use the same error convention for programmer misuse. Parsers accept `unknown` and return
structured issues for invalid persisted data.

## DTCG and downstream tooling

`scheme-tokens` composes and resolves a graph before platform tools run. It does not implement the
DTCG `$type` and `$value` authoring model or interpret token value domains.

To use Style Dictionary or Terrazzo downstream, convert the compiled output to the input format
each tool expects. `scheme-tokens` does not ship those adapters. Applications can also use the
built-in CSS projection directly.

## Documentation

- [Public API](./docs/public-api.md)
- [Architecture](./docs/architecture.md)
- [Application theme coordinates](./docs/application-theme-coordinates.md)
- [Executable theme-coordinate example](./examples/theme-coordinates/README.md)
- [Tailwind CSS v4](./docs/tailwind-css-v4.md)
- [Diagnostics](./docs/diagnostics.md)
- [Value policy](./docs/color-policy.md)
- [Semver](./docs/semver.md)
- [Material 3 adapter](./packages/material3/README.md)
