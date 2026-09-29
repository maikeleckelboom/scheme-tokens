# ADR 0013: Coherent Token Model

## Status

Accepted on 2026-09-29. This record designs the next breaking core release, proposed as `0.4.0`,
and is the authority for decisions D1–D13. Three of them were accepted earlier as separate decision
slices: [ADR 0010](./0010-graph-tokens-compose-last.md) (composition order),
[ADR 0011](./0011-visibility-preserving-overrides.md) (visibility), and
[ADR 0012](./0012-single-hyphen-css-variable-names.md) (CSS names). The other decisions are not
sliced further; a later change to one of them is a new record that supersedes that decision here.
[ADR 0014](./0014-material3-layer-and-mode-mapping.md) applies D12 to the Material 3 adapter and
remains proposed.

A closing pass settled the five contracts that were still open (layer mode compatibility and the
Material mode mapping, custom-condition precedence, conflicting class markers, the TypeScript
floor, and source-format retention). A product decision then replaced the measured TypeScript 5.4
floor with support for the current stable major (D13). The acceptance pass fixed the TypeScript
range notation, specified intra-layer mode disagreement, chose the schema identity, removed the
resolved value that pure references duplicated in compiled expressions, and restated retention
and the resolved-value limit normatively. Its evidence is in the appendices.

Browser coverage beyond Chromium, the emitted declarations, the TypeScript upgrade, and the v1
upgrade implementation are implementation and release gates, not open design questions (see
[Implementation and release gates](#implementation-and-release-gates)).

### Supersession

This record supersedes these parts of [ADR 0009](./0009-core-contract-convergence.md), in addition
to the composition order and metadata rule that ADRs 0010 and 0011 supersede:

- "`defineTokens()` remains the simple trusted authoring path", by D2;
- "A standalone layer remains `TokenLayer<Key, string>`" and "Explicit standalone layer mode maps
  remain unbound until composition", by D12. Direct layer expressions still apply to every graph
  mode;
- the rejection of an `unwrap()` helper, by D9. `formatIssues()`, severities, and inspection APIs
  stay rejected;
- "Runtime-filtered public selection ... remain[s] conservatively partial", by D4 for graphs with a
  finite public key union;
- the CSS options correction, by D7, which replaces `scope` and the selector strategies;
- "The packaged schemas retain their existing `$id` values", by D10 for format version 2. Released
  v1 schemas keep their identifiers.

ADR 0009's rejection of partial layers, partial persisted mode maps, metadata merging, and
mode-bound layer helpers stands.

## Context

The [2026-09 audit](../audit-2026-09.md) found problems in composition precedence, override
visibility, authoring entry points, static typing, CSS naming, and CSS option shape. They are one
contract, not independent fixes: the composition order decides what an override means, the
override rule decides visibility, visibility decides the public key set, the key set decides the
types, and the types and modes decide what CSS export can promise. Designing them one at a time
would lock in a weaker type or authoring model.

Consumer evidence gathered for this design, beyond the audits:

- The production consumer composes a real `material3` layer into a 386-token graph with six
  application-owned modes (338 graph tokens, 48 layer tokens, 26 public roles), compiles with exact
  keys and with `all`, and exports CSS with custom `variableName` and exact root-anchored
  selectors. Its real stylesheet is rendered by its own code outside `exportCssVars()`, because
  the exporter cannot express a system-preference fallback, per-mode `color-scheme`, or `var()`
  wiring. It tracks "why is this role this value?" itself, and it asserts by hand that the Material
  fragment's modes match its graph's.
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
defineTokenGraph · defineTokenLayer             parseTokenGraph · parseTokenLayer
tokenRef · tokenConcat                          (v2, and every earlier source version
                \                               through deterministic upgrades)
                 \                             /
                  canonical graph, formatVersion 2 ── one validator
                  (a layer's mode maps agree; its mode set is empty or the graph's)
                                  |
         composition: layers in array order, then the graph's own tokens
         visibility: latest explicit visibility, else the introducing default
                                  |
         resolution per mode: a DAG over ref and concat, with cycle detection
         and a resolved-value limit checked before allocation
                                  |
         selection: public (default) | all | { keys }
                                  |
          compiled scheme: resolved values, provenance, retained expressions
                   /                                    \
   exportCssVars: complete blocks,                  serializeCompiledScheme
   zero-specificity conditions in tier order
   (base < system < explicit < custom),
   resolved or var()-linked values
```

## Decisions

### D1. Vocabulary

A user authors tokens, references, modes, and visibility. Layers and provenance are the next step.
Compiler vocabulary stays out of the first example.

| Term            | Meaning                                                                | Change                       |
| --------------- | ---------------------------------------------------------------------- | ---------------------------- |
| token           | a dot-path key with one value per mode                                 | unchanged                    |
| reference       | an explicit `{ ref }` record, authored with `tokenRef()`               | unchanged                    |
| expression      | a literal string, a reference, or a `concat` of both                   | adds `concat`                |
| mode            | one value dimension; the graph owns the ordered list and the default   | order is preserved           |
| layer           | an ordered, reusable set of declarations; it has a mode set, not modes | composes before graph tokens |
| mode set        | the modes a layer's mode maps name; empty when it has none             | new (D12)                    |
| graph           | modes, ordered layers, and the graph's own tokens                      | own tokens compose last      |
| visibility      | `public` or `internal`; decides the default compiled and CSS output    | overrides preserve it        |
| compiled scheme | resolved values per mode, provenance, and retained expressions         | provenance reshaped          |
| block           | one CSS rule (optionally in `@media`) holding one mode's declarations  | tiers replace `strategy`     |

Token layers follow the precedence intuition of CSS cascade layers: later layers win over earlier
ones, and the graph's own tokens, like unlayered styles, win over every layer. The analogy covers
precedence only. A later declaration replaces the earlier one for its key as a whole, except for
visibility (D3); there is no specificity, no `!important` inversion, and no per-property cascade.
The word "layer" is kept, and the CSS option for an actual cascade layer is named `cascadeLayer`.

"Fragment" leaves the vocabulary: `material3()` returns a layer
([ADR 0014](./0014-material3-layer-and-mode-mapping.md)). `scope` becomes `root`, which avoids
confusion with CSS `@scope` and names the element that carries the default mode. Discriminating
`strategy` objects disappear. "Scheme" stays as the name of the compiled output and the package.

### D2. Authoring: one graph helper, one layer helper

There are two distinct authoring tasks, composing a complete graph and defining a reusable set of
declarations. Each gets one helper that takes one object.

- `defineTokenGraph({ modes?, defaultMode?, defaultVisibility?, layers?, tokens })` is the only
  graph helper. `defineTokens` is removed completely, with no deprecated alias and no wrapper:
  `defineTokens(tokens)` and `defineTokenGraph({ tokens })` were equivalent forms
  ([audit](../audit-2026-09.md) finding 1.6, contrary to ADR 0002).
- `defineTokenLayer({ id, defaultVisibility?, tokens })` defines reusable declarations. A layer
  never declares modes or a default mode; its mode set is derived from its mode maps (D12).
- `tokenRef(key)` and the new `tokenConcat` (D5) author expressions. The canonical `{ ref }` and
  `{ concat }` records are accepted directly, as `{ ref }` is today.

The two concepts stay distinct. A token graph owns the envelope: its modes, their order, the
default mode, the ordered layers, and the application's own tokens. A token layer is a reusable
set of declarations that takes part in a graph's composition and never owns an envelope. Each
operation names the artifact it acts on:

| Artifact | Define             | Parse             | Compile             | Serialize             |
| -------- | ------------------ | ----------------- | ------------------- | --------------------- |
| graph    | `defineTokenGraph` | `parseTokenGraph` | `compileTokenGraph` | `serializeTokenGraph` |
| layer    | `defineTokenLayer` | `parseTokenLayer` | —                   | `serializeTokenLayer` |

The root runtime exports of the release are therefore exactly `defineTokenGraph`,
`defineTokenLayer`, `tokenRef`, `tokenConcat`, `parseTokenGraph`, `parseTokenLayer`,
`parseCompiledScheme`, `compileTokenGraph`, `exportCssVars`, `serializeTokenGraph`,
`serializeTokenLayer`, `serializeCompiledScheme`, and `orThrow` (D9).

The single object puts the envelope and the layers before the tokens, in composition order and in
v2 wire order. A single-mode graph becomes a multi-mode graph by adding `modes` and `defaultMode`,
not by switching helpers, and one helper is one typing surface to test across TypeScript versions
(D13). The cost is the `tokens:` wrapper in the first example.

- Omitted `modes` means the single mode `base`. `modes` requires an explicit `defaultMode`, which
  need not be the first mode. Modes keep their authored order.
- Authored mode order is data: it orders compiled modes, and within one CSS tier it orders
  conditions (D7). The default mode is independent of it.
- Reserved mode names become `ref`, `concat`, `value`, `visibility`, `description`, `deprecated`,
  and `extensions`. `valueByMode` is dropped: the lower-kebab mode pattern already excludes it.
- `$schema` leaves the authoring helpers; it is a JSON editor hint (D10).

```ts
const tokens = defineTokenGraph({
  tokens: {
    "brand.600": { value: "oklch(62% 0.18 250)", visibility: "internal" },
    "action.primary": tokenRef("brand.600"),
    surface: "#ffffff",
  },
});

const theme = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material3("#6750a4", { visibility: "internal" })],
  tokens: {
    "md.sys.color.primary": { light: "#b3261e", dark: "#f2b8b5" }, // stays internal
    primary: tokenRef("md.sys.color.primary"),
    "ring-shadow": tokenConcat`0 0 0 3px ${tokenRef("primary")}`,
    "color-scheme": { light: "light", dark: "dark" },
  },
});
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

