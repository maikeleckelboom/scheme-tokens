# Public API

The root package exposes a small compiler pipeline for authored string-valued token graphs.

## Runtime exports

| Export                    | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `defineTokens`            | Define the ordinary trusted token graph path.                 |
| `defineTokenGraph`        | Define a trusted graph with explicit graph options or layers. |
| `defineTokenLayer`        | Define a trusted reusable layer.                              |
| `tokenRef`                | Create an explicit token reference.                           |
| `parseTokenGraph`         | Parse an untrusted strict graph artifact.                     |
| `parseTokenLayer`         | Parse an untrusted strict layer artifact.                     |
| `parseCompiledScheme`     | Parse an untrusted strict compiled artifact.                  |
| `compileTokenGraph`       | Resolve and compile a graph.                                  |
| `exportCssVars`           | Project a compiled scheme to CSS custom properties.           |
| `serializeTokenGraph`     | Canonically serialize a strict graph.                         |
| `serializeTokenLayer`     | Canonically serialize a strict layer.                         |
| `serializeCompiledScheme` | Canonically serialize a compiled scheme.                      |

There are no other root runtime exports.

## One result convention

`Result` is public. Every fallible public success lives under `value`; every failure contains a non-empty `issues` tuple.

```ts twoslash
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({ background: "#ffffff" });
const compiled = compileTokenGraph(graph);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

compiled.value.tokens.background?.base;

const exported = exportCssVars(compiled.value);

if (exported.ok) {
  exported.value.css;
  exported.value.blocks;
  exported.value.variableByToken;
}
```

## Authoring grammar

A helper token definition has exactly three forms:

```ts twoslash
import { defineTokens, tokenRef } from "scheme-tokens";

const graph = defineTokens({
  literal: "brand.600",
  reference: tokenRef("brand.600"),
  "brand.600": {
    value: "oklch(62% 0.18 250)",
    visibility: "internal",
    description: "Generated brand source",
    extensions: { owner: "generator" },
  },
});
```

- A direct string or `tokenRef()` expression.
- A direct explicit mode map.
- One expanded `{ value, visibility?, description?, deprecated?, extensions? }` object, where `value` is an expression or mode map.

Bare strings are never references. `valueByMode`, `aliases`, and metadata mixed directly with mode keys are not accepted.

Omitting mode options creates `modes: ["base"]` and `defaultMode: "base"`. Multimode graphs require both `modes` and `defaultMode`:

```ts twoslash
import { defineTokens, tokenRef } from "scheme-tokens";

const graph = defineTokens(
  {
    "brand.600": "oklch(62% 0.18 250)",
    "brand.400": "oklch(78% 0.12 250)",
    background: {
      light: "#ffffff",
      dark: "#111111",
    },
    primary: {
      value: {
        light: tokenRef("brand.600"),
        dark: tokenRef("brand.400"),
      },
      description: "Primary action fill",
    },
  },
  {
    modes: ["light", "dark"],
    defaultMode: "light",
  },
);
```

Mode names cannot be `ref`, `value`, `valueByMode`, `visibility`, `description`, `deprecated`, or `extensions`; reserving those names keeps object authoring unambiguous. Token keys use dot-separated lower-kebab paths, and segments after the first may be numeric, so `brand.600` is valid.

## Layers

Layers have stable identities and local default visibility, but never modes or a default mode. The graph is the sole mode authority. Graph tokens compose first; layers then apply in array order, with later definitions overriding earlier keys.

```ts twoslash
import { compileTokenGraph, defineTokenGraph, defineTokenLayer, tokenRef } from "scheme-tokens";

const generated = defineTokenLayer({
  id: "generated",
  defaultVisibility: "internal",
  tokens: {
    "brand.600": "oklch(62% 0.18 250)",
  },
});

const semantic = defineTokenLayer({
  id: "semantic",
  tokens: {
    primary: tokenRef("brand.600"),
  },
});

const graph = defineTokenGraph({
  tokens: {},
  layers: [generated, semantic],
});

const compiled = compileTokenGraph(graph);
```

The public `primary` token resolves through the internal `brand.600` token before public selection is applied.

## Parsing untrusted data

The four authoring helpers are trusted TypeScript entry points. They validate, normalize, and copy accepted input and may throw for programmer misuse.

The three parsers are the untrusted entry points. They accept `unknown`, do not throw for JSON-compatible data, return owned copies, reject unknown properties and unsupported versions, and report `Result` issues.

```ts twoslash
import { compileTokenGraph, parseTokenGraph } from "scheme-tokens";

declare const json: string;
const input: unknown = JSON.parse(json);
const parsed = parseTokenGraph(input);

if (parsed.ok) {
  const compiled = compileTokenGraph(parsed.value);
}
```

Do not pass untrusted input directly to compilation or serialization.

Parsed key sets are dynamic. `parseCompiledScheme()` therefore always returns an incomplete token record, and CSS export from it keeps `variableByToken` partial.

