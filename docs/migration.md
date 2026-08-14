# Migration to 0.1

This guide migrates code written against the earlier, never-published API to the 0.1 contract. There are no compatibility aliases or old-format readers.

The 0.1 line is released, so this is a closed handoff rather than a living document: later contract changes are recorded in `CHANGELOG.md` and governed by [Semver](./semver.md).

## Result payloads

Every fallible success now uses `value`:

```ts
const parsed = parseTokenGraph(input);
if (parsed.ok) parsed.value;

const compiled = compileTokenGraph(graph);
if (compiled.ok) compiled.value;

const exported = compiled.ok ? exportCssVars(compiled.value) : undefined;
if (exported?.ok) exported.value.css;
```

Replace `.graph`, `.layer`, `.scheme`, and direct CSS success fields with `.value`. Replace operation-specific result aliases with public `Result` where an explicit result type is needed.

## Token definitions

Move multimode values under the canonical `value` property:

```ts
// Before
{ valueByMode: { light: "#ffffff", dark: "#111111" } }

// After
{ value: { light: "#ffffff", dark: "#111111" } }
```

Replace aliases with ordinary explicit references:

```ts
// Before
defineTokenGraph({
  tokens: { "brand.600": "#6750a4" },
  aliases: { primary: "brand.600" },
});

// After
defineTokenGraph({
  tokens: {
    "brand.600": "#6750a4",
    primary: tokenRef("brand.600"),
  },
});
```

Do not mix metadata with mode keys. Put the mode map under `value` when metadata is present.

## Modes and layers

Single-mode helpers still default to `modes: ["base"]` and `defaultMode: "base"`.

Any multimode graph must now pass both `modes` and `defaultMode`. Remove `modes` from `defineTokenLayer()` calls; the graph is the only mode authority. Layer mode maps are validated when the layer is composed into a graph.

## Trusted and untrusted entry points

Use `defineTokens`, `defineTokenGraph`, `defineTokenLayer`, and `tokenRef` for trusted TypeScript authoring. These helpers may throw for programmer misuse.

For `unknown` data, call `parseTokenGraph`, `parseTokenLayer`, or `parseCompiledScheme` first, then pass the parsed `value` to compilation, serialization, or CSS export. The parsers copy accepted input and return structured issues rather than throwing for JSON-compatible data.

Rename the public reference type from `ReferenceInput` to `TokenReference`.

## Chromavert

Migrate Chromavert without moving its project, proof, relationship, or repair policy into this package:

1. Keep generated source-output strings as ordinary internal token definitions.
2. Express semantic roles and explicit repair tokens as ordinary tokens using `tokenRef()` where they depend on generated tokens.
3. Declare `modes: ["light", "dark"]` and `defaultMode: "light"` at the graph, never on layers.
4. Replace every persisted or authored `valueByMode` with `value` containing the light/dark map.
5. Replace alias records with explicit semantic token definitions.
6. Replace `compiled.scheme` with `compiled.value`; make the same `.value` change for parsers and CSS export.
7. Rename `ReferenceInput` imports to `TokenReference`.
8. Parse persisted project graph data with `parseTokenGraph()` before compilation.
9. Use the default public selection for emitted semantic tokens and `selection: "all"` when an artifact needs internal generated or repair tokens too.

Public semantic tokens may continue to resolve through internal generated tokens. Direct dependency metadata remains available under `compiled.value.metadataByToken` for stable reference-chain inspection. Default public output is conservatively partial at the type level, so use optional access. An exact literal key tuple is definite after validation; `all` is definite only when the authored graph has a finite inferred key union.
