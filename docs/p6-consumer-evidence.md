# P6 real-consumer candidate evidence

**Superseded scope and status, 2026-09-30:** this is a historical report. P6.1 replaces its external
release prerequisites with [package-only criteria](./p6.1-package-evidence.md). No external
migration, second Material demo, recovered scaffold, framework certification or application
visual baseline is required for package completion or P7. Existing external branches and
worktrees are left untouched; no failed check below is reclassified as a success or completion.
The historical P7 handoff below is withdrawn from the active plan.

P6.1 also reproduced two defects in the historical candidate tooling: saved patches lost their
terminating newline, and globally searched lockfile integrity strings could be swapped without
failure. The historical checker passes below do not prove patch reconstruction or the corrected
artifact-to-resolution relationships. Artifact observations and application results remain
recorded as originally observed. Corrected source, lockfile and fresh-install proof belongs to P6.1.

Status: **incomplete**. Two identified applications have candidate migrations and runtime proof.
Vue/TypeScript 7 framework checks, the independent scaffold recipe and identification of the
second Material demo remain open. P7 is not started. No package was published or application deployed.

## Baselines and delivery boundaries

| Repository                                 | Verified starting ref                              | Migration location                    |
| ------------------------------------------ | -------------------------------------------------- | ------------------------------------- |
| `maikeleckelboom/scheme-tokens`            | `dev`, `649d349976f895a6c475bbb9ba6ed96b0cff0675`  | `dev`                                 |
| `maikeleckelboom/maikel.site`              | `dev`, `5d16b4ab2c53955361984226e1916aa659966433`  | isolated `p6/scheme-tokens-candidate` |
| `maikeleckelboom/scheme-tokens-shadcn-vue` | `main`, `addf6aea5603bce04c05c0cd2b5939df57ffc62d` | isolated `p6/scheme-tokens-candidate` |

