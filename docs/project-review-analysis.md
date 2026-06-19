# 1. Executive decision

Both source reviews agree on the essential point, and the agreement is correct: **the project already has the right architectural center.** The graph — not Material 3, CSS, DTCG, or a product theme object — is the system of record. Source adapters feed it; validation and compilation resolve it; exporters project it. The repository documents and tests those boundaries, and the package is still private at `0.0.0`, so this is the right moment for structural decisions.

The route to the library’s maximum potential is **not** to turn it into a general-purpose design-token platform immediately. It is to make it an exceptionally rigorous **color-token compiler**:

- Statically typed authoring.
- Multiple composable sources.
- Explicit public/internal token visibility.
- First-class resolution provenance.
- A single expression model for literals, references, and future color computations.
- Deterministic compiled output.
- Multiple pure exporters.
- Strong interoperability without making an external interchange format the internal architecture.

Two recommendations from the source reviews are rejected:

1. **Do not generalize the package to typography, spacing, animation, and other token types yet.**
2. **Do not reshape the internal graph around DTCG JSON.** Build a DTCG exporter and importer instead.

## How to use this document

This is an **architecture direction plus blocker triage**, not a one-pass implementation plan. It deliberately separates four concerns that an earlier draft conflated:

1. The product thesis (this section and section 2).
2. The public API redesign (sections 6 and 7).
3. The compiler internals rewrite (section 8).
4. The multi-phase roadmap (section 11).

Handing the whole document to an implementation pass as a single worklist would cause an overbroad rewrite. The operational rule is: **section 3 is the only set of items that must be done before a first public release.** Everything else is directionally correct but deferred, and the deferral is explicit in section 4 and section 11.

---

# 2. Non-negotiable product boundary

## Keep `color-scheme-tokens` color-specific

Do not rename the core to `design-tokens-core` and do not introduce dimensions, typography, gradients, transitions, or shadows yet. Color is already a substantial domain:

- Multiple color spaces.
- Gamut mapping.
- Hue interpolation.
- Alpha compositing.
- Contrast calculations.
- Dynamic source algorithms.
- Perceptual color difference.
- CSS color serialization.
- Browser-computed versus compiler-computed expressions.

Generalizing across all of those plus typography, spacing, animation, and composite token types would produce a much larger abstraction before a second implementation proves which parts are actually common. The strategy is:

- Keep public APIs color-specific.
- Keep obviously reusable internals — results, keys, modes, DAG indexing — internally generic where convenient.
- Extract a generic package only after a second independent token domain exists and exposes the same abstractions naturally.
- Use DTCG interoperability to participate in the broader design-token ecosystem without becoming the entire ecosystem.

## DTCG is interoperability, not internal architecture

The current token grammar deliberately uses dot-separated paths such as `app.action`; the parser requires at least two dot-separated segments.

DTCG 2025.10, by contrast, prohibits periods inside token and group names because periods participate in reference syntax. A DTCG representation of `app.action` therefore needs a nested `app` group containing an `action` token — not a literal key named `app.action`. ([Design Tokens][1])

DTCG also has its own `$value`, `$type`, grouping, reference, and extension semantics. DTCG 2025.10 is a **Final Community Group Report** — stable and intended for implementation, but explicitly not a W3C Standard or a Standards Track document. ([Design Tokens][1]) That makes a dedicated mapping layer both cleaner and technically necessary: DTCG is an exporter and importer target, never the internal schema.

## Modern color spaces are already represented

The core already models sRGB, OKLCH, and Display-P3, and the CSS formatter can emit all three. This is not a “static hex-only” library today; it is a concrete-color compiler with an incomplete public color algebra. The missing pieces are public constructors, conversion, explicit gamut mapping, computed color expressions, expression-preserving CSS emission, and a consistent formatting policy. Those are real work, but they are additive color-algebra work (section 4, deferred), not a foundational gap.

## Material source boundary is already enforced

The recent adapter-isolation work (`918872e`, `3c29abe`, `8d97975`) moved Material 3 behind a single source adapter, removed the old dynamic-scheme source, and renamed the source types so the public surface no longer leaks Material internals as generic “scheme” machinery. That boundary is now an architectural invariant to **maintain**, not a problem to fix. The exact-root-export and source-policy tests should remain as enforcement.

---

# 3. Confirmed blockers before public release