`defineTokenGraph` infers the literal token record. Its result type carries the key union, the mode
union, and the public key union after composition:

```ts
TokenGraph<Key, Mode, PublicKey>;
TokenLayer<Key, Mode, Visibility>; // Mode is the layer's mode set (D12)
```

`compileTokenGraph(graph)` with the default public selection then returns a complete record
whenever the public key union is finite. `all` and exact literal keys keep their current typing.
Graphs whose keys are dynamic, for example built with `Object.fromEntries`, keep the conservative
partial record; a dynamic key set anywhere in the composition makes the public union `string`.

The mechanism is a plain `const` type parameter for the token record, validated by an F-bounded
constraint, plus one type parameter each for the modes tuple, the layer tuple, and the default
visibility. Every invalid entry maps to the specific expected shape, so the diagnostic lands on the
offending property. Excess properties map to named markers, such as
`UnknownTokenProperty<"descripton">` and `UnknownMode<"dim">`, and an incompatible layer maps to
`LayerModeMismatch<LayerModes, GraphModes>` (D12). Layers carry their explicit public and internal
key unions and their mode set as phantom type information, so the type-level composition mirrors
D3. Four candidate signatures were measured (Appendix A):

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

The closing pass re-ran the chosen typing in the single-object form, with layer mode sets, on every
TypeScript version from 5.4.5 to 7.1-dev: all ten error cases, eight mode-compatibility and envelope
cases, and every positive inference assertion hold on every version (Appendix A). Only
TypeScript 7 is supported (D13). Measured cost:

- the real production graph written as literal TypeScript (first pass): 0.36–0.42 s against
  0.33–0.44 s for today's types on 5.9.3 and 6.0.3;
- a production-shaped literal graph with the same token counts and six modes (closing pass):
  0.34–0.44 s on 5.4–6.0, the same as today's types, and 0.07–0.10 s on 7.0;
- a 2,000-token literal graph: about twice today's check time on 5.4–6.0 (2.0–2.4 s against
  1.1–1.6 s) and the same as today's on 7.0 (about 0.5 s).

Mixing a dynamic spread with literal tokens that reference dynamic keys fails type checking today
and continues to fail; it is a TypeScript limitation of index-signature spreads, not a regression.

### D5. Expressions: a minimal `concat`

```text
TokenExpression = string | { ref: Key } | { concat: [part, ...part[]] }
part            = string | { ref: Key }
```

- `concat` joins literal parts and resolved references in order. Its result is still an opaque
  string: the compiler never parses, evaluates, or interprets it, and bare strings are never
  scanned for references.
- Its dependencies are all referenced keys. Resolution becomes a per-mode DAG walk that stays
  iterative and bounded. A key becomes "in progress" when its expansion starts, not when it is
  pushed, so a `concat` that references the same key twice, or siblings resolved in either order,
  are not cycles.
- Unknown references and cycles through `concat` report the existing `unknown-reference` and
  `reference-cycle` codes with pointers to the part, once, at their source. Tokens that depend on a
  failed value are not reported again.
- Canonical form: at least one part, adjacent literal parts merged, empty literal parts dropped. A
  `concat` without references normalizes to its string.
- `tokenConcat` is a tagged template for authoring:
  `` tokenConcat`0 0 0 3px ${tokenRef("primary")}` ``. It mirrors the `concat` record as `tokenRef`
  mirrors `ref`. Adapters write the canonical record.
- Nested `concat`, conditionals, fallbacks, and arithmetic are excluded. `calc()` and
  `color-mix()` stay CSS text that `concat` can carry.

**Resolved-value limit.** The resolver enforces one bound on the values it builds:

```text
MAX_RESOLVED_VALUE_LENGTH = 65_536 UTF-16 code units
```

- The unit is the UTF-16 code unit, the unit of JavaScript `string.length`. It is not a count of
  code points, grapheme clusters, or bytes.
- The limit applies to each resolved `concat` value, per token and mode. A value whose length would
  exceed it fails with the new code `resolved-value-too-long`, with `key`, `mode`, and the path of
  the expression, and the value is not built.
- The check is incremental and happens before allocation. Dependencies resolve and are memoized per
  key and mode before their dependants, so the length of every part is known when a `concat` is
  resolved. The resolver adds the part lengths in order and fails as soon as the running total
  exceeds the limit, before it joins any string. Building a value and measuring it afterwards does
  not conform. Because every accepted `concat` value is within the limit, so is every string the
  resolver ever builds.
- The limit does not apply to authored input. Literal values, and references that resolve to them,
  allocate nothing new and stay bounded by the input size. A `concat` without references
  normalizes to a literal (canonical form above).
- A failed value is reported once, at its source. Tokens that depend on it are not reported again.
- There is no graph-wide budget. What remains is fan-out, where many tokens reference one large
  value and serialized or CSS output repeats it. Plain references to a large literal already do
  that today, and the limit keeps `concat` in the same class. A graph-wide budget needs its own
  demonstrated case.
- `MAX_RESOLVED_VALUE_LENGTH` names the constant in this record and in the implementation; it is
  not a root export. The number is the contract: raising it later is compatible, lowering it is
  breaking.

In the prototype, 65 tokens that each concatenate the previous token twice (an unbounded size of
8·2⁶⁴ code units) fail at the fifteenth token in 0.5 ms, and the longest string ever built is
65,536 code units (Appendix B).

The structure earns its place in core for three reasons:

- Overrides propagate into composites. Probe A in Appendix B imports a DTCG-style border whose
  color is an alias, then overrides the color in a later layer. With eager flattening the border
  keeps the old color (`1px solid #cccccc`); with `concat` it follows (`1px solid #0055ff`). A
  future DTCG adapter that flattens composites would silently break layered overrides.
- `var()` output can link composites to their targets (D8).
- Retained expressions can report the dependencies of a composite value (D6).

Adding `concat` later would force another wire-format version, so it belongs in the same format
revision as D3.

### D6. Compiled scheme: resolved values, provenance, and retained expressions

Three concepts stay separate:

| Concept             | Answers                                  | Field                       |
| ------------------- | ---------------------------------------- | --------------------------- |
| resolved value      | what the token is in a mode              | `tokens[key][mode]`         |
| provenance          | which declarations composed it, in order | `metadata.declarations`     |
| retained expression | how the winning declaration derives it   | `metadata.expressionByMode` |

```ts
interface CompiledTokenMetadata<Mode extends string> {
  readonly visibility: TokenVisibility;
  // Provenance: the composition path; the last entry is the winning declaration.
  readonly declarations: readonly [TokenDeclarationRecord, ...TokenDeclarationRecord[]];
  // Retained expressions, only for modes whose winning expression is a reference or a concat.
  // A mode without an entry was a literal, equal to its resolved value.
  readonly expressionByMode?: { readonly [M in Mode]?: CompiledExpression };
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: Readonly<Record<string, JsonValue>>;
}
interface TokenDeclarationRecord {
  readonly origin: { readonly kind: "graph" } | { readonly kind: "layer"; readonly id: string };
  readonly visibility?: TokenVisibility; // present only when that declaration set it explicitly
}
// A pure reference: its target's resolved value is the token's own, tokens[key][mode].
type CompiledReference = { readonly ref: string };
// A reference inside a concat carries its target's resolved value, which the result cannot supply.
type CompiledConcatPart = string | { readonly ref: string; readonly value: string };
type CompiledExpression =
  CompiledReference | { readonly concat: readonly [CompiledConcatPart, ...CompiledConcatPart[]] };
```

Retained expressions are sparse and store nothing twice:

- A literal has no record. Its expression is its resolved value.
- A pure reference records only its target. The target's resolved value equals the token's own
  resolved value, so repeating it would store the same string twice.
- A `concat` records its parts in order, and each reference part carries its target's resolved
  value. The result alone cannot be split back into parts, and an exporter needs each part to emit
  it as `var()` or to inline it when its target is not emitted (D8). A reference part's value is
  output data, not provenance.

