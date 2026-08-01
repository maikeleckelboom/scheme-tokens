# API

## Runtime exports

| Export                    | Purpose                                                 |
| ------------------------- | ------------------------------------------------------- |
| `defineTokens`            | Define the ordinary trusted graph path.                 |
| `defineTokenGraph`        | Define a trusted graph with explicit options or layers. |
| `defineTokenLayer`        | Define a trusted reusable layer.                        |
| `tokenRef`                | Create an explicit reference.                           |
| `parseTokenGraph`         | Parse an untrusted strict graph.                        |
| `parseTokenLayer`         | Parse an untrusted strict layer.                        |
| `parseCompiledScheme`     | Parse an untrusted compiled scheme.                     |
| `compileTokenGraph`       | Compile a graph with explicit selection.                |
| `exportCssVars`           | Project a compiled scheme to CSS custom properties.     |
| `serializeTokenGraph`     | Canonically serialize a graph.                          |
| `serializeTokenLayer`     | Canonically serialize a layer.                          |
| `serializeCompiledScheme` | Canonically serialize compiled output.                  |

These are the complete root runtime exports.

## Result

Every fallible operation uses the same public type:

```ts
type Result<Value, Problem> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly issues: readonly [Problem, ...Problem[]] };
```

```ts twoslash
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(defineTokens({ background: "#ffffff" }));

if (compiled.ok) {
  const exported = exportCssVars(compiled.value);
  if (exported.ok) {
    exported.value.css;
    exported.value.blocks;
    exported.value.variableByToken;
  }
}
```

## Trusted helpers

- `defineTokens(tokens, options?)`
- `defineTokenGraph(input)`
- `defineTokenLayer(input)`
- `tokenRef(key)`

Trusted helpers normalize and copy accepted TypeScript authoring input. They may throw for malformed keys, invalid references, contradictory mode options, or other programmer misuse.

Omitted mode options mean `base`/`base`. Explicit `modes` require `defaultMode`. Layers never accept mode authority.

## Untrusted parsers

- `parseTokenGraph(input: unknown)`
- `parseTokenLayer(input: unknown)`
- `parseCompiledScheme(input: unknown)`

Parsers do not throw for JSON-compatible input. They strictly validate kinds, versions, properties, definition and reference shapes, and available mode coverage, then return an owned canonical artifact under `value`. Graph parsing also validates reference targets and cycles.

Parsed key sets are dynamic. `parseCompiledScheme()` always returns an incomplete token record, and exporting CSS from it keeps `variableByToken` partial.

```ts twoslash
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

Compiled values are direct mode maps. Visibility, origin, direct dependencies, descriptions, deprecation, and extensions live under `metadataByToken`.

Omitted and explicit `public` selection have conservatively partial token and metadata records because runtime visibility may filter any authored key. Use optional access for those records. An exact literal key tuple is complete after runtime validation. `all` is complete only for a finite authored key union; a dynamically parsed graph remains partial. Runtime key arrays are also partial because they are not finite tuples. Advanced annotations can express this through `CompiledScheme<Key, Mode, Complete>`; inference is preferred.

## CSS export

`exportCssVars()` supports prefix, scope, mode selector, and formatting options. The structured `value` contains `css`, `blocks`, and `variableByToken`.

The `variableName` callback is advanced and contained. Exceptions, unsafe names, and collisions return issues.

`variableByToken` mirrors the compiled record's partial or complete key contract, including the partial result from a parsed compiled artifact. Exact selector maps are typed to the compiled mode union, requiring every mode and rejecting unknown modes.

Compilation and serialization preserve arbitrary strings. CSS export rejects declaration-unsafe strings with `invalid-css-value`. Its selector validation is an intentionally bounded safe grammar rather than a complete browser CSS parser.

See [Application Theme Coordinates](../guide/application-theme-coordinates.md) for a complete exact-selection and structured-block composition example.

## Serializers and schemas

The three serializers emit canonical supported artifacts. Published schema subpaths are:

- `scheme-tokens/schemas/token-graph.v1.schema.json`
- `scheme-tokens/schemas/token-layer.v1.schema.json`
- `scheme-tokens/schemas/compiled-scheme.v1.schema.json`

Strict token definitions have one required `value`, which contains either a string/reference expression or a complete mode map.

Strict artifacts require their exact `kind` and supported numeric `formatVersion`. An optional `$schema` must equal that artifact's canonical `https://scheme-tokens.dev/schemas/...` URI. Parsers reject unknown properties, non-canonical schema URIs, and unsupported versions rather than guessing a format.
