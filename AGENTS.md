# AGENTS.md

`scheme-tokens` is a dependency-light compiler for authored string-valued token graphs. It is a compiler, not a transformer: Style Dictionary and Terrazzo consume a token file and fan it out to platform artifacts, while this package composes and resolves the graph that exists before there is a file — layered composition, explicit references, visibility, provenance, deterministic output.

## Repository stance

The package is published on npm; the first release went out on 2026-08-01. The only known consumer is the author's own site, so development stays greenfield: before `1.0.0`, a breaking change is allowed whenever it simplifies the final public contract.

Do not add deprecated aliases, compatibility wrappers, old-format readers, migration overloads, or hidden fallback branches. The one exception is persisted source artifacts: token graphs and token layers stay readable through the deterministic, lossless format-upgrade steps that [ADR 0013](docs/adr/0013-coherent-token-model.md) (D10) requires, one step per format version. Compiled schemes are never upgraded. Published does not mean frozen, but it does mean visible: every published-behaviour change lands with a changeset, and a declaration change also lands as an intentional API snapshot diff, never as a silent alias or a quiet widening.

Before adding code, check for existing functions, helpers, types, tests, and patterns that can be reused or deleted.

## Commands

Node `>=24` and pnpm `11.23.0`. The root `packageManager` field owns the exact pnpm version; invoke repository commands directly as `pnpm ...`. Do not prefix them with `corepack`: during the 0.3.0 release, that explicit Corepack invocation selected an ambient version instead of the repository pin, while direct pnpm honored the pin. Scripts under `scripts/` are TypeScript executed with `node --experimental-strip-types`; they have no build step, so keep them dependency-light and free of syntax that type stripping cannot erase.

```sh
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
git diff --check
```

- `pnpm validate` — typecheck, lint, unit, property, schema and type tests, filename check, build, API check, formatting.
- `pnpm release:check` — everything in `validate`, plus packaging, packed-consumer, module-resolution, tarball, docs-site, doc-example, and external-consumer audit gates.
- `pnpm api:snapshot` — regenerate `api/scheme-tokens.api.d.ts` after an intended contract change.
- `pnpm changeset` — required whenever published behaviour or the API snapshot moves.
- `pnpm format:fix` — apply Oxfmt.

Run the strongest gate the change deserves before reporting completion, and report exactly which commands ran.

`tsdown` and the docs-site toolchain are pinned on purpose; `docs/development.md` records why. Do not bump them as drive-by maintenance.

## Package boundary

The package owns:

- token graph and layer contracts;
- explicit token references;
- graph modes and default mode authority;
- ordered layer composition;
- public and internal visibility;
- graph validation and deterministic compilation;
- structured diagnostics;
- strict persisted artifacts and JSON Schemas;
- deterministic serialization;
- CSS custom-property projection;
- `Result` and `Issue` contracts.

The package does not own palette generation, color parsing or conversion, gamut mapping, contrast policy, image extraction, repair decisions, design-system role conventions, product project models, or runtime plugin registries. Do not broaden the value model beyond strings, explicit references, and flat concat expressions.

The boundary is enforced, not merely documented: `tests/unit/package-boundary.test.ts` asserts the absent color surface and the absent adapter directory, and `scripts/check-api.ts` fails the build when the bundle or the published documentation names a forbidden identifier.

## Final public contract

The root runtime exports are exactly:

- `defineTokenGraph`
- `defineTokenLayer`
- `tokenRef`
- `tokenConcat`
- `orThrow`
- `parseTokenGraph`
- `parseTokenLayer`
- `parseCompiledScheme`
- `compileTokenGraph`
- `exportCssVars`
- `serializeTokenGraph`
- `serializeTokenLayer`
- `serializeCompiledScheme`

Do not export implementation plumbing merely because it exists internally.

Every fallible public operation uses:

```ts
type Result<Value, Problem> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly issues: readonly [Problem, ...Problem[]] };
```

Do not add operation-specific success fields.

## Authoring and wire rules

- Bare strings are literal values and never inferred as references.
- References use `tokenRef()` in trusted authoring and exact `{ ref: "token.key" }` records in persisted data.
- A token is authored as a direct expression, a direct explicit mode map, or one expanded `{ value, visibility?, description?, deprecated?, extensions? }` definition.
- `value` may contain either one expression or an explicit mode map.
- Do not add `valueByMode`, `aliases`, metadata mixed with mode keys, or alternate expanded forms.
- Omitted mode options mean `modes: ["base"]` and `defaultMode: "base"`.
- Providing `modes` requires an explicit `defaultMode`. Preserve authored mode order independently of the default.
- Mode names reserve `ref`, `value`, `visibility`, `description`, `deprecated`, and `extensions` so object authoring stays unambiguous.
- The graph exclusively owns the mode envelope. Layers never declare modes or a default mode. Their mode maps must share one set, equal to the graph set when non-empty; runtime mismatches use `layer-mode-mismatch`.
- ADR 0015 supersedes only ADR 0013's reservation of `concat`: exact singleton `{ concat: array }` is an expression; `{ concat: TokenExpression }` is a mode map. `concat` is not reserved.
- Concat canonicalization merges literals, drops empties, collapses literals/lone refs, and rejects empty/nested concat. Resolution is iterative with a 65,536 UTF-16 concat bound checked before joining.
- D6 metadata contains non-empty `declarations` and sparse `expressionByMode`, with resolved `value` only on concat reference parts.
- Current artifacts/writers use format version 2. V1 source upgrades retain published semantics and pass the ordinary v2 validator; compiled v1 is rejected. V2 `$schema` is an uninterpreted optional string; authoring helpers reject it.
- Layers compose in array order, followed by graph tokens. Graph-owned declarations win.
- Only explicit visibility changes an existing key. Otherwise the introducing position's default applies; descriptive metadata comes only from the winner.
- Public tokens may reference internal tokens; compilation resolves against the complete graph before applying selection.
- Token keys use dot-separated lower-kebab paths. A segment after the first may be numeric, so keys such as `brand.600` are valid.
- Omitted and explicit `public` compilation produce complete records keyed by the static public key union when it is finite and fully known: literal keys and literal visibility at every composition position. Uncertain visibility or a dynamic key set anywhere keeps them partial over every graph key. An exact literal key tuple is complete after runtime validation. `all` is complete only for a finite composed key union; parsed graphs, dynamic key sets, non-tuple layer lists, and runtime key arrays remain partial. `parseCompiledScheme()` is always dynamic and incomplete, and CSS export preserves the input completeness in its token-to-variable lookup.

