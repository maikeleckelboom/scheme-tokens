# TypeScript Access

Literal token keys and explicit modes flow through trusted authoring, compilation, CSS export, and serialization.

```ts
import { compileTokenGraph, defineTokenGraph, serializeCompiledScheme } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    background: { light: "#ffffff", dark: "#111111" },
    primary: { light: "#6750a4", dark: "#d0bcff" },
  },
});

const publicCompiled = compileTokenGraph(graph);

if (publicCompiled.ok) {
  publicCompiled.value.tokens.background?.light.toUpperCase();
}

const compiled = compileTokenGraph(graph, {
  selection: { keys: ["background", "primary"] },
});

if (compiled.ok) {
  const background = compiled.value.tokens.background.light;
  const primary = compiled.value.tokens.primary.dark;
  const declarations = compiled.value.metadataByToken.primary.declarations;
  const json = serializeCompiledScheme(compiled.value);

  background.toUpperCase();
  primary.toUpperCase();
  declarations.length.toFixed();
  json.toUpperCase();
}
```

`tokenRef()` preserves its literal target. Compilation validates references against the composed graph, while exact selections reject misspelled keys at the type and runtime boundaries where possible.

Omitted and explicit `public` selection expose partial token and metadata records because internal keys are filtered at runtime. Optional access reflects that uncertainty. An exact literal tuple is complete after validation, as in the second compilation above. `all` is complete only for a finite authored key union; dynamic parsed graphs and runtime selection arrays remain partial.

The third `Complete` generic on `CompiledScheme<Key, Mode, Complete>` represents this distinction. `parseCompiledScheme()` always returns the incomplete form. `CssVarsExport<Key, Mode, Complete>` carries the input completeness into `variableByToken`, so CSS exported from a parsed compiled artifact remains partial. Let inference provide these generics unless an integration boundary needs an explicit annotation.

Public types center on `Result`, `Issue`, `TokenReference`, `TokenGraph`, `TokenLayer`, `CompiledScheme`, `CssVarsExport`, and their essential option and issue types.
