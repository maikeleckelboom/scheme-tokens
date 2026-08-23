# Consumer evidence audit — 2026-08-24

This audit records the evidence collected during the post-0.2 convergence pass. It measures the
current production-shaped graph before proposing more authoring surface. It does not change the
public API, wire formats, compiler behavior, layer semantics, or Material 3 composition package.

## Executive result

- `scheme-tokens@0.2.0` is compatible with the real `maikel.site` adapter. The adapter required no
  behavioral migration, and its exact-selection, CSS-export, typecheck, color-authority, media, and
  generation checks passed.
- The complete `maikel.site` aggregate gate is not green on its current feature branch. Its failures
  are existing manifest, icon, public-README, and visual-baseline drift, not a `scheme-tokens`
  incompatibility. The failure evidence is preserved below.
- The checked-in theme-coordinate example is now the single source executed by the packed-consumer
  gate.
- The production graph contains no layers or redeclared keys, so it provides no evidence of
  partial-layer pain.
- A naive default-plus-overrides calculation reports a 56.98% reduction, but almost all of that is
  invariant data already expressible with direct token expressions. After accounting for the
  existing syntax, a new helper would save only six entries, or 1.12%.

**Decision: NO-GO for a private mode-bound/default-plus-overrides experiment.**

## Evidence classes

The conclusions below keep four kinds of evidence separate.

### Production evidence

`maikel.site` is the only known production consumer. Its build-owned color adapter imports the
package, creates the real 308-token graph, resolves references, compiles exact selections, exports
structured CSS blocks, and serializes the graph. The current checkout now resolves
`scheme-tokens@0.2.0`.

This is the strongest evidence for current core compatibility, but absence of an API from this one
application is not evidence that the API is unnecessary.

### Packed-consumer evidence

[`examples/theme-coordinates/theme.ts`](../examples/theme-coordinates/theme.ts) is copied byte for
byte into an isolated strict NodeNext consumer by
[`scripts/check-theme-coordinate-consumer.ts`](../scripts/check-theme-coordinate-consumer.ts). The
consumer installs a freshly packed tarball with lifecycle scripts disabled, typechecks the copied
source, and executes its runtime assertions.

The source proves:

- the four flattened modes `mono-light`, `mono-dark`, `vivid-light`, and `vivid-dark`;
- exact literal mode and selected-key types;
- public semantic roles resolving through internal source tokens;
- exact-key selection without source-token exposure;
- exact application-owned selectors and injective `--app-*` property names;
- deterministic compiled serialization, CSS, block, and variable-map output;
- the mapping from independent application coordinates to compiler modes; and
- packaged root, schema, and package-metadata exports with no runtime dependency edge.

The checked-in file is therefore readable example source and packed release evidence without a
second implementation. [`tsconfig.examples.json`](../tsconfig.examples.json) also includes it in
normal repository typechecking.

The repository's separate Material 3 packed consumer remains package evidence for
`@scheme-tokens/material3`; it is not production evidence for `maikel.site`, which does not install
or use that package.

### Documentation and example evidence

The example README and application-theme-coordinate guide explain why application axes remain
independent and are flattened only at the compiler boundary. Getting started now introduces exact
selection early, diagnostics use an application-local `orThrow()`, and the Tailwind CSS v4 recipe
bridges application-owned runtime properties through `@theme inline`.

These sources are typechecked and docs-gated, but they remain explanatory evidence rather than proof
of an external production deployment.

### Hypotheses, not proven requirements

- A mode-bound/default-plus-overrides helper would improve authoring enough to justify another
  abstraction.
- Whole-token layer replacement creates material repetition in real consumers.
- One application needs a package-owned issue formatter.
- Absence of a public API in `maikel.site` means that API should be removed.

The measurements below reject the first hypothesis for the current evidence, find no support for the
second, and weigh against the third. They do not turn the fourth into a conclusion.

## Schema contract status

The schema finding has four distinct parts.

### 1. Canonical identifier semantics

Each schema has an absolute HTTPS `$id` under `https://scheme-tokens.dev/schemas/`. A JSON Schema
`$id` establishes a canonical URI identifier; it does not require that the schema be retrievable from
that URI. NXDOMAIN therefore does not make the packaged schemas or their runtime use invalid, and
the identifiers must not be changed casually after appearing in published 0.1.0 and 0.2.0 artifacts.

### 2. Namespace ownership

