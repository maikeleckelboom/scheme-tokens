# scheme-tokens

Dependency-light color token graphs for TypeScript and JavaScript applications.

Use the root package when you want to author color tokens, compile a selected scheme, serialize deterministic JSON, or
export CSS custom properties. Optional engines such as Material 3 live in adapter packages; hand-authored tokens do not
load those dependencies.

## Install

```bash
pnpm add scheme-tokens
```

## Quick Start

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  background: "oklch(0.98 0.01 260)",
  foreground: "#111111",
  primary: "color(display-p3 0.42 0.32 0.74)",
  "primary-foreground": "#ffffff",
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.value.css;

export { stylesheet };
```

```css
.page {
  background: var(--background);
  color: var(--foreground);
}

.button {
  background: var(--primary);
  color: var(--primary-foreground);
}
```

Authoring can be ergonomic while persisted artifacts stay strict and deterministic. Core accepts modern CSS color spaces
such as OKLCH and Display-P3, preserves the authored space, and does not perform color conversion or gamut mapping.

With no `modes` field, `defineTokens()` creates one mode named `base`. In a single-mode graph, `base` means "the one
ordinary value for this token." It is not a Material role, generated palette, light mode, or dark mode.

The default CSS export uses `:root` for the default mode. Directly authored tokens default to `public`, and compilation
defaults to `selection: "public"`.

Omit `prefix` to emit custom properties such as `--background`, `--foreground`, `--primary`, and
`--primary-foreground`. Pass `prefix: "color"` when you want namespaced custom properties such as
`--color-background`.
`exports` is reserved for package subpaths and output/export behavior such as CSS naming, filtering, prefixing, target
formats, or future export profiles. It is not a graph or layer lane for mapping one token key to another.

## Light and Dark Values

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens(
  {
    background: {
      light: "oklch(0.99 0.01 260)",
      dark: "oklch(0.18 0.02 285)",
    },
    foreground: {
      light: "#111111",
      dark: "oklch(0.94 0.02 285)",
    },
    primary: {
      light: "color(display-p3 0.42 0.32 0.74)",
      dark: "oklch(0.82 0.09 292)",
    },
    "primary-foreground": {
      light: "#ffffff",
      dark: "#1d1330",
    },
  },
  {
    modes: ["light", "dark"],
    defaultMode: "light",
  },
);

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.value.css;

export { stylesheet };
```

Use direct color values when your app owns the token values. Direct colors need no reference helper, and modern CSS color
spaces such as OKLCH and Display-P3 can be authored directly.

To export every token, compile with `compileTokenGraph(graph, { selection: "all" })`. To export a named subset, compile
with `compileTokenGraph(graph, { selection: { keys: ["background"] } })`.

The default CSS selectors are `:root` for the default mode and `:root[data-color-scheme="dark"]` for the dark mode. Pass
`scope` and `modeSelectors` when your app uses classes or exact selectors instead.
Generated `data-attribute` and `class` selectors append to the scope, so the scope must be a single append-safe selector
such as `:root` or `.preview`. Use exact `modeSelectors: { strategy: "selectors" }` for selector lists, pseudo-elements,
descendant selectors, or other complex scopes.

## Programmatic CSS Export

`exportCssVars()` returns one `Result` whose success value contains the stylesheet string, structured declaration
blocks, and `variableByToken`. `variableByToken` is a token-key to CSS custom-property map for programmatic lookup.
`blocks` is ordered renderer/exporter data for runtime application, previews, or custom renderers that should not parse
CSS text.

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    background: "#ffffff",
    foreground: "#111111",
    primary: "#6750a4",
    "primary-foreground": "#ffffff",
  },
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.value.css;
const customPropertyByToken = cssExport.value.variableByToken;
const backgroundCustomProperty = customPropertyByToken.background;
const blocks = cssExport.value.blocks;

export { backgroundCustomProperty, blocks, stylesheet };
```

Omit `prefix` to emit custom properties such as `--background`, `--foreground`, `--primary`, and
`--primary-foreground`. Pass `prefix: "color"` to emit names such as `--color-background`.

## Tailwind v4

`scheme-tokens` owns authored token names and runtime CSS custom properties. Tailwind owns the `@theme` namespace it
needs to generate utilities. Keep those contracts separate: export stable runtime custom properties from
`scheme-tokens`, then map the color tokens your app wants Tailwind to expose.

Step 1: compile and export runtime CSS custom properties.

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
  primary: "#6750a4",
  "primary-foreground": "#ffffff",
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.value.css;

export { stylesheet };
```

Step 2: load the generated stylesheet in your app.

```css
:root {
  --background: #ffffff;
  --foreground: #111111;
  --primary: #6750a4;
  --primary-foreground: #ffffff;
}
```

