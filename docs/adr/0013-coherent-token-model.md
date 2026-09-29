# ADR 0013: Coherent Token Model

## Status

Proposed. This is a design record for the next breaking core release. Like
[ADR 0004](./0004-material3-adapter-design.md), it covers a connected set of decisions and is
sliced into decision records on acceptance: [ADR 0010](./0010-graph-tokens-compose-last.md)
(composition order), [ADR 0011](./0011-visibility-preserving-overrides.md) (visibility),
[ADR 0012](./0012-single-hyphen-css-variable-names.md) (CSS names), and new slices for authoring and
types, the `concat` expression, compiled provenance, the CSS activation model, `var()` output, the
result helper, and wire-format evolution. Each slice names the part of
[ADR 0009](./0009-core-contract-convergence.md) it supersedes.

## Context

The [2026-09 audit](../audit-2026-09.md) found problems in composition precedence, override
visibility, authoring entry points, static typing, CSS naming, and CSS option shape. They are one
contract, not independent fixes: the composition order decides what an override means, the
override rule decides visibility, visibility decides the public key set, the key set decides the
types, and the types and modes decide what CSS export can promise. Designing them one at a time
would lock in a weaker type or authoring model.

Consumer evidence gathered for this design, beyond the audits:

- The production consumer now composes a real `material3` layer into a 386-token, six-mode graph
  (338 graph tokens, 48 layer tokens, 26 public roles), compiles with exact keys and with `all`,
  and exports CSS with custom `variableName` and exact root-anchored selectors. Its real stylesheet
  is rendered by its own code outside `exportCssVars()`, because the exporter cannot express a
  system-preference fallback (`@media (prefers-color-scheme: dark) { :root:not([data-scheme]) }`),
  per-mode `color-scheme`, or `var()` wiring. It tracks "why is this role this value?" itself.
- Two Material 3 demo applications compile and export in the browser on every input, alias
  shadcn/ui roles to internal Material roles, select dark mode with `:root.dark`, and repeat the
  `if (!result.ok) throw` boilerplate for every call.

## Goals and non-goals

Goals: one coherent, predictable contract for authoring, composition, visibility, static types,
compiled output, and CSS export; better error messages than today; an API worth stabilizing; no
closed doors for DTCG import, `var()` output, or richer provenance.

Non-goals: platform exporters, a CLI, plugin registries, token value types or parsing, a color
model, DTCG semantics in core, a general expression language, and runtime theme switching.

## The model

```text
trusted authoring                              persisted JSON
defineTokens · defineTokenLayer                 parseTokenGraph · parseTokenLayer
tokenRef · tokenConcat                          (v2, and v1 through a deterministic upgrade)
                \                              /
                 canonical graph, formatVersion 2 ── one validator
                                  |
         composition: layers in array order, then the graph's own tokens
         visibility: latest explicit visibility, else the introducing default
                                  |
         resolution per mode: a DAG over ref and concat, with cycle detection
                                  |
         selection: public (default) | all | { keys }
                                  |
                   compiled scheme: values and provenance
                   /                                    \
   exportCssVars: blocks of mode × condition          serializeCompiledScheme
   (base, system, explicit, custom), resolved
   or var()-linked values
```

## Decisions

### D1. Vocabulary

A user authors tokens, references, modes, and visibility. Layers and provenance are the next step.
Compiler vocabulary stays out of the first example.

| Term            | Meaning                                                               | Change                     |
| --------------- | --------------------------------------------------------------------- | -------------------------- |
| token           | a dot-path key with one value per mode                                | unchanged                  |
| reference       | an explicit `{ ref }` record, authored with `tokenRef()`              | unchanged                  |
| expression      | a literal string, a reference, or a `concat` of both                  | adds `concat`              |
| mode            | one value dimension; the graph owns the ordered list and the default  | order is preserved         |
| layer           | an ordered, reusable set of declarations without modes                | now composes like `@layer` |
| graph           | modes, ordered layers, and the graph's own tokens                     | own tokens compose last    |
| visibility      | `public` or `internal`; decides the default compiled and CSS output   | overrides preserve it      |
| compiled scheme | resolved values per mode plus provenance                              | provenance reshaped        |
| block           | one CSS rule (optionally in `@media`) holding one mode's declarations | groups replace `strategy`  |

With graph-last composition, token layers behave exactly like CSS cascade layers: later layers win
over earlier ones, and the unlayered declarations, here the graph's own tokens, win over every
layer. The word "layer" is therefore kept, and the CSS option for an actual cascade layer is named
`cascadeLayer`. "Fragment" leaves the vocabulary: `material3()` returns graph options. `scope`
becomes `root`, which avoids confusion with CSS `@scope` and names the element that carries the
default mode. Discriminating `strategy` objects disappear. "Scheme" stays as the name of the
compiled output and the package.

### D2. Authoring: two tasks, two helpers

There are two distinct authoring tasks: defining a reusable set of declarations, and composing a
complete graph. They get one helper each.

