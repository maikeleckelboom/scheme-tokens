# scheme-tokens

Small color token graphs for TypeScript apps.

Use `scheme-tokens` when one canonical token model should produce deterministic CSS custom properties while still being
available as typed TypeScript data. The root package is not a CSS color utility, styling framework, theme runtime, or
target-framework generator.

Authored color values are opaque CSS color strings. Root preserves them, emits them, and serializes them. It does not
parse, normalize, convert, format, gamut-map, or validate CSS color correctness.

## Install

```bash
pnpm add scheme-tokens
```

## First Path

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

The stylesheet is deterministic:

```css
:root {
  --background: #ffffff;
  --foreground: #111111;
  --primary: #6750a4;
  --primary-foreground: #ffffff;
}
```

Use those variables in app CSS:

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

## Typed Access

Compilation returns typed token data before any CSS is rendered:

```ts
import { compileTokenGraph, defineTokens } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const background = compiled.value.tokens.background.valueByMode.base;

export { background };
```

`background` is the authored string `"#ffffff"`. Root does not reinterpret it.

## Light and Dark

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

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

The default CSS export uses `:root` for the default mode and `:root[data-color-scheme="dark"]` for the dark mode.

## Explicit Graphs

Use `defineTokenGraph()` when a graph needs metadata, internal implementation tokens, or aliases:

```ts
import { compileTokenGraph, defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.primary": {
      value: "#6750a4",
      visibility: "internal",
    },
  },
  aliases: {
    primary: "brand.primary",
  },
});

const compiled = compileTokenGraph(graph);

export { compiled };
```

Bare strings are always color values. They are not treated as references based on spelling. Use `aliases`,
`tokenRef("other.token")`, or `{ ref: "other.token" }` for references.

## CSS Export

`exportCssVars()` returns one `Result` with:

- `css`: the stylesheet string;
- `blocks`: ordered structured declarations for previews or custom renderers;
- `variableByToken`: token key to CSS custom-property lookup.

Pass `prefix: "theme"` when the emitted custom properties need a namespace such as `--theme-background`. Omit `prefix`
for direct names such as `--background`.

## Material 3 Adapter

Material 3 support lives in `@scheme-tokens/material3`, not the root package.

```bash
pnpm add scheme-tokens @scheme-tokens/material3
```

```ts
import { buildScheme, defineTokenLayer, exportCssVars } from "scheme-tokens";
import { material3 } from "@scheme-tokens/material3";

const app = defineTokenLayer<"light" | "dark">({
  id: "app",
  aliases: {
    "app.background": "material3.surface",
    "app.foreground": "material3.on-surface",
    "app.primary": "material3.primary",
    "app.primary-foreground": "material3.on-primary",
  },
});

const built = buildScheme(material3("#6750a4"), { layers: [app] });
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

The adapter accepts strict `#rrggbb` source colors and emits generated Material token values as CSS strings. The root
package does not parse source colors for the adapter and does not load the Material engine.

## Strict Artifacts

`parseTokenGraph()`, `parseTokenLayer()`, and `parseCompiledScheme()` validate strict persisted artifacts. The strict
formats use `kind`, `formatVersion`, modes, token records, and string values. Helper shorthand belongs at authoring
boundaries through `defineTokens()`, `defineTokenGraph()`, and `defineTokenLayer()`.

`serializeTokenGraph()`, `serializeTokenLayer()`, and `serializeCompiledScheme()` produce deterministic JSON for those
strict shapes.

## Deliberate Non-Goals

The root package deliberately does not:

- parse CSS color grammar;
- normalize color strings;
- convert between color spaces;
- validate browser color support;
- generate palettes;
- repair contrast;
- emit framework-specific scaffolds;
- load optional engines from root imports.

Future color conversion or projection belongs in optional adapter packages such as `@scheme-tokens/texel`.

## More Docs

- [Public API](./docs/public-api.md)
- [Diagnostics](./docs/diagnostics.md)
- [Architecture](./docs/architecture.md)
- [Color policy](./docs/color-policy.md)
- [Roadmap](./docs/roadmap.md)
- [`@scheme-tokens/material3`](./packages/material3/README.md)
