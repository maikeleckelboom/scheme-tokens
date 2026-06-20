# color-scheme-tokens

Dependency-light color token graphs for TypeScript and JavaScript applications.

The root package owns JSON-safe authoring input, strict graph parsing, validation, compilation, deterministic
serialization, CSS custom-property export, `Result` / `Issue` contracts, and adapter interfaces. It does not load or
depend on Material 3, Texel, image extraction, browser canvas, CSS parser engines, or color-conversion engines.

This repository is still private at version `0.0.0` while the first public contract is being finalized.

## Quick Start

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVariables } from "color-scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "app.background": "#ffffff",
    "app.text": "#111111",
    "app.action": "#6750a4",
  },
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const css = exportCssVariables(compiled.value, { variablePrefix: "theme" });
if (!css.ok) {
  throw new Error(JSON.stringify(css.issues, null, 2));
}

console.log(css.value);
```

`defineTokenGraph()` defaults `formatVersion` to `1`, creates a single `base` mode when modes are omitted, and defaults
directly authored tokens to `public`. The parser remains strict: persisted wire-format graphs still spell out
`formatVersion`, `modes`, `defaultMode`, `defaultVisibility`, and `tokens`.

Mode names in `defineTokenGraph()` must not use token-definition keys such as `value`, `valueByMode`, `visibility`, or
`description`; those keys are reserved so shorthand detection stays unambiguous.

## Multi-Mode Graphs

```ts
import { compileTokenGraph, defineTokenGraph, serializeTokenSet } from "color-scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "internal",
  tokens: {
    "brand.primary": {
      light: "#6750a4",
      dark: "#d0bcff",
    },
    "app.action": {
      visibility: "public",
      value: { ref: "brand.primary" },
    },
  },
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

console.log(serializeTokenSet(compiled.value));
```

Compilation defaults to `selection: "public"`. Public tokens may reference internal tokens; compiled dependency metadata
records direct dependencies by mode without expanding large transitive lists.

## Adapter Interfaces

```ts
import {
  buildTokenSet,
  defineTokenFragment,
  defineTokenGraph,
  type Issue,
  type Result,
  type TokenGraphInput,
  type TokenSource,
} from "color-scheme-tokens";

interface BrandIssue extends Issue<"missing-brand-primary"> {}

function brandSource(primary?: string): TokenSource<BrandIssue> {
  return {
    id: "brand",
    build(): Result<TokenGraphInput<"light" | "dark">, BrandIssue> {
      if (primary === undefined) {
        return {
          ok: false,
          issues: [{ code: "missing-brand-primary", message: "Primary color is required." }],
        };
      }

      return {
        ok: true,
        value: defineTokenGraph({
          modes: ["light", "dark"],
          defaultMode: "light",
          defaultVisibility: "internal",
          tokens: {
            "brand.primary": {
              light: primary,
              dark: "#b5c4ff",
            },
          },
        }),
      };
    },
  };
}

const application = defineTokenFragment({
  id: "application",
  tokens: {
    "app.action": { ref: "brand.primary" },
  },
});

const built = buildTokenSet({
  source: brandSource("#1455d9"),
  fragments: [application],
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}
```

Core exposes the `TokenSource` structural interface only. Source objects may carry adapter metadata in addition to `id`
and `build`, and core calls `build()` with the source object as its receiver. Engine-backed behavior belongs in separate
adapter packages, for example future `@color-scheme-tokens/source-material3` or
`@color-scheme-tokens/conversion-texel` packages.

## Development

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
```

`release:check` builds the package, validates runtime/type surfaces, checks schemas and docs examples, installs the
packed tarball into a clean consumer, and checks tarball contents. The package remains `private: true`; publishing,
tagging, and release creation are separate owner-controlled steps.