- `defineTokens(tokens, options?)` composes a graph and is the only graph helper. Its options are
  `modes`, `defaultMode`, `defaultVisibility`, and `layers`. `defineTokenGraph` is removed: it was
  an equivalent second form, contrary to ADR 0002.
- `defineTokenLayer({ id, tokens, defaultVisibility? })` defines reusable declarations without a
  mode envelope. Generators produce layers; `material3()` returns `{ modes, defaultMode, layers }`,
  which is itself a valid options argument.
- `tokenRef(key)` and the new `tokenConcat` (D5) author expressions. The canonical `{ ref }` and
  `{ concat }` records are accepted directly, as `{ ref }` is today.
- Modes keep their authored order. `defaultMode` stays explicit whenever `modes` is given, and it
  need not be the first mode. Authored order, the default mode, and CSS rule order are three
  separate things (D7).
- Reserved mode names become `ref`, `concat`, `value`, `visibility`, `description`, `deprecated`,
  and `extensions`. `valueByMode` is dropped: the lower-kebab mode pattern already excludes it.
- `$schema` leaves the authoring helpers; it is a JSON editor hint (D10).

```ts
const tokens = defineTokens({
  "brand.600": { value: "oklch(62% 0.18 250)", visibility: "internal" },
  "action.primary": tokenRef("brand.600"),
  surface: "#ffffff",
});

const theme = defineTokens(
  {
    "md.sys.color.primary": { light: "#b3261e", dark: "#f2b8b5" }, // stays internal
    primary: tokenRef("md.sys.color.primary"),
    "ring-shadow": tokenConcat`0 0 0 3px ${tokenRef("primary")}`,
  },
  material3("#6750a4", { visibility: "internal" }),
);
```

### D3. Composition and visibility are one rule set

- Composition positions are the layers in array order, then the graph's own tokens
  ([ADR 0010](./0010-graph-tokens-compose-last.md)). For each key the last declaration wins and
  replaces the previous declaration's value and descriptive metadata.
- Effective visibility is the most recent explicit `visibility` in the key's declaration chain;
  without one, it is the `defaultVisibility` of the position that introduced the key
  ([ADR 0011](./0011-visibility-preserving-overrides.md)). A position's default therefore applies
  to the keys it introduces, and an override that omits `visibility` keeps what it replaces.
- Visibility is the only property that looks through the chain. Description, deprecation, and
  extensions come from the winning declaration only. There is no general metadata merge.
- References resolve against the final composed graph.
- Explicit and defaulted visibility must stay distinguishable until composition completes. The wire
  format already keeps them apart: a token record carries `visibility` only when it was authored.
  The parsed representation must keep that distinction instead of resolving visibility eagerly, as
  `parseGraphTokenDefinition` does today.

The runtime prototype composes the real `material3` layer with a direct graph override and public
aliases: the override wins, stays internal without restating visibility, and records the ordered
path `material3` then `graph` (Appendix B).

### D4. Static typing: complete public records for literal graphs

`defineTokens` infers the literal token record. Its result type carries the key union, the mode
union, and the public key union after composition:

```ts
TokenGraph<Key, Mode, PublicKey>;
```

`compileTokenGraph(graph)` with the default public selection then returns a complete record
whenever the public key union is finite. `all` and exact literal keys keep their current typing.
Graphs whose keys are dynamic, for example built with `Object.fromEntries`, keep the conservative
partial record; a dynamic key set anywhere in the composition makes the public union `string`.

The mechanism is a plain `const` type parameter for the token record, validated by an F-bounded
constraint. Every invalid entry maps to the specific expected shape, so the diagnostic lands on the
offending property. Excess properties map to named markers, such as
`UnknownTokenProperty<"descripton">` and `UnknownMode<"dim">`. Layers carry their explicit public
and internal key unions as phantom type information so the type-level composition mirrors D3. Four
candidate signatures were measured (Appendix A):

| Candidate                                | Errors caught (of 10) | Reference "Did you mean" | Literal inference on TS 5.9 and 6.0 |
| ---------------------------------------- | --------------------: | ------------------------ | ----------------------------------- |
| Today's shape (key union and `NoInfer`)  |                     9 | kept                     | not applicable                      |
| Loose F-bounded constraint               |                     6 | kept                     | correct                             |
| Reverse-mapped validator                 |                    10 | kept, plus property hint | incorrect on 5.9, fragile on 6.0    |
| Plain `const` capture, strict constraint |                    10 | kept                     | correct                             |

The last candidate is chosen. It catches every case today's API catches, plus metadata mixed with
mode keys, which today only fails at runtime. Reference typos keep their elaborated diagnostic and
TypeScript's "Did you mean" suggestion; only the target type named in the first line changes, from
`TokenAuthoring<…>` to the specific expected shape. The reverse-mapped validator gives the nicest
excess-property messages, but reading literal values back from reverse-mapped inference is not
reliable: on TypeScript 5.9 it silently loses explicit visibility, which would make the complete
public record claim keys the runtime omits.

