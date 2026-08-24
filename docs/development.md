# Development

Node `>=24` and pnpm `11.23.0`. The root `packageManager` field pins the exact pnpm version, and the supported launcher for repository work is direct `pnpm ...`. Do not prefix project commands with `corepack`: during the 0.3.0 release, that explicit Corepack invocation selected an ambient version instead of the repository pin, while direct pnpm honored the pin. Everything under `scripts/` is TypeScript run directly with `node --experimental-strip-types`, so those files have no build step and must stay dependency-light. GitHub Actions certifies Node 24 as the minimum supported runtime and Node 26 as the forward-compatibility line.

Use the strongest local gates before reporting release readiness:

```sh
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
git diff --check
```

`pnpm validate` runs typecheck, lint, unit/property/schema/type tests, filename checks, API build/check, and formatting.

`pnpm release:check` adds package checks, packed root consumer smoke, packed consumer module resolution, a packed theme-coordinate consumer, tarball checks, docs-site checks, docs example checks, and an external packed-consumer audit.

The workspace also contains `@scheme-tokens/material3` under `packages/material3`. Root validation
runs its normal type, runtime, API, and build gates. Root release validation additionally runs its
pinned-engine capability matrix, packed-package and tarball inspection, licensing checks, and clean
Node ESM plus strict NodeNext release-candidate consumers. The release-candidate proof applies the
pending Changesets transformation only inside a temporary workspace; it never versions the real
branch.

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

CI runs `pnpm check:changeset`, which fails when the API snapshot moved against the base branch without either a pending changeset or its applied package-version and changelog evidence. Applied release metadata covers only the snapshot committed at the version transition: later API-snapshot drift must have a new pending changeset, while later non-API commits remain covered. This keeps the gate valid both before and after normal Changesets consumption. The gate detects declaration-snapshot movement, not every behavioural change. Ordering and other runtime contracts that leave declarations unchanged still require a changeset through policy and review. `pnpm changeset:version` applies pending files to `package.json` and `CHANGELOG.md`.

On pull requests, `release-check` validates GitHub's synthetic merged result, while `api-contract` explicitly checks out the pull-request head with full history. The changeset gate needs that real branch history to locate the package version transition and fails closed if it is accidentally run at the event's synthetic merge SHA.

The pinned Changesets configuration enables `onlyUpdatePeerDependentsWhenOutOfRange`. This keeps a
deliberately proven workspace peer union intact when the versioned package still satisfies it, but
still updates and releases the peer dependent when a future version leaves the declared range. The
option is namespaced as experimental upstream, so a Changesets upgrade must revalidate this
candidate transformation before changing the exact tool pin.

## Toolchain pins

`@types/node` is pinned to the Node 24 line so repository-owned Node scripts are checked against the minimum supported runtime rather than the forward-compatibility line.

`tsdown` is pinned to `0.22.3`. Later 0.22 releases load a native parser binding that Windows application-control policy blocks on the maintainer's machine, which fails `pnpm build` and every gate downstream of it. Bump it only after confirming the build still runs locally.

The docs site pins `vitepress`, `@shikijs/vitepress-twoslash`, and `typescript` to exact versions, and `scripts/check-docs-site.ts` asserts the resolved versions, so a docs toolchain bump is a two-file change.

## Packaging gates

`pnpm package:check` packs the tarball once and runs publint and `@arethetypeswrong/cli` against it, so both read the exact bytes a consumer installs.

`pnpm check:module-resolution` installs that tarball into a scratch project and reads all five export keys under `moduleResolution` `bundler` and `node16`, then executes the compiled Node consumer.

Do not publish, tag, create a GitHub release, change repository visibility, or change the publication safety switch unless explicitly instructed.
