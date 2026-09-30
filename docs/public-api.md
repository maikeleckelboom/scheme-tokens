# Public API

The root package exposes a small compiler pipeline for authored string-valued token graphs.

## Runtime exports

| Export                    | Purpose                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `defineTokenGraph`        | Define a trusted graph with explicit graph options or layers.          |
| `defineTokenLayer`        | Define a trusted reusable layer.                                       |
| `tokenConcat`             | Build a canonical concat from a reference-only tagged template.        |
| `orThrow`                 | Return success or throw all issues with their original tuple as cause. |
| `tokenRef`                | Create an explicit token reference.                                    |
| `parseTokenGraph`         | Parse an untrusted strict graph artifact.                              |
| `parseTokenLayer`         | Parse an untrusted strict layer artifact.                              |
| `parseCompiledScheme`     | Parse an untrusted strict compiled artifact.                           |
| `compileTokenGraph`       | Resolve and compile a graph.                                           |
| `exportCssVars`           | Project a compiled scheme to CSS custom properties.                    |
| `serializeTokenGraph`     | Canonically serialize a strict graph.                                  |
| `serializeTokenLayer`     | Canonically serialize a strict layer.                                  |
| `serializeCompiledScheme` | Canonically serialize a compiled scheme.                               |

There are no other root runtime exports.

## One result convention

`Result` is public. Every fallible public success lives under `value`; every failure contains a non-empty `issues` tuple.

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "scheme-tokens";

const graph = defineTokenGraph({ tokens: { background: "#ffffff" } });
const compiled = compileTokenGraph(graph);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

compiled.value.tokens.background.base;

const exported = exportCssVars(compiled.value);

if (exported.ok) {
  exported.value.css;
  exported.value.blocks;
  exported.value.variableByToken;
}
```

`orThrow()` returns the exact success value. On failure, its `Error` message includes every issue code, optional path, and message; `cause` contains the entire original issue tuple. Trusted helpers use this structured error convention.

## Authoring grammar

A helper token definition has exactly three forms:

```ts
import { defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    literal: "brand.600",
    reference: tokenRef("brand.600"),
    "brand.600": {
      value: "oklch(62% 0.18 250)",
      visibility: "internal",
      description: "Generated brand source",
      extensions: { owner: "generator" },
    },
  },
});
```

- A direct string, `tokenRef()` reference, or concat expression.
- A direct explicit mode map.
- One expanded `{ value, visibility?, description?, deprecated?, extensions? }` object, where `value` is an expression or mode map.

Bare strings are never references. `valueByMode`, `aliases`, and metadata mixed directly with mode keys are not accepted. For literal input TypeScript rejects these at the offending property, together with reference typos, missing or undeclared modes in a mode map, invalid visibility, and misspelled metadata; see [TypeScript contract](#typescript-contract).

Omitting mode options creates `modes: ["base"]` and `defaultMode: "base"`. Multimode graphs require both `modes` and `defaultMode`:

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
      value: {
        light: tokenRef("brand.600"),
        dark: tokenRef("brand.400"),
      },
      description: "Primary action fill",
    },
  },
});
```

Authored mode order is preserved, independently of `defaultMode`. Mode names are single lower-kebab identifiers such as `light`, `mono-light`, or `material3-dark`; `ref`, `value`, `visibility`, `description`, `deprecated`, and `extensions` are reserved. Token keys use dot-separated lower-kebab paths; segments after the first may be numeric.

`tokenConcat` is a tagged template with reference-only substitutions. An empty template becomes `""`; a lone reference becomes `{ ref }`. Exact `{ concat: [...] }` source expressions merge adjacent literals, drop empty literals, and collapse literal-only content. Empty arrays and nested concat are invalid. Resolved concat is limited to 65,536 UTF-16 code units before joining; arbitrary literals and pure references remain unrestricted.

`concat` is a valid mode name: `{ concat: "opaque" }`, `{ concat: { ref: "a" } }`, and `{ concat: { concat: ["x", { ref: "a" }] } }` are mode maps. Only an exact singleton object with an array under `concat` is a concat expression. `{ concat: [] }` is therefore an invalid expression, never a mode map. `ref`, `value`, `visibility`, `description`, `deprecated`, and `extensions` remain reserved.

## Layers

Layers have stable IDs and local default visibility, but no mode envelope. Direct expressions fit every graph. All mode maps within one layer must name the same set; a non-empty set must exactly match the graph modes, ignoring order. Mismatches return one deterministic `layer-mode-mismatch` per invalid layer. The graph owns mode order and default. Layers compose in array order, then graph tokens compose last. The winner supplies value and descriptive metadata. Omitted visibility preserves prior effective visibility; explicit visibility restates it. With no explicit visibility, the default of the position that introduced the key applies.

