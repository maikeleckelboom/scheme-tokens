# Material 3 Adapter Phase-1 R&D Closure — 2026-08

## Purpose and authority

This point-in-time report closes the final research phase for the future
`@scheme-tokens/material3` adapter. It records reproducible engine and real-core type evidence only.
It does not implement `material3()`, create the public adapter package, or alter core's value model.

Starting repository state:

```text
branch        dev
HEAD          c40df4200176eba0d624017d44df553c4cc2948b
upstream      origin/dev
divergence    0 ahead / 0 behind
worktree      clean
```

The primary R&D archive was prepared against older `dev` head
`4131f6abb22c21200e288bad225713366307aff0`. Every payload matched its `SHA256SUMS`. Its prepared
patch was inspected but not applied; it contained exact copies of three proposed ADRs and the audit
and was treated as a historical transport artifact.

The current repository already owned:

- ADR 0003, the rejected authoring-property namespace proposal;
- ADR 0004, an accepted earlier combined Material adapter design.

The archive's proposed 0003–0005 numbering could not be copied without overwriting decision
history. The reconciled records are therefore ADRs 0005–0007. They explicitly supersede the
relevant parts of 0004 while preserving it unchanged.

The secondary archive contained only three independently generated golden vectors. They were
inspected as crosscheck evidence, never copied into the repository, and compared only after the
repository generated its own files.

## Original hypotheses and open gates

The primary dossier established a strong architecture but left two classes of evidence unresolved.

### Type/composition hypothesis

The standalone type probe locally redeclared `TokenLayer`, `TokenReference`, `tokenRef`,
`LayerKeyOf`, and `defineTokenGraph`. It showed that the proposed overload design was expressible,
but it did not prove integration with real core. The dossier correctly marked a workspace type suite
and packed consumer as future authority.

The remaining questions were whether:

- a finite `Material3TokenKey` survives a spread through real `defineTokenGraph()`;
- Material modes survive real compilation;
- a heterogeneous layer tuple preserves the finite key union from every member.

### Engine hypothesis

The original engine probe was syntax-checked but could not execute in its environment. It covered
six seeds and retained phone/watch and broad engine observations, but the numeric matrix and new
golden vectors were not repository-owned evidence yet.

The remaining gates were exact installed MCU 0.4.0 execution, exhaustive 48/11 role
classification, an eight-seed capability comparison, derived branch certification, four primary
vectors, and independent byte crosschecks.

## Independent crosscheck findings received

The secondary review reported:

- the recovered 2021 baseline matched MCU 0.4.0 for all 96 light/dark values;
- 48 accepted fixture keys and 59 role methods left exactly 11 excluded roles;
- the 2025 tonal-spot transition differed in 87 of 96 values;
- monochrome, fidelity, content, rainbow, and fruit-salad were effective-2021/value-identical under a
  requested 2025 spec;
- neutral, tonal-spot, vibrant, and expressive remained effective-2025 and changed thousands of
  role values;
- `#8a8c2a` and `#009489` were candidate hard paths for the relevant derived yellow and cyan
  predicates.

Those measurements were treated as oracle shape to reproduce, not as values to hard-code.

## Repository-owned R&D workspace

Phase 1 adds the private `tests/rnd/material3` workspace. It is intentionally not
`packages/material3` and has no public package exports. It keeps exact engine dependencies, probe
scripts, type probes, and generated R&D evidence isolated from the root package manifest and packed
core.

The workspace pins:

```text
@material/material-color-utilities  0.4.0
esbuild                              0.28.1
typescript                           6.0.3
scheme-tokens                        workspace:*
```

Raw Node import of MCU 0.4.0 was reproduced and failed with `ERR_MODULE_NOT_FOUND` at an
extensionless internal engine import. The runner therefore reads the installed manifest, rejects
any version other than 0.4.0, bundles the exact package and probe into a temporary ESM file, executes
it, and removes the file afterward.

