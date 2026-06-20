# Post-publication compatibility and maintenance policy

This policy applies after the first stable v1 publication. Before publication, the migration may break the current `0.0.0` code freely and must not add compatibility code.

## 1. Contract categories

The following are public contracts:

1. package entry points and runtime export names;
2. exported type names and assignability;
3. closed string unions and discriminated unions;
4. Result/Issue shape;
5. issue codes and JSON Pointer path semantics;
6. graph/fragment/compiled JSON formats and `formatVersion`;
7. accepted identifier and color grammar;
8. compilation, reference, visibility, selection, and ordering semantics;
9. canonical serialized bytes;
10. canonical CSS bytes/default selectors/variable naming;
11. color conversion/gamut/mapping numerical behavior within documented tolerances;
12. Material role inventory/defaults/generated outputs within documented dependency/algorithm version;
13. dependency-loading boundaries and public declaration independence;
14. minimum supported Node version.

Human-readable issue messages are not contractual.

## 2. Major changes

After v1, these require a major version unless introduced through a separately versioned opt-in that leaves existing behavior unchanged:

- removing, renaming, or changing a runtime export;
- removing, renaming, or incompatibly changing an exported type;
- adding a new member to a closed issue-code union used for exhaustive switches;
- adding a new `ColorValue`, `ColorSpace`, `ColorGamut`, `TokenOrigin`, strategy, or mapping-method union member when existing consumers may be exhaustive;
- adding a required input property;
- making an optional property required;
- changing identifier grammar or normalization;
- changing `value`/`valueByMode`/reference semantics;
- changing default visibility or default selection;
- changing exact mode-map/fallback behavior;
- changing canonical order;
- changing CSS variable-name encoding;
- changing default selectors or exact CSS whitespace/newline/value formatting;
- changing canonical JSON property order/metadata inclusion/number formatting/newline;
- adding an always-emitted compiled/serialized field;
- changing `formatVersion` meaning or supported input format;
- changing Material guaranteed role inventory;
- changing Material defaults or generated values due to algorithm/dependency behavior;
- changing conversion matrices/adaptation/mapping algorithm beyond documented tolerance;
- making an operation implicitly clip/map that previously did not;
- changing a dependency distribution boundary in a way that affects consumer runtime/bundle behavior;
- raising the Node minimum.

### 2.1 Why adding an issue code can be breaking

Consumers are encouraged to narrow by `issue.code`:

```ts
switch (
  issue.code
  // exhaustive cases
) {
}
```

Adding a code to an exported closed union can break exhaustive compilation. Therefore it is major. A function that needs extensible third-party source codes already expresses them through the generic source issue parameter rather than silently widening a core union.

### 2.2 Why output fixes can be major

CSS and canonical JSON are intended for checked-in artifacts, caches, diffs, and build pipelines. Byte changes are observable even when visually equivalent. After v1, do not call an arbitrary output change a patch merely because it fixes an internal implementation.

If old bytes unambiguously violate a normative v1 requirement, a narrowly scoped correction may be considered a patch only after documenting the violation, impact, and migration risk. Default to a major release when consumers could depend on the bytes.

## 3. Minor changes

Normally minor when they do not alter existing behavior:

- a new independent public function or subpath;
- a new optional input property whose absence preserves exact prior behavior and output;
- a new schema annotation/documentation field that is not emitted into canonical data;
- support for an additional accepted color string spelling that maps to an existing `ColorValue` and does not change prior parse results;
- a new opt-in exporter strategy with a new closed-union member only if the type union change is deliberately treated as extensible; under the current closed-union policy, such a member is major, so prefer a new function/versioned options object;
- new noncontractual TSDoc/examples;
- performance improvements with identical results;
- additive test/tooling/package metadata that does not alter runtime/type behavior.

Because many v1 unions are intentionally closed, “additive” is not automatically nonbreaking in TypeScript. Evaluate exhaustive consumers.

## 4. Patch changes

Normally patch:

- issue message wording;
- documentation typo fixes;
- internal refactoring with identical public declarations and outputs;
- performance/memory improvements with identical semantics;
- test/CI/tooling fixes;
- dependency security/patch upgrades proven not to alter public output, declarations, runtime requirements, or import boundaries;
- parser crash fixes that make previously invalid input return the already specified issue without changing valid-input results;
- ownership fixes that remove unintended aliasing while preserving values.

## 5. Input broadening policy

Accepting previously invalid input can be behaviorally observable. Classify it by impact:

- an equivalent spelling within the documented grammar clarification: patch or minor;
- a new concrete syntax mapping to an existing color variant: minor;
- a contextual/computed syntax or new data model: major;
- relaxed unknown-property behavior: major and generally rejected;
- silent normalization of formerly rejected identifiers: major and contrary to policy.

## 6. Optional output fields