Step 3: map those runtime custom properties into Tailwind's color contract explicitly.

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
}
```

Tailwind utilities now use Tailwind's `--color-*` theme custom properties, while the runtime custom properties from
`scheme-tokens` remain authored, stable, and unprefixed. Do not derive Tailwind colors by blindly remapping every exported declaration;
keep the mapping to the color tokens that are part of your app's Tailwind contract.

## Layered Schemes

Use layers when a product needs ordered authored overlays. A generated base is optional; a layer-only build does not need
an empty base array.

```ts
import { buildScheme, defineTokenLayer } from "scheme-tokens";

const base = defineTokenLayer({
  id: "base",
  tokens: {
    background: "#ffffff",
    foreground: "#111111",
    primary: "#6750a4",
  },
});

const brand = defineTokenLayer({
  id: "brand",
  tokens: {
    primary: "#ff3b30",
  },
});

const built = buildScheme({
  layers: [base, brand],
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}
```

Layers are ordered token overlays. When a generated base is present, it resolves before layers, and later layers win by
token key. This is deterministic token composition, not CSS cascade behavior: there is no selector specificity,
`!important`, CSS `@layer`, DOM mutation, or style injection.

For layer-only light and dark builds, pass the graph mode envelope to `buildScheme()`:

```ts
import { buildScheme, defineTokenLayer } from "scheme-tokens";

const base = defineTokenLayer({
  id: "base",
  modes: ["light", "dark"],
  tokens: {
    background: {
      light: "#ffffff",
      dark: "#141218",
    },
    foreground: {
      light: "#111111",
      dark: "#f5eff7",
    },
  },
});

const built = buildScheme({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [base],
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}
```

## Optional Material 3

Material 3 output is provided by `@scheme-tokens/material3`, not by the root package.

```bash
pnpm add scheme-tokens @scheme-tokens/material3
```

```ts
import { buildScheme } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const built = buildScheme(material3("#6750a4"));
if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}
```

Add an application layer when generated Material roles should feed project-owned tokens:

```ts
import { defineTokenLayer } from "scheme-tokens";

const application = defineTokenLayer<"light" | "dark">({
  id: "application",
  aliases: {
    "app.background": "material3.surface",
    "app.foreground": "material3.on-surface",
    "app.success": "material3.extended.success.color",
  },
});
```

Generated-source tokens are often internal implementation detail. Public app tokens should be authored under `tokens`
or `aliases` and reference generated roles explicitly. Alias maps use `aliases: { "app.background": "generated.role" }`.
Direct color values stay simple; individual explicit references use `tokenRef("other.token")` or
`{ ref: "other.token" }`.

Prepare a reusable builder when the same app layers are built repeatedly with changing base input:

```ts
import { createSchemeBuilder, defineTokenLayer, exportCssVars } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const application = defineTokenLayer<"light" | "dark">({
  id: "application",
  defaultVisibility: "public",
  aliases: {
    "app.background": "material3.surface",
    "app.foreground": "material3.on-surface",
    "app.primary": "material3.primary",
    "app.primary-foreground": "material3.on-primary",
  },
});

const builder = createSchemeBuilder({
  layers: [application],
});

const built = builder.build(material3("#6750a4"));
if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}