Measured on the real production graph written as literal TypeScript (386 tokens, six modes), the
chosen typing costs 0.36–0.42 s of check time against 0.33–0.44 s for today's types, on both
TypeScript 5.9.3 and 6.0.3. A synthetic 2,000-token literal graph costs about twice today's check
time. Mixing a dynamic spread with literal tokens that reference dynamic keys fails type checking
today and continues to fail; it is a TypeScript limitation of index-signature spreads, not a
regression.

### D5. Expressions: a minimal `concat`

```text
TokenExpression = string | { ref: Key } | { concat: [part, ...part[]] }
part            = string | { ref: Key }
```

- `concat` joins literal parts and resolved references in order. Its result is still an opaque
  string: the compiler never parses, evaluates, or interprets it, and bare strings are never
  scanned for references.
- Its dependencies are all referenced keys. Resolution becomes a per-mode DAG walk with cycle
  detection that stays iterative and bounded.
- Canonical form: at least one part, adjacent literal parts merged, empty literal parts dropped. A
  `concat` without references normalizes to its string.
- `tokenConcat` is a tagged template for authoring:
  `` tokenConcat`0 0 0 3px ${tokenRef("primary")}` ``. Adapters write the canonical record.
- Nested `concat`, conditionals, fallbacks, and arithmetic are excluded. `calc()` and
  `color-mix()` stay CSS text that `concat` can carry.

The structure earns its place in core for three reasons:

- Overrides propagate into composites. Probe A in Appendix B imports a DTCG-style border whose
  color is an alias, then overrides the color in a later layer. With eager flattening the border
  keeps the old color (`1px solid #cccccc`); with `concat` it follows (`1px solid #0055ff`). A
  future DTCG adapter that flattens composites would silently break layered overrides.
- `var()` output can link composites to their targets (D8).
- Provenance can report the dependencies of a composite value.

Adding `concat` later would force another wire-format version, so it belongs in the same format
revision as D3.

### D6. Compiled scheme and provenance

The compiled scheme keeps `tokens` as resolved values per mode, in authored mode order. Per-token
metadata answers "why is this token this value?" directly:

```ts
interface CompiledTokenMetadata<Mode extends string> {
  readonly visibility: TokenVisibility;
  // The ordered composition path for this key; the last entry is the winning declaration.
  readonly declarations: readonly [TokenDeclarationRecord, ...TokenDeclarationRecord[]];
  // The winner's authored expression per mode; each reference carries its target's value.
  readonly expressionByMode: Readonly<Record<Mode, CompiledExpression>>;
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}
interface TokenDeclarationRecord {
  readonly origin: { readonly kind: "graph" } | { readonly kind: "layer"; readonly id: string };
  readonly visibility?: TokenVisibility; // present only when that declaration set it explicitly
}
type CompiledReference = { readonly ref: string; readonly value: string };
type CompiledExpression =
  string | CompiledReference | { readonly concat: readonly (string | CompiledReference)[] };
```

`origin` and `dependenciesByMode` are removed: both are derivable from `declarations` and
`expressionByMode`. For the Material override in D2, the compiled record of
`md.sys.color.primary` reads "declared by `material3`, replaced by the graph, internal because
nothing restated it". The record of `primary` reads "a reference to `md.sys.color.primary`, which is
`#b3261e` in light". Walking a chain through tokens outside the selection uses `selection: "all"`.
An explain helper can be added later without a format change.

### D7. CSS export: one activation model

CSS export emits blocks. A block holds one mode's token declarations under one condition. Every
mode can activate through four kinds of condition:

| Group    | Condition                                                              | Default                                                  |
| -------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| base     | the default mode at `root`                                             | `:root`                                                  |
| system   | a media query selects a mode at `root` while no explicit marker is set | none: core does not know which mode is dark              |
| explicit | an attribute or class marker selects a mode on any element             | `[data-theme="<mode>"]` when there is more than one mode |
| custom   | author selectors, optionally inside a media query                      | none                                                     |

```ts
exportCssVars(scheme, {
  prefix: "app",
  root: ":root", // or ":host" for a shadow root
  attribute: "data-theme", // or classPrefix: "theme-", or attribute: false for custom only
  system: { dark: "(prefers-color-scheme: dark)" },
  selectors: { dark: ".dark" }, // extra conditions; { selector, media } entries are allowed too
  properties: { light: { "color-scheme": "light" }, dark: { "color-scheme": "dark" } },
  references: "var",
  cascadeLayer: "tokens",
});
```

- Explicit markers are unanchored, so any element can switch modes and nested sections work by
  default. The default mode also gets its marker, so a light island inside a dark section works.
- With `root: ":host"`, markers are generated for the host (`:host([data-theme="dark"])`) and for
  elements inside the shadow tree, and the system fallback becomes `:host(:not([data-theme]))`.
- Emission order is structural: base, system, explicit in authored mode order, then custom. The
  generated conditions do not depend on that order except for one tie, the base selector against an
  explicit marker on the root element, which base-first emission resolves. The system fallback
  carries the `:not()` marker test, so it never competes with an explicit choice.
