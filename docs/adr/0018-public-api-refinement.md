# ADR 0018: Public API refinement before stabilization

Status: Accepted, 2026-10-04.

This decision refines the candidate on `dev` starting at
`a86d217400a38c402db5fd39f8d7c7665a521759`. It supersedes the named vocabulary and
activation defaults in ADR 0013 D2/D3/D4/D6/D7, the Material map vocabulary and built-in
color-mode restriction in ADR 0014, and corresponding property names in ADR 0016.
The compiler pipeline, package boundary, nominal proof, composition, reference
resolution, source upgrades, CSS safety grammar, and option-presence policy remain authoritative.

## Decisions and compatibility classification

| Change                                      | Contract affected                                    | Decision                                                                                                                                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Material `modes` to `modeSettings`          | TypeScript authoring API and runtime options         | Graph `modes` is an ordered envelope; Material settings are an exact non-empty map over it. No old option alias.                                                                                                                               |
| `Material3Modes` to `Material3ModeSettings` | TypeScript API                                       | The exported type names the whole map; private `Material3SettingsForMode` names one entry. Consumers can index the map type.                                                                                                                   |
| Congruent built-in `colorMode`              | TypeScript API and runtime behavior                  | `light: { colorMode: "light" }` and its dark counterpart are accepted. Contradictions fail; custom modes still require `colorMode`.                                                                                                            |
| Array selection                             | TypeScript/compiler-options API and runtime behavior | `selection: readonly Key[]` replaces the wrapper. Ordinary arrays are accepted, empty arrays fail at runtime, literal tuples retain completeness. Selection pointers lose `/keys`. No graph wire change.                                       |
| Helper-only omitted tokens                  | Trusted authoring API and runtime normalization      | `defineTokenGraph` inserts `tokens: {}` only for omission. Explicit undefined is invalid. Canonical graph, parser, and source schemas still require tokens.                                                                                    |
| `LayerVisibilityFacts`                      | TypeScript API                                       | `defaultVisibility`, `mayStatePublicKeys`, `mayStateInternalKeys`, and `mayOmitVisibilityKeys` name possibilities, not resolved outcomes. Sets may overlap.                                                                                    |
| `declaredVisibility`                        | Compiled API, compiled-v2 wire, compiled-v2 schema   | Only declaration records change. Effective metadata and authored visibility remain `visibility`. Old compiled declaration `visibility` is rejected; recompile source. No compatibility reader or version bump.                                 |
| Discriminated issues                        | TypeScript and diagnostic contract                   | Each code has its emitter-guaranteed payload; `Issue` remains generic. The complete code/field audit is in `docs/diagnostics.md`.                                                                                                              |
| Split `layer-mode-mismatch`                 | Diagnostic contract                                  | `inconsistent-layer-modes` identifies two conflicting maps within a layer, with key and firstPath; `layer-mode-mismatch` identifies a consistent layer versus the graph envelope. These failures have different repair locations and payloads. |
| `activation` grouping                       | TypeScript API and runtime options                   | Only root, media, attribute, and selectors move into activation. `system` becomes `media`; arbitrary accepted media, including print, remain valid. Old top-level options fail.                                                                |
| Explicit attribute opt-in                   | CSS runtime behavior                                 | No attribute option means no markers, for any number of modes. Remove `false`; omission expresses no activation.                                                                                                                               |
| `includeHost`                               | TypeScript API and CSS runtime behavior              | Attribute string shorthand targets ordinary elements. `{ name, includeHost: true }` adds Shadow DOM host matching. Root text has no effect on marker targeting.                                                                                |
| Singleton condition                         | TypeScript API and CSS runtime behavior              | Selectors accept a string, one condition object, or a non-empty list. Singleton diagnostic indices are absent.                                                                                                                                 |
| New tier names                              | Structured exporter output and diagnostics           | `default`, `media`, `attribute`, `selector`, in that order; authored mode and condition ordering is unchanged. `invalid-custom-condition` becomes `invalid-selector-condition`.                                                                |
| Preserved vocabulary                        | No contract change                                   | Keep `colorMode`, `cascadeLayer`, `CssCondition`, `references: "var"`, and established compiler operations. Existing names are precise at real call sites.                                                                                     |