No engine patch, vendored source, or generated bundle is committed. The lockfile retains the npm
integrity record for the exact package.

## Corrected real-core type proof

`tests/rnd/material3/type-probes/material3-api-type-probe.ts` imports the following from the real
workspace-linked `scheme-tokens` package:

- `compileTokenGraph`;
- `defineTokenGraph`;
- `defineTokenLayer`;
- `tokenRef`;
- `TokenLayer`;
- `TokenVisibility`.

Only proposed Material-owned overloads and option types are declared locally. The probe runs with
strict TypeScript 6.0.3, NodeNext/module resolution, `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, and `skipLibCheck: false`.

Positive cases prove default `light | dark`, additive and exact mode inference, valid defaults,
exact `light`/`dark` without redundant appearance, custom modes with explicit appearance, a valid
Material role reference through real core, and mode preservation through graph definition and
compilation.

Negative cases enforce Material role typo rejection by real core, required custom-mode appearance,
redundant appearance rejection for exact `light` and `dark`, mutual exclusion, and unknown default
rejection on additive and exact paths. No exact TypeScript diagnostic wording or code is asserted.

## Heterogeneous tuple finding and correction

The mandatory two-layer case initially failed. This was a real core defect: private
`LayerKeyOf<Layers>` placed `Layers[number]` directly on the left side of a conditional, so the
conditional did not distribute across a heterogeneous tuple union. Both external-layer key sets
were lost from reference inference.

The narrow correction introduces a distributive `LayerMemberKey<Layer>` helper and applies it to
`Layers[number]`. Runtime code and data are unchanged. A general non-Material type regression and the
Material R&D tuple proof now establish that all finite Material keys, the real second-layer key
`brand.seed`, and direct semantic keys survive exact `selection: "all"`; typos against either layer
member fail.

Because literal layer-key inference is published behavior, the correction has an API snapshot diff
and its own changeset.

## Reproduced role surface

The exact installed `MaterialDynamicColors` instance prototype yielded:

```text
accepted system roles             48
excluded role methods             11
classified role methods           59
helper methods outside role set    1  highestSurface
unknown prototype methods          0
unclassified role methods          0
accepted/excluded overlap          0
```

The 11 executable exclusions are six palette-key methods, four incoherent bare dims
(`primaryDim`, `secondaryDim`, `tertiaryDim`, `errorDim`), and deprecated `surfaceTint`. The gate
explicitly retains `surfaceDim`, `surfaceBright`, and every accepted `*FixedDim` role. `background`
and `onBackground` also remain accepted.

## Reproduced capability matrix

The repository compared requested 2021 and requested 2025 across:

```text
8 seeds
× light/dark
× contrast -1, 0, 0.5, 1
× 59 classified role methods
× 9 variants
= 33,984 role comparisons
```

Seeds were `#6750a4`, `#006a60`, `#b3261e`, `#ffbf00`, `#0095a8`, `#777777`, `#8a8c2a`, and
`#009489`. Every coordinate used phone generation.

| Variant     | Effective requested-2025 spec | Identical | Different | Adapter result |
| ----------- | ----------------------------: | --------: | --------: | -------------- |
| monochrome  |                          2021 |     3,776 |         0 | reject         |
| neutral     |                          2025 |       450 |     3,326 | support        |
| tonal-spot  |                          2025 |       562 |     3,214 | support        |
| vibrant     |                          2025 |       443 |     3,333 | support        |
| expressive  |                          2025 |       407 |     3,369 | support        |
| fidelity    |                          2021 |     3,776 |         0 | reject         |
| content     |                          2021 |     3,776 |         0 | reject         |
| rainbow     |                          2021 |     3,776 |         0 | reject         |
| fruit-salad |                          2021 |     3,776 |         0 | reject         |

This reproduces the independent capability shape without freezing exact counts as public adapter
API. The committed matrix stores inputs, role classification, effective specs, per-role counts, and
per-coordinate hashes so an engine upgrade remains reviewable.