- `properties` adds plain declarations such as `color-scheme` to a mode's blocks. Names are
  lowercase CSS property identifiers, never custom properties, and values pass the existing
  declaration-safety check.
- `cascadeLayer` wraps the output in `@layer`, so unlayered application CSS overrides tokens
  without specificity contests.
- Names follow [ADR 0012](./0012-single-hyphen-css-variable-names.md).
- The bounded selector grammar gains `:where()`, `:is()`, `:not()`, `:host`, and `:host()`, whose
  arguments reuse the same grammar. Media conditions use a bounded grammar of media types,
  `not`/`only`, `and`/`or`, and parenthesized features.
- `false` and omission differ: `attribute: false` disables generated markers, while omitting
  `attribute` selects the conventional default.
- Every failure is collected, not only the first.
- The result keeps `css`, `blocks`, and `variableByToken`. A block reports its `group`, `mode`,
  `selectors`, optional `media`, token `declarations`, and extra `properties`.

The real browser verification in Appendix C loads this output and checks computed values on the
root, a dark section, a light island inside it, plain descendants, marked and unmarked runtime
overrides, an unlayered author override, and two web components with shadow roots. All 26 checks
pass for both value modes under both system preferences.

### D8. `var()` references as an output semantic

`references: "var"` emits references as `var()` instead of resolved values. Resolved output stays
the default.

- A reference is emitted as `var(--target)` only when its direct target is emitted by the same
  export; otherwise the target's resolved value for that mode is inlined. `concat` parts follow the
  same rule individually. A token that references an internal source therefore keeps a literal
  value, while an alias of another public token stays linked.
- Every block declares every emitted token, including aliases. This is required, not an
  optimization: a custom property is computed on the element that declares it and inherits as a
  computed value. Appendix C shows an alias declared once on an ancestor staying `red` inside a
  section that redeclares its target as `blue`, while the redeclared alias follows to `blue`.
- Consequences: an override of a target on any element that receives a mode block propagates to
  its aliases, and so does an unlayered application override. An inline override on an unmarked
  descendant does not propagate, because nothing redeclares the alias there. The option
  documentation states that limit.
- Declaration order inside a block is irrelevant to `var()` resolution, so blocks keep canonical
  key order.

### D9. Results: `orThrow`

The binary `Result` stays. One helper covers the boundary where any issue should stop the
operation:

```ts
function orThrow<Value, Problem extends Issue>(result: Result<Value, Problem>): Value;
```

It returns `result.value` or throws an `Error` whose message lists `code`, `path`, and `message`
for every issue, and whose `cause` is the complete issue tuple. The trusted authoring helpers throw
the same shape, so tools can read their codes and pointers without parsing messages. No operation
gets a throwing twin.

### D10. Wire formats, schemas, and evolution

- All three artifacts move to `formatVersion: 2`. A v2 graph carries layers before tokens in
  canonical key order, to mirror composition order, and keeps authored mode order.
- Each version is validated strictly: unknown properties fail.
- Readers accept the current version and, for graphs and layers, the previous version through a
  deterministic upgrade. The upgrade moves graph declarations that v1 layers shadowed into a
  leading layer, since they never won in v1, and makes visibility explicit wherever v2 inheritance
  would differ from v1. Across 2,000 randomized v1 graphs, compiled values and visibility are
  identical before and after (Appendix B). Compiled schemes are derived artifacts; a v1 compiled
  scheme fails with a clear format-version issue and is recompiled from its graph.
- Writers emit only the current version.
- `$schema` is an optional editor hint. Parsers accept any string, never interpret it, and preserve
  it verbatim; serializers never add one. `kind` and `formatVersion` alone identify an artifact.
  Users can point `$schema` at the installed package (`./node_modules/scheme-tokens/schemas/...`)
  or at a CDN copy.
- The schemas become self-contained (no cross-file `$ref`), so any `$schema` location works in
  editors. Their `$id` must not depend on a domain the project does not control: either the
  project acquires and hosts `scheme-tokens.dev` with byte-checked copies, or the ids become URNs
  such as `urn:scheme-tokens:schema:token-graph:2`. This is the maintainer's decision.
- From 1.0 on, format versions change only in major releases, and readers keep accepting the
  previous source format for at least one major. On acceptance this replaces the AGENTS.md rule
  against old-format readers for persisted source artifacts.

### D11. One semantic authority

Trusted authoring and untrusted parsing keep separate entry paths, but no rule exists twice:

1. Authoring normalization turns shorthand into canonical declarations.
2. One validator checks a canonical graph or layer and returns issues with pointers. Parsers
   return them as `Result`; helpers throw them (D9).
3. One composer applies D3.
4. One resolver walks the expression DAG.
5. Selection, projection, and the exporters work only on composed, resolved data.

The three parallel validators and four layer parsers that exist today collapse into this pipeline.

### D12. Revalidated hypotheses

