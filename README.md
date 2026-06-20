# color-scheme-tokens

Dependency-light color token graphs for TypeScript and JavaScript applications.

Use the root package when you want to author color tokens, compile a selected token set, serialize deterministic JSON, or
export CSS custom properties. Optional engines such as Material 3 live in adapter packages; hand-authored tokens do not
load those dependencies.

## Install

```bash
pnpm add color-scheme-tokens
```

## Quick Start

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVariables } from "color-scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.primary": "#6750a4",
    "brand.on-primary": "#ffffff",
    "surface.canvas": "#ffffff",
  },
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const css = exportCssVariables(compiled.value, { prefix: "color" });
if (!css.ok) {
  throw new Error(JSON.stringify(css.issues, null, 2));
}

console.log(css.value);
```

With no `modes` field, `defineTokenGraph()` creates one mode named `base`. In a single-mode graph, `base` means "the one
ordinary value for this token." It is not a Material role, generated palette, light mode, or dark mode.

The default CSS export uses `:root` for the default mode. Directly authored tokens default to `public`, and compilation
defaults to `selection: "public"`.

## Light and Dark Values

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVariables } from "color-scheme-tokens";

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
    "button.background": {
      visibility: "public",
      value: { ref: "brand.primary" },
    },
    "button.foreground": {
      visibility: "public",
      value: { ref: "brand.on-primary" },
    },
  },
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const css = exportCssVariables(compiled.value, { prefix: "color" });
if (!css.ok) {
  throw new Error(JSON.stringify(css.issues, null, 2));
}

console.log(css.value);
```

`defaultVisibility: "internal"` keeps source tokens out of the ordinary compiled set unless a token opts into
`visibility: "public"`. Public tokens may reference internal tokens. The compiler resolves those references, so the CSS
exporter receives only the selected compiled tokens and writes variables for that set.

To export every token, compile with `compileTokenGraph(graph, { selection: "all" })`. To export a named subset, compile
with `compileTokenGraph(graph, { selection: { keys: ["button.background"] } })`.

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
} from "color-scheme-tokens";

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

## Optional Material 3

Material 3 output is provided by `@color-scheme-tokens/source-material3`, not by the root package.

```bash
pnpm add color-scheme-tokens @color-scheme-tokens/source-material3
```

```ts
import { buildTokenSet, defineTokenFragment, exportCssVariables } from "color-scheme-tokens";
import { material3Source } from "@color-scheme-tokens/source-material3";

const application = defineTokenFragment<"light" | "dark">({
  id: "application",
  defaultVisibility: "public",
  tokens: {
    "app.background": "material3.surface",
    "app.foreground": "material3.on-surface",
    "app.action": "material3.primary",
  },
});

const built = buildTokenSet({
  sources: [
    material3Source({
      sourceColor: "#6750a4",
      defaultVisibility: "internal",
    }),
  ],
  fragments: [application],
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}

const css = exportCssVariables(built.value.compiled, { prefix: "color" });
if (!css.ok) {
  throw new Error(JSON.stringify(css.issues, null, 2));
}
```

`buildTokenSet()` is the runner that composes one or more sources plus fragments, validates the returned graph material,
and produces `built.value.compiled`. The Material adapter supplies a real Material source; the root package stays
engine-free.

`sourceColor` is the required Material source color used to generate the scheme. Material extended colors are exposed as
`extendedColors`, with entries shaped as `{ name, color, harmonize? }`.

The adapter emits strict `light` and `dark` graph tokens under the `material3` namespace by default, such as
`material3.primary`, `material3.on-primary`, and `material3.primary-container`.

See [`@color-scheme-tokens/source-material3`](./packages/source-material3/README.md) for adapter-specific options and
composition examples.

## Serialize the Compiled Set

```ts
import { compileTokenGraph, defineTokenGraph, serializeTokenSet } from "color-scheme-tokens";

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

const json = serializeTokenSet(compiled.value);
console.log(json);
```

`serializeTokenSet()` serializes the compiled output, not the authoring input. The output is deterministic and includes
resolved colors, modes, token visibility, origin metadata, and direct dependency metadata.

## Helper Input and Strict Input

`defineTokenGraph()` is an ergonomic authoring helper. It accepts JSON-safe shorthand:

- a color string such as `"#6750a4"`;
- a token-key string reference such as `"brand.primary"`;
- an explicit reference such as `{ ref: "brand.primary" }`;
- mode records such as `{ light: "#fff", dark: "#000" }` when modes are declared.

The helper fills safe defaults and returns strict graph input. `parseTokenGraph()` is the persisted wire-format boundary
and stays explicit.

```ts
import { parseTokenGraph } from "color-scheme-tokens";

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

The published JSON Schemas describe this strict graph shape, strict fragment input, and serialized compiled token sets.
They do not describe `defineTokenGraph()` or `defineTokenFragment()` helper input.

Compiled token sets are a third shape. They are produced by `compileTokenGraph()` or `buildTokenSet()` and contain
resolved color values plus dependency and origin metadata for the selected tokens.

## More Docs

- [Public API](./docs/public-api.md)
- [Diagnostics](./docs/diagnostics.md)
- [Architecture](./docs/architecture.md)
- [Adapter policy](./docs/adapter-policy.md)
- [Semver](./docs/semver.md)