In the production graph, 1,878 of 2,316 expressions (386 keys in six modes) are literal and 438 are
pure references. Resolved values take 88,856 bytes of JSON (9,148 gzipped). Retaining every
expression would add 110,108 bytes (11,362 gzipped); retaining references with their resolved
value, as the closing pass drafted, 37,270 bytes (3,960 gzipped); the final shape, 25,974 bytes
(2,327 gzipped) (Appendix B, probe D).

`origin` and `dependenciesByMode` are removed: both are derivable from `declarations` and
`expressionByMode`. For the Material override in D2, the compiled record of `md.sys.color.primary`
reads "declared by `material3`, replaced by the graph, internal because nothing restated it", and
has no retained expression because the override is literal. The record of `primary` reads "a
reference to `md.sys.color.primary`", and its resolved value `#b3261e` in light is
`tokens.primary.light`. Walking a chain through tokens outside the selection uses
`selection: "all"`. An explain helper can be added later without a format change.

### D7. CSS export: one activation model

CSS export emits blocks. A block holds one mode's token declarations under one condition. A mode
can activate through four tiers of condition:

| Tier     | Condition                                         | Default                                                  |
| -------- | ------------------------------------------------- | -------------------------------------------------------- |
| base     | the default mode at `root`                        | `:root`                                                  |
| system   | a media query selects a mode at `root`            | none: core does not know which mode is dark              |
| explicit | an attribute marker selects a mode on any element | `[data-theme="<mode>"]` when there is more than one mode |
| custom   | author selectors, optionally inside a media query | none                                                     |

```ts
exportCssVars(scheme, {
  prefix: "app",
  root: ":root", // or ":host" for a shadow root
  attribute: "data-theme", // or false: no generated explicit markers
  system: { dark: "(prefers-color-scheme: dark)" },
  selectors: { dark: ".dark" }, // custom conditions; a list of { selector, media? } per mode too
  references: "var",
  cascadeLayer: "tokens",
});
```

**Precedence comes from the exporter, not from selector specificity.** Every generated activation
selector, custom ones included, is wrapped in `:where()` and has zero specificity. Blocks are
emitted in tier order, base, system, explicit, custom; within a tier, in the graph's authored mode
order; within one mode, in the order of its conditions. When several conditions match the same
element, the later one wins.

```css
:where(:root) {
  /* light */
}
@media (prefers-color-scheme: dark) {
  :where(:root) {
    /* dark */
  }
}
:where([data-theme="light"]) {
  /* light */
}
:where([data-theme="dark"]) {
  /* dark */
}
```

- The system block carries no `:not([data-theme])` guard. Tier order already ranks every explicit
  marker above it, and the guard treated any attribute value as an explicit choice: with
  `data-theme="system"` it disabled the system preference, which the browser verification shows.
  The base block and the default mode's explicit marker are therefore separate blocks, because an
  explicit marker must follow the system block.
- Explicit markers are unanchored, so any element can switch modes and nested sections work by
  default. The default mode also gets its marker, so a light island inside a dark section works.
- With `root: ":host"`, the base block is `:where(:host)`, explicit markers are generated for the
  host and for elements inside the shadow tree
  (`:where(:host([data-theme="dark"]), [data-theme="dark"])`), and the system block applies to the
  host.
- Every block declares every selected token. A later matching block must replace every declaration
  of an earlier one, and `var()` output needs it too (D8). For the production consumer's 26 public
  roles in its nine two-axis blocks, that is 10.4 KB of CSS, 1.2 KB gzipped (Appendix B).
- Custom conditions that can match the same element resolve by authored mode order, then condition
  order. The production two-axis shape therefore lists its modes from general to specific, as it
  already does. The option documentation states the rule and shows `:not()` for conditions that
  must stay disjoint.

**Application CSS.** Application rules follow the normal cascade, and the exporter promises nothing
beyond it. Origin and importance, inline styles, and cascade layers are compared before
specificity. Within the same origin, importance, and cascade layer, generated activation selectors
have zero specificity, so an application rule for the same element with any non-zero specificity
overrides a generated declaration, whether its stylesheet comes before or after the tokens, and an
application rule with zero specificity, such as `:where(…)` or `*`, competes by source order.

**`cascadeLayer`.** The option wraps the output in `@layer <name>`. Unlayered normal declarations
then win over the tokens regardless of specificity and order. Normal declarations in layers ordered
after it win, and those in layers ordered before it lose, regardless of specificity. In the same
layer, specificity and then order decide, and the generated selectors have none. `!important`
reverses layer order, so an important declaration in an earlier layer wins; the exporter never
emits `!important`, because declaration-unsafe values are rejected.

**Explicit activation is single-valued.** The explicit tier supports attribute markers only, and an
attribute has one value, so at most one explicit condition matches an element. `classPrefix` is
removed. Class activation is a custom condition per mode, such as `.light` and `.dark` in
`selectors`, which is unanchored and nests like the attribute. An element that carries two mode
classes is an invalid state owned by the application. The exporter generates no exclusion
selectors for it; the general precedence rule makes the outcome deterministic (the later mode
wins), and the documentation says that this outcome is not a supported way to express intent.
Generated exclusions such as `.theme-dark:not(.theme-light)` were rejected: they hide the invalid
state behind inheritance and grow with the square of the mode count.

**No generic declarations.** The `properties` option is dropped; the exporter emits custom
properties only. A mode-level value such as `color-scheme` is a token, and application CSS binds
it. Because `color-scheme` inherits as a computed value, binding it on `:root` alone leaves a
nested dark section light; the binding must be applied wherever a mode can activate:

```css
:root,
[data-theme] {
  color-scheme: var(--color-scheme);
}
```

A universal binding, `:where(*) { color-scheme: var(--color-scheme); }`, also works for custom
conditions. Both were verified in a browser (Appendix C).

Also:

- Names follow [ADR 0012](./0012-single-hyphen-css-variable-names.md).
- The bounded grammar for author selectors gains `:where()`, `:is()`, `:not()`, `:host`, and
  `:host()`, whose arguments reuse the same grammar. Media conditions use a bounded grammar of media
  types, `not`/`only`, `and`/`or`, and parenthesized features.
- `false` and omission differ: `attribute: false` disables generated markers, while omitting
  `attribute` selects the conventional default.
- Every failure is collected, not only the first.
- The result keeps `css`, `blocks`, and `variableByToken`. A block reports its `tier`, `mode`,
  `selectors`, optional `media`, and `declarations`.

### D8. `var()` references as an output semantic

`references: "var"` emits references as `var()` instead of resolved values. Resolved output stays
the default.

- A reference is emitted as `var(--target)` only when its direct target is emitted by the same
  export; otherwise the target's resolved value for that mode is inlined. For a pure reference
  that value is the token's own resolved value; for a `concat` part it is the part's resolved value
  (D6). `concat` parts follow the rule individually. A token that references an internal source
  therefore keeps a literal value, while an alias of another public token stays linked.
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
- A layer's mode set is derived from its mode maps and never persisted (D12). A v2 layer whose mode
  maps disagree is invalid. A v1 layer with that defect could never compose into any graph, and the
  upgrade reports it with `layer-mode-mismatch` instead of repairing it.
- Writers emit only the current version.

**Three identities, three jobs.**

| Identity                                  | Job                   | Form                              |
| ----------------------------------------- | --------------------- | --------------------------------- |
| `kind` and `formatVersion` in an artifact | runtime compatibility | fields read by every parser       |
| `$id` of a published schema               | durable schema name   | a URN, independent of hosting     |
| `$schema` in an artifact, optional        | editor and tool hint  | a resolvable, versioned HTTPS URL |

_Runtime compatibility._ `kind` and `formatVersion` alone decide whether and how a parser accepts an
artifact. `$schema` is optional in every artifact. Parsers accept any string there and never
interpret it: not to choose a format, not to validate, and not to fetch anything. A missing,
stale, or foreign `$schema` never changes how an artifact parses. Parsers preserve the value
verbatim, and serializers never add one. The v1 → v2 upgrade drops `$schema`, because in v1 it
could only name the v1 schema.

_Schema identity._ Each published schema has one `$id` per artifact kind and format version,
`urn:scheme-tokens:schema:<name>:v<formatVersion>`, where `<name>` is the artifact kind without its
`scheme-tokens/` prefix:

```text
urn:scheme-tokens:schema:token-graph:v2
urn:scheme-tokens:schema:token-layer:v2
urn:scheme-tokens:schema:compiled-scheme:v2
```

An id never changes for a released format version, whatever the package version, and a new format
version gets a new id. The released v1 schemas keep their `https://scheme-tokens.dev/schemas/…`
ids; identifiers are not rewritten after the fact. Nothing requires the project to own or host
`scheme-tokens.dev`.