These are the only items that must land before the first public release. They are public-contract blockers: getting them wrong now means an incompatible v1 later.

## Triage table

The full decision set, including deferrals, is consolidated here so the boundary between “now” and “later” is unambiguous. Sections 3 and 4 narrate the two halves.

| Item                                   | Decision                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| Expression model replacing alias nodes | **Blocker**                                                                        |
| Explicit `defaultMode`                 | **Blocker**                                                                        |
| Public/internal visibility             | **Blocker**                                                                        |
| Selection defaults                     | **Blocker**                                                                        |
| Raw graph transform hook               | Not part of v1; typed plugins deferred                                             |
| DTCG as exporter/importer only         | **Blocker as ADR / doc contract**                                                  |
| Material source boundary enforced      | **Already repaired; maintain as invariant**                                        |
| Canonical deterministic serializer     | **Already independent; maintain as invariant**                                     |
| Mounted plural sources                 | **Blocker only if multi-source v1 is intended** (see section 6)                    |
| Literal-preserving `TokenKey<Name>`    | Strongly preferred, but not blocker unless compile-time key safety is promised     |
| Typed recipe builder                   | Not blocker — public ergonomics layer on top of the runtime-safe graph             |
| Full per-mode resolution trace         | Not blocker — preserve origin/dependency metadata now, expose `explainToken` later |
| DTCG export                            | Not blocker                                                                        |
| `light-dark()` CSS                     | Not blocker                                                                        |
| Contrast utilities                     | Not blocker                                                                        |
| `diffTokenSets`                        | Not blocker                                                                        |
| Color algebra (`mix`, `withAlpha`, …)  | Not blocker                                                                        |
| TypeScript binding exporter            | Not blocker                                                                        |
| Tonal ramps / scales                   | Not blocker                                                                        |

## Blocker rationale

### Expression model replacing alias nodes

This is the strongest single change. Today the graph stores color values as `ModeValues<ColorTokenValue>` on `ColorTokenNode` and stores targets separately on `AliasTokenNode` (`src/core/graph.ts:21`, `src/core/graph.ts:28`). That duplicates mode-variance machinery and makes “what is a token value” ambiguous.

Unify literals and references into one `ColorExpression`. An alias becomes a reference expression; mode variance always lives at the same outer layer; dependency extraction and cycle detection become uniform; and future `mix`, `withAlpha`, and `composite` operations fit naturally without a third node kind. The target model is detailed in section 5.

### Explicit `defaultMode`

The current CSS exporter silently treats the first mode as the default and subsequent modes as attribute-qualified. That is an implicit semantic contract. The graph should require an explicit `defaultMode` alongside `modes`. This is small, cheap, and contract-defining.

### Public/internal visibility

This is a release-blocking omission. The current compiler emits every token unless the consumer manually maintains `include`, and the recipe tests repeatedly pass `include` only to suppress source roles. Relying on `include` or namespace filtering is weaker than an explicit `public` / `internal` field: using `provenance.source === "material3"` would couple diagnostics to export policy, and using `m3.*` would couple naming to export policy.

Source-generated primitives should default to `internal`; application semantic tokens should be explicitly `public`; public tokens may reference internal tokens; internal dependencies resolve normally but are not emitted. Exact `include` should still reject unknown and duplicate keys, and a recipe with no public tokens should report `no-public-tokens` rather than silently emitting an empty artifact. Visibility must not be inferred from namespace or provenance.

### Selection defaults

Compilation should default to `selection: "public"` and offer `"all"` and an explicit `include` override. This is the operational counterpart to visibility and should ship with it.

### Raw graph transform hook

A raw transform accepts and returns the whole graph. That is too broad for the v1 public contract because it bypasses source/layer ownership, weakens provenance, and makes future typed key inference unclear. V1 should not expose such a hook. Customization stays declarative through aliases and layers. A later typed plugin model can be designed if real use cases justify it.

### DTCG as exporter/importer only

This is a documentation/ADR contract rather than a code deliverable: DTCG is never the internal schema, never the canonical serializer, and never the source of truth for modes or visibility. Recording it as a boundary decision now prevents a later drift toward “just store DTCG JSON internally.”

## Already-enforced invariants to maintain

