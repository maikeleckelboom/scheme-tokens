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

## CSS browser contract

The CSS activation order promises computed-style behaviour, which unit tests cannot observe.
`pnpm test:browsers` builds the package and runs `tests/browser` with Playwright in Chromium,
Firefox, and WebKit: tier order, system preferences, explicit and nested markers, custom
conditions, application cascade and cascade-layer precedence, shadow roots with `:where(:host)`,
and `color-scheme` binding. P4a additionally covers nested live reference chains, aliases before targets, mixed concat linking/inlining, same-element unlayered target overrides in both stylesheet orders, inherited aliases on unmarked descendants, and Shadow DOM reference activation. Ordinary width/padding and generated content record CSS token-stream concat behavior, including dimensional and quoted-string limits. The suite loads the built `dist/` exporter, not workspace source.
It is separate from `pnpm release:check` because it needs browser binaries; CI runs it as the
blocking `CSS browser contract` job. Install the engines once per Playwright version:

```sh
pnpm exec playwright install chromium firefox webkit
```

Run it for any change to CSS output, options, or selector and media validation. The representative resolved-versus-var unit test uses `tests/fixtures/css-reference-p4-output.json`, captured by building and executing P4 commit `05ebcdf4cdf655b5545e81ef42d77a90ddc11116`. The fixed pretty/compact expectations cover omitted, undefined and resolved reference options; never regenerate them from the current exporter or alter the published-0.3.0 oracle.

The isolated projection is core `0.4.0` plus Material `0.2.0`, with peer `^0.4.0` and the accepted P5/P5.1 layer API. `packages/material3/scripts/release-candidate.ts` applies pending Changesets only in a temporary workspace and shares paired tarballs between Material packed consumers and executable documentation. Combined installations use fresh frozen locks and strict peer checking. The repository manifests remain `0.3.0`/`0.1.1`. [P6.1](./p6.1-package-evidence.md) owns package-only proof; external application migrations are not release requirements. P7 release preparation is separate. No publication is implied.

## TypeScript compatibility

The supported compiler range is `>=5.9.3 <6.0.0 || >=6.0.2 <7.0.0 || >=7.0.2 <8.0.0`. `pnpm test:types` runs the source type matrix in `tests/types` under the repository's strict configuration and again under `strict` alone, both with `skipLibCheck: false`. The matrix covers the authoring error cases, visibility composition, selection completeness, layer mode sets, dynamic and parsed inputs, ADR 0015's structural `concat` classification, the graph's definite own tokens, and the nominal static claims: raw, spread, frozen, and picked data that must not forge keys, public keys, modes, or layer visibility, and a proof marker that foreign declarations cannot supply and `in` cannot narrow on.

`pnpm check:packed-types` installs the real tarball into an isolated NodeNext consumer and runs the same `tests/types` files against the emitted declarations under both configurations. The stricter one emits declarations and verifies all seven output files, so helper results must stay nameable. The baseline inherited `noEmit: true` despite enabling `declaration`; P6.1 corrects that gap. It then checks diagnostic quality by fragments rather than whole messages: reference suggestions for graph, layer, expanded mode-map, and concat typos, the diagnostic marker names, including both mode sets of a layer mismatch, and the missing `StaticProof` of a forged graph or layer claim.

The Material packed gate copies the authoritative `packages/material3/tests/types/material3.test.ts` into the paired consumer. It runs strict-only and stricter NodeNext configurations with `skipLibCheck: false`; the stricter configuration additionally enables exact optional properties, unchecked indexed access, verbatim module syntax, isolated modules and declaration emission. It proves exact modes/visibility, the three contextual NoInfer rejections, empty-map/removed-field failures and current-core public completeness/partiality. P5.1 adds option-presence regressions for annotations, omitted/undefined options, explicit generics including never, optional inputs, defaulted/required wrappers and downstream selections. Both configurations also run through the package-local type script.

`pnpm type:compat:stable` tests exact consumer floors 5.9.3, 6.0.2 and 7.0.2 plus the repository's stable 7.x; equal versions run once with all role labels. The TS7 development compiler builds one actual `0.4.0`/`0.2.0` pair for every role to consume. Each role checks library source, both authoritative matrices and stricter source declaration emission, packed matrices with actual declaration emission, export-map/module resolution, and the core-only and paired coordinate runtimes. Material adds Bundler source profiles alongside its existing NodeNext built-declaration checks; source needs DOM libraries from its engine dependency, while packed consumers remain DOM-free. `skipLibCheck` stays false throughout. CI selects lines with `pnpm type:compat:stable 5.9`, `6.0`, or `7.x`; the unfiltered command runs every blocking role. `pnpm type:compat:next` runs the same suite as a non-blocking signal. [ADR 0017](./adr/0017-consumer-compiler-support.md) owns the policy.

`pnpm candidate:pack <empty-output-directory>` captures Git diff bytes verbatim, saves and hashes those same bytes, and hashes every existing tracked source file. Non-ignored untracked files and ignored untracked source/schema/Changesets inputs are rejected with a tracking explanation. Ignored build output is regenerated; this is Git-source provenance, not a hermetic build or a claim to capture arbitrary ignored inputs. Output and staging directories must be fresh so old files cannot enter a new candidate.

`pnpm check:candidate`, included in `release:check`, packs that pair, verifies patch reconstruction, creates a portable standalone lockfile and performs a fresh frozen strict-peer install in a second consumer with an empty dedicated store. It then runs `scripts/check-consumer-candidate.ts` and both authoritative coordinate examples. The checker parses YAML project documents structurally, follows importer `.` through artifact resolutions and peer-qualified snapshots, matches each integrity and provenance digest to its artifact, and verifies installed identities/versions/peer range and shared-core realpaths. It supports pnpm lockfile version 9.0 and the paired standalone consumer shape. Metadata inspection does not certify stale installed runtime files; the fresh installation supplies that complementary proof. YAML is an exact development-only dependency.

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

`@playwright/test` is pinned to `1.61.0` (Chromium 149, Firefox 151, WebKit 26.5). The then-current
`1.63.0` was evaluated first: the maintainer machine's Windows application-control policy refused to
launch its Firefox 155 and WebKit 26.6 builds, while the `1.61.0` engines run there. CI installs the
same pinned engines, so the local and CI browser evidence match. Bump it deliberately, after checking
that all three engines launch locally.

The docs site pins `vitepress` and `typescript` to exact versions, and `scripts/check-docs-site.ts` asserts the resolved versions. Its examples use syntax-highlighted TypeScript fences; the repository's packed `pnpm test:docs` gate typechecks them with TypeScript 7. The prior Twoslash hover integration depended on the TypeScript 6 compiler API and was removed for the TypeScript 7 baseline.

## Packaging gates

`pnpm package:check` packs the tarball once and runs publint and `@arethetypeswrong/cli` against it, so both read the exact bytes a consumer installs.

`pnpm check:module-resolution` installs that tarball into a scratch project and reads all five export keys under `moduleResolution` `bundler` and `node16`, then executes the compiled Node consumer.

Do not publish, tag, create a GitHub release, change repository visibility, or change the publication safety switch unless explicitly instructed.

See [P6.1 package evidence](./p6.1-package-evidence.md) for current package-only criteria. The [historical P6 report](./p6-consumer-evidence.md) retains external observations without active release prerequisites.