| Hypothesis                                     | Verdict                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Values are semantically opaque in core         | Holds. `concat` composes structure without interpreting values.                               |
| References are explicit                        | Holds, and `concat` parts are explicit too.                                                   |
| Deterministic compilation                      | Holds. Authored mode order is data and just as deterministic.                                 |
| No color model in core                         | Holds. `color-scheme` travels through generic `properties`; `light-dark()` stays out of core. |
| Material 3 is a sibling package                | Holds.                                                                                        |
| A bounded selector grammar                     | Holds, extended with `:where()`, `:is()`, `:not()`, `:host`, `:host()`, and bounded media.    |
| Trusted and untrusted entry paths are distinct | Holds, with one validator, composer, and resolver behind both (D11).                          |
| Modes are one flat list                        | Holds for the model. Two-axis applications express their selectors as custom conditions.      |

## Acceptance examples

1. **Hand-authored graph.** The first example in D2 compiles to the public keys `action.primary`
   and `surface`, and CSS export emits `:root { --action-primary: …; --surface: … }` with no
   options.
2. **Material 3, overrides, and public aliases.** The second example in D2 with the real adapter:
   the direct graph override wins and stays internal, the nine public tokens compile, all 48
   Material roles stay internal, and provenance records `material3` then `graph` for the
   overridden role.
3. **System light and dark with an explicit choice.** Mapping `dark` to the media query
   `(prefers-color-scheme: dark)` through `system` emits a fallback block for
   `:root:not([data-theme])` inside that media query. An unset root follows the system preference,
   and `data-theme="light"` and `data-theme="dark"` win over it in both directions.
4. **A nested, differently themed section.** `<section data-theme="dark">` is dark on a light page,
   and `<div data-theme="light">` inside it is light again, for page roots and shadow roots.
5. **A reference whose target changes across contexts.** With `references: "var"`, the alias
   `ring` is emitted as `var(--primary)` and the composite `ring-shadow` as
   `0 0 0 3px var(--primary)`. Both resolve in the mode of the element that renders them, and both
   follow target overrides on marked elements and in unlayered CSS.
6. **The production two-axis shape.** Palette and appearance stay application attributes. With
   `attribute: false`, the prototype emits custom conditions for the flattened modes, including a
   system fallback per palette. This example was generated but not browser-verified.

The production consumer migrates by replacing `defineTokenGraph({ ...material, tokens })` with
`defineTokens(tokens, material)`, `variableName` with `prefix: "color"`, and the exact selector map
with `attribute: false` plus `selectors`. None of its 338 graph keys collides with the 48 Material
keys, so the new composition and visibility rules change nothing in its output, and neither it nor
the Material demo applications read the removed `origin` or `dependenciesByMode` metadata. Only
the CSS block order changes, from canonical to authored mode order. Today the six modes are emitted
as mono-light, material3-dark, material3-light, mono-dark, vivid-dark, and vivid-light; after the
change they follow the authored order mono-light, mono-dark, vivid-light, vivid-dark,
material3-light, and material3-dark. The Material demo applications replace their boilerplate
with `orThrow` and `:root.dark` with `classPrefix: ""`, which also makes nested dark sections work.

## Release scope

The smallest coherent breaking release is one core release, proposed as `0.4.0`, with a companion
`@scheme-tokens/material3` release.

Included, because each item changes the contract or the wire format and would otherwise force
another breaking release:

- D1 and D2: vocabulary, `defineTokens` as the single graph helper, `tokenConcat`, and authored
  mode order;
- D3: graph-last composition and visibility-preserving overrides;
- D4: static public-key typing with the chosen mechanism and error markers;
- D5 and D6: `concat` and the reshaped compiled provenance;
- D7 and ADR 0012: the CSS activation model, names, and collision diagnostics;
- D9: `orThrow`, because every example in the documentation needs it;
- D10: format version 2, the v1 upgrade path, the `$schema` rule, self-contained schemas, and the
  schema identity decision;
- D11: the single validation, composition, and resolution pipeline behind it all.

D8 (`var()` output) is additive once D6 ships, so it is not a release blocker. The prototype shows
it is small, and it is recommended for the same release.

Deferred, because each item is additive later: an explain helper for provenance chains, the DTCG
import package, Material custom colors and non-color `md.sys` token families, a runtime variant
catalogue for `material3`, a build-tool plugin, contrast checking as a sibling package,
`@property` registration, and further selector features.

`1.0.0` follows once the production consumer and the Material applications run on the new release
and the TypeScript 7 gate is green.

## Remaining uncertainties

- The schema identity choice between an owned domain and URN ids (D10) is the maintainer's.
- Type-check cost is about twice today's at 2,000 literal tokens. The implementation should
  profile the constraint before release. TypeScript 7.0 has not been measured yet.
- The chosen typing reports misspelled metadata keys as `UnknownTokenProperty<"descripton">` rather
  than with TypeScript's own spelling suggestion.
- `tokenConcat` is a working name; it mirrors the `concat` record the way `tokenRef` mirrors `ref`.
- `properties` must stay a small, validated escape for mode-level declarations such as
  `color-scheme`, not a general stylesheet feature.
- Class markers let one element carry two mode classes. Emission order then decides the winner, and
  the documentation must say so.