- **Material source boundary.** The adapter isolation in `918872e` / `3c29abe` is the correct shape. Do not re-merge Material internals into core.
- **Canonical deterministic serializer.** `serializeTokenSet` is an independent proprietary representation with stable key and mode ordering. It must remain independent of DTCG and versioned separately. It is valuable for deterministic snapshots and must not be replaced by a DTCG projection.

---

# 4. Deferred non-blockers

These are directionally correct and should be built, but they must not gate the first public release. The earlier draft’s Phase 0 table included almost all of them under “mandatory before publication,” which made Phase 0 a full product rewrite rather than a contract cleanup.

### Typed recipe builder

The proposed fluent builder (`colorRecipe(...).source(...).layer(...)`) is the right eventual authoring model, but it is a **large public API bet**, not a cleanup. It carries generic key-accumulation inference through every pipeline stage. A safer framing:

```text
Runtime-safe graph v1 is mandatory.
Compile-time-safe builder is a public ergonomics layer on top.
```

Build the correct runtime graph model first. The typed builder is a later phase that sits on top of a stable graph. This avoids forcing the entire generic-inference machinery into the same pass as the contract surgery.

### Literal-preserving `TokenKey<Name>`

Changing `TokenKey` from a broad branded string to `TokenKey<Name extends string = string>` that preserves literals is strongly preferred, and the analysis in section 5 explains why `ExtractKeys<G>` alone cannot deliver compile-time key safety on the current broad types. But it is not a public-contract blocker unless v1 explicitly promises compile-time key safety. If v1 promises only runtime safety, literal preservation can follow the typed builder in a later phase.

### Full per-mode resolution trace

The separation between **declaration origin** and **resolution trace** is correct, and the `TokenOrigin` categories (source / layer / plugin / manual) are the right ownership model. But the full recursive `ColorResolution` tree and the `explainToken()` query API are too heavy for a first release.

What the first release **should** preserve (cheap, no query API yet):

```text
token declaration origin
resolved dependency list
deterministic source/layer/plugin identifiers
```

That metadata is enough to support a later `explainToken()` without a breaking change. The full recursive trace and the human-readable explanation are deferred.

### Mounted plural sources

Plural, namespace-mounted sources are the cleaner long-term model and are described in section 6. Whether they are a v1 blocker depends on a single product question: **does v1 need to compose more than one source?** If v1 ships a single-source recipe only, plural mounting is deferred and the current singular `source` stays. If v1 must compose multiple sources, the fragment-and-mount contract is a blocker. This document recommends the decision be made explicitly rather than by accident.

### DTCG export and resolver output

Both are near-term, not Phase 0. The DTCG Format exporter and the DTCG Resolver exporter are interoperability features; they sit on top of a stable compiled set and do not reshape the internal graph.

### `light-dark()` CSS strategy

Accurate and valuable — CSS Color 5 defines `light-dark()` with the first color used for a light element color scheme and the second for a dark one. ([W3C][2]) But it is an additional exporter strategy beside the existing selector-based output, not a release blocker. The selector strategy is sufficient for v1.

### Contrast utilities, diffing, color algebra, TypeScript bindings, tonal ramps

All deferred. WCAG contrast (4.5:1 normal AA, 3:1 large AA, 7:1 normal AAA, 4.5:1 large AAA ([W3C][3])), `diffTokenSets`, `mix` / `withAlpha` / `composite`, generated `.d.ts`, and ramp generation are good features that build on a stable foundation. They do not define the public contract and should not gate publication.

---

# 5. Graph v1 target model

## One expression model

The most important model change is to stop treating “color values” and “aliases” as two separate node categories. The target shape:

```ts
export type ColorExpression<Key extends TokenKey = TokenKey> =
  | {
      readonly kind: "literal";
      readonly value: ColorValue;
    }
  | {
      readonly kind: "reference";
      readonly key: Key;
    };

export type ModeValue<Mode extends ModeKey, Value> = Value | Readonly<Record<Mode, Value>>;

export type TokenVisibility = "public" | "internal";

export interface ColorTokenDefinition<
  Mode extends ModeKey = ModeKey,
  Key extends TokenKey = TokenKey,
> {
  readonly value: ModeValue<Mode, ColorExpression<Key>>;
  readonly visibility: TokenVisibility;
  readonly description?: string;
  readonly deprecated?: string;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export interface ColorTokenGraph<Mode extends ModeKey = ModeKey, Key extends TokenKey = TokenKey> {
  readonly schemaVersion: "color-token-graph/v1";
  readonly modes: readonly Mode[];
  readonly defaultMode: Mode;
  readonly tokens: Readonly<Record<Key, ColorTokenDefinition<Mode, Key>>>;
}
```