Adding an optional TypeScript property to an input/options interface is generally minor when absent behavior is unchanged.

Adding a property to canonical parsed/compiled output is major if the property is always present or changes serialized bytes. An in-memory optional property that is omitted unless a new opt-in is used may be minor, but the serializer and schema impact must be evaluated separately.

## 7. Format versioning

`formatVersion` is per persisted object format. V1 currently uses numeric `1` for graph, fragment, and compiled token set.

Rules:

- reject unsupported versions with structured issues;
- do not guess or coerce versions;
- do not add implicit v0 readers;
- a breaking wire-format change increments `formatVersion` and normally accompanies a package major;
- if multiple versions are supported later, each reader/writer is explicit and tested; no hidden migration during ordinary parsing;
- `$schema` URLs are versioned independently but must correspond to the format.

## 8. Canonical output policy

Every release candidate must compare canonical output against approved fixtures and property invariants.

A change to any of these is reviewed as a public contract change:

```text
field inclusion
field order
record key order
mode order
dependency order
number formatting
color syntax
CSS selector/default strategy
CSS whitespace/newlines
custom-property naming
Material generated values
```

Do not update golden snapshots without a written explanation and semver classification.

## 9. Numerical dependency upgrades

`@texel/color` and `@material/material-color-utilities` are exact-pinned because upgrades can alter deterministic output.

Upgrade procedure:

1. read upstream changelog/diff/license;
2. run all reference vectors and property tests;
3. compare canonical Material/convert/map fixtures;
4. quantify numerical differences with the documented metric;
5. verify gamut postconditions;
6. inspect bundle/import/declaration behavior;
7. classify semver based on observable changes;
8. update attribution/dependency documentation.

A dependency patch number does not imply this package can publish a patch.

## 10. Material evolution policy

The fixed `Material3TokenKey` inventory is a v1 contract.

- upstream optional/new roles are not automatically emitted;
- adding/removing a guaranteed role is major;
- upstream algorithm output changes are public output changes;
- supporting a new `specVersion`/platform/variant adds a closed union member and is major under the exhaustive-union policy unless exposed through a new versioned API;
- deprecating an upstream role requires an explicit package-level plan, not silent disappearance.

## 11. Issue-code maintenance

- Codes are lower-kebab stable identifiers.
- Paths use RFC 6901 consistently.
- Messages may be improved without semver impact.
- Do not repurpose an existing code for a materially different condition.
- Do not merge two codes if consumers may distinguish them without a major release.
- Context fields required by a specific issue variant remain stable.
- New source-specific custom codes belong to the source’s generic issue union, not the core union.

## 12. Deprecation policy

The pre-publication migration uses no deprecations.

After v1, deprecation may be used only when maintaining an old contract through at least one release is worth the surface cost. A deprecation must include:

- replacement;
- reason;
- planned removal major;
- tests proving old/new behavior;
- documentation and changelog.

Do not use deprecation as a default substitute for decisive API design.

## 13. Node support policy

Initial v1 floor is Node 22, with CI on Node 22 and 24.

- dropping an advertised Node major is a package major;
- adding support for a newer Node line is nonbreaking;
- remove EOL lines only in a planned major;
- browser-neutral root source must remain free of accidental Node APIs despite the package’s build/test tooling.

## 14. Package entry-point policy

- no undocumented deep imports;
- each public subpath has runtime and declaration approval;
- adding a new subpath can be minor if it does not alter existing surfaces;
- removing/renaming a subpath is major;
- changing ESM/CJS availability is major;
- public declarations must remain dependency-type clean and compile with `skipLibCheck: false`.

## 15. Documentation as contract

Executable README/public examples are part of the release gate. When implementation changes, update examples in the same change and run them against the packed tarball.

Internal design documents may evolve, but no internal migration/review artifact ships in the package tarball.

## 16. Release process after migration

The automated migration run does not publish. A later owner-controlled first release should:

1. review all approved API files and schemas;
2. run `pnpm release:check` from a clean checkout;
3. inspect tarball contents;
4. decide the first version/private flag deliberately;
5. update changelog/release notes;
6. configure required CI checks/branch protection;
7. tag/publish manually or through a separately approved release workflow.

## 17. Change-review checklist

For every future public change, answer:

1. Is the new capability expressible through existing JSON data rather than a callback/helper?
2. Does it change a closed union?
3. Does it change accepted/rejected input?
4. Does it change issue codes/paths?
5. Does it change canonical JSON or CSS bytes?
6. Does it change color numbers or gamut behavior?
7. Does it change Material keys/values/defaults?
8. Does it leak a dependency type or load a new module from root?
9. Does it affect ownership/determinism/performance?
10. What semver level follows from the most observable change?

Write the usage example first against the literal packed entry point, then update runtime/type surface approvals, schemas, tests, and docs together.
