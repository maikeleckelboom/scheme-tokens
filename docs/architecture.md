# Architecture

`scheme-tokens` is a dependency-light compiler for authored string-valued token graphs.

## Boundary

The package owns graph and layer contracts, explicit references, graph modes, ordered composition, visibility, validation, compilation, diagnostics, strict persisted artifacts, deterministic serialization, and CSS custom-property projection.

It does not interpret token strings or own palette generation, color conversion, contrast policy, repair policy, role conventions, product project models, or a plugin registry. External producers hand the package ordinary authored strings or a strict persisted graph.

## Pipeline

```text
trusted TypeScript authoring       untrusted persisted JSON
define* helpers                    parse* functions
          \                        /
           canonical owned artifact
                     |
             compileTokenGraph()
                     |
               CompiledScheme
                /          \
    exportCssVars()    serializeCompiledScheme()
```

The trusted helpers may throw for programmer misuse. The parsers accept `unknown`, avoid throwing for JSON-compatible input, copy accepted data, and return structured `Result` values.

## Graph authority

The graph exclusively owns `modes` and `defaultMode`. Omitting mode options means the single mode `base`. Any explicit mode envelope requires an explicit default.

Layers have stable IDs, local default visibility, and token definitions, but no mode envelope. A layer's mode maps are checked against the owning graph during composition. Graph tokens compose first, followed by layers in array order; a later definition replaces an earlier definition with the same key.

This is token composition, not CSS cascade behavior.

## References and selection

References are explicit `{ ref }` expressions. Compilation validates unknown references and cycles against the complete composed graph before selecting output tokens. This allows a public semantic token to resolve through internal implementation tokens without emitting those internal tokens in the default public result.

Selection is explicit:

- `"public"` is the default;
- `"all"` includes public and internal tokens;
- `{ keys: [...] }` selects an exact non-empty key set.

Selected keys and compiled records use deterministic code-unit ordering.

Omitted and explicit `public` selection have conservatively partial token and metadata records because visibility is applied at runtime. Use optional access for those records. An exact literal key tuple is complete after runtime validation. `all` is complete for a finite authored key union, but a dynamically parsed graph has no finite known key set and remains partial even with `all`.

## Compiled schemes

Compiled token values are direct mode maps. Metadata is stored separately under `metadataByToken` so mode names cannot collide with visibility, origin, dependency, or descriptive fields.

```ts twoslash
import { compileTokenGraph, defineTokens } from "scheme-tokens";

const compiled = compileTokenGraph(
  defineTokens({
    background: "#ffffff",
  }),
);

if (compiled.ok) {
  compiled.value.tokens.background?.base;
  compiled.value.metadataByToken.background?.dependenciesByMode.base;
}
```

The optional access reflects the default public selection, not an optional mode. `parseCompiledScheme()` also always returns a dynamic, incomplete token record; CSS export from that parsed artifact keeps `variableByToken` partial. Serializers define the supported byte-stable wire projection. Parsers own accepted input rather than retaining caller-owned mutable objects.

Compilation and serialization preserve arbitrary token strings. CSS export separately validates declaration safety before code emission and returns `invalid-css-value` instead of writing an unsafe value.

## Optional composition packages

The repository also publishes optional composition outside core. `@scheme-tokens/material3` owns
Material system-color generation and returns an ordinary graph fragment containing one layer. The
adapter bundles its pinned engine while keeping `scheme-tokens` as the shared peer; core does not
import, re-export, discover, or install the adapter. The generated layer continues through the
unchanged core composition, compilation, serialization, provenance, and CSS APIs.