One canonical mechanism covers every case:

```ts
// Same reference in every mode
value: ref("m3.primary");

// Different references by mode
value: byMode({
  light: ref("m3.primary"),
  dark: ref("m3.primaryContainer"),
});

// Literal values by mode
value: byMode({
  light: literal(hex("#ffffff")),
  dark: literal(hex("#121212")),
});
```

### Why this is better

- An alias is simply a reference expression.
- Mode variance always exists at the same outer layer.
- Dependency extraction becomes uniform.
- Alias-cycle detection becomes expression-cycle detection.
- Future expressions fit without a new node kind:

```ts
mix(ref("brand.primary"), ref("brand.neutral"), {
  amount: 0.2,
  space: "oklch",
});

withAlpha(ref("app.scrim"), 0.48);

composite(ref("app.overlay"), ref("app.canvas"));
```

- `ColorTokenValue` becomes a real discriminated union because `literal` and `reference` are both implemented; no unimplemented placeholder variant is needed.
- The compiler still resolves every expression to a concrete `ColorValue`, preserving deterministic output.

A key-indexed token record is preferable to an array for the public authoring model: it retains literal keys, prevents duplicate keys within a fragment, and gives direct lookup. Layers are intended to be declarative token fragments, not arbitrary graph mutations; they may later carry metadata such as visibility, description, deprecation, and extensions as Graph v1 evolves. An internal normalized array or index may still be used for compiler efficiency.

## Modes

Require an explicit `defaultMode` alongside `modes`. For the first public model:

- Support one finite ordered mode dimension.
- Require complete mode maps whenever a value is mode-specific.
- Permit static expressions to apply to every mode.
- Keep mode-dependent references through `byMode()`.
- Do not attempt full multi-axis permutations yet.

Multiple dimensions such as color scheme, contrast, platform, and brand can be designed later. Flat mode keys remain sufficient for current light/dark use without a prematurely complex resolver model.

## Visibility and selection

Visibility is a required field on every normalized token, defaulting to `internal` for source-generated primitives and explicit `public` for application semantic tokens. Compilation defaults to `selection: "public"`:

```ts
compileColorGraph(graph, {
  selection: "public", // default
});
```

with alternatives `"all"` and an explicit `include` list. See section 3 for the full semantics.

## Type safety: runtime-mandatory versus compile-time-deferred

The source review’s `ExtractTokenKeys<G>` helper is **insufficient** on the current types, and that analysis is correct. The current `TokenKey` is one broad branded string (`src/core/keys.ts:5`), `ColorSchemeTokenGraph.tokens` is a broadly typed node array, and sources return a non-key-specific `ColorSchemeTokenSource`. Extracting the key type from most current graph values produces `TokenKey`, not a literal union such as `"m3.primary" | "m3.surface"`.

Real compile-time key safety would require **all** of the following:

1. `TokenKey<Name>` preserves its literal string type.
2. Sources expose a literal union of guaranteed keys.
3. Layers accumulate key unions.
4. References are constrained to keys available at that pipeline stage.
5. Compiled token sets retain their emitted key union.
6. Typed plugins declare output keys or explicitly widen back to dynamic `TokenKey`.

That is a deep, pipeline-wide inference design. It is the right eventual design, but it is the typed builder from section 4, not a Phase 0 deliverable. The split is:

```text
Runtime-safe graph v1: mandatory now.
  - Expression union, visibility, defaultMode, selection, key-indexed records.

Compile-time-safe builder: deferred ergonomics layer.
  - Literal-preserving TokenKey<Name>, accumulating layer inference,
    typed plugins, consumer-side key maps, generated .d.ts.
```

The runtime graph must be shaped so the compile-time layer can be added later without a breaking change — specifically, key-indexed records and literal-friendly `tokenKey<const Name>()` should be feasible, even if the full inference builder ships later.

## Provenance: metadata now, full trace later

The first release should record declaration origin and a resolved dependency list, using deterministic identifiers:

