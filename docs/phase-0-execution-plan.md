# Phase 0 Execution Plan

Phase 0 turns the project-review architecture direction into a release-contract cleanup. It is intentionally smaller than
the full architecture roadmap.

## Entry rules

- Treat `docs/project-review-analysis.md` as direction plus blocker triage.
- Treat section 3 of that document as the only mandatory pre-publication blocker set.
- Keep the package root generic and keep Material 3 behind `color-scheme-tokens/sources/material3`.
- Do not rename the root API, split packages, add DTCG export, add typed builders, add full provenance traces, or add
  deferred feature work.

## Phase 0 slices

### Slice 0: decision lock and transform removal

Status: in progress in this pass.

Deliverables:

- Record the source mounting decision: Model A for v1, plural mounted sources deferred.
- Record the naming decision: Option A for v1, keep current root names.
- Record the transform decision: remove the public graph transform hook from v1.
- Record DTCG as importer/exporter interop only.
- Record the Material source boundary and serializer boundary.
- Remove the recipe `transform` hook with no compatibility alias.
- Add focused contract-doc tests for decisions and graph blockers that are not safe to half-implement.

### Slice 1: expression references

Deliverables:

- Replace separate alias-node semantics with a `reference` expression in the graph value model.
- Keep literal color values as literal expressions.
- Move dependency extraction and cycle detection to expression traversal.
- Preserve deterministic compiled output.

Exit checks:

- Alias/reference cycles fail through the expression model.
- Mode-specific references work through the same value path as literals.
- Existing Material 3 snapshots remain deterministic after fixture updates.

### Slice 2: explicit default mode

Deliverables:

- Add `defaultMode` to the graph contract.
- Validate that `defaultMode` exists in `modes`.
- Make CSS default selector selection use `defaultMode`, not array position.

Exit checks:

- Reordering modes does not silently change the default selector.
- Missing or unknown `defaultMode` returns structured validation problems.

### Slice 3: visibility and selection

Deliverables:

- Add required token visibility: `public` or `internal`.
- Make source-generated primitives internal by default.
- Make application semantic tokens public explicitly.
- Change compilation defaults to `selection: "public"`.
- Keep exact `include` as an override that rejects unknown and duplicate keys.
- Return `no-public-tokens` when public selection produces no tokens.

Exit checks:

- Public tokens can reference internal tokens.
- Internal dependency tokens resolve but do not emit by default.
- Visibility is not inferred from namespace or provenance.

### Slice 4: serializer and boundary verification

Deliverables:

- Keep `serializeTokenSet()` as the canonical internal snapshot format.
- Keep DTCG out of core graph, compile, serializer, and root export.
- Keep Material utilities out of root, core, recipes, layers, exporters, and serializer.

Exit checks:

- Boundary tests pass from source and packed-consumer contexts.
- Deterministic snapshot fixtures remain byte-for-byte intentional.

## Phase 0 exit criteria

Phase 0 is complete when these blocker questions are no longer open:

- References are graph expressions, not separate alias semantics.
- The default mode is explicit.
- Token visibility is explicit.
- Public compilation selection is the default.
- The transform escape hatch has been removed from the public recipe contract.
- DTCG is documented as interop only.
- Material 3 remains an adapter subpath.
- `serializeTokenSet()` remains the canonical internal snapshot format.
- Source mounting is decided for v1.
- Public API naming is decided for v1.

## Deferred work

DTCG export/import, typed builders, full provenance traces, contrast utilities, token diffing, `light-dark()` CSS output,
color algebra, shadcn targets, package splits, and source mounting are outside Phase 0 unless a later decision changes
the v1 requirement.