The acceptance pass checked the spelling. Each id matches RFC 8141 `assigned-name` (NID
`scheme-tokens`, NSS `schema:<name>:v2`) and is an absolute URI without a fragment, which is what
JSON Schema 2020-12 requires of `$id`. Ajv 8.20 compiles a 2020-12 schema under each id in strict
mode, validates instances against it, and registers it under the URN. A relative cross-file `$ref`
cannot resolve against a URN base (Ajv fails with "URN without nid cannot be serialized"), which is
why the schemas are self-contained: every `$ref` is a fragment such as `#/$defs/mode`. The
`scheme-tokens` NID is not registered with IANA. JSON Schema needs a unique absolute URI, not a
registered one, and the id is never dereferenced; the conformant alternatives cost more, because a
`tag:` URI needs an authority the project controls (a domain it does not own, or a personal e-mail
address inside every schema) and a `urn:uuid:` id says nothing about what it names. The segment is
`v2` rather than `2`, the draft spelling, so that it reads as a version and matches the schema file
names.

_Instance discovery._ Editors resolve `$schema` over HTTPS. The documented form points at the
published package's own files on a versioned package CDN:

```text
https://cdn.jsdelivr.net/npm/scheme-tokens@<package-version>/schemas/<name>.v<formatVersion>.schema.json
https://cdn.jsdelivr.net/npm/scheme-tokens@0.4.0/schemas/token-graph.v2.schema.json
```

- The URL names an exact package version, so it keeps resolving to the bytes that version
  published. Ranges such as `@0.4` also resolve on jsDelivr, but to different bytes over time, and
  the documentation does not use them.
- The schema file name carries the format version, so the path says which format an artifact
  claims to follow, but parsers still read only `kind` and `formatVersion`.
- The package exports the same files as `scheme-tokens/schemas/<name>.v<formatVersion>.schema.json`,
  so a local path such as `./node_modules/scheme-tokens/schemas/token-graph.v2.schema.json` works
  as well, and any equivalent versioned package CDN serves identical bytes.
- The package ships the schemas of the current format version. An earlier version's schemas stay
  reachable at the package versions that published them.

**Source formats are retained while they upgrade losslessly.** This is a contract, not an
implementation detail. Token graphs and token layers are durable authored input and may be
persisted for years.

- A reader accepts every source format version the package has released for which a deterministic,
  lossless upgrade to the current version remains practical.
- Each format change ships exactly one pure upgrade step, from version N to N+1. Readers compose
  the steps in order, v1 → v2 → v3 → …, and each step's output is validated by the next version's
  grammar, so no step skips a version. Issues always point into the original input.
- Each step has an equivalence gate: compiling the old artifact under its own semantics and the
  upgraded artifact under the current semantics yields identical values and visibility, on frozen
  fixtures and a randomized corpus. For v1 → v2 that is the 2,000-graph corpus of Appendix B.
- Earlier grammars are implemented as deltas over the current validator, not as frozen copies of
  the parser, so retaining a version costs its delta and its step.
- A source format is never removed because it is old. Removing one requires all three of: a major
  release (before 1.0, a breaking minor release), a decision record, and a concrete reason why
  keeping a lossless step is no longer practical. The release notes then name the last package
  version that reads it, and users migrate by parsing and serializing with that version.
- From 1.0 on, source format versions change only in major releases.

Retaining only "the current and the previous version" was rejected: it strands anyone who skips a
major and, without a CLI, makes them install an old package version to migrate. A fixed window of
more versions is just as arbitrary. Source-format changes are expected to be rare after 1.0, so the
number of retained deltas stays small.

**Compiled schemes are derived and not migrated.** A compiled scheme is rebuilt from its source
graph at any time, so it carries no retention promise. Readers accept only the current compiled
format version. Any other version fails with `invalid-format-version`, whose message tells the
consumer to recompile from the source graph.

This replaces the AGENTS.md rule against old-format readers for persisted source artifacts; the
rule keeps applying to compiled artifacts and to every other kind of compatibility shim.

### D11. One semantic authority

Trusted authoring and untrusted parsing keep separate entry paths, but no rule exists twice:

1. Authoring normalization turns shorthand into canonical declarations.
2. One validator checks a canonical graph or layer, including every layer's mode set, and returns
   issues with pointers. Parsers return them as `Result`; helpers throw them (D9).
3. One composer applies D3.
4. One resolver walks the expression DAG and enforces the resolved-value limit (D5).
5. Selection, projection, and the exporters work only on composed, resolved data.

The three parallel validators and four layer parsers that exist today collapse into this pipeline.

### D12. Layer mode sets

A graph owns its mode set, its mode order, and its default mode. Layers take part in the graph's
modes; they are not a second mode authority. A layer never declares, introduces, or orders modes.
What it has is a requirement, derived from its own declarations:

1. A layer's mode set, its effective mode requirement, is the set of modes that its mode maps name,
   whether authored directly or under `value`. Direct expressions (a literal, a reference, or a
   `concat`) contribute nothing. A layer without mode maps has the empty mode set and fits every
   graph. The keys of a layer's mode maps follow the mode-name rules of D2, so a mode set only ever
   contains valid mode names.
2. All mode maps in one layer name the same set. A layer whose maps disagree is invalid on its own,
   before it is composed into any graph.
3. A layer with a non-empty mode set fits a graph only when the set equals the graph's mode set.
   Equality, not inclusion: mode maps are total, so a missing mode would leave a token without a
   value, and a partial layer or a fallback would contradict ADR 0009.
4. The graph owns order. A layer has a set, so `["dark", "light"]` accepts a `light`/`dark` layer.
5. The graph's own tokens are checked one by one against the graph's modes, with
   `missing-mode-value` and `unknown-mode-value` as today. A layer is checked as a whole.

This layer requires `light | dark`. The invariant literal adds no requirement:

```ts
defineTokenLayer({
  id: "example",
  tokens: {
    "spacing.sm": "0.5rem",
    "surface.canvas": { light: "#fff", dark: "#000" },
    "surface.raised": { light: "#fafafa", dark: "#111" },
  },
});
```

This layer is invalid, because its declarations disagree about the modes it requires:

```ts
defineTokenLayer({
  id: "invalid",
  tokens: {
    a: { light: "#fff", dark: "#000" },
    b: { light: "#fff", dim: "#333", dark: "#000" },
  },
});
```

**Static rejection, for literal input.** `defineTokenLayer` derives the mode set as the union of the
modes its maps name and requires every map to name all of them. The map that lacks a mode fails on
its own token. For the invalid layer, on TypeScript 7.0.2 (type arguments abbreviated):

```text
error TS2322: Type '{ light: string; dark: string; }' is not assignable to type 'TokenModeValues<LayerModesOf<…>, string> & Forbid<...>'.
  Property 'dim' is missing in type '{ light: string; dark: string; }' but required in type 'TokenModeValues<LayerModesOf<…>, string>'.
```

`defineTokenGraph` checks each layer whose mode set is finite against a finite graph mode set and
maps a mismatch to `LayerModeMismatch<LayerModes, GraphModes>`, which names both sets (Appendix A;
[ADR 0014](./0014-material3-layer-and-mode-mapping.md) shows the message). Diagnostic wording is not
contractual; rejection is.

**Runtime validation, for dynamic and untrusted input.** Parsed layers, layers built from dynamic
keys, and generic generators have a mode set that TypeScript does not know (`string`), and a graph
built from a dynamic mode tuple has one too. For them, and for every input, the helpers and parsers
check the same rules at runtime and report one `layer-mode-mismatch` per layer, not one issue per
token:

- `layerId` names the layer, `modes` the set it must match, and `layerModes` the set it has.
- A layer whose maps disagree is reported by `defineTokenLayer`, `parseTokenLayer`, and every graph
  helper and parser that contains it. The first mode map in code-unit key order is the reference.
  The first later map, in the same order, that names a different set is reported: `path` and `key`
  point at it, `firstPath` at the reference map, and `modes` and `layerModes` list the two sets in
  code-unit order. Such a layer is not compared with the graph.
- A consistent layer whose set differs from the graph's is reported by `defineTokenGraph` and
  `parseTokenGraph` at `/layers/<index>`, with `modes` in the graph's authored order and
  `layerModes` in code-unit order.
- The per-token `missing-mode-value` and `unknown-mode-value` issues that either case implies are
  not reported for that layer.
- Trusted helpers throw these issues (D9); their pointers point into the authored input, so the
  helper reports `/tokens/b` where the parser reports `/tokens/b/value`.

`parseTokenLayer` reports the invalid layer above as:

```json
{
  "code": "layer-mode-mismatch",
  "message": "Layer \"invalid\" has mode maps that disagree: \"a\" names dark, light; \"b\" names dark, dim, light.",
  "path": "/tokens/b/value",
  "layerId": "invalid",
  "key": "b",
  "firstPath": "/tokens/a/value",
  "modes": ["dark", "light"],
  "layerModes": ["dark", "dim", "light"]
}
```

One code covers both cases because both violate one rule: a layer's mode maps must name exactly one
set, and that set must be the graph's. The default `material3()` layer in the production consumer's
six-mode graph reports:

