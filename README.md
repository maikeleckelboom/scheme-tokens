# color-scheme-tokens

Dependency-light color token graphs for TypeScript and JavaScript applications.

The primary core workflow is simple: define a few concrete custom colors, compile the graph, and export CSS custom
properties. Material 3, Texel, image extraction, browser canvas, CSS parser engines, and color-conversion engines are not
part of the root package and are not required for manual custom colors.

This repository is still private at version `0.0.0` while the first public contract is being finalized.

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

const css = exportCssVariables(compiled.value, { variablePrefix: "color" });
if (!css.ok) {
  throw new Error(JSON.stringify(css.issues, null, 2));
}

console.log(css.value);
```

With no `modes` field, `defineTokenGraph()` creates one mode named `base`. In a single-mode graph, `base` means "the one
ordinary value for this token." It is not a Material role, generated palette, light mode, or dark mode.

The default CSS export uses `:root` for the default mode, so the graph above emits one block of variables. Directly
authored tokens default to `public`, and compilation defaults to `selection: "public"`.

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

const css = exportCssVariables(compiled.value, { variablePrefix: "color" });
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

The default CSS selectors are `:root` for the default mode and `:root[data-color-scheme="dark"]` for the dark mode. You
can pass `scope` and `modeSelectors` when your app uses classes or exact selectors instead.

## Helper Input and Strict Input

`defineTokenGraph()` is an ergonomic authoring helper. It accepts JSON-safe shorthand:

- a color string such as `"#6750a4"`;
- a reference such as `{ ref: "brand.primary" }`;
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

## Adapter Runner

`buildTokenSet()` is the core runner for future adapter packages. Core supplies the structural `TokenSource` interface,
calls a source, composes caller fragments, validates the returned graph, and compiles the selected tokens. No adapter
package exists in this slice.

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
          issues: [
            {
              code: "missing-brand-primary",
              message: "Primary color is required.",
            },
          ],
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
              dark: "#d0bcff",
            },
          },
        }),
      };
    },
  };
}

const application = defineTokenFragment<"light" | "dark">({
  id: "application",
  defaultVisibility: "public",
  tokens: {
    "button.background": { ref: "brand.primary" },
  },
});

const built = buildTokenSet({
  source: brandSource("#6750a4"),
  fragments: [application],
});

if (!built.ok) {
  throw new Error(JSON.stringify(built.issues, null, 2));
}
```

Engine-backed behavior belongs in separate packages, for example future `@color-scheme-tokens/source-material3` or
`@color-scheme-tokens/conversion-texel` packages. Material 3 support must use a real Material algorithm through that
adapter boundary, not an approximation inside core. The adapter package model is documented in
[`docs/adapter-policy.md`](./docs/adapter-policy.md).

## Development

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
```

`release:check` builds the package, validates runtime/type surfaces, checks schemas and docs examples, installs the
packed tarball into a clean consumer, and checks tarball contents. The package remains `private: true`; publishing,
tagging, and release creation are separate owner-controlled steps.
