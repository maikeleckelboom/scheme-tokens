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

Only the trusted `defineTokenGraph()` input may omit `tokens`; omission becomes an owned empty record. Canonical graphs, parsers, and schemas still require `tokens`.

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

Layers have stable IDs and local default visibility, but no mode envelope. Direct expressions fit every graph. All mode maps within one layer must name the same set; a non-empty set must exactly match the graph modes, ignoring order. Disagreeing maps inside a layer return `inconsistent-layer-modes`; a consistent layer that differs from its graph returns `layer-mode-mismatch`. Each reports one deterministic failure per invalid layer. The graph owns mode order and default. Layers compose in array order, then graph tokens compose last. The winner supplies value and descriptive metadata. Omitted visibility preserves prior effective visibility; explicit visibility restates it. With no explicit visibility, the default of the position that introduced the key applies.

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
  layers: [generated, semantic],
});

const compiled = compileTokenGraph(graph);
```

The public `primary` token resolves through the internal `brand.600` token before public selection is applied. The composition root omits graph-local `tokens`; the helper still returns canonical `tokens: {}`.

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
  selection: ["public"],
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

Ordinary key arrays are accepted; no non-empty tuple annotation is required. At runtime, explicit selections reject empty arrays, duplicate keys, malformed keys, and unknown keys. A runtime key array remains partial because it is not a finite literal tuple. Emitted token order is deterministic and independent of selection-array order. For advanced type annotations, `CompiledScheme<Key, Mode, Complete>` represents this completeness, and `CssVarsExport<Key, Mode, Complete>` preserves it in `variableByToken`; ordinary consumers should let both types infer.

## Compiled metadata

Compiled values remain `tokens[key][mode]`. Metadata contains effective `visibility` and non-empty `declarations` in composition order. Each declaration contains `origin: { kind: "graph" }` or `{ kind: "layer", id }`, plus `declaredVisibility` only when explicitly authored. The last declaration wins. Sparse `expressionByMode` omits literal modes, retains pure `{ ref }` records without duplicated values, and retains canonical concat parts with `{ ref, value }` for referenced parts. Descriptions, deprecation, and extensions come only from the winner.

## CSS custom properties

`exportCssVars()` returns CSS, structured blocks, and the generated property for each token.

Options are `prefix`, `variableName`, `format` (`pretty` or `compact`), `references` (`resolved` or `var`), `activation`, and `cascadeLayer`.

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
    activation: { media: { dark: "(prefers-color-scheme: dark)" }, selectors: { dark: ".dark" } },
    prefix: "color",
    format: "pretty",
  }),
);

cssVars.variableByToken.background.toUpperCase();
```

`variableByToken` mirrors the compiled record: complete for a finite, fully known public selection, a finite `all` selection, or an exact literal tuple, and partial for dynamic or uncertain selections and for `parseCompiledScheme()` output.

### Reference projection

Omission, explicit `undefined`, and `references: "resolved"` preserve resolved output exactly. `references: "var"` uses only the emitted token/mode's sparse `metadataByToken[key].expressionByMode[mode]`. Without an expression the resolved string is unchanged. A pure reference links its direct target as `var(<actual name>)` when that target is in the compiled scheme's own token key set; otherwise it inlines the referencing token's own resolved mode value. Concat preserves literal parts and their order, linking each emitted direct target independently or inlining the part's retained `value`, with no added separators or `var()` fallback argument.

Actual emitted membership governs links, independently of visibility: an internal target in `all` or exact selection links; an omitted public target is inlined. D8's internal/public example describes ordinary public selection. The exporter adds no dependencies and has no selection option. A → B → C with B omitted inlines A instead of bypassing B. Authored `var(...)` strings stay opaque; no compiler reference is inferred from CSS syntax. Names are built once, in canonical code-unit token order, and links reuse `variableByToken[target]`, honoring `prefix` and `variableName`. Omitted targets never invoke the callback. A naming failure or collision fails export rather than changing an eligible link to literal output.

Every block redeclares every alias, even when its projected text is identical across modes. A target override on a declaration/activation element propagates through its local aliases, including a same-element unlayered override when tokens are in a cascade layer, in either stylesheet order. An unmarked descendant's target override does not update an inherited alias, because custom properties inherit already-computed values. Declaration order remains canonical rather than topological.