```json
{
  "code": "layer-mode-mismatch",
  "message": "Layer \"material3\" has modes dark, light; the graph declares mono-light, mono-dark, vivid-light, vivid-dark, material3-light, material3-dark.",
  "path": "/layers/0",
  "layerId": "material3",
  "modes": [
    "mono-light",
    "mono-dark",
    "vivid-light",
    "vivid-dark",
    "material3-light",
    "material3-dark"
  ],
  "layerModes": ["dark", "light"]
}
```

At the type level, `TokenLayer<Key, Mode, Visibility>` carries the mode set: `never` for a layer
without mode maps, a literal union for a literal layer, and `string` when it is unknown, as for a
parsed layer. When either the layer's or the graph's set is `string`, only the runtime check
applies.

The wire format has no mode-set field: the mode set is derived, never persisted, and parsers check
it.

Generators receive the mapping from graph modes to their own coordinates as input and produce a
layer keyed by graph modes, as `material3()` does
([ADR 0014](./0014-material3-layer-and-mode-mapping.md)). Several generated layers therefore
coexist in one graph whatever their source concepts are, because each is keyed by the graph's
modes. A generator that derives its mode set from keyed input must reject empty input, at the type
level too: an empty set would type the layer as fitting every graph. A static layer written for
other modes, for example a published `light`/`dark` palette in a six-mode graph, must be remapped
before composition. A remapping helper would be additive, since its output is an ordinary layer;
core does not map modes during composition.

### D13. TypeScript support

`scheme-tokens` targets a modern TypeScript toolchain. It supports the current stable TypeScript
major, not every older compiler generation on which its declarations happen to work.

For the breaking release, TypeScript 7 is the current stable major (7.0.2 when this was decided):

```text
Supported TypeScript major: 7.x (>= 7.0 < 8.0)
Repository TypeScript:      the latest stable 7.x release
Blocking CI:                the oldest supported 7.x release (7.0) and the repository version
Non-blocking signal:        typescript@next
```

- The contract names one major. Where a range is useful it is written bounded, `>= 7.0 < 8.0`. An
  open range such as `>= 7.0` would include TypeScript 8 and every later major, which this policy
  does not promise.
- The oldest supported 7.x release is 7.0. The compatibility suite runs it, at its latest patch, as
  the blocking floor, next to the repository's latest stable 7.x release.
- `typescript@next` runs the same suite as a compatibility signal. Its failures block nothing. A
  new major enters the supported contract only by an explicit decision.
- Moving the supported baseline from 7.x to 8.x is an explicit breaking compatibility decision:
  before 1.0 it needs a changeset in a breaking minor release, and from 1.0 on a major release.
  Raising the floor inside 7.x narrows the range in the same way and follows the same rule.
- TypeScript 5.x and 6.x are not part of the supported contract and are not tested in CI.
- The blocking suite is the Appendix A case matrix, the adapter cases of
  [ADR 0014](./0014-material3-layer-and-mode-mapping.md), and the packed-consumer type gate. The
  emitted declarations of the implementation must pass it on both blocking compilers before the
  release.
- The supported TypeScript major joins the versioned contracts in [semver.md](../semver.md) when
  the implementation lands. Adopting TypeScript 7 in the repository belongs to the implementation.

The closing pass ran the prototype declarations on every compiler from 5.4.5 to 7.1-dev (Appendix
A). The supported compilers catch 18 of 18 error cases, hold every positive assertion, and keep the
reference suggestion for E1, E2, E6, and E7, under `strict` alone and with
`exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`:

| TypeScript          | Error cases caught | Positive assertions | Reference "Did you mean" (E1, E2, E6, E7) | Status              |
| ------------------- | -----------------: | ------------------- | ----------------------------------------- | ------------------- |
| 7.0.2               |              18/18 | all hold            | all four                                  | supported (floor)   |
| 7.1.0-dev           |              18/18 | all hold            | all four                                  | `next` signal       |
| 5.6.3 through 6.0.3 |              18/18 | all hold            | all four                                  | historical evidence |
| 5.4.5, 5.5.4        |              18/18 | all hold            | E6 missing                                | historical evidence |

The 5.x and 6.x results are kept as evidence that the type design does not depend on one compiler
generation, not as a compatibility commitment. Messages are not contractual, and TypeScript 7
prints union members in a different order than 5.x and 6.x.

## Revalidated hypotheses

| Hypothesis                                     | Verdict                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Values are semantically opaque in core         | Holds. `concat` composes structure without interpreting values.                                |
| References are explicit                        | Holds, and `concat` parts are explicit too.                                                    |
| Deterministic compilation                      | Holds. Authored mode order is data and just as deterministic.                                  |
| No color model in core                         | Holds. `color-scheme` is an ordinary token bound by application CSS; `light-dark()` stays out. |
| Material 3 is a sibling package                | Holds, and it now returns an ordinary layer (ADR 0014).                                        |
| A bounded selector grammar                     | Holds, extended with `:where()`, `:is()`, `:not()`, `:host`, `:host()`, and bounded media.     |
| Trusted and untrusted entry paths are distinct | Holds, with one validator, composer, and resolver behind both (D11).                           |
| Modes are one flat list                        | Holds for the model. Two-axis applications express their selectors as custom conditions.       |
| The graph owns the mode envelope               | Holds, sharpened: layers carry a derived mode set that must equal the graph's (D12).           |

## Acceptance examples

1. **Hand-authored graph.** The first example in D2 compiles to the public keys `action.primary`
   and `surface`, and CSS export emits `:where(:root) { --action-primary: …; --surface: … }` with
   no options.
2. **Material 3, overrides, and public aliases.** The second example in D2 with the real adapter:
   the direct graph override wins and stays internal, the public tokens compile, all 48 Material
   roles stay internal, and provenance records `material3` then `graph` for the overridden role.
3. **System light and dark with an explicit choice.** Mapping `dark` to
   `(prefers-color-scheme: dark)` through `system` emits `:where(:root)` inside that media query.
   An unset root follows the system preference, `data-theme="light"` and `data-theme="dark"` win
   over it in both directions, and a value that is not a mode, such as `data-theme="system"`,
   leaves the system preference in charge.
4. **A nested, differently themed section.** `<section data-theme="dark">` is dark on a light page,
   and `<div data-theme="light">` inside it is light again, for page roots and shadow roots.
5. **A reference whose target changes across contexts.** With `references: "var"`, the alias
   `ring` is emitted as `var(--primary)` and the composite `ring-shadow` as
   `0 0 0 3px var(--primary)`. Both resolve in the mode of the element that renders them, and both
   follow target overrides on marked elements and in unlayered CSS.
6. **The production two-axis shape.** Palette and appearance stay application attributes. With
   `attribute: false`, custom conditions in authored mode order, and one system condition per
   palette, the browser verification resolves the overlapping conditions as intended.
7. **An incompatible layer.** The default `material3()` layer in the production consumer's six-mode
   graph fails type checking with `LayerModeMismatch<…>`, and at runtime with one
   `layer-mode-mismatch` issue.

The production consumer migrates by keeping `defineTokenGraph` and replacing `layers:
material.layers` with `layers: [material]` and `exactModes` with `modes`, dropping `defaultMode`
from the Material call, deleting its two mode drift checks (ADR 0014), replacing `variableName` with `prefix: "color"`, and replacing the exact
selector map with `attribute: false` plus `system` and `selectors`, which also lets the exporter
produce the system fallback it renders by hand today. None of its 338 graph keys collides with the
48 Material keys, so the new composition and visibility rules change nothing in its output, and
neither it nor the Material demo applications read the removed `origin` or `dependenciesByMode`
metadata. The CSS block order changes from canonical to tier and authored mode order. The Material
demo applications replace their boilerplate with `orThrow` and `:root.dark` with a `.dark` custom
condition, which also makes nested dark sections work.

## Release scope

The smallest coherent breaking release is one core release, proposed as `0.4.0`, with a companion
`@scheme-tokens/material3` release under ADR 0014 once that record is accepted.

Included, because each item changes the contract or the wire format and would otherwise force
another breaking release:

- D1 and D2: vocabulary, `defineTokenGraph` as the single graph helper, `tokenConcat`, and authored
  mode order;
- D3: graph-last composition and visibility-preserving overrides;
- D4 and D12: static public-key typing, layer mode sets, and `layer-mode-mismatch`;
- D5 and D6: `concat` with its resolved-value limit, and the reshaped compiled metadata;
- D7 and ADR 0012: the CSS activation model, names, and collision diagnostics;
- D9: `orThrow`, because every example in the documentation needs it;
- D10: format version 2, the source-format retention policy with the v1 upgrade, the `$schema`
  rule and its versioned HTTPS convention, and self-contained schemas with URN ids;
- D11: the single validation, composition, and resolution pipeline behind it all;
- D13: the supported TypeScript 7 baseline and its CI gates.