Trusted helpers normalize, validate, and copy input. They throw structured `Error` failures with the complete issues tuple in `cause`, matching `orThrow`. Parsers accept `unknown`, do not throw for JSON-compatible data, copy accepted input, and report structured `Result` failures.

Compilation and serialization preserve arbitrary token strings. CSS export is a code-emission boundary: it rejects declaration-unsafe strings with `invalid-css-value`, validates selectors against an intentionally bounded safe grammar, and never treats those checks as token-domain interpretation.

The static contract is `TokenGraph<Key, Mode, PublicKey>` and `TokenLayer<Key, Mode, Visibility>`. Layer `Mode` is `never` without mode maps, a finite union for literal layers, and `string` when unknown; `LayerVisibility` records the default and the keys that may declare `public`, declare `internal`, or omit visibility, so a wider type only adds possibilities. Finite key unions are exact claims. Authoring uses plain `const` capture with a strict validating constraint whose valid branch is `unknown`, so contextual typing never expands the expected shapes; keep that shape when editing it, and classify expressions structurally (ADR 0015). Do not export validation or composition machinery; the diagnostic markers stay unexported. The supported TypeScript range is `>= 7.0 < 8.0`; `pnpm type:compat:stable` and `pnpm check:packed-types` prove the source and packed declaration matrices. The P4 CSS redesign, P4a variable references, and P5 Material API are deferred. Current CSS naming remains double-hyphen and Material returns a graph fragment.

## Implementation rules

Prefer small, precisely owned internals over duplicated parsing and validation. Do not create a broad `utils.ts` dumping ground.

Issue codes and JSON Pointer paths are public contracts. Message wording is not. Avoid unsafe casts that narrow real issue-code unions, and never call untrusted coercion methods while constructing diagnostics.

Compiler, parser, serializer, and CSS output must be independent of locale, caller mutation, and incidental object insertion order. Keep reference resolution iterative and bounded.

Use kebab-case filenames for source, tests, scripts, and documentation unless an ecosystem convention requires otherwise. Accepted exceptions include `AGENTS.md`, `README.md`, `CHANGELOG.md`, `LICENSE`, `package.json`, `tsconfig.json`, and `index.ts`.

Do not add `.mjs` files. Use curly braces for every control-flow block. Prefer Oxlint and Oxfmt.

## Documentation

Durable documentation describes the current package, and the documentation gates hold it to the current export surface. Keep these aligned with the shipped contract:

- `README.md`
- `docs/architecture.md`
- `docs/public-api.md`
- `docs/diagnostics.md`
- `docs/color-policy.md`
- `docs/application-theme-coordinates.md`
- `docs/development.md`
- `docs/roadmap.md`
- `docs/semver.md`
- `docs-site/`

Records are not rewritten to match the current contract:

- `docs/adr/` — one decision per file, including proposals that name internals and out-of-boundary packages. The export-surface gates skip them. Reversing an accepted decision means adding an ADR that supersedes it, not editing the old one.
- `docs/audit-YYYY-MM.md` — dated point-in-time reports, also skipped.
- `docs/agents-context.md` — the settled decisions, the enforcement pointers, and the alternatives that were already evaluated and rejected. It may name a forbidden identifier in prose, but it is still held to the export surface when it presents a symbol as package API. Read it before proposing an architectural change.

`docs/migration.md` records the reset from the pre-0.1 internal API. It is a historical handoff, not a compatibility commitment.

## Release and versioning

`api/scheme-tokens.api.d.ts` is the committed public type surface. `pnpm api:check` fails when the build and the snapshot disagree, and CI fails when the snapshot moved without a changeset. This automatically enforces declaration drift only. Behavioural contracts that leave declarations unchanged still require a changeset by policy and review.

Versioning policy lives in `docs/semver.md`; `CHANGELOG.md` is generated from changesets by `pnpm changeset:version`.

Do not publish, tag, create a release, change repository visibility, or change publication safety without explicit instruction.

## Git

Work on `dev`. Make atomic, scoped commits per logical change with Conventional Commit subjects, and preserve unrelated work in the tree. Do not push, force-push, reset, or rewrite shared history.

## Final report

Report files changed, validation commands and results, remaining risks, Git status, and a suggested Conventional Commit message. When you commit, report the branch, SHA, and subject per commit.
