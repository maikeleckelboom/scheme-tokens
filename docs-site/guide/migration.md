# Migration to 0.1

The 0.1 contract removes the earlier, never-published parallel forms rather than preserving compatibility aliases. The 0.1 line is released, so this is a closed handoff; later contract changes are recorded in the changelog.

## Mechanical changes

- Replace `valueByMode` with `value` containing the mode map.
- Replace graph or layer `aliases` with ordinary token definitions that call `tokenRef()`.
- Replace `compiled.scheme`, `parsed.graph`, `parsed.layer`, and `parsed.scheme` with `.value`.
- Read CSS through `exported.value.css`, `exported.value.blocks`, and `exported.value.variableByToken`.
- Rename the type `ReferenceInput` to `TokenReference`.
- Add explicit `modes` and `defaultMode` to every multimode graph.
- Remove `modes` from layers.
- Parse `unknown` input before compiling or serializing it.

```ts twoslash
import { compileTokenGraph, defineTokens, tokenRef } from "scheme-tokens";

const graph = defineTokens(
  {
    "brand.600": {
      value: "oklch(62% 0.18 250)",
      visibility: "internal",
    },
    primary: {
      value: {
        light: tokenRef("brand.600"),
        dark: tokenRef("brand.600"),
      },
    },
  },
  {
    modes: ["light", "dark"],
    defaultMode: "light",
  },
);

const compiled = compileTokenGraph(graph, {
  selection: { keys: ["primary"] },
});

if (compiled.ok) {
  compiled.value.tokens.primary.light;
}
```

The exact literal selection makes `primary` a definite key after runtime validation. Omitted or explicit `public` selection is conservatively partial because internal keys are filtered at runtime; use optional access when reading that result by key.

## Chromavert

Keep generated source outputs as internal string tokens. Express semantic roles and explicit repair tokens as ordinary definitions and explicit references. Put the light/dark envelope on the graph, replace persisted `valueByMode` records with `value`, and replace alias records with `tokenRef()` definitions.

Use `parseTokenGraph()` for persisted project data, then compile `parsed.value`. Use the default public selection for emitted semantics and `selection: "all"` when an artifact also needs internal generated or repair tokens. Public semantic tokens can continue to resolve through those internal tokens, and direct dependency metadata remains available under `compiled.value.metadataByToken`. Parsed graph keys are dynamic, so public and `all` output remain partial; use optional access or an exact literal key tuple for definite reads after validation.

Chromavert's project, proof, relationship, and repair policy remains outside `scheme-tokens`.