```ts
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

A literal layer carries its mode set in its type: `never` without mode maps, the union of its mode-map names otherwise, and `string` for a parsed or dynamically built layer. Every mode map in a literal layer must name that whole set, so a disagreeing map fails on its own token. `defineTokenGraph` rejects a finite layer set that differs from a finite graph set with a `LayerModeMismatch<LayerModes, GraphModes>` diagnostic; when either set is `string`, only the runtime `layer-mode-mismatch` check applies.

## Parsing untrusted data

The four authoring helpers are trusted TypeScript entry points. They validate, normalize, and copy accepted input and may throw for programmer misuse.

The three parsers are the untrusted entry points. They accept `unknown`, do not throw for JSON-compatible data, return owned copies, reject unknown properties and unsupported versions, and report `Result` issues.

```ts
import { compileTokenGraph, parseTokenGraph } from "scheme-tokens";

declare const json: string;
const input: unknown = JSON.parse(json);
const parsed = parseTokenGraph(input);

if (parsed.ok) {
  const compiled = compileTokenGraph(parsed.value);
}
```

Do not pass untrusted input directly to compilation or serialization.

Parsed key sets are dynamic. `parseTokenGraph()` returns `TokenGraph`, whose keys and public keys are `string`, and `parseTokenLayer()` returns `TokenLayer`, whose mode set and visibility TypeScript does not know. `parseCompiledScheme()` always returns an incomplete token record, and CSS export from it keeps `variableByToken` partial.

## Compilation selection

```ts
import { compileTokenGraph, defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    internal: { value: "source", visibility: "internal" },
    public: "output",
  },
});

const publicOnly = compileTokenGraph(graph);
const everything = compileTokenGraph(graph, { selection: "all" });
const exact = compileTokenGraph(graph, {
  selection: { keys: ["public"] },
});

if (publicOnly.ok) {
  publicOnly.value.tokens.public.base;
}
if (everything.ok) {
  everything.value.tokens.internal.base;
}
if (exact.ok) {
  exact.value.tokens.public.base;
}
```

Omitted and explicit `public` selection return a complete record keyed exactly by the public keys when TypeScript knows them: every key is finite, and every visibility along layer order and graph-last composition is a literal. Uncertain visibility, such as a value typed `TokenVisibility`, or a dynamic key set anywhere in the composition keeps the public record partial over every graph key. `all` is complete whenever the composed key set is finite, whatever the visibility. An exact literal key tuple is complete after runtime validation. `parseTokenGraph(...).value`, graphs built from `Record<string, …>` or `Object.fromEntries`, layer lists that are not tuples, and parsed layers stay partial.

Exact selections reject empty arrays, duplicate keys, malformed keys, and unknown keys. A runtime key array remains partial because it is not a finite literal tuple. Emitted token order is deterministic and independent of selection-array order. For advanced type annotations, `CompiledScheme<Key, Mode, Complete>` represents this completeness, and `CssVarsExport<Key, Mode, Complete>` preserves it in `variableByToken`; ordinary consumers should let both types infer.

## Compiled metadata

Compiled values remain `tokens[key][mode]`. Metadata contains effective `visibility` and non-empty `declarations` in composition order. Each declaration contains `origin: { kind: "graph" }` or `{ kind: "layer", id }`, plus `visibility` only when explicitly authored. The last declaration wins. Sparse `expressionByMode` omits literal modes, retains pure `{ ref }` records without duplicated values, and retains canonical concat parts with `{ ref, value }` for referenced parts. Descriptions, deprecation, and extensions come only from the winner.

## CSS custom properties

`exportCssVars()` returns CSS, structured blocks, and the generated property for each token.

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: { background: { light: "#ffffff", dark: "#111111" } },
});
const scheme = orThrow(compileTokenGraph(graph));

const cssVars = orThrow(
  exportCssVars(scheme, {
    prefix: "color",
    modeSelectors: {
      strategy: "selectors",
      selectors: {
        light: ":root",
        dark: ".dark",
      },
    },
    format: "pretty",
  }),
);

cssVars.variableByToken.background.toUpperCase();
```

`variableByToken` mirrors the compiled record: complete for a finite, fully known public selection, a finite `all` selection, or an exact literal tuple, and partial for dynamic or uncertain selections and for `parseCompiledScheme()` output.

Exact selector maps are typed to the compiled mode union: every mode is required and unknown modes are rejected. Each entry is already the complete selector for its mode, so `scope` must be omitted with the exact `selectors` strategy. TypeScript rejects that incompatible option combination; the runtime still returns `invalid-scope` for untyped or mutated input. Selector validation intentionally implements a bounded safe grammar rather than every browser selector feature. Generated data-attribute and class strategies require an append-safe scope; use exact per-mode selectors for supported complex selectors.

See [Application Theme Coordinates](./application-theme-coordinates.md) for combining independent application axes into private compiler modes, selecting an exact semantic contract, and reusing structured declarations for application-owned selector and media-query policy. See [Tailwind CSS v4](./tailwind-css-v4.md) for bridging application-owned runtime variables into Tailwind color utilities.