## Compilation selection

```ts twoslash
import { compileTokenGraph, defineTokens } from "scheme-tokens";

const graph = defineTokens({
  internal: { value: "source", visibility: "internal" },
  public: "output",
});

const publicOnly = compileTokenGraph(graph);
const everything = compileTokenGraph(graph, { selection: "all" });
const exact = compileTokenGraph(graph, {
  selection: { keys: ["public"] },
});

if (publicOnly.ok) {
  publicOnly.value.tokens.public?.base;
}
if (everything.ok) {
  everything.value.tokens.internal.base;
}
if (exact.ok) {
  exact.value.tokens.public.base;
}
```

Omitted and explicit `public` selection produce a conservatively partial token-key type because visibility is applied at runtime. Use optional access for public records. An exact literal key tuple is complete after runtime validation. `all` is complete for a graph with a finite authored key union, but remains partial for `parseTokenGraph(...).value` and other dynamic key sets.

Exact selections reject empty arrays, duplicate keys, malformed keys, and unknown keys. A runtime key array remains partial because it is not a finite literal tuple. Emitted token order is deterministic and independent of selection-array order. For advanced type annotations, `CompiledScheme<Key, Mode, Complete>` represents this completeness, and `CssVarsExport<Key, Mode, Complete>` preserves it in `variableByToken`; ordinary consumers should let both types infer.

## CSS custom properties

`exportCssVars()` returns CSS, structured blocks, and the generated property for each token.

```ts twoslash
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens(
  { background: { light: "#ffffff", dark: "#111111" } },
  { modes: ["light", "dark"], defaultMode: "light" },
);
const compiled = compileTokenGraph(graph);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues));
}

const exported = exportCssVars(compiled.value, {
  prefix: "color",
  modeSelectors: {
    strategy: "selectors",
    selectors: {
      light: ":root",
      dark: ".dark",
    },
  },
  format: "pretty",
});

if (exported.ok) {
  exported.value.variableByToken.background?.toUpperCase();
}
```

The optional lookup mirrors the partial default-public compiled record. CSS from an exact literal selection, or from `all` compilation of a finite authored graph, has a complete token-to-variable map. CSS from `parseCompiledScheme()` stays partial.

Exact selector maps are typed to the compiled mode union: every mode is required and unknown modes are rejected. Selector validation intentionally implements a bounded safe grammar rather than every browser selector feature. Generated data-attribute and class strategies require an append-safe scope; use exact per-mode selectors for supported complex selectors.

See [Application Theme Coordinates](./application-theme-coordinates.md) for combining independent application axes into private compiler modes, selecting an exact semantic contract, and reusing structured declarations for application-owned selector and media-query policy.

Compilation and serialization accept arbitrary token strings. CSS export is stricter because it emits declarations: a declaration-unsafe string fails with `invalid-css-value` instead of being written. This is an output-safety check, not token-domain interpretation.

Declarative prefix, scope, selector, and formatting options are the primary path. `variableName` is an advanced integration escape hatch. It runs in deterministic token order; exceptions, unsafe names, and collisions become issues rather than escaping the operation.

## Strict artifacts and serializers

Strict graph and layer definitions always contain one required `value`; the property holds either an expression or a complete mode map. Strict artifacts include explicit `kind`, `formatVersion`, defaults, and graph modes. Unknown properties and unsupported versions fail parsing.

```ts twoslash
import { parseTokenGraph } from "scheme-tokens";

const parsed = parseTokenGraph({
  $schema: "https://scheme-tokens.dev/schemas/token-graph.v1.schema.json",
  kind: "scheme-tokens/token-graph",
  formatVersion: 1,
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "public",
  tokens: {
    background: {
      value: {
        light: "#ffffff",
        dark: "#111111",
      },
    },
  },
});

if (parsed.ok) {
  parsed.value.tokens.background.value;
}
```

`$schema` is optional. When present, it must be the canonical URI for that graph, layer, or compiled artifact. `kind` identifies the artifact family and `formatVersion` selects its exact supported wire version; parsers do not guess either value.

Schemas are exported at:

- `scheme-tokens/schemas/token-graph.v1.schema.json`
- `scheme-tokens/schemas/token-layer.v1.schema.json`
- `scheme-tokens/schemas/compiled-scheme.v1.schema.json`

The three serializers produce the supported deterministic JSON wire representations. Parse and serialize round trips preserve accepted artifacts.

## Public types

The root type surface centers on `Result`, `Issue`, `TokenReference`, `TokenGraph`, `TokenLayer`, `CompiledScheme`, `CssVarsExport`, and the authoring, option, and issue types needed to use those operations. Public declarations do not expose dependency-internal types.

See [Diagnostics](./diagnostics.md) for issue contracts and [Migration to 0.1](./migration.md) for the reset from the earlier, never-published surface.