## Derived branch certification

The broad probe asserts `Hct.isYellow` over `[105, 125)` and `Hct.isCyan` over `[170, 207)`. Before
golden generation, the exact engine produced:

| Seed      | Derived palette  |            Light hue |             Dark hue | Predicate               |
| --------- | ---------------- | -------------------: | -------------------: | ----------------------- |
| `#8a8c2a` | `neutralPalette` | `112.26236398709452` | `112.26236398709452` | `Hct.isYellow === true` |
| `#009489` | `primaryPalette` | `187.66649302382956` | `187.66649302382956` | `Hct.isCyan === true`   |

Fixture generation fails if either derived hue stops reaching its intended branch. No claim is made
from source hue alone.

## Four primary vectors

The repository generates exactly four human-review fixtures, each with 48 sorted keys, complete
light/dark maps, lowercase opaque hex values, and canonical metadata:

1. `#6750a4`, 2021, tonal-spot, contrast 0: recovered baseline.
2. `#6750a4`, 2025, tonal-spot, contrast 0: isolated transition, 87/96 values changed.
3. `#8a8c2a`, 2025, expressive, contrast 1: derived yellow hard path.
4. `#009489`, 2025, expressive, contrast 1: derived cyan hard path.

Byte comparison after repository generation:

| Vector          | Oracle                        | Result    | SHA-256                                                            |
| --------------- | ----------------------------- | --------- | ------------------------------------------------------------------ |
| baseline        | recovered primary R&D fixture | identical | `266f8b8e70725e19b5011397be8b792f9cebcd64d6a81c4cfdc6155d25b2c436` |
| spec transition | independent secondary fixture | identical | `180f2a1316b8727f2c3194694ac7c31e82abed22e55c86b38c9ca594162f6e3f` |
| hard yellow     | independent secondary fixture | identical | `bf92f39dda8432fc29a32e1ef79c7e8eb756d412bf206972089fe1c0513f3733` |
| hard cyan       | independent secondary fixture | identical | `c060e07d552436fd045996c68caa8281a86b9c738ac88e1d374fc3fe5f289171` |

The external files are not committed. Normal validation regenerates into a temporary directory and
byte-compares against repository-owned fixtures.

## Phase-1 final state

Both exit conditions are reproducible from the repository:

1. pinned MCU engine, role, capability, branch, and golden-vector evidence;
2. real `scheme-tokens` type and heterogeneous composition evidence.

ADRs 0005–0007 capture package boundary, authoring/modes, and engine/roles at separate change
boundaries. The architecture is sufficiently evidenced for the next session. Phase 1 closes here,
and this session stops before public adapter implementation.

## Remaining implementation work

The next session still must create the actual adapter package and licensing artifacts; implement the
private engine boundary, strict configuration validation, accepted role catalog, and overloads; test
visibility, override provenance, direct dependencies, CSS naming, and layer serialization; snapshot
adapter declarations; prove packed ESM and NodeNext consumers; and add the adapter release changeset.

No public helper, adapter package, custom CSS operation, platform option, manifest, preset, palette
API, custom color, 2026/CMF support, or multi-source behavior is implemented by this closure.

## Validation record

Focused evidence executed during closure:

```text
PASS  primary archive SHA256SUMS verification
PASS  historical patch payload equality verification; patch not applied
PASS  raw MCU 0.4.0 Node import reproduced the extensionless-ESM failure
PASS  pnpm 11.7.0 install of all three workspaces
PASS  pnpm build
PASS  strict R&D script typecheck
PASS  strict NodeNext real-core type probe
PASS  pnpm material3-rnd:generate
PASS  four-vector repository contract check
PASS  recovered baseline byte comparison
PASS  three independent secondary byte comparisons
PASS  pnpm test:material3-rnd deterministic regeneration check
```

Final repository gates are recorded in the completion report for the closure commit.
