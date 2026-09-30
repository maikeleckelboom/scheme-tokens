# ADR 0017: Consumer compiler support is independent of development tooling

Status: Accepted, 2026-09-30. Supersedes only the compiler-support policy in ADR 0013 D13.
ADR 0013 remains the historical decision; its other contracts and ADR 0016 remain accepted.

## Decision

Both core and Material support this bounded consumer range:

```text
>=5.9.3 <6.0.0 || >=6.0.2 <7.0.0 || >=7.0.2 <8.0.0
```

The exact tested floors are 5.9.3, 6.0.2 and 7.0.2. Earlier patches in those major lines are
not promised. TypeScript 8 and prereleases are outside the supported contract. The repository
continues to develop, build and generate declarations with its exact stable TS7 compiler,
currently 7.0.2. Neither package gains a TypeScript runtime or peer dependency.

Blocking roles are each of those three floors plus the repository's stable 7.x compiler.
Equal versions share one execution while retaining their role labels. CI varies consumer
compiler lines independently of Node 24/26 release checks. TypeScript next runs the same
suite as a non-blocking signal. New majors require an explicit supported-range decision.
Narrowing the range remains a breaking compatibility change under the semver policy;
this evidence-backed expansion has a changeset for both packages.

## Evidence and enforcement

Earlier declaration-snapshot tests on TS5.9.3 and TS6.0.2 established feasibility only.
The authoritative evidence is the source and actual paired-package gate described in
[P6.1 package evidence](../p6.1-package-evidence.md), reproduced by
`pnpm type:compat:stable`. No package type, runtime behavior or declaration snapshot changes
to obtain compatibility. Every positive inference assertion and negative authoring case stays.

- Core's seven-file matrix runs against source under strict-only and stricter settings.
- Material's full matrix includes P5.1 option presence, annotations, explicit generics,
  optional inputs, wrappers, contextual NoInfer failures and downstream selection. It runs
  against actual source as well as the existing NodeNext declaration profile.
- Source profiles follow the repository's Bundler resolution. Material source includes DOM
  library declarations required by the development engine dependency; packed consumers remain
  DOM-free. These are source prerequisites, not consumer requirements.
- Both packages' stricter source checks actually emit declarations into an explicit temporary
  project root. Core and Material packed matrices use strict-only and stricter NodeNext,
  with declaration emission and file-existence checks in the latter. `skipLibCheck` is false
  everywhere. Exact optional properties, unchecked indexed access, verbatim module syntax
  and isolated modules remain enabled in the stricter packed configurations.
- One temporary Changesets projection builds the real core 0.4.0 / Material 0.2.0 pair,
  with peer ^0.4.0. Each compiler reads those immutable tarballs, not API snapshots or source
  aliases. Fresh frozen strict-peer installations complement the declaration checks.
- Bundler and Node16 export-map/schema-subpath checks, NodeNext paired execution, the
  authoritative core-only coordinate example and the paired Material example also run.

The runner separates development builds from consumer compiler execution. A later development
compiler update must preserve all consumer floors and pass the same gates. Compiler or
configuration failures must be isolated and reported; unused negative checks are failures.

## Scope

This compiler policy certifies scheme-tokens and its Material package. It makes no framework
compatibility promise and does not require an external application migration. Package-owned
examples, synthetic consumers and browser fixtures provide package integration evidence.
External framework failures, application identities, old scaffolds and visual baselines are
outside this release workflow. Historical P6 observations remain recorded as observations.
