# ADR 0016: Material option presence establishes static facts

Status: Accepted, 2026-09-30. Narrowly supersedes ADR 0014's optional-input options and
function signature, including its claim that NoInfer alone establishes the returned facts.
The original ADR remains a historical record. This correction is P5.1; P6/P7 remain deferred.

## Evidence

Against P5's starting declarations, these ordinary annotations passed TypeScript 7.0.2
under strict-only and stricter NodeNext settings, without assertions or suppressions:

```ts
const internal: Material3Options<Material3ColorMode, "internal"> = {};
const custom: Material3Options<"custom"> = {};
```

Passing the first to `material3()` promised internal visibility, but runtime defaulted to
public. With one public alias, compilation claimed a complete alias-only record while
runtime emitted 49 keys. The second promised custom modes but generated light/dark;
a custom-only graph accepted it statically and threw `layer-mode-mismatch` at runtime.
A wrapper with the narrowed options defaulting to `{}` repeated the visibility defect.

NoInfer prevents return context from supplying generic arguments. It does not prove that
an optional property exists, nor stop an annotation or explicit generic from making an
unsupported claim. The gap originated in ADR 0014's prototype as well as the implementation.

## Decision

`Material3Options<Mode, Visibility>` is an intersection type. The ordinary optional fields
provide inference; additional requirements, protected by NoInfer, validate that inference:

- `modes` may be omitted only for exactly `Material3ColorMode` (light and dark). Every other
  mode type requires a map, including a single built-in mode, dynamic string, and never.
  The existing empty-map marker makes `Material3Modes<never>` uninhabitable by an empty map.
- `visibility` may be omitted only when its type includes the runtime default, public.
  Internal therefore requires an explicit setting; bare options still permit either value.

The function has two signatures with distinct purposes: a non-generic omitted/undefined
options call returning light/dark and public, and a generic call requiring an options object.
Explicit generics always use the latter. Generic return modes and visibility retain NoInfer.
The requirements cannot supply inference candidates themselves: otherwise TypeScript can widen
an annotated public default to unknown visibility while solving the conditional intersections.

Mode facts describe one complete set, never a union of alternative sets. We reject a possibly
undefined options variable at the call boundary rather than claim that default and custom
names form one generated set. Callers narrow the variable or supply a valid fallback first.
The same applies to optional custom maps and optional internal-only visibility fields.

Annotations for non-default configurations must include their required fields. Generic wrappers
can forward `Material3Options<Mode, Visibility>` unchanged and retain precision. A bare-options
wrapper may default to `{}` and returns conservative visibility; a custom/internal wrapper must
supply its map and visibility in its default. `satisfies` preserves literal settings.

The overload implementation returns the actual core-validated layer without an assertion.
Its signatures rely on the fixed 48-role catalog, preflighted complete mode maps, and omitted
declaration visibility. Return declarations spell the exported core `TokenLayer` directly:
a private Material return alias failed consumer declaration emission because core's nominal
internals were not nameable. No core proof or export is changed to accommodate the adapter.

## Unchanged decisions and proof

ADR 0014's runtime behavior, errors, fixed id, mode mapping, per-field overrides, coordinate
validation, six named type exports and single runtime export remain intact. Defaults stay
light/dark and public. Current P3 visibility facts remain default plus public/internal never
and omitted Material3TokenKey. Unknown visibility keeps public selection partial over all
possible graph keys; known internal, selection all and exact selection retain their guarantees.

The authoritative Material matrix adds omission, annotation, explicit-generic, optional-input,
wrapper and downstream cases alongside the existing three contextual NoInfer negatives.
The same matrix runs against paired packed declarations under strict-only and stricter
NodeNext with skipLibCheck false and consumer declaration emission. Focused runtime observations
verify the unchanged defaults and a supplied custom/internal wrapper. Engine, role, golden,
core API, CSS, schema, wire and dependency contracts are unchanged.

A focused Material minor changeset accompanies the snapshot. The pending P5 changeset remains;
temporary Changesets projection still targets core 0.4.0, Material 0.2.0 and peer ^0.4.0.
Committed versions and release status do not change.