On 2026-08-24, `scheme-tokens.dev` resolved as NXDOMAIN through the system resolver, Google DNS, and
Cloudflare DNS. The `.dev` registry RDAP endpoint reported the domain as not found. The project does
not currently control the canonical URI namespace.

This is a pre-1.0 namespace-ownership concern. Acquiring or otherwise controlling the existing
namespace may be the least disruptive long-term outcome, but registration, DNS, hosting, identifier
migration, and deployment are outside this audit.

### 3. HTTP availability

All three HTTPS requests failed before an HTTP response because the hostname did not resolve. There
was no redirect, final URL, status response, or remote body. Remote byte equality is therefore not
testable today. This is an HTTP-availability gap, not proof of a package or schema-format defect.

### 4. Packaged availability

The repository includes `schemas` in [`package.json#files`](../package.json) and exposes each schema
through a package subpath. The local source bytes measured during the audit are:

| Schema                           | Bytes | SHA-256                                                            |
| -------------------------------- | ----: | ------------------------------------------------------------------ |
| `token-graph.v1.schema.json`     | 3,430 | `3f062d1a24883528b34297c1c6cef72d184f3bbc5eb0d788b467a8b1b4499a83` |
| `token-layer.v1.schema.json`     |   803 | `b2f8d5c61926a3403a64b48e8169d09682926a150ce392635400871795b5b312` |
| `compiled-scheme.v1.schema.json` | 3,411 | `9dbceb04e15ad6593c3e0390b84cdc7453c7a830825d5c747807f59c7eac6c15` |

The package remains usable through these installed subpaths even though the canonical identifier
host is unavailable.

## Production consumer: `maikel.site`

### Public API usage

The only production import is `color-system/scheme-token-adapter.ts`.

| Public API or behavior                                        | Production use                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `defineTokens`                                                | Yes. Builds the complete production graph.                            |
| `defineTokenGraph`                                            | No.                                                                   |
| `defineTokenLayer`                                            | No.                                                                   |
| `tokenRef`                                                    | Yes. Semantic and projection tokens reference internal source tokens. |
| `compileTokenGraph`                                           | Yes. Every call uses exact `{ keys }` selection.                      |
| Default or explicit `public` selection                        | No.                                                                   |
| `all` selection                                               | No.                                                                   |
| `exportCssVars`                                               | Yes. Exports the 26 public roles with four exact selectors.           |
| `serializeTokenGraph`                                         | Yes. Used for deterministic graph evidence.                           |
| `serializeTokenLayer`                                         | No.                                                                   |
| `serializeCompiledScheme`                                     | No.                                                                   |
| `parseTokenGraph` / `parseTokenLayer` / `parseCompiledScheme` | No.                                                                   |
| Custom `variableName`                                         | Yes. Uses `--color-${segments.join("-")}`.                            |
| Layers                                                        | No.                                                                   |

The consumer-boundary unit test also asserts the complete package root export list. Naming an export
in that boundary assertion is availability evidence, not production use.

### 0.2.0 compatibility result

The dependency moved from exact `0.1.0` to exact `0.2.0` without a color-system redesign, Material 3
introduction, namespace change, or adapter refactor. The adapter itself required no migration. Only
the dependency/lockfile and repository-owned compiler-version evidence changed.

Focused evidence on 0.2.0:

```text
PASS pnpm exec vitest run tests/unit/scheme-tokens-consumer.test.ts
     2/2 tests
PASS pnpm exec vitest run tests/unit/color-generation-contract.test.ts
     -t "publishes the full contrast report without private compiler records"
     1/1 selected test; 15 skipped
PASS pnpm typecheck
PASS pnpm color:authority:check
PASS pnpm media:check
     47 files, 11 sources, 2 galleries
PASS pnpm generate
     50 routes
```

The full exit gate was run and did not pass:

```text
FAIL pnpm verify:full
     stopped at pnpm color:check because public/site.webmanifest is stale
PASS preceding format, lint, typecheck, color-authority, and provenance steps

pnpm test
     622/630 passed; 8 failures across 4 files
     failures: existing manifest, icon, and public-README drift

pnpm test:browser
     464 passed; 33 skipped; 5 failed
     failures: four existing home screenshot-baseline diffs and one manifest theme-color expectation

focused combined graph/contract selection
     17 passed; 1 existing stale-manifest failure
```

