# Development

Use the strongest local gates before reporting release readiness:

```sh
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
git diff --check
```

`pnpm validate` runs typecheck, lint, unit/property/schema/type tests, filename checks, API build/check, and formatting.

`pnpm release:check` adds package checks, packed root consumer smoke, packed consumer module resolution, a packed theme-coordinate consumer, tarball checks, docs-site checks, docs example checks, and an external packed-consumer audit.

## API surface snapshot

`api/scheme-tokens.api.d.ts` is the committed public type surface, generated from the built declaration. `pnpm api:check` fails when the build and the snapshot disagree, so a contract change has to arrive as a reviewable diff rather than as a silent declaration edit.

```sh
pnpm api:snapshot
```

## Changesets

Any change that alters published behaviour needs a changeset:

```sh
pnpm changeset
```

CI runs `pnpm check:changeset`, which fails when the API snapshot moved against the base branch without a changeset in the same branch. `pnpm changeset:version` applies pending files to `package.json` and `CHANGELOG.md`.

## Packaging gates

`pnpm package:check` packs the tarball once and runs publint and `@arethetypeswrong/cli` against it, so both read the exact bytes a consumer installs.

`pnpm check:module-resolution` installs that tarball into a scratch project and reads all five export keys under `moduleResolution` `bundler` and `node16`, then executes the compiled Node consumer.

Do not publish, tag, create a GitHub release, change repository visibility, or change the publication safety switch unless explicitly instructed.
