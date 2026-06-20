# Source conversation archive — non-normative

> **Do not implement from this file directly.** It is the complete historical conversation supplied for provenance and contains earlier names, alternatives, tentative recommendations, and unresolved branches that were superseded by `00` through `08`. When a statement conflicts with the normative package, the normative package wins.

---

> From: https://chatgpt.com/c/6a359b82-5118-83eb-9edf-9bab7d3b96a5

# you asked

message time: 2026-06-19 21:41:54

We need to make our library as idiomatic as possible (https://github.com/maikeleckelboom/color-scheme-tokens). We are going for user/developer friendliness. We also need to identify all inconsistencies, duplication, redundancy, and legacy code (residue from initial material-schemes port), and no backward-compat code. We are greenfield and can break things, we are not published yet.
Claude Sonnet already took a quick look, this might help you started.

"""
I cloned the repo and read through src/, the README, and docs/project-review-analysis.md — that doc already does a serious job on architecture correctness (the expression model, visibility, mode handling). What you're asking now is a different lens: not "is the internal model right" but "what does it feel like the moment someone calls this thing." Three concrete things fell out of just reading the code with that lens on:

1. The README's own onboarding path doesn't compile. Every example imports hex from the root, and the Manual Graph / Layers examples also import tokenKey, lightMode, darkMode, literalColor. None of these are re-exported from src/index.ts — hex lives only in core/colorValue.ts, tokenKey/literalColor in their respective core files, lightMode/darkMode in core/modes.ts. You even have tests/public-api.test.ts hard-locking the exact root export list — and it correctly excludes all five. So the lock-down test is doing its job; the README just drifted out of sync with it, undetected, because nothing executes the README.
2. Your "easy" and "strict" constructors aren't type-equivalent. parseTokenKey<const Name extends string>(input: Name) preserves the literal string type in TokenKey<Name>. tokenKey(input: string): TokenKey — the throw-on-failure convenience wrapper around it — takes a plain string and returns the unparametrized TokenKey, so it silently loses the literal-key tracking the moment someone reaches for the "nice" API instead of the Result-returning one.
3. Two sibling parse* functions return different Result shapes. parseHexColor returns ParseResult ({ ok: false, problem }, singular) while parseColorInput returns Result ({ ok: false, problems: [...] }, plural) — and parseColorInput calls parseHexColor internally and re-wraps it. Both are "parse the color" functions; a caller writing one generic error handler for "anything named parse*" gets bitten.
   None of these are architecture bugs — they're exactly the class of thing that makes a library feel unpolished even when the internals are excellent. That's the gap worth researching deliberately:

Result/error-shape taxonomy. Decide, in writing, when a function returns ParseResult (atomic, one problem) vs Result (aggregate, many problems) vs throws — and audit every export against that rule, not just the new ones. This is the same discipline behind Alexis King's "Parse, don't validate" and the Either/Result conventions in Rust and fp-ts/effect.
Convenience-vs-strict API parity. Whenever you offer a throwing sibling to a Result-returning function (hex/parseHexColor, tokenKey/parseTokenKey), treat type-safety guarantees as part of the contract that both must satisfy, not just runtime behavior.
Executable documentation. README/docs code blocks should be extracted and type-checked/run in CI as part of the test suite — this is the single change that would have caught finding #1 immediately, and it's a small addition given you already have tsup/vitest wired up.
Surface-as-contract testing (Hyrum's Law). You're already doing this well with public-api.test.ts and source-policy.test.ts — that pattern (snapshot the exact export list, fail loudly on drift) is worth formalizing as policy for every future subpath you add, not just root.
A published checklist as an external gate. The Rust API Guidelines checklist is the best existing artifact for this — naming, predictability, debuggability ("does a bad input produce a problem you can act on, not just ok: false"), flexibility, future-proofing. It transfers cleanly to TS because you're already doing Result-based, no-panic-style APIs; it's basically written for libraries with your shape.
Joshua Bloch's "How to Design a Good API and Why it Matters" — older (2007 Google talk) but still the clearest articulation of "API design is mostly about what you leave out," which is directly relevant given your own doc already argues against scope creep into typography/spacing.

The repeatable framework, concretely, as a loop to run before every public surface change (not just at v1):

Write the usage example first, against the literal published entry point — not against internal modules. If it doesn't import cleanly from color-scheme-tokens, the feature isn't done.
Pass it through a naming/verb audit: you already have a clean taxonomy (parse*→primitive, is*→guard, create*→graph-producing, validate*/compile*→pipeline stage, export*→projection). Anything new should map to one of these or you add a new verb deliberately, not by accident.
Pass it through a Result-shape audit: singular problem or plural problems, decided by "is this one input failing for one reason, or one input failing for potentially many reasons" — not by which function you happened to copy from.
Add a type-level assertion test (tsd or expect-type) alongside the runtime test, specifically for any function with a generic/const parameter — runtime tests won't catch the tokenKey() literal-widening regression, only a type-level test will.
Re-run public-api.test.ts-style surface snapshots, and add the README/docs code blocks to that same "must execute against the real package" gate.
Run the Rust-guidelines checklist as a final pass before tagging anything past 0.0
"""

---

# chatgpt response

I’ll perform a greenfield pre-1.0 audit focused on public ergonomics, type and error consistency, docs/tests, packaging, naming, and leftover Material-port residue. I’ll distinguish confirmed defects from design recommendations and shape the result into a breaking-change cleanup sequence.

---

# chatgpt response

I’m validating against current `main`, since the README/root exports have changed since Claude’s snapshot. New confirmed targets include parse-first versus internal throwing residue, nondeterministic serialization, and unused layering machinery.

---

# chatgpt response

The main risks now cluster around silent wrong output and weak gates: CSS key collisions, sRGB precision loss, duplicate validation, compatibility-residue smoke tests, and unenforced CI status checks.

---

# chatgpt response

# Audit verdict

The graph-first architecture is sound, but the repository is currently **halfway between the original port and the intended v1 contract**. I would not incrementally polish the existing v0 surface. Finish the graph contract reset, then remove every redundant type, helper, test, and document that only exists because of earlier iterations.

I audited the current `main` snapshot represented by commit `8d03d468…`.

## Status of Claude’s three findings

1. **The README import problem has been fixed.** Current examples use plain authored strings and only import names that exist at the published entry points.
2. **The `tokenKey()` literal-widening issue remains, but the helper is internal.** Do not repair or export it; delete the throwing helper when the graph model is rewritten. `parseTokenKey()` already preserves the literal type.
3. **The incompatible Result shapes remain and are systemic.** This is a release blocker, not a local cleanup.

# Release blockers

## 1. Standardize the Result and diagnostic contract

There are currently two failure shapes:

```ts
{ ok: false, problems: readonly Problem[] }
{ ok: false, problem: Problem }
```

They are defined side by side, then used by sibling color parsers.

Diagnostics also alternate between:

- `code`
- `kind`
- both `code` and `kind`
- a naked array returned from `validateColorValue()`

Use `kind` exclusively for AST/value discriminants such as `"literal"` and `"reference"`. Use `code` exclusively for diagnostics.

A suitable universal contract is:

```ts
export interface Problem<Code extends string = string> {
  readonly code: Code;
  readonly message: string;
  readonly path?: string; // JSON Pointer
}

export type NonEmptyProblems<P> = readonly [P, ...P[]];

export type Result<Value, P extends Problem> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly problems: NonEmptyProblems<P> };
```

Every `parse*`, graph operation, source, and recipe should use this exact shape. Atomic parsing returns a one-element tuple. This removes all `problems[0]?.message ?? ...` fallbacks and lets consumers write one generic error handler.

Also remove raw `input: unknown` from diagnostics, or replace it with a safe bounded preview. Current color problems retain the original input object, while README examples call `JSON.stringify(result.problems)`. A cyclic input can therefore make the recommended error handler itself throw.

## 2. Make parsing a real runtime boundary

`validateGraph()` accepts `ColorSchemeTokenGraphInput`, then immediately dereferences `graph.schemaVersion`, `graph.modes`, `graph.tokens`, token entries, and mode-value entries. Malformed JavaScript or parsed JSON can throw before a structured problem is produced. It also converts values using `String(...)`, which is coercion rather than parsing.

The public boundary should be:

```ts
parseTokenGraph(input: unknown): Result<TokenGraph, TokenGraphProblem>
```

It should:

- accept `unknown`;
- reject malformed structure without throwing;
- avoid `String()` coercion;
- normalize and copy accepted data;
- return an owned, canonical graph.

The same applies to `parseTokenKey`, `parseModeKey`, and public color parsing. Public `parse*` functions should accept `unknown`; internal predicates can accept narrowed values.

Property-based testing is especially appropriate here:

```ts
fc.assert(
  fc.property(fc.jsonValue(), (value) => {
    expect(() => parseTokenGraph(value)).not.toThrow();
  }),
);
```

## 3. Fix CSS variable name collisions

The current exporter:

1. splits camelCase;
2. flattens dot-separated segments;
3. joins everything with hyphens;
4. lowercases the result.

Consequently, these two valid token keys produce the same variable:

```text
foo.barBaz  -> --foo-bar-baz
foo.bar.baz -> --foo-bar-baz
```

The collision is silent; the later declaration wins.

CSS custom-property names are case-sensitive and only identical when their code points are identical, so lowercasing is neither necessary nor semantics-preserving. ([W3C](https://www.w3.org/TR/css-variables-1/))

Given the current token-key grammar excludes hyphens, the simple injective mapping is:

```ts
function tokenKeyToCssName(key: TokenKey, prefix?: string): `--${string}` {
  return `--${prefix ? `${prefix}-` : ""}${key.replaceAll(".", "-")}`;
}
```

Preserve casing. Strictly validate the prefix. If a future customizable naming function is added, the exporter must detect collisions and return a `Result`.

`minify` also does not actually minify declarations—it retains spaces around `:` and throughout values. Either implement genuine minification or rename it `compact`.

## 4. Make serialization genuinely canonical

The ADR promises insertion-order-independent snapshots, but the implementation does not provide that guarantee.

Three problems exist:

- Token ordering uses `localeCompare()`. That is locale-sensitive and ultimately driven through `Intl.Collator`; internationalization behavior is not the correct basis for a canonical wire format. ([tc39.es](https://tc39.es/ecma402/))
- `serializeColorValue()` merely spreads the source object, preserving its original property insertion order.
- `provenance` is emitted directly, also preserving caller insertion order.

Semantically identical colors constructed in different property orders currently serialize differently.

Use a code-unit comparator and reconstruct every object variant explicitly:

```ts
const compareStrings = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function canonicalColor(value: ColorValue) {
  switch (value.colorSpace) {
    case "srgb":
      return {
        colorSpace: "srgb" as const,
        r: value.r,
        g: value.g,
        b: value.b,
        alpha: value.alpha,
      };
    // ...
  }
}
```

Do the same for provenance and all future expressions. Add permutation tests for token order, mode order where semantically unordered, color property order, and provenance property order.

## 5. Stop losing color precision during CSS export

All sRGB colors are rounded to 8-bit channels, regardless of whether the source represented continuous sRGB. Display-P3 and OKLCH components are truncated to four decimal places.

For example, `r: 0.5001` becomes `128 / 255`, or approximately `0.50196`.

CSS permits fractional RGB components and the `color(srgb …)` representation specifically supports normalized components. The CSS Color specification explicitly discusses higher-than-eight-bit component precision. ([W3C](https://www.w3.org/TR/css-color-4/)) ([W3C](https://www.w3.org/TR/css-color-4/))

Recommended policy:

- Emit hex only when an opaque sRGB value is genuinely byte-aligned.
- Otherwise emit `color(srgb r g b / alpha)` or fractional modern `rgb()`.
- Use shortest round-trippable numeric serialization or a documented configurable precision.
- Do not silently apply `toFixed(4)`.

## 6. Complete the graph-model blockers before freezing ergonomics

The repository’s own plan correctly identifies the necessary changes:

- references as expressions rather than alias nodes;
- explicit `defaultMode`;
- explicit visibility;
- public/all/include selection.

These are not implemented yet. The current CSS exporter still treats the first mode as default, and color values and alias targets still use separate value models.

There is also an unresolved documentation conflict: the planned model makes source-generated tokens internal and compilation default to public tokens, but the README’s minimal example supplies only a Material source and expects CSS output.

Resolve this explicitly. Sensible options are:

- make the aliases example the actual quick start;
- classify Material semantic roles as public while keeping palette primitives internal;
- or require `selection: "all"` when users intentionally export raw source roles.

Do not let this emerge accidentally from implementation order.

## 7. Compose once, parse once, compile once

The recipe currently:

1. invokes and validates the source graph;
2. converts the validated graph back into authored input;
3. adds layers and aliases;
4. validates everything again;
5. compiles it.

This round-trip causes duplicated parsing, debranding, expression unwrapping, and an “impossible” throw during normalization.

The pipeline should be:

```text
source.build()
  -> append source/layer/manual fragments
  -> parseTokenGraph() once
  -> compile internal validated graph
  -> project outputs
```

`compileValidatedGraph()` should become private. Its declared input already promises the invariants that its error union rechecks. The current public compiler therefore advertises `unknown-token`, `missing-mode-value`, and `alias-cycle` failures that are unreachable under its declared precondition.

Memoize resolution by `[token, mode]`, and report each unique cycle once. The current cycle pass can report a two-node cycle four times for two modes—once from every starting token and mode.

## 8. Prevent aliasing of caller-owned mutable objects

Readonly TypeScript types do not make runtime values immutable.

`parseColorInput()` returns an accepted `ColorValue` object by reference. Graph normalization wraps that same object, and compilation returns it again. Mutating the original input after validation can therefore mutate both the validated graph and compiled token set.

Canonical parsing should create owned values. Clone provenance as well. Freezing is optional, but reference ownership must be unambiguous.

# Deletion and simplification inventory

These should be removed rather than deprecated.

| Delete or replace                                            | Reason                                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `ParseResult`                                                | Duplicate failure model                                                                |
| `TokenKeyInput`, `ModeKeyInput`                              | Aliases of `string` adding no information                                              |
| `TokenKeyProblem`/`KeyParseProblem` pair                     | Pick one function-aligned name                                                         |
| `ModeKeyProblem`/`ModeParseProblem` pair                     | Same                                                                                   |
| `CompileResult`                                              | Alias of `CompileGraphResult`                                                          |
| `ColorSchemeTokenGraph` or `ValidatedColorSchemeTokenGraph`  | Two names for the same type                                                            |
| `ColorSchemeTokenLayer` and `ValidatedColorSchemeTokenLayer` | One aliases input; the other has no validation path                                    |
| `hex()`, `tokenKey()`, `modeKey()`                           | Hidden throwing helpers and port residue                                               |
| Public `compileValidatedGraph()`                             | Validation bypass and impossible public failure states                                 |
| `validateColorTokenValue()` and `ColorTokenValueProblem`     | Unused literal-only scaffold; replace with the real expression model                   |
| `src/core/graphBuilder.ts`                                   | Four-line unused re-export barrel                                                      |
| `src/layers/index.ts`, `src/recipes/index.ts`                | Unused internal barrels with no package subpath                                        |
| Core `lightMode`/`darkMode` defaults                         | Generic core should not silently invent modes; Material can declare them               |
| `ColorSchemeTokenSourceRoleSet` from generic source API      | Material role inventory is adapter metadata, not a requirement for every custom source |

The current layer implementation is especially clear residue: `name` is ignored, no validated layer is ever produced, and `applyLayers()` reconstructs each token field-by-field without changing it. That reconstruction will also silently drop future fields.

Either:

- make layers meaningful fragments with an `id` propagated into declaration origin; or
- remove `name` and rename them from “layers” to “fragments” or “additions,” since duplicate keys are rejected rather than overlaid.

# Material adapter cleanup

The generic `ColorSchemeTokenSource` currently requires every source to expose a role set, although only Material uses it. A custom source should only need an identifier and a build function.

Use:

```ts
export interface TokenSource<P extends Problem> {
  readonly id: string;
  build(): Result<TokenGraphInput, P>;
}
```

Then make `createSchemeTokens()` generic in the source problem:

```ts
function createSchemeTokens<P extends Problem>(
  options: CreateSchemeTokensOptions<P>,
): Result<CreateSchemeTokensValue, P | TokenGraphProblem | CompileProblem>;
```

The current non-generic recipe widens source errors to `kind: string`, undermining discriminated-union narrowing. It also redundantly includes `TokenGraphProblem` twice through `GraphBuildProblem`.

Within Material:

- rename `color` to `sourceColor`;
- narrow its public input type to strings or sRGB values rather than all `ColorValue` variants;
- aggregate independent algorithm, source-color, and key-color problems instead of stopping after the first category;
- introduce an internal validated `OpaqueSrgbColor`;
- delete the second validation pass in `createMaterial3Values()`;
- delete validation of ARGB-derived colors, which are constructed as bounded opaque sRGB values;
- narrow `Material3ValueProblem` to errors that can genuinely occur during generation;
- consolidate the duplicated key-color-name arrays;
- derive variants/spec versions/platforms from const arrays rather than repeating unions and runtime lists;
- move shared adapter types out of the type-only circular dependency between `material3Source.ts` and `createMaterial3Values.ts`;
- wrap upstream generation exceptions into a structured `material3-generation-failed` problem.

The duplicated validation and unreachable problem branches are visible across the normalization and generation stages.

# Public naming and surface

The current type surface is much larger and less consistent than the runtime surface.

Recommended naming:

| Current                          | Recommended                                  |
| -------------------------------- | -------------------------------------------- |
| `SchemeTokensRecipeOptions`      | `CreateSchemeTokensOptions`                  |
| `SchemeTokensRecipeResult`       | `CreateSchemeTokensValue`                    |
| `SchemeTokensRecipeProblem`      | `CreateSchemeTokensProblem`                  |
| `CssVariableOptions`             | `ExportCssVariablesOptions`                  |
| `ColorSchemeTokenLayerInput`     | `TokenFragment` or `TokenLayer`              |
| `ColorSchemeTokenGraphInput`     | `TokenGraphInput`                            |
| `ValidatedColorSchemeTokenGraph` | `TokenGraph`                                 |
| `ColorSchemeTokenSource`         | `TokenSource`                                |
| `ColorSchemeTokenAliases`        | `TokenAliases`                               |
| `parseColorInput`                | `parseColor` or a deliberately narrower name |
| `snapshot`                       | `json` or `serializedTokenSet`               |
| `cssVariables`                   | `css`                                        |

`parseColorInput` currently accepts only six-digit hex strings or normalized objects. Either broaden it to ordinary CSS hex forms—`#RGB`, `#RGBA`, `#RRGGBB`, and `#RRGGBBAA`—or choose a name that communicates its deliberately narrow grammar.

I would keep the root runtime surface approximately to:

```text
createSchemeTokens
createSourceGraph
parseTokenGraph
compileGraph
serializeTokenSet
exportCssVariables
parseColor
parseHexColor
parseTokenKey
parseModeKey
isTokenKey
isModeKey
formatProblems
```

No public validated-compiler bypass, no assertion constructors, and no duplicate aliases.

# Legacy and project-management residue

The package currently publishes the entire `docs` directory.

That would ship:

- a public extraction plan containing local Windows source paths and port history;
- a 791-line internal review;
- a phase execution plan;
- an ADR that deliberately locks the current names despite the new greenfield ergonomics brief.

Move internal planning material outside the package tarball. Retain only concise, current architecture and public usage documents.

Delete `tests/phase0-contract.test.ts`; it tests that planning documents contain prescribed phrases rather than testing package behavior.

Remove legacy negative checks from `smokeConsumer.ts`, including:

- the removed transform hook;
- old `createSourceGraph(source)` signature assertions;
- hidden `hex`, `tokenKey`, `modeKey`, and `literalColor` checks.

The exact public-surface test already prevents accidental runtime exports. There is no benefit in retaining a catalog of APIs that once existed.

Also remove old-port assertions such as “no `material.*` keys” and “no `defaults` property” once the final positive contract tests cover the actual API.

# Tooling and release configuration

The declared Node minimum is `>=18`, but Node 18 reached end of life on March 27, 2025, and Node 20 reached end of life on March 24, 2026. Node 22 and 24 are the current LTS lines. Raise the minimum to Node 22. ([Node.js](https://nodejs.org/en/about/previous-releases))

The smoke script is plain JavaScript stored as `.ts` and executed directly with `node`. Native TypeScript execution only appeared in Node 22.6 and became default later, so this script is incompatible with the declared Node 18 minimum. Rename it `.mjs`, or typecheck it and run it through a deliberate TypeScript runner. ([Node.js](https://nodejs.org/api/typescript.html))

Other tooling changes:

- Remove deprecated `test.server.deps.inline`; Vitest 4 explicitly marks `server` deprecated and recommends relying on automatic handling unless there is a demonstrated exception. ([Vitest](https://vitest.dev/config/server))
- Test whether the remaining optimizer override is still needed.
- Resolve the Material dependency strategy: it is both a runtime dependency and bundled through `noExternal`. Externalize it and retain the exact runtime dependency, or bundle it and move it to development-only dependencies with appropriate license handling. Do not pay for both.
- Remove the duplicate `check` alias.
- Simplify `release:check`; validation builds once, and the packed-consumer smoke packs again through `prepack`.
- Split `tsconfig` into library, tests, and scripts. The library config should use `types: []` so accidental Node-only APIs cannot enter a browser-compatible core.
- Include scripts in typechecking.
- Remove the blanket `ignoreDeprecations: "6.0"` suppression.
- Add package metadata: `repository`, `homepage`, `bugs`, and `publishConfig`.
- Add CI on Node 22 and 24. I found no enforced checks on the audited main snapshot.
- Run `publint`, `@arethetypeswrong/cli`, and the packed consumer against the produced tarball.

Vitest already provides `*.test-d.ts` type tests using `expectTypeOf`; use those for literal-key preservation and source-problem inference. ([Vitest](https://vitest.dev/guide/testing-types.html))

# Implementation order

1. **Supersede the naming ADR and reset contracts.** Introduce one Result shape, one diagnostic base, `unknown` parsing boundaries, canonical ownership, and final v1 schema constants.
2. **Land the graph model.** Expression references, mode records, explicit `defaultMode`, visibility, selection, and token records.
3. **Collapse the pipeline.** Compose authored fragments, parse once, compile internally, infer source-specific problems, memoize resolution.
4. **Correct outputs.** Injective CSS names, precision-preserving colors, canonical serializer, explicit default-mode CSS.
5. **Clean the Material adapter.** Remove generic role-set leakage, duplicate validation, repeated constants, and impossible error branches.
6. **Delete residue and freeze the surface.** Remove aliases, barrels, old tests/docs, reduce root exports, add TSDoc and executable README examples.
7. **Harden release gates.** Runtime fuzz tests, type tests, package linting, packed-consumer tests, and CI.

Do not add v0 readers, deprecated aliases, compatibility wrappers, or migration branches. Regenerate the fixtures directly against the final model.

The release gate should require all of the following:

- every public `parse*` accepts `unknown` and never throws for JSON-compatible input;
- every failure has a non-empty `problems` tuple and a stable `code`;
- no public error union contains unreachable branches;
- equivalent token sets serialize byte-for-byte identically regardless of construction order or locale;
- distinct valid token keys cannot silently produce the same CSS variable;
- CSS color serialization satisfies a documented round-trip tolerance;
- parsed and compiled outputs do not share mutable caller-owned objects;
- every README TypeScript block compiles against the packed package;
- root and subpath runtime and type surfaces are explicitly tested;
- the tarball contains no port plans, local paths, compatibility tests, or internal review documents.

I did not execute the full repository suite because the audit environment could not obtain a checkout. The CSS collision, property-order serialization difference, and sRGB quantization were independently reproduced from the current implementation logic; the remaining findings are source-contract observations from the current repository snapshot.

---

# you asked

message time: 2026-06-19 22:20:07

Good audit. I accept all of it. We must not forget to write this down so we tackle all of this later (soon). Did you catch it all? How does it interop/work together with some third party color converter like https://www.npmjs.com/package/@texel/color
https://github.com/texel-org/color
Let's do another dive on other gaps we have not addressed yet.

---

Claude has this review on your audit report:
"""
I pulled the exact commit the audit references (`8d03d468`, current `main`) and spot-checked its sharper claims against the real source before trusting them. All confirmed: the README really is fixed now (plain strings, no `hex`/`tokenKey`/`lightMode` imports), `ParseResult` is still live in `index.ts` alongside `Result`, `validateGraph.ts` really does call `String()` on unverified input at a dozen+ sites, `minify` really does just strip whitespace while keeping `": "` and `";"`, both `exportCssVariables.ts` and `serializeTokenSet.ts` really do use `localeCompare`, there are zero `*.test-d.ts` files, `tests/phase0-contract.test.ts` and the legacy negative checks in `smokeConsumer.ts` are still there, and there's no `.github` directory at all. The audit is accurate. Given that, here's what it didn't catch:

**The type-level export surface has no lock-down, only the runtime one does.** `public-api.test.ts` snapshots `Object.keys(api)` — but `export type` declarations are erased at compile time and never appear in `Object.keys()`. Nothing currently fails the build if someone accidentally exports an internal type, forgets to export a type a consumer needs, or — under the audit's own rename table — leaves a stray `SchemeTokensRecipeProblem` re-export behind after renaming it. The audit spends a whole section pinning runtime exports and another renaming ~10 type names, but proposes no equivalent guard for the thing it's actively churning. Worth adding a `.d.ts`-level snapshot (Microsoft's API Extractor, or even a cheap script that diffs `tsc --declaration`'s emitted symbol list against an approved list) alongside the existing runtime test.

**The audit's own recommended surface invents a function it never specifies.** Its final root-export list includes `formatProblems`, but the word appears nowhere else in the document — no signature, no input type (`Problem`? `readonly Problem[]`? the whole `Result`?), no return type. That's exactly the "don't let this emerge accidentally from implementation order" failure mode the audit calls out in section 6, just committed inside the audit itself.

**`exportCssVariables` is the one pipeline function that still breaks the Result discipline the audit is trying to make canonical — and it's unvalidated.** Every other public entry point (`compileGraph`, `createSchemeTokens`, the proposed `parseTokenGraph`) returns `Result` and never throws. `exportCssVariables` returns a bare `string`, can't report a problem, and never validates its own `selector`, `prefix`, or `modeSelectors` option strings — they go straight into the generated CSS text (`${selector} {`, `${selector}[data-color-scheme="${mode}"]`). That's not just inconsistent with the rest of the contract; it means a bad or attacker-influenced `selector`/`prefix` (e.g. from app config sourced somewhere less trusted) produces silently malformed or injected CSS text with no error path at all, in a library whose entire stated value proposition is deterministic, validated output.

**Property-based testing is recommended for exactly one boundary, not for the invariants the audit just established two sections later.** It proposes `fc.assert` for `parseTokenGraph(unknown)` not throwing — good — but the CSS-name-collision fix and the canonical-serializer fix that follow are exactly the kind of thing a property test should pin going forward: _"for any two distinct valid token keys generated from the key grammar, their CSS variable names are never equal"_ and _"for any token set, every permutation of construction order serializes byte-identically."_ Otherwise the fix is correct today and silently regressable tomorrow — the same class of bug, unguarded.

**Unaddressed license obligation on the bundled dependency.** I checked: `@material/material-color-utilities` is Apache-2.0 (confirmed via the npm registry), `tsup.config.ts` sets `noExternal: ["@material/material-color-utilities"]` so it's compiled directly into the published `dist/` output, the package itself declares `"license": "MIT"`, and there is no NOTICE or third-party-attribution file anywhere in the repo — only the single MIT `LICENSE`. The audit mentions the dependency-bundling _strategy_ in passing but never flags that redistributing Apache-2.0 source inside an MIT-licensed bundle without attribution is a real compliance gap, not a style choice. I'm not a lawyer and this isn't legal advice, but it's the kind of thing that blocks enterprise legal/license-scanner review after the fact rather than before — worth a deliberate decision (externalize the dependency, or bundle it with a proper NOTICE file) before the "release gate" the audit defines, not after.

**No semver/contract-stability policy for the period right after first publish.** The audit is extremely deliberate about what v1 _is_; it says nothing about what counts as a breaking change once `0.1.0`/`1.0.0` ships against structurally-typed Result/Problem unions — e.g., is adding a new `code` literal to an existing union breaking for a consumer with an exhaustive `switch`? Is widening `Problem` with an optional field breaking? Given their own roadmap explicitly plans more phases (expressions, DTCG, color algebra) right after the release this audit gates, that ambiguity will resurface almost immediately. Worth a short ADR stating the rule before the first tag, not after the first consumer complaint.

If it's useful, I can draft any one of these now — the type-export lock script is the smallest and would close the sharpest gap.
"""

---

# chatgpt response

I’ll turn the accepted audit into a durable action record, verify `@texel/color`’s API/licensing, and run a second pass for remaining boundary and integration gaps.

---

# chatgpt response

The converter looks useful for internal numeric conversion and gamut mapping, but I’m separating that from public types, parsing, and the core graph model.

---

# chatgpt response

I’ve confirmed Claude’s additions and found further release blockers: gamut semantics, forged validated values, provenance validation, public serializer leakage, throwing constructors, and unconditional recipe exporter coupling.

---

# chatgpt response

## Recorded

I created **GitHub issue #1: “Pre-publication hardening: v1 API, color engine, determinism, packaging, and residue removal.”** It contains the original audit, Claude’s additions, the second color-model dive, the `@texel/color` integration boundary, deletion inventory, testing requirements, and a first-publication release gate.

I would not claim that any static audit has found literally every future issue. What we now have is broad coverage of the consequential risk classes:

- runtime and type-level API design;
- graph semantics and compiler behavior;
- parsing, ownership, and diagnostics;
- color science and gamut policy;
- CSS and serialization correctness;
- dependency isolation and licensing;
- package publication and semver policy;
- performance, fuzzing, and property-based invariants;
- removal of port residue and compatibility-oriented code.

The tracker should be treated as a living release checklist: newly discovered issues go into it rather than into another disconnected review document.

## Claude’s review

All six additions are valid, with one nuance.

**Type-export locking:** confirmed. `Object.keys(api)` only protects runtime bindings and cannot observe the large erased type surface exported by `src/index.ts`. The tracker now requires a declaration-level API approval gate against the packed package.

**`formatProblems`:** Claude is right. I introduced a name without designing it. It has been removed from the proposed surface. It should remain absent unless a concrete contract and use case justify it.

**`exportCssVariables()` and Result discipline:** the current exporter accepts raw selectors, prefixes, and selector maps, then interpolates them directly into CSS. The nuance is that not every pure projection must return `Result`. There are two coherent designs:

```ts
// Already parsed options; exporter is total.
exportCssVariables(
  tokenSet: CompiledTokenSet,
  options: ValidatedCssExportOptions,
): string;

// Raw public options; exporter validates.
exportCssVariables(
  tokenSet: CompiledTokenSet,
  options?: CssExportOptions,
): Result<string, CssExportProblem>;
```

What is unacceptable is the current third state: raw unchecked strings plus a bare return value.

**Property testing:** expanded. The tracker now covers graph no-throw fuzzing, CSS-name injectivity, serializer permutation invariance, locale independence, conversion identities and tolerances, gamut postconditions, mutation isolation, deep graph chains, and deterministic cycle reporting.

**License obligations:** added as a release blocker. The Material utility is currently bundled via `noExternal`, while the dependency is Apache-2.0. ([GitHub](https://raw.githubusercontent.com/material-foundation/material-color-utilities/main/LICENSE)) `@texel/color` is MIT-licensed, whose license requires retaining its copyright and permission notice in copies or substantial portions. ([GitHub](https://github.com/texel-org/color/blob/main/LICENSE.md)) Externalizing normal dependencies is the cleaner default; bundled dependencies need a deliberate `THIRD_PARTY_NOTICES` and license-distribution policy.

**Semver policy:** added. Diagnostic-code unions, color-space unions, generated output, serializer bytes, algorithm changes, and Node support all need explicit stability rules before the first tag.

# `@texel/color`: recommended relationship

## Verdict

`@texel/color` is a strong candidate for the **private numerical engine** underneath the library.

It should **not** become:

- the public `ColorValue` model;
- the public parser;
- the CSS serializer;
- a source of public exported types;
- a configurable user-supplied engine;
- an implicit gamut-mapping policy.

The current repository reports version `1.1.11`, ESM, MIT licensing, generated declarations, and no runtime dependencies. ([GitHub](https://github.com/texel-org/color/blob/main/package.json)) It supports the spaces relevant to this project—sRGB, Display-P3, OKLab/OKLCH, XYZ D50/D65, Rec.2020, A98 RGB, and ProPhoto RGB—and explicitly separates ordinary conversion from gamut mapping. ([GitHub](https://github.com/texel-org/color)) ([GitHub](https://github.com/texel-org/color))

That separation is precisely what our model needs.

## Intended pipeline

```text
unknown authored color
  │
  ▼
our parseColor()
  - syntax and structure validation
  - canonicalization
  - owned immutable-by-convention ColorValue
  │
  ▼
our convertColor()
  │
  └── private @texel/color adapter
        - object ↔ coordinate tuple
        - fixed known space mapping
        - fresh output allocation
        - alpha carried separately
        - finite-result assertion
  │
  ▼
ColorValue in target space
  - may legitimately be out of target gamut
  │
  ├── isColorInGamut()
  │
  └── mapColorToGamut() when explicitly requested
  │
  ▼
graph/compiler/exporter or Material adapter
```

The public conceptual API should remain ours:

```ts
convertColor(color, targetSpace); // Conversion only. No clipping.
isColorInGamut(color, targetGamut);
mapColorToGamut(color, targetGamut, {
  method: "preserve-lightness",
});
```

`@texel/color` documents that ordinary conversion may produce RGB components outside `0…1`, while gamut mapping is a separate operation. ([GitHub](https://github.com/texel-org/color)) That matches CSS Color’s distinction: a color can be valid while outside a device’s gamut and only needs mapping when projected to that device. ([W3C](https://www.w3.org/TR/css-color-4/))

That observation exposed one of the most important missed gaps in the current model: `validateColorValue()` presently rejects any sRGB or Display-P3 coordinate outside `0…1`, so it cannot represent valid finite out-of-gamut conversion results.

## Private adapter shape

Conceptually:

```ts
import { convert, DisplayP3, OKLCH, sRGB, type ColorSpace } from "@texel/color";

const TEXEL_SPACE_BY_ID = {
  srgb: sRGB,
  "display-p3": DisplayP3,
  oklch: OKLCH,
} as const satisfies Record<SupportedColorSpace, ColorSpace>;

function convertColorInternal(color: ColorValue, target: SupportedColorSpace): ColorValue {
  const input = toCoordinates(color);
  const output = convert(
    input,
    TEXEL_SPACE_BY_ID[color.colorSpace],
    TEXEL_SPACE_BY_ID[target],
    [0, 0, 0],
  );

  assertFiniteCoordinates(output);
  return fromCoordinates(target, output, color.alpha);
}
```

Important boundary rules:

1. Always pass a fresh output array and copy the result into our own object.
2. Never retain arrays received from the dependency.
3. Preserve alpha separately; conversion is over the three color coordinates.
4. Maintain an exhaustive map from our closed color-space union to selected Texel constants.
5. Catch dependency throws only at the adapter boundary. For known validated spaces, a throw indicates an internal invariant/dependency failure, not bad user input.
6. Exact-pin the dependency because matrix, adaptation, and gamut-algorithm changes affect deterministic output.
7. Ensure generated declarations contain no `@texel/color` names.

## What not to use from Texel

### Do not use its CSS parser as our boundary

Texel itself says its deserializer is intentionally limited and that complex CSS parsing is outside scope; parsing remains a work in progress. ([GitHub](https://github.com/texel-org/color))

Our parser should therefore continue to own:

- accepted syntax;
- error codes and paths;
- canonicalization;
- no-throw behavior;
- source ownership;
- future support for CSS missing components or additional forms.

Texel can receive already validated numerical coordinates.

### Do not use its serializer for canonical output

Texel deliberately emits byte-based legacy `rgb()` output for sRGB. ([GitHub](https://github.com/texel-org/color)) That reintroduces the exact precision loss found in our current formatter.

Our serializer must independently decide:

- when hex is lossless;
- when `color(srgb …)` or modern `rgb()` is needed;
- canonical number precision;
- handling of alpha;
- property ordering and whitespace.

### Do not expose Texel’s types

Texel is optimized around mutable coordinate arrays and optionally supplied output buffers. Its README expressly describes caller-provided output arrays. ([GitHub](https://github.com/texel-org/color)) That is excellent for an internal hot-path engine but is not the ergonomic, ownership-safe public contract wanted here.

# Further gaps found in the second dive

## 1. Valid color and in-gamut color are currently conflated

This is the largest new finding.

A finite Display-P3 or sRGB tuple outside `0…1` can be a valid colorimetric conversion result. It is merely out of that RGB gamut. CSS Color explicitly makes this distinction. ([W3C](https://www.w3.org/TR/css-color-4/))

The model needs:

```ts
parseColor(); // finite, structurally valid color
isColorInGamut(); // target-specific predicate
mapColorToGamut(); // explicit lossy operation
```

Parsing must not silently clip or map.

## 2. The “internal snapshot” is already a public format

`serializeTokenSet()` is exported from the package root, and `createSchemeTokens()` always returns its output as `snapshot`.

Regardless of what the ADR calls it, consumers can depend on it. The project must either:

- formally version and support it as a public wire format; or
- remove it from the root and recipe result, retaining it only in test infrastructure.

There is no stable middle ground.

## 3. The recipe eagerly performs every projection

`createSchemeTokens()` always generates CSS and JSON, even when no CSS options were supplied and the caller only wants the graph or compiled set.

This causes unnecessary work and couples the high-level recipe to every exporter. The cleaner design is either:

```ts
const compiled = createSchemeTokens(options);
const css = exportCssVariables(compiled.value);
```

or an explicit projection request:

```ts
createSchemeTokens({
  ...options,
  outputs: ["css"],
});
```

The first is simpler unless the recipe’s core value proposition is specifically one-call artifact generation.

## 4. `srgb255()` violates the current public discipline

`srgb255()` is exported from the root but throws for invalid channels.

It is also asymmetrical: there are no equivalent ergonomic P3 or OKLCH constructors. It should be removed from the root or replaced by a coherent fallible constructor family.

## 5. Provenance and source options remain caller-owned

Validated graph construction passes provenance through rather than parsing and copying it. `material3Source(options)` also closes over the supplied options and reads them later when `createGraph()` executes.

A caller can mutate configuration after source construction and alter later output. Provenance can also contain hostile or cyclic runtime data despite its TypeScript type. Both need owned canonical copies.

## 6. Key and mode grammars may be port policy rather than domain policy

Token keys require at least two segments, while modes reject hyphenated identifiers.

That means:

- `primary` is invalid as a token;
- `high-contrast` is invalid as a mode;
- camelCase is allowed, contributing to CSS-name collision pressure.

Those may be valid decisions, but they have not yet been justified as user-facing domain rules. Grammar and CSS encoding must be designed together.

## 7. Canonical ordering is underspecified beyond serialization

The compiled set can preserve authored order or exact `include` order, while exporters sort independently. That creates multiple observable orders for the same logical token set. The contract needs to choose:

- canonical key order everywhere;
- declaration order;
- or include-request order for explicit selection.

## 8. Source adapters are an uncontained execution boundary

A custom source can throw or return a malformed Result/graph despite satisfying its TypeScript declaration. `createSourceGraph()` currently invokes it directly.

The source boundary needs a clear policy for:

- exceptions;
- malformed result objects;
- duplicate or invalid source IDs;
- deterministic source diagnostics.

## 9. Deep reference graphs pose complexity and stack risks

Validation performs cycle walks from each token for each mode, and compilation recursively resolves references without memoization.

Long graphs can become quadratic, duplicate diagnostics, or overflow the call stack. The final resolver should be iterative or topological, memoized by token and mode, and covered by generated stress tests.

## 10. CSS selector configuration needs a model, not just sanitization

Validating an arbitrary CSS selector string correctly is nontrivial. Rather than pretending a regex is enough, provide structured safe strategies:

```ts
{ strategy: "data-attribute", attribute: "data-color-scheme" }
{ strategy: "class", prefix: "theme" }
{ strategy: "media", feature: "prefers-color-scheme" }
```

An explicitly named raw-selector escape hatch can exist later. The exporter must also catch two modes resolving to the same selector, which can silently turn output ordering into cascade behavior.

# Recommended dependency decision

Adopt this policy:

```text
@texel/color
  exact-pinned runtime dependency
  externalized in package output
  imported only by a private adapter
  used for conversion and explicit gamut mapping
  never used for parsing or canonical CSS serialization
  never visible in public declarations
```

For the Material adapter:

```text
our ColorValue
  -> convert to sRGB
  -> check sRGB gamut
  -> reject or explicitly gamut-map
  -> require opaque alpha
  -> quantize to 8-bit ARGB
  -> Material color utilities
```

The ARGB conversion is intentionally lossy and should be documented as an adapter boundary rather than hidden as generic color normalization.

## Implementation order

1. Settle the Result, diagnostic, semver, serializer, and exporter ADRs.
2. Correct the color model—especially finite versus in-gamut—before adding Texel.
3. Land the expression/default-mode/visibility graph rewrite and one-pass compiler.
4. Add the private Texel adapter with conversion and gamut property tests.
5. Correct CSS and serializer outputs.
6. Delete residue and lock runtime plus declaration surfaces.
7. Finish packaging, license attribution, CI, and packed-artifact release checks.

That order prevents a third-party converter from accidentally dictating the public model while still allowing it to provide the difficult numerical machinery.

---

# you asked

message time: 2026-06-19 22:49:32

Good. But is our library, still fully valid without any of those third-party plugins? How will it work exactly? We must get this detailed. And I want to see real and alot of code snippets that show usage of the intended api.

---

# chatgpt response

I’ll turn this into a concrete target contract: dependency-free core behavior, optional capability boundaries, package layout, and end-to-end usage examples.

---

# chatgpt response

I’ll make the “no plugins” cases explicit, then distinguish representation/export from numerical transformation so optional color math cannot leak into the core API.

---

# chatgpt response

# Yes—the core must stand on its own

`color-scheme-tokens` should be a complete color-token graph compiler without Material 3, `@texel/color`, or any other extension.

Those modules add **capabilities**, not validity:

| Capability                  | Root only | `/conversion` | `/sources/material3` |
| --------------------------- | --------: | ------------: | -------------------: |
| Author literal colors       |       Yes |           Yes |                  Yes |
| Modes and references        |       Yes |           Yes |                  Yes |
| Validation and compilation  |       Yes |           Yes |                  Yes |
| CSS and deterministic JSON  |       Yes |           Yes |                  Yes |
| Custom application source   |       Yes |           Yes |                  Yes |
| Cross-space conversion      |        No |           Yes |         Optional use |
| Gamut detection and mapping |        No |           Yes |         Optional use |
| Material palette generation |        No |            No |                  Yes |

Without conversion, the root can preserve and export sRGB, Display-P3, and OKLCH values exactly as authored. It simply cannot manufacture an sRGB equivalent, generate an sRGB fallback, or perform a lossy gamut mapping. That absence does not make the graph incomplete.

I recorded this contract and the API examples in issue #1.

The examples below describe the **intended API**, not the currently implemented `main` branch.

---

# 1. The conceptual architecture

There should be no global plugin registry:

```ts
registerPlugin(...)
registerColorEngine(...)
use(materialPlugin)
```

None of that is necessary.

The architecture is explicit imports and ordinary values:

```text
color-scheme-tokens
  ├─ parse colors and graphs
  ├─ resolve references
  ├─ apply modes and visibility
  ├─ compile concrete token sets
  └─ export CSS and JSON

color-scheme-tokens/conversion
  ├─ convertColor()
  ├─ isColorInGamut()
  └─ mapColorToGamut()
       └─ private @texel/color implementation

color-scheme-tokens/sources/material3
  └─ material3Source()
       └─ private Material utilities implementation
```

A source adapter is just an object passed to a function. It is not registered globally:

```ts
const result = createSchemeTokens({
  source: mySource,
  fragments: [applicationTokens],
});
```

This is important for determinism, test isolation, tree shaking, and developer comprehension.

---

# 2. Proposed core public model

## Results and diagnostics

```ts
export interface Problem<Code extends string = string> {
  readonly code: Code;
  readonly message: string;
  readonly path?: string;
}

export type NonEmptyProblems<P> = readonly [P, ...P[]];

export type Result<Value, P extends Problem> =
  | {
      readonly ok: true;
      readonly value: Value;
    }
  | {
      readonly ok: false;
      readonly problems: NonEmptyProblems<P>;
    };
```

No `{ problem }` singular variant. No empty error arrays. No mixture of `kind` and `code` for errors.

## Color values

```ts
export interface SrgbColor {
  readonly colorSpace: "srgb";
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}

export interface DisplayP3Color {
  readonly colorSpace: "display-p3";
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}

export interface OklchColor {
  readonly colorSpace: "oklch";
  readonly l: number;
  readonly c: number;
  readonly h: number;
  readonly alpha: number;
}

export type ColorValue = SrgbColor | DisplayP3Color | OklchColor;

export type ColorInput =
  | string
  | {
      readonly colorSpace: "srgb";
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly alpha?: number;
    }
  | {
      readonly colorSpace: "display-p3";
      readonly r: number;
      readonly g: number;
      readonly b: number;
      readonly alpha?: number;
    }
  | {
      readonly colorSpace: "oklch";
      readonly l: number;
      readonly c: number;
      readonly h: number;
      readonly alpha?: number;
    };
```

Input objects may omit alpha; canonical parsed values always contain it.

## Expressions and mode values

```ts
export interface ReferenceInput<Key extends string = string> {
  readonly kind: "reference";
  readonly key: Key;
}

export interface ByModeInput<Value> {
  readonly kind: "by-mode";
  readonly values: Readonly<Record<string, Value>>;
}

export type ColorExpressionInput = ColorInput | ReferenceInput;

export type TokenValueInput = ColorExpressionInput | ByModeInput<ColorExpressionInput>;

export interface TokenDefinitionInput {
  readonly value: TokenValueInput;
  readonly visibility: "public" | "internal";
  readonly description?: string;
}
```

The helper functions are non-throwing definition helpers:

```ts
ref("brand.primary");
// { kind: "reference", key: "brand.primary" }

byMode({
  light: "#ffffff",
  dark: "#000000",
});
// { kind: "by-mode", values: { ... } }

publicToken("#ffffff");
// { value: "#ffffff", visibility: "public" }

internalToken(ref("source.primary"));
// { value: { kind: "reference", ... }, visibility: "internal" }
```

They do not validate unknown runtime input. `compileGraph()` and `parseTokenGraph()` remain the runtime boundaries.

---

# 3. Core-only: the smallest valid library usage

No source adapter. No converter. No Material dependency in the import graph.

```ts
import {
  compileGraph,
  defineTokenGraph,
  exportCssVariables,
  publicToken,
} from "color-scheme-tokens";

const graph = defineTokenGraph({
  modes: ["base"],
  defaultMode: "base",

  tokens: {
    "app.background": publicToken("#ffffff"),
    "app.foreground": publicToken("#111111"),
    "app.accent": publicToken("#6750a4"),
  },
});

const compiled = compileGraph(graph);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.problems, null, 2));
}

const css = exportCssVariables(compiled.value, {
  prefix: "theme",
});

if (!css.ok) {
  throw new Error(JSON.stringify(css.problems, null, 2));
}

console.log(css.value);
```

Expected output:

```css
:root {
  --theme-app-accent: #6750a4;
  --theme-app-background: #ffffff;
  --theme-app-foreground: #111111;
}
```

This is already a useful library: users can own all their token values and use the package for validation, references, deterministic ordering, visibility, and output.

---

# 4. Core-only modes and references

```ts
import {
  byMode,
  compileGraph,
  defineTokenGraph,
  exportCssVariables,
  internalToken,
  publicToken,
  ref,
} from "color-scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",

  tokens: {
    "brand.primary": internalToken(
      byMode({
        light: "#6750a4",
        dark: "#d0bcff",
      }),
    ),

    "brand.onPrimary": internalToken(
      byMode({
        light: "#ffffff",
        dark: "#381e72",
      }),
    ),

    "app.action": publicToken(ref("brand.primary")),

    "app.actionText": publicToken(ref("brand.onPrimary")),

    "app.canvas": publicToken(
      byMode({
        light: "#fffbfe",
        dark: "#1c1b1f",
      }),
    ),
  },
});

const compiled = compileGraph(graph);

if (!compiled.ok) {
  console.error(compiled.problems);
  process.exitCode = 1;
} else {
  const css = exportCssVariables(compiled.value, {
    prefix: "theme",
    modes: {
      strategy: "data-attribute",
      attribute: "data-color-scheme",
    },
  });

  if (!css.ok) {
    console.error(css.problems);
  } else {
    console.log(css.value);
  }
}
```

Expected output:

```css
:root {
  --theme-app-action: #6750a4;
  --theme-app-action-text: #ffffff;
  --theme-app-canvas: #fffbfe;
}

:root[data-color-scheme="dark"] {
  --theme-app-action: #d0bcff;
  --theme-app-action-text: #381e72;
  --theme-app-canvas: #1c1b1f;
}
```

The `brand.*` tokens are internal. They participate in resolution but do not appear in the public selection.

No conversion took place. A reference merely resolves to the literal value defined by its target.

---

# 5. Mode-specific references

A token can reference different tokens in different modes:

```ts
const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",

  tokens: {
    "brand.primary": internalToken("#6750a4"),
    "brand.primaryBright": internalToken("#d0bcff"),

    "app.action": publicToken(
      byMode({
        light: ref("brand.primary"),
        dark: ref("brand.primaryBright"),
      }),
    ),
  },
});
```

Internally, both literal and reference values use the same expression path. There is no separate alias-node subsystem.

---

# 6. Display-P3 and OKLCH without a converter

The root can preserve colors without converting them.

```ts
import {
  compileGraph,
  defineTokenGraph,
  exportCssVariables,
  publicToken,
} from "color-scheme-tokens";

const graph = defineTokenGraph({
  modes: ["base"],
  defaultMode: "base",

  tokens: {
    "brand.p3Orange": publicToken({
      colorSpace: "display-p3",
      r: 0.94,
      g: 0.28,
      b: 0.08,
      alpha: 1,
    }),

    "brand.oklchBlue": publicToken({
      colorSpace: "oklch",
      l: 0.62,
      c: 0.18,
      h: 255,
      alpha: 1,
    }),
  },
});

const compiled = compileGraph(graph);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.problems));
}

const css = exportCssVariables(compiled.value, {
  prefix: "theme",
});

if (!css.ok) {
  throw new Error(JSON.stringify(css.problems));
}

console.log(css.value);
```

Expected output:

```css
:root {
  --theme-brand-oklch-blue: oklch(62% 0.18 255);
  --theme-brand-p3-orange: color(display-p3 0.94 0.28 0.08);
}
```

No conversion is required because CSS can represent both values directly. The existing implementation already recognizes sRGB, Display-P3, and OKLCH as output forms, although its current numeric precision policy needs replacement.

What root-only mode **cannot** do is synthesize this automatically:

```css
--brand-orange: #ed4b20; /* generated fallback */
--brand-orange: color(display-p3 0.94 0.28 0.08);
```

Generating the fallback requires conversion and an explicit gamut policy.

---

# 7. Different color spaces in different modes

This remains valid:

```ts
const graph = defineTokenGraph({
  modes: ["standard", "vivid"],
  defaultMode: "standard",

  tokens: {
    "app.accent": publicToken(
      byMode({
        standard: "#6750a4",

        vivid: {
          colorSpace: "display-p3",
          r: 0.78,
          g: 0.2,
          b: 0.92,
          alpha: 1,
        },
      }),
    ),
  },
});
```

The compiler’s job is to produce a concrete color for every selected token and mode. It does not require those concrete colors to share a color space.

---

# 8. Parsing untrusted JSON

`defineTokenGraph()` is for typed source-code authoring. It preserves literal types and adds the schema version.

`parseTokenGraph()` is for JSON, configuration files, network input, or JavaScript values of unknown shape:

```ts
import { compileGraph, parseTokenGraph } from "color-scheme-tokens";

const response = await fetch("/theme.tokens.json");
const input: unknown = await response.json();

const parsed = parseTokenGraph(input);

if (!parsed.ok) {
  for (const problem of parsed.problems) {
    console.error(
      problem.path === undefined
        ? `${problem.code}: ${problem.message}`
        : `${problem.path}: ${problem.code}: ${problem.message}`,
    );
  }

  throw new Error("Invalid token graph");
}

const compiled = compileGraph(parsed.value);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.problems, null, 2));
}
```

A raw JSON file would include the schema version explicitly:

```json
{
  "schemaVersion": "color-token-graph/v1",
  "modes": ["light", "dark"],
  "defaultMode": "light",
  "tokens": {
    "app.background": {
      "visibility": "public",
      "value": {
        "kind": "by-mode",
        "values": {
          "light": "#ffffff",
          "dark": "#111111"
        }
      }
    }
  }
}
```

The parser creates owned canonical values. Mutating `input` afterwards must not change `parsed.value` or a compiled token set.

---

# 9. Explicit visibility and selection

The default selection should be public tokens:

```ts
const compiled = compileGraph(graph);
// Equivalent to:
const compiledExplicitly = compileGraph(graph, {
  selection: "public",
});
```

Compile everything:

```ts
const compiled = compileGraph(graph, {
  selection: "all",
});
```

Compile an exact subset:

```ts
const compiled = compileGraph(graph, {
  selection: {
    include: ["app.action", "app.actionText", "app.canvas"],
  },
});
```

The included token names select output tokens. Internal dependencies still resolve transitively:

```ts
const graph = defineTokenGraph({
  modes: ["base"],
  defaultMode: "base",

  tokens: {
    "source.rawBlue": internalToken("#1455d9"),
    "brand.primary": internalToken(ref("source.rawBlue")),
    "app.action": publicToken(ref("brand.primary")),
  },
});

const result = compileGraph(graph, {
  selection: {
    include: ["app.action"],
  },
});
```

The compiled set contains only `app.action`, but it resolves through both internal dependencies.

---

# 10. Inspecting the compiled set

The compiled representation should be easy to consume without repeated `.find()` calls:

```ts
const result = compileGraph(graph);

if (result.ok) {
  const action = result.value.tokens["app.action"];

  console.log(action.values.light);
  console.log(action.values.dark);
}
```

A proposed shape:

```ts
export interface CompiledTokenSet {
  readonly schemaVersion: "compiled-color-token-set/v1";
  readonly modes: readonly string[];
  readonly defaultMode: string;

  readonly tokens: Readonly<
    Record<
      string,
      {
        readonly values: Readonly<Record<string, ColorValue>>;
        readonly description?: string;
        readonly origin?: TokenOrigin;
      }
    >
  >;
}
```

Using a record avoids duplicating each token key inside its own value and gives consumers direct lookup.

Canonical serialization can still sort the record keys independently of JavaScript insertion order.

---

# 11. Deterministic JSON as an explicit exporter

The internal snapshot ambiguity should be removed. Public JSON export should have an exporter-oriented name:

```ts
import { compileGraph, exportTokenSetJson } from "color-scheme-tokens";

const compiled = compileGraph(graph);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.problems));
}

const compactJson = exportTokenSetJson(compiled.value, {
  indent: 0,
});

const readableJson = exportTokenSetJson(compiled.value, {
  indent: 2,
});
```

Example output:

```json
{
  "schemaVersion": "compiled-color-token-set/v1",
  "modes": ["light", "dark"],
  "defaultMode": "light",
  "tokens": {
    "app.action": {
      "values": {
        "light": {
          "colorSpace": "srgb",
          "r": 0.396078431372549,
          "g": 0.3137254901960784,
          "b": 0.6431372549019608,
          "alpha": 1
        },
        "dark": {
          "colorSpace": "srgb",
          "r": 0.8156862745098039,
          "g": 0.7372549019607844,
          "b": 1,
          "alpha": 1
        }
      }
    }
  }
}
```

`serializeTokenSet()` should then either become private or be replaced by this explicitly supported public format.

---

# 12. A reusable application fragment

Fragments add token definitions to a source-owned graph:

```ts
import { defineTokenFragment, publicToken, ref } from "color-scheme-tokens";

export const applicationTokens = defineTokenFragment({
  id: "application-semantics",

  tokens: {
    "app.canvas": publicToken(ref("source.surface"), {
      description: "Default application canvas",
    }),

    "app.text": publicToken(ref("source.onSurface")),

    "app.action": publicToken(ref("source.primary")),

    "app.actionText": publicToken(ref("source.onPrimary")),
  },
});
```

A more exact helper signature might be:

```ts
publicToken(value, {
  description: "Default application canvas",
});
```

rather than embedding visibility manually in every definition.

---

# 13. Custom source with no third-party code

A consumer can implement a source using only the root package.

```ts
import {
  byMode,
  defineTokenGraph,
  internalToken,
  type Problem,
  type Result,
  type TokenSource,
} from "color-scheme-tokens";

interface CompanySourceProblem extends Problem<"missing-company-primary"> {}

interface CompanySourceOptions {
  readonly primary?: string;
}

export function companySource(options: CompanySourceOptions): TokenSource<CompanySourceProblem> {
  return {
    id: "company",

    build(): Result<ReturnType<typeof defineTokenGraph>, CompanySourceProblem> {
      if (options.primary === undefined) {
        return {
          ok: false,
          problems: [
            {
              code: "missing-company-primary",
              message: "A company primary color is required.",
              path: "/primary",
            },
          ],
        };
      }

      return {
        ok: true,
        value: defineTokenGraph({
          modes: ["light", "dark"],
          defaultMode: "light",

          tokens: {
            "company.primary": internalToken(
              byMode({
                light: options.primary,
                dark: "#b5c4ff",
              }),
            ),

            "company.surface": internalToken(
              byMode({
                light: "#ffffff",
                dark: "#111318",
              }),
            ),
          },
        }),
      };
    },
  };
}
```

Use it like any built-in source:

```ts
import { createSchemeTokens, defineTokenFragment, publicToken, ref } from "color-scheme-tokens";

const application = defineTokenFragment({
  id: "app",

  tokens: {
    "app.action": publicToken(ref("company.primary")),
    "app.canvas": publicToken(ref("company.surface")),
  },
});

const result = createSchemeTokens({
  source: companySource({
    primary: "#1455d9",
  }),

  fragments: [application],
  selection: "public",
});

if (!result.ok) {
  throw new Error(JSON.stringify(result.problems, null, 2));
}

console.log(result.value.graph);
console.log(result.value.tokenSet);
```

No third-party color library or Material implementation participates.

---

# 14. High-level recipe without eager exporters

`createSchemeTokens()` should orchestrate graph construction and compilation, but should not always generate every artifact.

```ts
const result = createSchemeTokens({
  source,
  fragments: [application],
  selection: "public",
});

if (!result.ok) {
  throw new Error(JSON.stringify(result.problems));
}

const { graph, tokenSet } = result.value;
```

Then exporters are explicit:

```ts
const css = exportCssVariables(tokenSet, {
  prefix: "theme",
});

const json = exportTokenSetJson(tokenSet, {
  indent: 2,
});
```

This avoids computing CSS when a caller only needs JSON, or serializing JSON when a caller only needs an in-memory token set.

---

# 15. Material 3 is an optional source

```ts
import {
  createSchemeTokens,
  defineTokenFragment,
  exportCssVariables,
  publicToken,
  ref,
} from "color-scheme-tokens";

import { material3Source } from "color-scheme-tokens/sources/material3";

const application = defineTokenFragment({
  id: "application-semantics",

  tokens: {
    "app.canvas": publicToken(ref("m3.surface")),
    "app.text": publicToken(ref("m3.onSurface")),
    "app.action": publicToken(ref("m3.primary")),
    "app.actionText": publicToken(ref("m3.onPrimary")),
    "app.error": publicToken(ref("m3.error")),
  },
});

const result = createSchemeTokens({
  source: material3Source({
    sourceColor: "#6750a4",

    algorithm: {
      variant: "tonalSpot",
      contrastLevel: 0,
      specVersion: "2021",
      platform: "phone",
    },
  }),

  fragments: [application],
  selection: "public",
});

if (!result.ok) {
  throw new Error(JSON.stringify(result.problems, null, 2));
}

const css = exportCssVariables(result.value.tokenSet, {
  prefix: "theme",

  modes: {
    strategy: "data-attribute",
    attribute: "data-color-scheme",
  },
});

if (!css.ok) {
  throw new Error(JSON.stringify(css.problems, null, 2));
}
```

The source adapter generates internal `m3.*` tokens. The application fragment defines the public contract.

## Intentionally exporting raw Material roles

```ts
const result = createSchemeTokens({
  source: material3Source({
    sourceColor: "#6750a4",
  }),

  selection: "all",
});
```

That choice is explicit. The normal default remains application-owned public tokens.

---

# 16. Conversion is an optional module, not a plugin

`@texel/color` fits behind a private adapter because it treats conversion and gamut mapping as separate operations, permits out-of-gamut converted coordinates, and supports caller-provided output arrays. ([GitHub](https://github.com/texel-org/color))

The public API remains ours:

```ts
import { parseColor } from "color-scheme-tokens";

import { convertColor, isColorInGamut, mapColorToGamut } from "color-scheme-tokens/conversion";

const parsed = parseColor({
  colorSpace: "display-p3",
  r: 1,
  g: 0.22,
  b: 0.08,
  alpha: 1,
});

if (!parsed.ok) {
  throw new Error(JSON.stringify(parsed.problems));
}

const converted = convertColor(parsed.value, "srgb");

if (!converted.ok) {
  throw new Error(JSON.stringify(converted.problems));
}

console.log(converted.value);
```

The converted result may legitimately contain sRGB coordinates outside `0…1`:

```ts
{
  colorSpace: "srgb",
  r: 1.08,
  g: 0.12,
  b: -0.03,
  alpha: 1,
}
```

That is a valid finite colorimetric result, but it is outside the sRGB gamut.

Check it:

```ts
if (isColorInGamut(converted.value, "srgb")) {
  console.log("Already displayable in sRGB");
}
```

Map it explicitly:

```ts
const mapped = mapColorToGamut(converted.value, {
  gamut: "srgb",
  outputSpace: "srgb",
  method: "preserve-lightness",
});

if (!mapped.ok) {
  throw new Error(JSON.stringify(mapped.problems));
}

console.log(mapped.value);
```

The important semantic rule is:

```ts
convertColor(...)      // never silently maps or clips
mapColorToGamut(...)   // explicitly lossy
```

Texel’s own documentation similarly distinguishes conversion, which can produce out-of-bounds RGB coordinates, from gamut mapping. ([GitHub](https://github.com/texel-org/color))

---

# 17. Converting a wide-gamut source before Material generation

Material utilities ultimately require quantized ARGB input. The conversion and lossy decisions should therefore be visible:

```ts
import { createSchemeTokens, parseColor } from "color-scheme-tokens";

import { convertColor, isColorInGamut, mapColorToGamut } from "color-scheme-tokens/conversion";

import { material3Source } from "color-scheme-tokens/sources/material3";

const parsed = parseColor({
  colorSpace: "display-p3",
  r: 0.95,
  g: 0.18,
  b: 0.42,
  alpha: 1,
});

if (!parsed.ok) {
  throw new Error(JSON.stringify(parsed.problems));
}

const converted = convertColor(parsed.value, "srgb");

if (!converted.ok) {
  throw new Error(JSON.stringify(converted.problems));
}

const sourceColor = isColorInGamut(converted.value, "srgb")
  ? converted.value
  : (() => {
      const mapped = mapColorToGamut(converted.value, {
        gamut: "srgb",
        outputSpace: "srgb",
        method: "preserve-lightness",
      });

      if (!mapped.ok) {
        throw new Error(JSON.stringify(mapped.problems));
      }

      return mapped.value;
    })();

const result = createSchemeTokens({
  source: material3Source({
    sourceColor,
  }),
});
```

The flow is explicit:

```text
Display-P3
  -> colorimetric sRGB conversion
  -> explicit sRGB gamut decision
  -> explicit mapping if necessary
  -> 8-bit ARGB quantization inside Material adapter
  -> Material scheme generation
```

The user can review every lossy boundary.

---

# 18. Why Texel should not parse or serialize our public colors

Texel’s parser intentionally supports a limited CSS subset, and its documentation calls parsing a work in progress. Its sRGB serializer emits byte-quantized legacy `rgb()` output. ([GitHub](https://github.com/texel-org/color))

Therefore this should not happen:

```ts
// Not our architecture:
export { deserialize as parseColor } from "@texel/color";
export { serialize as formatCssColor } from "@texel/color";
```

Instead:

```ts
// Public package:
parseColor(input: unknown): Result<ColorValue, ColorProblem>;
formatCssColor(color: ColorValue): string;

// Private conversion adapter:
texelConvertCoordinates(...);
texelMapCoordinates(...);
```

This lets us replace Texel later without changing:

- public color objects;
- diagnostic codes;
- CSS formatting;
- serialization;
- graph schemas;
- consumer imports.

---

# 19. Safe CSS selector strategies

The default should avoid free-form selector strings:

```ts
const css = exportCssVariables(tokenSet, {
  prefix: "theme",

  scope: {
    strategy: "root",
  },

  modes: {
    strategy: "data-attribute",
    attribute: "data-color-scheme",
  },
});
```

Class strategy:

```ts
const css = exportCssVariables(tokenSet, {
  prefix: "theme",

  scope: {
    strategy: "class",
    className: "application-theme",
  },

  modes: {
    strategy: "class",
    classPrefix: "scheme-",
  },
});
```

Possible output:

```css
.application-theme {
  --theme-app-background: #ffffff;
}

.application-theme.scheme-dark {
  --theme-app-background: #111111;
}
```

An advanced custom-selector path can exist, but it should be clearly marked and validated:

```ts
const css = exportCssVariables(tokenSet, {
  prefix: "theme",

  modes: {
    strategy: "custom",

    selectors: {
      light: ":root",
      dark: ":root[data-color-scheme='dark']",
    },
  },
});
```

Because custom selectors can be malformed or collide, `exportCssVariables()` returns `Result<string, CssExportProblem>`.

---

# 20. Structured error handling

Consumers should be able to exhaustively act on diagnostic codes:

```ts
const result = compileGraph(graph);

if (!result.ok) {
  for (const problem of result.problems) {
    switch (problem.code) {
      case "invalid-token-key":
        console.error(`Invalid token at ${problem.path ?? "<unknown>"}`);
        break;

      case "unknown-reference":
        console.error(`Reference target does not exist: ${problem.message}`);
        break;

      case "reference-cycle":
        console.error(`Reference cycle: ${problem.message}`);
        break;

      case "missing-mode-value":
        console.error(`Incomplete mode definition: ${problem.message}`);
        break;

      case "no-public-tokens":
        console.error("The graph has no public tokens to compile.");
        break;

      default:
        assertNever(problem);
    }
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled problem: ${JSON.stringify(value)}`);
}
```

The package should not export an undefined `formatProblems()` convenience function merely to make the API look complete. Applications can format diagnostics for their own environment.

---

# 21. Type-level authoring help

`defineTokenGraph()` should preserve literal modes and keys:

```ts
const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",

  tokens: {
    "app.background": publicToken(
      byMode({
        light: "#ffffff",
        dark: "#111111",
      }),
    ),
  },
});
```

Invalid default mode:

```ts
defineTokenGraph({
  modes: ["light", "dark"],

  // @ts-expect-error:
  // "sepia" is not one of the declared modes.
  defaultMode: "sepia",

  tokens: {},
});
```

Incomplete mode map may also be caught for literal code:

```ts
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",

  tokens: {
    "app.background": publicToken(
      byMode({
        light: "#ffffff",

        // Expected type error: dark is missing.
      }),
    ),
  },
});
```

Runtime parsing must still perform the same checks, because types disappear at runtime and JavaScript consumers may call the package.

---

# 22. Build-time artifact generation

```ts
import { writeFile } from "node:fs/promises";

import {
  compileGraph,
  defineTokenGraph,
  exportCssVariables,
  exportTokenSetJson,
  publicToken,
} from "color-scheme-tokens";

const graph = defineTokenGraph({
  modes: ["base"],
  defaultMode: "base",

  tokens: {
    "app.background": publicToken("#ffffff"),
    "app.text": publicToken("#111111"),
    "app.focus": publicToken("#1455d9"),
  },
});

const compiled = compileGraph(graph);

if (!compiled.ok) {
  console.error(compiled.problems);
  process.exitCode = 1;
} else {
  const css = exportCssVariables(compiled.value, {
    prefix: "app",
  });

  if (!css.ok) {
    console.error(css.problems);
    process.exitCode = 1;
  } else {
    await Promise.all([
      writeFile("dist/theme.css", css.value),
      writeFile(
        "dist/theme.tokens.json",
        exportTokenSetJson(compiled.value, {
          indent: 2,
        }),
      ),
    ]);
  }
}
```

Again, no source or conversion module is required.

---

# 23. Package and dependency behavior

Three different guarantees must not be conflated.

## Semantic independence

The root graph/compiler/exporter works without invoking Material or conversion.

## Import-graph independence

These imports are isolated:

```ts
import { compileGraph } from "color-scheme-tokens";
```

does not load:

```ts
"@texel/color";
"@material/material-color-utilities";
```

Only these subpaths do:

```ts
import { convertColor } from "color-scheme-tokens/conversion";

import { material3Source } from "color-scheme-tokens/sources/material3";
```

Node package exports support explicitly enumerated subpath entry points and prevent consumers from reaching unexported internals. ([Node.js](https://nodejs.org/api/packages.html))

## Installation independence

A subpath is not a separately installed package. With one npm package and normal dependencies, package managers install its dependencies whether the consumer imports those subpaths or not.

My recommendation for v1 is:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./conversion": {
      "types": "./dist/conversion/index.d.ts",
      "import": "./dist/conversion/index.js"
    },
    "./sources/material3": {
      "types": "./dist/sources/material3/index.d.ts",
      "import": "./dist/sources/material3/index.js"
    }
  },
  "dependencies": {
    "@texel/color": "<exact-version>",
    "@material/material-color-utilities": "<exact-version>"
  }
}
```

Both dependencies should remain external in built JavaScript. Consumers install only `color-scheme-tokens`; their package manager installs transitive dependencies automatically. The root bundle still imports neither one.

This means:

```text
No manual plugin installation: yes.
No plugin registration: yes.
No third-party code loaded by root: yes.
No third-party packages present in node_modules: no.
```

If the final requirement is literally:

> Installing `color-scheme-tokens` must place zero third-party packages in `node_modules`.

then separate packages are required:

```text
color-scheme-tokens
@color-scheme-tokens/conversion
@color-scheme-tokens/material3
```

Subpath exports cannot provide separate installation footprints.

I would not use optional dependencies here. npm permits them to be omitted and makes the package responsible for handling their absence, which invites a late missing-module failure when someone imports an advertised subpath. ([npm Docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)) Optional peer dependencies are also not automatically installed, shifting setup work to consumers. ([npm Docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json))

The current build explicitly bundles Material utilities via `noExternal`; the intended external-dependency model would remove that setting.

---

# Final intended rule

The package should be replaceable at each boundary:

```text
Manual graph
   ─┐
Custom source
   ─┼─> canonical graph ─> compiler ─> token set ─> exporters
Material source
   ─┘

Optional conversion:
ColorValue ─> convert/map ─> ColorValue
```

The compiler does not care where graph data came from.

The graph does not care which conversion engine might have produced a literal.

The CSS exporter does not care whether a color was handwritten, generated by Material, or converted by Texel.

`@texel/color` and Material utilities are replaceable implementation dependencies. The public contracts—color objects, expressions, graphs, diagnostics, compiled sets, and output formats—remain owned by `color-scheme-tokens`.

---

# you asked

message time: 2026-06-20 01:05:31

I still need you to help me make it as idiomatic, simple to use but very powerful. How to do that when seeing the following desired API examples? There are still a lot of functions needed in the API, the best thing would be to have all inputs be JSON serializable.

I already got suggestions here. Maybe we can even take it further.

This spec is a big step up — the Result/Problem unification, fragments-over-layers, `tokens` as a record instead of an array, and `exportCssVariables` now returning `Result` all directly close gaps from the earlier audit and from what I found in `main`. Good. Let me focus on the two things you actually asked about — the function count, and JSON-serializability — and then the handful of decisions still left open that will determine whether this feels simple or merely small.

**On "too many functions": count the verbs, not the exports.** Laid out flat you have ~17 names across three entry points, but they collapse into a tight, non-overlapping vocabulary:

| Verb family          | Members                                             | Job                                                 |
| -------------------- | --------------------------------------------------- | --------------------------------------------------- |
| `define*`            | `defineTokenGraph`, `defineTokenFragment`           | typed, literal-preserving authoring                 |
| `parse*`             | `parseTokenGraph`, `parseColor`                     | untrusted-input boundary                            |
| data builders        | `ref`, `byMode`, `publicToken`, `internalToken`     | sugar over plain objects, never validate            |
| `compileGraph`       | one function                                        | the one pipeline verb                               |
| `export*`            | `exportCssVariables`, `exportTokenSetJson`          | projection to an output format                      |
| `createSchemeTokens` | one function                                        | source+fragments orchestration                      |
| conversion           | `convertColor`, `isColorInGamut`, `mapColorToGamut` | optional, subpath-only                              |
| `material3Source`    | one function                                        | the one adapter constructor                         |
| `formatCssColor`     | one function                                        | single-value formatter, decoupled from the pipeline |

That's 9 conceptual jobs, each occupied by exactly one name. That's not "a lot of functions" — that's a small grammar with good coverage. The thing worth fixing isn't the count, it's the one place two of these jobs visibly overlap: **`createSchemeTokens` vs. manually calling `defineTokenGraph` + `compileGraph`.** Sections 3–7 do the latter with no source at all; section 13–15 do the former with a source. What's not yet stated is whether `source` is _required_ in `CreateSchemeTokensOptions`, and if it's optional, where `modes`/`defaultMode` come from when you call `createSchemeTokens({ fragments })` with no source to supply them. I'd resolve it explicitly: `createSchemeTokens` is the normal entry point for "compose fragments onto an optional source," and it needs its own `{ modes, defaultMode }` when no source provides a graph — with a `Problem` (e.g. `conflicting-mode-declaration` / `missing-mode-declaration`) if both or neither are given. `defineTokenGraph` + `compileGraph` stays the deliberately low-level path for fixtures and tests. Say that once, in the docs, and the apparent redundancy disappears.

**On JSON-serializability: you already have the right shape, you just haven't stated the rule.** Every `ColorValue`, `TokenValueInput`, `TokenDefinitionInput`, the whole `TokenGraphInput`, `CompiledTokenSet`, and even the `exportCssVariables`/`exportTokenSetJson` _options_ objects are plain strings/numbers/objects — no Map, no class instances, no functions. That's genuinely good, and it's why section 8 can show the exact same shape as raw JSON. The rule that falls out of your own design is: **everything is data except `TokenSource.build()`.** Sources are the one deliberately code-only extension point (they're functions by necessity); literally everything else — graph, fragments, selection, export config — is or can be pure JSON. State that as a one-line contract, and it answers "is this all serializable" for every future addition without re-auditing each one.

Two concrete spots where that property isn't pinned down yet:

- `CompiledTokenSet.tokens[key].origin?: TokenOrigin` — `TokenOrigin` is referenced but never defined, the same gap I flagged with the undefined `formatProblems()` last time. Give it a small, deliberately JSON-safe shape now, e.g. `{ readonly source?: string; readonly fragment?: string }`, tied to the `id` fields `material3Source` and `defineTokenFragment` already expose — that's what makes "why does `app.action` have this value" answerable later.
- Problem objects must never carry the raw offending input as a contextual field — only strings/numbers/`path`. You don't do this anywhere I can see, but it's worth being a hard rule rather than an accident of current scope, since it's the thing that keeps `JSON.stringify(result.problems)` (used everywhere in your own examples) safe against a cyclic or huge input.

One more JSON-adjacent risk worth naming: `tokens` is now `Record<string, TokenDefinitionInput>`. Plain JS objects with non-numeric-looking string keys preserve insertion order — but a key that happens to look like an integer (`"0"`, `"42"`) gets reordered _ahead_ of insertion order by the spec, before any string keys. Token keys are namespaced (`app.background`) so this is unlikely in practice, but since the whole point of the earlier audit's canonical-serializer fix was "don't let JS object semantics decide your output order," the exporters must always explicitly sort tokens by key rather than trust `Object.keys()`/`for...in` order. If they already do (sounds like yes, per section 10's "canonical serialization can still sort the record keys independently of JavaScript insertion order"), this risk is fully neutralized — just don't let that sorting become implicit anywhere.

**The one piece of this spec I'd actually stress-test before writing any implementation code: section 21's compile-time mode-completeness checking.** The example shows `byMode({ light: "#fff" })` (missing `dark`) producing a type error inside `defineTokenGraph`. That's harder to get than it looks, and it's worth knowing why before you build around the assumption. `byMode()` is called as a standalone expression — at the point you write `byMode({...})`, there's no syntactic link to the `modes` array declared elsewhere in the same `defineTokenGraph` call. TypeScript's contextual typing can flow an _expected type_ into nested generic calls for inference, but it can't retroactively turn a `Record<string, V>`-shaped parameter into one with "these exact required keys" — index signatures don't carry a required-key set the way named properties do. So:

```ts
// This makes byMode preserve whatever keys you gave it (good, achievable):
function byMode<const V extends Record<string, ColorExpressionInput>>(values: V): ByModeInput<V>;

// But nothing here can fail to compile just because V's keys
// don't match the modes tuple declared two arguments over —
// there's no call-site link between them.
```

The honest options are: (a) accept that incomplete/mistyped mode maps are caught by `compileGraph`/`parseTokenGraph` at _runtime_, with a precise `path` — which section 21 already says as a fallback, so just don't oversell the compile-time half in docs; or (b) if you want a real compile-time guarantee, give `defineTokenGraph` a builder/callback shape that hands you a `byMode` already bound to that graph's literal `modes`:

```ts
defineTokenGraph({ modes: ["light", "dark"], defaultMode: "light" }, ({ byMode }) => ({
  tokens: {
    "app.background": publicToken(byMode({ light: "#fff", dark: "#111" })),
  },
}));
```

That costs one extra nesting level but gives `byMode` an actual literal key-set to check against, which a flat object literal can't. I'd prototype both shapes against a `.test-d.ts` file (`expectTypeOf`) before locking the authoring API — if the flat version can't really catch a missing mode, better to discover that now than after `defineTokenGraph`'s signature is public.

A few smaller decisions worth nailing down while you're at it, all small but all load-bearing for "simple":

- **`publicToken`/`internalToken` signature.** Section 2 shows one positional arg; section 12 shows `(value, options)`. Pick `(value, options?: { description?: string })` for both and use it everywhere — right now a reader has to guess which example is current.
- **`mapColorToGamut`'s `gamut` field breaks the family's own convention.** `convertColor(value, "srgb")` and `isColorInGamut(value, "srgb")` both take the target space positionally; `mapColorToGamut(value, { gamut: "srgb", outputSpace: "srgb", method })` buries the equivalent concept inside an options object. Either make it positional to match its siblings — `mapColorToGamut(value, "srgb", { outputSpace, method })` — or show a real example where `gamut` and `outputSpace` actually differ (map-to-sRGB-boundary but emit OKLCH coordinates, say). As written, the split looks unmotivated, and an unjustified parameter is easy to add later but awkward to remove.
- **`selection.include` and visibility.** Confirm explicitly that `include` can only ever name already-public tokens — never an internal one as a backdoor. If someone names an internal token, that should be a problem (`included-token-not-public`), not a silent no-op or a silent bypass. `selection: "all"` already exists as the deliberate escape hatch for "give me everything including internals," so `include` doesn't need to double as one.
- **Fragment/source duplicate-key policy.** With fragments as the main composition mechanism, decide and document once whether a duplicate key across `source` + `fragments[]` is rejected (my vote, for the same determinism reasons as everything else here) or last-wins, and surface it as a `Problem` with a `path` pointing at the colliding key.

---

# chatgpt response

I’m going to reduce this into one canonical JSON-first data model, with only minimal TypeScript authoring sugar on top. I’ll also check the mode-typing edge cases and record the finalized decisions in issue #1.

---

# chatgpt response

A further simplification is to make adapters output plain JSON fragments instead of function-valued sources, so the core compiler only accepts data.

---

# chatgpt response

# Recommended direction: make the JSON shape the pleasant API

The best simplification is not to hide the data model behind more helper functions. It is to make the canonical data model pleasant enough that most users can author it directly.

I would remove these four functions from the required public API:

```ts
ref();
byMode();
publicToken();
internalToken();
```

They are convenient individually, but collectively they create a second authoring language that has to be learned, documented, tested, and kept equivalent to the JSON representation.

Instead, use direct JSON-safe structures:

```ts
const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "internal",

  tokens: {
    "brand.primary": {
      values: {
        light: "#6750a4",
        dark: "#d0bcff",
      },
    },

    "app.action": {
      visibility: "public",
      value: {
        ref: "brand.primary",
      },
    },
  },
});
```

This is already readable. It also serializes directly to JSON without translating helper calls into another representation.

I recorded this refinement in the umbrella issue.

---

# 1. The central rule

> Every public domain value and every options object is JSON-safe. Only explicitly executable capabilities, such as a `TokenSource`, may contain functions.

That means the following must all be ordinary JSON data:

- graph inputs;
- fragments;
- colors;
- references;
- mode-specific values;
- compilation selection;
- CSS exporter configuration;
- compiled token sets;
- origins and dependencies;
- Results and Problems;
- Material source options;
- conversion and gamut-mapping options.

They must not contain:

```text
Map
Set
Date
class instances
bigint
symbol
functions
undefined property values
NaN
Infinity
-Infinity
cyclic references
```

In particular, do not add callback-based configuration such as:

```ts
// Do not add these:
{
  variableName: (key) => string,
  selectorForMode: (mode) => string,
  transform: (graph) => graph,
  formatColor: (color) => string,
  colorEngine: customObject,
}
```

Callbacks prevent JSON serialization, make deterministic behavior harder to guarantee, and enlarge the library’s trust boundary.

Use declarative strategies instead.

---

# 2. The canonical graph data model

I recommend this input grammar.

```ts
export type TokenVisibility = "public" | "internal";

export type ColorExpressionInput = ColorInput | ReferenceInput;

export interface ReferenceInput {
  readonly ref: string;
}

export type TokenDefinitionInput = {
  readonly visibility?: TokenVisibility;
  readonly description?: string;
} & (
  | {
      /**
       * One expression used in every mode.
       */
      readonly value: ColorExpressionInput;
      readonly values?: never;
    }
  | {
      /**
       * One expression per declared graph mode.
       */
      readonly value?: never;
      readonly values: Readonly<Record<string, ColorExpressionInput>>;
    }
);

export interface TokenFragmentInput {
  readonly schemaVersion: "color-token-fragment/v1";
  readonly id: string;

  /**
   * Inherited by tokens that do not provide `visibility`.
   */
  readonly defaultVisibility: TokenVisibility;

  readonly tokens: Readonly<Record<string, TokenDefinitionInput>>;
}

export interface TokenGraphInput {
  readonly schemaVersion: "color-token-graph/v1";
  readonly modes: readonly string[];
  readonly defaultMode: string;

  /**
   * Inherited by direct graph tokens that do not provide
   * `visibility`.
   */
  readonly defaultVisibility: TokenVisibility;

  readonly tokens: Readonly<Record<string, TokenDefinitionInput>>;

  readonly fragments?: readonly TokenFragmentInput[];
}
```

## Why `value` and `values`?

They remove the need for `byMode()` while remaining immediately understandable:

```ts
{
  value: "#6750a4";
}
```

means one value in every mode.

```ts
{
  values: {
    light: "#6750a4",
    dark: "#d0bcff",
  }
}
```

means mode-specific values.

The properties are mutually exclusive. Supplying both is a type error and runtime parse problem.

## Why `{ ref: "…" }`?

It is simpler than either of these:

```ts
ref("brand.primary");
```

```ts
{
  kind: "reference",
  key: "brand.primary",
}
```

It is explicit, compact, serializable, and leaves room for future JSON expressions:

```ts
// Possible later expression grammar:
{
  mix: {
    left: { ref: "brand.primary" },
    right: "#ffffff",
    amount: 0.2,
    colorSpace: "oklch",
  },
}
```

No new builder function is required for every expression type.

---

# 3. Visibility without `publicToken()` and `internalToken()`

Set an explicit default once at graph or fragment level.

## Mostly internal graph

```ts
const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "internal",

  tokens: {
    "brand.primary": {
      values: {
        light: "#6750a4",
        dark: "#d0bcff",
      },
    },

    "brand.onPrimary": {
      values: {
        light: "#ffffff",
        dark: "#381e72",
      },
    },

    "app.action": {
      visibility: "public",
      value: { ref: "brand.primary" },
    },

    "app.actionText": {
      visibility: "public",
      value: { ref: "brand.onPrimary" },
    },
  },
});
```

## Public application fragment

```ts
const application = defineTokenFragment({
  id: "application",
  defaultVisibility: "public",

  tokens: {
    "app.canvas": {
      value: { ref: "m3.surface" },
    },

    "app.text": {
      value: { ref: "m3.onSurface" },
    },

    "app.action": {
      value: { ref: "m3.primary" },
    },

    "app.actionText": {
      value: { ref: "m3.onPrimary" },
    },
  },
});
```

All application tokens inherit public visibility. No wrapper is repeated four times.

The parser normalizes this into a graph where every token has an explicit final visibility.

---

# 4. The root runtime API

After removing the four data builders, the proposed root runtime surface becomes:

```text
defineTokenGraph
defineTokenFragment

parseTokenGraph
parseColor

compileGraph
createSchemeTokens

exportCssVariables
exportTokenSetJson
formatCssColor
```

That is nine root functions, but normal usage only touches three or four.

## Manual graph workflow

```ts
import { compileGraph, defineTokenGraph, exportCssVariables } from "color-scheme-tokens";
```

## Material workflow

```ts
import { createSchemeTokens, defineTokenFragment, exportCssVariables } from "color-scheme-tokens";

import { material3Source } from "color-scheme-tokens/sources/material3";
```

## Conversion workflow

```ts
import { parseColor } from "color-scheme-tokens";

import { convertColor, isColorInGamut, mapColorToGamut } from "color-scheme-tokens/conversion";
```

The number of available exports is less important than the number of concepts a user must combine in one workflow.

---

# 5. `defineTokenGraph()` and `defineTokenFragment()`

These should be the only TypeScript authoring helpers.

They should:

- preserve literal modes and token keys;
- provide compile-time feedback;
- add the schema version;
- return plain JSON-safe objects;
- have no classes, methods, symbols, or hidden metadata;
- perform no authoritative runtime validation.

Conceptually:

```ts
export function defineTokenGraph<
  const Modes extends readonly string[],
  const Tokens extends Readonly<Record<string, unknown>>,
>(
  definition: TypedTokenGraphDefinition<Modes, Tokens>,
): TokenGraphInput & {
  readonly modes: Modes;
  readonly tokens: Tokens;
};
```

Usage:

```ts
const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "public",

  tokens: {
    "app.background": {
      values: {
        light: "#ffffff",
        dark: "#111111",
      },
    },
  },
});
```

The returned value is ordinary data:

```ts
const serialized = JSON.stringify(graph, null, 2);
```

No special serializer is required merely to persist a graph definition.

---

# 6. Compile-time mode checking does not require a callback builder

The quoted review is right that a standalone call like this cannot know the graph modes by itself:

```ts
byMode({
  light: "#fff",
});
```

At that call site, there is no mode declaration.

But once `byMode()` is removed and the `values` object remains inside `defineTokenGraph()`, the graph function can check it against the inferred mode tuple.

A flat API can reject both missing and extra modes:

```ts
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "public",

  tokens: {
    "app.background": {
      values: {
        light: "#ffffff",

        // Type error: `dark` is missing.
      },
    },
  },
});
```

And:

```ts
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "public",

  tokens: {
    "app.background": {
      values: {
        light: "#ffffff",
        dark: "#111111",

        // Type error: `sepia` is not a declared mode.
        sepia: "#efe7d1",
      },
    },
  },
});
```

I prototyped this successfully using TypeScript 5.8.3. The technique combines:

- a `const` type parameter to preserve the literal mode tuple;
- `NoInfer<Modes[number]>` to prevent token maps from widening the inferred mode set;
- contextual checking against `Record<Mode, Expression>`;
- a separately inferred token record so literal token keys remain available.

TypeScript documents that `const` type parameters provide more specific literal inference, while `NoInfer<T>` prevents the enclosed location from contributing to inference. ([TypeScript](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html))

The rough implementation shape is:

```ts
type TokenDefinitionForMode<Mode extends string> =
  | {
      readonly value: ColorExpressionInput;
      readonly values?: never;
    }
  | {
      readonly value?: never;
      readonly values: Readonly<Record<Mode, ColorExpressionInput>>;
    };

type TokenGraphShape<Modes extends readonly string[]> = {
  readonly modes: Modes;
  readonly defaultMode: Modes[number];

  readonly tokens: Readonly<Record<string, TokenDefinitionForMode<NoInfer<Modes[number]>>>>;
};

export function defineTokenGraph<
  const Modes extends readonly string[],
  const Tokens extends Readonly<Record<string, unknown>>,
>(
  input: Omit<TokenGraphShape<Modes>, "tokens"> & {
    readonly tokens: Tokens;
  } & TokenGraphShape<Modes>,
): {
  readonly schemaVersion: "color-token-graph/v1";
  readonly modes: Modes;
  readonly defaultMode: Modes[number];
  readonly tokens: Tokens;
} {
  return {
    schemaVersion: "color-token-graph/v1",
    ...input,
  };
}
```

That exact implementation still needs prototyping under the repository’s pinned TypeScript 6.0 version, particularly for:

- compiler error quality;
- declaration output;
- editor performance;
- large token records;
- reference-key inference.

But a nested callback API is not inherently required.

TypeScript’s `satisfies` operator is also useful for users who want plain data without a helper: it checks compatibility while retaining the expression’s more specific inferred type. ([TypeScript](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html))

```ts
const fragment = {
  schemaVersion: "color-token-fragment/v1",
  id: "application",
  defaultVisibility: "public",

  tokens: {
    "app.background": {
      value: "#ffffff",
    },
  },
} satisfies TokenFragmentInput;
```

---

# 7. Manual graph: complete intended usage

```ts
import {
  compileGraph,
  defineTokenGraph,
  exportCssVariables,
  exportTokenSetJson,
} from "color-scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "internal",

  tokens: {
    "brand.primary": {
      description: "Primary brand color",

      values: {
        light: "#6750a4",
        dark: "#d0bcff",
      },
    },

    "brand.onPrimary": {
      values: {
        light: "#ffffff",
        dark: "#381e72",
      },
    },

    "app.action": {
      visibility: "public",
      description: "Default interactive action color",
      value: {
        ref: "brand.primary",
      },
    },

    "app.actionText": {
      visibility: "public",
      value: {
        ref: "brand.onPrimary",
      },
    },

    "app.canvas": {
      visibility: "public",

      values: {
        light: "#fffbfe",
        dark: "#1c1b1f",
      },
    },
  },
});

const compiled = compileGraph(graph);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.problems, null, 2));
}

const css = exportCssVariables(compiled.value, {
  prefix: "theme",

  modes: {
    strategy: "data-attribute",
    attribute: "data-color-scheme",
  },

  format: "pretty",
});

if (!css.ok) {
  throw new Error(JSON.stringify(css.problems, null, 2));
}

const json = exportTokenSetJson(compiled.value);

console.log(css.value);
console.log(json);
```

Possible CSS:

```css
:root {
  --theme-app-action: #6750a4;
  --theme-app-action-text: #ffffff;
  --theme-app-canvas: #fffbfe;
}

:root[data-color-scheme="dark"] {
  --theme-app-action: #d0bcff;
  --theme-app-action-text: #381e72;
  --theme-app-canvas: #1c1b1f;
}
```

---

# 8. The exact raw JSON is the same shape

The persisted graph is not a second format:

```json
{
  "schemaVersion": "color-token-graph/v1",
  "modes": ["light", "dark"],
  "defaultMode": "light",
  "defaultVisibility": "internal",
  "tokens": {
    "brand.primary": {
      "values": {
        "light": "#6750a4",
        "dark": "#d0bcff"
      }
    },
    "app.action": {
      "visibility": "public",
      "value": {
        "ref": "brand.primary"
      }
    }
  }
}
```

Load and parse it:

```ts
import { compileGraph, parseTokenGraph } from "color-scheme-tokens";

const response = await fetch("/theme.tokens.json");
const input: unknown = await response.json();

const parsed = parseTokenGraph(input);

if (!parsed.ok) {
  for (const problem of parsed.problems) {
    console.error({
      code: problem.code,
      path: problem.path,
      message: problem.message,
    });
  }

  throw new Error("Invalid token graph");
}

const compiled = compileGraph(parsed.value);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.problems, null, 2));
}
```

`parseTokenGraph()` must create an owned canonical copy. Mutating the original JSON object afterwards must not mutate the parsed graph.

---

# 9. Fragments remain plain JSON data

```ts
import { compileGraph, defineTokenFragment, defineTokenGraph } from "color-scheme-tokens";

const brand = defineTokenFragment({
  id: "brand",
  defaultVisibility: "internal",

  tokens: {
    "brand.primary": {
      values: {
        light: "#6750a4",
        dark: "#d0bcff",
      },
    },

    "brand.onPrimary": {
      values: {
        light: "#ffffff",
        dark: "#381e72",
      },
    },
  },
});

const application = defineTokenFragment({
  id: "application",
  defaultVisibility: "public",

  tokens: {
    "app.action": {
      value: { ref: "brand.primary" },
    },

    "app.actionText": {
      value: { ref: "brand.onPrimary" },
    },
  },
});

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  defaultVisibility: "public",
  tokens: {},
  fragments: [brand, application],
});

const compiled = compileGraph(graph);
```

No imperative `applyLayers()` call is needed. Composition is part of the data being compiled.

---

# 10. Duplicate fragment keys must always fail

Never let object spread determine conflict behavior:

```ts
const first = defineTokenFragment({
  id: "first",
  defaultVisibility: "public",

  tokens: {
    "app.action": {
      value: "#6750a4",
    },
  },
});

const second = defineTokenFragment({
  id: "second",
  defaultVisibility: "public",

  tokens: {
    "app.action": {
      value: "#ff0000",
    },
  },
});
```

Compiling both should return:

```ts
{
  ok: false,

  problems: [
    {
      code: "duplicate-token-key",
      message:
        "Token app.action is declared more than once.",

      path: "/fragments/1/tokens/app.action",
      key: "app.action",

      firstPath:
        "/fragments/0/tokens/app.action",
    },
  ],
}
```

The duplicate policy should be:

```text
source + direct graph token collision: reject
source + fragment collision: reject
fragment + fragment collision: reject
direct graph + fragment collision: reject
duplicate within one fragment: impossible in parsed JSON,
but reject if encountered through hostile runtime objects
```

Never “last fragment wins.”

---

# 11. `createSchemeTokens()` should keep `source` required

I would not adopt the suggestion to make `source` optional.

An optional source forces `createSchemeTokens()` to support two competing configurations:

```ts
createSchemeTokens({
  source,
  fragments,
});
```

and:

```ts
createSchemeTokens({
  modes,
  defaultMode,
  fragments,
});
```

That introduces additional rules and problems:

```text
missing-mode-declaration
conflicting-mode-declaration
source-and-manual-modes-conflict
default-mode-conflict
```

The cleaner separation is:

```ts
// Manual and completely JSON-driven:
compileGraph(
  defineTokenGraph({
    modes: ["light", "dark"],
    defaultMode: "light",
    defaultVisibility: "public",
    tokens: {},
  }),
);
```

versus:

```ts
// Adapter orchestration:
createSchemeTokens({
  source: material3Source({
    sourceColor: "#6750a4",
  }),

  fragments: [application],
  selection: "public",
});
```

`createSchemeTokens()` therefore has one job:

> Materialize a required source, add fragments, parse once, and compile.

Its source determines the graph modes and default mode. Fragments do not redeclare them.

---

# 12. Material usage under the refined API

```ts
import { createSchemeTokens, defineTokenFragment, exportCssVariables } from "color-scheme-tokens";

import { material3Source } from "color-scheme-tokens/sources/material3";

const application = defineTokenFragment({
  id: "application",
  defaultVisibility: "public",

  tokens: {
    "app.canvas": {
      value: { ref: "m3.surface" },
    },

    "app.text": {
      value: { ref: "m3.onSurface" },
    },

    "app.action": {
      value: { ref: "m3.primary" },
    },

    "app.actionText": {
      value: { ref: "m3.onPrimary" },
    },

    "app.error": {
      value: { ref: "m3.error" },
    },
  },
});

const created = createSchemeTokens({
  source: material3Source({
    sourceColor: "#6750a4",

    algorithm: {
      variant: "tonalSpot",
      contrastLevel: 0,
      specVersion: "2021",
      platform: "phone",
    },
  }),

  fragments: [application],
  selection: "public",
});

if (!created.ok) {
  throw new Error(JSON.stringify(created.problems, null, 2));
}

const css = exportCssVariables(created.value.tokenSet, {
  prefix: "theme",

  modes: {
    strategy: "data-attribute",
    attribute: "data-color-scheme",
  },
});

if (!css.ok) {
  throw new Error(JSON.stringify(css.problems, null, 2));
}
```

`createSchemeTokens()` should return only core pipeline products:

```ts
interface CreateSchemeTokensValue {
  readonly graph: TokenGraph;
  readonly tokenSet: CompiledTokenSet;
}
```

It should not eagerly produce CSS and JSON.

---

# 13. Selection should be concise and orthogonal

I recommend:

```ts
export type TokenSelection =
  | "public"
  | "all"
  | {
      readonly keys: readonly string[];
    };
```

## Public default

```ts
const result = compileGraph(graph);
// Defaults to:
const same = compileGraph(graph, {
  selection: "public",
});
```

## Everything

```ts
const result = compileGraph(graph, {
  selection: "all",
});
```

## Exact keys

```ts
const result = compileGraph(graph, {
  selection: {
    keys: ["app.action", "app.actionText"],
  },
});
```

I disagree with restricting exact selection to public tokens.

Visibility is an output default, not a security boundary. An explicit exact selection should be able to request an internal token:

```ts
const result = compileGraph(graph, {
  selection: {
    keys: ["brand.primary"],
  },
});
```

That is useful for:

- tests;
- diagnostics;
- design tooling;
- preview applications;
- inspecting one generated source role;
- generating a narrowly scoped artifact.

Unknown and duplicate requested keys should be problems.

The semantics become simple:

```text
"public"      all public tokens
"all"         all tokens
{ keys: [] }  exactly these tokens, regardless of visibility
```

---

# 14. JSON-safe origin and dependency metadata

Define `TokenOrigin` now rather than leaving it implicit:

```ts
export type TokenOrigin =
  | {
      readonly kind: "graph";
    }
  | {
      readonly kind: "fragment";
      readonly id: string;
    }
  | {
      readonly kind: "source";
      readonly id: string;
      readonly sourceToken?: string;
    };
```

The compiled token can preserve enough information for future explanation tooling:

```ts
export interface CompiledToken {
  readonly values: Readonly<Record<string, ColorValue>>;

  readonly origin: TokenOrigin;

  /**
   * Direct and transitive reference dependencies,
   * in deterministic order.
   */
  readonly dependencies: readonly string[];

  readonly description?: string;
}
```

Example:

```json
{
  "values": {
    "light": {
      "colorSpace": "srgb",
      "r": 0.396078431372549,
      "g": 0.3137254901960784,
      "b": 0.6431372549019608,
      "alpha": 1
    },
    "dark": {
      "colorSpace": "srgb",
      "r": 0.8156862745098039,
      "g": 0.7372549019607844,
      "b": 1,
      "alpha": 1
    }
  },
  "origin": {
    "kind": "fragment",
    "id": "application"
  },
  "dependencies": ["m3.primary"]
}
```

No recursive resolution trace is needed in v1.

---

# 15. Compiled tokens should also be a record

```ts
export interface CompiledTokenSet {
  readonly schemaVersion: "compiled-color-token-set/v1";

  readonly modes: readonly string[];
  readonly defaultMode: string;

  readonly tokens: Readonly<Record<string, CompiledToken>>;
}
```

Direct lookup becomes natural:

```ts
const action = compiled.value.tokens["app.action"];

const lightAction = action.values.light;

const darkAction = action.values.dark;
```

Instead of:

```ts
const action = compiled.value.tokens.find((token) => token.key === "app.action");
```

Exporters must still explicitly sort token keys. They must not rely on object enumeration order.

---

# 16. Exporter configuration remains declarative

```ts
export interface ExportCssVariablesOptions {
  readonly prefix?: string;

  readonly scope?:
    | {
        readonly strategy: "root";
      }
    | {
        readonly strategy: "selector";
        readonly selector: string;
      };

  readonly modes?:
    | {
        readonly strategy: "data-attribute";
        readonly attribute: string;
      }
    | {
        readonly strategy: "class";
        readonly prefix: string;
      }
    | {
        readonly strategy: "selectors";
        readonly selectors: Readonly<Record<string, string>>;
      };

  readonly format?: "pretty" | "compact";
}
```

## Safe common case

```ts
const css = exportCssVariables(tokenSet, {
  prefix: "theme",

  modes: {
    strategy: "data-attribute",
    attribute: "data-color-scheme",
  },
});
```

## Class strategy

```ts
const css = exportCssVariables(tokenSet, {
  prefix: "theme",

  scope: {
    strategy: "selector",
    selector: ".application",
  },

  modes: {
    strategy: "class",
    prefix: "scheme-",
  },
});
```

Potential output:

```css
.application {
  --theme-app-background: #ffffff;
}

.application.scheme-dark {
  --theme-app-background: #111111;
}
```

## Exact custom selectors

```ts
const css = exportCssVariables(tokenSet, {
  prefix: "theme",

  modes: {
    strategy: "selectors",

    selectors: {
      light: ":root",
      dark: ":root[data-color-scheme='dark']",
    },
  },
});
```

Because arbitrary selectors and prefixes require runtime validation, `exportCssVariables()` returning `Result` is appropriate.

Rename `minify` to:

```ts
format: "compact";
```

unless genuine CSS minification is implemented.

---

# 17. Not every projection needs `Result`

A coherent rule is:

> Return `Result` when a function accepts untrusted data, validates dynamic configuration, invokes an external engine, or can fail for a recoverable reason.

Therefore:

```ts
parseTokenGraph(...)       // Result
parseColor(...)            // Result
compileGraph(...)          // Result
createSchemeTokens(...)    // Result
exportCssVariables(...)    // Result
convertColor(...)          // Result
mapColorToGamut(...)       // Result
```

But these may be total:

```ts
formatCssColor(color: ColorValue): string

exportTokenSetJson(
  tokenSet: CompiledTokenSet,
): string

isColorInGamut(
  color: ColorValue,
  gamut: ColorGamut,
): boolean
```

`exportTokenSetJson()` should emit one canonical representation without formatting options. That keeps it total and byte-stable:

```ts
const json = exportTokenSetJson(tokenSet);
```

Consumers wanting noncanonical formatting can parse and reserialize it themselves.

---

# 18. Refine gamut-mapping argument consistency

Use the target gamut positionally, matching the other conversion functions:

```ts
convertColor(color, "srgb");

isColorInGamut(color, "srgb");

mapColorToGamut(color, "srgb", {
  method: "preserve-lightness",
});
```

Keep `outputSpace` in options because it can legitimately differ from the gamut:

```ts
const mappedOklch = mapColorToGamut(wideGamutColor, "srgb", {
  /**
   * Map to the sRGB boundary but return
   * the mapped coordinates as OKLCH.
   */
  outputSpace: "oklch",
  method: "preserve-lightness",
});
```

That gives each parameter a clear purpose:

```text
second argument: target physical gamut
outputSpace: coordinate representation of the result
method: lossy mapping algorithm
```

---

# 19. The one deliberate non-JSON exception

A source is executable by definition:

```ts
export interface TokenSource<P extends Problem> {
  readonly id: string;

  build(): Result<TokenGraphInput, P>;
}
```

That object cannot be JSON because it contains `build()`.

Everything it consumes and produces should still be JSON-safe:

```ts
const source = material3Source({
  sourceColor: "#6750a4",
  algorithm: {
    variant: "tonalSpot",
    contrastLevel: 0,
    specVersion: "2021",
    platform: "phone",
  },
});
```

The options are JSON.

The generated graph is JSON.

Only the executable capability object is not.

Trying to make even `TokenSource` serializable would require a registry:

```json
{
  "source": {
    "type": "material3",
    "options": {
      "sourceColor": "#6750a4"
    }
  }
}
```

Then the root package would need to know how to resolve `"material3"`, or users would need to register handlers globally. That is less explicit, less tree-shakeable, and less deterministic than importing the adapter directly.

---

# Final API recommendation

## Root

```ts
defineTokenGraph;
defineTokenFragment;

parseTokenGraph;
parseColor;

compileGraph;
createSchemeTokens;

exportCssVariables;
exportTokenSetJson;
formatCssColor;
```

## Conversion subpath

```ts
convertColor;
isColorInGamut;
mapColorToGamut;
```

## Material subpath

```ts
material3Source;
```

## Remove or keep internal

```ts
ref;
byMode;
publicToken;
internalToken;

validateGraph;
compileValidatedGraph;

hex;
tokenKey;
modeKey;
srgb255;

applyLayers;
```

This shape remains simple because the ordinary graph example needs no mini-DSL:

```ts
const result = compileGraph(
  defineTokenGraph({
    modes: ["light", "dark"],
    defaultMode: "light",
    defaultVisibility: "public",

    tokens: {
      "app.background": {
        values: {
          light: "#ffffff",
          dark: "#111111",
        },
      },

      "app.foreground": {
        values: {
          light: "#111111",
          dark: "#ffffff",
        },
      },
    },
  }),
);
```

It remains powerful because the same JSON grammar supports:

- literal colors;
- references;
- mode-specific values;
- source-generated graphs;
- reusable fragments;
- public/internal visibility;
- exact selection;
- deterministic provenance;
- future computed expressions;
- CSS and JSON projections;
- optional conversion and gamut mapping.

The key is not minimizing the raw number of exports at all costs. It is ensuring there is **one data model, one meaning for each verb, and no hidden alternate DSL**.

---

# you asked

message time: 2026-06-20 01:35:49

Yes now we are getting real close to the final shape! Is 'kind' the best property name for how and where we use it? I never find it in other open source libraries a lot (I think?). Any other wording/naming/vocabulary we can maybe change to be more inline with the ecosystem? And identify any other edge cases we might have missed, not addressed yet.

---

# chatgpt response

I’m comparing the proposed vocabulary against TypeScript/GraphQL ASTs, JSON Schema, design-token formats, and validation libraries, then pressure-testing naming choices and remaining edge cases.

---

# chatgpt response

The naming pass is converging on keeping `kind` for structural variant tags and reserving `type` for semantic token/data categories. New edge cases include raw JSON duplicates, mode dimensionality, dependency metadata, key grammar, and Material role stability.

---

# chatgpt response

## `kind` is a good name—but only for a narrow job

It is more common than it may appear. The TypeScript handbook uses `kind` as its canonical discriminant-property example, while ESTree uses `type` for AST node variants. ([TypeScript](https://www.typescriptlang.org/docs/handbook/2/narrowing.html))

For this library, **`kind` is preferable to `type` for structural variants** because the design-token ecosystem already gives `type`/`$type` a specific meaning: the semantic category of a token value, such as `color`, `dimension`, or `fontFamily`. Both DTCG and Style Dictionary use that vocabulary. ([Design Tokens](https://www.designtokens.org/tr/drafts/format/))

The rule should be:

```text
kind      Which member of a closed structural union is this?
type      What semantic data/token type is this?
code      What machine-actionable issue occurred?
strategy  Which declarative output approach is selected?
method    Which numerical algorithm is selected?
format    How is text laid out?
```

Because this package is color-specific, public tokens do not need a redundant:

```ts
type: "color";
```

at all.

### Good uses of `kind`

Internal normalized expressions:

```ts
type ColorExpression =
  | {
      readonly kind: "literal";
      readonly color: ColorValue;
    }
  | {
      readonly kind: "reference";
      readonly key: TokenKey;
    };
```

Public origin metadata:

```ts
type TokenOrigin =
  | {
      readonly kind: "graph";
    }
  | {
      readonly kind: "fragment";
      readonly id: string;
    }
  | {
      readonly kind: "source";
      readonly id: string;
      readonly sourceToken?: string;
    };
```

`origin.kind` reads naturally and gives clean exhaustive narrowing:

```ts
switch (token.origin.kind) {
  case "graph":
    break;

  case "fragment":
    console.log(token.origin.id);
    break;

  case "source":
    console.log(token.origin.id);
    break;
}
```

### Places where `kind` should not appear

Do not require it in ordinary authoring:

```ts
// Avoid
{
  value: {
    kind: "reference",
    key: "brand.primary",
  },
}
```

Prefer:

```ts
{
  value: {
    ref: "brand.primary",
  },
}
```

And avoid:

```ts
{
  kind: "by-mode",
  values: {
    light: "#fff",
    dark: "#111",
  },
}
```

Prefer a domain property:

```ts
{
  valueByMode: {
    light: "#fff",
    dark: "#111",
  },
}
```

This keeps `kind` as implementation vocabulary rather than visual noise in every user-authored token.

---

# Recommended vocabulary changes

## 1. `Problem` → `Issue`

I now recommend:

```ts
interface Issue<Code extends string = string> {
  readonly code: Code;
  readonly message: string;
  readonly path?: string;
}

type Result<Value, I extends Issue> =
  | {
      readonly ok: true;
      readonly value: Value;
    }
  | {
      readonly ok: false;
      readonly issues: readonly [I, ...I[]];
    };
```

Rather than:

```ts
Problem;
problems;
```

`Issue`/`issues` is more aligned with modern TypeScript validation libraries. Zod stores structured `.issues` with `code`, `path`, and `message`; Valibot likewise uses issues as its validation unit. ([Zod](https://zod.dev/error-customization))

Usage becomes:

```ts
const result = compileTokenGraph(graph);

if (!result.ok) {
  for (const issue of result.issues) {
    console.error(
      issue.path === undefined
        ? `${issue.code}: ${issue.message}`
        : `${issue.path}: ${issue.code}: ${issue.message}`,
    );
  }
}
```

`Error` remains reserved for thrown exceptional failures. `Diagnostic` would also be defensible, but it implies warnings, severity levels, and compiler reporting infrastructure that v1 does not yet need.

## 2. `values` → `valueByMode`

The singular/plural distinction is too subtle:

```ts
value;
values;
```

Use:

```ts
value;
valueByMode;
```

The union becomes self-explanatory:

```ts
type TokenDefinitionInput<Mode extends string = string> = {
  readonly visibility?: TokenVisibility;
  readonly description?: string;
} & (
  | {
      readonly value: ColorExpressionInput;
      readonly valueByMode?: never;
    }
  | {
      readonly value?: never;
      readonly valueByMode: Readonly<Record<Mode, ColorExpressionInput>>;
    }
);
```

Examples:

```ts
"app.focus-ring": {
  value: "#1455d9",
}
```

```ts
"app.background": {
  valueByMode: {
    light: "#ffffff",
    dark: "#111111",
  },
}
```

```ts
"app.action": {
  value: {
    ref: "brand.primary",
  },
}
```

## 3. Keep `ref`, but never call it `$ref`

This is good:

```ts
{
  ref: "brand.primary";
}
```

Do not use:

```ts
{
  $ref: "brand.primary";
}
```

DTCG and JSON Schema give `$ref` JSON Pointer/URI semantics. DTCG’s `$ref` can address arbitrary document locations, whereas our reference targets a complete token identified by a token key. ([Design Tokens](https://www.designtokens.org/tr/drafts/format/))

Using plain `ref` makes the distinction intentional.

## 4. `schemaVersion` → `formatVersion`

The value identifies the version of our persisted graph format, not the version of a validator implementation:

```ts
{
  formatVersion: 1,
}
```

Optionally support `$schema` for editor validation:

```ts
{
  "$schema":
    "https://color-scheme-tokens.dev/schemas/token-graph.v1.json",

  "formatVersion": 1
}
```

`$schema` is tooling metadata. `formatVersion` controls runtime compatibility.

## 5. `compileGraph` → `compileTokenGraph`

This gives the core lifecycle a clear family:

```ts
defineTokenGraph(...)
parseTokenGraph(...)
compileTokenGraph(...)
```

At an arbitrary call site, `compileTokenGraph()` is less generic and more searchable than `compileGraph()`.

## 6. `createSchemeTokens` → `buildTokenSet`

`createSchemeTokens()` does not clearly communicate whether it defines tokens, generates a source graph, compiles references, or exports artifacts.

The intended operation is:

```text
source + fragments → compiled token set
```

So:

```ts
const result = buildTokenSet({
  source: material3Source(...),
  fragments: [application],
  selection: "public",
});
```

The verb taxonomy becomes:

```text
define      Typed source-code authoring
parse       Untrusted runtime input
compile     Graph → compiled token set
build       Source + fragments → compiled token set
export      Token set → external artifact
serialize   Token set → canonical JSON
format      One value → textual representation
convert     Color space → color space
map         Explicit lossy gamut operation
```

## 7. Keep `serializeTokenSet`

If it produces a canonical JSON string, `serializeTokenSet()` is more precise than `exportTokenSetJson()`:

```ts
const json = serializeTokenSet(tokenSet);
```

It should have exactly one canonical output form. Do not add `pretty`, `compact`, or indentation settings to the canonical serializer.

## 8. Use specific prefix names

Avoid generic `prefix` in multiple nested option objects:

```ts
exportCssVariables(tokenSet, {
  variablePrefix: "theme",

  modeSelectors: {
    strategy: "class",
    classPrefix: "scheme-",
  },
});
```

Rather than:

```ts
{
  prefix: "theme",
  modes: {
    strategy: "class",
    prefix: "scheme-",
  },
}
```

---

# Proposed final public surface

## Root

```ts
defineTokenGraph;
defineTokenFragment;

parseTokenGraph;
parseColor;

compileTokenGraph;
buildTokenSet;

exportCssVariables;
serializeTokenSet;
formatCssColor;
```

## Conversion subpath

```ts
convertColor;
isColorInGamut;
mapColorToGamut;
```

## Material subpath

```ts
material3Source;
```

No public:

```ts
ref;
byMode;
publicToken;
internalToken;

validateGraph;
compileValidatedGraph;

applyLayers;
tokenKey;
modeKey;
hex;
srgb255;
```

---

# Refined intended graph shape

```ts
const graph = defineTokenGraph({
  formatVersion: 1,

  modes: ["light", "dark"],

  defaultMode: "light",
  defaultVisibility: "internal",

  tokens: {
    "brand.primary": {
      description: "Primary brand color",

      valueByMode: {
        light: "#6750a4",
        dark: "#d0bcff",
      },
    },

    "brand.on-primary": {
      valueByMode: {
        light: "#ffffff",
        dark: "#381e72",
      },
    },

    "app.action": {
      visibility: "public",

      value: {
        ref: "brand.primary",
      },
    },

    "app.action-text": {
      visibility: "public",

      value: {
        ref: "brand.on-primary",
      },
    },
  },
});
```

Raw JSON is the same structure:

```json
{
  "formatVersion": 1,
  "modes": ["light", "dark"],
  "defaultMode": "light",
  "defaultVisibility": "internal",
  "tokens": {
    "brand.primary": {
      "description": "Primary brand color",
      "valueByMode": {
        "light": "#6750a4",
        "dark": "#d0bcff"
      }
    },
    "app.action": {
      "visibility": "public",
      "value": {
        "ref": "brand.primary"
      }
    }
  }
}
```

---

# Additional edge cases found

## 1. Define what a mode means

The current model supports one flat list:

```ts
modes: ["light", "dark"];
```

Real design systems may also have:

```text
contrast
brand
density
accessibility
platform
```

Independent axes create combinations such as:

```text
light + normal contrast
light + high contrast
dark + normal contrast
dark + high contrast
```

The emerging DTCG Resolver work explicitly discusses independent contexts, modifiers, permutations, and combinatorial explosion—but it is currently marked as a preview that should not be implemented as an authoritative specification. ([Design Tokens](https://www.designtokens.org/tr/drafts/resolver/))

For v1, define:

> A mode is one complete resolved scenario, not an independently composable dimension.

Therefore:

```ts
modes: ["light", "dark", "light-high-contrast", "dark-high-contrast"];
```

A future resolver can construct those complete modes without changing the compiler’s core graph contract.

## 2. Set the identifier grammar now

I recommend one or more dot-separated lower-kebab-case segments:

```text
background
app.action
app.action-text
m3.on-primary
m3.surface-container-high
```

Recommended segment grammar:

```regex
^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$
```

Changes from the current contract:

- allow a single segment;
- allow hyphens;
- reject camelCase;
- reject uppercase;
- reject Unicode in identifiers;
- never silently normalize.

Descriptions remain unrestricted Unicode prose.

This also makes Material names more ecosystem-friendly:

```text
m3.onPrimary
```

becomes:

```text
m3.on-primary
```

## 3. Kebab-case reopens CSS collisions

Once both dots and hyphens are valid:

```text
a.b-c
a-b.c
```

cannot both map to:

```text
--a-b-c
```

Use distinct hierarchy encoding:

```text
app.action-text -> --theme--app--action-text
a.b-c           -> --theme--a--b-c
a-b.c           -> --theme--a-b--c
```

Since valid segments cannot contain consecutive hyphens, `--` can serve as an injective hierarchy separator.

Property-test the mapping over generated valid keys.

## 4. Duplicate members in raw JSON are not recoverable after parsing

Given text like:

```json
{
  "tokens": {
    "app.action": {
      "value": "#fff"
    },
    "app.action": {
      "value": "#000"
    }
  }
}
```

once an external JSON parser has produced an object, an object-level `parseTokenGraph(input)` cannot recover the discarded duplicate declaration.

Therefore, distinguish:

```text
object validation:
parseTokenGraph(input: unknown)

raw text parsing:
potential future parseTokenGraphJson(text: string)
```

Do not claim `parseTokenGraph()` detects duplicate JSON member names in source text.

## 5. Reject non-plain and hostile objects

For untrusted input:

- inspect own enumerable properties only;
- reject class instances, Dates, arrays where records are expected, accessors, and exotic prototypes;
- never use prototype-sensitive `in` checks for record membership;
- avoid unsafe merging with `Object.assign()` or object spread;
- use `Map` or safe internal indexes;
- return newly allocated normal plain objects.

This applies to:

```text
tokens
valueByMode
extensions
source results
selector maps
compiled records
```

## 6. Be strict about unknown properties

This should fail:

```ts
{
  visiblity: "public",
  value: "#fff",
}
```

because `visiblity` is a typo.

Provide one explicit escape hatch:

```ts
{
  value: "#fff",

  extensions: {
    "com.example.design-tool": {
      category: "brand",
    },
  },
}
```

DTCG similarly defines namespaced extension metadata and recommends reverse-domain-style names to avoid collisions. ([Design Tokens](https://www.designtokens.org/tr/drafts/format/))

Useful optional ecosystem-aligned metadata:

```ts
description?: string;
deprecated?: boolean | string;
extensions?: Record<string, JsonValue>;
```

DTCG uses boolean-or-string deprecation for the same distinction: deprecated with or without an explanation. ([Design Tokens](https://www.designtokens.org/tr/drafts/format/))

## 7. A reference object must be exact

Accept:

```ts
{
  ref: "brand.primary",
}
```

Reject:

```ts
{
  ref: "brand.primary",
  value: "#fff",
}
```

```ts
{
  ref: "brand.primary",
  unexpected: true,
}
```

```ts
{
  ref: 42,
}
```

References should resolve the target token in the **current mode**. Cross-mode references are not part of v1:

```ts
// Not supported in v1:
{
  ref: "brand.primary",
  mode: "light",
}
```

## 8. `valueByMode` must be exact

For:

```ts
modes: ["light", "dark"];
```

this fails because `dark` is absent:

```ts
{
  valueByMode: {
    light: "#fff",
  },
}
```

This fails because `sepia` is unknown:

```ts
{
  valueByMode: {
    light: "#fff",
    dark: "#111",
    sepia: "#e8dcc0",
  },
}
```

There is no fallback to the default mode.

Use `value` when one expression applies everywhere:

```ts
{
  value: "#fff",
}
```

Do not add partial overrides before there is a demonstrated need.

## 9. Dependencies must be mode-specific

This is insufficient:

```ts
dependencies: ["brand.primary", "brand.secondary"];
```

because a token may reference different dependencies by mode:

```ts
{
  valueByMode: {
    light: {
      ref: "brand.primary",
    },

    dark: {
      ref: "brand.primary-container",
    },
  },
}
```

Use:

```ts
interface CompiledToken<Mode extends string = string> {
  readonly valueByMode: Readonly<Record<Mode, ColorValue>>;

  readonly origin: TokenOrigin;

  readonly dependenciesByMode: Readonly<Record<Mode, readonly TokenKey[]>>;
}
```

Define whether these are direct dependencies or transitive dependencies. My recommendation is a deterministic transitive closure; direct edges remain available in the graph.

## 10. Visibility is not a secrecy boundary

A public token can reference an internal token:

```text
app.action → m3.primary
```

If compiled metadata includes dependencies or origin, the name `m3.primary` may still appear in exported JSON.

Therefore:

> `visibility` controls default emission of token values. It does not provide confidentiality, authorization, or redaction.

Decide separately whether `serializeTokenSet()` includes origin and dependency metadata.

## 11. Fragment IDs need uniqueness

Even when token keys do not collide:

```ts
fragments: [
  {
    id: "application",
    tokens: {
      /* ... */
    },
  },
  {
    id: "application",
    tokens: {
      /* ... */
    },
  },
];
```

must fail.

Otherwise:

```ts
origin: {
  kind: "fragment",
  id: "application",
}
```

is ambiguous.

Reordering non-conflicting fragments must not change compiled values or canonical serialization.

## 12. Define empty exact selection

For:

```ts
selection: {
  keys: [],
}
```

return:

```ts
{
  code: "empty-selection",
  message: "Exact token selection must contain at least one key.",
}
```

Also reject duplicate requested keys. Exact selection may include internal tokens because visibility is not access control.

## 13. Suppress cascading issues

An invalid mode declaration can otherwise produce:

```text
invalid-mode
unknown-mode
missing-mode-value
missing-mode-value
...
```

Only report actionable primary failures. Do not emit secondary issues whose prerequisite data is already invalid.

Also cap issue accumulation deterministically for hostile input. A large malformed graph should not allocate millions of issue objects.

## 14. Specify the concrete color-string grammar

A function named `parseColor()` must accept more than six-digit hex or be renamed.

A sensible initial concrete grammar:

```text
#rgb
#rgba
#rrggbb
#rrggbbaa

rgb(...)
oklch(...)
color(display-p3 ...)
transparent
```

Explicitly reject contextual/computed CSS values:

```text
currentColor
var(--brand)
light-dark(...)
system colors
relative color syntax
calc(...)
```

Those do not represent standalone concrete color values without an external CSS evaluation context.

## 15. Define out-of-gamut CSS behavior

A finite color can be valid while outside its named RGB gamut.

The root CSS exporter should:

- preserve its coordinates;
- serialize it accurately;
- never silently clip or gamut-map.

Explicit conversion/mapping remains:

```ts
mapColorToGamut(...)
```

Automatic wide-gamut fallback generation should only be available through the conversion capability because it requires a deliberate lossy policy.

## 16. Publish JSON Schemas

A data-first API should ship versioned schemas for:

```text
TokenGraphInput
TokenFragmentInput
CompiledTokenSet
```

Then JSON authors get editor diagnostics without running TypeScript:

```json
{
  "$schema": "https://color-scheme-tokens.dev/schemas/token-graph.v1.json",
  "formatVersion": 1
}
```

Tests must ensure TypeScript types, runtime parsers, schemas, and documentation examples agree.

## 17. Material token availability must be stable or discoverable

The current Material adapter has optional roles whose presence varies with upstream specification/platform behavior. The tests explicitly distinguish required roles from optional dim roles.

Before publication, choose one contract:

- emit only a stable guaranteed key inventory;
- guarantee all advertised keys somehow;
- or expose Material-specific required/optional key metadata from the Material subpath.

Do not leave application fragments guessing whether:

```ts
{
  ref: "m3.primary-dim",
}
```

will exist.

## 18. Sources should remain synchronous and deterministic

A custom source should be defined as producing the same graph for the same captured JSON options:

```ts
interface TokenSource<I extends Issue> {
  readonly id: string;

  build(): Result<TokenGraphInput, I>;
}
```

Remote files and asynchronous work happen before source construction:

```ts
const data = await fetch(...).then(
  response => response.json(),
);

const source = mySource({
  data,
});
```

This avoids duplicating every API into sync and async versions.

---

## Recommended final naming snapshot

```ts
// Results
Issue;
Result;
issues;
code;
path;
message;

// Authoring
TokenGraphInput;
TokenFragmentInput;
TokenDefinitionInput;
ColorExpressionInput;
TokenVisibility;

value;
valueByMode;
ref;
visibility;
defaultVisibility;
description;
deprecated;
extensions;

// Operations
defineTokenGraph;
defineTokenFragment;
parseTokenGraph;
parseColor;
compileTokenGraph;
buildTokenSet;
exportCssVariables;
serializeTokenSet;
formatCssColor;

// Compiled data
CompiledTokenSet;
CompiledToken;
TokenOrigin;
origin.kind;
dependenciesByMode;

// Export configuration
variablePrefix;
modeSelectors;
strategy;
classPrefix;
format;

// Conversion
convertColor;
isColorInGamut;
mapColorToGamut;
method;
outputSpace;
```

So the exact answer is:

> **Keep `kind`, but treat it as a scalpel rather than a default property name.** It belongs on closed discriminated unions such as `TokenOrigin` and internal expression nodes. It should not appear in ordinary token authoring, errors, strategy objects, or mode values.

The naming decisions and all newly found edges are now recorded in issue #1.