const cssExport = exportCssVars(built.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.value.css;

export { stylesheet };
```

`buildScheme()` is the runner that composes base inputs and layers, validates the composed graph material, and produces
`built.value`. At least one base input or layer is required. `buildScheme(material3(...))` is the generated-base
convenience form, `buildScheme(material3(...), { layers })` resolves the Material 3 base before application layers, and
layer-only builds use the canonical options object. `createSchemeBuilder({ layers })` prepares the same reusable build
options without a base. Its `build()` method accepts a base shorthand such as `material3("#6750a4")` or an explicit
object such as `{ base: material3("#6750a4") }`. Material-specific fields stay inside `material3()` calls. The Material
adapter supplies a real Material 3 base scheme input; the root package stays engine-free.

Prefer build-time, SSR, or server-side generation for static schemes. Use `createSchemeBuilder()` for interactive
previews, theme editors, and color controls where `sourceColors` changes repeatedly; `scheme-tokens` is not a global
mutable runtime theme engine.

`sourceColors` is the canonical Material source-color field. `material3("#6750a4")` is shorthand for
`material3({ sourceColors: "#6750a4" })`. The canonical field accepts a single `#rrggbb` string for the ordinary
one-brand-color case or an array for official multi-source paths such as CMF; empty arrays fail at runtime validation.
Material controls such as `variant`, `contrastLevel`, `specVersion`, `platform`, `paletteOverrides`, `extendedColors`,
and `paletteTones` belong with Material generation input. Integration policy such as `id` and `defaultVisibility`
belongs in integration options, not in Material generation input.

Use `material3Preset()` when repeated Material builds share generation defaults or integration policy:

```ts
import { material3Preset } from "@scheme-tokens/material3";

const material = material3Preset({ variant: "tonal-spot" }, { defaultVisibility: "internal" });

const base = material("#6750a4");
```

Runtime generation input wins over preset defaults, and arrays such as `extendedColors` replace preset arrays. Create a
separate preset when `id` or `defaultVisibility` should differ.

The adapter emits strict `light` and `dark` graph tokens with adapter-owned keys such as `material3.primary`,
`material3.on-primary`, and `material3.primary-container`.

See [`@scheme-tokens/material3`](./packages/material3/README.md) for adapter-specific options and
composition examples.

## Serialize the Compiled Scheme

```ts
import { compileTokenGraph, defineTokenGraph, serializeCompiledScheme } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.primary": "#6750a4",
    "surface.canvas": "#ffffff",
  },
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const json = serializeCompiledScheme(compiled.value);
const artifactJson = json;

export { artifactJson };
```

`serializeCompiledScheme()` serializes the compiled output, not the authoring input. The output is deterministic and includes
resolved colors, modes, token visibility, origin metadata, and direct dependency metadata.

## Helper Input

`defineTokens()` is the smallest manual-token helper. It accepts a token record plus optional graph-level helper options:

```ts
import { defineTokens } from "scheme-tokens";

const graph = defineTokens(
  {
    background: {
      light: "#ffffff",
      dark: "#141218",
    },
    foreground: {
      light: "#111111",
      dark: "#f5eff7",
    },
  },
  {
    modes: ["light", "dark"],
    defaultMode: "light",
  },
);
```

`defineTokenGraph()` is the full graph-shaped helper for explicit graph authoring:

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    "brand.primary": {
      visibility: "internal",
      light: "#6750a4",
      dark: "#d0bcff",
    },
    "brand.on-primary": {
      visibility: "internal",
      light: "#ffffff",
      dark: "#381e72",
    },
  },
  aliases: {
    primary: "brand.primary",
    "primary-foreground": "brand.on-primary",
  },
});
```

The authoring helpers accept JSON-safe shorthand:

- a color string such as `"#6750a4"`;
- alias maps such as `aliases: { primary: "brand.primary" }`;
- explicit references such as `tokenRef("brand.primary")` or `{ ref: "brand.primary" }` inside advanced token
  definitions;
- metadata plus mode keys such as `{ visibility: "public", light: "#fff", dark: "#000" }`;
- mode records such as `{ light: "#fff", dark: "#000" }` when modes are declared.

Bare strings are always treated as color authoring input. If a string is not supported by the color parser, it reports an
actionable helper error instead of becoming a reference based on spelling. CSS named colors such as `"red"` are not
currently supported by core color parsing. Direct color values need no reference helper. Use `aliases` for ordinary
token-key mapping. Use `tokenRef("brand.primary")` or `{ ref: "brand.primary" }` inside token definitions when the
reference needs token metadata, per-mode references, or strict-style low-level shape.

The helpers fill safe defaults and return strict graph input.

## Persisted Artifacts Are Explicit

`parseTokenGraph()` is the persisted wire-format boundary and stays explicit.

```ts
import { compileTokenGraph, parseTokenGraph, serializeTokenGraph } from "scheme-tokens";

const strictGraph = {
  kind: "scheme-tokens/color-token-graph",
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    "brand.primary": {
      value: {
        colorSpace: "srgb",
        components: [0.403921568627451, 0.3137254901960784, 0.6431372549019608],
        alpha: 1,
        hex: "#6750a4",
      },
    },
    "surface.canvas": {
      value: {
        colorSpace: "srgb",
        components: [1, 1, 1],
        alpha: 1,
        hex: "#ffffff",
      },
    },
  },
} as const;

const parsed = parseTokenGraph(strictGraph);
if (!parsed.ok) {
  throw new Error(JSON.stringify(parsed.issues, null, 2));
}

const canonicalJson = serializeTokenGraph(parsed.value);
const compiled = compileTokenGraph(parsed.value);

export { canonicalJson, compiled };
```

Strict graph input spells out `kind`, `formatVersion`, `modes`, `defaultMode`, `defaultVisibility`, and token
definitions with `value` or `valueByMode`. Persisted colors are structured values with `colorSpace`, `components`,
`alpha`, and optional `hex`. It does not accept helper-only shorthand.

The published JSON Schemas describe this strict graph shape, strict layer input, and serialized compiled schemes.
They do not describe `defineTokenGraph()` or `defineTokenLayer()` helper input.
They do not describe `defineTokens()` helper input either.
Schemas are structural preflight. Runtime parsers remain the semantic authority for declared modes, per-mode value
coverage, references, cycles, and cross-field constraints.

Compiled schemes are a third shape. They are produced by `compileTokenGraph()` or `buildScheme()` and contain
resolved color values plus dependency and origin metadata for the selected tokens.

## More Docs

- [Documentation site source](https://github.com/maikeleckelboom/scheme-tokens/tree/main/docs-site)
- [Public API](./docs/public-api.md)
- [Diagnostics](./docs/diagnostics.md)
- [Architecture](./docs/architecture.md)
- [Adapter policy](./docs/adapter-policy.md)
- [Roadmap](./docs/roadmap.md)
- [Semver](./docs/semver.md)
