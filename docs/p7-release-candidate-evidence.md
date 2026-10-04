# P7 release candidate evidence

Qualification date: 2026-10-05. Scope: P7 Run B, P7.4–P7.6, package qualification only.

**The candidate packages are not yet published.** The primary manifests remain core `0.3.0`
and Material `0.1.1`, with Material peer `^0.4.0`. All eight pending Changesets remain
unconsumed in the primary checkout. This qualification projects core `0.4.0` and Material
`0.2.0`; actual version transition, publication, tagging and release creation require separate
authorization. No deployment or merge to main is part of this run.

## Frozen baseline

| Item               | Verified value                                                 |
| ------------------ | -------------------------------------------------------------- |
| Source commit      | `20a9fdc8ac7f941eafa736bfa519e84a36f36b08`                     |
| Subject            | `docs(changeset): remove stale deferred release note`          |
| Branch and remote  | `dev`, equal to freshly fetched `origin/dev`                   |
| Primary worktree   | Clean before qualification and after P7.5                      |
| Primary versions   | `scheme-tokens@0.3.0`, `@scheme-tokens/material3@0.1.1`        |
| Projected versions | `scheme-tokens@0.4.0`, `@scheme-tokens/material3@0.2.0`        |
| Material peer      | Exactly `^0.4.0`, before and after projection                  |
| Pending Changesets | Eight                                                          |
| Local toolchain    | Node `24.16.0`, pnpm `11.23.0`, development TypeScript `7.0.2` |