```ts
type TokenOrigin =
  | {
      readonly kind: "source";
      readonly adapterId: string;
      readonly instanceId: string;
      readonly role: string;
    }
  | { readonly kind: "layer"; readonly layerId: string }
  | { readonly kind: "plugin"; readonly pluginId: string }
  | { readonly kind: "manual"; readonly id?: string };
```

The pipeline adds origin automatically: source tokens get source origin, layer tokens get layer origin, plugins get plugin origin. Do not add timestamps, absolute paths, or other nondeterministic data.

The full recursive `ColorResolution` tree and `explainToken()` query API are deferred (section 4). A tree rather than a flat `provenanceChain` is still the right future shape because it future-proofs the model for `mix()`, compositing, and other multi-input operations — but it does not need to exist in v1.

---

# 6. Source mounting decision

This is the largest conceptual tension in the codebase and must be resolved explicitly. There are two possible models.

```text
Model A:
  material3Source emits m3.* directly.
  Simple, current, less flexible.

Model B:
  material3Source emits local roles (primary, surface, ...).
  Mounting applies the m3.* namespace.
  Cleaner long-term, supports multiple M3 instances.
```

## Current state

The current implementation is **Model A**. `material3RoleSet` constructs each role key as `m3.${role}` (`src/sources/material3/material3RoleSet.ts:82`), so the adapter emits fully-qualified `m3.*` keys directly into the graph. The recent Material boundary repair preserved this shape; it did not change it.

## Target state

Model B is architecturally cleaner. A source generates a **token fragment** with local roles, and the recipe mounts it into a namespace:

```ts
recipe.source(material3Source({ color: "#6750A4" }), {
  namespace: "m3",
  visibility: "internal",
  instanceId: "brand",
});
```

Under Model B:

- The source owns local roles such as `primary`; the recipe owns global names such as `m3.primary`.
- Two instances of one adapter can coexist (`m3.brand.*` and `m3.accent.*`).
- Namespace collisions become explicit.
- Source identity and token namespace are no longer the same thing.
- Generated key types can be formed as `` `${Namespace}.${Role}` ``.

## The contradiction that must be named

The earlier draft implied the shift to Model B without acknowledging that it contradicts the current `m3.*` output. That has to be made explicit: **if Model B is the target, the current `m3.*` adapter output is an interim public shape, not the final architecture.** Shipping v1 on Model A is acceptable; shipping v1 while silently planning Model B is not, because it bakes `m3.*` into consumer code that Model B would renamespace.

## Recommendation

Choose one, explicitly, before publication:

- **Model A for v1.** Keep `m3.*` direct output. Defer plural mounting and multiple instances. This is the smaller, safer v1. The cost is that a later move to Model B is a source-level migration for the adapter and a renaming exercise for consumers referencing `m3.*`.
- **Model B for v1.** Sources emit local roles; mounting applies namespaces. This is the cleaner long-term shape and makes plural sources (section 4) a natural extension rather than a retrofit. The cost is that the fragment-and-mount contract, collision rules, and instance identity must all be designed now.

This document recommends **Model B if plural sources are a v1 goal, and Model A if they are not.** The two decisions are coupled and should be made together. Whichever is chosen, the adapter’s current `m3.*` output should be documented as either the final shape or the interim shape — never left ambiguous.

If Model B is chosen, the fragment contract and composition rules apply:

- Duplicate source instance IDs: error.
- Duplicate mounted token keys: error.
- Incompatible mode sets: error.
- Source order must not silently mean “last source wins.”
- Replacements must use an explicit override layer or override operation.
- Required source roles must exist; optional roles must be represented honestly in the type system.

The optional-role point matters for Material 3 specifically: the current adapter distinguishes 55 required roles from four optional dim roles. A strict reference API must not pretend optional roles are always guaranteed. Possible treatments include `refOptional("m3.primaryDim", { fallback: ref("m3.primary") })` or an adapter option that promotes optional roles to required and fails generation if any are missing.

---

# 7. Public API naming decision

This is a deliberate decision point, not a hidden recommendation. The earlier draft proposed a root API with names such as:

```text
colorRecipe
defineColorGraph
validateColorGraph
compileColorGraph
compileValidatedColorGraph
getCompiledToken
explainToken
createCssVariableMap
```

That is a serious naming migration. It is not aligned with the current public surface, and it should not be adopted implicitly under “recommended public API shape.”

## Current public surface

