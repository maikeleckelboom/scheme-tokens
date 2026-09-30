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
    system: { dark: "(prefers-color-scheme: dark)" },
    selectors: { dark: ".dark" },
    format: "pretty",
  }),
);

cssVars.variableByToken.background.toUpperCase();
```

`variableByToken` mirrors the compiled record: complete for a finite, fully known public selection, a finite `all` selection, or an exact literal tuple, and partial for dynamic or uncertain selections and for `parseCompiledScheme()` output.

### Activation

A block holds one mode's declarations under one condition. Blocks are emitted in four tiers:

| Tier       | Condition                                              | Option and default                                        |
| ---------- | ------------------------------------------------------ | --------------------------------------------------------- |
| `base`     | the default mode at `root`                             | `root`, default `:root`; `:host` for a shadow root        |
| `system`   | a media condition selects a mode at `root`             | `system`, none: core does not know which mode is dark     |
| `explicit` | an attribute marker selects a mode on any element      | `attribute`, `data-theme` with several modes; `false` off |
| `custom`   | author selectors, each optionally inside a media query | `selectors`, none                                         |

Within a tier, blocks follow the scheme's authored mode order, and a mode's custom conditions keep their order. Every generated selector, custom ones included, is wrapped in `:where()` and has zero specificity, so when several blocks match one element, the later block wins. The tier order therefore makes explicit markers beat the system preference and custom conditions beat both. Every block declares every selected token, in canonical key order, so a later block replaces all of an earlier one.

- Explicit markers are unanchored and include the default mode, so any element can switch modes and nested islands work in both directions. A marker value that is not a mode, such as `data-theme="system"`, matches nothing and leaves the system preference in charge. There is no exclusion guard.
- With `root: ":host"`, base and system blocks target the host, and each marker targets both the host and elements inside the shadow tree: `:where(:host([data-theme="dark"]), [data-theme="dark"])`.
- `system` and `selectors` are partial maps keyed by the compiled mode union; TypeScript rejects unknown modes of a finite scheme, and the runtime returns `unknown-condition-mode` for dynamic input. A custom entry is one selector, or a non-empty list of `{ selector, media? }` conditions.
- Custom conditions may overlap. When conditions of two modes match one element, the later mode in authored order wins, so author two-axis modes from general to specific, and use `:not()` in a selector for conditions that must stay disjoint. Two mode classes on one element are an application error with a deterministic outcome, not a supported way to express intent.
- Omitting `attribute` and setting it to `false` differ: omission selects the conventional default, and `false` generates no markers. An explicit attribute applies to a one-mode scheme too.

Application rules follow the normal cascade. Origin, importance, and cascade layers are compared before specificity. In the same layer, an application rule with any specificity overrides a generated declaration whether its stylesheet comes before or after the tokens, and a zero-specificity rule such as `:where(…)` competes by order. `cascadeLayer` wraps the whole output in `@layer <name>`: unlayered declarations and later layers then win over the tokens, earlier layers lose, and `!important` reverses layer order. The exporter never emits `!important`.

The exporter emits custom properties only. A mode-level value such as `color-scheme` is a token that application CSS binds. `color-scheme` inherits as a computed value, so a binding on `:root` alone leaves a nested differently themed section with the root's scheme. Bind it wherever a mode can activate, with `:root, [data-theme] { color-scheme: var(--color-scheme); }`, or with `:where(*)` when custom conditions activate modes.

Each block reports `tier`, `mode`, `selectors`, optional `media`, and `declarations` of `{ tokenKey, property, value }`. Its CSS rule is `:where(<selectors joined by ", ">)`, inside `@media <media>` when present, so an application can re-emit blocks without parsing the generated CSS.

### Names and grammar

Default names are `--`, the optional lower-kebab `prefix` and a hyphen, then the key segments joined with single hyphens: `action.primary.background` becomes `--action-primary-background`, or `--app-action-primary-background` with `prefix: "app"`. Structurally different keys such as `a-b.c` and `a.b-c` then share `--a-b-c`. Every collision among the exported tokens fails with `duplicate-css-variable`, naming the first key in code-unit order, the later key, and the shared property; internal tokens outside the selection never collide. `variableName` is an escape hatch for genuine exceptions: it receives the token key, its segments, the default name, and the prefix when one is supplied, runs in deterministic token order, and its results pass the same safety and collision checks. Exceptions, unsafe names, and collisions become issues rather than escaping the operation.

Selectors, media conditions, and layer names use intentionally bounded grammars rather than every browser feature:

- selectors: type, universal, class, id, and attribute selectors, `:root`, `:host`, `:host(<compound>)`, and `:is()`, `:not()`, `:where()` over selector lists, joined by combinators and commas, up to 256 characters and eight nested functional pseudo-classes;
- media conditions: an optional `not` or `only` media type (`all`, `print`, `screen`) followed by `and` conditions, or conditions of parenthesized features joined by `not`, `and`, or `or` without mixing them; features are `(name)`, `(name: value)`, or a range such as `(width >= 48rem)`; keywords, names, and units are lowercase, query lists with commas are excluded, up to 256 characters and eight nested parentheses;
- `cascadeLayer`: dot-separated lower-kebab segments, none of them a CSS-wide keyword, such as `tokens` or `app.tokens`.

Input outside a grammar returns a structured issue; it is never sanitized.

See [Application Theme Coordinates](./application-theme-coordinates.md) for combining independent application axes into private compiler modes and activating them with a system fallback and ordered custom conditions. See [Tailwind CSS v4](./tailwind-css-v4.md) for bridging runtime variables into Tailwind color utilities.

Compilation and serialization accept arbitrary token strings. CSS export is stricter because it emits declarations: a declaration-unsafe string fails with `invalid-css-value` instead of being written. Each emitted value is checked once, however many blocks declare it. This is an output-safety check, not token-domain interpretation. Option, name, and value failures are all collected rather than reported one at a time.

CSS safety checks protect CSS syntax and declaration boundaries. The returned CSS string is not HTML-escaped: even a quoted CSS string containing `</style>` can terminate a style element when interpolated into HTML source. If generated CSS can contain untrusted strings, do not interpolate it into HTML markup; assign stylesheet text through the DOM, for example with a style element's `textContent`. These checks do not sanitize valid CSS semantics.

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

A precise static claim is nominal: only `defineTokenGraph`, `defineTokenLayer`, and the values that flow unchanged from them make one, however those values are assigned or passed. An object literal, a spread copy, a mapped type such as `Readonly<…>`, or a layer written inline in `layers` fits only the plain `TokenGraph` and `TokenLayer` forms and is treated like parsed data. A finite key union is an exact claim: a graph or layer type with other keys is not assignable to it, while every graph and layer is assignable to the plain forms. Compiling a union of graphs yields one scheme type per graph.

Explicit assertions, and runtime rewrites that TypeScript still types as the original value, are outside this guarantee. `Object.assign({}, graph, { defaultVisibility: "internal" })` has the type of `graph`, proof included, although its public keys differ, because TypeScript types the merge as an intersection with `graph`; after an in-place `Object.assign(graph, …)` or a write through `any`, `graph` keeps its type. To change keys, visibility, layers, or modes, define the new graph or layer with `defineTokenGraph` or `defineTokenLayer`, which derive fresh facts. Persisted or untrusted data goes through the parsers.

## Public types

The root type surface centers on `Result`, `Issue`, `TokenReference`, `TokenGraph`, `DefinedTokenGraph`, `TokenLayer`, `LayerVisibility`, `CompiledScheme`, `CssVarsExport`, `CssVarBlock`, `CssCondition`, and the authoring, option, and issue types needed to use those operations. Public declarations do not expose dependency-internal types or validation machinery.

See [Diagnostics](./diagnostics.md) for issue contracts and [Migration to 0.1](./migration.md) for the reset from the earlier, never-published surface.