The aggregate evidence must not be reported as green. The focused adapter, type, authority, media,
and production generation checks do establish that 0.2.0 did not introduce a package incompatibility.
The remaining failures belong to the existing `design/portfolio-readability` feature-branch baseline.

## CSS variable naming evidence

The production exporter selects 26 public roles and maps them to 26 distinct `--color-*` properties.
There are no collisions in the current selected key set.

The consumer-specific transform is not generically injective over valid token paths. For example,
`a-b.c` and `a.b-c` both map to `--color-a-b-c`. `exportCssVars()` detects such a collision and returns
`duplicate-css-variable`, so it cannot silently overwrite a declaration.

The package default joins path segments with `--`. Because a valid segment cannot contain `--`, the
same keys become distinct properties: `--a-b--c` and `--a--b-c`. The production override is valid for
its current, measured key set; it is not evidence that the safer package default is wrong.

## Public issue-code evidence

The concrete public operation issue unions currently contain 49 unique codes. The generic base
`Issue<Code extends string = string>` remains open; 49 is the inventory of codes named by the current
`TokenGraphIssue`, compile-selection, `ParseCompiledSchemeIssue`, and `ExportCssVarsIssue` unions.

Method:

1. extract the concrete code literals from the committed API snapshot;
2. trace every code to its emitting source branch;
3. search tests for direct code assertions;
4. execute the invalid schema fixtures to identify rejection-only coverage; and
5. run non-persistent public-API probes for every branch without a targeted assertion.

The declared unions are pinned in [`api/scheme-tokens.api.d.ts`](../api/scheme-tokens.api.d.ts). The
emitting branches live in
[`parse-token-graph.ts`](../src/core/parse-token-graph.ts),
[`parse-compiled-scheme.ts`](../src/core/parse-compiled-scheme.ts),
[`compile-token-graph.ts`](../src/core/compile-token-graph.ts), and
[`export-css-variables.ts`](../src/exporters/export-css-variables.ts). Direct assertion evidence is
concentrated in [`schemas.test.ts`](../tests/schemas/schemas.test.ts),
[`api-reset.test.ts`](../tests/unit/api-reset.test.ts),
[`core-v1.test.ts`](../tests/unit/core-v1.test.ts), and
[`css-safety.test.ts`](../tests/unit/css-safety.test.ts).

Coverage totals:

| Coverage class                                         | Codes |
| ------------------------------------------------------ | ----: |
| Direct code assertion                                  |    26 |
| Indirect rejection coverage without asserting the code |     4 |
| No targeted repository assertion                       |    19 |
| Total                                                  |    49 |

### Untrusted or mutated artifact validation only: 27

These codes can surface through the public parsers or through the defensive parse performed by
`compileTokenGraph()` and `exportCssVars()` when a caller supplies a fabricated or mutated artifact.
Successfully trusted helper-authored artifacts do not produce them as `Result` issues; trusted
helpers reject the corresponding local misuse by throwing.

Directly asserted:

- `default-mode-not-found`
- `duplicate-layer-id`
- `invalid-artifact-kind`
- `invalid-dependencies`
- `invalid-format-version`
- `invalid-mode-key`
- `invalid-object`
- `invalid-origin`
- `invalid-schema-uri`
- `invalid-token-key`
- `invalid-token-value`
- `missing-mode-value`
- `missing-property`
- `unknown-property`

Indirect-only:

- `invalid-default-visibility`
- `invalid-reference`
- `invalid-token-definition`
- `missing-token-value`

No targeted assertion:

- `duplicate-mode-key`
- `empty-modes`
- `invalid-deprecated`
- `invalid-description`
- `invalid-extensions`
- `invalid-json-value`
- `invalid-layer-id`
- `invalid-visibility`
- `unknown-mode-value`

The invalid fixture matrix exercises the four indirect-only codes while asserting only that parsing
fails. Property tests additionally establish that the parsers do not throw for arbitrary JSON, but
that is not direct evidence for a particular issue code.

### Trusted graph semantic validation: 2

Both are directly asserted:

- `unknown-reference`
- `reference-cycle`

Trusted helpers can validate the local reference shape, but target existence and cycles depend on the
complete graph after ordered layer composition. These are therefore normal trusted-authoring compile
failures, not merely untrusted parser diagnostics.

### Compile selection: 7

Directly asserted:

- `duplicate-selection-key`
- `empty-selection`
- `invalid-selection-key`
- `unknown-selection-key`

No targeted assertion:

- `invalid-compile-options`
- `invalid-selection`
- `no-selected-tokens`

