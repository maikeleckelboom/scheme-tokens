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
import { compileTokenGraph, defineTokens, exportCssVariables } from "scheme-tokens";

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

const css = exportCssVariables(compiled.value);
if (!css.ok) {
  throw new Error(JSON.stringify(css.issues, null, 2));
}

console.log(css.value);
```

With no `modes` field, `defineTokens()` creates one mode named `base`. In a single-mode graph, `base` means "the one
ordinary value for this token." It is not a Material role, generated palette, light mode, or dark mode.

The default CSS export uses `:root` for the default mode. Directly authored tokens default to `public`, and compilation
defaults to `selection: "public"`.

Omit `prefix` to emit custom properties such as `--background`, `--foreground`, `--primary`, and
`--primary-foreground`. Pass `prefix: "color"` when you want namespaced variables such as `--color-background`.

## Light and Dark Values

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVariables } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "internal",
  tokens: {
    "brand.primary": {
      light: "#6750a4",
      dark: "#d0bcff",
    },
    "brand.on-primary": {
      light: "#ffffff",
      dark: "#381e72",
    },
    background: {
      visibility: "public",
      light: "#ffffff",
      dark: "#141218",
    },
    foreground: {
      visibility: "public",
      light: "#111111",
      dark: "#f5eff7",
    },
    primary: {
      visibility: "public",
      value: "brand.primary",
    },
    "primary-foreground": {
      visibility: "public",
      value: "brand.on-primary",
    },
  },
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const css = exportCssVariables(compiled.value);
if (!css.ok) {
  throw new Error(JSON.stringify(css.issues, null, 2));
}

console.log(css.value);
```

`defaultVisibility: "internal"` keeps source tokens out of the ordinary compiled scheme unless a token opts into
`visibility: "public"`. Public tokens may reference internal tokens. The compiler resolves those references, so the CSS
exporter receives only the selected compiled tokens and writes variables for that compiled scheme.

To export every token, compile with `compileTokenGraph(graph, { selection: "all" })`. To export a named subset, compile
with `compileTokenGraph(graph, { selection: { keys: ["background"] } })`.

The default CSS selectors are `:root` for the default mode and `:root[data-color-scheme="dark"]` for the dark mode. Pass
`scope` and `modeSelectors` when your app uses classes or exact selectors instead.

## Runtime CSS Variables

`exportCssVariables()` returns a stylesheet string. `exportCssVariableBlocks()` returns structured blocks for runtime
application, previews, or custom renderers that should not parse CSS text.

```ts
import {
  compileTokenGraph,
  defineTokenGraph,
  exportCssVariableBlocks,
  exportCssVariables,
} from "scheme-tokens";

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

const css = exportCssVariables(compiled.value);
const blocks = exportCssVariableBlocks(compiled.value);
if (!css.ok || !blocks.ok) {
  throw new Error("CSS export failed");
}

console.log(css.value);
console.log(blocks.value[0]?.declarations["--background"]);
```

Omit `prefix` to emit custom properties such as `--background`, `--foreground`, `--primary`, and
`--primary-foreground`. Pass `prefix: "color"` to emit names such as `--color-background`.

## Layered Schemes

Use layers when a product needs ordered authored overlays. Sources are optional; a layer-only build does not need an
empty sources array.

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

Layers are ordered token overlays. Sources compose first, layers compose after sources, and later layers win by token
key. This is deterministic token composition, not CSS cascade behavior: there is no selector specificity, `!important`,
CSS `@layer`, DOM mutation, or style injection.

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

Material 3 output is provided by `@scheme-tokens/source-material3`, not by the root package.

```bash
pnpm add scheme-tokens @scheme-tokens/source-material3
```

```ts
import { buildScheme } from "scheme-tokens";
import { material3Source } from "@scheme-tokens/source-material3";

const built = buildScheme(material3Source({ sourceColor: "#6750a4" }));
if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}
```

Add an application layer when generated Material roles should feed project-owned tokens:

```ts
import { buildScheme, defineTokenLayer, exportCssVariables } from "scheme-tokens";
import { material3Source } from "@scheme-tokens/source-material3";

const application = defineTokenLayer<"light" | "dark">({
  id: "application",
  tokens: {
    background: "material3.surface",
    foreground: "material3.on-surface",
    primary: "material3.primary",
    "primary-foreground": "material3.on-primary",
  },
});

const built = buildScheme(
  material3Source({
    sourceColor: "#6750a4",
    defaultVisibility: "internal",
  }),
  { layers: [application] },
);

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}

const css = exportCssVariables(built.value.compiled);
if (!css.ok) {
  throw new Error(JSON.stringify(css.issues, null, 2));
}

console.log(css.value);
```

`buildScheme()` is the runner that composes sources and layers, validates the composed graph material, and produces
`built.value.compiled`. At least one source or layer is required. `buildScheme(source)` is the source-only convenience
form, `buildScheme(source, { layers })` composes source output with application layers, and layer-only builds use the
canonical options object. The Material adapter supplies a real Material source; the root package stays engine-free.

`sourceColor` is the required Material source color used to generate the scheme. Material extended colors are exposed as
`extendedColors`, with entries shaped as `{ name, color, harmonize? }`.

The adapter emits strict `light` and `dark` graph tokens with adapter-owned keys such as `material3.primary`,
`material3.on-primary`, and `material3.primary-container`.

See [`@scheme-tokens/source-material3`](./packages/source-material3/README.md) for adapter-specific options and
composition examples.

## Serialize the Compiled Scheme

```ts
import { compileTokenGraph, defineTokenGraph, serializeScheme } from "scheme-tokens";

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

const json = serializeScheme(compiled.value);
console.log(json);
```

`serializeScheme()` serializes the compiled output, not the authoring input. The output is deterministic and includes
resolved colors, modes, token visibility, origin metadata, and direct dependency metadata.

## Helper Input and Strict Input

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
  defaultVisibility: "internal",
  tokens: {
    "brand.primary": {
      light: "#6750a4",
      dark: "#d0bcff",
    },
    primary: {
      visibility: "public",
      value: "brand.primary",
    },
  },
});
```

Both helpers accept JSON-safe shorthand:

- a color string such as `"#6750a4"`;
- a token-key string reference such as `"brand.primary"`;
- a token object reference such as `{ visibility: "public", value: "brand.primary" }`;
- an explicit reference such as `{ ref: "brand.primary" }`;
- metadata plus mode keys such as `{ visibility: "public", light: "#fff", dark: "#000" }`;
- mode records such as `{ light: "#fff", dark: "#000" }` when modes are declared.

The helpers fill safe defaults and return strict graph input. `parseTokenGraph()` is the persisted wire-format boundary
and stays explicit.

```ts
import { parseTokenGraph } from "scheme-tokens";

const strictGraph = {
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    "brand.primary": { value: "#6750a4" },
    "surface.canvas": { value: "#ffffff" },
  },
} as const;

const parsed = parseTokenGraph(strictGraph);
if (!parsed.ok) {
  throw new Error(JSON.stringify(parsed.issues, null, 2));
}
```

Strict graph input spells out `formatVersion`, `modes`, `defaultMode`, `defaultVisibility`, and token definitions with
`value` or `valueByMode`. It does not accept helper-only shorthand.

The published JSON Schemas describe this strict graph shape, strict layer input, and serialized compiled schemes.
They do not describe `defineTokenGraph()` or `defineTokenLayer()` helper input.
They do not describe `defineTokens()` helper input either.

Compiled schemes are a third shape. They are produced by `compileTokenGraph()` or `buildScheme()` and contain
resolved color values plus dependency and origin metadata for the selected tokens.

## More Docs

- [Public API](./docs/public-api.md)
- [Diagnostics](./docs/diagnostics.md)
- [Architecture](./docs/architecture.md)
- [Adapter policy](./docs/adapter-policy.md)
- [Roadmap](./docs/roadmap.md)
- [Semver](./docs/semver.md)
