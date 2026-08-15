# AGENTS.md

`scheme-tokens` is a dependency-light compiler for authored string-valued token graphs. It is a compiler, not a transformer: Style Dictionary and Terrazzo consume a token file and fan it out to platform artifacts, while this package composes and resolves the graph that exists before there is a file — layered composition, explicit references, visibility, provenance, deterministic output.

## Repository stance

The package is published on npm; the first release went out on 2026-08-01. The only known consumer is the author's own site, so development stays greenfield: before `1.0.0`, a breaking change is allowed whenever it simplifies the final public contract.

Do not add deprecated aliases, compatibility wrappers, old-format readers, migration overloads, or hidden fallback branches. Published does not mean frozen, but it does mean visible: every published-behaviour change lands with a changeset, and a declaration change also lands as an intentional API snapshot diff, never as a silent alias or a quiet widening.

Before adding code, check for existing functions, helpers, types, tests, and patterns that can be reused or deleted.

## Commands

Node `>=24` and pnpm `11.7.0` through Corepack. Scripts under `scripts/` are TypeScript executed with `node --experimental-strip-types`; they have no build step, so keep them dependency-light and free of syntax that type stripping cannot erase.

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

The package does not own palette generation, color parsing or conversion, gamut mapping, contrast policy, image extraction, repair decisions, design-system role conventions, product project models, or runtime plugin registries. Do not broaden the value model beyond strings and explicit reference records.

The boundary is enforced, not merely documented: `tests/unit/package-boundary.test.ts` asserts the absent color surface and the absent adapter directory, and `scripts/check-api.ts` fails the build when the bundle or the published documentation names a forbidden identifier.

## Final public contract

The root runtime exports are exactly:

- `defineTokens`
- `defineTokenGraph`
- `defineTokenLayer`
- `tokenRef`
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
- Providing `modes` requires an explicit `defaultMode`.
- Mode names reserve `ref`, `value`, `valueByMode`, `visibility`, `description`, `deprecated`, and `extensions` so object authoring stays unambiguous.
- The graph exclusively owns the mode envelope. Layers never declare modes or a default mode.
- Layer order is semantic: later layers override earlier definitions by token key.
- Graph and layer defaults own visibility only for their respective token records.
- Public tokens may reference internal tokens; compilation resolves against the complete graph before applying selection.
- Token keys use dot-separated lower-kebab paths. A segment after the first may be numeric, so keys such as `brand.600` are valid.
- Omitted and explicit `public` compilation produce conservatively partial token records because visibility is resolved at runtime. An exact literal key tuple is complete after runtime validation. `all` is complete only when the authored graph has a finite inferred key union; dynamically parsed graphs remain partial. `parseCompiledScheme()` is always dynamic and incomplete, and CSS export preserves the input completeness in its token-to-variable lookup.

Trusted helpers normalize, validate, and copy input. They may throw for programmer misuse. Parsers accept `unknown`, do not throw for JSON-compatible data, copy accepted input, and report structured `Result` failures.

Compilation and serialization preserve arbitrary token strings. CSS export is a code-emission boundary: it rejects declaration-unsafe strings with `invalid-css-value`, validates selectors against an intentionally bounded safe grammar, and never treats those checks as token-domain interpretation.

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