After the Material boundary repair, the root exports are honest and color-specific in behavior even where the names still say “scheme”:

```text
createSchemeTokens        createSourceGraph
compileGraph              validateGraph
serializeTokenSet         exportCssVariables
material3Source
tokenKey  parseTokenKey   lightMode  darkMode  modeKey  parseModeKey
parseColorInput  hex  parseHexColor  srgb255
literalColor
```

## Decision

```text
Option A:
  Keep the current public names: createSchemeTokens, createSourceGraph,
  compileGraph, validateGraph. Add new names only as new capabilities
  (e.g. exportDtcg) appear. Cheaper, no migration, names are not lies
  after the Material boundary repair.

Option B:
  Rename everything into color-specific names: colorRecipe,
  defineColorGraph, compileColorGraph, validateColorGraph. A full API
  reset. Cleaner long-term naming, but it is a breaking rename of every
  root symbol and every exported type.
```

This document’s recommendation: **do not rename everything yet.** Keep `createSchemeTokens`, `compileGraph`, `validateGraph`, and the rest unless there is a deliberate decision to do a full API reset. The current names are accurate enough after the boundary repair, and a rename is a one-way door that is cheaper to do before publication than after — but only worth doing if the long-term names are considered load-bearing for adoption.

If Option A is chosen, the eventual typed builder (section 4) can still be named `colorRecipe` later as a new, additive authoring entry point without renaming the existing ones. That keeps the rename option open without spending it now.

**Decision needed before public release.**

---

# 8. Compiler implementation plan

This section is **internal implementation**, not public contract. It belongs in an implementation plan, not in the public API manifesto. None of it changes the public authoring shape; it changes how the compiler validates and resolves internally.

## Validate once

The current graph authoring surface shows **validation-brand inversion**: public graph and layer literals require branded
`TokenKey` / `ModeKey` values before validation has had a chance to parse user input and return structured problems.
That imposes a **branded input tax** on manual graph and layer authors. Brands should be post-validation evidence, not
syntax consumers manufacture inside object literals.

The same boundary applies to color literals: brands and parsed values are post-validation evidence. Authored token keys,
mode keys, and color literals should be plain declarative inputs. Helpers like `tokenKey()`, `modeKey()`, `hex()`, and
`literalColor()` are not the normal authoring model.

Provide two internal levels:

```ts
validateColorGraph(graph)
  -> Result<ValidatedColorGraph, GraphProblem>

compileValidatedColorGraph(validated, options)
  -> Result<CompiledColorTokenSet, CompileProblem>
```

plus an ergonomic convenience that validates and delegates:

```ts
compileColorGraph(graph, options);
```

Today `createSourceGraph()` validates and `compileGraph()` validates again (`src/core/compileGraph.ts:49`). A branded `ValidatedColorGraph` and a separate validated compile path remove the double pass.

## Build a graph index during validation

The validated value should contain or privately reference:

- Token lookup map.
- Mode lookup map.
- Dependency edges per mode.
- Topological order or DFS state.
- Source/layer origin indexes.

Cycle detection then happens once, per mode, with a standard tri-state DFS. Compilation resolves in topological order or memoizes recursive resolution. This removes:

- Duplicated `readModeValue` logic.
- Duplicated cycle detection.
- `stack.includes()` linear scans.
- Repeated token lookups.
- Unreachable `values.length === modes.length` success gates.
- User-facing “impossible after validation” error branches.

A defensive assertion can remain internally, but it should represent a compiler invariant violation, not duplicate a normal validation problem.

## Keep structured problems

Continue the current `Result` approach. Expand problems with stable fields:

```ts
interface ColorTokenProblem {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly token?: string;
  readonly mode?: string;
  readonly sourceId?: string;
  readonly related?: readonly ProblemLocation[];
}
```

Do not collapse structured problems into thrown strings.

## Boundary with the public contract

The public contract is the expression model, visibility, `defaultMode`, and selection (section 3). The validated graph, graph index, and topological resolution are **how** the compiler honors that contract. They can be redesigned internally without a public change, and they should be scheduled as compiler work, not as part of the public API decision.

---

# 9. Exporter roadmap

The exporter boundary is correct and stays: exporters consume compiled sets and do not validate or resolve graphs. Keep that invariant.

## Selector strategy (v1-sufficient)

Retain the current mode-selector output:

```ts
exportCssVariables(compiled, {
  prefix: "theme",
  modeStrategy: {
    kind: "selectors",
    selectors: {
      light: ":root",
      dark: ':root[data-color-scheme="dark"]',
    },
  },
});
```

## `light-dark()` strategy (deferred)

```ts
exportCssVariables(compiled, {
  prefix: "theme",
  modeStrategy: {
    kind: "light-dark",
    light: lightMode,
    dark: darkMode,
    declareColorScheme: true,
  },
});
```

Output:

```css
:root {
  color-scheme: light dark;
  --theme-app-action: light-dark(#6750a4, #d0bcff);
}
```

CSS Color 5 specifies that `light-dark()` uses its first color for a light element color scheme and its second for a dark one. ([W3C][2]) The exporter must reject missing light/dark mappings, more than two selected modes, and mapping the same mode twice. This is a later phase, not a v1 blocker.

## Formatting policy (near term)

Add explicit options:

```ts
colorFormat:
  | "preserve"
  | "srgb"
  | "oklch"
  | "display-p3";

opaqueAlpha:
  | "omit"
  | "include";
```

Defaults: preserve stored color space; omit alpha when it equals `1` in every syntax; use deterministic numeric precision; normalize hue representation; never perform implicit gamut conversion. Later, support ordered fallbacks:

```css
--token: #6750a4;
--token: color(display-p3...);
--token: oklch(...);
```

## TypeScript binding exporter (deferred)

A pure exporter is preferable to having the compiler write files:

```ts
exportTypeScriptBindings(compiled.value, {
  moduleName: "theme.tokens",
});
```

A future CLI can orchestrate writing CSS, JSON, and TypeScript artifacts. TypeScript cannot validate arbitrary references written directly in plain `.css` files; that would require a Stylelint rule, language-server integration, or editor plugin later.

---

# 10. Interop roadmap

Keep the internal canonical serializer independent. It is valuable for deterministic snapshots and should remain versioned independently of any DTCG projection. Add a separate DTCG exporter with two modes.

## Single-mode token file

```ts
exportDtcg(compiled, {
  mode: lightMode,
  include: "public",
});
```

`app.action` becomes a nested group structure, because DTCG prohibits `.` in token and group names: ([Design Tokens][1])

```json
{
  "app": {
    "action": {
      "$type": "color",
      "$value": {
        "colorSpace": "srgb",
        "components": [0.4, 0.31, 0.64],
        "alpha": 1
      }
    }
  }
}
```

DTCG defines token objects through `$value`, with `$type` identifying the token type. ([Design Tokens][1])

## Multi-mode resolver output

```ts
exportDtcgResolver(graphOrCompiled, {
  modifier: "color-scheme",
});
```

The DTCG Resolver Module explicitly models multiple contexts such as light and dark themes through sets, modifiers, contexts, and resolution order. ([Design Tokens][4])

Use namespaced `$extensions` for information DTCG does not natively represent: visibility, source adapter, resolution trace, Material algorithm settings, internal token key, and deprecation metadata beyond standard fields.

Later add `importDtcg()`, but keep import and export loss-aware: both should return warnings when one model cannot represent the other exactly.

## Diagnostics and analysis (deferred)

`diffTokenSets(before, after)` should report added/removed tokens, added/removed modes, per-token per-mode value changes, metadata changes, origin changes, and resolution changes. Exact structural diffing comes first; perceptual thresholds (`delta-e-ok`) require stable conversion and gamut behavior.

Contrast utilities should expose low-level and policy APIs separately:

```ts
compositeColor(foreground, background);
wcagContrastRatio(foreground, background);
checkTextContrast(foreground, background, { level: "AA", text: "normal" });
```

WCAG 2.2 specifies 4.5:1 for normal text and 3:1 for large text at level AA; enhanced contrast uses 7:1 and 4.5:1 respectively. ([W3C][3]) The utility must convert appropriately for WCAG luminance, composite translucent foregrounds, reject ambiguous translucent backgrounds unless a backdrop is provided, and return the numeric ratio independently from pass/fail policy. Automatic contrast repair should not ship in the first contrast release; reporting and deterministic primitives come first.

---

# 11. Final implementation phases

## Phase 0 — Contract surgery while still private at `0.0.0`

Only true public-contract blockers. This is intentionally much smaller than the earlier draft’s Phase 0.