`no-selected-tokens` is the interesting uncovered typed path: a valid graph containing only internal
tokens can reach it under default public selection. The first two are primarily malformed runtime
option-shape guards.

### CSS export: 13

Directly asserted:

- `duplicate-css-variable`
- `duplicate-mode-selector`
- `invalid-css-prefix`
- `invalid-css-value`
- `invalid-css-variable`
- `invalid-selector`

No targeted assertion:

- `invalid-class-prefix`
- `invalid-css-options`
- `invalid-data-attribute`
- `invalid-mode-selectors`
- `invalid-scope`
- `missing-mode-selector`
- `unknown-mode-selector`

The noteworthy uncovered typed paths are `invalid-scope`, invalid class/data names, and selector-map
coverage for dynamically typed schemes. `invalid-css-options` and `invalid-mode-selectors` are mainly
malformed runtime-shape guards. Executable probes confirmed that all 19 unasserted branches emit their
declared codes. No correctness defect was found, so this pass did not expand into test-coverage work.

## Mode-authoring measurements

### Method

The audit imported the real `createColorTokenGraph()` adapter, compiled it with 0.2.0 and
`selection: "all"`, and counted the normalized compiler input. This measures runtime graph entries,
not visual source lines or repeated construction-helper calls.

Expression identity uses separate literal and reference tags. Two different references remain two
authored expressions even when their targets currently resolve to the same string.

For a hypothetical default expression plus per-mode exceptions, the mechanical minimum for one
token is:

```text
1 default entry + (4 modes - frequency of the most common authored expression)
```

No helper or alternate wire representation was implemented.

### Graph population

| Population             |  Tokens | Current mode entries |
| ---------------------- | ------: | -------------------: |
| Internal source tokens |     230 |                  920 |
| Public semantic roles  |      26 |                  104 |
| Internal projections   |      52 |                  208 |
| **Total**              | **308** |            **1,232** |

Every token is currently materialized as an explicit four-mode map. The internal source builder uses
`valuesByMode(() => resolveProductionColor(source).srgb.css)`, so each invariant source literal is
repeated four times even though the existing direct-expression form already broadcasts one literal
across every graph mode.

### Metric 1: resolved-value cardinality

| Unique final values across four modes | Tokens |
| ------------------------------------: | -----: |
|                                     1 |    232 |
|                                     2 |      5 |
|                                     3 |      7 |
|                                     4 |     64 |

### Metric 2: authored-expression cardinality

| Unique authored expressions across four modes | Tokens |
| --------------------------------------------: | -----: |
|                                             1 |    232 |
|                                             2 |      5 |
|                                             3 |      1 |
|                                             4 |     70 |

Six tokens have four distinct reference identities but only three resolved values:

- `action.ghost-pressed-inverse`
- `context.content-body`
- `context.content-muted`
- `context.content-primary`
- `context.focus`
- `site-footer.detail-underline`

This difference is expected and demonstrates why reference identity must not be collapsed into the
currently resolved string.

### Metric 3: declaration multiplicity

| Composition positions declaring a key | Token keys |
| ------------------------------------- | ---------: |
| Graph only                            |        308 |
| One layer only                        |          0 |
| Graph + layer                         |          0 |
| Multiple layers                       |          0 |
| Other                                 |          0 |

There are no layers, no cross-category key intersections, and no redeclared token keys. The JavaScript
builder combines disjoint source, public-role, and projection records into one graph declaration
position. Object construction groups are not separate compiler composition positions.

The production graph therefore shows no C-pain from whole-token redeclaration or from changing only a
subset of modes in a later layer. This one consumer cannot prove that C-pain is impossible elsewhere,
but it supplies no evidence for partial layers.

## Default-plus-overrides estimate

### Raw mechanical result

| Measure                            |             Result |
| ---------------------------------- | -----------------: |
| Current authored per-mode entries  |              1,232 |
| Modal-optimal default + exceptions |                530 |
| Absolute reduction                 |                702 |
| Percentage reduction               |             56.98% |
| Tokens mechanically benefiting     | 238 / 308 (77.27%) |
| Tokens with no benefit             |  70 / 308 (22.73%) |

If the default expression must be the graph's default-mode expression rather than the most frequent
expression, the minimum is 531. The decision is unchanged.

### Existing-syntax correction