- Compiled v1 schemes are not upgraded. If a consumer persists only compiled output, that consumer
  must recompile.

## Appendix A — type prototype

A standalone module compared four `defineTokens` signatures with the same inputs on TypeScript
6.0.3 (repository) and 5.9.3 (the production consumer's compiler). The ten error cases were:
reference typos to a graph key (E1), to a layer key (E2), in an expanded mode map (E6), and in a
`concat` (E7); a mode map missing a mode (E3); an unknown mode in a direct (E4) and in an expanded
mode map (E10); an invalid visibility (E5); a misspelled metadata key (E8); and metadata mixed with
mode keys (E9).

| Candidate                                | Caught | Missed          | Reference "Did you mean" |
| ---------------------------------------- | -----: | --------------- | -----------------------: |
| Today's shape                            |      9 | E9              |                        4 |
| Loose F-bounded constraint               |      6 | E4, E8, E9, E10 |                        4 |
| Reverse-mapped validator                 |     10 | none            |                        4 |
| Plain `const` capture, strict constraint |     10 | none            |                        4 |

Results were identical on both TypeScript versions. The reverse-mapped validator additionally
suggests `description` for E8, but reading explicit visibility back from reverse-mapped inference
returned `never` on 5.9.3 and `string` for some shapes on 6.0.3, so its public key union is
unsound.

The type layer of the chosen candidate, exactly as tested (the prototype named the two helpers
`defineTokensP` and `defineTokenLayerP`):

```ts
export type TokenVisibility = "public" | "internal";
export interface TokenReference<Key extends string = string> {
  readonly ref: Key;
}
export interface TokenConcat<Key extends string = string> {
  readonly concat: readonly (string | TokenReference<Key>)[];
}
export type TokenExpression<Key extends string = string> =
  string | TokenReference<Key> | TokenConcat<Key>;
export type TokenModeValues<Mode extends string, Key extends string> = {
  readonly [M in Mode]: TokenExpression<Key>;
};
export interface TokenMetadata {
  readonly description?: string;
  readonly deprecated?: boolean | string;
}
export type ExpandedToken<Key extends string, Mode extends string> = TokenMetadata & {
  readonly value: TokenExpression<Key> | TokenModeValues<Mode, Key>;
  readonly visibility?: TokenVisibility;
};
export type TokenAuthoring<Key extends string, Mode extends string> =
  TokenExpression<Key> | TokenModeValues<Mode, Key> | ExpandedToken<Key, Mode>;

declare const layerVisibility: unique symbol;
export interface TokenLayer<
  Key extends string = string,
  ExplicitPublic extends string = string,
  ExplicitInternal extends string = string,
  Default extends TokenVisibility = TokenVisibility,
> {
  readonly kind: "scheme-tokens/token-layer";
  readonly formatVersion: 2;
  readonly id: string;
  readonly defaultVisibility: Default;
  readonly tokens: { readonly [K in Key]: ExpandedToken<string, string> };
  readonly [layerVisibility]?: {
    readonly public: ExplicitPublic;
    readonly internal: ExplicitInternal;
  };
}

declare const graphKeys: unique symbol;
export interface TokenGraph<
  Key extends string = string,
  Mode extends string = string,
  PublicKey extends string = string,
> {
  readonly kind: "scheme-tokens/token-graph";
  readonly formatVersion: 2;
  readonly modes: readonly [Mode, ...Mode[]];
  readonly defaultMode: Mode;
  readonly defaultVisibility: TokenVisibility;
  readonly layers: readonly TokenLayer[];
  readonly tokens: { readonly [key: string]: ExpandedToken<string, Mode> };
  readonly [graphKeys]?: { readonly all: Key; readonly public: PublicKey };
}

type ExplicitKeys<T, V extends TokenVisibility> = {
  [K in keyof T]: T[K] extends { readonly visibility: V } ? K : never;
}[keyof T] &
  string;

interface VisibilityState {
  readonly all: string;
  readonly public: string;
  readonly internal: string;
}
type Compose<
  S extends VisibilityState,
  K extends string,
  EP extends string,
  EI extends string,
  D extends TokenVisibility,
> = {
  readonly all: S["all"] | K;
  readonly public:
    | EP
    | Exclude<S["public"], EI>
    | ([D] extends ["public"] ? Exclude<K, EP | EI | S["all"]> : never);
  readonly internal:
    | EI
    | Exclude<S["internal"], EP>
    | ([D] extends ["internal"] ? Exclude<K, EP | EI | S["all"]> : never);
};
type ComposeLayers<
  S extends VisibilityState,
  Layers extends readonly unknown[],
> = Layers extends readonly [infer Head, ...infer Tail]
  ? ComposeLayers<
      Head extends TokenLayer<infer K, infer EP, infer EI, infer D> ? Compose<S, K, EP, EI, D> : S,
      Tail
    >
  : Layers extends readonly []
    ? S
    : { readonly all: string; readonly public: string; readonly internal: string };
type Empty = { readonly all: never; readonly public: never; readonly internal: never };
type LayerMemberKey<Layer> =
  Layer extends TokenLayer<infer K, string, string, TokenVisibility> ? K : never;
export type LayerKey<Layers extends readonly unknown[]> = LayerMemberKey<Layers[number]>;

type ModeTuple = readonly [string, ...string[]];
type LayerTuple = readonly TokenLayer<string, string, string, TokenVisibility>[];
type DefinitionKey = "value" | "visibility" | "description" | "deprecated" | "extensions";
type NoExtra<V, Allowed extends PropertyKey> = [Exclude<keyof V, Allowed>] extends [never]
  ? true
  : false;
type CheckInnerValue<Inner, Key extends string, Mode extends string> = Inner extends
  string | { readonly ref: unknown } | { readonly concat: unknown }
  ? true
  : NoExtra<Inner, Mode>;
// Valid<V> is V itself when V is a valid authoring entry and never otherwise.
type Valid<V, Key extends string, Mode extends string> = V extends string
  ? V
  : V extends { readonly ref: unknown } | { readonly concat: unknown }
    ? V extends TokenExpression<Key>
      ? NoExtra<V, "ref" | "concat"> extends true
        ? V
        : never
      : never
    : "value" extends keyof V
      ? V extends ExpandedToken<Key, Mode>
        ? NoExtra<V, DefinitionKey> extends true
          ? CheckInnerValue<V["value" & keyof V], Key, Mode> extends true
            ? V
            : never
          : never
        : never
      : V extends TokenModeValues<Mode, Key>
        ? NoExtra<V, Mode> extends true
          ? V
          : never
        : never;
interface DefineTokensOptions<
  Modes extends ModeTuple,
  Layers extends LayerTuple,
  D extends TokenVisibility,
> {
  readonly modes: Modes;
  readonly defaultMode: NoInfer<Modes[number]>;
  readonly layers?: Layers;
  readonly defaultVisibility?: D;
}
type ComposedPublic<T, Layers extends LayerTuple, D extends TokenVisibility> = Compose<
  ComposeLayers<Empty, Layers>,
  Extract<keyof T, string>,
  ExplicitKeys<T, "public">,
  ExplicitKeys<T, "internal">,
  D
>["public"];
// A dynamic key set (string) anywhere in the composition makes the public set unknown: keep it
// partial rather than claiming keys the runtime may filter out.
type PublicOf<T, Layers extends LayerTuple, D extends TokenVisibility> = string extends
  Extract<keyof T, string> | LayerKey<Layers>
  ? string
  : ComposedPublic<T, Layers, D>;
/** Error marker: this property is not part of a token definition. */
export interface UnknownTokenProperty<Name extends PropertyKey> {
  readonly unknownTokenProperty: Name;
}
/** Error marker: this mode is not declared by the graph. */
export interface UnknownMode<Name extends PropertyKey> {
  readonly unknownMode: Name;
}
type Forbid<V, Allowed extends PropertyKey, Marker extends "property" | "mode"> = {
  readonly [P in Exclude<keyof V, Allowed>]: Marker extends "property"
    ? UnknownTokenProperty<P>
    : UnknownMode<P>;
};
type ForbidInnerModes<Inner, Mode extends string> = Inner extends
  string | { readonly ref: unknown } | { readonly concat: unknown }
  ? unknown
  : Forbid<Inner, Mode, "mode">;
type ExpectedStrict<V, Key extends string, Mode extends string> = V extends
  string | { readonly ref: unknown } | { readonly concat: unknown }
  ? TokenExpression<Key>
  : "value" extends keyof V
    ? ExpandedToken<Key, Mode> &
        Forbid<V, DefinitionKey, "property"> & {
          readonly value: ForbidInnerModes<V["value" & keyof V], Mode>;
        }
    : TokenModeValues<Mode, Key> & Forbid<V, Mode, "mode">;
type CheckStrict<V, Key extends string, Mode extends string> =
  V extends Valid<V, Key, Mode> ? V : ExpectedStrict<V, Key, Mode>;
export declare function defineTokens<
  const T extends {
    readonly [K in keyof T]: CheckStrict<
      T[K],
      NoInfer<Extract<keyof T, string> | LayerKey<Layers>>,
      NoInfer<Modes[number]>
    >;
  },
  const Modes extends ModeTuple,
  const Layers extends LayerTuple = readonly [],
  const D extends TokenVisibility = "public",
>(
  tokens: T,
  options: DefineTokensOptions<Modes, Layers, D>,
): TokenGraph<Extract<keyof T, string> | LayerKey<Layers>, Modes[number], PublicOf<T, Layers, D>>;

export declare function defineTokenLayer<
  const T extends { readonly [K in keyof T]: CheckStrict<T[K], string, string> },
  const D extends TokenVisibility = "public",
>(input: {
  readonly id: string;
  readonly defaultVisibility?: D;
  readonly tokens: T;
}): TokenLayer<Extract<keyof T, string>, ExplicitKeys<T, "public">, ExplicitKeys<T, "internal">, D>;
```

`PublicOf` folds the layers and the graph's own tokens with the D3 rule over key unions and returns
`string` whenever any key set is dynamic.

Check time for the real production graph as literal TypeScript, and for a synthetic 2,000-token,
six-mode literal graph (three runs each):

| Input                  | TypeScript | Today's types       | Chosen typing       |
| ---------------------- | ---------- | ------------------- | ------------------- |
| Production, 386 tokens | 6.0.3      | 0.33–0.36 s, 158k i | 0.36–0.41 s, 175k i |
| Production, 386 tokens | 5.9.3      | 0.34–0.44 s, 158k i | 0.37–0.42 s, 175k i |
| Synthetic, 2,000       | 6.0.3      | 0.94–1.04 s, 854k i | 1.91–2.22 s, 901k i |
| Synthetic, 2,000       | 5.9.3      | 1.01–1.05 s, 854k i | 1.99–2.37 s, 901k i |

`i` is TypeScript's instantiation count. The reverse-mapped validator needed 0.60–0.66 s and
4.7–5.2 s for the same inputs on 6.0.3.

## Appendix B — runtime prototype

A standalone JavaScript prototype implemented D3, D5, D6, D7, and D8 and ran the acceptance
examples with the real `material3("#6750a4", { visibility: "internal" })` output.

Composition and provenance for the overridden role and its alias:

```json
{
  "md.sys.color.primary": {
    "visibility": "internal",
    "declarations": [
      { "origin": { "kind": "layer", "id": "material3" } },
      { "origin": { "kind": "graph" } }
    ],
    "expressionByMode": { "light": "#b3261e", "dark": "#f2b8b5" }
  },
  "primary": {
    "visibility": "public",
    "declarations": [{ "origin": { "kind": "graph" } }],
    "expressionByMode": {
      "light": { "ref": "md.sys.color.primary", "value": "#b3261e" },
      "dark": { "ref": "md.sys.color.primary", "value": "#f2b8b5" }
    }
  }
}
```

A collision under the single-hyphen default reports both keys and the variable:

```json
{
  "code": "duplicate-css-variable",
  "message": "Tokens \"a-b.c\" and \"a.b-c\" both map to the CSS variable --a-b-c.",
  "key": "a.b-c",
  "firstKey": "a-b.c",
  "property": "--a-b-c"
}
```

Probe A, DTCG-style border with an aliased color that a later layer overrides:

```text
eager flattening: 1px solid #cccccc
concat:           1px solid #0055ff
```

Probe B, v1 to v2 upgrade: 2,000 randomized v1 graphs were compiled with the released 0.3.0
compiler and, after the upgrade, with the prototype. The inputs contained 3,780 graph–layer
collisions, 2,630 layer–layer collisions, 1,335 multi-mode graphs, and 8,092 references. The upgrade
made 772 visibilities explicit. Values and visibility matched for every token of every graph.

## Appendix C — browser verification

The prototype's CSS for the Material example ran in the desktop app's browser with emulated light
and dark system preferences. Excerpt of the `var()` output:

```css
@layer tokens {
  :root,
  [data-theme="light"] {
    --action-primary: var(--palette-brand);
    --focus-glow: 0 0 12px #b3261e;
    --primary: #b3261e;
    --ring: var(--primary);
    --ring-shadow: 0 0 0 3px var(--primary);
    color-scheme: light;
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme]) {
      /* the dark declarations */
      color-scheme: dark;
    }
  }

  [data-theme="dark"] {
    /* the dark declarations */
    color-scheme: dark;
  }
}
```

Each run checked computed custom properties and `color-scheme` for: the page, a dark section, a
plain descendant and a light island inside it, each with the root unset, light, and dark; two
`:host` web components, one marked dark with a light inner island and one unmarked; an override
without and with a mode marker; an unlayered author override; and a runtime override on the root
and its effect on the dark section. Results: 26 of 26 for resolved output and 26 of 26 for `var()`
output, under both the light and the dark system preference.

The inheritance rule behind D8, measured in the same browser:

```css
.once {
  --brand: red;
  --alias: var(--brand);
}
.once [data-mode="dark"] {
  --brand: blue;
} /* alias computes to red */
.again {
  --brand: red;
  --alias: var(--brand);
}
.again [data-mode="dark"] {
  --brand: blue;
  --alias: var(--brand);
} /* alias computes to blue */
```

## References

- [ADR 0002: Pre-release Public API Reset](./0002-public-api-reset.md)
- [ADR 0004: Material 3 Adapter Design](./0004-material3-adapter-design.md)
- [ADR 0009: Core Contract Convergence](./0009-core-contract-convergence.md)
- [ADR 0010: Graph Tokens Compose Last](./0010-graph-tokens-compose-last.md)
- [ADR 0011: Visibility-Preserving Overrides](./0011-visibility-preserving-overrides.md)
- [ADR 0012: Single-Hyphen CSS Variable Names](./0012-single-hyphen-css-variable-names.md)
- [Audit 2026-09](../audit-2026-09.md)
- [Consumer evidence audit](../audit-2026-08-consumer-evidence.md)
