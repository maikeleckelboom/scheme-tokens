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

`pnpm release:check` adds package checks, packed root consumer smoke, the packed declaration type matrix, packed consumer module resolution, a packed theme-coordinate consumer, tarball checks, docs-site checks, docs example checks, and an external packed-consumer audit.

The workspace also contains `@scheme-tokens/material3` under `packages/material3`. Root validation
runs its normal type, runtime, API, and build gates. Root release validation additionally runs its
pinned-engine capability matrix, packed-package and tarball inspection, licensing checks, and clean
Node ESM plus strict NodeNext release-candidate consumers. The release-candidate proof applies the
pending Changesets transformation only inside a temporary workspace; it never versions the real
branch.

During P2 that isolated projection is core `0.4.0` plus a peer-only Material `0.1.2` patch, with
the existing Material API. The repository manifests remain `0.3.0`/`0.1.1`. This proves packed
runtime/type compatibility; it does not implement the P5 Material API or certify an intermediate
phase for publication. P5/P7 must update the projected pair when their changesets land.

## TypeScript compatibility

The supported compiler range is `>= 7.0 < 8.0`. `pnpm test:types` runs the source type matrix in `tests/types` under the repository's strict configuration and again under `strict` alone, both with `skipLibCheck: false`. The matrix covers the authoring error cases, visibility composition, selection completeness, layer mode sets, dynamic and parsed inputs, ADR 0015's structural `concat` classification, the graph's definite own tokens, and the nominal static claims: raw, spread, and frozen data that must not forge keys, public keys, modes, or layer visibility.

`pnpm check:packed-types` packs the real tarball, installs it into an isolated NodeNext consumer, and runs the same `tests/types` files against the emitted declarations under both configurations; the stricter one also enables `declaration`, so helper results must stay nameable. It then checks diagnostic quality by fragments rather than whole messages: reference suggestions for graph, layer, expanded mode-map, and concat typos, the diagnostic marker names, including both mode sets of a layer mismatch, and the missing `StaticProof` of a forged graph or layer claim.

`pnpm type:compat:stable` runs the source matrices, both packages' type cases, the packed smoke consumer, the packed declaration matrix, and the Material packed consumers with the latest 7.0 patch and the repository's stable 7.x. When both resolve to one version, the runner executes it once. `pnpm type:compat:next` runs the same suite with `typescript@next` as a non-blocking signal.

`pnpm profile:types [runs] [declaration]` measures the check time of a generated 2,000-token literal graph against the built declarations, or against another declaration file for comparison. It reports evidence and is not a gate. On TypeScript 7.0.2, with 11 paired runs on the maintainer machine, the P2 declarations measured a 0.255 s median (0.249–0.261 s) and the P3 declarations 0.150 s (0.143–0.154 s). With nominal claims, a later interleaved rerun measured 0.194 s (0.185–0.202 s) against 0.177 s (0.169–0.187 s) for the P3 declarations. The strict authoring constraint resolves to `unknown` for valid input, so contextual typing does not expand the expected shapes; a variant that kept them in the valid branch measured about 0.4 s.

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

`tsdown` is pinned to `0.23.0`. The prior `0.22.3` pin could not generate declarations with TypeScript 7. The new pin passed a local Windows build; the earlier Windows application-control issue with later 0.22 releases remains a reason to test toolchain bumps on the maintainer's machine.

The docs site pins `vitepress` and `typescript` to exact versions, and `scripts/check-docs-site.ts` asserts the resolved versions. Its examples use syntax-highlighted TypeScript fences; the repository's packed `pnpm test:docs` gate typechecks them with TypeScript 7. The prior Twoslash hover integration depended on the TypeScript 6 compiler API and was removed for the TypeScript 7 baseline.

## Packaging gates

`pnpm package:check` packs the tarball once and runs publint and `@arethetypeswrong/cli` against it, so both read the exact bytes a consumer installs.

`pnpm check:module-resolution` installs that tarball into a scratch project and reads all five export keys under `moduleResolution` `bundler` and `node16`, then executes the compiled Node consumer.

Do not publish, tag, create a GitHub release, change repository visibility, or change the publication safety switch unless explicitly instructed.
