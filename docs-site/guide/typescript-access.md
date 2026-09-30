# TypeScript Access

Literal token keys, explicit modes, and visibility flow through trusted authoring, compilation, CSS export, and serialization. The supported compiler is TypeScript `>= 7.0 < 8.0`.

```ts
import { compileTokenGraph, defineTokenGraph, orThrow, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    "brand.600": { value: { light: "#6750a4", dark: "#d0bcff" }, visibility: "internal" },
    background: { light: "#ffffff", dark: "#111111" },
    primary: tokenRef("brand.600"),
  },
});

const scheme = orThrow(compileTokenGraph(graph));
scheme.tokens.primary.dark.toUpperCase();
scheme.metadataByToken.background.declarations.length.toFixed();

const everything = orThrow(compileTokenGraph(graph, { selection: "all" }));
everything.tokens["brand.600"].light.toUpperCase();

const exact = orThrow(compileTokenGraph(graph, { selection: { keys: ["primary"] } }));
exact.tokens.primary.light.toUpperCase();
```

`defineTokenGraph` returns a `DefinedTokenGraph`, a `TokenGraph<Key, Mode, PublicKey>`: every composed key, the mode union, and the public keys after layers compose in array order and graph tokens compose last. Visibility follows the runtime rule: explicit visibility replaces, an omitted override keeps what it replaces, and a new key takes the default of the position that introduced it. Here `PublicKey` is `"background" | "primary"`, so the default public result is a complete record of exactly those keys. `graph.tokens` holds the graph's own declarations: keys the graph authors are definite there, and a key that only a layer declares is not.

Precise claims are nominal. Only `defineTokenGraph`, `defineTokenLayer`, and the values that flow from them make one, so an annotation cannot add, hide, or publish a key the value does not prove. An object literal, a spread copy, a frozen copy, or a layer written inline in `layers` fits only the plain `TokenGraph` and `TokenLayer` forms and is treated like parsed data.

The public record stays partial whenever TypeScript cannot know the public set: a visibility typed `TokenVisibility` rather than a literal, a graph built from `Record<string, …>` or `Object.fromEntries`, a parsed graph or layer, data that did not come from the helpers, a layer list that is not a tuple, or a layer typed only as `TokenLayer<Key>`. `all` is complete whenever the key set is finite, because visibility never removes a key from it. An exact literal tuple is complete after runtime validation; a runtime key array is partial.

The third `Complete` generic on `CompiledScheme<Key, Mode, Complete>` represents this distinction. `parseCompiledScheme()` always returns the incomplete form. `CssVarsExport<Key, Mode, Complete>` carries the input completeness into `variableByToken`. Let inference provide these generics unless an integration boundary needs an explicit annotation.

## Layer mode sets

`defineTokenLayer` infers `TokenLayer<Key, Mode, Visibility>`. `Mode` is the layer mode set: `never` when the layer has only direct expressions, which fits every graph, and the union of its mode-map names otherwise. Every mode map in a literal layer must name the whole set. A finite layer set must equal a finite graph set, in any order; otherwise the `layers` entry fails with `LayerModeMismatch<LayerModes, GraphModes>` naming both sets. Parsed and dynamic layers have the mode set `string` and rely on the runtime `layer-mode-mismatch` check.

## Rejected at compile time

For literal input the helpers reject, at the offending property:

- a reference to a key the graph and its layers do not define, with TypeScript's "Did you mean" suggestion;
- a mode map that misses a graph mode, or names one the graph does not declare (`UnknownMode<Name>`);
- metadata mixed directly with mode keys, or a misspelled metadata property (`UnknownTokenProperty<Name>`);
- a visibility other than `"public"` or `"internal"`;
- a mode outside the lower-kebab grammar, or a reserved name such as `value` (`InvalidModeName<Name>`); `concat` is a valid mode;
- `modes` without `defaultMode`, or a `defaultMode` outside `modes`.

The marker names appear in compiler messages to explain a rejection. They are not exported, and their wording is not a compatibility contract.

Public types center on `Result`, `Issue`, `TokenReference`, `TokenGraph`, `DefinedTokenGraph`, `TokenLayer`, `LayerVisibility`, `CompiledScheme`, `CssVarsExport`, and their essential option and issue types.