The raw result is not evidence that a new helper is needed. All 232 tokens with one unique expression
can already use a direct string or `tokenRef()` expression. Applying only that existing contract gives:

| Measure                                   |             Result |
| ----------------------------------------- | -----------------: |
| Current entries                           |              1,232 |
| Entries after existing direct expressions |                536 |
| Existing-syntax reduction                 |       696 (56.49%) |
| Hypothetical helper minimum after that    |                530 |
| Incremental helper reduction              |          6 (1.12%) |
| Tokens incrementally benefiting           |    6 / 308 (1.95%) |
| Tokens with no incremental benefit        | 302 / 308 (98.05%) |

The only incrementally benefiting keys are:

- `case-media.frame-shadow`
- `composition.degraded`
- `composition.fail`
- `composition.pass`
- `flow-controls.shadow`
- `flow-debug.failure`

For the 78 semantic and projection tokens alone, the raw maps move from 312 to 300 entries. After the
two invariant references use the existing direct form, the comparison is 306 to 300: six entries, or
1.96%, across 6 of 78 tokens. Twenty-five of 26 public semantic roles have four genuinely distinct
expressions, and the remaining invariant role already fits the direct form.

## Local `orThrow()` evidence

The docs helper is small and type-correct using only existing public types:

```ts
type RichIssue = CompileTokenGraphIssue | ExportCssVarsIssue;

function formatIssue(issue: RichIssue): string {
  const { code, message, ...context } = issue;
  const details = Object.keys(context).length === 0 ? "" : ` ${JSON.stringify(context)}`;
  return `${code}${details}: ${message}`;
}
```

`Issue` alone deliberately exposes only `code`, `message`, and optional `path`. Using the concrete
exported issue unions lets object rest retain every field actually present, including `key`, `mode`,
`layerId`, `firstPath`, `cycle`, `firstKey`, `property`, and `selector`. The generic `orThrow()` then
returns `result.value` or throws one readable error containing every issue.

This was ergonomically easy. The small local structural step accurately reflects the public type
model and does not require casts, duplication of issue-code unions, or operation-specific branches.
It is evidence against adding a public `formatIssues()` or `unwrap()` API for 0.3.0.

## Decision gate

### NO-GO — do not run the private mode-bound experiment next

The production-shaped data does not show meaningful B-pain that requires a new abstraction:

- 230 of the 232 invariant maps are generated source literals already supported as direct strings;
- the other two invariant maps are already supported as direct references;
- 70 of 76 genuinely mode-varying tokens have four distinct expressions;
- only six keys gain one entry each from default plus exceptions; and
- the incremental benefit beyond existing syntax is 1.12%.

A private helper could remain wire-compatible, but compatibility alone is not justification. The
measured ergonomic gain is too small to spend another concept on the authoring contract.

### C-pain result

No C-pain is present in the measured consumer: zero layers and zero redeclared keys. Do not infer a
partial-layer requirement, mode patch semantics, metadata merging, or provenance change from this
graph.

## Remaining concerns and deliberately excluded work

### Remaining concerns

- **Pre-1.0 namespace ownership:** the project does not control `scheme-tokens.dev`. This should be
  resolved deliberately before 1.0 if possible, without treating `$id` as an implicit fetch URL.
- **HTTP schema availability:** the canonical URLs are not retrievable. Hosting is useful but is a
  separate decision from identifier validity and package availability.
- **Consumer aggregate baseline:** `maikel.site` has unrelated manifest/icon/README/screenshot drift.
  Its full verification remains red even though focused 0.2.0 compatibility evidence is green.
- **Diagnostic assertion gaps:** 19 declared branches lack targeted code assertions. The probes found
  no defect; future tests should be driven by risk rather than a mechanical one-test-per-code policy.

### Deliberately not implemented

- public or private mode-set/default-plus-overrides helpers;
- partial mode maps in persisted artifacts;
- partial layer patches or metadata merging;
- `formatIssues()`, `unwrap()`, warning severity, or inspection APIs;
- DTCG Resolver semantics, DTCG export, a CLI, or platform exporters;
- changes to graph/layer precedence, provenance, `Result`, schemas, or root exports;
- Material 3 semantics or peer-range widening;
- a `maikel.site` CSS namespace migration; and
- domain registration, DNS, schema hosting, deployment, publishing, tags, or releases.

The evidence supports convergence by shipping less: retain the current compiler boundary, document
the proven paths, and require materially broader consumer evidence before reopening mode or layer
authoring semantics.