The package parent was `b6c1da5007d41139b6c8723774f878ab8e8a87d7`, subject
"fix(material3): tie static facts to supplied options". Its clean local HEAD, tracking ref and
live origin/dev matched. All six jobs in [starting CI](https://github.com/maikeleckelboom/scheme-tokens/actions/runs/36751647335)
passed on that exact SHA. Package main was `0390e1e734254982058388f61169824d31301b91` and remains untouched.
Site main was `863f5e55b1d7540e85931b433420a1d6210eeb32`.

Both primary application checkouts had unrelated changes, which were not copied into migration
worktrees. The local `scheme-tokens-material3-app` is Oddments and has the shadcn repository remote.
Its similarly named clean copy is also Oddments. Searches of local manifests, repository references,
available GitHub repositories and configured desktop projects did not identify a distinct second
Material demo. A user clarification remains necessary. It has not been counted as migrated.

External branches remain local review commits. Site configuration refers to Cloudflare Pages.
Neither repository has GitHub workflows or a GitHub Pages site, and deployment API queries returned
no records, but external hosting branch triggers were not established. No branch was pushed merely
on the assumption that absent GitHub workflows means absent deployment.

The review commits are available in these isolated local worktrees:

- `C:/dev/.worktrees/maikel-site-p6`: `cbd19a3f5b7a229c02d9785de560267c42349142`
  — "feat(theme): migrate to paired scheme tokens candidates".
- `C:/dev/.worktrees/oddments-p6`: baseline repair `f0f1ffc967dbe4ae8e79825ecf3a3eb7bbe79526`
  — `fix: restore the committed exhibition stylesheet import`; migration
  `c9eb0e84c93048e3a4f7e3fcf6b53f001b22df69`
  — "feat(theme): migrate Oddments to paired token candidates".

Both review worktrees are clean. Their final relative manifest/lockfile specifications also passed
`pnpm install --frozen-lockfile --ignore-scripts`; this does not substitute for resolving strict peers.

## Candidate artifacts

Node 24.16.0, pnpm 11.23.0. `pnpm candidate:pack <empty-output-directory>` reuses
`packages/material3/scripts/release-candidate.ts`: build both packages, copy package inputs,
apply pending Changesets only in the temporary workspace, strict-peer install and pack.
Committed versions remain core 0.3.0 and Material 0.1.1. Projected versions are core 0.4.0,
Material 0.2.0, peer `^0.4.0`.

| Tarball                             | SHA-256                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `scheme-tokens-0.4.0.tgz`           | `56347e06f506707e4832238963ccc48d268406c164b2762fbcd1a56b3f981e56` |
| `scheme-tokens-material3-0.2.0.tgz` | `be311c60feca956bde44f945c107efa97109e931be8293a9616fe85a08def2a9` |

The package implementation is the accepted starting commit. The tested tree adds the candidate
packing command to package.json, and updates candidate status in both READMEs, with no implementation, schema, dependency, API or changeset changes.
`provenance.json` records starting commit, tracked diff hash, source status and SHA-256 for every
package source/schema/versioning input. The final documentation refresh changed tarball hashes. Both installed pairs were refreshed and their integrity and runtime outputs rechecked.
Both applications commit these small paired artifacts under `vendor/scheme-tokens`, with relative
manifest and lockfile specs and provenance. No machine-specific dependency paths, source aliases,
workspace links or old-published-package substitutions are used.

From this repository run:

```sh
node scripts/check-consumer-candidate.ts <consumer-directory>
```

It verifies each manifest spec, artifact SHA-256, lockfile SHA-512 integrity, installed version,
peer range and realpath equality between Material's core resolution and the application's core.
Both consumers passed. Oddments' resolving strict-peer install passed. Site's resolving strict-peer
install fails on transitive Nuxt tooling peers, described below, despite correct Material/core resolution.

## Package examples and documentation

The existing core-only coordinate gate already copied and executed its authoritative example.
It remains independent of Material. The paired Material gate now also copies and executes
`examples/theme-coordinates/material.ts`, which composes six application-owned coordinates,
internal Material roles, exact selection and precise modes. It checks emitted/structured value
fidelity. Source and packed declaration matrices remain authoritative and unchanged.

The external audit is explicitly labeled synthetic package proof. It does not certify a real app.
Current root/Material API, authoring, CSS, Tailwind, schema and docs-site examples were audited for
old forms. The remaining old names in current guidance explain migration, while historical ADRs,
audits, release notes, frozen oracles and the P4 fixture remain unchanged. Status documentation now
distinguishes partial P6 proof from release readiness.

## Site output and activation

Baseline `pnpm verify` and 23 theme browser tests passed before migration. Baseline outputs were
captured before replacing dependencies. Candidate comparison found exact equality for:

- 438 resolved color/provenance entries across the six ordered modes.
- 288 Material role values, six serialized mode records and 26 public variable names.
- All 52 catalog recipes' public/context/component values, validation and raw-role evidence.
- Every applicable persisted theme record, including its fingerprint.

Material uses supplied mode settings checked against the application's mode union, explicit internal
visibility and layer composition. Standalone role compilation and the recipe catalog own their graph
envelopes. No meaningful color invariant, mapping, seed, variant or contrast input was removed.

Current provenance labels change to Material 0.2.0. To preserve valid saved selections, a fixed
baseline capsule-fingerprint set permits identity retention only when the complete candidate payload
hashed with the old label exactly matches a known historical capsule. Changed payloads cannot match.
The runtime preference validator, applicable records, prepaint source and generated runtime CSS are
unchanged. Inapplicable recipe fingerprints may change, but those records were never persistable.

The graph serializer emits format 2 instead of 1. No persisted package source artifacts or compiled
caches were found. Application capsule schema 1 is separate from package wire format.

The public adapter now returns full ordered blocks, preserving tier, selector arrays and media.
It emits eight blocks instead of six: base, system-dark and six explicit custom conditions.
The production generator does not consume this legacy adapter output. It projects validated capsules,
owns its no-JavaScript fallback and installs saved values inline before paint. No fallback was duplicated.
Resolved output remains the chosen policy.

## Oddments cascade and behavior

The original committed build failed because main imported `exhibition.css`, while Git contains
`oddments.css`. Correcting that import alone restored the baseline build, followed by 15 passing browser tests.
The committed mapping actually has 19 variables, although earlier prose called it 21. All 19 targets
were preserved. No extra mapping was invented. Chart/sidebar values, exhibition data and generation
controls retain their owners.

Stock declarations now live in `@layer base`. Unlayered generated `:where(...)` declarations win by
layer precedence, without selector rewriting, added specificity or important declarations. Stock removes
the owned generated stylesheet and restores the original values. The original declaration sequence is
protected by an independently captured baseline hash. Built CSS and real component properties were checked.

Nested light/dark variable activation and native color-scheme work. Tailwind dark variants still match
an ancestor dark class inside a nested light region; the browser test explicitly observes this limitation.
Failed generation preserves the last complete stylesheet and configuration. No live reference output was added.

## Executed consumer checks and blockers

| Check                                                | Result                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| Site baseline frozen install and `pnpm verify`       | Passed                                                          |
| Site candidate color unit suite                      | 53 passed                                                       |
| Site candidate `pnpm verify`                         | Failed only at application vue-tsc; all other steps passed      |
| Site candidate tools/config/server TypeScript checks | Passed with TS7                                                 |
| Site candidate production generate, output and smoke | Passed within the failing aggregate                             |
| Site theme browser suite                             | 23 passed before and after migration                            |
| Site Windows Chromium visual suite                   | 28 passed, two baseline Canvas2D failures reproduced unchanged  |
| Oddments baseline tools/build/browser                | Passed after the isolated missing-import repair                 |
| Oddments candidate tools check                       | Passed, TS7 and skipLibCheck false                              |
| Oddments candidate `pnpm build`                      | Failed in vue-tsc startup                                       |
| Oddments separate Vite runtime build                 | Passed; does not replace framework certification                |
| Oddments final browser suite                         | 16 passed                                                       |
| Oddments recipe/application source relationship      | Passed within browser suite                                     |
| Independent untouched-scaffold recipe                | Failed before install: historical scaffold package.json missing |

Both real application framework checks fail with vue-tsc 3.3.11 and TypeScript 7.0.2:
`ERR_PACKAGE_PATH_NOT_EXPORTED`, removed `typescript/lib/tsc`. These were reproduced, not inferred
from historical reports. No weaker application check, exclusion, suppression or relaxed strictness
replaces them. Explicit TS6 parser-only dev dependencies support the site source audit and Vue's SFC
type-resolution transform. Compiler commands still use TS7. This is partial runtime evidence, not
a supported Vue/TS7 certification.

The site's resolving strict-peer install additionally reports Nuxt's typescript-eslint peers requiring
TypeScript below 6.1 and missing ESLint peers. No ESLint installation or peer-policy relaxation was used.
Oddments' independent recipe installer now stages the candidate tarballs, TS7 and stock layer, but
needs a complete untouched scaffold and a supported framework toolchain before it can pass.

The site visual differences reproduced at the untouched baseline with the same 24,617 and 25,122
pixel counts. Expected, actual and diff screenshots were inspected and not updated. Oddments initially
sampled transitional layout after viewport/font changes; polling the same bounds fixed synchronization.
Three focused repeats and the final full suite passed without changing layout tolerances.
An intermediate site aggregate smoke run collided with another verification server on port 4173.
The complete aggregate was rerun with `PW_SMOKE_PORT=4273`; smoke passed and only the framework
typecheck remained failing. No human development server was stopped or reused.

Registry inspection confirmed vue-tsc, Vue language-core and the TypeScript plugin at 3.3.11,
and Nuxt at 4.5.2. Updating to the latest available framework checker therefore did not remove
the demonstrated TS7 startup failure.

Raw logs and screenshots are ignored in the worktrees. Each consumer's `docs/p6-evidence.md` records
its commands, scope, baseline and continuation steps. Existing human development servers and default
site build state were left alone; verification used isolated worktrees and named build directories.

## Package exit gates

`pnpm release:check` passed, including the distinct Material engine/pack/consumer gates, core-only
consumers, packed type matrices, documentation build/examples and the synthetic external audit.
`pnpm type:compat:stable` passed with TypeScript 7.0.2. `pnpm type:compat:next` passed with
7.1.0-dev.20260930.4 and remains non-blocking. `pnpm test:browsers` passed all 63 tests across
Chromium, Firefox and WebKit. `git diff --check` passed.

Earlier aggregate attempts failed on a documentation scanner interpreting a code-formatted commit
subject as an API name (fixed as plain prose), and a Material engine test exceeding its existing
five-second timeout while other builds ran. That engine test passed twice in isolation, followed
by a successful full aggregate. An earlier package browser invocation overlapped a dist-cleaning
build and failed to import the bundle; the sequential full browser rerun passed. No timeout,
assertion, baseline or CI gate was relaxed. The final report is included in a subsequent final-tree
aggregate rerun before Git delivery.

The toolchain retains its existing tsdown warning about the experimental TS7 API, docs-build
annotation warnings and temporary Changesets peer-version transition notices. They did not fail
the package gates and are not presented as real application certification.

## Historical P7 handoff (superseded)

1. Identify and migrate the distinct second Material demo, without counting Oddments twice.
2. Obtain supported Vue/Nuxt TypeScript 7 tooling and resolve the real consumer peer contract.
   Rerun full application/framework and tools checks, builds, browser/visual gates and scaffold recipe.
3. Close P6 only after those real-consumer exit criteria pass. Package CI alone is insufficient.
4. During separately authorized P7, project/review Changesets and changelogs, replace both consumer
   vendor specs with the published pair together, regenerate locks and generator outputs, verify
   hashes/resolution/strict peers and repeat output, saved-state, framework and browser proof.
5. No publication, tag, release, deployment, production merge or primary-worktree versioning was performed.
