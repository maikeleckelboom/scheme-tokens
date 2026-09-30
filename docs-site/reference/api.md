# API

## Runtime exports

| Export                    | Purpose                                                         |
| ------------------------- | --------------------------------------------------------------- |
| `defineTokenGraph`        | Define a trusted graph with explicit options or layers.         |
| `defineTokenLayer`        | Define a trusted reusable layer.                                |
| `tokenConcat`             | Build a reference-only tagged-template concat.                  |
| `orThrow`                 | Unwrap success or throw an Error with every issue in its cause. |
| `tokenRef`                | Create an explicit reference.                                   |
| `parseTokenGraph`         | Parse an untrusted strict graph.                                |
| `parseTokenLayer`         | Parse an untrusted strict layer.                                |
| `parseCompiledScheme`     | Parse an untrusted compiled scheme.                             |
| `compileTokenGraph`       | Compile a graph with explicit selection.                        |
| `exportCssVars`           | Project a compiled scheme to CSS custom properties.             |
| `serializeTokenGraph`     | Canonically serialize a graph.                                  |
| `serializeTokenLayer`     | Canonically serialize a layer.                                  |
| `serializeCompiledScheme` | Canonically serialize compiled output.                          |

These are the complete root runtime exports.

## Result

Every fallible operation uses the same public type:

```ts
type Result<Value, Problem> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly issues: readonly [Problem, ...Problem[]] };
```

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(defineTokenGraph({ tokens: { background: "#ffffff" } }));

if (compiled.ok) {
  const exported = exportCssVars(compiled.value);
  if (exported.ok) {
    exported.value.css;
    exported.value.blocks;
    exported.value.variableByToken;
  }
}
```

`orThrow()` returns the exact success value or throws `Error` with every issue code, path when present, and message. Its `cause` is the original non-empty issue tuple. Graph/layer helpers use the same convention.

## Trusted helpers

- `defineTokenGraph(input)`
- `defineTokenLayer(input)`
- `tokenRef(key)`
- `tokenConcat` tagged templates

Trusted helpers normalize and copy accepted TypeScript authoring input. They may throw for malformed keys, invalid references, contradictory mode options, or other programmer misuse.

Omitted mode options mean `base`/`base`. Explicit `modes` require `defaultMode`. Authored mode order survives independently of the default. Mode names are single lower-kebab identifiers; `ref`, `value`, `visibility`, `description`, `deprecated`, and `extensions` are reserved.

Layers have stable IDs and local default visibility, but no mode envelope. Direct expressions fit every graph. All mode maps within one layer must name the same set; a non-empty set must exactly match the graph modes, ignoring order. Mismatches return one deterministic `layer-mode-mismatch` per invalid layer. The graph owns mode order and default. Layers compose in array order, then graph tokens compose last. The winner supplies value and descriptive metadata. Omitted visibility preserves prior effective visibility; explicit visibility restates it. With no explicit visibility, the default of the position that introduced the key applies.

`tokenConcat` is a tagged template with reference-only substitutions. An empty template becomes `""`; a lone reference becomes `{ ref }`. Exact `{ concat: [...] }` source expressions merge adjacent literals, drop empty literals, and collapse literal-only content. Empty arrays and nested concat are invalid. Resolved concat is limited to 65,536 UTF-16 code units before joining; arbitrary literals and pure references remain unrestricted.

`concat` is a valid mode name: `{ concat: "opaque" }`, `{ concat: { ref: "a" } }`, and `{ concat: { concat: ["x", { ref: "a" }] } }` are mode maps. Only an exact singleton object with an array under `concat` is a concat expression. `{ concat: [] }` is therefore an invalid expression, never a mode map. `ref`, `value`, `visibility`, `description`, `deprecated`, and `extensions` remain reserved.

## Untrusted parsers

- `parseTokenGraph(input: unknown)`
- `parseTokenLayer(input: unknown)`
- `parseCompiledScheme(input: unknown)`

Parsers do not throw for JSON-compatible input. They strictly validate kinds, versions, properties, definition and reference shapes, and available mode coverage, then return an owned canonical artifact under `value`. Graph parsing also validates reference targets and cycles.

Parsed key sets are dynamic. `parseTokenGraph()` returns `TokenGraph` with `string` keys and public keys, and `parseTokenLayer()` returns `TokenLayer` with an unknown mode set and visibility. `parseCompiledScheme()` always returns an incomplete token record, and exporting CSS from it keeps `variableByToken` partial.

```ts
import { compileTokenGraph, parseTokenGraph } from "scheme-tokens";

