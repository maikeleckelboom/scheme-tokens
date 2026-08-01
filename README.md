# scheme-tokens

Compile authored string-valued token graphs into deterministic schemes and CSS custom properties.

`scheme-tokens` owns references, modes, ordered layers, visibility, validation, compilation, diagnostics, strict persisted artifacts, serialization, and CSS projection. It does not generate palettes, interpret values, or define a design system.

## Install

```sh
pnpm add scheme-tokens
```

## First path

```ts twoslash
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
});

const compiled = compileTokenGraph(graph);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const exported = exportCssVars(compiled.value);

if (!exported.ok) {
  throw new Error(JSON.stringify(exported.issues, null, 2));
}

const stylesheet = exported.value.css;
```

Omitting mode options creates the single mode `base` with `base` as the default.

Compilation and serialization preserve arbitrary token strings. CSS export is stricter because it emits code: declaration-unsafe values fail with an `invalid-css-value` issue.

## Light and dark modes

Multimode authoring always declares both the mode envelope and its default:

```ts twoslash
import { defineTokens } from "scheme-tokens";

const graph = defineTokens(
  {
    background: {
      light: "#ffffff",
      dark: "#111111",
    },
    foreground: {
      value: {
        light: "#111111",
        dark: "#ffffff",
      },
      description: "Default text",
    },
  },
  {
    modes: ["light", "dark"],
    defaultMode: "light",
  },
);
```

There is no inferred multimode envelope or first-key default.

## References and visibility

Bare strings are always literal. Use `tokenRef()` for a reference:

```ts twoslash
import { compileTokenGraph, defineTokens, tokenRef } from "scheme-tokens";

const graph = defineTokens({
  "brand.600": {
    value: "oklch(62% 0.18 250)",
    visibility: "internal",
  },
  primary: tokenRef("brand.600"),
  literal: "brand.600",
});

const compiled = compileTokenGraph(graph);
```

The default `public` selection emits `primary` and `literal`. `primary` can still resolve through the internal `brand.600` token.

Because public visibility is applied at runtime, omitted and explicit `public` selections expose a conservatively partial token record. Use optional access. An exact literal key tuple becomes definite after runtime validation; `selection: "all"` is definite when the authored graph has a finite inferred key union, but remains partial for dynamically parsed graphs.

## Trusted authoring and untrusted data

`defineTokens()`, `defineTokenGraph()`, `defineTokenLayer()`, and `tokenRef()` are trusted TypeScript helpers. They normalize and copy accepted input and may throw for programmer misuse.

Use parsers for untrusted persisted data:

```ts twoslash
import { parseTokenGraph } from "scheme-tokens";

declare const input: unknown;

const parsed = parseTokenGraph(input);

if (parsed.ok) {
  parsed.value.tokens;
} else {
  parsed.issues;
}
```

Parsers accept `unknown`, do not throw for JSON-compatible input, copy accepted data, and return `Result`.

## Persisted artifacts

Strict token definitions always have one required `value`. A multimode persisted value is a mode map under that property; `valueByMode` and `aliases` are not accepted.

Schema package exports:

- `scheme-tokens/schemas/token-graph.v1.schema.json`
- `scheme-tokens/schemas/token-layer.v1.schema.json`
- `scheme-tokens/schemas/compiled-scheme.v1.schema.json`

Canonical serializers are available for each artifact: `serializeTokenGraph()`, `serializeTokenLayer()`, and `serializeCompiledScheme()`.

## Documentation

- [Public API](./docs/public-api.md)
- [Architecture](./docs/architecture.md)
- [Application theme coordinates](./docs/application-theme-coordinates.md)
- [Diagnostics](./docs/diagnostics.md)
- [Value policy](./docs/color-policy.md)
- [Pre-release migration](./docs/migration.md)
- [Semver](./docs/semver.md)
