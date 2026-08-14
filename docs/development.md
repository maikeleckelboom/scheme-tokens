# Development

Node `>=22` and pnpm `11.7.0` through Corepack. Everything under `scripts/` is TypeScript run directly with `node --experimental-strip-types`, so those files have no build step and must stay dependency-light.

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

CI runs `pnpm check:changeset`, which fails when the API snapshot moved against the base branch without a changeset in the same branch. This gate detects declaration-snapshot movement, not every behavioural change. Ordering and other runtime contracts that leave declarations unchanged still require a changeset through policy and review. `pnpm changeset:version` applies pending files to `package.json` and `CHANGELOG.md`.

## Toolchain pins

`tsdown` is pinned to `0.22.3`. Later 0.22 releases load a native parser binding that Windows application-control policy blocks on the maintainer's machine, which fails `pnpm build` and every gate downstream of it. Bump it only after confirming the build still runs locally.

The docs site pins `vitepress`, `@shikijs/vitepress-twoslash`, and `typescript` to exact versions, and `scripts/check-docs-site.ts` asserts the resolved versions, so a docs toolchain bump is a two-file change.

## Packaging gates

`pnpm package:check` packs the tarball once and runs publint and `@arethetypeswrong/cli` against it, so both read the exact bytes a consumer installs.

`pnpm check:module-resolution` installs that tarball into a scratch project and reads all five export keys under `moduleResolution` `bundler` and `node16`, then executes the compiled Node consumer.

Do not publish, tag, create a GitHub release, change repository visibility, or change the publication safety switch unless explicitly instructed.