| Workstream      | Deliverable                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope           | ADR declaring the package color-specific and DTCG an interchange boundary                                                                           |
| Expressions     | Implemented `literal` and `reference` variants; remove separate alias-node semantics                                                                |
| Modes           | Explicit `defaultMode` in the graph                                                                                                                 |
| Visibility      | Required `public` / `internal` metadata                                                                                                             |
| Selection       | Compilation defaults to `selection: "public"`                                                                                                       |
| Escape hatches  | Raw transform excluded from v1; typed plugins deferred                                                                                              |
| Source mounting | **Decision recorded**: Model A (singular `source`, `m3.*` direct) or Model B (plural mounted fragments). Implement only what the decision requires. |
| Naming          | **Decision recorded**: Option A (keep current names) or Option B (color\* rename)                                                                   |
| CSS             | Consistent alpha formatting; honor explicit default mode                                                                                            |
| Tests           | Visibility, selection, expression cycles, deterministic insertion-order independence                                                                |

**Exit criterion:** there are no unresolved public-contract questions around identity, visibility, modes, source composition, references, or naming. Items marked “Decision recorded” require a written decision, not necessarily full implementation, before exit.

## Phase 1 — First public release

Ship the stable foundation defined by Phase 0:

- Graph and expression model.
- Material 3 source adapter (Model A or B per the recorded decision).
- Public/internal compilation with `selection` defaults.
- Declaration-origin and dependency-list metadata (not the full trace).
- Selector-based CSS.
- Canonical snapshot serialization.
- Exact public API and packed-consumer tests.
- Clear schema/versioning policy.

Do not block this release on DTCG, tonal ramps, framework bindings, the typed builder, full provenance traces, or automatic contrast repair.

## Phase 2 — Inspection and consumer tooling

- `explainToken` (full per-mode resolution trace).
- `diffTokenSets`.
- `light-dark()` CSS strategy.
- TypeScript binding exporter.
- WCAG contrast and alpha compositing.
- Human-readable diff formatter.
- CLI commands for build, snapshot, and diff.

## Phase 3 — Interoperability

- DTCG Format and Color export.
- DTCG Resolver output for modes.
- DTCG import with structured warnings.
- JSON Schema for the library’s own serialized graph if appropriate.
- External source-adapter authoring documentation.
- Conformance fixtures.

## Phase 4 — Color algebra

- Color-space conversion.
- Explicit gamut-mapping strategies.
- `mix`, `withAlpha`, `composite`.
- Relative-color operations.
- Optional expression-preserving CSS output.
- Delta-E token diffs.
- Generic OKLCH scale/ramp generation.

## Phase 5 — Ecosystem expansion

- Additional source adapters.
- Stylelint or language-server token-key validation.
- Framework-specific bindings in separate packages.
- Evaluate a generic token-graph extraction only after at least one non-color domain has been implemented independently.

---

# Final recommendation

The project should become:

> **A typed, deterministic, inspectable color-token compiler with pluggable generators and standards-based exporters.**

The risk is trying to build **all** of that before the first public release. The immediate priorities are only the Phase 0 contract surgery:

1. Replace alias nodes with reference expressions.
2. Add explicit `defaultMode`.
3. Add explicit visibility and selection defaults.
4. Exclude raw graph transforms from v1 and defer typed plugins.
5. Record the DTCG-as-interop and Material-boundary invariants as ADRs.
6. Record the source-mounting decision (Model A vs Model B).
7. Record the naming decision (Option A vs Option B).
8. Preserve the current strict package-boundary tests.

Everything else — the typed builder, full provenance traces, DTCG, `light-dark()`, contrast, diffing, color algebra, bindings — is directionally correct and deferred to the phases that build on a stable, published contract. That preserves the project’s strongest quality — architectural discipline — while creating clean extension points for modern CSS, computed colors, DTCG, diagnostics, contrast, code generation, and future source adapters.

[1]: https://www.designtokens.org/tr/2025.10/format/ "Design Tokens Format Module 2025.10"
[2]: https://www.w3.org/TR/css-color-5/ "CSS Color Module Level 5"
[3]: https://www.w3.org/TR/WCAG22/ "Web Content Accessibility Guidelines (WCAG) 2.2"
[4]: https://www.designtokens.org/tr/2025.10/resolver/ "Design Tokens Resolver Module 2025.10"