D8 (`var()` output) is additive once D6 ships, so it is not a release blocker. The prototype shows
it is small, and it is recommended for the same release.

Deferred, because each item is additive later: an explain helper for provenance chains, a layer
mode-remapping helper, the DTCG import package, Material custom colors and non-color `md.sys` token
families, a runtime variant catalogue for `material3`, a build-tool plugin, contrast checking as a
sibling package, `@property` registration, and further selector features.

`1.0.0` follows once the production consumer and the Material applications run on the new release.

## Invariants to keep as tests

The prototypes stay out of the repository. The implementation keeps their discoveries as compact
regression and invariant tests:

- graph tokens compose after layers, and a later layer beats an earlier one;
- an override without `visibility` keeps the effective visibility of what it replaces, and an
  explicit `visibility` restates it;
- a v1 graph and its v2 upgrade compile to identical values and visibility (golden fixtures plus a
  seeded randomized corpus);
- a v1 compiled scheme fails with `invalid-format-version`;
- `$schema` never changes how an artifact parses, a v2 value survives a round trip verbatim, and
  the v1 upgrade drops it;
- the schemas compile under their URN ids and contain only fragment `$ref`s;
- retained expressions: no record for a literal, only `ref` for a pure reference, and a resolved
  value on every reference part of a `concat`;
- every CSS block declares the complete selected token set;
- activation order: base, system, explicit, custom, then authored mode order; a non-mode attribute
  value keeps the system preference; nested markers; overlapping custom conditions;
- literal graphs get complete public records, dynamic graphs and parsed layers stay partial;
- layer mode sets: empty, equal, reordered, mismatched, inconsistent inside a layer, dynamic; one
  `layer-mode-mismatch` per layer, with its reference and differing map for an inconsistent layer,
  and no per-token mode issues for that layer;
- the default `material3()` layer keeps its own mode set inline in a graph's `layers`, under an
  annotated variable, a declared return type, and a typed layer list (the `NoInfer` regression);
- canonical `concat`: merged and dropped literal parts, a reference-free `concat` becomes a string;
- unknown references and cycles inside `concat`, a `concat` that references one key twice, and
  sibling order that is not a cycle;
- the resolved-value limit fails before allocation on an exponential chain, counts UTF-16 code
  units, and dependants are not reported again;
- the TypeScript case matrix on the oldest supported 7.x release and the repository's latest stable
  7.x release, blocking, and on `typescript@next` as a signal.

## Implementation and release gates

These are verification work for the release, not open design questions:

- `:where(:host)` and `:where(:host(…))` were verified in Chromium only. Firefox and WebKit must be
  checked before release. If an engine does not match `:host` inside `:where()`, host selectors are
  emitted unwrapped and the zero-specificity rule documents that exception.
- The emitted declarations must pass the blocking suite on both blocking compilers (D13), and the
  repository moves to TypeScript 7 as part of the implementation.
- On TypeScript 7.0, check cost equals today's types at 2,000 literal tokens; on the unsupported
  5.x and 6.0 compilers it was about twice today's. The implementation profiles the constraint
  before release.
- The v1 → v2 upgrade passes its equivalence gate on frozen fixtures and the randomized corpus.

## Accepted trade-offs

- The chosen typing reports misspelled metadata keys as `UnknownTokenProperty<"descripton">` rather
  than with TypeScript's own spelling suggestion.
- 65,536 code units is a judgment: far above any composite value seen, and raising it later is
  compatible.
- The schema URN uses an unregistered NID (D10).
- Compiled v1 schemes are not upgraded. A consumer that persists only compiled output must
  recompile.
- Removing `defineTokens` changes the first line of every example; it ends the equivalence with
  `defineTokenGraph`.

## Appendix A — type prototype

A standalone module compared four signatures with the same inputs on TypeScript 6.0.3 (repository)
and 5.9.3 (the production consumer's compiler). The ten error cases were: reference typos to a
graph key (E1), to a layer key (E2), in an expanded mode map (E6), and in a `concat` (E7); a mode
map missing a mode (E3); an unknown mode in a direct (E4) and in an expanded mode map (E10); an
invalid visibility (E5); a misspelled metadata key (E8); and metadata mixed with mode keys (E9).

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

### Closing pass: single-object graphs and layer mode sets

The closing pass rewrote the chosen candidate for `defineTokenGraph({ … })`, added layer mode sets
and a `material3()` signature with the real 48-role key union, and ran it on TypeScript 5.4.5,
5.5.4, 5.6.3, 5.7.3, 5.8.3, 5.9.3, 6.0.3, 7.0.2, and 7.1.0-dev.20260929.1, each with `strict`,
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, and
`skipLibCheck: false`, and again with `strict` alone. Only TypeScript 7 is supported (D13); the
5.x and 6.x runs are historical evidence of the design's robustness.

Negative cases, each an `@ts-expect-error` that must be consumed:

| Case   | Input                                                                             |
| ------ | --------------------------------------------------------------------------------- |
| E1–E10 | the ten error cases above, in the single-object form                              |
| M6     | the default `material3()` layer, written inline, in the six-mode production graph |
| M7     | a `light`/`dark` layer in a graph without `modes`                                 |
| M8     | a layer with `light`, `dark`, and `dim` in a `light`/`dark` graph                 |
| M9     | a layer whose mode maps disagree                                                  |
| M11    | the second of two layers is incompatible                                          |
| M12    | a custom Material mode without `appearance`                                       |
| V1     | `modes` without `defaultMode`                                                     |
| V2     | a `defaultMode` outside `modes`                                                   |

Positive cases, each with exact type assertions: public keys of the first D2 example; the Material
example of D2 with an internal override and an explicit republish, under the default and the `all`
selection; a dynamic graph and a parsed layer staying partial; the six-mode production Material
layer and graph; a layer without mode maps in any graph; a parsed layer and a dynamic mode tuple
checked only at runtime; reordered graph modes; a hand-authored mode-dependent layer; and omitted
`modes` meaning `base`.

Every version caught 18 of 18 negative cases and passed every positive case, under both
configurations. The reference suggestion appeared for E1, E2, E6, and E7 on 5.6.3 and later; on
5.4.5 and 5.5.4 it was missing for E6 only, where today's released types keep it. Two variants were
rejected on the way:

- Without `NoInfer` on its return type, `material3("#6750a4")` written inline in a six-mode graph
  inferred six modes from the contextual return type, so M6 was not caught, on every version. That
  variant constrained `layers` by a union of mode-bearing layer types, which supplied the contextual
  type; the acceptance pass refines where the hazard lives today (below).
- An invariant mode phantom checked by assignability also caught every case, but TypeScript
  elaborated against the `string` member of the accepted union. The chosen explicit check names
  both sets:

  ```text
  error TS2375: Type 'TokenLayer<Material3TokenKey, "light" | "dark", …>' is not assignable to type
    'TokenLayer<Material3TokenKey, "light" | "dark", …> & LayerModeMismatch<"light" | "dark", "mono-light" | ... 4 more ... | "material3-dark">'.
    Type 'TokenLayer<…>' is missing the following properties from type 'LayerModeMismatch<"light" | "dark",
    "mono-light" | "mono-dark" | "vivid-light" | "vivid-dark" | "material3-light" | "material3-dark">': layerModes, graphModes
  ```

Concrete `defineTokenLayer()` calls derive their mode set without assertions. Inside a function that
is generic in `Mode`, TypeScript cannot evaluate the derived set on any tested version, so a generic
generator asserts its declared return type once (ADR 0014).

Check time, three runs each, with `skipLibCheck`. "Production-shaped" is a generated literal graph
with the consumer's token categories and counts (150 internal sources and 40 derived values as
literal six-mode maps, 26 public roles and 122 internal projections as reference maps) and the
48-role Material layer. "Today" is the same content against the released 0.3 declarations.

| TypeScript | Production-shaped, chosen | Production-shaped, today | 2,000 tokens, chosen | 2,000 tokens, today |
| ---------- | ------------------------- | ------------------------ | -------------------- | ------------------- |
| 5.4.5      | 0.36–0.37 s               | 0.36–0.37 s              | 2.07–2.38 s          | 1.41–1.45 s         |
| 5.5.4      | 0.34–0.36 s               | 0.35–0.36 s              | 2.10–3.63 s          | 1.29–1.30 s         |
| 5.6.3      | 0.34–0.36 s               | 0.37–0.39 s              | 2.10–2.17 s          | 1.27–1.37 s         |
| 5.7.3      | 0.36–0.39 s               | 0.37–0.37 s              | 2.02–2.30 s          | 1.33–1.39 s         |
| 5.8.3      | 0.35–0.36 s               | 0.35–0.36 s              | 2.05–2.34 s          | 1.31–1.56 s         |
| 5.9.3      | 0.35–0.44 s               | 0.32–0.41 s              | 2.28–2.43 s          | 1.05–1.16 s         |
| 6.0.3      | 0.35–0.39 s               | 0.34–0.36 s              | 2.00–2.40 s          | 1.18–1.21 s         |
| 7.0.2      | 0.08–0.10 s               | 0.09–0.09 s              | 0.50–0.50 s          | 0.50–0.51 s         |
| 7.1.0-dev  | 0.07–0.07 s               | 0.07–0.08 s              | 0.44–0.46 s          | 0.44–0.45 s         |

