# scheme-tokens

Small token graph compiler for TypeScript apps.

`scheme-tokens` owns authored token graphs, compiled token artifacts, diagnostics, deterministic serialization, and CSS variable export. It does not own palette generation, color science, image extraction, vendor engines, or design-system expansion.

## Install

```sh
pnpm add scheme-tokens
```

## First Path

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  background: {
    base: "#ffffff",
    dark: "#111111",
  },
  foreground: {
    base: "#111111",
    dark: "#ffffff",
  },
});

const compiled = compileTokenGraph(graph);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const background = compiled.scheme.tokens.background.base;

const cssExport = exportCssVars(compiled.scheme);

if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.css;
```

Compiled tokens are plain mode maps:

```text
const baseBackground = compiled.scheme.tokens.background.base;
const darkBackground = compiled.scheme.tokens.background.dark;
```

Advanced compiled metadata lives outside the token value map:

```text
const dependencies = compiled.scheme.metadataByToken.background.dependenciesByMode.dark;
```

## References

Bare strings are literal CSS-ready token values. References are explicit.

```ts
import { compileTokenGraph, defineTokens, tokenRef } from "scheme-tokens";

const graph = defineTokens({
  "brand.primary": {
    value: "#6750a4",
    visibility: "internal",
  },
  primary: tokenRef("brand.primary"),
  literal: "brand.primary",
});

const compiled = compileTokenGraph(graph, { selection: "all" });
```

`primary` resolves through a reference. `literal` remains the literal string `"brand.primary"`.

## Strict Artifacts

The authoring helpers accept ergonomic input and return strict graph artifacts. Persisted graph and layer data stays explicit:

```ts
import { parseTokenGraph } from "scheme-tokens";

const parsed = parseTokenGraph({
  kind: "scheme-tokens/token-graph",
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    background: { value: "#ffffff" },
  },
});

if (parsed.ok) {
  parsed.graph.tokens.background.value;
}
```

Published schemas:

- `scheme-tokens/schemas/token-graph.v1.schema.json`
- `scheme-tokens/schemas/token-layer.v1.schema.json`
- `scheme-tokens/schemas/compiled-scheme.v1.schema.json`

## External Generators

External generators can produce ordinary authored tokens or strict token graphs, then hand that data to `scheme-tokens`.

```ts
import { compileTokenGraph, defineTokens } from "scheme-tokens";

declare function generatePalette(seed: string): {
  primary: string;
  onPrimary: string;
};

const palette = generatePalette("#6750a4");

const graph = defineTokens({
  primary: palette.primary,
  "primary-foreground": palette.onPrimary,
});

const compiled = compileTokenGraph(graph);
```

The generator is userland code. The root package does not ship a Material package, source abstraction, plugin registry, or color engine.

## Documentation

- [Public API](./docs/public-api.md)
- [Architecture](./docs/architecture.md)
- [Diagnostics](./docs/diagnostics.md)
- [Roadmap](./docs/roadmap.md)
- [Semver](./docs/semver.md)