Core concat joins characters, while CSS `var()` substitutes token streams. `calc(var(--spacing) * 2)` can stay live when consumed as width or padding, but with a numeric target of `20`, `var(--number)px` is not `20px`. Inserted `var()` text inside a quoted CSS string remains literal text: `"20"` becomes `"var(--number)"`. Resolved output supports arbitrary string assembly; projection never repairs quoting, infers separators, rewrites `calc()`, or inlines based on CSS context. See the [CSS export guide](../docs-site/guide/export-css-variables.md#reference-output) for an executable example and browser-proved propagation limits.

### Activation

Selector maps accept a string, one `{ selector, media? }` object, or a non-empty list of those objects. A block holds one mode's declarations under one condition. Blocks are emitted in four tiers:

| Tier        | Condition                                 | Option and default                               |
| ----------- | ----------------------------------------- | ------------------------------------------------ |
| `default`   | the default mode at the root selector     | `activation.root`, default `:root`               |
| `media`     | a media condition selects a mode at root  | `activation.media`, no conditions by default     |
| `attribute` | a marker selects a mode on an element     | `activation.attribute`, no markers by default    |
| `selector`  | author selectors, optionally inside media | `activation.selectors`, no conditions by default |

Within a tier, blocks follow the scheme's authored mode order, and a mode's selector conditions keep their order. Every generated selector, custom ones included, is wrapped in `:where()` and has zero specificity, so when several blocks match one element, the later block wins. The tier order therefore makes attribute markers beat media activation and selector conditions beat both. Every block declares every selected token, in canonical key order, so a later block replaces all of an earlier one.

Attribute markers are unanchored and include the default mode, so nested elements can switch back to it. Unknown marker values match no block. The string shorthand targets ordinary elements only. Set `activation.attribute` to `{ name: "data-mode", includeHost: true }` to add `:host([data-mode="dark"])` beside `[data-mode="dark"]`. `activation.root` affects only default and media rules; `:root`, `:host`, `:host(.app)`, `#app`, and `.theme-root` never change attribute targeting.

Application rules follow the normal cascade. Origin, importance, and cascade layers are compared before specificity. In the same layer, an application rule with any specificity overrides a generated declaration whether its stylesheet comes before or after the tokens, and a zero-specificity rule such as `:where(…)` competes by order. `cascadeLayer` wraps the whole output in `@layer <name>`: unlayered declarations and later layers then win over the tokens, earlier layers lose, and `!important` reverses layer order. The exporter never emits `!important`.

The exporter emits custom properties only. A mode-level value such as `color-scheme` is a token that application CSS binds. `color-scheme` inherits as a computed value, so a binding on `:root` alone leaves a nested differently themed section with the root's scheme. Bind it wherever a mode can activate, with `:root, [data-theme] { color-scheme: var(--color-scheme); }`, or with `:where(*)` when selector conditions activate modes.

Each block reports `tier`, `mode`, `selectors`, optional `media`, and `declarations` of `{ tokenKey, property, value }`. The declaration `value` is the exact complete, safety-checked value inserted into either CSS format. Its rule is `:where(<selectors joined by ", ">)`, inside `@media <media>` when present. Blocks preserve declaration fidelity, but do not independently encode formatting or the `cascadeLayer` wrapper.

### Names and grammar

Default names are `--`, the optional lower-kebab `prefix` and a hyphen, then the key segments joined with single hyphens: `action.primary.background` becomes `--action-primary-background`, or `--app-action-primary-background` with `prefix: "app"`. Structurally different keys such as `a-b.c` and `a.b-c` then share `--a-b-c`. Every collision among the exported tokens fails with `duplicate-css-variable`, naming the first key in code-unit order, the later key, and the shared property; internal tokens outside the selection never collide. `variableName` is an escape hatch for genuine exceptions: it receives the token key, its segments, the default name, and the prefix when one is supplied, runs in deterministic token order, and its results pass the same safety and collision checks. Exceptions, unsafe names, and collisions become issues rather than escaping the operation.

Selectors, media conditions, and layer names use intentionally bounded grammars rather than every browser feature:

- selectors: type, universal, class, id, and attribute selectors, `:root`, `:host`, `:host(<compound>)`, and `:is()`, `:not()`, `:where()` over selector lists, joined by combinators and commas, up to 256 characters and eight nested functional pseudo-classes;
- media conditions: an optional `not` or `only` media type (`all`, `print`, `screen`) followed by `and` conditions, or conditions of parenthesized features joined by `not`, `and`, or `or` without mixing them; features are `(name)`, `(name: value)`, or a range such as `(width >= 48rem)`; keywords, names, and units are lowercase, query lists with commas are excluded, up to 256 characters and eight nested parentheses;
- `cascadeLayer`: dot-separated lower-kebab segments, none of them a CSS-wide keyword, such as `tokens` or `app.tokens`.

Input outside a grammar returns a structured issue; it is never sanitized.

See [Application Theme Coordinates](./application-theme-coordinates.md) for combining independent application axes into private compiler modes and activating them with a media fallback and ordered selector conditions. See [Tailwind CSS v4](./tailwind-css-v4.md) for bridging runtime variables into Tailwind color utilities.

Compilation and serialization accept arbitrary token strings. CSS export is stricter because it emits declarations: a declaration-unsafe string fails with `invalid-css-value` instead of being written. Each emitted value is checked once, however many blocks declare it. This is an output-safety check, not token-domain interpretation. Option, name, and value failures are all collected rather than reported one at a time.

The complete artifact is structurally parsed before options. Compiled parsing validates retained-expression structure, not agreement with resolved tokens or acyclicity of edited retained references. Projection does not recompile it. For valid options, safety checks use the complete projected declaration, only in modes with emitted activation blocks. In `"var"` mode, unused resolved alias/concat values and unused retained fallbacks are not checked. Literal and fallback fragments are not checked separately: `"calc("` and `")"` can be safe within a complete value. Every emitted target has its own declaration checked, and naming failures do not stop independent value checks or create value issues by inserting invalid names.

`invalid-css-value` retains `/tokens/<key>/<mode>` for resolved output and projected values taken directly from that field. An unsafe retained concat projection points to `/metadataByToken/<key>/expressionByMode/<mode>`, with `key` and `mode`. Invalid `references` values use `invalid-css-options` with `option: "references"`, collected alongside independent option failures.

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

Current writers emit `formatVersion: 2`. Source parsers also accept historical v1 graphs/layers, upgrade once, and validate under the same current rules. Shadowed graph declarations move to a deterministic leading synthetic layer; only necessary visibility restatements are added, and historical default-first mode order is preserved. V1 schema hints are validated historically and dropped on upgrade. Standalone inconsistent layer maps return `inconsistent-layer-modes`. Compiled v1 is rejected with `invalid-format-version`: recompile its source graph.

In v2, `$schema` may be any string. It is preserved verbatim, never fetched or used for version selection, and never synthesized. Trusted helpers do not accept `$schema`. Only `kind` and `formatVersion` select the runtime format. A documented editor hint for the planned 0.4 release is `https://cdn.jsdelivr.net/npm/scheme-tokens@0.4.0/schemas/token-graph.v2.schema.json`; that release is not published yet. Each packaged schema has a stable identity such as `tag:maikel.site,2026-09-29:scheme-tokens/schema/token-graph/v2`. All three are self-contained Draft 2020-12 with fragment-only internal references.

Schemas are exported at:

- `scheme-tokens/schemas/token-graph.v2.schema.json`
- `scheme-tokens/schemas/token-layer.v2.schema.json`
- `scheme-tokens/schemas/compiled-scheme.v2.schema.json`

The three serializers produce the supported deterministic JSON wire representations. Parse and serialize round trips preserve accepted artifacts.

## TypeScript contract

The supported compiler is TypeScript `>=5.9.3 <6.0.0 || >=6.0.2 <7.0.0 || >=7.0.2 <8.0.0`. `defineTokenGraph` returns `DefinedTokenGraph<Key, Mode, PublicKey, OwnKey>`, a `TokenGraph<Key, Mode, PublicKey>`: every composed key, the mode union, and the effective public keys after layers compose in array order and graph tokens compose last. `graph.tokens` holds only the graph's own declarations, so its authored keys (`OwnKey`) are definite there and a key that only a layer declares is not. The mode type is a union; it says nothing about authored order or which mode is the default. `defineTokenLayer` infers `TokenLayer<Key, Mode, Visibility>`, where `Mode` is the layer mode set and `Visibility` is a `LayerVisibilityFacts`: the layer default, and the keys that may declare `public`, declare `internal`, or omit visibility. A wider type only adds possibilities, so plain `TokenGraph` and `TokenLayer` describe unknown data.

Literal input is checked by a strict constraint, and each failure lands on the offending property. Direct graph reference typos keep TypeScript's "Did you mean" suggestion. Reusable layers may refer to keys supplied by another layer or graph-local declarations, so their targets are checked at compilation. A bounded composed-reference prototype was rejected for poor error locality and unnameable declaration types; see ADR 0018. Other failures name a diagnostic marker in the compiler message: `UnknownTokenProperty<Name>`, `UnknownMode<Name>`, `InvalidModeName<Name>` for a mode outside the lower-kebab grammar or a reserved name, and `LayerModeMismatch<LayerModes, GraphModes>`. Markers explain a rejection; their wording and shape are not a compatibility contract, and they are not exported.

A precise static claim is nominal: only `defineTokenGraph`, `defineTokenLayer`, and the values that flow unchanged from them make one, however those values are assigned or passed. An object literal, a spread copy, a mapped type such as `Readonly<…>`, or a layer written inline in `layers` fits only the plain `TokenGraph` and `TokenLayer` forms and is treated like parsed data. A finite key union is an exact claim: a graph or layer type with other keys is not assignable to it, while every graph and layer is assignable to the plain forms. Compiling a union of graphs yields one scheme type per graph.

Explicit assertions, and runtime rewrites that TypeScript still types as the original value, are outside this guarantee. `Object.assign({}, graph, { defaultVisibility: "internal" })` has the type of `graph`, proof included, although its public keys differ, because TypeScript types the merge as an intersection with `graph`; after an in-place `Object.assign(graph, …)` or a write through `any`, `graph` keeps its type. To change keys, visibility, layers, or modes, define the new graph or layer with `defineTokenGraph` or `defineTokenLayer`, which derive fresh facts. Persisted or untrusted data goes through the parsers.

`LayerVisibilityFacts` exposes `defaultVisibility`, `mayStatePublicKeys`, `mayStateInternalKeys`, and `mayOmitVisibilityKeys`. These key unions may overlap: a token typed with optional public visibility can both state public and omit visibility. They are not effective outcomes. Material roles omit per-role visibility, so their two stated sets are `never` and their omitted set contains every role; the layer default still determines their visibility.

## Public types

The root type surface centers on `Result`, `Issue`, `TokenReference`, `TokenGraph`, `DefinedTokenGraph`, `TokenLayer`, `LayerVisibilityFacts`, `CompiledScheme`, `CssVarsExport`, `CssVarBlock`, `CssCondition`, and the authoring, option, and issue types needed to use those operations. Public declarations do not expose dependency-internal types or validation machinery.

See [Diagnostics](./diagnostics.md) for issue contracts and [Migration to 0.1](./migration.md) for the reset from the earlier, never-published surface.

## Optional Material 3 adapter

The sibling `@scheme-tokens/material3` package exports `material3` and exactly six named types:
`Material3TokenKey`, `Material3ColorMode`, `Material3SpecVersion`, `Material3Variant`,
`Material3ModeSettings` and `Material3Options`. These belong to the adapter, not the core root exports.
The P5 candidate returns one ordinary `TokenLayer` with fixed id `material3` and total maps for
all 48 roles. Compose through `layers: [material]` with explicit graph modes/defaultMode.

Its `modeSettings` map is exact and non-empty; omitted means light/dark. Built-in names imply their colorMode and accept a matching explicit value; custom names require it. Spec and visibility stay global; source/variant/
contrast override per field. Core owns mode-name errors and graph/layer mode agreement.
P5.1 ties precise claims to field presence: non-default mode sets require `modeSettings`, and visibility
excluding public requires `visibility`. Omitted/undefined options use the non-generic default
signature; explicit generics require options. Narrow or default possibly undefined options before
forwarding. Required wrappers retain precise supplied facts; bare options remain conservative.
The return carries NoInfer modes/default visibility and `mayOmitVisibilityKeys: Material3TokenKey`, since every
generated declaration omits explicit visibility. Unknown visibility keeps public output partial
over all composed keys, including possibly public roles. The candidate requires peer `^0.4.0`;
committed versions are unchanged. P6.1 owns package-only verification and P7 remains separate. See the [adapter reference](../packages/material3/README.md).

See [P6.1 package evidence](./p6.1-package-evidence.md) for current criteria. External application migrations are not release requirements; the [historical P6 report](./p6-consumer-evidence.md) retains its observations.
