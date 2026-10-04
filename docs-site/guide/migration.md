# Migration to 0.1

The 0.1 contract removes the earlier, never-published parallel forms rather than preserving compatibility aliases. The 0.1 line is released, so this is a closed handoff; later contract changes are recorded in the changelog.

The executable examples below follow the current candidate API; the migration history remains a closed 0.1 handoff.

## Candidate public API refinement

The pre-stabilization candidate refines the existing compiler pipeline without aliases.
This section describes the current contract; the 0.1 handoff below remains historical.

- Material options use `modeSettings`, while graph `modes` remains the ordered envelope. The map type is `Material3ModeSettings`. Built-in light/dark entries accept omitted or matching explicit `colorMode`; contradictions fail.
- Pass `selection: ["surface.canvas"]` directly. Ordinary arrays remain accepted and may fail for emptiness at runtime. Selection element pointers are `/selection/<index>`.
- Omit `tokens` only in trusted `defineTokenGraph` calls. The helper inserts an empty record; persisted graphs and parsers still require it.
- `LayerVisibilityFacts` names the layer default and overlapping may-sets: `mayStatePublicKeys`, `mayStateInternalKeys`, and `mayOmitVisibilityKeys`.
- Compiled declaration records use `declaredVisibility`; effective metadata and authored definitions keep `visibility`. Recompile source to replace old compiled-v2 records. The v2 parser/schema reject the old declaration field; there is no upgrade or alias.
- Move root, media, attribute, and selector conditions into `activation`; the former system map is now `activation.media`. Attribute activation is opt-in: omit it for no markers, or choose `attribute: "data-mode"`. Remove old `false` values. String shorthand targets ordinary elements; `{ name: "data-mode", includeHost: true }` also targets the Shadow DOM host. Root text never controls targeting.
- Structured CSS tiers are `default`, `media`, `attribute`, and `selector`. Selector maps accept a single condition object as well as strings and non-empty lists. Keep `references: "var"`, `cascadeLayer`, and `CssCondition`.
- Issue unions narrow by code with guaranteed payloads. Internal layer map disagreements use `inconsistent-layer-modes`; `layer-mode-mismatch` exclusively means layer versus graph. CSS malformed selector conditions use `invalid-selector-condition`; singleton conditions have no list index. Update exhaustive switches.

Graph and layer wire shapes and schemas do not change. Reusable layer reference targets remain runtime-validated at compilation; only direct graph references gain the existing local static typo checks.

## Mechanical changes

- Replace `valueByMode` with `value` containing the mode map.
- Replace graph or layer `aliases` with ordinary token definitions that call `tokenRef()`.
- Replace `compiled.scheme`, `parsed.graph`, `parsed.layer`, and `parsed.scheme` with `.value`.
- Read CSS through `exported.value.css`, `exported.value.blocks`, and `exported.value.variableByToken`.
- Rename the type `ReferenceInput` to `TokenReference`.
- Add explicit `modes` and `defaultMode` to every multimode graph.
- Remove `modes` from layers.
- Parse `unknown` input before compiling or serializing it.

```ts
import { compileTokenGraph, defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
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
});

const compiled = compileTokenGraph(graph, {
  selection: ["primary"],
});

if (compiled.ok) {
  compiled.value.tokens.primary.light;
}
```

The exact literal selection makes `primary` a definite key after runtime validation. For a literal graph, omitted or explicit `public` selection is complete as well, because TypeScript knows which keys are public; it stays partial when visibility or keys are dynamic.

## Chromavert

Keep generated source outputs as internal string tokens. Express semantic roles and explicit repair tokens as ordinary definitions and explicit references. Put the light/dark envelope on the graph, replace persisted `valueByMode` records with `value`, and replace alias records with `tokenRef()` definitions.

Use `parseTokenGraph()` for persisted project data, then compile `parsed.value`. Use the default public selection for emitted semantics and `selection: "all"` when an artifact also needs internal generated or repair tokens. Public semantic tokens can continue to resolve through those internal tokens, and retained expression metadata remains available under `compiled.value.metadataByToken`. Parsed graph keys are dynamic, so public and `all` output remain partial; use optional access, or an exact literal key tuple for definite reads after validation.

Chromavert's project, proof, relationship, and repair policy remains outside `scheme-tokens`.
