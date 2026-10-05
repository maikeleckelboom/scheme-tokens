# Development

Use Node.js 24 or newer and pnpm `11.23.0`, pinned by the root `packageManager` field.
Run repository commands directly as `pnpm ...`. Scripts are TypeScript executed with
`node --experimental-strip-types`; keep their syntax compatible with type stripping.

## Local checks

```sh
pnpm install --frozen-lockfile
pnpm validate
pnpm release:check
git diff --check
```

| Command              | Checks                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm validate`      | Both packages: types, lint, runtime tests, API snapshots, builds, and formatting; core also checks properties, schemas, the v1 oracle, and filenames |
| `pnpm docs:check`    | Builds the docs site and runs `test:docs`                                                                                                            |
| `pnpm test:docs`     | Extracts public TypeScript examples and typechecks them against paired tarballs                                                                      |
| `pnpm release:check` | Validation plus package lint, tarball contents, packed consumers, declaration and module resolution checks, documentation, and consumer audit        |
| `pnpm test:browsers` | CSS activation and reference behavior in Chromium, Firefox, and WebKit                                                                               |

Use focused tests during implementation and the release check once the tree is ready.
Root release checks include Material engine capabilities, licensing, and paired consumers.

## Browser checks

Install engines once per Playwright version:

```sh
pnpm exec playwright install chromium firefox webkit
pnpm test:browsers
```

The suite loads the built exporter and checks computed styles: activation order, nested themes,
cascade layers, Shadow DOM, live references, and CSS substitution limits. It is separate from
`release:check` because it requires browser binaries. Run it for CSS output, option, or grammar
changes. CI runs it as a blocking job.

Historical expectations in `tests/fixtures/css-reference-p4-output.json` and
`tests/oracle/published-0.3.0.json` are fixed compatibility evidence. Preserve them rather than
regenerating expected values from the implementation under test.

## TypeScript compatibility

Consumer support is
`>=5.9.3 <6.0.0 || >=6.0.2 <7.0.0 || >=7.0.2 <8.0.0`.
The repository development compiler is TypeScript `7.0.2`.

- `pnpm test:types` checks authoring and selection types under strict-only and stricter settings.
- `pnpm check:packed-types` runs the core matrix against installed declarations and checks
  consumer declaration emission and diagnostic quality.
- Material's type tests run against source and built declarations; its packed consumer runs the
  same matrix against the paired tarballs.
- `pnpm type:compat:stable` checks the supported compiler floors and repository stable compiler,
  deduplicating equal versions. CI selects `5.9`, `6.0`, and `7.x` separately.
- `pnpm type:compat:next` runs the compatibility suite as a non-blocking signal.

All compatibility checks use `skipLibCheck: false`. The stable suite covers source, packed
declarations, module resolution, and coordinate examples. See
[ADR 0017](./adr/0017-consumer-compiler-support.md) for the support policy.

`pnpm profile:types [runs] [declaration]` measures a generated 2,000-token graph against built
declarations or another declaration file. It reports timings and is not a release gate.

## Package checks

`pnpm package:check` runs publint and `@arethetypeswrong/cli` on the same packed bytes.
`pnpm check:tarball` inspects shipped files, including the README.
`pnpm check:module-resolution` checks the five export keys under Bundler and Node16 resolution
and executes a compiled Node consumer.

Paired checks install the versions prepared by Changesets with Material's core peer `^0.4.0`.
The shared packing helper versions only a temporary workspace when changesets are pending;
with none pending, it uses the manifest versions. Consumers install with strict peer checking.

`pnpm candidate:pack <empty-output-directory>` records Git source hashes, the binary-safe diff,
and paired tarballs. Source inputs must be tracked, and output directories must be fresh.
`pnpm check:candidate` verifies reconstruction and artifact digests, then performs a fresh frozen
paired install in a second consumer with an empty store. It also checks both coordinate examples.

## API snapshots and changesets

The committed snapshots are `api/scheme-tokens.api.d.ts` and
`packages/material3/api/material3.api.d.ts`. Regenerate them only for an intended API change:

```sh
pnpm api:snapshot
pnpm --filter @scheme-tokens/material3 api:snapshot
```

Published behavior changes need a changeset:

```sh
pnpm changeset
```

`pnpm changeset:version` applies pending changesets to manifests and changelogs. CI's
`check:changeset` detects API-snapshot drift: applied release metadata covers the snapshot at
its version transition, while later API changes need a new pending changeset. Behavioral changes
that leave declarations unchanged still require a changeset through review.

Changesets preserves a peer range when the new dependency version still satisfies it, using
`onlyUpdatePeerDependentsWhenOutOfRange`. Recheck this behavior when upgrading Changesets.
See [Semver](./semver.md) for versioned contracts.

## Toolchain pins and CI

- `@types/node` targets Node 24, the minimum supported runtime.
- `tsdown@0.23.0` builds with the TypeScript 7 toolchain.
- `@playwright/test@1.61.0` supplies engines that launch under the maintainer's Windows
  application-control policy. Check all three locally before changing the pin.
- The docs site pins VitePress `2.0.0-alpha.17` and TypeScript `7.0.2`; `docs:check` asserts
  the installed versions.

CI runs release gates on Node 24 and 26, the API contract, CSS browsers, and supported TypeScript
lines. TypeScript next is non-blocking. For pull requests, release validation uses the merged
result; API history checks use the real pull-request head with full history.

Versioning, publication, tags, and GitHub Releases are separate maintainer actions. Publication
requires explicit authorization.