declare const input: unknown;
const parsed = parseTokenGraph(input);

if (parsed.ok) {
  const compiled = compileTokenGraph(parsed.value, {
    selection: "public",
  });
}
```

## Compilation

`compileTokenGraph()` supports `selection: "public"`, `selection: "all"`, and exact `{ keys }` selection. It validates the complete graph before selection, so public tokens can safely reference internal tokens.

Compiled values remain `tokens[key][mode]`. Metadata contains effective `visibility` and non-empty `declarations` in composition order. Each declaration contains `origin: { kind: "graph" }` or `{ kind: "layer", id }`, plus `visibility` only when explicitly authored. The last declaration wins. Sparse `expressionByMode` omits literal modes, retains pure `{ ref }` records without duplicated values, and retains canonical concat parts with `{ ref, value }` for referenced parts. Descriptions, deprecation, and extensions come only from the winner.

Omitted and explicit `public` selection have complete token and metadata records keyed by the public keys when TypeScript knows them: a finite key set and literal visibility at every composition position. Otherwise they are partial over every graph key. `all` is complete for a finite key set; an exact literal key tuple is complete after runtime validation. Parsed graphs, dynamic key sets, and runtime key arrays remain partial. Advanced annotations can express this through `CompiledScheme<Key, Mode, Complete>`; inference is preferred.

## CSS export

`exportCssVars()` takes `prefix`, `variableName`, `format` (`pretty` or `compact`), `references` (`resolved` or `var`), `root`, `attribute`, `system`, `selectors`, and `cascadeLayer`. The structured `value` contains `css`, `blocks`, and `variableByToken`.

Omission, explicit `undefined`, and `"resolved"` retain existing resolved output. `"var"` projects only retained explicit references for each emitted token/mode. Direct targets link using their actual `variableByToken` name only when emitted by this same selected scheme; other pure references inline their own resolved value, and other concat parts inline their retained value. Literal parts remain exact, without added separators or `var()` fallback arguments. Selected internal targets can link; omitted public targets cannot. Names are built once per selected key in canonical order, respecting prefix/custom callbacks; naming failures and collisions fail export rather than changing eligible links. Authored `var(...)` strings are opaque.

Every block redeclares every alias. Target overrides at declaration/activation elements propagate through local aliases, including unlayered overrides of layered tokens in either stylesheet order; a target override on an unmarked descendant does not change its inherited alias. Core concat assembles characters while CSS substitutes tokens: `calc(var(--spacing) * 2)` can stay live, `var(--number)px` is not `20px` for a numeric target of `20`, and inserted `var()` inside a quoted string stays literal. See [Reference output](../guide/export-css-variables.md#reference-output) for examples and limits.

Blocks come in tier order base (the default mode at `root`), system (media conditions at `root`), explicit (one `data-*` attribute marker per mode, `data-theme` by default for several modes, `false` to disable), and custom (author selectors, optionally with media). Within a tier they follow the scheme's authored mode order, and within a mode the order of its conditions. Every selector is wrapped in `:where()`, so the later matching block wins, and every block declares every selected token. Each block reports `tier`, `mode`, `selectors`, optional `media`, and `declarations`. See [Export CSS Variables](../guide/export-css-variables.md) for the full activation rules.

Default names join the prefix and key segments with single hyphens; every collision among exported names returns `duplicate-css-variable`. The `variableName` callback is advanced and contained: exceptions, unsafe names, and collisions return issues.

`variableByToken` mirrors the compiled record's partial or complete key contract, including the partial result from a parsed compiled artifact and the complete result of a finite, fully known public selection. `system` and `selectors` are partial maps keyed by the compiled mode union, so TypeScript rejects an unknown mode of a finite scheme.

Compilation and serialization preserve arbitrary strings. CSS export structurally parses the whole artifact before options and checks complete projected declarations once per emitted key/mode. The exact checked string is `blocks[].declarations[].value` in either format; blocks do not encode formatting or the cascade-layer wrapper. Unsafe values use `invalid-css-value`: resolved/direct token values keep `/tokens/<key>/<mode>`, and retained concat projection uses `/metadataByToken/<key>/expressionByMode/<mode>`. Unused resolved values, unused fallbacks, and isolated fragments are not checked in `"var"` mode. Selected targets' own declarations are checked. Metadata structure does not prove consistency with tokens or acyclicity of edited references. Selectors, media conditions, and layer names use intentionally bounded grammars; emission safety does not establish general CSS semantics or HTML embedding safety.

See [Application Theme Coordinates](../guide/application-theme-coordinates.md) for a complete exact-selection example activated through a system fallback and ordered custom conditions.

## TypeScript

The supported compiler is TypeScript `>= 7.0 < 8.0`. `defineTokenGraph` returns a `DefinedTokenGraph`: a `TokenGraph<Key, Mode, PublicKey>` whose own authored keys are definite in `graph.tokens`, while a key that only a layer declares is not. `defineTokenLayer` infers `TokenLayer<Key, Mode, Visibility>`, where a layer `Mode` is `never` without mode maps, a finite union for a literal layer, and `string` when unknown, and `Visibility` is a `LayerVisibility`. Literal input is validated strictly; failures name the offending property, keep reference suggestions, and use the diagnostic markers described in [TypeScript Access](../guide/typescript-access.md). Precise claims are nominal: only the helpers and the values that flow unchanged from them make one. A finite key union is an exact claim, and an object literal, a spread copy, or a plain `TokenGraph` or `TokenLayer` describes unknown data.

## Serializers and schemas

The three serializers emit canonical supported artifacts. Published schema subpaths are:

- `scheme-tokens/schemas/token-graph.v2.schema.json`
- `scheme-tokens/schemas/token-layer.v2.schema.json`
- `scheme-tokens/schemas/compiled-scheme.v2.schema.json`

Strict token definitions have one required `value`, which contains either a string/reference/concat expression or a complete mode map.

Current writers emit `formatVersion: 2`. Source parsers also accept historical v1 graphs/layers, upgrade once, and validate under the same current rules. Shadowed graph declarations move to a deterministic leading synthetic layer; only necessary visibility restatements are added, and historical default-first mode order is preserved. V1 schema hints are validated historically and dropped on upgrade. Standalone inconsistent layer maps return `layer-mode-mismatch`. Compiled v1 is rejected with `invalid-format-version`: recompile its source graph.

In v2, `$schema` may be any string. It is preserved verbatim, never fetched or used for version selection, and never synthesized. Trusted helpers do not accept `$schema`. Only `kind` and `formatVersion` select the runtime format. A documented editor hint for the planned 0.4 release is `https://cdn.jsdelivr.net/npm/scheme-tokens@0.4.0/schemas/token-graph.v2.schema.json`; that release is not published yet. Each packaged schema has a stable identity such as `tag:maikel.site,2026-09-29:scheme-tokens/schema/token-graph/v2`. All three are self-contained Draft 2020-12 with fragment-only internal references.

