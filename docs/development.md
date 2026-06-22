# Development

Use the strongest local gates before reporting release readiness:

```sh
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
git diff --check
```

`pnpm validate` runs typecheck, lint, unit/property/schema/type tests, filename checks, API build/check, and formatting.

`pnpm release:check` adds package checks, packed root consumer smoke, tarball checks, docs-site checks, docs example checks, and an external packed-consumer audit.

Do not publish, tag, create a GitHub release, change repository visibility, or change the publication safety switch unless explicitly instructed.