The first pass measured the real production graph written as literal TypeScript: 0.36–0.41 s
(6.0.3) and 0.37–0.42 s (5.9.3) for the chosen typing against 0.33–0.36 s and 0.34–0.44 s for
today's types. The reverse-mapped validator needed 0.60–0.66 s and 4.7–5.2 s for the production
and 2,000-token inputs on 6.0.3.

The type layer exactly as tested in the closing pass:

```ts
export type TokenVisibility = "public" | "internal";
export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export interface TokenReference<Key extends string = string> {
  readonly ref: Key;
}
export type TokenConcatPart<Key extends string = string> = string | TokenReference<Key>;
export interface TokenConcat<Key extends string = string> {
  readonly concat: readonly TokenConcatPart<Key>[];
}
export type TokenExpression<Key extends string = string> =
  string | TokenReference<Key> | TokenConcat<Key>;
export type TokenModeValues<Mode extends string, Key extends string> = {
  readonly [M in Mode]: TokenExpression<Key>;
};
export interface TokenMetadata {
  readonly description?: string;
  readonly deprecated?: boolean | string;
  readonly extensions?: { readonly [key: string]: JsonValue };
}
export type ExpandedToken<Key extends string, Mode extends string> = TokenMetadata & {
  readonly value: TokenExpression<Key> | TokenModeValues<Mode, Key>;
  readonly visibility?: TokenVisibility;
};
export declare function tokenRef<const Key extends string>(key: Key): TokenReference<Key>;
type RefKey<Part> = Part extends TokenReference<infer Key> ? Key : never;
export declare function tokenConcat<const Parts extends readonly TokenConcatPart[]>(
  strings: TemplateStringsArray,
  ...parts: Parts
): TokenConcat<RefKey<Parts[number]>>;

// Layers: Mode is the layer's mode set. `never`: no mode maps, fits any graph. `string`: unknown.
declare const layerInfo: unique symbol;
export interface LayerVisibility {
  readonly default: TokenVisibility;
  readonly public: string;
  readonly internal: string;
}
interface TokenLayerData<Key extends string> {
  readonly kind: "scheme-tokens/token-layer";
  readonly formatVersion: 2;
  readonly id: string;
  readonly defaultVisibility: TokenVisibility;
  readonly tokens: { readonly [K in Key]: ExpandedToken<string, string> };
}
export interface TokenLayer<
  Key extends string = string,
  Mode extends string = string,
  Visibility extends LayerVisibility = LayerVisibility,
> extends TokenLayerData<Key> {
  readonly [layerInfo]?: { readonly modes: Mode; readonly visibility: Visibility };
}
declare const graphInfo: unique symbol;
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
  readonly [graphInfo]?: { readonly all: Key; readonly public: PublicKey };
}

// Visibility composition over key unions (ADR 0011).
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
      Head extends TokenLayer<infer K, infer _M, infer V>
        ? Compose<S, K, V["public"], V["internal"], V["default"]>
        : S,
      Tail
    >
  : Layers extends readonly []
    ? S
    : { readonly all: string; readonly public: string; readonly internal: string };
type Empty = { readonly all: never; readonly public: never; readonly internal: never };
type LayerMemberKey<Layer> = Layer extends TokenLayer<infer K, infer _M, infer _V> ? K : never;
export type LayerKey<Layers extends readonly unknown[]> = LayerMemberKey<Layers[number]>;

// Entry validation: plain const capture with a strict constraint.
type ModeTuple = readonly [string, ...string[]];
type DefinitionKey = "value" | "visibility" | "description" | "deprecated" | "extensions";
type NoExtra<V, Allowed extends PropertyKey> = [Exclude<keyof V, Allowed>] extends [never]
  ? true
  : false;
type IsExpression<V> = V extends string | { readonly ref: unknown } | { readonly concat: unknown }
  ? true
  : false;
type CheckInnerValue<Inner, Mode extends string> =
  IsExpression<Inner> extends true ? true : NoExtra<Inner, Mode>;
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
          ? CheckInnerValue<V["value" & keyof V], Mode> extends true
            ? V
            : never
          : never
        : never
      : V extends TokenModeValues<Mode, Key>
        ? NoExtra<V, Mode> extends true
          ? V
          : never
        : never;
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
type ForbidInnerModes<Inner, Mode extends string> =
  IsExpression<Inner> extends true ? unknown : Forbid<Inner, Mode, "mode">;
type ExpectedStrict<V, Key extends string, Mode extends string> =
  IsExpression<V> extends true
    ? TokenExpression<Key>
    : "value" extends keyof V
      ? ExpandedToken<Key, Mode> &
          Forbid<V, DefinitionKey, "property"> & {
            readonly value: ForbidInnerModes<V["value" & keyof V], Mode>;
          }
      : TokenModeValues<Mode, Key> & Forbid<V, Mode, "mode">;
type CheckStrict<V, Key extends string, Mode extends string> =
  V extends Valid<V, Key, Mode> ? V : ExpectedStrict<V, Key, Mode>;

// Layer mode sets (D12).
type EntryModes<V> =
  IsExpression<V> extends true
    ? never
    : "value" extends keyof V
      ? EntryModes<V["value" & keyof V]>
      : Extract<keyof V, string>;
export type LayerModesOf<T> = { [K in keyof T]-?: EntryModes<T[K]> }[keyof T];
/** Error marker: a layer's mode maps name a different mode set than the graph declares. */
export interface LayerModeMismatch<LayerMode extends string, GraphMode extends string> {
  readonly layerModes: LayerMode;
  readonly graphModes: GraphMode;
}
type LayerModesOfLayer<L> = L extends { readonly [layerInfo]?: { readonly modes: infer M } }
  ? M
  : string;
type SameSet<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type CheckLayer<L, GraphMode extends string> = [LayerModesOfLayer<L>] extends [never]
  ? L
  : string extends LayerModesOfLayer<L> | GraphMode
    ? L
    : SameSet<LayerModesOfLayer<L>, GraphMode> extends true
      ? L
      : LayerModeMismatch<LayerModesOfLayer<L> & string, GraphMode>;
type CheckLayers<Layers extends readonly unknown[], GraphMode extends string> = {
  readonly [I in keyof Layers]: CheckLayer<Layers[I], GraphMode>;
};

export declare function defineTokenLayer<
  const T extends {
    readonly [K in keyof T]: CheckStrict<T[K], string, NoInfer<LayerModesOf<T>>>;
  },
  const D extends TokenVisibility = "public",
>(input: {
  readonly id: string;
  readonly defaultVisibility?: D;
  readonly tokens: T;
}): TokenLayer<
  Extract<keyof T, string>,
  LayerModesOf<T>,
  {
    readonly default: D;
    readonly public: ExplicitKeys<T, "public">;
    readonly internal: ExplicitKeys<T, "internal">;
  }
>;

// Graphs: one object; the graph owns the envelope.
type LayerTuple = readonly TokenLayerData<string>[];
type ComposedPublic<T, Layers extends LayerTuple, D extends TokenVisibility> = Compose<
  ComposeLayers<Empty, Layers>,
  Extract<keyof T, string>,
  ExplicitKeys<T, "public">,
  ExplicitKeys<T, "internal">,
  D
>["public"];
// A dynamic key set anywhere in the composition makes the public set unknown.
type PublicOf<T, Layers extends LayerTuple, D extends TokenVisibility> = string extends
  Extract<keyof T, string> | LayerKey<Layers>
  ? string
  : ComposedPublic<T, Layers, D>;
type GraphModes<M> = M extends ModeTuple ? M[number] : "base";
type DefaultModeInput<M> = M extends ModeTuple
  ? { readonly defaultMode: NoInfer<M[number]> }
  : { readonly defaultMode?: never };

export declare function defineTokenGraph<
  const T extends {
    readonly [K in keyof T]: CheckStrict<
      T[K],
      NoInfer<Extract<keyof T, string> | LayerKey<Layers>>,
      NoInfer<GraphModes<M>>
    >;
  },
  const M extends ModeTuple | undefined = undefined,
  const Layers extends LayerTuple = readonly [],
  const D extends TokenVisibility = "public",
>(
  input: {
    readonly modes?: M;
    readonly defaultVisibility?: D;
    readonly layers?: Layers & CheckLayers<Layers, NoInfer<GraphModes<M>>>;
    readonly tokens: T;
  } & DefaultModeInput<M>,
): TokenGraph<Extract<keyof T, string> | LayerKey<Layers>, GraphModes<M>, PublicOf<T, Layers, D>>;

// The Material 3 signature (ADR 0014); Material3Modes<Mode> maps each graph mode to coordinates.
export declare function material3<
  const Mode extends string = "light" | "dark",
  const Visibility extends TokenVisibility = "public",
>(
  sourceColor: string,
  options?: Material3Options<Mode, Visibility>,
): TokenLayer<
  Material3TokenKey,
  NoInfer<Mode>,
  { readonly default: NoInfer<Visibility>; readonly public: never; readonly internal: never }
>;
```

