# AGENTS.md

## Repository stance

This package is greenfield and unpublished. Breaking changes are allowed when they simplify the final public contract. Do not add deprecated aliases, compatibility wrappers, old-format readers, migration overloads, or hidden fallback branches.

Before adding code, check for existing functions, helpers, types, tests, and patterns that can be reused or deleted.

## Package boundary

`scheme-tokens` is a dependency-light compiler for authored string-valued token graphs.

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

## Documentation authority

Durable documentation describes the current package. Keep these aligned with the shipped contract:

- `README.md`
- `docs/architecture.md`
- `docs/public-api.md`
- `docs/diagnostics.md`
- `docs/color-policy.md`
- `docs/semver.md`
- `docs/adr/`

The migration guide is a concise pre-release handoff, not a compatibility commitment.

## Validation

Run the strongest available validation before reporting completion:

```text
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
git diff --check
```

Do not publish, tag, create a release, change repository visibility, or change publication safety without explicit instruction.

## Final report

Report files changed, validation commands and results, remaining risks, Git status, and a suggested Conventional Commit message.