[Baseline CI](https://github.com/maikeleckelboom/scheme-tokens/actions/runs/37237010683)
completed successfully on that exact commit. Its seven blocking jobs were Node 24, Node 26,
API contract, CSS browser contract, and TypeScript 5.9, 6.0 and 7.x supported consumers.
The separate TypeScript next signal also passed.

The Run A result supplied with this qualification request independently established the version
projection, release-ready generated changelogs and artifact shape. It is prior review context
only. Run B reused no Run A workspace, tarball, consumer, lockfile, generated changelog, hash or
command result.

## P7.4 — Fresh projected candidate

A new independent `git clone --no-hardlinks --no-checkout` was checked out detached at the
frozen commit. Its HEAD, clean status, manifests and eight Changesets were checked before
`pnpm install --frozen-lockfile` and `pnpm changeset:version`. The latter ran only in that clone.
It changed exactly the two package versions, two changelogs and eight consumed Changeset files.
There was no peer, lockfile, source, configuration, schema or API snapshot change, and no manual
repair of the projection. Generated migration notes were inspected again.

`pnpm build`, `pnpm --filter @scheme-tokens/material3 build` and
`pnpm candidate:pack <fresh-output-directory>` built and packed the versioned pair. The
repository helper recognized the already-versioned candidate and applied no further versioning.
Its provenance records the frozen commit and verbatim release-accounting patch.

### Run B artifact identities

| Package                    | Version | Tarball                             | Bytes   | Files | SHA-256                                                            |
| -------------------------- | ------- | ----------------------------------- | ------- | ----- | ------------------------------------------------------------------ |
| `scheme-tokens`            | `0.4.0` | `scheme-tokens-0.4.0.tgz`           | 91,051  | 10    | `dc419f8ca55d9541e0052ad0ad6550980d37e52dd190510954a19694137f5a00` |
| `@scheme-tokens/material3` | `0.2.0` | `scheme-tokens-material3-0.2.0.tgz` | 118,338 | 8     | `3dc4b1da36625928ffafc17a354e82edfbb964628d15e7ef0abdb63a61660848` |

These hashes identify rehearsal artifacts, not a publication guarantee. Inventories and extracted
file digests were captured for content comparison; archive-byte equality across rehearsals is
not required. The established allowlists contain only the intended manifests, bundles,
declarations, source maps, README/license files, core changelog and three core v2 schemas,
plus Material's engine license and third-party notices. Material's changelog is reviewed in the
projection but is intentionally absent from its existing eight-file tarball allowlist.

The evidence file, roadmap and implementation plan are outside both package inventories.

### Fresh installed consumers

A new standalone consumer received only these two tarballs and their provenance under portable
`vendor/scheme-tokens` paths. It started without `node_modules`. Installation ran:

```sh
pnpm install --lockfile-only --ignore-scripts --strict-peer-dependencies
pnpm install --frozen-lockfile --ignore-scripts --strict-peer-dependencies --store-dir <fresh-store>
node --experimental-strip-types scripts/check-consumer-candidate.ts <consumer-directory>
```

The checker ran from the candidate repository against that consumer. The store was newly created;
the frozen install reported two added packages and zero reused packages. Installed package files
confirmed core `0.4.0`, Material `0.2.0` and peer `^0.4.0`. Both resolved beneath the isolated
consumer's `node_modules`; Material's resolved core manifest realpath equaled the consumer's
core manifest realpath. There were no workspace links or repository-source imports. Structural
lockfile importer, portable artifact, integrity, peer snapshot and provenance checks passed.

| Command, run from the fresh versioned clone                     | Artifacts consumed / result                                                                                                                                                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm smoke:consumer`                                           | Recorded Run B core tarball; pass                                                                                                                                                                               |
| `pnpm check:packed-types`                                       | Recorded Run B core tarball; strict and stricter matrices, eight emitted declaration files and diagnostic-quality assertions passed                                                                             |
| `pnpm check:module-resolution`                                  | Recorded Run B core tarball; five export keys under Bundler and Node16, Node16 runtime passed                                                                                                                   |
| `pnpm check:theme-coordinate-consumer`                          | Recorded Run B core tarball; authoritative core-only example, four modes and eleven selected roles passed                                                                                                       |
| `pnpm --filter @scheme-tokens/material3 check:packed-consumers` | Recorded Run B pair; raw ESM, NodeNext, authoritative Material coordinate runtime and full packed Material type matrix passed                                                                                   |
| `pnpm audit:external-consumer`                                  | Fresh core `0.4.0` tarball packed by the unchanged synthetic audit from the same versioned clone; pass                                                                                                          |
| `pnpm check:candidate`                                          | Independently rebuilt pair from the same versioned clone; patch reconstruction, portable lockfile, new frozen strict-peer consumer/store, shared core, both coordinate runtimes and declaration emission passed |

The first five commands used `SCHEME_TOKENS_CORE_TARBALL` and, where applicable,
`SCHEME_TOKENS_MATERIAL_TARBALL` pointing at the recorded Run B artifacts. The synthetic audit
and provenance runner own their fresh packing; their results are not represented as executions
of an externally supplied tarball. No external application was used.

### Consumer compiler matrix

The unchanged `pnpm type:compat:stable` runner built a fresh actual projected pair once and
shared it across all blocking roles. `pnpm type:compat:next` independently built its own fresh
pair. Both ran from the versioned clone. No source-test substitute or reduced matrix was used.

| Role                                      | Source and packed               | Declaration emission              | Runtime / resolution                                  | Result                    |
| ----------------------------------------- | ------------------------------- | --------------------------------- | ----------------------------------------------------- | ------------------------- |
| TypeScript 5.9.3 floor                    | Full core and Material matrices | Source and packed, files verified | Bundler, Node16, paired NodeNext, ESM and coordinates | Pass, blocking            |
| TypeScript 6.0.2 floor                    | Same                            | Same                              | Same                                                  | Pass, blocking            |
| TypeScript 7.0.2 floor and repository 7.x | Same, equal roles deduplicated  | Same                              | Same                                                  | Pass, blocking            |
| TypeScript next `7.1.0-dev.20261004.1`    | Same                            | Same                              | Same                                                  | Pass, non-blocking signal |

The supported range remains
`>=5.9.3 <6.0.0 || >=6.0.2 <7.0.0 || >=7.0.2 <8.0.0`.
All profiles retain `skipLibCheck: false`, strict settings, positive inference and negative
authoring assertions. Stricter profiles retain exact optional properties, unchecked indexed
access and the established declaration-emission settings. Core emitted all eight current
matrix declarations. Material retains option-presence, visibility, `NoInfer`, wrappers and
downstream-selection proof. Source compatibility follows Bundler; NodeNext is proved at the
established declaration/package boundary, not claimed for extensionless source.

## P7.5 — Final invariant and release matrix

The primary `pnpm release:check` ran on the clean, unversioned frozen commit. It passed core
validation and release gates and Material validation, then stopped on the Material engine
capability-matrix test's 5,000 ms timeout (5,676 ms). This aggregate invocation **did not pass**.
Concurrent browser work was the concrete contention hypothesis. Without changing any tracked
file, fixture, timeout or compiler setting, three isolated
`pnpm --filter @scheme-tokens/material3 test:engine` runs passed all four tests, with total
test execution of 4.04 s, 3.39 s and 4.01 s. The complete `pnpm release:material3:gates` then
passed again, including that engine suite.

The remaining umbrella stages were executed successfully in order: `pnpm check:candidate`,
`pnpm check:changeset`, `pnpm docs:check`, and `pnpm audit:external-consumer`. Under the
repository's evidence-preserving validation policy, the initial timing failure is closed by
focused repeat evidence and completion of every skipped stage. This is not a claim that the
initial aggregate exited zero. The final docs-only closeout requires a new full aggregate run.

| Invariant                                                                                                                                    | Owning commands / suites                                                                                                                            | Run B result                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core semantics, graph-last composition, visibility carry/republication, metadata, refs/concat, cycles, unknown refs and resolved-value bound | `pnpm test`, unit suites including `core-v2`, `resolve-expressions`, `canonical-expression`                                                         | 453 tests across 21 core test files passed, including property/oracle/schema suites                                                                                                 |
| Determinism and JSON safety                                                                                                                  | `pnpm test:properties`, parser/serializer unit and schema tests                                                                                     | Eight property tests passed; canonical round trips and caller isolation covered                                                                                                     |
| Frozen published-0.3 semantics and v1 upgrades                                                                                               | `pnpm test:oracle`, v1/v2 unit tests                                                                                                                | Two oracle tests passed, including the unchanged 2,000-input seeded corpus; source upgrades and compiled-v1 rejection covered                                                       |
| Three v2 schemas                                                                                                                             | `pnpm test:schemas`, `check:module-resolution`, both tarball checks                                                                                 | 73 schema tests passed; strict Ajv compilation, exact `tag:` identifiers, fragment-only refs, schema subpaths and `$schema` neutrality                                              |
| Static claims and diagnostic typing                                                                                                          | `pnpm test:types`, `check:packed-types`, `type:compat:stable`                                                                                       | Exact/public completeness, dynamic/parsed partiality, selection arrays, layer modes, visibility facts and nominal proof passed                                                      |
| CSS unit/property contracts and var projection                                                                                               | CSS activation/names/safety/references suites, determinism/expression property suites                                                               | Tier/mode/condition order, collisions, safe grammar, resolved output, linked/inlined direct targets and concat passed                                                               |
| Real browser CSS                                                                                                                             | `pnpm test:browsers` from the fresh versioned clone, loading built exporter output                                                                  | 78 passed: Chromium 26, Firefox 26, WebKit 26; zero retries                                                                                                                         |
| Browser behavior                                                                                                                             | `tests/browser/css-activation.spec.ts`                                                                                                              | Zero specificity, explicit attribute opt-in, nested islands, `includeHost`, root independence, selectors/media/layers, local var overrides and shadcn/Tailwind cascade cases passed |
| Material runtime and goldens                                                                                                                 | `pnpm release:material3`, then focused closure and `release:material3:gates`                                                                        | 111 ordinary tests passed; four engine tests passed on repeats and complete gate; fixed 48 roles, variants/specs, mode settings and per-mode generation covered                     |
| Material public contract                                                                                                                     | Material type/API gates and paired compiler matrix                                                                                                  | `modeSettings`, `colorMode`, option presence, visibility, `NoInfer`, packed declarations, ESM/NodeNext and peer installation passed                                                 |
| Engine and licensing                                                                                                                         | Material engine/package/tarball gates                                                                                                               | Material Color Utilities stays pinned to `0.4.0`; golden/capability fixtures and license/notice checks passed without regeneration                                                  |
| Projected packaging                                                                                                                          | `pnpm api:check`, `pnpm check:tarball`, `pnpm package:check`, and each command with `--filter @scheme-tokens/material3`, from the versioned clone   | Both snapshots, exact inventories, export maps, manifests, bundled engine, declarations and licensing passed                                                                        |
| Recorded artifact quality                                                                                                                    | `node node_modules/publint/src/cli.js run <tarball> --strict`; `node node_modules/@arethetypeswrong/cli/dist/index.js <tarball> --profile esm-only` | Both recorded Run B tarballs passed                                                                                                                                                 |
| Documentation and executable examples                                                                                                        | `pnpm docs:check`, including `pnpm test:docs`; coordinate consumers and synthetic audit                                                             | Documentation build, public-surface checks and executable examples passed                                                                                                           |
| Candidate provenance and fresh installation                                                                                                  | `pnpm check:candidate`, recorded-artifact consumer above                                                                                            | Git patch reconstruction, artifact/lock relationships, installed identities, shared core and fresh-store runtimes passed                                                            |
| Repository/release accounting                                                                                                                | Typecheck, lint and format inside aggregate; `pnpm check:changeset`; `pnpm changeset:status --since=origin/main`; `git diff --check`                | Passed; primary tree stayed clean, equal to the frozen baseline; eight Changesets still project both minor releases                                                                 |

The schema identities are exactly
`tag:maikel.site,2026-09-29:scheme-tokens/schema/token-graph/v2`,
`tag:maikel.site,2026-09-29:scheme-tokens/schema/token-layer/v2`, and
`tag:maikel.site,2026-09-29:scheme-tokens/schema/compiled-scheme/v2`.

### Findings and known non-blockers

- **NON-BLOCKING OBSERVATION — closed TOOLING/INFRASTRUCTURE FAILURE:** the initial Material
  timeout and unchanged focused passes are recorded above. No product, API, fixture or timeout
  change was needed. Browser tests had no failures or retries.
- **NON-BLOCKING OBSERVATION — resolved tooling invocation:** bare `pnpm changeset:status`
  failed because this checkout has only local `dev`, not local `main`. The supported
  `--since=origin/main` invocation passed against the fetched tracking ref; no branch or
  configuration was changed.
- **NON-BLOCKING OBSERVATION:** Changesets warns that the unversioned core `0.3.0` does not
  satisfy Material's candidate peer `^0.4.0`. Fresh projected strict-peer installations prove
  the intended pair. The primary manifests deliberately remain unversioned.
- **NON-BLOCKING OBSERVATION:** ATTW's established `esm-only` profile excludes CommonJS/Node10
  resolutions; no CommonJS support is claimed. Build-tool warnings about the TS7 compiler API,
  optional bundler timing, discarded dependency pure annotations and terminal color settings
  did not prevent build, declaration, documentation or runtime checks.
- **BLOCKER:** none remains after the focused closure and completed matrix.

### Excluded gates

External application migrations, framework certification, a second demo, scaffold recovery and
application visual baselines are not package-release prerequisites under P6.1 and ADR 0017.
Their repositories/worktrees and historical evidence remain untouched.

## P7.6 — Documentation closeout boundary

The closeout is limited to this evidence record and factual status updates in
`planning/0.4-implementation-plan.md` and `docs/roadmap.md`. It does not change package/source,
API, schema, test, configuration, lockfile, export-map or Changeset inputs. Accepted ADRs and
historical P6/P6.1 evidence remain unchanged.

The closeout delivery report owns the final commit identity, final full `pnpm release:check`,
documentation/Changesets/diff checks, clean-tree and remote parity, and all exact-SHA CI job
results. It must also report a new isolated version projection from that final commit and
compare every packed file's inventory and extracted SHA-256 against the Run B artifacts above.
The comparison covers manifests, runtime exports/bundles, declarations, schemas and all other
packed files, rather than requiring `.tgz` byte identity. These closeout checks are required
before reporting P7 Run B successful.

The next transaction is separately authorized real versioning/release preparation. This record
does not authorize publication, tags, a GitHub Release, deployment or a main merge.

P7 QUALIFICATION: READY FOR VERSION TRANSITION
