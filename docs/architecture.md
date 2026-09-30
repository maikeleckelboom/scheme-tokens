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

Sparse `expressionByMode` retains `{ ref }` for a pure reference or canonical concat parts, with `{ ref, value }` for each concat reference part. Literal modes have no entry. Retained reference values are output data for future exporters, not provenance.

Selection is `public` by default, `all`, or an exact non-empty key set. Resolution sees all composed tokens and modes before selection. Public selection is complete when the static public union is finite and fully known, and partial otherwise. Exact literal key tuples are complete after validation; `all` is complete only for a finite composed key union; parsed and dynamic graphs stay partial. CSS token-to-variable lookups preserve that completeness.

## Persistence and output boundaries

Writers emit format version 2. Records use deterministic code-unit ordering; authored graph mode and layer arrays retain semantic order. Graph serialization writes the envelope, layers, then graph tokens. V2 `$schema` is an optional uninterpreted string, preserved verbatim and never synthesized or fetched. Helpers do not accept it.

V1 source upgrades preserve published 0.3 semantics: shadowed graph declarations move into a collision-free leading layer, necessary override visibilities become explicit, and modes retain the historical default-first/sorted order. Source hints are dropped. The frozen 2,000-case published oracle verifies values, visibility, modes, and descriptive metadata. Compiled v1 artifacts must be recompiled from source.

All three current schemas are self-contained Draft 2020-12 files with `tag:` identities and fragment-only references. Runtime validation additionally enforces semantic relationships such as layer mode-set equality and canonical compiled concat adjacency.

Compilation and serialization preserve arbitrary strings. The current CSS exporter separately rejects declaration-unsafe values and keeps its existing selector API and double-hyphen token naming. P4's CSS redesign is deferred. Material 3 still returns its existing graph fragment; its adapter owns default-first mode ordering until P5.
