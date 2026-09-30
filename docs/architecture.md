# Architecture

`scheme-tokens` is a zero-runtime-dependency compiler for authored string-valued token graphs. It owns composition, explicit references, visibility, provenance, deterministic wire artifacts, and CSS projection. Color interpretation, generation, repair policy, product models, and runtime plugin registries remain outside core.

## One semantic pipeline

```text
trusted authoring -> normalize shorthand -----------+
persisted v2 --------------------------------------+-> validate -> compose -> resolve -> select
persisted v1 -> historical grammar -> upgrade ------+
```

`normalize-authoring.ts` expands the three authoring forms without implementing a second set of semantic rules. `validate-source.ts` owns graph/layer validation and expression classification, using `validation-fields.ts` for shared artifact fields and `canonical-expression.ts` for expressions. `compose-token-graph.ts` owns precedence, visibility, and declaration provenance. `resolve-token-graph.ts` drives the iterative memoized engine in `resolve-expressions.ts` for the complete graph before selection.

`upgrade-v1-source.ts` is the single v1-to-v2 source transformation. Historical grammar differences are confined to the source boundary; the upgraded result uses the ordinary current validator, composer, and resolver. There is no old compiler in production. `source-paths.ts` maps moved declarations back to the input document. Private expression location bookkeeping preserves original reference-part pointers through canonicalization without adding fields to artifacts.

Trusted helpers copy accepted data and throw structured errors for misuse. Parsers accept `unknown`, copy accepted input, and return `Result` for JSON-compatible failures. Graph parsing uses the same composer/resolver to diagnose references and cycles. Graph helpers defer those diagnostics until compilation because targets depend on final composition.

## Graph and layer authority

The graph owns the mode set, authored mode order, and default. Omitted options mean `base`; explicit modes require an explicit default, which need not be first. Layers have an ID, local default visibility, and tokens, with no mode envelope.

Direct expressions impose no layer mode requirement. All mode maps in a layer must have the same set; a non-empty set must equal the graph's set, independently of key order. Inconsistent layers emit one deterministic `layer-mode-mismatch`. Statically, `TokenLayer<Key, Mode, Visibility>` carries the same mode set: `never` without mode maps, a finite union for a literal layer, and `string` when unknown. Literal disagreement and finite graph mismatches fail type checking; dynamic sets rely on the runtime check.

Layers compose in array order, then graph tokens compose last. The last declaration supplies value, description, deprecation, and extensions. Visibility alone follows the chain: the most recent explicit visibility wins, otherwise the default of the position that introduced the key applies. An omitted override visibility preserves the preceding effective visibility. `TokenGraph<Key, Mode, PublicKey>` mirrors this composition in its static public key union; any uncertain visibility or dynamic key set makes that union `string`. Such a precise claim is nominal: only the helpers make one, so raw, spread, and mapped data composes as dynamic.

## Expressions and resolution

Bare strings are literals. Exact `{ ref }` records are references. An exact one-property `{ concat: [...] }` record is a concat expression; `concat` with a non-array expression value is a mode-map entry. `concat` is a valid mode name under [ADR 0015](./adr/0015-concat-mode-disambiguation.md).

Concat canonicalization merges adjacent literals, drops empty literals, collapses all-literal content to a string and a lone reference to `{ ref }`, and rejects empty arrays and nesting. `tokenConcat` builds this grammar from a tagged template with reference-only substitutions.

Resolution is iterative and memoized by mode/key. Repeated siblings and diamond DAGs reuse results; failed dependents do not add duplicate diagnostics. Cycles have a code-unit-minimum rotation and are reported once per mode, at the closing reference occurrence. Each resolved concat is bounded to 65,536 UTF-16 code units before joining; authored literals and pure references are unrestricted.

## Compiled output and selection

`tokens[key][mode]` contains resolved strings. `metadataByToken[key]` contains effective visibility and a non-empty `declarations` array in composition order. Each declaration has `origin` and only explicitly authored `visibility`. The final declaration is the winner.

Sparse `expressionByMode` retains `{ ref }` for a pure reference or canonical concat parts, with `{ ref, value }` for each concat reference part. Literal modes have no entry. Retained reference values supply CSS projection's per-part literal inlining; they are output data, not provenance. The compiled parser checks this structure without proving that retained expressions recompute to `tokens` or that edited references are acyclic.

Selection is `public` by default, `all`, or an exact non-empty key set. Resolution sees all composed tokens and modes before selection. Public selection is complete when the static public union is finite and fully known, and partial otherwise. Exact literal key tuples are complete after validation; `all` is complete only for a finite composed key union; parsed and dynamic graphs stay partial. CSS token-to-variable lookups preserve that completeness.