## Optional Material 3 adapter

The sibling `@scheme-tokens/material3` package exports `material3` and exactly six named types:
`Material3TokenKey`, `Material3ColorMode`, `Material3SpecVersion`, `Material3Variant`,
`Material3Modes` and `Material3Options`. These belong to the adapter, not the core root exports.
The P5 candidate returns one ordinary `TokenLayer` with fixed id `material3` and total maps for
all 48 roles. Compose through `layers: [material]` with explicit graph modes/defaultMode.

Its `modes` settings map is exact and non-empty; omitted means light/dark. Built-in names imply
their colorMode, and custom names require it. Spec and visibility stay global; source/variant/
contrast override per field. Core owns mode-name errors and graph/layer mode agreement.
P5.1 ties precise claims to field presence: non-default mode sets require `modes`, and visibility
excluding public requires `visibility`. Omitted/undefined options use the non-generic default
signature; explicit generics require options. Narrow or default possibly undefined options before
forwarding. Required wrappers retain precise supplied facts; bare options remain conservative.
The return carries NoInfer modes/default visibility and `omitted: Material3TokenKey`, since every
generated declaration omits explicit visibility. Unknown visibility keeps public output partial
over all composed keys, including possibly public roles. The candidate requires peer `^0.4.0`;
committed versions are unchanged and P6/P7 remain deferred. See the [adapter reference](https://github.com/maikeleckelboom/scheme-tokens/blob/dev/packages/material3/README.md).