There is **no canonical graph or token-layer wire-format change**. There are no
new runtime exports, dependencies, compatibility aliases, publication changes, or
application-owned theme concepts. Current package versions remain unchanged.

## Visibility and host call-site review

A mixed layer may put an optional `visibility?: "public"` key into both
`mayStatePublicKeys` and `mayOmitVisibilityKeys`. Definite authored public/internal
keys and omitted declarations are tested independently. A public Material layer
has `defaultVisibility: "public"`, both stated sets `never`, and
`mayOmitVisibilityKeys: Material3TokenKey`. It is public through its default;
the empty stated sets do not describe effective visibility.

The approved host shape is:

```ts
activation: {
  root: ":host",
  attribute: { name: "data-mode", includeHost: true },
}
```

`includeHost` is additive: it emits both `:host([data-mode="dark"])` and
`[data-mode="dark"]` inside `:where(...)`. It supports a host marker and nested
light/dark islands with the same mechanism. An enum adds no needed state;
placing a host flag beside root would misrepresent which mechanism it controls.
The user explicitly approved this name and meaning. Tests compare string shorthand,
false, and true against independent root selectors, including `:host(.app)` and
ordinary selectors. Three-engine browser tests check host inheritance and nested
markers. No unresolved host decision remains.

## Bounded composed-layer reference experiment: rejected

The isolated prototype added a type-only phantom reference-target union to a
literal layer. It collected direct, mode-mapped, expanded, and concat references,
then checked that union against the final finite key union at graph composition.
Dynamic/parsed layers stayed runtime-only. Probes included cross-layer targets,
graph-local targets, reuse across contexts, and misspelled direct/concat targets.

The prototype rejected the intended literal typos. However, errors landed on the
layer identifier inside `layers`, not on the original token declaration or
`tokenRef`. Diagnostics expanded the layer into an intersection of
`TokenLayerFields`, `StaticProof`, the reference phantom, and
`UnknownLayerReference<...>`, ending in a missing `unknownLayerReference` property.
Exported reusable values also produced TS4023/TS4094 on TypeScript 7.0.2: their
inferred declaration types exposed unnameable/private core proof machinery.
The exploratory TypeScript 6.0.3 check reproduced the poor error locality and
expanded intersection; it was not a supported-floor matrix run.

The TypeScript 7 check took 0.197 seconds in one local run. This is not a
comparative performance measurement. Declaration emission failed, so no successful
declaration-size delta is claimed. The actual hover UI was not measured; expanded
compiler error types already exposed the readability problem.

Stop conditions were met: misleading error locality and public generic machinery
disproportionate to the gain, with an additional portable-declaration failure.
Do not ship the prototype or add a public layer wrapper merely to conceal it.
The production helper keeps its directly nameable `TokenLayer` return. Direct
graph literal references receive static checking; reusable layer targets remain
validated against the whole graph at compilation, with precise runtime occurrence
paths. Failed experimental sources remain outside the committed package.

## Evidence ownership

`examples/api-refinement.ts` reviews ordinary and application-owned Material modes,
one/multi-mode graphs, layer-only roots, exact and ordinary-array selection,
internal sources/public aliases, all three activation mechanisms, and Shadow DOM.
`examples/theme-coordinates` retains the separate multi-axis consumer and packed
execution proof. Type tests exercise overlapping visibility facts, option presence,
diagnostic narrowing/exhaustiveness, and rejected obsolete shapes. Schemas and
round-trip tests enforce the direct compiled-v2 change. The API snapshots are
generated from builds and manually reviewed; release and compiler gates validate
installed declaration emission, not just source compilation.