## Persistence and output boundaries

Writers emit format version 2. Records use deterministic code-unit ordering; authored graph mode and layer arrays retain semantic order. Graph serialization writes the envelope, layers, then graph tokens. V2 `$schema` is an optional uninterpreted string, preserved verbatim and never synthesized or fetched. Helpers do not accept it.

V1 source upgrades preserve published 0.3 semantics: shadowed graph declarations move into a collision-free leading layer, necessary override visibilities become explicit, and modes retain the historical default-first/sorted order. Source hints are dropped. The frozen 2,000-case published oracle verifies values, visibility, modes, and descriptive metadata. Compiled v1 artifacts must be recompiled from source.

All three current schemas are self-contained Draft 2020-12 files with `tag:` identities and fragment-only references. Runtime validation additionally enforces semantic relationships such as layer mode-set equality and canonical compiled concat adjacency.

Compilation and serialization preserve arbitrary strings. Material 3 now returns one ordinary core-validated layer. Its exact settings map covers the graph-mode set, while only the graph owns mode order and default. A narrow empty-envelope preflight delegates mode-name validation to core before generation; generated values are validated directly by defineTokenLayer, without a second graph roundtrip. Every effective coordinate is validated before the first engine call. The fixed 48-role catalog, pinned engine and generation algorithms are unchanged. All generated declarations omit visibility, so the return type records every Material key in current core's `omitted` set, with NoInfer modes/default visibility. P5.1 requires the corresponding settings for non-default mode sets or visibility excluding public; only the non-generic default call accepts omitted/undefined options. ADR 0016 corrects the optional-input portion of ADR 0014 without changing generation or core proof.

## CSS activation

`exportCssVars()` parses the entire compiled scheme before validating its options as untrusted plain data, plans activation blocks, derives variable names once, projects and safety-checks one declaration list per emitted mode, and formats the blocks:

```text
compiled scheme ─ options ─ activations ─ names and collisions
                                           │
                   selected keys + sparse retained expressions
                                           │
                         projected declarations + safety ─ complete blocks ─ CSS
```

Blocks come in tier order base, system, explicit, custom; within a tier in the scheme's authored mode order; within a mode in condition order. Each block declares every selected token in canonical key order and is emitted as `:where(<selectors>)`, optionally inside `@media`, all inside one optional `@layer`. Because every activation selector has zero specificity, source order alone decides between matching blocks, and application CSS competes through the ordinary cascade. Explicit markers are unanchored `data-*` attributes and cover the host as well when `root` is `:host`. The exporter emits custom properties only. Real-engine behaviour is proved by the Chromium, Firefox, and WebKit browser suite.

Default names join the optional prefix and key segments with single hyphens (ADR 0012). The encoding is not injective, so every collision among emitted names fails. Option, name, and value failures are collected; each phase only runs when the data it needs parsed. `css-options.ts` owns option parsing; `selector-validation.ts` and `media-validation.ts` are bounded recursive-descent recognizers with length and nesting limits, and layer names reuse the identifier grammar.

`references` defaults to `resolved`. In `var` output, only the selected key/mode's retained expression supplies links. A direct target must be in the scheme's own emitted key set, regardless of metadata visibility or naming success. Pure references to absent targets use their own resolved value; concat preserves literals and links each emitted target or inlines the part's retained value independently. No graph is reconstructed or resolved, no dependencies are added, no chain bypasses an omitted intermediate, and authored CSS strings remain opaque. Links reuse actual names, honoring prefix and callback results; the callback runs once per emitted key in canonical order. Naming failures still fail the export and permit independent value diagnostics using a fixed safe diagnostic-only name, never returned CSS.

Projected declaration values have one authority: complete-string safety, `blocks[].declarations[].value`, and both formatters share the same values. Each emitted key/mode is checked once, regardless of activation count. Unused resolved values, unused retained fallbacks, and isolated concat fragments are not checked in `var` mode. Unsafe concat projection uses `/metadataByToken/<key>/expressionByMode/<mode>`; resolved or directly sourced token values retain `/tokens/<key>/<mode>`. Structural parsing still checks the whole artifact. Every emitted target has its own declaration checked.

Complete alias declarations make nested mode blocks and same-element target overrides propagate locally, including unlayered overrides of layered tokens. Unmarked descendants inherit already-computed aliases, so overriding their target alone cannot update the alias. Concat remains deterministic string projection, not CSS interpretation: `calc(var(--spacing) * 2)` can stay live, `var(--number)px` with a target of `20` is not `20px`, and inserted `var()` inside quotes is literal text. Resolved output remains available for arbitrary character assembly.