Compilation and serialization accept arbitrary token strings. CSS export is stricter because it emits declarations: a declaration-unsafe string fails with `invalid-css-value` instead of being written. This is an output-safety check, not token-domain interpretation.

Declarative prefix, scope, selector, and formatting options are the primary path. `variableName` is an advanced integration escape hatch. It runs in deterministic token order; exceptions, unsafe names, and collisions become issues rather than escaping the operation.

## Strict artifacts and serializers

Strict graph and layer definitions always contain one required `value`; the property holds either an expression or a complete mode map. Strict artifacts include explicit `kind`, `formatVersion`, defaults, and graph modes. Unknown properties and unsupported versions fail parsing.

```ts
import { parseTokenGraph } from "scheme-tokens";

const parsed = parseTokenGraph({
  $schema: "https://cdn.jsdelivr.net/npm/scheme-tokens@0.4.0/schemas/token-graph.v2.schema.json",
  kind: "scheme-tokens/token-graph",
  formatVersion: 2,
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

Current writers emit `formatVersion: 2`. Source parsers also accept historical v1 graphs/layers, upgrade once, and validate under the same current rules. Shadowed graph declarations move to a deterministic leading synthetic layer; only necessary visibility restatements are added, and historical default-first mode order is preserved. V1 schema hints are validated historically and dropped on upgrade. Standalone inconsistent layer maps return `layer-mode-mismatch`. Compiled v1 is rejected with `invalid-format-version`: recompile its source graph.

In v2, `$schema` may be any string. It is preserved verbatim, never fetched or used for version selection, and never synthesized. Trusted helpers do not accept `$schema`. Only `kind` and `formatVersion` select the runtime format. A documented editor hint for the planned 0.4 release is `https://cdn.jsdelivr.net/npm/scheme-tokens@0.4.0/schemas/token-graph.v2.schema.json`; that release is not published yet. Each packaged schema has a stable identity such as `tag:maikel.site,2026-09-29:scheme-tokens/schema/token-graph/v2`. All three are self-contained Draft 2020-12 with fragment-only internal references.

Schemas are exported at:

- `scheme-tokens/schemas/token-graph.v2.schema.json`
- `scheme-tokens/schemas/token-layer.v2.schema.json`
- `scheme-tokens/schemas/compiled-scheme.v2.schema.json`

The three serializers produce the supported deterministic JSON wire representations. Parse and serialize round trips preserve accepted artifacts.

## TypeScript contract

The supported compiler is TypeScript `>= 7.0 < 8.0`. `defineTokenGraph` returns `DefinedTokenGraph<Key, Mode, PublicKey, OwnKey>`, a `TokenGraph<Key, Mode, PublicKey>`: every composed key, the mode union, and the effective public keys after layers compose in array order and graph tokens compose last. `graph.tokens` holds only the graph's own declarations, so its authored keys (`OwnKey`) are definite there and a key that only a layer declares is not. The mode type is a union; it says nothing about authored order or which mode is the default. `defineTokenLayer` infers `TokenLayer<Key, Mode, Visibility>`, where `Mode` is the layer mode set and `Visibility` is a `LayerVisibility`: the layer default, and the keys that may declare `public`, declare `internal`, or omit visibility. A wider type only adds possibilities, so plain `TokenGraph` and `TokenLayer` describe unknown data.

Literal input is checked by a strict constraint, and each failure lands on the offending property. Reference typos keep TypeScript's "Did you mean" suggestion. Other failures name a diagnostic marker in the compiler message: `UnknownTokenProperty<Name>`, `UnknownMode<Name>`, `InvalidModeName<Name>` for a mode outside the lower-kebab grammar or a reserved name, and `LayerModeMismatch<LayerModes, GraphModes>`. Markers explain a rejection; their wording and shape are not a compatibility contract, and they are not exported.

A precise static claim is nominal: only `defineTokenGraph`, `defineTokenLayer`, and the values that flow from them make one. An object literal, a spread copy, a mapped type such as `Readonly<…>`, or a layer written inline in `layers` fits only the plain `TokenGraph` and `TokenLayer` forms and is treated like parsed data. A finite key union is an exact claim: a graph or layer type with other keys is not assignable to it, while every graph and layer is assignable to the plain forms. Compiling a union of graphs yields one scheme type per graph.

## Public types

The root type surface centers on `Result`, `Issue`, `TokenReference`, `TokenGraph`, `DefinedTokenGraph`, `TokenLayer`, `LayerVisibility`, `CompiledScheme`, `CssVarsExport`, and the authoring, option, and issue types needed to use those operations. Public declarations do not expose dependency-internal types or validation machinery.

See [Diagnostics](./diagnostics.md) for issue contracts and [Migration to 0.1](./migration.md) for the reset from the earlier, never-published surface.