### Acceptance pass: layer example, Material 3 API, and `NoInfer`

The acceptance pass reused the closing-pass declarations with the concrete adapter options of
ADR 0014 and ran them on TypeScript 7.0.2 and 7.1.0-dev.20260929.1, with 6.0.3 for comparison,
under the strict configuration above. All three compilers agree.

- The normative D12 layer infers `light | dark`; a layer with only literals infers `never`; the
  disagreeing layer fails on token `a` with the missing `dim` mode.
- The ADR 0014 examples typecheck with exact types: the basic graph and its public keys, the
  six-mode coordinate map with the graph's six modes as its mode set, the composition with a second
  layer (`all` keys are the 48 Material roles, the brand keys, and the graph keys), a parsed layer,
  and a dynamic coordinate map whose mode set is `string`.
- Rejected, each an `@ts-expect-error` that is consumed: the disagreeing layer; the default layer
  in the six-mode graph, with the modes written inline and held in a `const` tuple; a six-mode
  layer in a `light`/`dark` graph; a `light`/`dark` layer in a `light`/`dark`/`dim` graph; a custom
  Material mode without `appearance`; a redundant `appearance` on `light`; the removed `exactModes`
  and `defaultMode` options; a string shorthand for a coordinate.
- `modes: {}` inferred `Mode = never`, which types the layer as fitting every graph while the
  runtime rejects it. The guard in ADR 0014 rejects the empty map and leaves every other case
  unchanged.
- `NoInfer` is still required, but the chosen `CheckLayers` form of `defineTokenGraph` no longer
  supplies the contextual type: without `NoInfer`, the inline six-mode case is still rejected. The
  hazard remains wherever a mode-bearing layer type is expected. Without `NoInfer`, the default
  layer passes as a six-mode layer when it initializes an annotated variable, is returned from a
  function with a declared return type, or is an element of a typed layer list (cases X1–X3 of
  ADR 0014); with `NoInfer`, all three are rejected. Removing `NoInfer` from the closing-pass
  variant with the mode-bearing `layers` constraint reproduces the original M6 failure.

## Appendix B — runtime prototype

A standalone JavaScript prototype implemented D3, D5, D6, D7, and D8 and ran the acceptance
examples with the real `material3("#6750a4", { visibility: "internal" })` output.

Composition and provenance for the overridden role and its alias, shown with the sparse
`expressionByMode` rule of D6 (the literal override retains no expression):

```json
{
  "md.sys.color.primary": {
    "visibility": "internal",
    "declarations": [
      { "origin": { "kind": "layer", "id": "material3" } },
      { "origin": { "kind": "graph" } }
    ]
  },
  "primary": {
    "visibility": "public",
    "declarations": [{ "origin": { "kind": "graph" } }],
    "expressionByMode": {
      "light": { "ref": "md.sys.color.primary" },
      "dark": { "ref": "md.sys.color.primary" }
    }
  }
}
```

The prototype printed each reference with its resolved value, `#b3261e` and `#f2b8b5`. The final
shape of D6 leaves the value out of a pure reference, because it is `tokens.primary.light` and
`tokens.primary.dark`.

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

Probe C, the resolved-value limit (closing pass). An iterative, memoized resolver that sums known
part lengths before joining, with a limit of 65,536 code units:

| Input                                                                        | Result                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `a0` is 8 code units; `a1`…`a64` each concatenate the previous token twice   | one `resolved-value-too-long` at `a14` (prospective 131,072); longest string built 65,536; 0.5 ms |
| a 40,000-code-unit literal concatenated twice, then aliased and concatenated | one issue at the doubling token; the alias and the outer `concat` are not reported                |
| `concat` with a reference to a missing key                                   | one `unknown-reference`                                                                           |
| `a` → `b` → `c` → `a` through two `concat` expressions                       | one `reference-cycle` with the path `a, b, c, a`                                                  |
| `x` concatenates `b` and `a`, where `a` references `b`                       | resolves; not a cycle                                                                             |

A first version marked keys as in progress when they were pushed rather than expanded and reported
false cycles for the doubling chain; the invariant in D5 comes from that bug.

Probe D, production measurements (closing pass, with the final D6 shape re-measured in the
acceptance pass). The consumer's real graph was captured read-only through a module-resolution hook
and compiled with the released 0.3.0 compiler. The acceptance pass reproduced the earlier figures
exactly:

| Measure                                                   | Result                                       |
| --------------------------------------------------------- | -------------------------------------------- |
| keys and modes                                            | 386 (338 graph, 48 layer), 6 modes           |
| expressions                                               | 2,316: 1,878 literal, 438 pure references    |
| resolved values as JSON                                   | 88,856 B (9,148 B gzipped)                   |
| every expression retained                                 | 110,108 B (11,362 B gzipped)                 |
| only references, each with its resolved value (draft)     | 37,270 B (3,960 B gzipped)                   |
| only references, target only (final D6)                   | 25,974 B (2,327 B gzipped)                   |
| complete blocks, 26 public roles, 9 two-axis blocks       | 10,421 B (1,232 B gzipped), 234 declarations |
| complete blocks, all 386 keys, 9 blocks (upper bound)     | 199,858 B (8,805 B gzipped)                  |
| today's exporter output, 6 blocks without system fallback | 6,838 B (1,137 B gzipped), 156 declarations  |

## Appendix C — browser verification

The prototype's CSS for the Material example ran in the desktop app's browser with emulated light
and dark system preferences. Each run checked computed custom properties and `color-scheme` for:
the page, a dark section, a plain descendant and a light island inside it, each with the root
unset, light, and dark; two `:host` web components, one marked dark with a light inner island and
one unmarked; an override without and with a mode marker; an unlayered author override; and a
runtime override on the root and its effect on the dark section. Results: 26 of 26 for resolved
output and 26 of 26 for `var()` output, under both the light and the dark system preference.

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

### Closing pass: precedence

A harness rendered 31 scenarios in iframes in Chromium 152 (the desktop app's browser), once with
the light and once with the dark preference emulated. The system tier used an always-true and an
always-false media query as a deterministic stand-in, plus two scenarios with the real
`prefers-color-scheme`. All 31 passed under both preferences.

| Area            | Verified                                                                                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tiers           | base alone; explicit beats base on the root; system beats base; explicit light beats an active system dark without a `:not()` guard; nested dark section and light island                            |
| guard           | `data-theme="system"` keeps the system preference; the old `:root:not([data-theme])` guard falls back to the base mode instead                                                                       |
| custom          | custom beats explicit and system on the same element; two matching custom conditions resolve by authored mode order, and reversing the mode order reverses the winner; a system fallback per palette |
| application CSS | `:root`, `html`, and `[data-theme="dark"]` rules win whether placed before or after the tokens; a `:where(html)` rule loses when placed before and wins when placed after                            |
| `cascadeLayer`  | an unlayered zero-specificity rule placed before wins; an earlier layer loses despite `html:root`; a later layer wins; the same layer competes by specificity; `!important` in an earlier layer wins |
| markers         | two mode classes on one element resolve to the later mode; generated exclusions make the element inherit; `data-theme="light dark"` matches no marker and inherits                                   |
| `color-scheme`  | a `:root` binding leaves a nested dark section `light`; `:root, [data-theme]` and `:where(*)` bindings make it `dark`                                                                                |
| shadow roots    | `:where(:host([data-theme="dark"]))` and `:where(:host)` match their hosts, and a light island inside the shadow tree resolves                                                                       |

## References

- [ADR 0002: Pre-release Public API Reset](./0002-public-api-reset.md)
- [ADR 0004: Material 3 Adapter Design](./0004-material3-adapter-design.md)
- [ADR 0009: Core Contract Convergence](./0009-core-contract-convergence.md)
- [ADR 0010: Graph Tokens Compose Last](./0010-graph-tokens-compose-last.md)
- [ADR 0011: Visibility-Preserving Overrides](./0011-visibility-preserving-overrides.md)
- [ADR 0012: Single-Hyphen CSS Variable Names](./0012-single-hyphen-css-variable-names.md)
- [ADR 0014: Material 3 Layer and Graph-Mode Mapping](./0014-material3-layer-and-mode-mapping.md)
- [Audit 2026-09](../audit-2026-09.md)
- [Consumer evidence audit](../audit-2026-08-consumer-evidence.md)
