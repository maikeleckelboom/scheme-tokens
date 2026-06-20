# AGENTS.md

## Repository stance

This package is greenfield and unpublished. Breaking changes are allowed when they simplify the final public contract.
Do not add deprecated aliases, compatibility wrappers, v0 readers, migration overloads, or hidden fallback branches.

Before adding new code, first check for existing functions, helpers, utilities, types, tests, and patterns that can be
reused or deleted.

## Package boundary

`color-scheme-tokens` is the dependency-light core package.

The core package owns:

* token graph contracts
* JSON-safe public authoring inputs
* graph parsing and validation
* token compilation
* deterministic serialization
* CSS variable export
* `Result` and `Issue` contracts
* adapter interfaces

The core package must not own engine-backed behavior. Do not import or depend on Material 3, Texel, image extraction,
browser canvas, CSS color engines, or other optional capability engines from the root package.

Supported engines belong behind explicit adapter package boundaries, for example:

* `@color-scheme-tokens/source-material3`
* `@color-scheme-tokens/conversion-texel`
* future source or conversion adapters

If an adapter package does not exist yet, document it as future scope. Do not fake the behavior inside core.

Do not ship approximated Material output as Material 3. Material 3 support must use a real Material algorithm through a
dedicated adapter boundary, or not ship yet.

## Public API rules

* Root imports must not load optional engine dependencies.
* Public authoring data must stay JSON-safe.
* Public recoverable failures use `Result` with `issues`, not exceptions.
* `Issue.code` and JSON Pointer paths are contractual.
* Generated issue codes must be represented honestly in public types.
* Parsed wire formats stay strict and explicit.
* Ergonomic `define*` helpers may provide safe defaults and authoring shorthands.
* Defaults are allowed only when they do not hide authority or change semantics unexpectedly.
* Delete obsolete contracts outright instead of preserving old names.
* Do not publish, tag, create a GitHub release, or change repository visibility.
* Do not change the publication safety switch unless explicitly instructed.

## Implementation rules

Prefer small internal primitives over duplicated parsing and validation logic.

Reusable internals should have precise names and bounded ownership, for example:

* JSON pointer helpers
* code-unit sorting helpers
* plain-record readers
* issue collectors
* issue factories
* safe unknown-value descriptions
* exhaustive-switch assertions
* canonical record builders

Do not create a broad `utils.ts` dumping ground.

Avoid unsafe casts that lie about public contracts. In particular, do not cast generated issue codes into narrower issue
unions.

Do not call `String(value)` on untrusted unknown input when creating diagnostics. Use a safe bounded description helper
that cannot invoke user code.

Compiler behavior must be bounded and deterministic. Avoid quadratic dependency expansion, unnecessary full-graph
resolution, and stack-recursive resolution paths.

## Naming and files

Use kebab-case filenames for source, tests, scripts, and documentation unless the ecosystem convention requires a
different name.

Accepted conventional exceptions include:

* `AGENTS.md`
* `README.md`
* `CHANGELOG.md`
* `LICENSE`
* `package.json`
* `tsconfig.json`
* `index.ts`

Do not add `.mjs` files. Use `.ts` or `.mts`.

Use curly braces for all control-flow blocks. Configure Oxlint to enforce this when supported.

Keep public names plain and idiomatic. Prefer clear verbs such as `define`, `parse`, `compile`, `build`, `format`,
`export`, and `serialize`.

## Documentation authority

Durable documentation should describe the current package, not the migration sprint.

Use current docs such as:

* `README.md`
* `docs/architecture.md`
* `docs/public-api.md`
* `docs/diagnostics.md`
* `docs/color-policy.md`
* `docs/semver.md`
* `docs/decisions/`

`docs/v1-migration/` is historical migration context only. Do not treat it as active implementation authority. Do not
copy superseded API names, temporary migration wording, or old vocabulary from it.

If migration documents remain in the repository, they must not be included in the published package tarball.

## Validation

Run the strongest available validation before reporting completion:

```text
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
git diff --check
```

If validation scripts are changed during the work, report both the old and new validation commands.

## Final report

Report:

* files changed
* validation commands run and results
* remaining risks
* git status
* suggested commit message
